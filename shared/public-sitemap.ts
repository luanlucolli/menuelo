import type { MenuResponse } from './schemas'
import { hasIndexableMenuContent, publicProductPath } from './public-seo'

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

export function buildPublicSitemap(menu: MenuResponse, publicOrigin: string): string {
  const urls: string[] = []
  if (hasIndexableMenuContent(menu)) {
    urls.push(new URL('/', publicOrigin).toString())
    for (const category of menu.categories) {
      if (!category.isActive) continue
      for (const product of category.products) {
        if (product.variants.some((variant) => variant.isActive)) {
          urls.push(new URL(publicProductPath(product.id, product.name), publicOrigin).toString())
        }
      }
    }
  }
  const entries = urls.map((url) => `<url><loc>${escapeXml(url)}</loc></url>`).join('')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`
}

export function buildPublicRobotsTxt(publicOrigin: string): string {
  return `User-agent: *\nAllow: /\nDisallow: /admin$\nDisallow: /admin/\nSitemap: ${publicOrigin}/sitemap.xml\n`
}
