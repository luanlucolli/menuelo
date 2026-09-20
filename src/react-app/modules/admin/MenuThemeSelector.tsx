import type { Ref } from 'react'
import { DEFAULT_MENU_THEME, MENU_THEMES, type MenuTheme } from '../../../../shared/schemas'
import { cn } from '../../lib/tailwind'

const themeDetails: Record<MenuTheme, { label: string; description: string }> = {
  classic: {
    label: 'Clássico',
    description: 'Visual atual do cardápio',
  },
  rustic: {
    label: 'Rústico',
    description: 'Madeira e tons quentes',
  },
}

function ThemePreview({ theme }: { theme: MenuTheme }) {
  if (theme === 'rustic') {
    return <div className="relative grid h-[7.5rem] overflow-hidden rounded-[.65rem] border border-[#7d4925] bg-[repeating-linear-gradient(0deg,transparent_0_19px,rgb(255_224_178_/_5%)_20px_21px),linear-gradient(115deg,#170c07,#351a0e_48%,#211108)] p-3 shadow-[inset_0_1px_rgb(255_255_255_/_10%)]" aria-hidden="true">
      <div className="self-start rounded-[.4rem] border border-[#a46735] bg-[linear-gradient(100deg,#c88948,#d6a05f_45%,#c88948)] px-2 py-1.5 shadow-[inset_0_1px_rgb(255_255_255_/_25%),0_3px_7px_rgb(0_0_0_/_28%)]">
        <span className="block h-1.5 w-16 rounded-full bg-[#2e190e]/75" />
        <span className="mt-1 block h-1 w-10 rounded-full bg-[#694125]/55" />
      </div>
      <div className="mt-2 grid grid-cols-[1fr_2.2rem] gap-2 rounded-[.45rem] border border-[#7d4925] bg-[linear-gradient(105deg,#351a0e,#422313)] p-2 shadow-[inset_0_1px_rgb(255_255_255_/_8%)]">
        <span className="grid content-center gap-1"><i className="block h-1.5 w-14 rounded-full bg-[#fff7e8]" /><i className="block h-1 w-10 rounded-full bg-[#dbc09b]/70" /><i className="mt-1 block h-1.5 w-8 rounded-full bg-[#f2b653]" /></span>
        <i className="block aspect-square rounded-[.35rem] bg-[#f2e2ca]/85" />
      </div>
    </div>
  }

  return <div className="grid h-[7.5rem] overflow-hidden rounded-[.65rem] border border-[#ddd7ce] bg-[#f7f6f3]" aria-hidden="true">
    <div className="h-8 bg-[linear-gradient(135deg,var(--color-brand),color-mix(in_srgb,var(--color-brand)_55%,#211f1c))]" />
    <div className="grid gap-2 p-2.5">
      <span className="h-4 rounded-[.35rem] border border-[#e5e0d9] bg-white" />
      <span className="grid grid-cols-[1fr_2.2rem] gap-2 rounded-[.4rem] border border-[#e5e0d9] bg-white p-2"><i className="grid content-center gap-1"><b className="block h-1.5 w-14 rounded-full bg-[#393632]" /><b className="block h-1 w-10 rounded-full bg-[#aaa39a]" /></i><i className="block aspect-square rounded-[.3rem] bg-[#e9e4dc]" /></span>
    </div>
  </div>
}

export function MenuThemeSelector({
  value = DEFAULT_MENU_THEME,
  onChange,
  onBlur,
  inputRef,
}: {
  value?: MenuTheme
  onChange: (theme: MenuTheme) => void
  onBlur?: () => void
  inputRef?: Ref<HTMLInputElement>
}) {
  return <fieldset className="m-0 min-w-0 border-0 p-0" aria-describedby="menu-theme-help">
    <legend className="text-[1.1rem] font-[800]">Tema do cardápio</legend>
    <p className="mb-4 mt-1 text-[.88rem] text-muted" id="menu-theme-help">Escolha como o cardápio será exibido para os clientes.</p>
    <div className="grid gap-3 min-[650px]:grid-cols-2">
      {MENU_THEMES.map((theme, index) => {
        const selected = value === theme
        const details = themeDetails[theme]
        return <label className={cn('grid min-w-0 cursor-pointer gap-3 rounded-[.8rem] border bg-surface-strong p-3 transition-[border-color,box-shadow] duration-150 has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-[var(--color-brand)] has-[:focus-visible]:outline-offset-2 motion-reduce:transition-none', selected ? 'border-[var(--color-brand)] shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-brand)_18%,transparent)]' : 'border-border hover:border-[color-mix(in_srgb,var(--color-brand)_48%,var(--color-border))]')} key={theme}>
          <input
            className="sr-only"
            type="radio"
            name="theme"
            value={theme}
            checked={selected}
            onChange={() => onChange(theme)}
            onBlur={onBlur}
            ref={index === 0 ? inputRef : undefined}
          />
          <ThemePreview theme={theme} />
          <span className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
            <span className="grid min-w-0 gap-0.5"><strong className="text-[.95rem]">{details.label}</strong><small className="text-[.78rem] text-muted">{details.description}</small></span>
            <strong className={cn('text-[.72rem] font-[800]', selected ? 'text-[var(--color-brand-strong)]' : 'text-muted')}>{selected ? 'Selecionado' : 'Selecionar'}</strong>
          </span>
        </label>
      })}
    </div>
  </fieldset>
}
