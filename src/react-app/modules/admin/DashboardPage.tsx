import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ArrowRight, BookOpen, CircleOff, Eye, Percent, Plus, Shapes, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, messageFromError } from '../../lib/api'
import { cn, focusRing, primaryButton, secondaryButton } from '../../lib/tailwind'

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
    <div className="mx-auto w-full max-w-[72rem]">
      <div className="mb-[1.3rem] flex flex-wrap items-end justify-between gap-4"><div><p className="mb-[.2rem] text-[.75rem] font-[850] uppercase tracking-[.1em] text-[var(--color-brand-strong)]">Administração</p><h1 className="m-0 text-[clamp(1.8rem,7vw,2.5rem)] tracking-[-.035em]">Início</h1><span className="mt-[.35rem] block text-muted">Gerencie o cardápio e confira as alterações publicadas.</span></div><a className={secondaryButton} href="/" target="_blank" rel="noreferrer">Visualizar cardápio</a></div>
      <section className="mb-4 rounded-[.85rem] border border-border bg-surface-strong p-4 shadow-menu-sm"><div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="m-0 text-[1.1rem]">O que você quer fazer?</h2><p className="mt-1 text-[.88rem] text-muted">Acesse diretamente as tarefas mais usadas durante o atendimento.</p></div></div><div className="grid gap-[.6rem] min-[650px]:grid-cols-2"><Link className={`grid min-h-[58px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[.7rem] rounded-[.65rem] border border-[var(--color-brand)] bg-[var(--color-brand)] px-[.8rem] py-[.7rem] text-[var(--color-brand-text)] no-underline ${focusRing}`} to="/admin/produtos?acao=novo"><Plus className="w-4" /> <span className="grid"><strong className="text-[.88rem]">Adicionar produto</strong><small className="mt-[.1rem] text-[.74rem] text-[var(--color-brand-text)]">Cadastre nome, categoria e preço</small></span><ArrowRight className="w-4" /></Link><Link className={`grid min-h-[58px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[.7rem] rounded-[.65rem] border border-border px-[.8rem] py-[.7rem] no-underline ${focusRing}`} to="/admin/produtos?filtro=unavailable"><CircleOff className="w-4 text-[var(--color-brand)]" /> <span className="grid"><strong className="text-[.88rem]">Ver indisponíveis</strong><small className="mt-[.1rem] text-[.74rem] text-muted">Reative itens que voltaram ao estoque</small></span><ArrowRight className="w-4" /></Link><Link className={`grid min-h-[58px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[.7rem] rounded-[.65rem] border border-border px-[.8rem] py-[.7rem] no-underline ${focusRing}`} to="/admin/produtos?filtro=promotion"><Percent className="w-4 text-[var(--color-brand)]" /> <span className="grid"><strong className="text-[.88rem]">Gerenciar promoções</strong><small className="mt-[.1rem] text-[.74rem] text-muted">Confira os preços promocionais ativos</small></span><ArrowRight className="w-4" /></Link><a className={`grid min-h-[58px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[.7rem] rounded-[.65rem] border border-border px-[.8rem] py-[.7rem] no-underline ${focusRing}`} href="/" target="_blank" rel="noreferrer"><Eye className="w-4 text-[var(--color-brand)]" /> <span className="grid"><strong className="text-[.88rem]">Conferir cardápio</strong><small className="mt-[.1rem] text-[.74rem] text-muted">Veja o que seus clientes enxergam</small></span><ArrowRight className="w-4" /></a></div></section>
      <div className="mb-4 grid grid-cols-2 gap-3 min-[650px]:grid-cols-3 lg:grid-cols-5">{stats.map(({ icon: Icon, to, ...stat }) => <Link className={`flex min-w-0 items-center gap-[.7rem] rounded-[.85rem] border border-border bg-surface-strong p-[.9rem] no-underline hover:border-[color-mix(in_srgb,var(--color-brand)_45%,var(--color-border))] ${focusRing}`} to={to} key={stat.label} aria-label={`${stat.label}: ${stat.value}`}><Icon className="w-[1.35rem] shrink-0 text-[var(--color-brand)]" /><div className="grid min-w-0"><strong className="text-[1.35rem] [line-height:1]">{stat.value}</strong><span className="mt-[.2rem] [overflow-wrap:anywhere] text-[.77rem] text-muted">{stat.label}</span></div></Link>)}</div>
      {pending.length > 0 && <section className="grid gap-4 rounded-[.85rem] border border-[color-mix(in_srgb,var(--color-brand)_30%,var(--color-border))] bg-[linear-gradient(135deg,var(--color-brand-soft),var(--color-surface-strong)_55%)] p-4 shadow-menu-sm">
        <div className="flex items-start gap-3"><span className="grid h-[2.6rem] w-[2.6rem] shrink-0 place-items-center rounded-[.7rem] bg-white text-[var(--color-brand-strong)] shadow-menu-sm"><AlertCircle className="w-5" /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-[.7rem]"><h2 className="m-0 text-[1.1rem]">Complete quando puder</h2><span className="shrink-0 rounded-full bg-white px-2 py-1 text-[.7rem] font-[800] text-[var(--color-brand-strong)]">{pending.length} {pending.length === 1 ? 'item' : 'itens'}</span></div><p className="mt-[.3rem] text-[.84rem] leading-[1.45] text-muted">O cardápio já funciona. Informações não preenchidas ficam ocultas para os clientes.</p></div></div>
        <ul className="m-0 grid list-none gap-2 p-0">{pending.map((item) => <li className="flex min-w-0 items-center gap-[.55rem] rounded-[.6rem] border border-[color-mix(in_srgb,var(--color-brand)_18%,var(--color-border))] bg-[rgb(255_255_255_/_76%)] px-[.7rem] py-[.65rem]" key={item}><span className="h-[.55rem] w-[.55rem] shrink-0 rounded-full border-2 border-[var(--color-brand)]" aria-hidden="true" /><strong className="[overflow-wrap:anywhere] text-[.8rem]">{item}</strong></li>)}</ul>
        <div className="flex flex-wrap items-center justify-between gap-[.7rem] pt-[.1rem]"><span className="text-[.78rem] text-muted">Você pode adicionar essas informações aos poucos.</span><Link className={`${primaryButton} gap-[.4rem] whitespace-nowrap`} to="/admin/configuracoes">Revisar configurações <ArrowRight className="w-4" /></Link></div>
      </section>}
    </div>
  )
}

export function AdminState({ message, error = false, onRetry, retrying = false }: { message: string; error?: boolean; onRetry?: () => void; retrying?: boolean }) {
  return <div className={cn('grid min-h-[50dvh] place-content-center justify-items-center gap-[.8rem] text-center text-muted', error && 'text-danger')}>{error ? <AlertCircle /> : <span className="h-8 w-8 animate-[spin_.8s_linear_infinite] rounded-full border-[3px] border-border border-t-[var(--color-brand)] motion-reduce:animate-none" />}<p>{message}</p>{onRetry && <button className={secondaryButton} type="button" onClick={onRetry} disabled={retrying}>{retrying ? 'Tentando novamente…' : 'Tentar novamente'}</button>}</div>
}
