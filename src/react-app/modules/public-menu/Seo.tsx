import { useEffect } from 'react'
import type { MenuResponse } from '../../../../shared/schemas'
import { formatStructuredAddress, hasStructuredAddress } from '../../../../shared/utils'

function setMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.append(element)
  }
  element.content = content
}

export function Seo({ menu }: { menu: MenuResponse }) {
  useEffect(() => {
    const business = menu.business
    const title = business.seoTitle || `${business.name} | Cardápio digital`
    const description = business.seoDescription || business.description || `Consulte o cardápio digital da ${business.name}.`
    const canonical = new URL('/', business.publicSiteUrl || window.location.origin).toString()
    document.title = title
    setMeta('meta[name="theme-color"]', 'name', 'theme-color', business.primaryColor)
    setMeta('meta[name="description"]', 'name', 'description', description)
    setMeta('meta[property="og:type"]', 'property', 'og:type', 'restaurant')
    setMeta('meta[property="og:title"]', 'property', 'og:title', title)
    setMeta('meta[property="og:description"]', 'property', 'og:description', description)
    setMeta('meta[property="og:url"]', 'property', 'og:url', canonical)
    if (business.coverImageKey) setMeta('meta[property="og:image"]', 'property', 'og:image', new URL(`/media/${business.coverImageKey}`, canonical).toString())
    else document.head.querySelector('meta[property="og:image"]')?.remove()

    let canonicalLink = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonicalLink) {
      canonicalLink = document.createElement('link')
      canonicalLink.rel = 'canonical'
      document.head.append(canonicalLink)
    }
    canonicalLink.href = canonical

    const completeHours = new Set(menu.hours.map((hour) => hour.weekday)).size === 7
    const jsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': ['Restaurant', 'LocalBusiness'],
      name: business.name,
      url: canonical,
    }
    if (business.description) jsonLd.description = business.description
    if (business.phone) jsonLd.telephone = business.phone
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
    const sameAs = [business.instagramUrl, business.facebookUrl].filter(Boolean)
    if (sameAs.length) jsonLd.sameAs = sameAs
    if (business.coverImageKey) jsonLd.image = new URL(`/media/${business.coverImageKey}`, canonical).toString()
    if (completeHours) {
      jsonLd.openingHoursSpecification = menu.hours.filter((hour) => !hour.isClosed).map((hour) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][hour.weekday],
        opens: hour.opensAt,
        closes: hour.closesAt,
      }))
    }
    let script = document.head.querySelector<HTMLScriptElement>('script[data-menu-json-ld]')
    if (!script) {
      script = document.createElement('script')
      script.type = 'application/ld+json'
      script.dataset.menuJsonLd = 'true'
      document.head.append(script)
    }
    script.text = JSON.stringify(jsonLd)
  }, [menu])
  return null
}
