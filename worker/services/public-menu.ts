import { menuResponseSchema, type MenuResponse } from '../../shared/schemas'
import { getMenu } from '../repositories/menu'

function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.origin
  } catch {
    return null
  }
}

export function resolvePublicOrigin(requestUrl: string, configuredUrl: string): string {
  return normalizeOrigin(configuredUrl) ?? new URL(requestUrl).origin
}

export function preparePublicMenu(menu: MenuResponse, requestUrl: string, configuredUrl: string): MenuResponse {
  const publicSiteUrl = resolvePublicOrigin(requestUrl, configuredUrl)
  return menuResponseSchema.parse({
    ...menu,
    business: { ...menu.business, publicSiteUrl },
  })
}

export async function loadPublicMenu(db: D1Database, requestUrl: string, configuredUrl: string): Promise<MenuResponse> {
  return preparePublicMenu(await getMenu(db), requestUrl, configuredUrl)
}
