import { Hono } from 'hono'
import { z } from 'zod'
import {
  categoryInputSchema,
  deliveryZoneInputSchema,
  hourInputSchema,
  importApplySchema,
  menuImportSchema,
  paymentMethodInputSchema,
  productInputSchema,
  reorderSchema,
  settingsInputSchema,
  type ProductInput,
} from '../../shared/schemas'
import { formatStructuredAddress, slugify } from '../../shared/utils'
import { ApiError, parseJson, readBytesLimited, requireId } from '../lib/http'
import { requireAdmin, type AppEnvironment } from '../middleware/auth'
import { getMenu, getProduct } from '../repositories/menu'
import { applyImport, serializeExport, summarizeImport } from '../services/import-export'

export const adminRoutes = new Hono<AppEnvironment>()

adminRoutes.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store')
  await next()
})
adminRoutes.use('*', requireAdmin)

async function ensureCategory(db: D1Database, id: string): Promise<void> {
  const row = await db.prepare('SELECT id FROM categories WHERE id = ?').bind(id).first<{ id: string }>()
  if (!row) throw new ApiError(422, 'CATEGORY_NOT_FOUND', 'A categoria selecionada não existe.', { categoryId: ['Selecione uma categoria válida.'] })
}

async function uniqueCategorySlug(db: D1Database, name: string, excludeId?: string): Promise<string> {
  const base = slugify(name)
  for (let suffix = 1; suffix < 10_000; suffix += 1) {
    const candidate = suffix === 1 ? base : `${base}-${suffix}`
    const row = excludeId
      ? await db.prepare('SELECT id FROM categories WHERE slug = ? AND id != ?').bind(candidate, excludeId).first()
      : await db.prepare('SELECT id FROM categories WHERE slug = ?').bind(candidate).first()
    if (!row) return candidate
  }
  return `${base}-${crypto.randomUUID()}`
}

