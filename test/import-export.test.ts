import { describe, expect, it } from 'vitest'
import { DEFAULT_PRIMARY_COLOR, menuImportSchema, type MenuImport } from '../shared/schemas'
import { applyImport, serializeExport } from '../worker/services/import-export'
import { FakeDatabase, fakeBucket, settingsRow } from './fakes'

const validImport: MenuImport = {
  schemaVersion: 1,
  exportedAt: '2026-07-18T12:00:00.000Z',
  business: {
    name: 'Pipo Lanches & Porções',
    slug: 'pipo-lanches-e-porcoes',
    slogan: null,
    description: null,
    whatsapp: null,
    phone: null,
    instagramUrl: null,
    facebookUrl: null,
    address: null,
    addressPostalCode: null,
    addressStreet: null,
    addressNumber: null,
    addressComplement: null,
    addressNeighborhood: null,
    addressCity: null,
    addressState: null,
    mapsUrl: null,
    timezone: 'America/Sao_Paulo',
    specialMessage: 'Fechado às segundas-feiras.',
    primaryColor: '#FB5D01',
    publicSiteUrl: null,
    seoTitle: null,
    seoDescription: null,
    coverImageKey: null,
  },
  hours: [{ weekday: 1, opensAt: null, closesAt: null, isClosed: true, sortOrder: 0 }],
  paymentMethods: [],
  deliveryZones: [],
  categories: [{
    name: 'Categoria',
    description: null,
    isActive: true,
    sortOrder: 0,
    products: [{
      name: 'Produto',
      ingredients: null,
      imageKey: null,
      isAvailable: true,
      isFeatured: false,
      sortOrder: 0,
      variants: [{ label: null, priceCents: 1000, promotionalPriceCents: null, isActive: true, sortOrder: 0 }],
    }],
  }],
}

describe('exportação e importação', () => {
  it('serializa exportação versionada sem IDs locais', async () => {
    const database = new FakeDatabase({
      settings: settingsRow,
      categories: [{ id: 'cat-local', name: 'Categoria', slug: 'categoria', description: null, is_active: 1, sort_order: 0, created_at: 'now', updated_at: 'now' }],
      products: [{ id: 'product-local', category_id: 'cat-local', name: 'Produto', ingredients: null, image_key: null, is_available: 1, is_featured: 0, sort_order: 0, created_at: 'now', updated_at: 'now' }],
      variants: [{ id: 'variant-local', product_id: 'product-local', label: null, price_cents: 1000, promotional_price_cents: null, is_active: 1, sort_order: 0 }],
    })
    const exported = await serializeExport(database.asBinding())
    expect(exported.schemaVersion).toBe(1)
    expect(exported.categories[0]?.products[0]?.name).toBe('Produto')
    expect(JSON.stringify(exported)).not.toContain('product-local')
    expect(menuImportSchema.safeParse(exported).success).toBe(true)
  })

  it('aplica cenário válido em um único D1 batch transacional e gera IDs locais', async () => {
    const database = new FakeDatabase({ settings: settingsRow })
    const result = await applyImport(database.asBinding(), fakeBucket(), validImport)
    expect(result.incoming.products).toBe(1)
    expect(database.batches).toHaveLength(1)
    expect(database.batches[0]!.length).toBeGreaterThan(7)
  })

  it('rejeita schemaVersion inválido antes da aplicação', () => {
    const invalid = { ...validImport, schemaVersion: 99 }
    expect(menuImportSchema.safeParse(invalid).success).toBe(false)
  })

  it('continua aceitando cópias antigas sem os campos estruturados', () => {
    const legacy = JSON.parse(JSON.stringify(validImport)) as { business: Record<string, unknown> }
    for (const field of ['primaryColor', 'addressPostalCode', 'addressStreet', 'addressNumber', 'addressComplement', 'addressNeighborhood', 'addressCity', 'addressState']) delete legacy.business[field]
    const result = menuImportSchema.safeParse(legacy)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.business.addressPostalCode).toBeNull()
      expect(result.data.business.primaryColor).toBe(DEFAULT_PRIMARY_COLOR)
    }
  })
})
