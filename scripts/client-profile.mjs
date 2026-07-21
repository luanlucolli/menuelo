import { readFile, realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import { z } from 'zod'

const resourceName = z.string().min(3).max(63).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'use somente letras minúsculas, números e hífens')
const placeholder = /(example|exemplo|substitua|cole-aqui|identificador|sua-equipe|cliente[.-]com)/i
const customDomainRouteSchema = z.object({
  pattern: z.string().min(3),
  customDomain: z.literal(true),
}).strict()
const workersDevRouteSchema = z.object({
  workersDev: z.literal(true),
}).strict()

export const clientProfileSchema = z.object({
  key: resourceName.max(40),
  workerName: resourceName.startsWith('menuelo-', 'o nome do Worker deve começar com menuelo-'),
  database: z.object({
    name: resourceName.startsWith('menuelo-', 'o nome do D1 deve começar com menuelo-'),
    id: z.uuid(),
  }).strict(),
  bucketName: resourceName.startsWith('menuelo-', 'o nome do bucket deve começar com menuelo-'),
  publicSiteUrl: z.url()
    .refine((value) => new URL(value).protocol === 'https:', 'use uma URL HTTPS')
    .refine((value) => {
      const url = new URL(value)
      return url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password
    }, 'informe somente a origem pública, sem caminho, parâmetros ou credenciais'),
  route: z.union([customDomainRouteSchema, workersDevRouteSchema]),
  access: z.object({
    teamDomain: z.url()
      .refine((value) => new URL(value).protocol === 'https:', 'use uma URL HTTPS')
      .refine((value) => new URL(value).hostname.endsWith('.cloudflareaccess.com'), 'use o domínio da equipe do Cloudflare Access')
      .refine((value) => {
        const url = new URL(value)
        return url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password
      }, 'informe somente a origem da equipe do Access'),
    audience: z.string().min(10),
    adminEmails: z.array(z.email()).min(1),
  }).strict(),
}).strict().superRefine((profile, context) => {
  const routeIdentifier = 'pattern' in profile.route ? profile.route.pattern : 'workers.dev'
  const values = [profile.key, profile.workerName, profile.database.name, profile.database.id, profile.bucketName, profile.publicSiteUrl, routeIdentifier, profile.access.teamDomain, profile.access.audience, ...profile.access.adminEmails]
  if (values.some((value) => placeholder.test(value)) || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(profile.database.id)) {
    context.addIssue({ code: 'custom', message: 'o perfil ainda contém valores de exemplo ou marcadores pendentes' })
  }

  const siteHost = new URL(profile.publicSiteUrl).hostname
  if ('pattern' in profile.route) {
    if (profile.route.pattern !== siteHost) {
      context.addIssue({ code: 'custom', path: ['route', 'pattern'], message: `deve ser igual ao domínio público (${siteHost})` })
    }
  } else {
    const labels = siteHost.split('.')
    const validWorkersDevHost = labels.length === 4 && labels[0] === profile.workerName && Boolean(labels[1]) && labels[2] === 'workers' && labels[3] === 'dev'
    if (!validWorkersDevHost) {
      context.addIssue({ code: 'custom', path: ['publicSiteUrl'], message: `para workers.dev, use https://${profile.workerName}.SEU-SUBDOMINIO.workers.dev` })
    }
  }
})

function formatIssues(error) {
  return error.issues.map((issue) => `- ${issue.path.join('.') || 'perfil'}: ${issue.message}`).join('\n')
}

export async function loadClientProfile(profilePath, repositoryRoot) {
  if (!profilePath) throw new Error('Informe o caminho de um perfil de cliente.')
  const absolutePath = isAbsolute(profilePath) ? profilePath : resolve(process.cwd(), profilePath)
  const [realProfilePath, realRepositoryRoot] = await Promise.all([realpath(absolutePath), realpath(repositoryRoot)])
  const fromRepository = relative(realRepositoryRoot, realProfilePath)
  if (fromRepository === '' || (!fromRepository.startsWith('..') && !isAbsolute(fromRepository))) {
    throw new Error('Perfis reais de clientes devem ficar fora do repositório.')
  }

  let raw
  try {
    raw = JSON.parse(await readFile(realProfilePath, 'utf8'))
  } catch (error) {
    throw new Error(`Não foi possível ler o perfil ${realProfilePath}: ${error instanceof Error ? error.message : String(error)}`)
  }
  const parsed = clientProfileSchema.safeParse(raw)
  if (!parsed.success) throw new Error(`Perfil inválido (${realProfilePath}):\n${formatIssues(parsed.error)}`)
  return { path: realProfilePath, value: parsed.data }
}

export function assertDistinctProfiles(profiles) {
  const fields = [
    ['key', (profile) => profile.key],
    ['Worker', (profile) => profile.workerName],
    ['nome do D1', (profile) => profile.database.name],
    ['ID do D1', (profile) => profile.database.id],
    ['bucket R2', (profile) => profile.bucketName],
    ['domínio público', (profile) => new URL(profile.publicSiteUrl).hostname],
    ['AUD do Access', (profile) => profile.access.audience],
  ]

  for (const [label, select] of fields) {
    const seen = new Set()
    for (const profile of profiles) {
      const value = select(profile)
      if (seen.has(value)) throw new Error(`Perfis não estão isolados: ${label} repetido (${value}).`)
      seen.add(value)
    }
  }
}

export function buildWranglerConfig(baseConfig, profile) {
  const config = {
    ...baseConfig,
    name: profile.workerName,
    d1_databases: [{
      binding: 'DB',
      database_name: profile.database.name,
      database_id: profile.database.id,
      migrations_dir: './migrations',
    }],
    r2_buckets: [{ binding: 'MENU_IMAGES', bucket_name: profile.bucketName }],
    vars: {
      DEV_ADMIN_BYPASS: 'false',
      CF_ACCESS_TEAM_DOMAIN: profile.access.teamDomain,
      CF_ACCESS_AUD: profile.access.audience,
      ADMIN_EMAILS: profile.access.adminEmails.join(','),
      PUBLIC_SITE_URL: profile.publicSiteUrl,
    },
  }

  delete config.route
  delete config.routes
  config.preview_urls = false
  if ('pattern' in profile.route) {
    config.workers_dev = false
    config.routes = [{ pattern: profile.route.pattern, custom_domain: true }]
  } else {
    config.workers_dev = true
  }

  return config
}
