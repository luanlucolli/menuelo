import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ArrowRight, BookOpen, CircleOff, Percent, Shapes, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, messageFromError } from '../../lib/api'

interface DashboardData {
  categories: number
  products: number
  unavailable: number
  featured: number
  promotions: number
  pending: { publicSiteUrl: boolean; contacts: boolean; address: boolean; completeHours: boolean }
}

export function DashboardPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: () => api<DashboardData>('/admin/api/dashboard') })
  if (isLoading) return <AdminState message="Carregando visão geral…" />
  if (error || !data) return <AdminState error message={messageFromError(error)} />
  const stats = [
    { label: 'Categorias', value: data.categories, icon: Shapes },
    { label: 'Produtos', value: data.products, icon: BookOpen },
    { label: 'Indisponíveis', value: data.unavailable, icon: CircleOff },
    { label: 'Destaques', value: data.featured, icon: Sparkles },
    { label: 'Promoções', value: data.promotions, icon: Percent },
  ]
  const pending = [
    data.pending.publicSiteUrl && 'Configurar a URL pública',
    data.pending.contacts && 'Adicionar ao menos um contato',
    data.pending.address && 'Adicionar o endereço quando estiver definido',
    data.pending.completeHours && 'Completar a grade de horários',
  ].filter(Boolean) as string[]
  return (
    <div className="admin-page">
      <div className="admin-heading"><div><p>Administração</p><h1>Visão geral</h1><span>Alterações salvas aparecem imediatamente no cardápio.</span></div><a className="secondary-button" href="/" target="_blank" rel="noreferrer">Visualizar cardápio</a></div>
      <div className="stat-grid">{stats.map(({ icon: Icon, ...stat }) => <article key={stat.label}><Icon /><div><strong>{stat.value}</strong><span>{stat.label}</span></div></article>)}</div>
      {pending.length > 0 && <section className="admin-card pending-card"><div className="card-heading"><AlertCircle /><div><h2>Configuração pendente</h2><p>Esses itens não bloqueiam o uso e só aparecem publicamente quando configurados.</p></div></div><ul>{pending.map((item) => <li key={item}>{item}</li>)}</ul><Link to="/admin/configuracoes">Revisar configurações <ArrowRight /></Link></section>}
      <section className="admin-card"><div className="card-heading"><div><h2>Ações rápidas</h2><p>Atalhos para as tarefas mais comuns.</p></div></div><div className="quick-actions"><Link to="/admin/produtos">Adicionar produto <ArrowRight /></Link><Link to="/admin/categorias">Organizar categorias <ArrowRight /></Link><Link to="/admin/qrcode">Baixar QR Code <ArrowRight /></Link></div></section>
    </div>
  )
}

export function AdminState({ message, error = false }: { message: string; error?: boolean }) {
  return <div className={`admin-state${error ? ' error' : ''}`}>{error ? <AlertCircle /> : <span className="spinner" />}<p>{message}</p></div>
}
