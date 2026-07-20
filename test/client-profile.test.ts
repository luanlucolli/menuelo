import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = resolve(import.meta.dirname, '..')
const commandPath = resolve(repositoryRoot, 'scripts/client-command.mjs')

function profile(key: string, index: number) {
  return {
    key,
    workerName: `menuelo-${key}`,
    database: {
      name: `menuelo-${key}-db`,
      id: `${index}${index}${index}${index}${index}${index}${index}${index}-${index}${index}${index}${index}-4${index}${index}${index}-8${index}${index}${index}-${index}${index}${index}${index}${index}${index}${index}${index}${index}${index}${index}${index}`,
    },
    bucketName: `menuelo-${key}-images`,
    publicSiteUrl: `https://cardapio.${key}.com.br`,
    route: { pattern: `cardapio.${key}.com.br`, customDomain: true },
    access: {
      teamDomain: `https://equipe-${key}.cloudflareaccess.com`,
      audience: `audience-${key}-segura`,
      adminEmails: [`admin@${key}.com.br`],
    },
  }
}

async function withProfiles(run: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(resolve(tmpdir(), 'menuelo-profiles-'))
  try {
    await run(directory)
  } finally {
    await rm(directory, { recursive: true })
  }
}

describe('perfis externos de cliente', () => {
  it('valida duas instâncias completamente isoladas', async () => {
    await withProfiles(async (directory) => {
      const firstPath = resolve(directory, 'padaria-sol.json')
      const secondPath = resolve(directory, 'cantina-lua.json')
      await writeFile(firstPath, JSON.stringify(profile('padaria-sol', 1)))
      await writeFile(secondPath, JSON.stringify(profile('cantina-lua', 2)))

      const output = execFileSync(process.execPath, [commandPath, 'check', firstPath, secondPath], { cwd: repositoryRoot, encoding: 'utf8' })
      expect(output).toContain('2 perfil(is) válido(s) e isolado(s).')
    })
  })

  it('recusa recurso compartilhado entre clientes', async () => {
    await withProfiles(async (directory) => {
      const first = profile('padaria-sol', 1)
      const second = profile('cantina-lua', 2)
      second.bucketName = first.bucketName
      const firstPath = resolve(directory, 'padaria-sol.json')
      const secondPath = resolve(directory, 'cantina-lua.json')
      await writeFile(firstPath, JSON.stringify(first))
      await writeFile(secondPath, JSON.stringify(second))

      expect(() => execFileSync(process.execPath, [commandPath, 'check', firstPath, secondPath], { cwd: repositoryRoot, stdio: 'pipe' })).toThrow()
    })
  })

  it('recusa perfis reais armazenados dentro do repositório', () => {
    expect(() => execFileSync(process.execPath, [commandPath, 'check', resolve(repositoryRoot, 'deploy/client-profile.example.json')], { cwd: repositoryRoot, stdio: 'pipe' })).toThrow()
  })
})
