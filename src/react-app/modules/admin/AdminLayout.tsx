import { BookOpen, ChartNoAxesColumn, Download, Menu, QrCode, Settings, Shapes, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/admin', label: 'Início', icon: ChartNoAxesColumn, end: true },
  { to: '/admin/produtos', label: 'Produtos', icon: BookOpen },
  { to: '/admin/categorias', label: 'Categorias', icon: Shapes },
  { to: '/admin/configuracoes', label: 'Configurações', icon: Settings },
  { to: '/admin/importar-exportar', label: 'Cópia de segurança', icon: Download },
  { to: '/admin/qrcode', label: 'QR Code', icon: QrCode },
]

export function AdminLayout() {
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

  return (
    <div className="admin-shell">
      <header className="admin-mobile-header">
        <button
          ref={menuButtonRef}
          type="button"
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={open}
          aria-controls="admin-sidebar"
          onClick={() => open ? closeMenu() : setOpen(true)}
        >
          <Menu />
        </button>
        <strong>Pipo · Administração</strong>
      </header>
      {open && <button type="button" className="admin-nav-backdrop" aria-label="Fechar menu" onClick={closeMenu} />}
      <aside id="admin-sidebar" className={`admin-sidebar${open ? ' open' : ''}`} aria-hidden={!desktop && !open} inert={!desktop && !open ? true : undefined}>
        <div className="admin-sidebar-heading"><div className="admin-brand"><span>P</span><div><strong>Pipo</strong><small>Administração</small></div></div><button ref={closeButtonRef} className="sidebar-close" type="button" onClick={closeMenu}><X /> <span>Fechar</span></button></div>
        <nav aria-label="Navegação administrativa">
          {links.map(({ icon: Icon, ...link }) => <NavLink key={link.to} to={link.to} end={link.end} onClick={closeMenu}><Icon />{link.label}</NavLink>)}
        </nav>
        <a className="view-menu-link" href="/" target="_blank" rel="noreferrer">Visualizar cardápio</a>
      </aside>
      <main className="admin-main"><Outlet /></main>
    </div>
  )
}
