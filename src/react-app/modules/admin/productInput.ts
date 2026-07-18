import type { MenuResponse, Product, ProductInput } from '../../../../shared/schemas'

export function productToInput(product: Product, overrides: Partial<Pick<ProductInput, 'categoryId' | 'name' | 'ingredients' | 'isAvailable' | 'isFeatured' | 'sortOrder' | 'variants'>> = {}): ProductInput {
  return {
    categoryId: overrides.categoryId ?? product.categoryId,
    name: overrides.name ?? product.name,
    ingredients: overrides.ingredients === undefined ? product.ingredients : overrides.ingredients,
    isAvailable: overrides.isAvailable ?? product.isAvailable,
    isFeatured: overrides.isFeatured ?? product.isFeatured,
    sortOrder: overrides.sortOrder ?? product.sortOrder,
    variants: overrides.variants ?? product.variants.map((variant) => ({
      label: variant.label,
      priceCents: variant.priceCents,
      promotionalPriceCents: variant.promotionalPriceCents,
      isActive: variant.isActive,
      sortOrder: variant.sortOrder,
    })),
  }
}

export function replaceProduct(menu: MenuResponse | undefined, product: Product): MenuResponse | undefined {
  if (!menu) return menu
  return {
    ...menu,
    categories: menu.categories.map((category) => ({
      ...category,
      products: category.products.map((current) => current.id === product.id ? product : current),
    })),
  }
}
