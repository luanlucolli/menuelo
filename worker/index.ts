import { Hono } from 'hono'
import { ApiError, errorJson } from './lib/http'
import type { AppEnvironment } from './middleware/auth'
import { mediaRoutes, publicRoutes } from './routes/public'
import { adminRoutes } from './routes/admin'
import { servePublicPage, serveRobots, serveSitemap } from './routes/public-page'

const app = new Hono<AppEnvironment>()

app.get('/', servePublicPage)
app.on('HEAD', '/', servePublicPage)
app.get('/robots.txt', serveRobots)
app.get('/sitemap.xml', serveSitemap)
app.route('/api', publicRoutes)
app.route('/media', mediaRoutes)
app.route('/admin/api', adminRoutes)

app.notFound((c) => c.json({ code: 'NOT_FOUND', message: 'Rota não encontrada.' }, 404))

app.onError((error, c) => {
  if (error instanceof ApiError) return errorJson(c, error)
  console.error(JSON.stringify({ message: 'request failed', error: error instanceof Error ? error.message : String(error), path: c.req.path }))
  return c.json({ code: 'INTERNAL_ERROR', message: 'Não foi possível concluir a solicitação.' }, 500)
})

export default app
