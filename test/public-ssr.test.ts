import { describe, expect, it } from 'vitest'
import { publicHtmlCacheKey } from '../worker/routes/public-page'
import { createPublicMenuBootstrap, publicErrorDocument, renderPublicMenuMarkup } from '../worker/ssr/render-public-menu'
import { buildPublicProductSeo } from '../shared/public-seo'
import { publicMenuFixture } from './public-fixture'

describe('SSR público', () => {
  it('renderiza estabelecimento, produto e preço antes do JavaScript', () => {
    const bootstrap = createPublicMenuBootstrap(publicMenuFixture(), '2026-07-21T01:00:00.000Z')
    const html = renderPublicMenuMarkup(bootstrap)
    expect(html).toContain('Lanchonete &lt;Especial&gt;')
    expect(html).toContain('Lanches')
    expect(html).toContain('X-Salada')
    expect(html).toContain('R$\u00a025,90')
    expect(html).toContain('href="/produtos/product-1/x-salada"')
    expect(html).toContain('Aberto agora')
    expect(html).toContain('data-menu-theme="classic"')
  })

  it('renderiza o tema rústico no HTML antes do JavaScript', () => {
    const menu = publicMenuFixture()
    menu.business.theme = 'rustic'
    const html = renderPublicMenuMarkup(createPublicMenuBootstrap(menu, '2026-07-21T01:00:00.000Z'))
    expect(html).toContain('data-menu-theme="rustic"')
  })

  it('renderiza conteúdo essencial e configurador de produto na página SSR', () => {
    const menu = publicMenuFixture()
    const category = menu.categories[0]!
    const product = category.products[0]!
    const html = renderPublicMenuMarkup(createPublicMenuBootstrap(menu, '2026-07-21T01:00:00.000Z'), { category, product })
    expect(html).toContain(`<h1 class="m-0 max-w-[18ch]`)
    expect(html).toContain(product.name)
    expect(html).toContain('Voltar ao cardápio')
    expect(html).toContain('Lanchonete &lt;Especial&gt;')
    expect(html).toContain(product.ingredients!)
    expect(html).toContain('R$\u00a025,90')
    expect(html).toContain('Ver opções e adicionar ao pedido')
    expect(buildPublicProductSeo(menu, { category, product }, 'https://cardapio.exemplo.com.br').canonical).toBe(`https://cardapio.exemplo.com.br/produtos/${product.id}/x-salada`)
  })

  it('normaliza queries sem misturar hostnames', () => {
    expect(publicHtmlCacheKey('https://a.example/?refresh=1').url).toBe('https://a.example/')
    expect(publicHtmlCacheKey('https://a.example/?refresh=1').url).toBe(publicHtmlCacheKey('https://a.example/?utm_source=x').url)
    expect(publicHtmlCacheKey('https://a.example/').url).not.toBe(publicHtmlCacheKey('https://b.example/').url)
  })

  it('não permite cache de documentos de erro', async () => {
    const response = publicErrorDocument(503)
    expect(response.status).toBe(503)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow')
    expect(await response.text()).toContain('temporariamente indisponível')
  })
})