function productStatements(db: D1Database, productId: string, input: ProductInput): D1PreparedStatement[] {
  return input.variants.map((variant) => db.prepare(
    'INSERT INTO product_variants (id, product_id, label, price_cents, promotional_price_cents, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).bind(crypto.randomUUID(), productId, variant.label, variant.priceCents, variant.promotionalPriceCents, variant.isActive ? 1 : 0, variant.sortOrder))
}

function isWebp(bytes: Uint8Array): boolean {
  return bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
}

async function readWebp(request: Request): Promise<Uint8Array> {
  const contentType = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  if (contentType !== 'image/webp') throw new ApiError(415, 'WEBP_REQUIRED', 'Envie uma imagem WebP.')
  const body = await readBytesLimited(request, 800 * 1024, 'A imagem final deve ter no máximo 800 KB.')
  if (!isWebp(body)) throw new ApiError(422, 'INVALID_WEBP', 'O arquivo não é uma imagem WebP válida.')
  return body
}

async function deleteObjectBestEffort(bucket: R2Bucket, key: string | null, context: string): Promise<void> {
  if (!key) return
  try {
    await bucket.delete(key)
  } catch (error) {
    console.error(JSON.stringify({ message: 'orphaned R2 object', key, context, error: error instanceof Error ? error.message : String(error) }))
  }
}

adminRoutes.get('/menu', async (c) => c.json(await getMenu(c.env.DB, true)))

adminRoutes.get('/dashboard', async (c) => {
  const menu = await getMenu(c.env.DB, true)
  const products = menu.categories.flatMap((category) => category.products)
  return c.json({
    categories: menu.categories.length,
    products: products.length,
    unavailable: products.filter((product) => !product.isAvailable).length,
    featured: products.filter((product) => product.isFeatured).length,
    promotions: products.filter((product) => product.variants.some((variant) => variant.promotionalPriceCents !== null)).length,
    pending: {
      publicSiteUrl: !menu.business.publicSiteUrl,
      contacts: !menu.business.whatsapp && !menu.business.phone,
      address: !menu.business.address,
      completeHours: new Set(menu.hours.map((hour) => hour.weekday)).size !== 7,
    },
  })
})

adminRoutes.get('/categories', async (c) => c.json((await getMenu(c.env.DB, true)).categories))

adminRoutes.post('/categories', async (c) => {
  const input = await parseJson(c.req.raw, categoryInputSchema)
  const id = crypto.randomUUID()
  const slug = await uniqueCategorySlug(c.env.DB, input.name)
  const max = await c.env.DB.prepare('SELECT COALESCE(MAX(sort_order), -1) AS value FROM categories').first<{ value: number }>()
  const sortOrder = input.sortOrder || (max?.value ?? -1) + 1
  await c.env.DB.prepare('INSERT INTO categories (id, name, slug, description, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, input.name, slug, input.description, input.isActive ? 1 : 0, sortOrder).run()
  return c.json({ id, slug }, 201)
})

adminRoutes.patch('/categories/:id', async (c) => {
  const id = requireId(c.req.param('id'))
  const input = await parseJson(c.req.raw, categoryInputSchema)
  const slug = await uniqueCategorySlug(c.env.DB, input.name, id)
  const result = await c.env.DB.prepare(`UPDATE categories SET name=?, slug=?, description=?, is_active=?, sort_order=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id=?`)
    .bind(input.name, slug, input.description, input.isActive ? 1 : 0, input.sortOrder, id).run()
  if (!result.meta.changes) throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Categoria não encontrada.')
  return c.json({ id, slug })
})

adminRoutes.delete('/categories/:id', async (c) => {
  const id = requireId(c.req.param('id'))
  const count = await c.env.DB.prepare('SELECT COUNT(*) AS total FROM products WHERE category_id = ?').bind(id).first<{ total: number }>()
  if ((count?.total ?? 0) > 0) throw new ApiError(409, 'CATEGORY_HAS_PRODUCTS', 'Mova ou exclua os produtos antes de excluir esta categoria.')
  const result = await c.env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(id).run()
  if (!result.meta.changes) throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Categoria não encontrada.')
  return c.json({ success: true })
})

adminRoutes.post('/categories/reorder', async (c) => {
  const input = await parseJson(c.req.raw, reorderSchema)
  await c.env.DB.batch(input.items.map((item) => c.env.DB.prepare(`UPDATE categories SET sort_order=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id=?`).bind(item.sortOrder, item.id)))
  return c.json({ success: true })
})

adminRoutes.get('/products', async (c) => {
  const menu = await getMenu(c.env.DB, true)
  return c.json(menu.categories.flatMap((category) => category.products))
})

adminRoutes.get('/products/:id', async (c) => {
  const product = await getProduct(c.env.DB, requireId(c.req.param('id')))
  if (!product) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Produto não encontrado.')
  return c.json(product)
})

adminRoutes.post('/products', async (c) => {
  const input = await parseJson(c.req.raw, productInputSchema)
  await ensureCategory(c.env.DB, input.categoryId)
  const id = crypto.randomUUID()
  const max = await c.env.DB.prepare('SELECT COALESCE(MAX(sort_order), -1) AS value FROM products WHERE category_id = ?').bind(input.categoryId).first<{ value: number }>()
  const sortOrder = input.sortOrder || (max?.value ?? -1) + 1
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO products (id, category_id, name, ingredients, is_available, is_featured, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, input.categoryId, input.name, input.ingredients, input.isAvailable ? 1 : 0, input.isFeatured ? 1 : 0, sortOrder),
    ...productStatements(c.env.DB, id, input),
  ])
  return c.json(await getProduct(c.env.DB, id), 201)
})

adminRoutes.patch('/products/:id', async (c) => {
  const id = requireId(c.req.param('id'))
  const input = await parseJson(c.req.raw, productInputSchema)
  if (!await getProduct(c.env.DB, id)) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Produto não encontrado.')
  await ensureCategory(c.env.DB, input.categoryId)
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE products SET category_id=?, name=?, ingredients=?, is_available=?, is_featured=?, sort_order=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id=?`)
      .bind(input.categoryId, input.name, input.ingredients, input.isAvailable ? 1 : 0, input.isFeatured ? 1 : 0, input.sortOrder, id),
    c.env.DB.prepare('DELETE FROM product_variants WHERE product_id = ?').bind(id),
    ...productStatements(c.env.DB, id, input),
  ])
  return c.json(await getProduct(c.env.DB, id))
})

adminRoutes.delete('/products/:id', async (c) => {
  const id = requireId(c.req.param('id'))
  const product = await getProduct(c.env.DB, id)
  if (!product) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Produto não encontrado.')
  await c.env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run()
  await deleteObjectBestEffort(c.env.MENU_IMAGES, product.imageKey, 'delete product')
  return c.json({ success: true })
})

adminRoutes.post('/products/:id/duplicate', async (c) => {
  const source = await getProduct(c.env.DB, requireId(c.req.param('id')))
  if (!source) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Produto não encontrado.')
  const id = crypto.randomUUID()
  const max = await c.env.DB.prepare('SELECT COALESCE(MAX(sort_order), -1) AS value FROM products WHERE category_id = ?').bind(source.categoryId).first<{ value: number }>()
  let imageKey: string | null = null
  if (source.imageKey) {
    const object = await c.env.MENU_IMAGES.get(source.imageKey)
    if (object) {
      imageKey = `products/${crypto.randomUUID()}.webp`
      await c.env.MENU_IMAGES.put(imageKey, object.body, { httpMetadata: { contentType: 'image/webp' } })
    }
  }
  try {
    await c.env.DB.batch([
      c.env.DB.prepare('INSERT INTO products (id, category_id, name, ingredients, image_key, is_available, is_featured, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(id, source.categoryId, `Cópia de ${source.name}`.slice(0, 120), source.ingredients, imageKey, source.isAvailable ? 1 : 0, false, (max?.value ?? -1) + 1),
      ...source.variants.map((variant) => c.env.DB.prepare('INSERT INTO product_variants (id, product_id, label, price_cents, promotional_price_cents, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(crypto.randomUUID(), id, variant.label, variant.priceCents, variant.promotionalPriceCents, variant.isActive ? 1 : 0, variant.sortOrder)),
    ])
  } catch (error) {
    await deleteObjectBestEffort(c.env.MENU_IMAGES, imageKey, 'duplicate rollback')
    throw error
  }
  return c.json(await getProduct(c.env.DB, id), 201)
})

adminRoutes.post('/products/reorder', async (c) => {
  const input = await parseJson(c.req.raw, reorderSchema)
  const ids = input.items.map((item) => item.id)
  const placeholders = ids.map(() => '?').join(',')
  const categories = await c.env.DB.prepare(`SELECT DISTINCT category_id FROM products WHERE id IN (${placeholders})`).bind(...ids).all<{ category_id: string }>()
  if (categories.results.length !== 1) throw new ApiError(422, 'CROSS_CATEGORY_REORDER', 'Ordene produtos somente dentro da mesma categoria.')
  await c.env.DB.batch(input.items.map((item) => c.env.DB.prepare(`UPDATE products SET sort_order=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id=?`).bind(item.sortOrder, item.id)))
  return c.json({ success: true })
})

adminRoutes.post('/products/:id/image', async (c) => {
  const id = requireId(c.req.param('id'))
  const product = await getProduct(c.env.DB, id)
  if (!product) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Produto não encontrado.')
  const body = await readWebp(c.req.raw)
  const newKey = `products/${crypto.randomUUID()}.webp`
  await c.env.MENU_IMAGES.put(newKey, body, { httpMetadata: { contentType: 'image/webp' } })
  try {
    await c.env.DB.prepare(`UPDATE products SET image_key=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id=?`).bind(newKey, id).run()
  } catch (error) {
    await deleteObjectBestEffort(c.env.MENU_IMAGES, newKey, 'upload rollback')
    throw error
  }
  await deleteObjectBestEffort(c.env.MENU_IMAGES, product.imageKey, 'replace product image')
  return c.json({ imageKey: newKey })
})

adminRoutes.delete('/products/:id/image', async (c) => {
  const id = requireId(c.req.param('id'))
  const product = await getProduct(c.env.DB, id)
  if (!product) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Produto não encontrado.')
  await c.env.DB.prepare(`UPDATE products SET image_key=NULL, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id=?`).bind(id).run()
  await deleteObjectBestEffort(c.env.MENU_IMAGES, product.imageKey, 'remove product image')
  return c.json({ success: true })
})

adminRoutes.get('/settings', async (c) => c.json((await getMenu(c.env.DB, true)).business))

const postalCodeParamSchema = z.string().regex(/^\d{8}$/)
const viaCepFoundSchema = z.object({
  cep: z.string().trim().regex(/^\d{5}-\d{3}$/),
  logradouro: z.string().trim().max(150),
  bairro: z.string().trim().max(100),
  localidade: z.string().trim().min(1).max(100),
  uf: z.string().trim().regex(/^[A-Z]{2}$/),
})
const viaCepNotFoundSchema = z.object({ erro: z.literal(true) })

adminRoutes.get('/address/cep/:postalCode', async (c) => {
  const parsedPostalCode = postalCodeParamSchema.safeParse(c.req.param('postalCode'))
  if (!parsedPostalCode.success) throw new ApiError(400, 'INVALID_POSTAL_CODE', 'Digite os 8 números do CEP.')

  let response: Response
  try {
    response = await fetch(`https://viacep.com.br/ws/${parsedPostalCode.data}/json/`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5_000),
    })
  } catch (error) {
    console.error(JSON.stringify({ message: 'ViaCEP request failed', error: error instanceof Error ? error.message : String(error) }))
    throw new ApiError(503, 'POSTAL_CODE_SERVICE_UNAVAILABLE', 'Não foi possível buscar o CEP agora. Preencha o endereço manualmente.')
  }
  if (!response.ok) throw new ApiError(502, 'POSTAL_CODE_SERVICE_ERROR', 'O serviço de CEP não respondeu corretamente. Preencha o endereço manualmente.')

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new ApiError(502, 'INVALID_POSTAL_CODE_RESPONSE', 'O serviço de CEP enviou uma resposta inválida. Preencha o endereço manualmente.')
  }
  if (viaCepNotFoundSchema.safeParse(payload).success) throw new ApiError(404, 'POSTAL_CODE_NOT_FOUND', 'CEP não encontrado. Confira os números ou preencha o endereço manualmente.')
  const address = viaCepFoundSchema.safeParse(payload)
  if (!address.success) throw new ApiError(502, 'INVALID_POSTAL_CODE_RESPONSE', 'O serviço de CEP enviou uma resposta inválida. Preencha o endereço manualmente.')

  return c.json({
    postalCode: address.data.cep,
    street: address.data.logradouro,
    neighborhood: address.data.bairro,
    city: address.data.localidade,
    state: address.data.uf,
  })
})

