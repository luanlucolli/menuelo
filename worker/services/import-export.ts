import type { MenuImport } from '../../shared/schemas'
import { formatStructuredAddress, slugify } from '../../shared/utils'
import { getMenu } from '../repositories/menu'

function withoutMetadata(menu: Awaited<ReturnType<typeof getMenu>>): MenuImport {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    business: {
      name: menu.business.name,
      slug: menu.business.slug,
      slogan: menu.business.slogan,
      description: menu.business.description,
      whatsapp: menu.business.whatsapp,
      phone: menu.business.phone,
      instagramUrl: menu.business.instagramUrl,
      facebookUrl: menu.business.facebookUrl,
      address: menu.business.address,
      addressPostalCode: menu.business.addressPostalCode,
      addressStreet: menu.business.addressStreet,
      addressNumber: menu.business.addressNumber,
      addressComplement: menu.business.addressComplement,
      addressNeighborhood: menu.business.addressNeighborhood,
      addressCity: menu.business.addressCity,
      addressState: menu.business.addressState,
      mapsUrl: menu.business.mapsUrl,
      timezone: menu.business.timezone,
      specialMessage: menu.business.specialMessage,
      primaryColor: menu.business.primaryColor,
      publicSiteUrl: menu.business.publicSiteUrl,
      seoTitle: menu.business.seoTitle,
      seoDescription: menu.business.seoDescription,
      coverImageKey: menu.business.coverImageKey,
      faviconKey: menu.business.faviconKey,
    },
    hours: menu.hours.map((hour) => ({ weekday: hour.weekday, opensAt: hour.opensAt, closesAt: hour.closesAt, isClosed: hour.isClosed, sortOrder: hour.sortOrder })),
    paymentMethods: menu.paymentMethods.map((method) => ({ name: method.name, isActive: method.isActive, sortOrder: method.sortOrder })),
    deliveryZones: menu.deliveryZones.map((zone) => ({ name: zone.name, feeCents: zone.feeCents, notes: zone.notes, isActive: zone.isActive, sortOrder: zone.sortOrder })),
    categories: menu.categories.map((category) => ({
      name: category.name,
      description: category.description,
      isActive: category.isActive,
      sortOrder: category.sortOrder,
      products: category.products.map((product) => ({
        name: product.name,
        ingredients: product.ingredients,
        imageKey: product.imageKey,
        isAvailable: product.isAvailable,
        isFeatured: product.isFeatured,
        sortOrder: product.sortOrder,
        variants: product.variants.map((variant) => ({
          label: variant.label,
          priceCents: variant.priceCents,
          promotionalPriceCents: variant.promotionalPriceCents,
          isActive: variant.isActive,
          sortOrder: variant.sortOrder,
        })),
      })),
    })),
  }
}

export async function serializeExport(db: D1Database): Promise<MenuImport> {
  return withoutMetadata(await getMenu(db, true))
}

function collectImageKeys(data: MenuImport): string[] {
  const keys = new Set<string>()
  if (data.business.coverImageKey) keys.add(data.business.coverImageKey)
  if (data.business.faviconKey) keys.add(data.business.faviconKey)
  for (const category of data.categories) {
    for (const product of category.products) if (product.imageKey) keys.add(product.imageKey)
  }
  return [...keys]
}

export async function findMissingImages(bucket: R2Bucket, data: MenuImport): Promise<string[]> {
  const missing: string[] = []
  const keys = collectImageKeys(data)
  for (let offset = 0; offset < keys.length; offset += 20) {
    const chunk = keys.slice(offset, offset + 20)
    const results = await Promise.all(chunk.map(async (key) => ({ key, exists: Boolean(await bucket.head(key)) })))
    for (const result of results) if (!result.exists) missing.push(result.key)
  }
  return missing
}

export interface ImportSummary {
  incoming: { categories: number; products: number; variants: number; hours: number; paymentMethods: number; deliveryZones: number }
  current: { categories: number; products: number; variants: number; hours: number; paymentMethods: number; deliveryZones: number }
  missingImageKeys: string[]
}

function counts(menu: Awaited<ReturnType<typeof getMenu>> | MenuImport) {
  const categories = menu.categories.length
  const products = menu.categories.reduce((sum, category) => sum + category.products.length, 0)
  const variants = menu.categories.reduce((sum, category) => sum + category.products.reduce((inner, product) => inner + product.variants.length, 0), 0)
  return {
    categories,
    products,
    variants,
    hours: menu.hours.length,
    paymentMethods: menu.paymentMethods.length,
    deliveryZones: menu.deliveryZones.length,
  }
}

