import { describe, expect, it } from 'vitest'
import { buildPublicProductSeo, buildPublicSeo, hasIndexableMenuContent, publicProductPath, safePublicHttpUrl } from '../shared/public-seo'
import { buildPublicRobotsTxt, buildPublicSitemap } from '../shared/public-sitemap'
import { publicMenuFixture } from './public-fixture'

describe('SEO público', () => {
  it('gera metadados da homepage e Restaurant a partir de dados reais', () => {
    const seo = buildPublicSeo(publicMenuFixture(), 'https://cardapio.exemplo.com.br')
    expect(seo).toMatchObject({
      title: 'Lanchonete <Especial> | Cardápio digital',
      description: 'Lanches e porções.',
      canonical: 'https://cardapio.exemplo.com.br/',
      themeColor: '#FB5D01',
      image: 'https://cardapio.exemplo.com.br/media/covers/123e4567-e89b-12d3-a456-426614174000.webp',
      favicon: 'https://cardapio.exemplo.com.br/media/favicons/123e4567-e89b-12d3-a456-426614174000.ico',
      robots: 'index,follow',
      openGraphType: 'website',
      siteName: 'Lanchonete <Especial>',
      locale: 'pt_BR',
      twitterCard: 'summary_large_image',
    })
    expect(seo.jsonLd).toMatchObject({
      '@type': 'Restaurant',
      '@id': 'https://cardapio.exemplo.com.br/#restaurant',
      name: 'Lanchonete <Especial>',
      url: 'https://cardapio.exemplo.com.br/',
      menu: 'https://cardapio.exemplo.com.br/#menu',
      telephone: '+5547999999999',
      address: { addressLocality: 'São José', addressRegion: 'SC', addressCountry: 'BR' },
    })
    expect(seo.jsonLd.openingHoursSpecification).toHaveLength(7)
  })

  it('prioriza os campos de SEO e usa cidade e bairro no fallback', () => {
    const menu = publicMenuFixture()
    menu.business.seoTitle = 'Cardápio artesanal da casa'
    menu.business.seoDescription = 'Veja os itens e preços publicados pela loja.'
    const custom = buildPublicSeo(menu, 'https://cardapio.exemplo.com.br')
    expect(custom.title).toBe('Cardápio artesanal da casa')
    expect(custom.description).toBe('Veja os itens e preços publicados pela loja.')

    menu.business.seoTitle = null
    menu.business.seoDescription = null
    menu.business.description = null
    const fallback = buildPublicSeo(menu, 'https://cardapio.exemplo.com.br')
    expect(fallback.description).toBe('Cardápio digital de Lanchonete <Especial> em Centro, São José.')
  })

  it('não indexa cardápio sem produto com preço publicado e ignora fechamento e indisponibilidade temporária', () => {
    const menu = publicMenuFixture()
    const product = menu.categories[0]!.products[0]!
    menu.hours = menu.hours.map((hour) => ({ ...hour, isClosed: true, opensAt: null, closesAt: null }))
    product.isAvailable = false
    expect(hasIndexableMenuContent(menu)).toBe(true)

    product.variants[0]!.isActive = false
    expect(hasIndexableMenuContent(menu)).toBe(false)
    expect(buildPublicSeo(menu, 'https://cardapio.exemplo.com.br').robots).toBe('noindex,follow')
  })

  it('omite dados opcionais ausentes ou inseguros', () => {
    const menu = publicMenuFixture()
    menu.business.coverImageKey = null
    menu.business.faviconKey = null
    menu.business.phone = null
    menu.business.whatsapp = null
    menu.business.address = null
    menu.business.addressPostalCode = null
    menu.business.addressStreet = null
    menu.business.addressNumber = null
    menu.business.addressNeighborhood = null
    menu.business.addressCity = null
    menu.business.addressState = null
    menu.business.instagramUrl = 'javascript:alert(1)'
    menu.hours = menu.hours.slice(0, 2)
    const seo = buildPublicSeo(menu, 'https://cardapio.exemplo.com.br')
    expect(seo.image).toBeNull()
    expect(seo.favicon).toBeNull()
    expect(seo.jsonLd).not.toHaveProperty('telephone')
    expect(seo.jsonLd).not.toHaveProperty('address')
    expect(seo.jsonLd).not.toHaveProperty('sameAs')
    expect(seo.jsonLd).not.toHaveProperty('openingHoursSpecification')
    expect(safePublicHttpUrl('javascript:alert(1)')).toBeNull()
  })

  it('mantém horário que atravessa a meia-noite em um único intervalo', () => {
    const menu = publicMenuFixture()
    menu.hours[6]!.opensAt = '20:00'
    menu.hours[6]!.closesAt = '02:00'
    const hours = buildPublicSeo(menu, 'https://cardapio.exemplo.com.br').jsonLd.openingHoursSpecification as Array<Record<string, string>>
    expect(hours.find((hour) => hour.dayOfWeek === 'Saturday')).toMatchObject({ opens: '20:00', closes: '02:00' })
  })

  it('gera página de produto canônica e Offers com preços ativos em BRL', () => {
    const menu = publicMenuFixture()
    const category = menu.categories[0]!
    const product = category.products[0]!
    product.name = 'X-Salada Especial'
    product.variants.push({ id: 'variant-2', label: 'Grande', priceCents: 3490, promotionalPriceCents: 2990, isActive: true, sortOrder: 1 })
    product.variants.push({ id: 'variant-3', label: 'Inativo', priceCents: 5000, promotionalPriceCents: null, isActive: false, sortOrder: 2 })
    product.isAvailable = false
    const seo = buildPublicProductSeo(menu, { category, product }, 'https://cardapio.exemplo.com.br')
    expect(publicProductPath(product.id, product.name)).toBe(`/produtos/${product.id}/x-salada-especial`)
    expect(seo).toMatchObject({
      title: 'X-Salada Especial | Lanchonete <Especial>',
      canonical: `https://cardapio.exemplo.com.br/produtos/${product.id}/x-salada-especial`,
      openGraphType: 'product',
      robots: 'index,follow',
      image: null,
    })
    const graph = seo.jsonLd['@graph'] as Array<Record<string, unknown>>
    expect(graph).toHaveLength(2)
    expect(graph[0]).toMatchObject({ '@type': 'Restaurant', '@id': 'https://cardapio.exemplo.com.br/#restaurant' })
    expect(graph[1]).toMatchObject({
      '@type': 'Product',
      name: 'X-Salada Especial',
      category: 'Lanches',
      offers: [
        { '@type': 'Offer', priceCurrency: 'BRL', price: '25.90', availability: 'https://schema.org/OutOfStock' },
        { '@type': 'Offer', name: 'Grande', priceCurrency: 'BRL', price: '29.90', availability: 'https://schema.org/OutOfStock' },
      ],
    })
  })

  it('não indexa produto sem preço ativo', () => {
    const menu = publicMenuFixture()
    const category = menu.categories[0]!
    const product = category.products[0]!
    product.variants[0]!.isActive = false
    const seo = buildPublicProductSeo(menu, { category, product }, 'https://cardapio.exemplo.com.br')
    const graph = seo.jsonLd['@graph'] as Array<Record<string, unknown>>
    expect(seo.robots).toBe('noindex,follow')
    expect(graph[1]).not.toHaveProperty('offers')
  })

  it('gera sitemap apenas com URLs canônicas públicas e deixa o sitemap sem cache', () => {
    const menu = publicMenuFixture()
    const category = menu.categories[0]!
    const unavailable = { ...category.products[0]!, id: '123e4567-e89b-12d3-a456-426614174001', name: 'Prato fora de estoque', isAvailable: false }
    category.products.push(unavailable)
    menu.categories.push({
      ...category,
      id: 'category-inactive',
      slug: 'privada',
      isActive: false,
      products: [{ ...unavailable, id: '123e4567-e89b-12d3-a456-426614174002', name: 'Produto privado' }],
    })
    const sitemap = buildPublicSitemap(menu, 'https://cardapio.exemplo.com.br')
    expect(sitemap).toContain('<loc>https://cardapio.exemplo.com.br/</loc>')
    expect(sitemap).toContain('https://cardapio.exemplo.com.br/produtos/123e4567-e89b-12d3-a456-426614174001/prato-fora-de-estoque')
    expect(sitemap).not.toContain('produto-privado')
    expect(sitemap).not.toContain('/admin')
    expect(buildPublicSitemap({ ...menu, categories: [] }, 'https://cardapio.exemplo.com.br')).not.toContain('<loc>')
    expect(buildPublicRobotsTxt('https://cardapio.exemplo.com.br')).toContain('Disallow: /admin/')
    expect(buildPublicRobotsTxt('https://cardapio.exemplo.com.br')).toContain('Sitemap: https://cardapio.exemplo.com.br/sitemap.xml')
  })
})
