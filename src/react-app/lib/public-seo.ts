import type { PublicSeoData } from '../../../shared/public-seo'

function setMeta(selector: string, attribute: 'name' | 'property', key: string, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.appendChild(element)
  }
  element.content = content
}

function setOptionalMeta(selector: string, attribute: 'name' | 'property', key: string, content: string | null): void {
  if (content) setMeta(selector, attribute, key, content)
  else document.head.querySelector(selector)?.remove()
}

export function applyPublicSeo(seo: PublicSeoData): void {
  document.title = seo.title
  setMeta('meta[name="theme-color"]', 'name', 'theme-color', seo.themeColor)
  setMeta('meta[name="description"]', 'name', 'description', seo.description)
  setMeta('meta[name="robots"]', 'name', 'robots', seo.robots)
  setMeta('meta[property="og:type"]', 'property', 'og:type', seo.openGraphType)
  setMeta('meta[property="og:title"]', 'property', 'og:title', seo.title)
  setMeta('meta[property="og:description"]', 'property', 'og:description', seo.description)
  setMeta('meta[property="og:url"]', 'property', 'og:url', seo.canonical)
  setMeta('meta[property="og:site_name"]', 'property', 'og:site_name', seo.siteName)
  setMeta('meta[property="og:locale"]', 'property', 'og:locale', seo.locale)
  setOptionalMeta('meta[property="og:image"]', 'property', 'og:image', seo.image)
  setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', seo.twitterCard)
  setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', seo.title)
  setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', seo.description)
  setOptionalMeta('meta[name="twitter:image"]', 'name', 'twitter:image', seo.image)

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.appendChild(canonical)
  }
  canonical.href = seo.canonical

  const favicon = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (seo.favicon) {
    const icon = favicon ?? document.createElement('link')
    icon.rel = 'icon'
    icon.type = 'image/x-icon'
    icon.sizes = 'any'
    icon.href = seo.favicon
    if (!favicon) document.head.appendChild(icon)
  } else {
    favicon?.remove()
  }

  let jsonLd = document.head.querySelector<HTMLScriptElement>('script[data-menu-json-ld]')
  if (!jsonLd) {
    jsonLd = document.createElement('script')
    jsonLd.type = 'application/ld+json'
    jsonLd.dataset.menuJsonLd = 'true'
    document.head.appendChild(jsonLd)
  }
  jsonLd.text = JSON.stringify(seo.jsonLd)
}
