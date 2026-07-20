import { z } from 'zod'

export const DEFAULT_PRIMARY_COLOR = '#374151'

const nullableText = (max: number) => z.string().trim().max(max).nullable()
const idSchema = z.string().trim().min(1).max(100)
const moneySchema = z.number().int().nonnegative().max(10_000_000)
const positiveMoneySchema = z.number().int().positive().max(10_000_000)
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use o formato HH:mm')
const optionalUrlSchema = z.union([z.literal(''), z.url().max(500)]).nullable().transform((value) => value || null)
const optionalPostalCodeSchema = z.string().trim().regex(/^\d{5}-?\d{3}$/, 'Informe os 8 números do CEP.')
  .transform((value) => `${value.replace(/\D/g, '').slice(0, 5)}-${value.replace(/\D/g, '').slice(5)}`)
  .nullable()
const optionalStateSchema = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'Selecione o estado.')
  .nullable()
const primaryColorSchema = z.string().trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Informe uma cor válida no formato #374151.')
  .transform((value) => value.toUpperCase())

export const variantInputSchema = z.object({
  label: nullableText(40),
  priceCents: positiveMoneySchema,
  promotionalPriceCents: positiveMoneySchema.nullable(),
  isActive: z.boolean(),
  sortOrder: z.number().int().nonnegative().max(10_000),
}).superRefine((variant, context) => {
  if (variant.promotionalPriceCents !== null && variant.promotionalPriceCents >= variant.priceCents) {
    context.addIssue({
      code: 'custom',
      path: ['promotionalPriceCents'],
      message: 'O preço promocional deve ser menor que o preço original.',
    })
  }
})

export const productInputSchema = z.object({
  categoryId: idSchema,
  name: z.string().trim().min(1, 'Informe o nome.').max(120),
  ingredients: nullableText(1000),
  isAvailable: z.boolean(),
  isFeatured: z.boolean(),
  sortOrder: z.number().int().nonnegative().max(10_000),
  variants: z.array(variantInputSchema).min(1, 'Adicione ao menos um preço.').max(20),
})

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome.').max(80),
  description: nullableText(500),
  isActive: z.boolean(),
  sortOrder: z.number().int().nonnegative().max(10_000),
})

export const reorderSchema = z.object({
  items: z.array(z.object({ id: idSchema, sortOrder: z.number().int().nonnegative().max(10_000) })).min(1).max(500),
})

export const settingsInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  slogan: nullableText(160),
  description: nullableText(500),
  whatsapp: nullableText(30),
  phone: nullableText(30),
  instagramUrl: optionalUrlSchema,
  facebookUrl: optionalUrlSchema,
  address: nullableText(300),
  addressPostalCode: optionalPostalCodeSchema,
  addressStreet: nullableText(150),
  addressNumber: nullableText(20),
  addressComplement: nullableText(100),
  addressNeighborhood: nullableText(100),
  addressCity: nullableText(100),
  addressState: optionalStateSchema,
  mapsUrl: optionalUrlSchema,
  timezone: z.string().trim().min(1).max(80),
  specialMessage: nullableText(300),
  primaryColor: primaryColorSchema,
  publicSiteUrl: optionalUrlSchema,
  seoTitle: nullableText(120),
  seoDescription: nullableText(300),
}).superRefine((settings, context) => {
  const requiredAddressFields = [
    ['addressPostalCode', settings.addressPostalCode, 'Informe o CEP.'],
    ['addressStreet', settings.addressStreet, 'Informe a rua ou avenida.'],
    ['addressNumber', settings.addressNumber, 'Informe o número.'],
    ['addressNeighborhood', settings.addressNeighborhood, 'Informe o bairro.'],
    ['addressCity', settings.addressCity, 'Informe a cidade.'],
    ['addressState', settings.addressState, 'Selecione o estado.'],
  ] as const
  if (requiredAddressFields.filter(([field]) => field !== 'addressNumber').some(([, value]) => Boolean(value))) {
    for (const [field, value, message] of requiredAddressFields) {
      if (!value) context.addIssue({ code: 'custom', path: [field], message })
    }
  }
})

