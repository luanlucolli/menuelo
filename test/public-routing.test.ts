import { describe, expect, it, vi } from 'vitest'
import app from '../worker/index'

function appEnvironment(assets = { fetch: vi.fn(async () => new Response('<!doctype html><html><head></head><body><div id="root"></div></body></html>', { headers: { 'Content-Type': 'text/html' } })) }) {
  return {
    ASSETS: assets,
    DEV_ADMIN_BYPASS: 'false',
    CF_ACCESS_TEAM_DOMAIN: '',
    CF_ACCESS_AUD: '',
    ADMIN_EMAILS: '',
    PUBLIC_SITE_URL: '',
    PUBLIC_SSR_ENABLED: 'true',
  } as unknown as Env
}

describe('rotas e indexação HTTP', () => {
  it('redireciona GET e HEAD de /index.html permanentemente para a homepage', async () => {
    const get = await app.request('https://menu.exemplo.com.br/index.html')
    const head = await app.request('https://menu.exemplo.com.br/index.html', { method: 'HEAD' })
    expect(get.status).toBe(308)
    expect(get.headers.get('Location')).toBe('/')
    expect(head.status).toBe(308)
    expect(await head.text()).toBe('')
  })

  it('retorna 404 HTML não indexável para caminhos públicos inexistentes, também em HEAD', async () => {
    const env = appEnvironment()
    const get = await app.request('https://menu.exemplo.com.br/rota-inexistente', { headers: { Accept: 'text/html' } }, env)
    const head = await app.request('https://menu.exemplo.com.br/rota-inexistente', { method: 'HEAD', headers: { Accept: 'text/html' } }, env)
    expect(get.status).toBe(404)
    expect(get.headers.get('Content-Type')).toContain('text/html')
    expect(get.headers.get('X-Robots-Tag')).toBe('noindex, follow')
    expect(await get.text()).toContain('Página não encontrada')
    expect(head.status).toBe(404)
    expect(await head.text()).toBe('')
  })

  it('serve os documentos do painel com noindex e preserva a autenticação da API', async () => {
    const assets = { fetch: vi.fn(async () => new Response('<!doctype html><html><head></head><body><div id="root"></div></body></html>', { headers: { 'Content-Type': 'text/html' } })) }
    const env = appEnvironment(assets)
    const page = await app.request('https://menu.exemplo.com.br/admin/configuracoes', {}, env)
    expect(page.status).toBe(200)
    expect(page.headers.get('X-Robots-Tag')).toBe('noindex, nofollow')
    expect(await page.text()).toContain('id="root"')
    expect(assets.fetch).toHaveBeenCalledTimes(1)

    const api = await app.request('https://menu.exemplo.com.br/admin/api/settings', { headers: { Accept: 'application/json' } }, env)
    expect(api.status).toBe(403)
    expect(await api.json()).toMatchObject({ code: 'ACCESS_NOT_CONFIGURED' })
    expect(assets.fetch).toHaveBeenCalledTimes(1)
  })
})