adminRoutes.patch('/settings', async (c) => {
  const input = await parseJson(c.req.raw, settingsInputSchema)
  const address = formatStructuredAddress(input) ?? input.address
  await c.env.DB.prepare(`UPDATE business_settings SET name=?, slug=?, slogan=?, description=?, whatsapp=?, phone=?, instagram_url=?, facebook_url=?, address=?, address_postal_code=?, address_street=?, address_number=?, address_complement=?, address_neighborhood=?, address_city=?, address_state=?, maps_url=?, timezone=?, special_message=?, primary_color=?, public_site_url=?, seo_title=?, seo_description=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id=1`).bind(
    input.name, input.slug, input.slogan, input.description, input.whatsapp, input.phone, input.instagramUrl, input.facebookUrl,
    address, input.addressPostalCode, input.addressStreet, input.addressNumber, input.addressComplement, input.addressNeighborhood, input.addressCity, input.addressState,
    input.mapsUrl, input.timezone, input.specialMessage, input.primaryColor, input.publicSiteUrl, input.seoTitle, input.seoDescription,
  ).run()
  return c.json((await getMenu(c.env.DB, true)).business)
})

adminRoutes.post('/settings/cover-image', async (c) => {
  const previous = (await getMenu(c.env.DB, true)).business.coverImageKey
  const body = await readWebp(c.req.raw)
  const newKey = `covers/${crypto.randomUUID()}.webp`
  await c.env.MENU_IMAGES.put(newKey, body, { httpMetadata: { contentType: 'image/webp' } })
  try {
    await c.env.DB.prepare(`UPDATE business_settings SET cover_image_key=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id=1`).bind(newKey).run()
  } catch (error) {
    await deleteObjectBestEffort(c.env.MENU_IMAGES, newKey, 'cover upload rollback')
    throw error
  }
  await deleteObjectBestEffort(c.env.MENU_IMAGES, previous, 'replace cover image')
  return c.json({ coverImageKey: newKey })
})

