import { describe, expect, it } from 'vitest'
import { publicMenuBootstrapSchema } from '../shared/schemas'
import { serializeJsonForHtml } from '../shared/safe-json'
import { publicMenuFixture } from './public-fixture'

describe('bootstrap público', () => {
  it('neutraliza sequências capazes de encerrar scripts', () => {
    const input = { value: '</script><script>alert(1)</script>&\u2028\u2029' }
    const serialized = serializeJsonForHtml(input)
    expect(serialized).not.toContain('<')
    expect(serialized).not.toContain('&')
    expect(JSON.parse(serialized)).toEqual(input)
  })

  it('valida o contrato versionado da hidratação', () => {
    const parsed = publicMenuBootstrapSchema.safeParse({
      schemaVersion: 1,
      menu: publicMenuFixture(),
      renderedAt: '2026-07-21T01:00:00.000Z',
      initialClock: { weekday: 1, minutes: 1320 },
    })
    expect(parsed.success).toBe(true)
  })
})
