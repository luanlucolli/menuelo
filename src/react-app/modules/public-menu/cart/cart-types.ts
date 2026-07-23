export interface PersistedCartLine {
  id: string
  productId: string
  variantId: string
  quantity: number
  note: string
}

export interface CartLine extends PersistedCartLine {
  productName: string
  variantLabel: string | null
  unitPriceCents: number
}

export interface CartState {
  lines: CartLine[]
}
