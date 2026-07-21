import { describe, expect, it } from 'vitest'
import { publicHtmlCacheKey } from '../worker/routes/public-page'
import { createPublicMenuBootstrap, publicErrorDocument, renderPublicMenuMarkup } from '../worker/ssr/render-public-menu'
import { publicMenuFixture } from './public-fixture'

describe('SSR público', () => {
  it('renderiza estabelecimento, produto e preço antes do JavaScript', () => {
    const bootstrap = createPublicMenuBootstrap(publicMenuFixture(), '2026-07-21T01:00:00.000Z')
    const html = renderPublicMenuMarkup(bootstrap)
    expect(html).toContain('Lanchonete &lt;Especial&gt;')
    expect(html).toContain('Lanches')
    expect(html).toContain('X-Salada')
    expect(html).toContain('R$\u00a025,90')
    expect(html).toContain('Aberto agora')
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
    expect(await response.text()).toContain('temporariamente indisponível')
  })
})
