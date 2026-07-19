import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ArrowRight, BookOpen, CircleOff, Eye, Percent, Plus, Shapes, Sparkles } from 'lucide-react'
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
  const { data, isLoading, error, refetch, isFetching } = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: () => api<DashboardData>('/admin/api/dashboard') })
  if (isLoading) return <AdminState message="Carregando visão geral…" />
  if (error || !data) return <AdminState error message={messageFromError(error)} onRetry={() => void refetch()} retrying={isFetching} />
  const stats = [
    { label: 'Categorias', value: data.categories, icon: Shapes, to: '/admin/categorias' },
    { label: 'Produtos', value: data.products, icon: BookOpen, to: '/admin/produtos' },
    { label: 'Indisponíveis', value: data.unavailable, icon: CircleOff, to: '/admin/produtos?filtro=unavailable' },
    { label: 'Destaques', value: data.featured, icon: Sparkles, to: '/admin/produtos?filtro=featured' },
    { label: 'Promoções', value: data.promotions, icon: Percent, to: '/admin/produtos?filtro=promotion' },
  ]
  const pending = [
    data.pending.publicSiteUrl && 'Configurar a URL pública',
    data.pending.contacts && 'Adicionar ao menos um contato',
    data.pending.address && 'Adicionar o endereço quando estiver definido',
    data.pending.completeHours && 'Completar a grade de horários',
  ].filter(Boolean) as string[]
  return (
    <div className="admin-page">
      <div className="admin-heading"><div><p>Administração</p><h1>Início</h1><span>Gerencie o cardápio e confira as alterações publicadas.</span></div><a className="secondary-button" href="/" target="_blank" rel="noreferrer">Visualizar cardápio</a></div>
      <section className="admin-card dashboard-actions"><div className="card-heading"><div><h2>O que você quer fazer?</h2><p>Acesse diretamente as tarefas mais usadas durante o atendimento.</p></div></div><div className="quick-actions"><Link className="primary-quick-action" to="/admin/produtos?acao=novo"><Plus /> <span><strong>Adicionar produto</strong><small>Cadastre nome, categoria e preço</small></span><ArrowRight /></Link><Link to="/admin/produtos?filtro=unavailable"><CircleOff /> <span><strong>Ver indisponíveis</strong><small>Reative itens que voltaram ao estoque</small></span><ArrowRight /></Link><Link to="/admin/produtos?filtro=promotion"><Percent /> <span><strong>Gerenciar promoções</strong><small>Confira os preços promocionais ativos</small></span><ArrowRight /></Link><a href="/" target="_blank" rel="noreferrer"><Eye /> <span><strong>Conferir cardápio</strong><small>Veja o que seus clientes enxergam</small></span><ArrowRight /></a></div></section>
      <div className="stat-grid">{stats.map(({ icon: Icon, to, ...stat }) => <Link to={to} key={stat.label} aria-label={`${stat.label}: ${stat.value}`}><Icon /><div><strong>{stat.value}</strong><span>{stat.label}</span></div></Link>)}</div>
      {pending.length > 0 && <section className="admin-card pending-card">
        <div className="pending-card-header"><span className="pending-card-icon"><AlertCircle /></span><div><div className="pending-title-row"><h2>Complete quando puder</h2><span>{pending.length} {pending.length === 1 ? 'item' : 'itens'}</span></div><p>O cardápio já funciona. Informações não preenchidas ficam ocultas para os clientes.</p></div></div>
        <ul className="pending-list">{pending.map((item) => <li key={item}><span aria-hidden="true" /><strong>{item}</strong></li>)}</ul>
        <div className="pending-card-footer"><span>Você pode adicionar essas informações aos poucos.</span><Link className="primary-button pending-action" to="/admin/configuracoes">Revisar configurações <ArrowRight /></Link></div>
      </section>}
    </div>
  )
}

export function AdminState({ message, error = false, onRetry, retrying = false }: { message: string; error?: boolean; onRetry?: () => void; retrying?: boolean }) {
  return <div className={`admin-state${error ? ' error' : ''}`}>{error ? <AlertCircle /> : <span className="spinner" />}<p>{message}</p>{onRetry && <button className="secondary-button" type="button" onClick={onRetry} disabled={retrying}>{retrying ? 'Tentando novamente…' : 'Tentar novamente'}</button>}</div>
}
