import { describe, expect, it } from 'vitest'
import { menuImportSchema, productInputSchema, variantInputSchema, type BusinessHour } from '../shared/schemas'
import { buildGoogleMapsDirectionsUrl, calculateOpenStatus, formatBrazilianPhone, formatMoney, formatStructuredAddress, normalizeSearch, normalizeWhatsappNumber, readableBrandText } from '../shared/utils'

const fullWeek: BusinessHour[] = Array.from({ length: 7 }, (_, weekday) => ({
  id: `day-${weekday}`,
  weekday,
  opensAt: weekday === 1 ? null : '18:00',
  closesAt: weekday === 1 ? null : '02:00',
  isClosed: weekday === 1,
  sortOrder: 0,
}))

describe('utilitários compartilhados', () => {
  it('formata centavos em reais no padrão brasileiro', () => {
    expect(formatMoney(2590)).toContain('25,90')
    expect(formatMoney(2590)).toContain('R$')
  })

  it('formata telefone brasileiro com ou sem código do país', () => {
    expect(formatBrazilianPhone('47984802779')).toBe('(47) 98480-2779')
    expect(formatBrazilianPhone('5547984802779')).toBe('+55 (47) 98480-2779')
    expect(formatBrazilianPhone('4733334444')).toBe('(47) 3333-4444')
  })

  it('normaliza e valida o número do WhatsApp em um único utilitário', () => {
    expect(normalizeWhatsappNumber('+55 (47) 98480-2779')).toBe('5547984802779')
    expect(normalizeWhatsappNumber('123')).toBeNull()
    expect(normalizeWhatsappNumber(null)).toBeNull()
  })

  it('normaliza caixa e acentos na pesquisa', () => {
    expect(normalizeSearch('  CORAÇÃO com Pão  ')).toBe('coracao com pao')
  })

  it('escolhe texto legível para cores claras e escuras da marca', () => {
    expect(readableBrandText('#FFF200')).toBe('#211F1B')
    expect(readableBrandText('#374151')).toBe('#FFFFFF')
    expect(readableBrandText('inválida')).toBe('#FFFFFF')
  })

  it('formata endereço brasileiro e cria uma rota oficial do Google Maps', () => {
    const address = formatStructuredAddress({
      addressPostalCode: '01001-000',
      addressStreet: 'Praça da Sé',
      addressNumber: '100',
      addressComplement: null,
      addressNeighborhood: 'Sé',
      addressCity: 'São Paulo',
      addressState: 'SP',
    })
    expect(address).toBe('Praça da Sé, 100 · Sé, São Paulo - SP · CEP 01001-000')
    const mapsUrl = new URL(buildGoogleMapsDirectionsUrl(address)!)
    expect(mapsUrl.origin + mapsUrl.pathname).toBe('https://www.google.com/maps/dir/')
    expect(mapsUrl.searchParams.get('destination')).toBe(address)
  })

  it('não calcula status quando a grade está incompleta', () => {
    expect(calculateOpenStatus(fullWeek.slice(0, 1), 0, 20 * 60)).toBeNull()
  })

  it('calcula abertura antes e depois da meia-noite', () => {
    expect(calculateOpenStatus(fullWeek, 0, 23 * 60)?.isOpen).toBe(true)
    expect(calculateOpenStatus(fullWeek, 1, 60)?.isOpen).toBe(true)
    expect(calculateOpenStatus(fullWeek, 1, 3 * 60)?.isOpen).toBe(false)
  })
})

describe('schemas', () => {
  it('rejeita promoção maior ou igual ao preço original', () => {
    const result = variantInputSchema.safeParse({ label: null, priceCents: 2000, promotionalPriceCents: 2000, isActive: true, sortOrder: 0 })
    expect(result.success).toBe(false)
  })

  it('valida um produto completo e exige ao menos uma variação', () => {
    expect(productInputSchema.safeParse({ categoryId: 'cat', name: 'Produto', ingredients: null, isAvailable: true, isFeatured: false, sortOrder: 0, variants: [] }).success).toBe(false)
    expect(productInputSchema.safeParse({ categoryId: 'cat', name: 'Produto', ingredients: null, isAvailable: true, isFeatured: false, sortOrder: 0, variants: [{ label: null, priceCents: 1000, promotionalPriceCents: null, isActive: true, sortOrder: 0 }] }).success).toBe(true)
  })

  it('rejeita importação com versão desconhecida', () => {
    expect(menuImportSchema.safeParse({ schemaVersion: 2 }).success).toBe(false)
  })
})
