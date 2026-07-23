import { useCallback, useEffect, useMemo, useReducer } from 'react'
import type { MenuResponse, Product, ProductVariant } from '../../../../../shared/schemas'
import { cartReducer, emptyCartState, type CartAction } from './cart-reducer'
import { getCartStorageKey, readCart, writeCart } from './cart-storage'
import type { CartState } from './cart-types'
import {
  calculateCartItemCount,
  calculateCartTotal,
  getVariantPriceCents,
  normalizeCartNote,
} from './cart-utils'

interface CartSessionState {
  cart: CartState
  contextKey: string | null
  restorationNotice: string | null
}

type CartSessionAction =
  | { type: 'hydrate'; contextKey: string; cart: CartState; didRemoveItems: boolean }
  | { type: 'cart'; action: CartAction }
  | { type: 'dismiss_notice' }

function cartSessionReducer(state: CartSessionState, action: CartSessionAction): CartSessionState {
  if (action.type === 'hydrate') {
    return {
      cart: action.cart,
      contextKey: action.contextKey,
      restorationNotice: action.didRemoveItems
        ? 'Alguns itens foram removidos porque não estão mais disponíveis.'
        : null,
    }
  }
  if (action.type === 'dismiss_notice') return { ...state, restorationNotice: null }
  return { ...state, cart: cartReducer(state.cart, action.action) }
}

function menuCartContextKey(menu: MenuResponse): string {
  const products = menu.categories.flatMap((category) => category.products)
    .map((product) => [
      product.id,
      product.name,
      product.updatedAt,
      product.isAvailable,
      product.variants.map((variant) => [
        variant.id,
        variant.label,
        variant.priceCents,
        variant.promotionalPriceCents,
        variant.isActive,
      ]),
    ])
  return JSON.stringify([menu.business.slug, products])
}

function createCartLineId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `cart-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function useCart(menu: MenuResponse) {
  const contextKey = useMemo(() => menuCartContextKey(menu), [menu])
  const storageKey = getCartStorageKey(menu.business.slug)
  const [session, dispatch] = useReducer(cartSessionReducer, {
    cart: emptyCartState,
    contextKey: null,
    restorationNotice: null,
  })

  useEffect(() => {
    const restored = readCart(window.localStorage, storageKey, menu)
    dispatch({
      type: 'hydrate',
      contextKey,
      cart: { lines: restored.lines },
      didRemoveItems: restored.didRemoveItems,
    })
  }, [contextKey, menu, storageKey])

  useEffect(() => {
    if (session.contextKey !== contextKey) return
    writeCart(window.localStorage, storageKey, session.cart.lines)
  }, [contextKey, session, storageKey])

  const send = useCallback((action: CartAction) => dispatch({ type: 'cart', action }), [])

  const addItem = useCallback((
    product: Product,
    variant: ProductVariant,
    quantity: number,
    note: string,
  ) => {
    send({
      type: 'add',
      line: {
        id: createCartLineId(),
        productId: product.id,
        variantId: variant.id,
        quantity,
        note: normalizeCartNote(note),
        productName: product.name,
        variantLabel: variant.label?.trim() || null,
        unitPriceCents: getVariantPriceCents(variant),
      },
    })
  }, [send])

  return {
    lines: session.cart.lines,
    itemCount: calculateCartItemCount(session.cart.lines),
    totalCents: calculateCartTotal(session.cart.lines),
    restorationNotice: session.restorationNotice,
    dismissRestorationNotice: () => dispatch({ type: 'dismiss_notice' }),
    addItem,
    increase: (lineId: string) => send({ type: 'change_quantity', lineId, delta: 1 }),
    decrease: (lineId: string) => send({ type: 'change_quantity', lineId, delta: -1 }),
    remove: (lineId: string) => send({ type: 'remove', lineId }),
    updateNote: (lineId: string, note: string) => send({ type: 'update_note', lineId, note }),
    clear: () => send({ type: 'clear' }),
  }
}
