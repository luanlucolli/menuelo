import { StrictMode, type ReactNode } from 'react'
import { createRoot, hydrateRoot, type Root } from 'react-dom/client'
import { menuResponseSchema, publicMenuBootstrapSchema, type MenuResponse, type PublicMenuBootstrap } from '../../shared/schemas'
import { buildPublicProductSeo, buildPublicSeo, type PublicProductPageData } from '../../shared/public-seo'
import { getZonedClock } from '../../shared/utils'
import { primaryButton } from './lib/tailwind'
import { applyPublicSeo } from './lib/public-seo'
import { PublicMenu } from './modules/public-menu/PublicMenu'

const IDENTIFIER_PREFIX = 'menuelo-'
const root = document.getElementById('root')
let clientRoot: Root | null = null

function productPageForPath(menu: MenuResponse, pathname: string): PublicProductPageData | undefined {
  const match = pathname.match(/^\/produtos\/([^/]+)\/[^/]+$/)
  if (!match) return undefined
  let productId: string
  try {
    productId = decodeURIComponent(match[1]!)
  } catch {
    return undefined
  }
  for (const category of menu.categories) {
    const product = category.products.find((item) => item.id === productId)
    if (category.isActive && product) return { category, product }
  }
  return undefined
}

function publicTree(bootstrap: PublicMenuBootstrap, productPage?: PublicProductPageData): ReactNode {
  return <StrictMode><PublicMenu menu={bootstrap.menu} initialClock={bootstrap.initialClock} productPage={productPage} /></StrictMode>
}

function applyClientSeo(menu: MenuResponse, productPage?: PublicProductPageData): void {
  const publicOrigin = menu.business.publicSiteUrl || window.location.origin
  const seo = productPage
    ? buildPublicProductSeo(menu, productPage, publicOrigin)
    : buildPublicSeo(menu, publicOrigin)
  applyPublicSeo(seo)
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

function renderState(content: ReactNode): void {
  if (!root) return
  clientRoot ??= createRoot(root, { identifierPrefix: IDENTIFIER_PREFIX })
  clientRoot.render(<StrictMode>{content}</StrictMode>)
}

async function mountFromApi(preserveServerHtml: boolean): Promise<void> {
  if (!root) return
  if (!preserveServerHtml) renderState(<main className="grid min-h-[100dvh] place-content-center justify-items-center gap-[.8rem] p-8 text-center"><span className="h-8 w-8 animate-[spin_.8s_linear_infinite] rounded-full border-[3px] border-border border-t-[var(--color-brand)] motion-reduce:animate-none" /><p>Carregando cardápio…</p></main>)
  try {
    const bootstrap = await fetchMenu()
    const productPage = productPageForPath(bootstrap.menu, window.location.pathname)
    applyClientSeo(bootstrap.menu, productPage)
    if (preserveServerHtml) root.replaceChildren()
    clientRoot ??= createRoot(root, { identifierPrefix: IDENTIFIER_PREFIX })
    clientRoot.render(publicTree(bootstrap, productPage))
  } catch (error) {
    console.error('Falha ao carregar o cardápio.', error)
    if (preserveServerHtml) return
    renderState(<main className="grid min-h-[100dvh] place-content-center justify-items-center gap-[.8rem] p-8 text-center"><h1>Não foi possível abrir o cardápio</h1><p>Tente novamente em alguns instantes.</p><button className={primaryButton} type="button" onClick={() => window.location.reload()}>Tentar novamente</button></main>)
  }
}

const bootstrap = readBootstrap()
if (root && bootstrap) {
  try {
    const productPage = productPageForPath(bootstrap.menu, window.location.pathname)
    applyClientSeo(bootstrap.menu, productPage)
    hydrateRoot(root, publicTree(bootstrap, productPage), {
      identifierPrefix: IDENTIFIER_PREFIX,
      onCaughtError: (error) => console.error('Erro capturado no cardápio.', error),
      onRecoverableError: (error) => console.error('Erro recuperável durante a hidratação.', error),
      onUncaughtError: (error) => console.error('Erro não tratado na hidratação.', error),
    })
  } catch (error) {
    console.error('A hidratação do cardápio falhou; recuperando em CSR.', error)
    root.replaceChildren()
    createRoot(root, { identifierPrefix: IDENTIFIER_PREFIX }).render(publicTree(bootstrap, productPageForPath(bootstrap.menu, window.location.pathname)))
  }
} else {
  void mountFromApi(Boolean(root?.hasChildNodes()))
}
