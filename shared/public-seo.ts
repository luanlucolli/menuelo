import type { MenuResponse } from './schemas'
import { formatStructuredAddress, hasStructuredAddress } from './utils'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

export interface PublicSeoData {
  title: string
  description: string
  canonical: string
  themeColor: string
  image: string | null
  favicon: string | null
  jsonLd: Record<string, unknown>
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

export function buildPublicSeo(menu: MenuResponse, publicOrigin: string): PublicSeoData {
  const { business } = menu
  const canonical = new URL('/', publicOrigin).toString()
  const title = business.seoTitle || `${business.name} | Cardápio digital`
  const description = business.seoDescription || business.description || `Consulte o cardápio digital da ${business.name}.`
  const image = business.coverImageKey ? new URL(`/media/${business.coverImageKey}`, canonical).toString() : null
  const favicon = business.faviconKey ? new URL(`/media/${business.faviconKey}`, canonical).toString() : null
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: business.name,
    url: canonical,
  }

  if (business.description) jsonLd.description = business.description
  if (business.phone || business.whatsapp) jsonLd.telephone = business.phone || business.whatsapp
  const formattedAddress = formatStructuredAddress(business) ?? business.address
  if (formattedAddress) {
    jsonLd.address = hasStructuredAddress(business) ? {
      '@type': 'PostalAddress',
      streetAddress: [business.addressStreet, business.addressNumber, business.addressComplement].filter(Boolean).join(', '),
      addressLocality: business.addressCity,
      addressRegion: business.addressState,
      postalCode: business.addressPostalCode,
      addressCountry: 'BR',
    } : { '@type': 'PostalAddress', streetAddress: formattedAddress }
  }
  const sameAs = [business.instagramUrl, business.facebookUrl].map(safePublicHttpUrl).filter((url): url is string => Boolean(url))
  if (sameAs.length) jsonLd.sameAs = sameAs
  if (image) jsonLd.image = image
  if (new Set(menu.hours.map((hour) => hour.weekday)).size === 7) {
    jsonLd.openingHoursSpecification = menu.hours.filter((hour) => !hour.isClosed && hour.opensAt && hour.closesAt).map((hour) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: DAYS[hour.weekday],
      opens: hour.opensAt,
      closes: hour.closesAt,
    }))
  }

  return { title, description, canonical, themeColor: business.primaryColor, image, favicon, jsonLd }
}
