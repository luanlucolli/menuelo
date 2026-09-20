import { describe, expect, it } from 'vitest'
import { getMenu, getProduct } from '../worker/repositories/menu'
import {
  productCustomizationGroupInputSchema,
  productCustomizationOptionInputSchema,
  productInputSchema,
} from '../shared/schemas'
import { buildWhatsappOrder } from '../src/react-app/modules/public-menu/cart/buildWhatsappOrder'
import { cartReducer, emptyCartState } from '../src/react-app/modules/public-menu/cart/cart-reducer'
import { restoreCart, serializeCart } from '../src/react-app/modules/public-menu/cart/cart-storage'
import { calculateCustomizationCost, customizationSignature, normalizeCustomizations, resolveCustomizations, type CustomizationSelection } from '../src/react-app/modules/public-menu/customizations'
import type { CartLine } from '../src/react-app/modules/public-menu/cart/cart-types'
import { FakeDatabase, settingsRow } from './fakes'
import { publicMenuFixture } from './public-fixture'

const groupInput = {
  name: 'Escolha seu hambúrguer',
  minSelections: 2,
  maxSelections: 2,
  isActive: true,
  sortOrder: 0,
  options: [
    { name: 'Cheeseburger', description: null, priceDeltaCents: 0, isActive: true, sortOrder: 0 },
    { name: 'Bacon', description: 'Bacon crocante', priceDeltaCents: 490, isActive: true, sortOrder: 1 },
  ],
}

function productWithCustomizations() {
  const menu = publicMenuFixture()
  menu.categories[0]!.products[0]!.customizationGroups = [{
    id: 'group-1', ...groupInput, options: groupInput.options.map((option, index) => ({ id: `option-${index + 1}`, ...option })),
  }]
  return menu
}

const selection: CustomizationSelection[] = [{ groupId: 'group-1', options: [{ optionId: 'option-2', quantity: 2 }] }]

function line(overrides: Partial<CartLine> = {}): CartLine {
  return {
    id: 'line-1', productId: 'product-1', variantId: 'variant-1', quantity: 1, note: '', productName: 'X-Salada', variantLabel: null, unitPriceCents: 2590, customizations: [], ...overrides,
  }
}

describe('schemas de montagem', () => {
  it('aceita grupo válido e adicional gratuito', () => {
    expect(productCustomizationGroupInputSchema.safeParse(groupInput).success).toBe(true)
    expect(productCustomizationOptionInputSchema.safeParse(groupInput.options[0]).success).toBe(true)
  })

  it('rejeita mínimo maior que máximo, preço negativo e grupo obrigatório sem opção ativa', () => {
    expect(productCustomizationGroupInputSchema.safeParse({ ...groupInput, minSelections: 3, maxSelections: 2 }).success).toBe(false)
    expect(productCustomizationOptionInputSchema.safeParse({ ...groupInput.options[0], priceDeltaCents: -1 }).success).toBe(false)
    expect(productCustomizationGroupInputSchema.safeParse({ ...groupInput, options: groupInput.options.map((option) => ({ ...option, isActive: false })) }).success).toBe(false)
  })

  it('rejeita mínimo vazio, negativo ou acima de 99', () => {
    expect(productCustomizationGroupInputSchema.safeParse({ ...groupInput, minSelections: undefined }).success).toBe(false)
    expect(productCustomizationGroupInputSchema.safeParse({ ...groupInput, minSelections: -1 }).success).toBe(false)
    expect(productCustomizationGroupInputSchema.safeParse({ ...groupInput, minSelections: 100 }).success).toBe(false)
  })

  it('inclui a configuração em um ProductInput', () => {
    expect(productInputSchema.safeParse({ categoryId: 'category-1', name: 'Combo', ingredients: null, isAvailable: true, isFeatured: false, sortOrder: 0, variants: [{ label: null, priceCents: 1000, promotionalPriceCents: null, isActive: true, sortOrder: 0 }], customizationGroups: [groupInput] }).success).toBe(true)
  })
})

describe('regras e preço da montagem', () => {
  it('valida seleção, calcula quantidade e custo em centavos', () => {
    const menu = productWithCustomizations()
    const product = menu.categories[0]!.products[0]!
    expect(normalizeCustomizations(product, selection)).toEqual(selection)
    expect(calculateCustomizationCost(product, selection)).toBe(980)
    expect(resolveCustomizations(product, selection)?.[0]?.options[0]).toMatchObject({ name: 'Bacon', quantity: 2 })
    expect(normalizeCustomizations(product, [])).toBeNull()
  })

  it('cria identidade igual para objetos em ordem diferente', () => {
    const reverse: CustomizationSelection[] = [{ groupId: 'group-1', options: [{ optionId: 'option-2', quantity: 1 }, { optionId: 'option-1', quantity: 1 }] }]
    const forward: CustomizationSelection[] = [{ groupId: 'group-1', options: [{ optionId: 'option-1', quantity: 1 }, { optionId: 'option-2', quantity: 1 }] }]
    expect(customizationSignature(reverse)).toBe(customizationSignature(forward))
  })
})

