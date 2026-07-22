import { StrictMode, type ReactNode } from 'react'
import { createRoot, hydrateRoot, type Root } from 'react-dom/client'
import { menuResponseSchema, publicMenuBootstrapSchema, type MenuResponse, type PublicMenuBootstrap } from '../../shared/schemas'
import { buildPublicSeo } from '../../shared/public-seo'
import { getZonedClock } from '../../shared/utils'
import { PublicMenu } from './modules/public-menu/PublicMenu'

const IDENTIFIER_PREFIX = 'menuelo-'
const root = document.getElementById('root')
let clientRoot: Root | null = null

function publicTree(bootstrap: PublicMenuBootstrap): ReactNode {
  return <StrictMode><PublicMenu menu={bootstrap.menu} initialClock={bootstrap.initialClock} /></StrictMode>
}

function setMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.append(element)
  }
  element.content = content
}

function applyClientSeo(menu: MenuResponse) {
  const publicOrigin = menu.business.publicSiteUrl || window.location.origin
  const seo = buildPublicSeo(menu, publicOrigin)
  document.title = seo.title
  setMeta('meta[name="theme-color"]', 'name', 'theme-color', seo.themeColor)
  setMeta('meta[name="description"]', 'name', 'description', seo.description)
  setMeta('meta[property="og:type"]', 'property', 'og:type', 'website')
  setMeta('meta[property="og:title"]', 'property', 'og:title', seo.title)
  setMeta('meta[property="og:description"]', 'property', 'og:description', seo.description)
  setMeta('meta[property="og:url"]', 'property', 'og:url', seo.canonical)
  if (seo.image) setMeta('meta[property="og:image"]', 'property', 'og:image', seo.image)
  else document.head.querySelector('meta[property="og:image"]')?.remove()
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.append(canonical)
  }
  canonical.href = seo.canonical
  const favicon = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (seo.favicon) {
    const icon = favicon ?? document.createElement('link')
    icon.rel = 'icon'
    icon.type = 'image/x-icon'
    icon.sizes = 'any'
    icon.href = seo.favicon
    if (!favicon) document.head.append(icon)
  } else {
    favicon?.remove()
  }
  let jsonLd = document.head.querySelector<HTMLScriptElement>('script[data-menu-json-ld]')
  if (!jsonLd) {
    jsonLd = document.createElement('script')
    jsonLd.type = 'application/ld+json'
    jsonLd.dataset.menuJsonLd = 'true'
    document.head.append(jsonLd)
  }
  jsonLd.text = JSON.stringify(seo.jsonLd)
}

function readBootstrap(): PublicMenuBootstrap | null {
  const element = document.getElementById('__MENU_DATA__')
  if (!element?.textContent) return null
  try {
    const parsed = publicMenuBootstrapSchema.safeParse(JSON.parse(element.textContent))
    if (parsed.success) return parsed.data
    console.error('Bootstrap do cardápio inválido.', parsed.error.issues.map((issue) => issue.path.join('.')))
  } catch (error) {
    console.error('Não foi possível ler o bootstrap do cardápio.', error)
  }
  return null
}

async function fetchMenu(): Promise<PublicMenuBootstrap> {
  const response = await fetch('/api/menu', { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('Não foi possível carregar o cardápio.')
  const parsed = menuResponseSchema.safeParse(await response.json())
  if (!parsed.success) throw new Error('O cardápio recebido é inválido.')
  const renderedAt = new Date().toISOString()
  return {
    schemaVersion: 1,
    menu: parsed.data,
    renderedAt,
    initialClock: getZonedClock(new Date(renderedAt), parsed.data.business.timezone),
  }
}

function renderState(content: ReactNode) {
  if (!root) return
  clientRoot ??= createRoot(root, { identifierPrefix: IDENTIFIER_PREFIX })
  clientRoot.render(<StrictMode>{content}</StrictMode>)
}

async function mountFromApi(preserveServerHtml: boolean) {
  if (!root) return
  if (!preserveServerHtml) renderState(<main className="state-page"><span className="spinner" /><p>Carregando cardápio…</p></main>)
  try {
    const bootstrap = await fetchMenu()
    applyClientSeo(bootstrap.menu)
    if (preserveServerHtml) root.replaceChildren()
    clientRoot ??= createRoot(root, { identifierPrefix: IDENTIFIER_PREFIX })
    clientRoot.render(publicTree(bootstrap))
  } catch (error) {
    console.error('Falha ao carregar o cardápio.', error)
    if (preserveServerHtml) return
    renderState(<main className="state-page"><h1>Não foi possível abrir o cardápio</h1><p>Tente novamente em alguns instantes.</p><button type="button" onClick={() => window.location.reload()}>Tentar novamente</button></main>)
  }
}

const bootstrap = readBootstrap()
if (root && bootstrap) {
  try {
    hydrateRoot(root, publicTree(bootstrap), {
      identifierPrefix: IDENTIFIER_PREFIX,
      onCaughtError: (error) => console.error('Erro capturado no cardápio.', error),
      onRecoverableError: (error) => console.error('Erro recuperável durante a hidratação.', error),
      onUncaughtError: (error) => console.error('Erro não tratado no cardápio.', error),
    })
  } catch (error) {
    console.error('A hidratação do cardápio falhou; recuperando em CSR.', error)
    root.replaceChildren()
    createRoot(root, { identifierPrefix: IDENTIFIER_PREFIX }).render(publicTree(bootstrap))
  }
} else {
  void mountFromApi(Boolean(root?.hasChildNodes()))
}