export const hourInputSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  opensAt: timeSchema.nullable(),
  closesAt: timeSchema.nullable(),
  isClosed: z.boolean(),
  sortOrder: z.number().int().nonnegative().max(100),
}).superRefine((hour, context) => {
  if (!hour.isClosed && (!hour.opensAt || !hour.closesAt)) {
    context.addIssue({ code: 'custom', path: ['opensAt'], message: 'Informe abertura e fechamento.' })
  }
  if (hour.isClosed && (hour.opensAt || hour.closesAt)) {
    context.addIssue({ code: 'custom', path: ['opensAt'], message: 'Um dia fechado não deve ter horários.' })
  }
})

export const paymentMethodInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  isActive: z.boolean(),
  sortOrder: z.number().int().nonnegative().max(1000),
})

export const deliveryZoneInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  feeCents: moneySchema.nullable(),
  notes: nullableText(300),
  isActive: z.boolean(),
  sortOrder: z.number().int().nonnegative().max(1000),
})

const productImageKeySchema = z.string().trim().max(180).regex(/^products\/[0-9a-f-]+\.webp$/).nullable()
const coverImageKeySchema = z.string().trim().max(180).regex(/^covers\/[0-9a-f-]+\.webp$/).nullable()

const importProductSchema = productInputSchema.omit({ categoryId: true }).extend({ imageKey: productImageKeySchema })
const importCategorySchema = categoryInputSchema.extend({ products: z.array(importProductSchema).max(500) })
const importBusinessSchema = settingsInputSchema.safeExtend({ coverImageKey: coverImageKeySchema })

const menuImportDataSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.iso.datetime(),
  business: importBusinessSchema,
  hours: z.array(hourInputSchema).max(50),
  paymentMethods: z.array(paymentMethodInputSchema).max(100),
  deliveryZones: z.array(deliveryZoneInputSchema).max(200),
  categories: z.array(importCategorySchema).max(100),
}).superRefine((data, context) => {
  const productCount = data.categories.reduce((total, category) => total + category.products.length, 0)
  if (productCount > 500) {
    context.addIssue({ code: 'custom', path: ['categories'], message: 'O arquivo excede o limite de 500 produtos.' })
  }
})

export const menuImportSchema = z.preprocess((value) => {
  if (!value || typeof value !== 'object' || !('business' in value)) return value
  const business = value.business
  if (!business || typeof business !== 'object') return value
  return {
    ...value,
    business: {
      primaryColor: DEFAULT_PRIMARY_COLOR,
      addressPostalCode: null,
      addressStreet: null,
      addressNumber: null,
      addressComplement: null,
      addressNeighborhood: null,
      addressCity: null,
      addressState: null,
      ...business,
    },
  }
}, menuImportDataSchema)

export const importApplySchema = z.object({
  mode: z.literal('replace'),
  data: menuImportSchema,
  confirmed: z.literal(true),
})

export type ProductInput = z.infer<typeof productInputSchema>
export type CategoryInput = z.infer<typeof categoryInputSchema>
export type SettingsInput = z.infer<typeof settingsInputSchema>
export type HourInput = z.infer<typeof hourInputSchema>
export type PaymentMethodInput = z.infer<typeof paymentMethodInputSchema>
export type DeliveryZoneInput = z.infer<typeof deliveryZoneInputSchema>
export type MenuImport = z.infer<typeof menuImportSchema>

export interface BusinessSettings extends SettingsInput {
  id: number
  coverImageKey: string | null
  createdAt: string
  updatedAt: string
}

export interface BusinessHour extends HourInput { id: string }
export interface PaymentMethod extends PaymentMethodInput { id: string }
export interface DeliveryZone extends DeliveryZoneInput { id: string }

export interface ProductVariant {
  id: string
  label: string | null
  priceCents: number
  promotionalPriceCents: number | null
  isActive: boolean
  sortOrder: number
}

export interface Product {
  id: string
  categoryId: string
  name: string
  ingredients: string | null
  imageKey: string | null
  isAvailable: boolean
  isFeatured: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
  variants: ProductVariant[]
}

export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
  products: Product[]
}

export interface MenuResponse {
  business: BusinessSettings
  hours: BusinessHour[]
  paymentMethods: PaymentMethod[]
  deliveryZones: DeliveryZone[]
  categories: Category[]
}

export interface ApiErrorBody {
  code: string
  message: string
  fieldErrors?: Record<string, string[]>
}
