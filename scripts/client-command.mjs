import { readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { assertDistinctProfiles, buildWranglerConfig, loadClientProfile } from './client-profile.mjs'

const repositoryRoot = resolve(import.meta.dirname, '..')
const operation = process.argv[2]
const profilePaths = process.argv.slice(3)
const operations = new Set(['check', 'build', 'dry-run', 'migrate', 'deploy'])

if (!operations.has(operation)) {
  throw new Error('Operação inválida. Use check, build, dry-run, migrate ou deploy.')
}
if (profilePaths.length === 0) throw new Error('Informe ao menos um perfil externo de cliente.')
if (operation !== 'check' && profilePaths.length !== 1) throw new Error(`A operação ${operation} aceita exatamente um perfil por vez.`)

const loadedProfiles = await Promise.all(profilePaths.map((profilePath) => loadClientProfile(profilePath, repositoryRoot)))
const profiles = loadedProfiles.map(({ value }) => value)
assertDistinctProfiles(profiles)

if (operation === 'check') {
  for (const profile of profiles) console.log(`✓ ${profile.key}: ${profile.workerName} → ${new URL(profile.publicSiteUrl).hostname}`)
  console.log(`${profiles.length} perfil(is) válido(s) e isolado(s).`)
  process.exit(0)
}

const profile = profiles[0]
const baseConfig = JSON.parse(await readFile(resolve(repositoryRoot, 'wrangler.jsonc'), 'utf8'))
const generatedConfig = buildWranglerConfig(baseConfig, profile)
const temporaryConfigPath = resolve(repositoryRoot, `.wrangler.client.${profile.key}.${process.pid}.json`)

function run(command, args, environment = process.env) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: repositoryRoot, env: environment, stdio: 'inherit', shell: false })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`${command} terminou com ${signal ? `sinal ${signal}` : `código ${code}`}.`))
    })
  })
}

async function findGeneratedConfig(workerName) {
  const distPath = resolve(repositoryRoot, 'dist')
  const entries = await readdir(distPath, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const candidate = resolve(distPath, entry.name, 'wrangler.json')
    try {
      const config = JSON.parse(await readFile(candidate, 'utf8'))
      if (config.name === workerName) return candidate
    } catch {
      // A pasta pode pertencer a outro artefato de build.
    }
  }
  throw new Error(`O build não gerou a configuração do Worker ${workerName}.`)
}

async function build() {
  const environment = { ...process.env, CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH: temporaryConfigPath }
  await run('npm', ['run', 'build'], environment)
  return findGeneratedConfig(profile.workerName)
}

await writeFile(temporaryConfigPath, `${JSON.stringify(generatedConfig, null, 2)}\n`, { flag: 'wx' })
try {
  if (operation === 'migrate') {
    await run('npx', ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--remote', '--config', temporaryConfigPath])
  } else {
    const outputConfigPath = await build()
    if (operation === 'dry-run') await run('npx', ['wrangler', 'deploy', '--dry-run', '--config', outputConfigPath])
    if (operation === 'deploy') await run('npx', ['wrangler', 'deploy', '--config', outputConfigPath])
  }
} finally {
  await unlink(temporaryConfigPath).catch(() => undefined)
}