describe('montagem no carrinho e WhatsApp', () => {
  it('multiplica adicional por quantidade da opção e do produto', () => {
    const menu = productWithCustomizations()
    const product = menu.categories[0]!.products[0]!
    const details = resolveCustomizations(product, selection)!
    const configuredUnitPrice = product.variants[0]!.priceCents + calculateCustomizationCost(product, selection)
    const added = cartReducer(emptyCartState, { type: 'add', line: line({ unitPriceCents: configuredUnitPrice, customizations: selection, customizationDetails: details, quantity: 2 }) })
    expect(added.lines[0]!.unitPriceCents).toBe(3570)
    expect(added.lines[0]!.quantity).toBe(2)
    const merged = cartReducer(added, { type: 'add', line: line({ id: 'other', unitPriceCents: configuredUnitPrice, customizations: [...selection].reverse(), customizationDetails: details, quantity: 1 }) })
    expect(merged.lines).toHaveLength(1)
    expect(merged.lines[0]!.quantity).toBe(3)
    const message = buildWhatsappOrder('Loja', merged.lines)
    expect(message).toContain('2x Bacon (+ R$ 4,90)')
    expect(message).toContain('Valor unitário: R$ 35,70')
    expect(message).toContain('Subtotal: R$ 107,10')
    expect(message).toContain('*Total dos produtos: R$ 107,10*')
  })

  it('omite grupos opcionais vazios da mensagem', () => {
    const message = buildWhatsappOrder('Loja', [line({ customizationDetails: [] })])
    expect(message).not.toContain('Montagem:')
  })

  it('mantém linhas separadas para configurações ou observações diferentes', () => {
    const menu = productWithCustomizations()
    const product = menu.categories[0]!.products[0]!
    const details = resolveCustomizations(product, selection)!
    const first = cartReducer(emptyCartState, { type: 'add', line: line({ customizations: selection, customizationDetails: details, unitPriceCents: 3570 }) })
    const second = cartReducer(first, { type: 'add', line: line({ id: 'other', customizations: [{ groupId: 'group-1', options: [{ optionId: 'option-1', quantity: 2 }] }], note: 'sem cebola', unitPriceCents: 2590 }) })
    expect(second.lines).toHaveLength(2)
  })
})

describe('restauração do carrinho com montagem atual', () => {
  it('serializa v2 e usa o preço atual ao restaurar', () => {
    const menu = productWithCustomizations()
    const product = menu.categories[0]!.products[0]!
    const saved = line({ customizations: selection, unitPriceCents: 1 })
    const serialized = serializeCart([saved])
    expect(JSON.parse(serialized)).toMatchObject({ version: 2, lines: [{ customizations: selection }] })
    product.customizationGroups[0]!.options[1]!.priceDeltaCents = 600
    const restored = restoreCart(serialized, menu)
    expect(restored.didRemoveItems).toBe(false)
    expect(restored.lines[0]!.unitPriceCents).toBe(3790)
  })

  it('aceita v1 sem montagem quando não há grupo obrigatório e remove linhas incompatíveis', () => {
    const menu = publicMenuFixture()
    expect(restoreCart(JSON.stringify({ version: 1, lines: [{ id: 'old', productId: 'product-1', variantId: 'variant-1', quantity: 1, note: '' }] }), menu).lines).toHaveLength(1)
    menu.categories[0]!.products[0]!.customizationGroups = [{ ...productWithCustomizations().categories[0]!.products[0]!.customizationGroups[0]!, minSelections: 1, maxSelections: 1 }]
    const restored = restoreCart(JSON.stringify({ version: 1, lines: [{ id: 'old', productId: 'product-1', variantId: 'variant-1', quantity: 1, note: '' }] }), menu)
    expect(restored.lines).toHaveLength(0)
    expect(restored.didRemoveItems).toBe(true)
  })

  it('remove configuração v2 quando a opção fica inativa ou a regra muda', () => {
    const menu = productWithCustomizations()
    const product = menu.categories[0]!.products[0]!
    const serialized = serializeCart([line({ customizations: selection })])

    product.customizationGroups[0]!.options[1]!.isActive = false
    const inactiveOption = restoreCart(serialized, menu)
    expect(inactiveOption.lines).toHaveLength(0)
    expect(inactiveOption.didRemoveItems).toBe(true)

    product.customizationGroups[0]!.options[1]!.isActive = true
    product.customizationGroups[0]!.maxSelections = 1
    const invalidRule = restoreCart(serialized, menu)
    expect(invalidRule.lines).toHaveLength(0)
    expect(invalidRule.didRemoveItems).toBe(true)
  })
})

describe('leitura de montagem no menu', () => {
  it('getMenu e getProduct agrupam grupos e opções sem N+1', async () => {
    const database = new FakeDatabase({
      settings: { ...settingsRow, theme: 'rustic' },
      categories: [{ id: 'category-1', name: 'Lanches', slug: 'lanches', description: null, is_active: 1, sort_order: 0, created_at: 'now', updated_at: 'now' }],
      products: [{ id: 'product-1', category_id: 'category-1', name: 'Combo', ingredients: null, image_key: null, is_available: 1, is_featured: 0, sort_order: 0, created_at: 'now', updated_at: 'now' }],
      variants: [{ id: 'variant-1', product_id: 'product-1', label: null, price_cents: 1000, promotional_price_cents: null, is_active: 1, sort_order: 0 }],
      customizationGroups: [{ id: 'group-1', product_id: 'product-1', name: 'Adicionais', min_selections: 0, max_selections: 2, is_active: 1, sort_order: 0 }],
      customizationOptions: [{ id: 'option-1', group_id: 'group-1', name: 'Bacon', description: null, price_delta_cents: 490, is_active: 1, sort_order: 0 }],
    })
    const menu = await getMenu(database.asBinding())
    expect(menu.business.theme).toBe('rustic')
    const product = menu.categories[0]!.products[0]!
    expect(product.customizationGroups[0]!.options[0]!.priceDeltaCents).toBe(490)
    expect((await getProduct(database.asBinding(), 'product-1'))?.customizationGroups).toHaveLength(1)
  })
})
