import type { CartLine, CartState } from './cart-types'
import { clampCartQuantity, normalizeCartNote } from './cart-utils'

export const emptyCartState: CartState = { lines: [] }

export type CartAction =
  | { type: 'add'; line: CartLine }
  | { type: 'change_quantity'; lineId: string; delta: -1 | 1 }
  | { type: 'set_quantity'; lineId: string; quantity: number }
  | { type: 'update_note'; lineId: string; note: string }
  | { type: 'remove'; lineId: string }
  | { type: 'replace'; lines: CartLine[] }
  | { type: 'clear' }

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      const incoming = {
        ...action.line,
        quantity: clampCartQuantity(action.line.quantity),
        note: normalizeCartNote(action.line.note),
      }
      const existingIndex = state.lines.findIndex((line) =>
        line.productId === incoming.productId &&
        line.variantId === incoming.variantId &&
        line.note === incoming.note)

      if (existingIndex < 0) return { lines: [...state.lines, incoming] }

      return {
        lines: state.lines.map((line, index) => index === existingIndex
          ? { ...line, quantity: clampCartQuantity(line.quantity + incoming.quantity) }
          : line),
      }
    }
    case 'change_quantity':
      return {
        lines: state.lines.map((line) => line.id === action.lineId
          ? { ...line, quantity: clampCartQuantity(line.quantity + action.delta) }
          : line),
      }
    case 'set_quantity':
      return {
        lines: state.lines.map((line) => line.id === action.lineId
          ? { ...line, quantity: clampCartQuantity(action.quantity) }
          : line),
      }
    case 'update_note':
      return {
        lines: state.lines.map((line) => line.id === action.lineId
          ? { ...line, note: normalizeCartNote(action.note) }
          : line),
      }
    case 'remove':
      return { lines: state.lines.filter((line) => line.id !== action.lineId) }
    case 'replace':
      return { lines: action.lines }
    case 'clear':
      return emptyCartState
  }
}
