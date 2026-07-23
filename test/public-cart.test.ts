import { describe, expect, it } from 'vitest'
import { cartReducer, emptyCartState } from '../src/react-app/modules/public-menu/cart/cart-reducer'
import { buildWhatsappOrder, buildWhatsappOrderUrl } from '../src/react-app/modules/public-menu/cart/buildWhatsappOrder'
import { restoreCart, serializeCart } from '../src/react-app/modules/public-menu/cart/cart-storage'
import type { CartLine } from '../src/react-app/modules/public-menu/cart/cart-types'
import { calculateCartTotal, calculateLineSubtotal } from '../src/react-app/modules/public-menu/cart/cart-utils'
import { publicMenuFixture } from './public-fixture'

function line(overrides: Partial<CartLine> = {}): CartLine {
  return {
    id: 'line-1',
    productId: 'product-1',
    variantId: 'variant-1',
    quantity: 1,
    note: '',
    productName: 'X-Bacon',
    variantLabel: 'Grande',
    unitPriceCents: 2990,
    ...overrides,
  }
}

describe('reducer do carrinho público', () => {
  it('adiciona um item novo', () => {
    const state = cartReducer(emptyCartState, { type: 'add', line: line() })
    expect(state.lines).toEqual([line()])
  })

  it('soma a quantidade ao adicionar produto, variação e observação iguais', () => {
    const first = cartReducer(emptyCartState, {
      type: 'add',
      line: line({ quantity: 1, note: ' sem cebola ' }),
    })
    const second = cartReducer(first, {
      type: 'add',
      line: line({ id: 'line-2', quantity: 2, note: 'sem cebola' }),
    })
    expect(second.lines).toHaveLength(1)
    expect(second.lines[0]).toMatchObject({ id: 'line-1', quantity: 3, note: 'sem cebola' })
  })

  it('mantém linhas separadas quando a observação é diferente', () => {
    const first = cartReducer(emptyCartState, { type: 'add', line: line({ note: '' }) })
    const second = cartReducer(first, {
      type: 'add',
      line: line({ id: 'line-2', note: 'sem cebola' }),
    })
    expect(second.lines.map((item) => item.note)).toEqual(['', 'sem cebola'])
  })

  it('aumenta e diminui a quantidade sem passar abaixo de um', () => {
    const added = cartReducer(emptyCartState, { type: 'add', line: line() })
    const increased = cartReducer(added, { type: 'change_quantity', lineId: 'line-1', delta: 1 })
    const decreased = cartReducer(increased, { type: 'change_quantity', lineId: 'line-1', delta: -1 })
    const atMinimum = cartReducer(decreased, { type: 'change_quantity', lineId: 'line-1', delta: -1 })
    expect(increased.lines[0].quantity).toBe(2)
    expect(atMinimum.lines[0].quantity).toBe(1)
  })

  it('remove uma linha', () => {
    const added = cartReducer(emptyCartState, { type: 'add', line: line() })
    expect(cartReducer(added, { type: 'remove', lineId: 'line-1' }).lines).toEqual([])
  })
})

describe('valores do carrinho', () => {
  it('calcula subtotal e total usando somente centavos', () => {
    const first = line({ quantity: 2, unitPriceCents: 2990 })
    const second = line({ id: 'line-2', quantity: 1, unitPriceCents: 590 })
    expect(calculateLineSubtotal(first)).toBe(5980)
    expect(calculateCartTotal([first, second])).toBe(6570)
  })

  it('restaura o preço promocional atual da variação', () => {
    const menu = publicMenuFixture()
    menu.categories[0].products[0].variants[0].promotionalPriceCents = 1990
    const restored = restoreCart(JSON.stringify({
      version: 1,
      lines: [{ id: 'saved', productId: 'product-1', variantId: 'variant-1', quantity: 1, note: '' }],
    }), menu)
    expect(restored.lines[0].unitPriceCents).toBe(1990)
  })
})

describe('mensagem do pedido para WhatsApp', () => {
  it('gera uma mensagem numerada com opção, observação, subtotais e total', () => {
    const message = buildWhatsappOrder('Lanchonete da Praça', [
      line({ quantity: 2, note: 'sem cebola' }),
      line({
        id: 'line-2',
        productName: 'Refrigerante 350 ml',
        variantLabel: null,
        quantity: 1,
        note: '',
        unitPriceCents: 590,
      }),
    ])
    expect(message).toContain('Olá! Quero fazer este pedido na *Lanchonete da Praça*:')
    expect(message).toContain('*1. 2x X-Bacon*')
    expect(message).toContain('Opção: Grande')
    expect(message).toContain('Observação: sem cebola')
    expect(message).toContain('Subtotal: R$\u00a059,80')
    expect(message).toContain('*Total dos produtos: R$\u00a065,70*')
    expect(message).toContain('\n\n*2. 1x Refrigerante 350 ml*')
  })

  it('omite observação vazia e nome de variação vazio', () => {
    const message = buildWhatsappOrder('Loja', [line({ variantLabel: '  ', note: '   ' })])
    expect(message).not.toContain('Observação:')
    expect(message).not.toContain('Opção:')
  })

  it('monta a URL somente com um WhatsApp válido e codifica a mensagem completa', () => {
    const message = 'Olá! Pedido com pão & queijo.'
    expect(buildWhatsappOrderUrl('(47) 99999-9999', message))
      .toBe(`https://wa.me/47999999999?text=${encodeURIComponent(message)}`)
    expect(buildWhatsappOrderUrl('123', message)).toBeNull()
  })
})

describe('restauração do carrinho', () => {
  it('restaura um carrinho válido com dados atuais do menu', () => {
    const menu = publicMenuFixture()
    const saved = line({ productName: 'nome antigo', unitPriceCents: 1 })
    const restored = restoreCart(serializeCart([saved]), menu)
    expect(restored).toMatchObject({ didRemoveItems: false, invalid: false })
    expect(restored.lines[0]).toMatchObject({
      id: 'line-1',
      productName: 'X-Salada',
      variantLabel: null,
      unitPriceCents: 2590,
    })
  })

  it('limita novamente quantidade e observação ao restaurar', () => {
    const restored = restoreCart(JSON.stringify({
      version: 1,
      lines: [{
        id: 'saved',
        productId: 'product-1',
        variantId: 'variant-1',
        quantity: 120,
        note: `  ${'a'.repeat(250)}  `,
      }],
    }), publicMenuFixture())
    expect(restored.lines[0].quantity).toBe(99)
    expect(restored.lines[0].note).toHaveLength(200)
  })

  it('ignora conteúdo inválido do localStorage', () => {
    expect(restoreCart('{conteúdo inválido', publicMenuFixture()))
      .toEqual({ lines: [], didRemoveItems: false, invalid: true })
    expect(restoreCart(JSON.stringify({ version: 1, lines: [{ quantity: '2' }] }), publicMenuFixture()).lines)
      .toEqual([])
  })

  it('remove produto ou variação inexistente durante a reconciliação', () => {
    const restored = restoreCart(JSON.stringify({
      version: 1,
      lines: [
        { id: 'valid', productId: 'product-1', variantId: 'variant-1', quantity: 1, note: '' },
        { id: 'missing-product', productId: 'missing', variantId: 'variant-1', quantity: 1, note: '' },
        { id: 'missing-variant', productId: 'product-1', variantId: 'missing', quantity: 1, note: '' },
      ],
    }), publicMenuFixture())
    expect(restored.lines.map((item) => item.id)).toEqual(['valid'])
    expect(restored.didRemoveItems).toBe(true)
  })
})
