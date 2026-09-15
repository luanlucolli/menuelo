import type { CustomizationSelection, ResolvedCustomization } from '../customizations'

export interface PersistedCartLine {
  id: string
  productId: string
  variantId: string
  quantity: number
  note: string
  /** Optional at the type boundary so lines created by the v1 storage can be read safely. */
  customizations?: CustomizationSelection[]
}

export interface CartLine extends PersistedCartLine {
  productName: string
  variantLabel: string | null
  unitPriceCents: number
  customizationDetails?: ResolvedCustomization[]
}

export interface CartState {
  lines: CartLine[]
}
