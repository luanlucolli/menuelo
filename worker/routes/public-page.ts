import type { Handler } from 'hono'
import { ZodError } from 'zod'
import type { AppEnvironment } from '../middleware/auth'
import { loadPublicMenu, resolvePublicOrigin } from '../services/public-menu'
import { publicErrorDocument, renderPublicMenuDocument } from '../ssr/render-public-menu'

const EDGE_TTL_SECONDS = 60

export function publicHtmlCacheKey(requestUrl: string): Request {
  const url = new URL(requestUrl)
  url.pathname = '/'
  url.search = ''
  url.hash = ''
  return new Request(url, { method: 'GET' })
}

function responseForMethod(response: Response, method: string, cacheStatus: 'HIT' | 'MISS'): Response {
  const headers = new Headers(response.headers)
  headers.set('X-Menuelo-Cache', cacheStatus)
  return new Response(method === 'HEAD' ? null : response.body, { status: response.status, statusText: response.statusText, headers })
}

function logPublicError(message: string, error: unknown, requestUrl: string) {
  console.error(JSON.stringify({ message, error: error instanceof Error ? error.message : String(error), path: new URL(requestUrl).pathname }))
}

export const servePublicPage: Handler<AppEnvironment> = async (c) => {
  if (String(c.env.PUBLIC_SSR_ENABLED) !== 'true') {
    const shellUrl = new URL('/index.html', c.req.url)
    return c.env.ASSETS.fetch(new Request(shellUrl, { method: c.req.method }))
  }

  const cacheKey = publicHtmlCacheKey(c.req.url)
  const cache = (caches as CacheStorage & { readonly default: Cache }).default
  try {
    const cached = await cache.match(cacheKey)
    if (cached) return responseForMethod(cached, c.req.method, 'HIT')
  } catch (error) {
    logPublicError('public HTML cache read failed', error, c.req.url)
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

  if (response.ok && c.req.method === 'GET') {
    const cacheWrite = cache.put(cacheKey, response.clone()).catch((error: unknown) => logPublicError('public HTML cache write failed', error, c.req.url))
    c.executionCtx.waitUntil(cacheWrite)
  }
  return responseForMethod(response, c.req.method, 'MISS')
}

export const serveRobots: Handler<AppEnvironment> = (c) => {
  const origin = resolvePublicOrigin(c.req.url, c.env.PUBLIC_SITE_URL)
  return c.text(`User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${origin}/sitemap.xml\n`, 200, {
    'Cache-Control': `public, max-age=0, s-maxage=${EDGE_TTL_SECONDS * 60}`,
    'X-Content-Type-Options': 'nosniff',
  })
}

export const serveSitemap: Handler<AppEnvironment> = (c) => {
  const origin = resolvePublicOrigin(c.req.url, c.env.PUBLIC_SITE_URL)
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url></urlset>`
  return c.body(xml, 200, {
    'Content-Type': 'application/xml; charset=UTF-8',
    'Cache-Control': `public, max-age=0, s-maxage=${EDGE_TTL_SECONDS * 60}`,
    'X-Content-Type-Options': 'nosniff',
  })
}
