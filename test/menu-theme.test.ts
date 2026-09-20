import { describe, expect, it } from 'vitest'
import { DEFAULT_MENU_THEME, MENU_THEMES, menuThemeSchema } from '../shared/schemas'

describe('temas do cardápio', () => {
  it.each(MENU_THEMES)('aceita o tema %s', (theme) => {
    expect(menuThemeSchema.safeParse(theme).success).toBe(true)
  })

  it('rejeita um tema desconhecido', () => {
    expect(menuThemeSchema.safeParse('neon').success).toBe(false)
  })

  it('mantém o clássico como padrão de compatibilidade', () => {
    expect(DEFAULT_MENU_THEME).toBe('classic')
  })
})
