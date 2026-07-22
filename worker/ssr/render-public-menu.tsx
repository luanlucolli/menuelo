import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import type { MenuResponse, PublicMenuBootstrap } from '../../shared/schemas'
import { buildPublicSeo, type PublicSeoData } from '../../shared/public-seo'
import { serializeJsonForHtml } from '../../shared/safe-json'
import { getZonedClock } from '../../shared/utils'
import { PublicMenu } from '../../src/react-app/modules/public-menu/PublicMenu'
import { isLocalHostname } from '../middleware/auth'

const IDENTIFIER_PREFIX = 'menuelo-'

function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function securityHeaders(headers: Headers, requestUrl: string, nonce: string) {
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  headers.set('X-Frame-Options', 'DENY')
  if (!isLocalHostname(new URL(requestUrl).hostname)) {
    headers.set('Content-Security-Policy', [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}'`,
      "style-src-elem 'self'",
      "style-src-attr 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ].join('; '))
  }
}

function documentRewriter(markup: string, bootstrap: PublicMenuBootstrap, seo: PublicSeoData, nonce: string): HTMLRewriter {
  const state = serializeJsonForHtml(bootstrap)
  const jsonLd = serializeJsonForHtml(seo.jsonLd)
  const headExtras = [
    `<link rel="canonical" href="${escapeHtmlAttribute(seo.canonical)}">`,
    `<meta property="og:url" content="${escapeHtmlAttribute(seo.canonical)}">`,
    seo.image ? `<meta property="og:image" content="${escapeHtmlAttribute(seo.image)}">` : '',
    seo.favicon ? `<link rel="icon" href="${escapeHtmlAttribute(seo.favicon)}" type="image/x-icon" sizes="any">` : '',
    `<script type="application/ld+json" data-menu-json-ld nonce="${nonce}">${jsonLd}</script>`,
  ].join('')
  const stateScript = `<script id="__MENU_DATA__" type="application/json" nonce="${nonce}">${state}</script>`

  return new HTMLRewriter()
    .on('title', { element: (element) => { element.setInnerContent(seo.title) } })
    .on('meta[name="theme-color"]', { element: (element) => { element.setAttribute('content', seo.themeColor) } })
    .on('meta[name="description"]', { element: (element) => { element.setAttribute('content', seo.description) } })
    .on('meta[property="og:type"]', { element: (element) => { element.setAttribute('content', 'website') } })
    .on('meta[property="og:title"]', { element: (element) => { element.setAttribute('content', seo.title) } })
    .on('meta[property="og:description"]', { element: (element) => { element.setAttribute('content', seo.description) } })
    .on('head', { element: (element) => { element.append(headExtras, { html: true }) } })
    .on('#root', {
      element: (element) => {
        element.setInnerContent(markup, { html: true })
        element.after(stateScript, { html: true })
      },
    })
}

export async function renderPublicMenuDocument(request: Request, assets: Fetcher, menu: MenuResponse): Promise<Response> {
  const bootstrap = createPublicMenuBootstrap(menu)
  const publicOrigin = menu.business.publicSiteUrl ?? new URL(request.url).origin
  const seo = buildPublicSeo(menu, publicOrigin)
  const markup = renderPublicMenuMarkup(bootstrap)
  const shellUrl = new URL('/index.html', request.url)
  const shell = await assets.fetch(new Request(shellUrl, { headers: { Accept: 'text/html' } }))
  if (!shell.ok || !shell.body) throw new Error(`STATIC_SHELL_UNAVAILABLE:${shell.status}`)

  const nonce = createNonce()
  const headers = new Headers(shell.headers)
  headers.set('Content-Type', 'text/html; charset=UTF-8')
  headers.set('Cache-Control', 'public, max-age=0, s-maxage=60, must-revalidate')
  securityHeaders(headers, request.url, nonce)
  const source = new Response(shell.body, { status: 200, headers })
  return documentRewriter(markup, bootstrap, seo, nonce).transform(source)
}

export function createPublicMenuBootstrap(menu: MenuResponse, renderedAt = new Date().toISOString()): PublicMenuBootstrap {
  return {
    schemaVersion: 1,
    menu,
    renderedAt,
    initialClock: getZonedClock(new Date(renderedAt), menu.business.timezone),
  }
}

export function renderPublicMenuMarkup(bootstrap: PublicMenuBootstrap): string {
  return renderToString(
    <StrictMode><PublicMenu menu={bootstrap.menu} initialClock={bootstrap.initialClock} /></StrictMode>,
    { identifierPrefix: IDENTIFIER_PREFIX },
  )
}

export function publicErrorDocument(status: 500 | 502 | 503): Response {
  const title = status === 503 ? 'Cardápio temporariamente indisponível' : 'Não foi possível abrir o cardápio'
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><style>body{margin:0;font-family:system-ui,sans-serif;background:#f7f4ef;color:#211f1b;display:grid;min-height:100vh;place-items:center}main{max-width:34rem;padding:2rem;text-align:center}a{display:inline-block;margin-top:1rem;padding:.75rem 1rem;border-radius:.75rem;background:#374151;color:#fff;text-decoration:none}</style></head><body><main><h1>${title}</h1><p>Tente novamente em alguns instantes.</p><a href="/">Tentar novamente</a></main></body></html>`
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    },
  })
}
