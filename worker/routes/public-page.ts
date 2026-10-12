import type { Handler } from 'hono'
import { ZodError } from 'zod'
import type { AppEnvironment } from '../middleware/auth'
import { isLocalHostname } from '../middleware/auth'
import { findPublicProduct, loadPublicMenu, resolvePublicOrigin } from '../services/public-menu'
import { buildPublicProductSeo, publicProductPath } from '../../shared/public-seo'
import { buildPublicRobotsTxt, buildPublicSitemap } from '../../shared/public-sitemap'
import { publicErrorDocument, publicNotFoundDocument, renderPublicMenuDocument, renderPublicProductDocument } from '../ssr/render-public-menu'

export function publicHtmlCacheKey(requestUrl: string): Request {
  const url = new URL(requestUrl)
  url.pathname = '/'
  url.search = ''
  url.hash = ''
  return new Request(url, { method: 'GET' })
}

export async function invalidatePublicHtmlCache(requestUrl: string): Promise<void> {
  const cache = (caches as CacheStorage & { readonly default: Cache }).default
  try {
    await cache.delete(publicHtmlCacheKey(requestUrl))
  } catch (error) {
    logPublicError('public HTML cache invalidation failed', error, requestUrl)
  }
}

function responseForMethod(response: Response, method: string, cacheStatus?: 'HIT' | 'MISS'): Response {
  const headers = new Headers(response.headers)
  if (cacheStatus) headers.set('X-Menuelo-Cache', cacheStatus)
  return new Response(method === 'HEAD' ? null : response.body, { status: response.status, statusText: response.statusText, headers })
}

function logPublicError(message: string, error: unknown, requestUrl: string) {
  console.error(JSON.stringify({ message, error: error instanceof Error ? error.message : String(error), path: new URL(requestUrl).pathname }))
}

export const servePublicPage: Handler<AppEnvironment> = async (c) => {
  if (String(c.env.PUBLIC_SSR_ENABLED) !== 'true') {
    const shellUrl = new URL('/index.html', c.req.url)
    const shell = await c.env.ASSETS.fetch(new Request(shellUrl, { method: c.req.method }))
    const headers = new Headers(shell.headers)
    headers.set('X-Robots-Tag', 'noindex, nofollow')
    return new Response(c.req.method === 'HEAD' ? null : shell.body, { status: shell.status, headers })
  }

  const cacheKey = publicHtmlCacheKey(c.req.url)
  const cache = (caches as CacheStorage & { readonly default: Cache }).default
  const shouldCache = !isLocalHostname(new URL(c.req.url).hostname)
  if (shouldCache) {
    try {
      const cached = await cache.match(cacheKey)
      if (cached) return responseForMethod(cached, c.req.method, 'HIT')
    } catch (error) {
      logPublicError('public HTML cache read failed', error, c.req.url)
    }
  }

  let menu
  try {
    menu = await loadPublicMenu(c.env.DB, c.req.url, c.env.PUBLIC_SITE_URL)
  } catch (error) {
    logPublicError(error instanceof ZodError ? 'public menu validation failed' : 'public menu data load failed', error, c.req.url)
    return publicErrorDocument(error instanceof ZodError ? 500 : 503)
  }

  let response: Response
  try {
    response = await renderPublicMenuDocument(c.req.raw, c.env.ASSETS, menu)
  } catch (error) {
    logPublicError('public menu SSR failed', error, c.req.url)
    const missingShell = error instanceof Error && error.message.startsWith('STATIC_SHELL_UNAVAILABLE:')
    return publicErrorDocument(missingShell ? 502 : 500)
  }

  if (shouldCache && response.ok && c.req.method === 'GET') {
    const cacheWrite = cache.put(cacheKey, response.clone()).catch((error: unknown) => logPublicError('public HTML cache write failed', error, c.req.url))
    c.executionCtx.waitUntil(cacheWrite)
  }
  return responseForMethod(response, c.req.method, 'MISS')
}

export const serveRobots: Handler<AppEnvironment> = (c) => {
  const origin = resolvePublicOrigin(c.req.url, c.env.PUBLIC_SITE_URL)
  return c.text(buildPublicRobotsTxt(origin), 200, {
    'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    'X-Content-Type-Options': 'nosniff',
  })
}

export const serveSitemap: Handler<AppEnvironment> = async (c) => {
  const origin = resolvePublicOrigin(c.req.url, c.env.PUBLIC_SITE_URL)
  const menu = await loadPublicMenu(c.env.DB, c.req.url, c.env.PUBLIC_SITE_URL)
  const xml = buildPublicSitemap(menu, origin)
  return c.body(xml, 200, {
    'Content-Type': 'application/xml; charset=UTF-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
}

export const serveIndexHtmlRedirect: Handler<AppEnvironment> = (c) => c.redirect('/', 308)

export const serveAdminDocument: Handler<AppEnvironment> = async (c) => {
  const shell = await c.env.ASSETS.fetch(new Request(new URL('/index.html', c.req.url), {
    method: 'GET',
    headers: { Accept: 'text/html' },
  }))
  if (!shell.ok || !shell.body) return publicErrorDocument(502)
  const headers = new Headers(shell.headers)
  headers.set('Content-Type', 'text/html; charset=UTF-8')
  headers.set('Cache-Control', 'no-store')
  headers.set('X-Robots-Tag', 'noindex, nofollow')
  headers.set('X-Content-Type-Options', 'nosniff')
  return new Response(c.req.method === 'HEAD' ? null : shell.body, { status: 200, headers })
}

export const servePublicProduct: Handler<AppEnvironment> = async (c) => {
  const productId = c.req.param('id') ?? ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productId)) {
    return publicNotFoundDocument(c.req.method)
  }

  let menu
  try {
    menu = await loadPublicMenu(c.env.DB, c.req.url, c.env.PUBLIC_SITE_URL)
  } catch (error) {
    logPublicError(error instanceof ZodError ? 'public menu validation failed' : 'public menu data load failed', error, c.req.url)
    return publicErrorDocument(error instanceof ZodError ? 500 : 503)
  }

  const productPage = findPublicProduct(menu, productId)
  if (!productPage) return publicNotFoundDocument(c.req.method)

  const canonicalPath = publicProductPath(productPage.product.id, productPage.product.name)
  const current = new URL(c.req.url)
  if (current.pathname !== canonicalPath) {
    const destination = new URL(canonicalPath, resolvePublicOrigin(c.req.url, c.env.PUBLIC_SITE_URL))
    destination.search = current.search
    return c.redirect(destination.toString(), 301)
  }

  const publicOrigin = resolvePublicOrigin(c.req.url, c.env.PUBLIC_SITE_URL)
  const seo = buildPublicProductSeo(menu, productPage, publicOrigin)
  let response: Response
  try {
    response = await renderPublicProductDocument(c.req.raw, c.env.ASSETS, menu, productPage)
  } catch (error) {
    logPublicError('public product SSR failed', error, c.req.url)
    const missingShell = error instanceof Error && error.message.startsWith('STATIC_SHELL_UNAVAILABLE:')
    return publicErrorDocument(missingShell ? 502 : 500)
  }
  if (seo.robots.startsWith('noindex')) {
    const headers = new Headers(response.headers)
    headers.set('X-Robots-Tag', 'noindex, follow')
    response = new Response(response.body, { status: response.status, headers })
  }
  return responseForMethod(response, c.req.method)
}
