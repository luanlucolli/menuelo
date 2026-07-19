import type {
  BusinessHour,
  BusinessSettings,
  Category,
  DeliveryZone,
  MenuResponse,
  PaymentMethod,
  Product,
  ProductVariant,
} from '../../shared/schemas'

interface SettingsRow {
  id: number
  name: string
  slug: string
  slogan: string | null
  description: string | null
  whatsapp: string | null
  phone: string | null
  instagram_url: string | null
  facebook_url: string | null
  address: string | null
  address_postal_code: string | null
  address_street: string | null
  address_number: string | null
  address_complement: string | null
  address_neighborhood: string | null
  address_city: string | null
  address_state: string | null
  maps_url: string | null
  timezone: string
  special_message: string | null
  primary_color: string
  cover_image_key: string | null
  public_site_url: string | null
  seo_title: string | null
  seo_description: string | null
  created_at: string
  updated_at: string
}

interface HourRow { id: string; weekday: number; opens_at: string | null; closes_at: string | null; is_closed: number; sort_order: number }
interface PaymentRow { id: string; name: string; is_active: number; sort_order: number }
interface ZoneRow { id: string; name: string; fee_cents: number | null; notes: string | null; is_active: number; sort_order: number }
interface CategoryRow { id: string; name: string; slug: string; description: string | null; is_active: number; sort_order: number; created_at: string; updated_at: string }
interface ProductRow { id: string; category_id: string; name: string; ingredients: string | null; image_key: string | null; is_available: number; is_featured: number; sort_order: number; created_at: string; updated_at: string }
interface VariantRow { id: string; product_id: string; label: string | null; price_cents: number; promotional_price_cents: number | null; is_active: number; sort_order: number }

function mapSettings(row: SettingsRow): BusinessSettings {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    slogan: row.slogan,
    description: row.description,
    whatsapp: row.whatsapp,
    phone: row.phone,
    instagramUrl: row.instagram_url,
    facebookUrl: row.facebook_url,
    address: row.address,
    addressPostalCode: row.address_postal_code,
    addressStreet: row.address_street,
    addressNumber: row.address_number,
    addressComplement: row.address_complement,
    addressNeighborhood: row.address_neighborhood,
    addressCity: row.address_city,
    addressState: row.address_state,
    mapsUrl: row.maps_url,
    timezone: row.timezone,
    specialMessage: row.special_message,
    primaryColor: row.primary_color,
    coverImageKey: row.cover_image_key,
    publicSiteUrl: row.public_site_url,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapHour(row: HourRow): BusinessHour {
  return { id: row.id, weekday: row.weekday, opensAt: row.opens_at, closesAt: row.closes_at, isClosed: Boolean(row.is_closed), sortOrder: row.sort_order }
}

function mapPayment(row: PaymentRow): PaymentMethod {
  return { id: row.id, name: row.name, isActive: Boolean(row.is_active), sortOrder: row.sort_order }
}

function mapZone(row: ZoneRow): DeliveryZone {
  return { id: row.id, name: row.name, feeCents: row.fee_cents, notes: row.notes, isActive: Boolean(row.is_active), sortOrder: row.sort_order }
}

function mapVariant(row: VariantRow): ProductVariant {
  return { id: row.id, label: row.label, priceCents: row.price_cents, promotionalPriceCents: row.promotional_price_cents, isActive: Boolean(row.is_active), sortOrder: row.sort_order }
}

export async function getMenu(db: D1Database, includeInactive = false): Promise<MenuResponse> {
  const visibility = includeInactive ? '' : 'WHERE is_active = 1'
  const [settings, hours, payments, zones, categories, products, variants] = await Promise.all([
    db.prepare('SELECT * FROM business_settings WHERE id = 1').first<SettingsRow>(),
    db.prepare('SELECT * FROM business_hours ORDER BY weekday, sort_order, id').all<HourRow>(),
    db.prepare(`SELECT * FROM payment_methods ${visibility} ORDER BY sort_order, name`).all<PaymentRow>(),
    db.prepare(`SELECT * FROM delivery_zones ${visibility} ORDER BY sort_order, name`).all<ZoneRow>(),
    db.prepare(`SELECT * FROM categories ${visibility} ORDER BY sort_order, name`).all<CategoryRow>(),
    db.prepare('SELECT * FROM products ORDER BY category_id, sort_order, name').all<ProductRow>(),
    db.prepare(`SELECT * FROM product_variants ${visibility} ORDER BY product_id, sort_order, id`).all<VariantRow>(),
  ])

  if (!settings) throw new Error('Configuração do estabelecimento não encontrada. Aplique o seed local.')

  const variantsByProduct = new Map<string, ProductVariant[]>()
  for (const row of variants.results) {
    const list = variantsByProduct.get(row.product_id) ?? []
    list.push(mapVariant(row))
    variantsByProduct.set(row.product_id, list)
  }

  const productsByCategory = new Map<string, Product[]>()
  for (const row of products.results) {
    const product: Product = {
      id: row.id,
      categoryId: row.category_id,
      name: row.name,
      ingredients: row.ingredients,
      imageKey: row.image_key,
      isAvailable: Boolean(row.is_available),
      isFeatured: Boolean(row.is_featured),
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      variants: variantsByProduct.get(row.id) ?? [],
    }
    const list = productsByCategory.get(row.category_id) ?? []
    list.push(product)
    productsByCategory.set(row.category_id, list)
  }

  const mappedCategories: Category[] = categories.results.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    isActive: Boolean(row.is_active),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    products: productsByCategory.get(row.id) ?? [],
  }))

  return {
    business: mapSettings(settings),
    hours: hours.results.map(mapHour),
    paymentMethods: payments.results.map(mapPayment),
    deliveryZones: zones.results.map(mapZone),
    categories: mappedCategories,
  }
}

export async function getProduct(db: D1Database, id: string): Promise<Product | null> {
  const row = await db.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<ProductRow>()
  if (!row) return null
  const variants = await db.prepare('SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order, id').bind(id).all<VariantRow>()
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    ingredients: row.ingredients,
    imageKey: row.image_key,
    isAvailable: Boolean(row.is_available),
    isFeatured: Boolean(row.is_featured),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    variants: variants.results.map(mapVariant),
  }
}