adminRoutes.delete('/settings/cover-image', async (c) => {
  const previous = (await getMenu(c.env.DB, true)).business.coverImageKey
  await c.env.DB.prepare(`UPDATE business_settings SET cover_image_key=NULL, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id=1`).run()
  await deleteObjectBestEffort(c.env.MENU_IMAGES, previous, 'remove cover image')
  return c.json({ success: true })
})

adminRoutes.get('/hours', async (c) => c.json((await getMenu(c.env.DB, true)).hours))
adminRoutes.post('/hours', async (c) => {
  const input = await parseJson(c.req.raw, hourInputSchema)
  const id = crypto.randomUUID()
  await c.env.DB.prepare('INSERT INTO business_hours (id, weekday, opens_at, closes_at, is_closed, sort_order) VALUES (?, ?, ?, ?, ?, ?)').bind(id, input.weekday, input.opensAt, input.closesAt, input.isClosed ? 1 : 0, input.sortOrder).run()
  return c.json({ id }, 201)
})
adminRoutes.patch('/hours/:id', async (c) => {
  const id = requireId(c.req.param('id'))
  const input = await parseJson(c.req.raw, hourInputSchema)
  const result = await c.env.DB.prepare('UPDATE business_hours SET weekday=?, opens_at=?, closes_at=?, is_closed=?, sort_order=? WHERE id=?').bind(input.weekday, input.opensAt, input.closesAt, input.isClosed ? 1 : 0, input.sortOrder, id).run()
  if (!result.meta.changes) throw new ApiError(404, 'HOUR_NOT_FOUND', 'Horário não encontrado.')
  return c.json({ id })
})
adminRoutes.delete('/hours/:id', async (c) => {
  const result = await c.env.DB.prepare('DELETE FROM business_hours WHERE id=?').bind(requireId(c.req.param('id'))).run()
  if (!result.meta.changes) throw new ApiError(404, 'HOUR_NOT_FOUND', 'Horário não encontrado.')
  return c.json({ success: true })
})

