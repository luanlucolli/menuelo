import { createRemoteJWKSet, jwtVerify } from 'jose'
import { createMiddleware } from 'hono/factory'
import { ApiError } from '../lib/http'

export type RuntimeEnv = Omit<Env, 'DEV_ADMIN_BYPASS' | 'CF_ACCESS_TEAM_DOMAIN' | 'CF_ACCESS_AUD' | 'ADMIN_EMAILS' | 'PUBLIC_SITE_URL' | 'PUBLIC_SSR_ENABLED'> & {
  DEV_ADMIN_BYPASS: string
  CF_ACCESS_TEAM_DOMAIN: string
  CF_ACCESS_AUD: string
  ADMIN_EMAILS: string
  PUBLIC_SITE_URL: string
  PUBLIC_SSR_ENABLED: string
}

export type AppEnvironment = {
  Bindings: RuntimeEnv
  Variables: { adminEmail: string }
}

export function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  return normalized === 'localhost' || normalized.endsWith('.localhost') || normalized === '::1' || normalized === '0.0.0.0' || normalized.startsWith('127.')
}

function normalizeTeamDomain(value: string): string {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`
  return withProtocol.replace(/\/$/, '')
}

export const requireAdmin = createMiddleware<AppEnvironment>(async (c, next) => {
  const hostname = new URL(c.req.url).hostname
  if (String(c.env.DEV_ADMIN_BYPASS) === 'true' && isLocalHostname(hostname)) {
    c.set('adminEmail', 'desenvolvimento@localhost')
    await next()
    return
  }

  const teamDomain = c.env.CF_ACCESS_TEAM_DOMAIN
  const audience = c.env.CF_ACCESS_AUD
  const allowedEmails = (c.env.ADMIN_EMAILS ?? '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean)
  if (!teamDomain || !audience || allowedEmails.length === 0) {
    throw new ApiError(403, 'ACCESS_NOT_CONFIGURED', 'A proteção administrativa não está configurada.')
  }

  const token = c.req.header('Cf-Access-Jwt-Assertion')
  if (!token) throw new ApiError(401, 'ACCESS_TOKEN_REQUIRED', 'Autenticação do Cloudflare Access obrigatória.')

  try {
    const issuer = normalizeTeamDomain(teamDomain)
    const jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`))
    const { payload } = await jwtVerify(token, jwks, { issuer, audience })
    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : ''
    if (!email || !allowedEmails.includes(email)) {
      throw new ApiError(403, 'EMAIL_NOT_ALLOWED', 'Este e-mail não tem acesso ao painel.')
    }
    c.set('adminEmail', email)
    await next()
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(401, 'INVALID_ACCESS_TOKEN', 'Token do Cloudflare Access inválido ou expirado.')
  }
})
