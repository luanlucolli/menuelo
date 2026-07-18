import { BookOpen, ChartNoAxesColumn, Download, Menu, QrCode, Settings, Shapes, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/admin', label: 'Visão geral', icon: ChartNoAxesColumn, end: true },
  { to: '/admin/produtos', label: 'Produtos', icon: BookOpen },
  { to: '/admin/categorias', label: 'Categorias', icon: Shapes },
  { to: '/admin/configuracoes', label: 'Configurações', icon: Settings },
  { to: '/admin/importar-exportar', label: 'Importar e exportar', icon: Download },
  { to: '/admin/qrcode', label: 'QR Code', icon: QrCode },
]

export function AdminLayout() {
  const [open, setOpen] = useState(false)
  return (
    <div className="admin-shell">
      <header className="admin-mobile-header">
        <strong>Pipo · Administração</strong>
        <button type="button" aria-label={open ? 'Fechar menu' : 'Abrir menu'} onClick={() => setOpen((value) => !value)}>{open ? <X /> : <Menu />}</button>
      </header>
      {open && <button type="button" className="admin-nav-backdrop" aria-label="Fechar menu" onClick={() => setOpen(false)} />}
      <aside className={`admin-sidebar${open ? ' open' : ''}`}>
        <div className="admin-brand"><span>P</span><div><strong>Pipo</strong><small>Administração</small></div></div>
        <nav aria-label="Navegação administrativa">
          {links.map(({ icon: Icon, ...link }) => <NavLink key={link.to} to={link.to} end={link.end} onClick={() => setOpen(false)}><Icon />{link.label}</NavLink>)}
        </nav>
        <a className="view-menu-link" href="/" target="_blank" rel="noreferrer">Visualizar cardápio</a>
      </aside>
      <main className="admin-main"><Outlet /></main>
    </div>
  )
}