adminRoutes.get('/payment-methods', async (c) => c.json((await getMenu(c.env.DB, true)).paymentMethods))
adminRoutes.post('/payment-methods', async (c) => {
  const input = await parseJson(c.req.raw, paymentMethodInputSchema)
  const id = crypto.randomUUID()
  await c.env.DB.prepare('INSERT INTO payment_methods (id, name, is_active, sort_order) VALUES (?, ?, ?, ?)').bind(id, input.name, input.isActive ? 1 : 0, input.sortOrder).run()
  return c.json({ id }, 201)
})
adminRoutes.patch('/payment-methods/:id', async (c) => {
  const id = requireId(c.req.param('id'))
  const input = await parseJson(c.req.raw, paymentMethodInputSchema)
  const result = await c.env.DB.prepare('UPDATE payment_methods SET name=?, is_active=?, sort_order=? WHERE id=?').bind(input.name, input.isActive ? 1 : 0, input.sortOrder, id).run()
  if (!result.meta.changes) throw new ApiError(404, 'PAYMENT_NOT_FOUND', 'Forma de pagamento não encontrada.')
  return c.json({ id })
})
adminRoutes.delete('/payment-methods/:id', async (c) => {
  const result = await c.env.DB.prepare('DELETE FROM payment_methods WHERE id=?').bind(requireId(c.req.param('id'))).run()
  if (!result.meta.changes) throw new ApiError(404, 'PAYMENT_NOT_FOUND', 'Forma de pagamento não encontrada.')
  return c.json({ success: true })
})

adminRoutes.get('/delivery-zones', async (c) => c.json((await getMenu(c.env.DB, true)).deliveryZones))
adminRoutes.post('/delivery-zones', async (c) => {
  const input = await parseJson(c.req.raw, deliveryZoneInputSchema)
  const id = crypto.randomUUID()
  await c.env.DB.prepare('INSERT INTO delivery_zones (id, name, fee_cents, notes, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?)').bind(id, input.name, input.feeCents, input.notes, input.isActive ? 1 : 0, input.sortOrder).run()
  return c.json({ id }, 201)
})
adminRoutes.patch('/delivery-zones/:id', async (c) => {
  const id = requireId(c.req.param('id'))
  const input = await parseJson(c.req.raw, deliveryZoneInputSchema)
  const result = await c.env.DB.prepare('UPDATE delivery_zones SET name=?, fee_cents=?, notes=?, is_active=?, sort_order=? WHERE id=?').bind(input.name, input.feeCents, input.notes, input.isActive ? 1 : 0, input.sortOrder, id).run()
  if (!result.meta.changes) throw new ApiError(404, 'ZONE_NOT_FOUND', 'Região de entrega não encontrada.')
  return c.json({ id })
})
adminRoutes.delete('/delivery-zones/:id', async (c) => {
  const result = await c.env.DB.prepare('DELETE FROM delivery_zones WHERE id=?').bind(requireId(c.req.param('id'))).run()
  if (!result.meta.changes) throw new ApiError(404, 'ZONE_NOT_FOUND', 'Região de entrega não encontrada.')
  return c.json({ success: true })
})

adminRoutes.get('/export', async (c) => {
  const data = await serializeExport(c.env.DB)
  c.header('Content-Disposition', `attachment; filename="copia-${data.business.slug}-${new Date().toISOString().slice(0, 10)}.json"`)
  return c.json(data)
})

adminRoutes.post('/import/validate', async (c) => {
  const data = await parseJson(c.req.raw, menuImportSchema, 2_000_000)
  return c.json(await summarizeImport(c.env.DB, c.env.MENU_IMAGES, data))
})

adminRoutes.post('/import/apply', async (c) => {
  const input = await parseJson(c.req.raw, importApplySchema, 2_000_000)
  return c.json({ success: true, summary: await applyImport(c.env.DB, c.env.MENU_IMAGES, input.data) })
})