export async function summarizeImport(db: D1Database, bucket: R2Bucket, data: MenuImport): Promise<ImportSummary> {
  const [current, missingImageKeys] = await Promise.all([getMenu(db, true), findMissingImages(bucket, data)])
  return { incoming: counts(data), current: counts(current), missingImageKeys }
}

export async function applyImport(db: D1Database, bucket: R2Bucket, data: MenuImport): Promise<ImportSummary> {
  const summary = await summarizeImport(db, bucket, data)
  const missing = new Set(summary.missingImageKeys)
  const statements: D1PreparedStatement[] = [
    db.prepare(`UPDATE business_settings SET name=?, slug=?, slogan=?, description=?, whatsapp=?, phone=?, instagram_url=?, facebook_url=?, address=?, address_postal_code=?, address_street=?, address_number=?, address_complement=?, address_neighborhood=?, address_city=?, address_state=?, maps_url=?, timezone=?, special_message=?, primary_color=?, cover_image_key=?, favicon_key=?, public_site_url=?, seo_title=?, seo_description=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id=1`).bind(
      data.business.name,
      data.business.slug,
      data.business.slogan,
      data.business.description,
      data.business.whatsapp,
      data.business.phone,
      data.business.instagramUrl,
      data.business.facebookUrl,
      formatStructuredAddress(data.business) ?? data.business.address,
      data.business.addressPostalCode,
      data.business.addressStreet,
      data.business.addressNumber,
      data.business.addressComplement,
      data.business.addressNeighborhood,
      data.business.addressCity,
      data.business.addressState,
      data.business.mapsUrl,
      data.business.timezone,
      data.business.specialMessage,
      data.business.primaryColor,
      data.business.coverImageKey && !missing.has(data.business.coverImageKey) ? data.business.coverImageKey : null,
      data.business.faviconKey && !missing.has(data.business.faviconKey) ? data.business.faviconKey : null,
      data.business.publicSiteUrl,
      data.business.seoTitle,
      data.business.seoDescription,
    ),
    db.prepare('DELETE FROM business_hours'),
    db.prepare('DELETE FROM payment_methods'),
    db.prepare('DELETE FROM delivery_zones'),
    db.prepare('DELETE FROM products'),
    db.prepare('DELETE FROM categories'),
  ]

  for (const hour of data.hours) {
    statements.push(db.prepare('INSERT INTO business_hours (id, weekday, opens_at, closes_at, is_closed, sort_order) VALUES (?, ?, ?, ?, ?, ?)').bind(
      crypto.randomUUID(), hour.weekday, hour.opensAt, hour.closesAt, hour.isClosed ? 1 : 0, hour.sortOrder,
    ))
  }
  for (const method of data.paymentMethods) {
    statements.push(db.prepare('INSERT INTO payment_methods (id, name, is_active, sort_order) VALUES (?, ?, ?, ?)').bind(
      crypto.randomUUID(), method.name, method.isActive ? 1 : 0, method.sortOrder,
    ))
  }
  for (const zone of data.deliveryZones) {
    statements.push(db.prepare('INSERT INTO delivery_zones (id, name, fee_cents, notes, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?)').bind(
      crypto.randomUUID(), zone.name, zone.feeCents, zone.notes, zone.isActive ? 1 : 0, zone.sortOrder,
    ))
  }

  const slugs = new Set<string>()
  for (const category of data.categories) {
    const categoryId = crypto.randomUUID()
    const base = slugify(category.name)
    let slug = base
    let suffix = 2
    while (slugs.has(slug)) slug = `${base}-${suffix++}`
    slugs.add(slug)
    statements.push(db.prepare('INSERT INTO categories (id, name, slug, description, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?)').bind(
      categoryId, category.name, slug, category.description, category.isActive ? 1 : 0, category.sortOrder,
    ))

    for (const product of category.products) {
      const productId = crypto.randomUUID()
      statements.push(db.prepare('INSERT INTO products (id, category_id, name, ingredients, image_key, is_available, is_featured, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(
        productId,
        categoryId,
        product.name,
        product.ingredients,
        product.imageKey && !missing.has(product.imageKey) ? product.imageKey : null,
        product.isAvailable ? 1 : 0,
        product.isFeatured ? 1 : 0,
        product.sortOrder,
      ))
      for (const variant of product.variants) {
        statements.push(db.prepare('INSERT INTO product_variants (id, product_id, label, price_cents, promotional_price_cents, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(
          crypto.randomUUID(), productId, variant.label, variant.priceCents, variant.promotionalPriceCents, variant.isActive ? 1 : 0, variant.sortOrder,
        ))
      }
    }
  }

  await db.batch(statements)
  return summary
}
