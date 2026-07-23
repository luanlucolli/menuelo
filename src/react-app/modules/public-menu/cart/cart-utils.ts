import type { Product, ProductVariant } from '../../../../../shared/schemas'
import type { CartLine } from './cart-types'

export const CART_NOTE_MAX_LENGTH = 200
export const CART_QUANTITY_MAX = 99

export function normalizeCartNote(note: string): string {
  return note.trim().slice(0, CART_NOTE_MAX_LENGTH)
}

export function clampCartQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1
  return Math.min(CART_QUANTITY_MAX, Math.max(1, Math.trunc(quantity)))
}

export function getActiveVariants(product: Product): ProductVariant[] {
  return [...product.variants]
    .filter((variant) => variant.isActive)
    .sort((first, second) => first.sortOrder - second.sortOrder)
}

export function getVariantPriceCents(variant: ProductVariant): number {
  return variant.promotionalPriceCents ?? variant.priceCents
}

export function calculateLineSubtotal(line: CartLine): number {
  return line.unitPriceCents * line.quantity
}

export function calculateCartTotal(lines: CartLine[]): number {
  return lines.reduce((total, line) => total + calculateLineSubtotal(line), 0)
}

export function calculateCartItemCount(lines: CartLine[]): number {
  return lines.reduce((total, line) => total + line.quantity, 0)
}
