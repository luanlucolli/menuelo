import { describe, expect, it } from 'vitest'
import { buildPublicSeo, safePublicHttpUrl } from '../shared/public-seo'
import { publicMenuFixture } from './public-fixture'

describe('SEO público', () => {
  it('gera metadados e JSON-LD completos a partir do cardápio', () => {
    const seo = buildPublicSeo(publicMenuFixture(), 'https://cardapio.exemplo.com.br')
    expect(seo).toMatchObject({
      title: 'Lanchonete <Especial> | Cardápio digital',
      canonical: 'https://cardapio.exemplo.com.br/',
      themeColor: '#FB5D01',
      image: 'https://cardapio.exemplo.com.br/media/covers/123e4567-e89b-12d3-a456-426614174000.webp',
      favicon: 'https://cardapio.exemplo.com.br/media/favicons/123e4567-e89b-12d3-a456-426614174000.ico',
    })
    expect(seo.jsonLd).toMatchObject({
      '@type': 'Restaurant',
      name: 'Lanchonete <Especial>',
      telephone: '5547999999999',
      address: { addressLocality: 'São José', addressRegion: 'SC' },
    })
    expect(seo.jsonLd.openingHoursSpecification).toHaveLength(7)
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
})
