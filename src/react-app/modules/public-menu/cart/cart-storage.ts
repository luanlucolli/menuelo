import { z } from 'zod'
import type { MenuResponse } from '../../../../../shared/schemas'
import { cartReducer, emptyCartState } from './cart-reducer'
import type { CartLine, PersistedCartLine } from './cart-types'
import { canonicalizeCustomizations, normalizeCustomizations, resolveCustomizations, type CustomizationSelection } from '../customizations'
import {
  clampCartQuantity,
  getVariantPriceCents,
  normalizeCartNote,
} from './cart-utils'

const persistedCustomizationSchema = z.object({
  groupId: z.string().trim().min(1).max(100),
  options: z.array(z.object({
    optionId: z.string().trim().min(1).max(100),
    quantity: z.number().int().min(1).max(99),
  }).strict()).max(50),
}).strict()

const persistedLineSchema = z.object({
  id: z.string().trim().min(1).max(160),
  productId: z.string().trim().min(1).max(100),
  variantId: z.string().trim().min(1).max(100),
  quantity: z.number().int(),
  note: z.string().max(10_000),
}).strict()

const persistedCartSchemaV1 = z.object({
  version: z.literal(1),
  lines: z.array(persistedLineSchema).max(500),
}).strict()

const persistedCartSchemaV2 = z.object({
  version: z.literal(2),
  lines: z.array(z.object({
    ...persistedLineSchema.shape,
    customizations: z.array(persistedCustomizationSchema).max(20),
  }).strict()).max(500),
}).strict()

const persistedCartSchema = z.union([persistedCartSchemaV1, persistedCartSchemaV2])

export interface RestoredCart {
  lines: CartLine[]
  didRemoveItems: boolean
  invalid: boolean
}

export interface CartStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function getCartStorageKey(businessSlug: string): string {
  return `menuelo:cart:${businessSlug}:v1`
}

export function serializeCart(lines: CartLine[]): string {
  const persistedLines: PersistedCartLine[] = lines.map((line) => ({
    id: line.id,
    productId: line.productId,
    variantId: line.variantId,
    quantity: clampCartQuantity(line.quantity),
    note: normalizeCartNote(line.note),
    customizations: canonicalizeCustomizations(line.customizations),
  }))
  return JSON.stringify({ version: 2, lines: persistedLines })
}

export function restoreCart(serialized: string | null, menu: MenuResponse): RestoredCart {
  if (!serialized) return { lines: [], didRemoveItems: false, invalid: false }

  let value: unknown
  try {
    value = JSON.parse(serialized)
  } catch {
    return { lines: [], didRemoveItems: false, invalid: true }
  }

  const parsed = persistedCartSchema.safeParse(value)
  if (!parsed.success) return { lines: [], didRemoveItems: false, invalid: true }

  const products = new Map(menu.categories.flatMap((category) => category.products)
    .map((product) => [product.id, product]))
  const seenIds = new Set<string>()
  let state = emptyCartState
  let didRemoveItems = false

  for (const persisted of parsed.data.lines) {
    const customizations: CustomizationSelection[] = parsed.data.version === 2 && 'customizations' in persisted ? persisted.customizations : []
    const product = products.get(persisted.productId)
    const variant = product?.variants.find((candidate) =>
      candidate.id === persisted.variantId && candidate.isActive)

    if (!product?.isAvailable || !variant || seenIds.has(persisted.id)) {
      didRemoveItems = true
      continue
    }

    const normalizedCustomizations = normalizeCustomizations(product, customizations)
    if (!normalizedCustomizations) {
      didRemoveItems = true
      continue
    }
    const customizationDetails = resolveCustomizations(product, normalizedCustomizations)
    if (!customizationDetails) {
      didRemoveItems = true
      continue
    }

    seenIds.add(persisted.id)
    const beforeLength = state.lines.length
    state = cartReducer(state, {
      type: 'add',
      line: {
        id: persisted.id,
        productId: product.id,
        variantId: variant.id,
        quantity: clampCartQuantity(persisted.quantity),
        note: normalizeCartNote(persisted.note),
        productName: product.name,
        variantLabel: variant.label?.trim() || null,
        unitPriceCents: getVariantPriceCents(variant) + customizationDetails.reduce((total, group) => total + group.options.reduce((groupTotal, option) => groupTotal + option.priceDeltaCents * option.quantity, 0), 0),
        customizations: normalizedCustomizations,
        customizationDetails,
      },
    })
    if (state.lines.length === beforeLength && !state.lines.some((line) => line.id === persisted.id)) didRemoveItems = true
  }

  return { lines: state.lines, didRemoveItems, invalid: false }
}

export function readCart(storage: CartStorage, key: string, menu: MenuResponse): RestoredCart {
  try {
    return restoreCart(storage.getItem(key), menu)
  } catch {
    return { lines: [], didRemoveItems: false, invalid: true }
  }
}

export function writeCart(storage: CartStorage, key: string, lines: CartLine[]): void {
  try {
    if (!lines.length) {
      storage.removeItem(key)
      return
    }
    storage.setItem(key, serializeCart(lines))
  } catch {
    // O carrinho continua funcional em memória quando o navegador bloqueia o armazenamento.
  }
}
