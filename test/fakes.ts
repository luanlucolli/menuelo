import { vi } from 'vitest'
import type { RuntimeEnv } from '../worker/middleware/auth'

interface FakeRows {
  settings?: Record<string, unknown> | null
  hours?: Record<string, unknown>[]
  payments?: Record<string, unknown>[]
  zones?: Record<string, unknown>[]
  categories?: Record<string, unknown>[]
  products?: Record<string, unknown>[]
  variants?: Record<string, unknown>[]
}

function partialMock<T extends object>(value: Partial<T>): T {
  return value as T
}

function d1Result<T>(results: T[], changes = 0): D1Result<T> {
  return partialMock<D1Result<T>>({
    results,
    success: true,
    meta: partialMock<D1Meta & Record<string, unknown>>({ changes }),
  })
}

export class FakeDatabase {
  readonly batches: D1PreparedStatement[][] = []
  constructor(private readonly rows: FakeRows = {}) {}

  private statement(sql: string): D1PreparedStatement {
    const statement: D1PreparedStatement = partialMock<D1PreparedStatement>({
      bind: (...values: unknown[]): D1PreparedStatement => { void values; return statement },
      first: async <T = Record<string, unknown>>() => this.first(sql) as T | null,
      all: async <T = Record<string, unknown>>() => d1Result(this.all(sql) as T[]),
      run: async <T = Record<string, unknown>>() => d1Result<T>([], 1),
    })
    return statement
  }

  prepare(sql: string): D1PreparedStatement { return this.statement(sql) }
  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    this.batches.push(statements)
    return statements.map(() => d1Result<T>([]))
  }
  first(sql: string): Record<string, unknown> | null {
    if (sql.includes('business_settings')) return this.rows.settings ?? null
    return null
  }
  all(sql: string): Record<string, unknown>[] {
    if (sql.includes('business_hours')) return this.rows.hours ?? []
    if (sql.includes('payment_methods')) return this.rows.payments ?? []
    if (sql.includes('delivery_zones')) return this.rows.zones ?? []
    if (sql.includes('FROM categories')) return this.rows.categories ?? []
    if (sql.includes('FROM products')) return this.rows.products ?? []
    if (sql.includes('product_variants')) return this.rows.variants ?? []
    return []
  }
  asBinding(): D1Database {
    return partialMock<D1Database>({
      prepare: (query) => this.prepare(query),
      batch: <T = unknown>(statements: D1PreparedStatement[]) => this.batch<T>(statements),
    })
  }
}

export const settingsRow = {
  id: 1,
  name: 'Pipo Lanches & Porções',
  slug: 'pipo-lanches-e-porcoes',
  slogan: null,
  description: 'Cardápio digital.',
  whatsapp: null,
  phone: null,
  instagram_url: null,
  facebook_url: null,
  address: null,
  address_postal_code: null,
  address_street: null,
  address_number: null,
  address_complement: null,
  address_neighborhood: null,
  address_city: null,
  address_state: null,
  maps_url: null,
  timezone: 'America/Sao_Paulo',
  special_message: 'Fechado às segundas-feiras.',
  primary_color: '#FB5D01',
  cover_image_key: null,
  public_site_url: null,
  seo_title: null,
  seo_description: null,
  created_at: '2026-07-18T00:00:00.000Z',
  updated_at: '2026-07-18T00:00:00.000Z',
}

export function fakeBucket(): R2Bucket {
  return partialMock<R2Bucket>({
    get: vi.fn(async () => null),
    head: vi.fn(async () => null),
    put: vi.fn(async () => partialMock<R2Object>({})),
    delete: vi.fn(async () => undefined),
  })
}

export function runtimeEnv(overrides: Partial<RuntimeEnv> = {}): RuntimeEnv {
  return {
    DB: new FakeDatabase({ settings: settingsRow }).asBinding(),
    MENU_IMAGES: fakeBucket(),
    ASSETS: partialMock<Fetcher>({}),
    DEV_ADMIN_BYPASS: 'false',
    CF_ACCESS_TEAM_DOMAIN: '',
    CF_ACCESS_AUD: '',
    ADMIN_EMAILS: 'luangstl@gmail.com',
    PUBLIC_SITE_URL: '',
    ...overrides,
  }
}
