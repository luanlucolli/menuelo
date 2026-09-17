import { BookOpen, ChartNoAxesColumn, Menu, QrCode, Settings, Shapes, X } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { DEFAULT_PRIMARY_COLOR } from '../../../../shared/schemas'
import { readableBrandText } from '../../../../shared/utils'
import { cn, focusRing } from '../../lib/tailwind'
import { useAdminMenu } from './hooks'

const links = [
  { to: '/admin', label: 'Início', icon: ChartNoAxesColumn, end: true },
  { to: '/admin/produtos', label: 'Produtos', icon: BookOpen },
  { to: '/admin/categorias', label: 'Categorias', icon: Shapes },
  { to: '/admin/configuracoes', label: 'Configurações', icon: Settings },
  { to: '/admin/qrcode', label: 'QR Code', icon: QrCode },
]

export function AdminLayout() {
  const { data } = useAdminMenu()
  const [open, setOpen] = useState(false)
  const [desktop, setDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    const update = () => setDesktop(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!open) return
    closeButtonRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      requestAnimationFrame(() => menuButtonRef.current?.focus())
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [open])

  const closeMenu = () => {
    setOpen(false)
    requestAnimationFrame(() => menuButtonRef.current?.focus())
  }

  const businessName = data?.business.name || 'Administração do cardápio'
  const brandColor = data?.business.primaryColor || DEFAULT_PRIMARY_COLOR
  const brandTheme = {
    '--color-brand': brandColor,
    '--color-brand-text': readableBrandText(brandColor),
  } as CSSProperties
  const businessInitial = businessName.trim().charAt(0).toLocaleUpperCase('pt-BR') || 'A'

  return (
    <div className="min-h-[100dvh] bg-admin-background" style={brandTheme}>
      <header className="sticky top-0 z-[60] flex h-16 items-center gap-2 border-b border-border bg-surface-strong px-4 lg:hidden">
        <button
          className={`grid h-11 w-11 cursor-pointer place-items-center rounded-[.6rem] bg-transparent ${focusRing}`}
          ref={menuButtonRef}
          type="button"
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={open}
          aria-controls="admin-sidebar"
          onClick={() => open ? closeMenu() : setOpen(true)}
        >
          <Menu />
        </button>
        <strong className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{businessName} · Administração</strong>
      </header>
      {open && <button type="button" className={`fixed inset-0 z-[69] cursor-pointer border-0 bg-[rgb(24_20_17_/_55%)] ${focusRing}`} aria-label="Fechar menu" onClick={closeMenu} />}
      <aside id="admin-sidebar" className={cn('fixed inset-y-0 left-0 z-[70] flex w-[min(18rem,86vw)] -translate-x-[102%] flex-col gap-6 bg-[#292520] p-[1.1rem] text-[#eeeae4] transition-transform duration-200 ease-in-out motion-reduce:transition-none lg:w-[16.5rem] lg:translate-x-0', open && 'translate-x-0')} aria-hidden={!desktop && !open} inert={!desktop && !open ? true : undefined}>
        <div className="flex items-center justify-between gap-[.6rem]"><div className="flex items-center gap-3 p-[.35rem]"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-[.75rem] bg-[var(--color-brand)] font-[900] text-[var(--color-brand-text)]">{businessInitial}</span><div className="grid min-w-0"><strong className="overflow-hidden text-ellipsis whitespace-nowrap">{businessName}</strong><small className="text-[#aaa39a]">Administração</small></div></div><button ref={closeButtonRef} className={`inline-flex min-h-11 cursor-pointer items-center gap-[.35rem] rounded-[.55rem] border border-[#5b5249] bg-transparent px-[.65rem] py-[.55rem] font-[700] text-white lg:hidden ${focusRing}`} type="button" onClick={closeMenu}><X className="w-4" /> <span>Fechar</span></button></div>
        <nav className="grid gap-1" aria-label="Navegação administrativa">
          {links.map(({ icon: Icon, ...link }) => <NavLink key={link.to} to={link.to} end={link.end} onClick={closeMenu} className={({ isActive }) => cn('flex min-h-[46px] items-center gap-3 rounded-[.65rem] px-[.8rem] py-[.65rem] font-[650] text-[#cfc8c0] no-underline', isActive && 'bg-[#443d36] text-white', focusRing)}><Icon className="w-[1.2rem]" />{link.label}</NavLink>)}
        </nav>
        <a className={`mt-auto rounded-[.65rem] border border-[#5b5249] p-3 text-center font-[700] no-underline ${focusRing}`} href="/" target="_blank" rel="noreferrer">Visualizar cardápio</a>
      </aside>
      <main className="min-w-0 px-4 pb-16 pt-[1.2rem] lg:ml-[16.5rem] lg:px-8 lg:pb-20 lg:pt-[2.2rem]"><Outlet /></main>
    </div>
  )
}
