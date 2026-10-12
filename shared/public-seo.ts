import type { Category, MenuResponse, Product } from './schemas'
import { formatStructuredAddress, hasStructuredAddress, slugify } from './utils'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
const DESCRIPTION_LIMIT = 160

export interface PublicSeoData {
  title: string
  description: string
  canonical: string
  themeColor: string
  image: string | null
  favicon: string | null
  robots: 'index,follow' | 'noindex,follow'
  openGraphType: 'website' | 'product'
  siteName: string
  locale: 'pt_BR'
  twitterCard: 'summary' | 'summary_large_image'
  jsonLd: Record<string, unknown>
}

export interface PublicProductPageData {
  category: Category
  product: Product
}

export function publicProductPath(id: string, name: string): string {
  return `/produtos/${encodeURIComponent(id)}/${slugify(name)}`
}

export function safePublicHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export function hasIndexableMenuContent(menu: MenuResponse): boolean {
  return menu.categories.some((category) => category.isActive && category.products.some((product) =>
    product.name.trim().length > 0 && product.variants.some((variant) => variant.isActive),
  ))
}

function normalizedBrazilianPhone(value: string | null | undefined): string | null {
  const digits = (value ?? '').replace(/\D/g, '')
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) return `+55${digits}`
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return `+${digits}`
  return null
}

function conciseDescription(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (normalized.length <= DESCRIPTION_LIMIT) return normalized
  const slice = normalized.slice(0, DESCRIPTION_LIMIT - 1)
  const wordBoundary = slice.lastIndexOf(' ')
  return `${slice.slice(0, wordBoundary > 80 ? wordBoundary : slice.length).trimEnd()}…`
}

function publicBase(menu: MenuResponse, publicOrigin: string): Pick<PublicSeoData, 'themeColor' | 'favicon' | 'robots' | 'siteName' | 'locale' | 'twitterCard'> {
  const indexable = hasIndexableMenuContent(menu)
  return {
    themeColor: menu.business.primaryColor,
    favicon: menu.business.faviconKey ? new URL(`/media/${menu.business.faviconKey}`, publicOrigin).toString() : null,
    robots: indexable ? 'index,follow' : 'noindex,follow',
    siteName: menu.business.name,
    locale: 'pt_BR',
    twitterCard: menu.business.coverImageKey ? 'summary_large_image' : 'summary',
  }
}

function structuredAddress(menu: MenuResponse): Record<string, unknown> | null {
  const { business } = menu
  const formattedAddress = formatStructuredAddress(business) ?? business.address
  if (!formattedAddress) return null
  return hasStructuredAddress(business) ? {
    '@type': 'PostalAddress',
    streetAddress: [business.addressStreet, business.addressNumber, business.addressComplement].filter(Boolean).join(', '),
    addressLocality: business.addressCity,
    addressRegion: business.addressState,
    postalCode: business.addressPostalCode,
    addressCountry: 'BR',
  } : { '@type': 'PostalAddress', streetAddress: formattedAddress }
}

function openingHours(menu: MenuResponse): Record<string, unknown>[] | null {
  if (new Set(menu.hours.map((hour) => hour.weekday)).size !== 7) return null
  const intervals = menu.hours
    .filter((hour) => !hour.isClosed && hour.opensAt && hour.closesAt)
    .map((hour) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: DAYS[hour.weekday],
      opens: hour.opensAt,
      closes: hour.opensAt === hour.closesAt ? '23:59' : hour.closesAt,
    }))
  return intervals.length ? intervals : null
}

function buildRestaurantJsonLd(menu: MenuResponse, canonical: string, image: string | null): Record<string, unknown> {
  const { business } = menu
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    '@id': `${canonical}#restaurant`,
    name: business.name,
    url: canonical,
    menu: `${canonical}#menu`,
  }

  if (business.description) jsonLd.description = business.description
  const telephone = normalizedBrazilianPhone(business.phone) ?? normalizedBrazilianPhone(business.whatsapp)
  if (telephone) jsonLd.telephone = telephone
  const address = structuredAddress(menu)
  if (address) jsonLd.address = address
  const sameAs = [business.instagramUrl, business.facebookUrl].map(safePublicHttpUrl).filter((url): url is string => Boolean(url))
  if (sameAs.length) jsonLd.sameAs = sameAs
  if (image) jsonLd.image = image
  const hours = openingHours(menu)
  if (hours) jsonLd.openingHoursSpecification = hours
  return jsonLd
}

function makeSeoData(
  menu: MenuResponse,
  publicOrigin: string,
  page: { title: string; description: string; canonical: string; image: string | null; jsonLd: Record<string, unknown>; openGraphType: 'website' | 'product' },
): PublicSeoData {
  const base = publicBase(menu, publicOrigin)
  return {
    ...base,
    ...page,
    description: conciseDescription(page.description),
  }
}

export function buildPublicSeo(menu: MenuResponse, publicOrigin: string): PublicSeoData {
  const { business } = menu
  const canonical = new URL('/', publicOrigin).toString()
  const place = [business.addressNeighborhood, business.addressCity].filter(Boolean).join(', ')
  const title = business.seoTitle?.trim() || `${business.name} | Cardápio digital`
  const description = business.seoDescription?.trim()
    || business.description?.trim()
    || `Cardápio digital de ${business.name}${place ? ` em ${place}` : ''}.`
  const image = business.coverImageKey ? new URL(`/media/${business.coverImageKey}`, publicOrigin).toString() : null
  return makeSeoData(menu, publicOrigin, {
    title,
    description,
    canonical,
    image,
    jsonLd: buildRestaurantJsonLd(menu, canonical, image),
    openGraphType: 'website',
  })
}

function variantPrice(variant: Product['variants'][number]): number {
  return variant.promotionalPriceCents ?? variant.priceCents
}

function priceText(priceCents: number): string {
  return (priceCents / 100).toFixed(2)
}

export function buildPublicProductSeo(
  menu: MenuResponse,
  page: PublicProductPageData,
  publicOrigin: string,
): PublicSeoData {
  const { business } = menu
  const { category, product } = page
  const path = publicProductPath(product.id, product.name)
  const canonical = new URL(path, publicOrigin).toString()
  const image = product.imageKey ? new URL(`/media/${product.imageKey}`, publicOrigin).toString() : null
  const title = `${product.name} | ${business.name}`
  const description = product.ingredients?.trim()
    || `${product.name} no cardápio de ${business.name}.`
  const productJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${canonical}#product`,
    name: product.name,
    url: canonical,
    category: category.name,
  }
  if (product.ingredients) productJsonLd.description = product.ingredients
  if (image) productJsonLd.image = image
  const activeVariants = product.variants.filter((variant) => variant.isActive)
  if (activeVariants.length) {
    productJsonLd.offers = activeVariants.map((variant) => ({
      '@type': 'Offer',
      url: canonical,
      priceCurrency: 'BRL',
      price: priceText(variantPrice(variant)),
      availability: product.isAvailable ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      ...(variant.label ? { name: variant.label } : {}),
    }))
  }
  const restaurant = buildRestaurantJsonLd(menu, new URL('/', publicOrigin).toString(), business.coverImageKey
    ? new URL(`/media/${business.coverImageKey}`, publicOrigin).toString()
    : null)
  const seo = makeSeoData(menu, publicOrigin, {
    title,
    description,
    canonical,
    image,
    jsonLd: { '@context': 'https://schema.org', '@graph': [restaurant, productJsonLd] },
    openGraphType: 'product',
  })
  if (!activeVariants.length) seo.robots = 'noindex,follow'
  return seo
}
