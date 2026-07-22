import { Hono } from 'hono'
import { z } from 'zod'
import { getMenu } from '../repositories/menu'
import type { AppEnvironment } from '../middleware/auth'
import { preparePublicMenu } from '../services/public-menu'

export const publicRoutes = new Hono<AppEnvironment>()

publicRoutes.get('/menu', async (c) => {
  const menu = preparePublicMenu(await getMenu(c.env.DB), c.req.url, c.env.PUBLIC_SITE_URL)
  c.header('Cache-Control', 'public, max-age=30, s-maxage=60, must-revalidate')
  return c.json(menu)
})

export const mediaRoutes = new Hono<AppEnvironment>()

mediaRoutes.get('/*', async (c) => {
  const parsedKey = z.string().regex(/^(products|covers)\/[0-9a-f-]+\.webp$|^favicons\/[0-9a-f-]+\.ico$/).safeParse(c.req.path.replace(/^\/media\//, ''))
  if (!parsedKey.success) return c.json({ code: 'INVALID_MEDIA_KEY', message: 'Imagem inválida.' }, 400)
  const key = parsedKey.data
  const object = await c.env.MENU_IMAGES.get(key)
  if (!object) return c.json({ code: 'MEDIA_NOT_FOUND', message: 'Imagem não encontrada.' }, 404)
  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('Content-Type', key.startsWith('favicons/') ? 'image/x-icon' : 'image/webp')
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  headers.set('X-Content-Type-Options', 'nosniff')
  if (object.httpEtag) headers.set('ETag', object.httpEtag)
  return new Response(object.body, { headers })
})
