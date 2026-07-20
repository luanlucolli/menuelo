import { describe, expect, it } from 'vitest'
import type { MenuResponse, Product } from '../shared/schemas'
import { centsFromMoneyInput } from '../src/react-app/modules/admin/money'
import { productToInput, replaceProduct } from '../src/react-app/modules/admin/productInput'

const product: Product = {
  id: 'product-1',
  categoryId: 'category-1',
  name: 'Lanche da casa',
  ingredients: null,
  imageKey: null,
  isAvailable: true,
  isFeatured: false,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  variants: [{ id: 'variant-1', label: null, priceCents: 1800, promotionalPriceCents: null, isActive: true, sortOrder: 0 }],
}

describe('entrada monetária administrativa', () => {
  it('converte texto brasileiro formatado em centavos', () => {
    expect(centsFromMoneyInput('R$ 18,00')).toBe(1800)
    expect(centsFromMoneyInput('2.500,99')).toBe(250099)
    expect(centsFromMoneyInput('')).toBeNull()
  })
})

describe('atualizações rápidas de produto', () => {
  it('preserva campos não relacionados ao alterar disponibilidade', () => {
    expect(productToInput(product, { isAvailable: false })).toEqual({
      categoryId: 'category-1',
      name: 'Lanche da casa',
      ingredients: null,
      isAvailable: false,
      isFeatured: false,
      sortOrder: 0,
      variants: [{ label: null, priceCents: 1800, promotionalPriceCents: null, isActive: true, sortOrder: 0 }],
    })
  })

  it('substitui somente o produto salvo no cache do menu', () => {
    const menu = { categories: [{ id: 'category-1', products: [product] }] } as unknown as MenuResponse
    const updated = { ...product, isAvailable: false }
    expect(replaceProduct(menu, updated)?.categories[0].products[0]).toEqual(updated)
  })
})
