import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { requireAdmin, type AppEnvironment } from '../worker/middleware/auth'
import { mediaRoutes, publicRoutes } from '../worker/routes/public'
import { ApiError } from '../worker/lib/http'
import { FakeDatabase, fakeBucket, runtimeEnv, settingsRow } from './fakes'

describe('autenticação administrativa', () => {
  const app = new Hono<AppEnvironment>()
  app.use('*', requireAdmin)
  app.get('/', (c) => c.json({ email: c.get('adminEmail') }))
  app.onError((error, c) => error instanceof ApiError ? c.json({ code: error.code }, error.status) : c.json({ code: 'INTERNAL_ERROR' }, 500))

  it('fecha por padrão até mesmo em localhost', async () => {
    const response = await app.request('http://localhost/', {}, runtimeEnv())
    expect(response.status).toBe(403)
  })

  it('aceita bypass somente em hostname local', async () => {
    const local = await app.request('http://127.0.0.1/', {}, runtimeEnv({ DEV_ADMIN_BYPASS: 'true' }))
    const production = await app.request('https://cardapio.example/', {}, runtimeEnv({ DEV_ADMIN_BYPASS: 'true' }))
    expect(local.status).toBe(200)
    expect(production.status).toBe(403)
  })

  it('rejeita JWT inválido do Access sem expor detalhes', async () => {
    const response = await app.request('https://cardapio.example/', { headers: { 'Cf-Access-Jwt-Assertion': 'token-invalido' } }, runtimeEnv({ CF_ACCESS_TEAM_DOMAIN: 'https://equipe.cloudflareaccess.com', CF_ACCESS_AUD: 'audience' }))
    expect(response.status).toBe(401)
  })
})

describe('handlers críticos com bindings simulados', () => {
  it('retorna o cardápio agregado e cache curto', async () => {
    const database = new FakeDatabase({ settings: settingsRow, categories: [{ id: 'cat', name: 'Dogs', slug: 'dogs', description: null, is_active: 1, sort_order: 0, created_at: 'now', updated_at: 'now' }] })
    const response = await publicRoutes.request('http://localhost/menu', {}, runtimeEnv({ DB: database.asBinding() }))
    const body = await response.json() as { categories: unknown[] }
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toContain('max-age=60')
    expect(body.categories).toHaveLength(1)
  })

  it('bloqueia uma chave R2 arbitrária antes de consultar o bucket', async () => {
    const bucket = fakeBucket()
    const response = await mediaRoutes.request('http://localhost/../../segredo', {}, runtimeEnv({ MENU_IMAGES: bucket }))
    expect(response.status).toBe(400)
    expect(bucket.get).not.toHaveBeenCalled()
  })
})
