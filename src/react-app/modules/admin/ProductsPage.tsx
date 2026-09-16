import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Check, CircleCheck, CircleOff, Copy, Ellipsis, GripVertical, ImageIcon, ListOrdered, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { MenuResponse, Product } from '../../../../shared/schemas'
import { formatMoney, normalizeSearch } from '../../../../shared/utils'
import { api, jsonBody, messageFromError } from '../../lib/api'
import { AdminNotice, type Notice } from './AdminNotice'
import { AdminState } from './DashboardPage'
import { ConfirmDialog } from './ConfirmDialog'
import { ProductForm } from './ProductForm'
import { publicChangeNotice } from './publicationNotice'
import { useAdminMenu } from './hooks'
import { productToInput, replaceProduct } from './productInput'
import { cn, fieldLabel, focusRing, primaryButton, secondaryButton, textInput } from '../../lib/tailwind'

type ProductFilter = 'all' | 'available' | 'unavailable' | 'promotion' | 'featured' | 'no-image'

const PRODUCT_FILTERS: { value: ProductFilter; label: string }[] = [
  { value: 'all', label: 'Todos os estados' },
  { value: 'available', label: 'Disponíveis' },
  { value: 'unavailable', label: 'Indisponíveis' },
  { value: 'promotion', label: 'Em promoção' },
  { value: 'featured', label: 'Em destaque' },
  { value: 'no-image', label: 'Sem foto' },
]

function productFilterFrom(value: string | null): ProductFilter {
  return PRODUCT_FILTERS.some((filter) => filter.value === value) ? value as ProductFilter : 'all'
}

function SortableProduct({ product, categoryName, index, total, orderingEnabled, availabilityBusy, onMove, onEdit, onToggleAvailability, onDuplicate, onDelete }: { product: Product; categoryName: string; index: number; total: number; orderingEnabled: boolean; availabilityBusy: boolean; onMove: (direction: -1 | 1) => void; onEdit: () => void; onToggleAvailability: () => void; onDuplicate: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: product.id, disabled: !orderingEnabled })
  const price = product.variants.filter((variant) => variant.isActive)[0]
  return <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn('flex min-w-0 items-center gap-2 border-b border-border bg-surface-strong px-[.35rem] py-[.65rem] last:border-b-0 max-[649px]:grid max-[649px]:grid-cols-[auto_minmax(0,1fr)] max-[649px]:gap-[.6rem] max-[649px]:px-2 max-[649px]:py-3', orderingEnabled && 'max-[649px]:grid-cols-[44px_auto_minmax(0,1fr)]', !product.isAvailable && 'bg-[#fff8f7]', isDragging && 'z-[5] rounded-[.6rem] border border-[var(--color-brand)] shadow-menu-lg')}>
    {orderingEnabled && <button className={`grid h-11 w-11 shrink-0 place-items-center rounded-[.5rem] bg-transparent [touch-action:none] ${focusRing}`} type="button" aria-label={`Arrastar ${product.name}`} {...attributes} {...listeners}><GripVertical className="w-[1.15rem] text-muted" /></button>}
    {product.imageKey ? <img className={cn('h-[2.8rem] w-[2.8rem] shrink-0 rounded-[.5rem] object-cover', !product.isAvailable && 'grayscale-[.35]')} src={`/media/${product.imageKey}`} alt="" /> : <span className="grid h-[2.8rem] w-[2.8rem] shrink-0 place-items-center rounded-[.5rem] bg-[#ece8e1] text-[#aaa39a]"><ImageIcon className="w-[1.15rem]" /></span>}
    <div className="grid min-w-0 flex-1"><strong className="overflow-hidden text-ellipsis max-[649px]:[overflow-wrap:anywhere]">{product.name}</strong><span className="mt-[.15rem] overflow-hidden text-ellipsis text-[.78rem] text-muted">{categoryName} · {price ? formatMoney(price.promotionalPriceCents ?? price.priceCents) : 'Sem preço'}</span><span className={cn('font-[750] text-success', !product.isAvailable && 'text-danger')}>{product.isAvailable ? 'Disponível' : 'Indisponível'}{product.isFeatured ? ' · Destaque' : ''}</span></div>
    <div className="flex flex-wrap justify-end gap-[.2rem] max-[649px]:col-span-full max-[649px]:grid max-[649px]:grid-cols-2 max-[649px]:border-t max-[649px]:border-border max-[649px]:pt-[.45rem]">
      {orderingEnabled ? <><button className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-[.3rem] rounded-[.45rem] bg-transparent px-[.55rem] py-[.45rem] text-[.76rem] font-[700] disabled:cursor-not-allowed disabled:opacity-50 max-[649px]:bg-[#f5f2ed] ${focusRing}`} type="button" disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp /><span>Subir</span></button><button className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-[.3rem] rounded-[.45rem] bg-transparent px-[.55rem] py-[.45rem] text-[.76rem] font-[700] disabled:cursor-not-allowed disabled:opacity-50 max-[649px]:bg-[#f5f2ed] ${focusRing}`} type="button" disabled={index === total - 1} onClick={() => onMove(1)}><ArrowDown /><span>Descer</span></button></> : <>
        <button type="button" className={cn('inline-flex min-h-11 min-w-11 items-center justify-center gap-[.3rem] rounded-[.45rem] bg-transparent px-[.55rem] py-[.45rem] text-[.76rem] font-[700] text-danger max-[649px]:col-span-full max-[649px]:w-full max-[649px]:bg-[#f5f2ed]', product.isAvailable && 'text-success', focusRing)} aria-pressed={!product.isAvailable} disabled={availabilityBusy} onClick={onToggleAvailability}>{product.isAvailable ? <CircleOff /> : <CircleCheck />}<span>{availabilityBusy ? 'Salvando…' : product.isAvailable ? 'Indisponibilizar' : 'Disponibilizar'}</span></button>
        <button className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-[.3rem] rounded-[.45rem] bg-transparent px-[.55rem] py-[.45rem] text-[.76rem] font-[700] ${focusRing}`} type="button" onClick={onEdit}><Pencil /><span>Editar dados</span></button>
        <details className="relative"><summary className={`inline-flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center gap-[.3rem] rounded-[.45rem] px-[.55rem] py-[.45rem] text-[.76rem] font-[700] marker:hidden ${focusRing}`}><Ellipsis /><span>Mais ações</span></summary><div className="absolute right-0 top-[calc(100%+.3rem)] z-[25] grid min-w-40 rounded-[.6rem] border border-border bg-surface-strong p-[.3rem] shadow-menu-lg"><button className={`flex min-h-11 w-full items-center justify-start gap-[.3rem] rounded-[.45rem] bg-transparent px-[.55rem] py-[.45rem] font-[700] ${focusRing}`} type="button" onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); onDuplicate() }}><Copy /><span>Duplicar</span></button><button className={`flex min-h-11 w-full items-center justify-start gap-[.3rem] rounded-[.45rem] bg-transparent px-[.55rem] py-[.45rem] font-[700] text-danger ${focusRing}`} type="button" onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); onDelete() }}><Trash2 /><span>Excluir</span></button></div></details>
      </>}
    </div>
  </article>
}

export function ProductsPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data, isLoading, error, refetch, isFetching } = useAdminMenu()
  const [categoryId, setCategoryId] = useState(() => searchParams.get('categoria') ?? '')
  const [filter, setFilter] = useState<ProductFilter>(() => productFilterFrom(searchParams.get('filtro')))
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Product | null | 'new'>(() => searchParams.get('acao') === 'novo' ? 'new' : null)
  const [deleting, setDeleting] = useState<Product | null>(null)
  const [organizing, setOrganizing] = useState(false)
  const [draftOrder, setDraftOrder] = useState<string[]>([])
  const [feedback, setFeedback] = useState<Notice | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const selectedCategoryId = categoryId || 'all'
  const activeCategory = data?.categories.find((category) => category.id === selectedCategoryId)
  const categoryNames = useMemo(() => new Map((data?.categories ?? []).map((category) => [category.id, category.name])), [data])
  const filteredProducts = useMemo(() => {
    const term = normalizeSearch(search)
    const source = activeCategory
      ? [...activeCategory.products].sort((a, b) => a.sortOrder - b.sortOrder)
      : [...(data?.categories ?? [])].sort((a, b) => a.sortOrder - b.sortOrder).flatMap((category) => [...category.products].sort((a, b) => a.sortOrder - b.sortOrder))
    return source.filter((product) => {
      const matchesSearch = !term || normalizeSearch(`${product.name} ${product.ingredients ?? ''}`).includes(term)
      const matchesState = filter === 'all'
        || (filter === 'available' && product.isAvailable)
        || (filter === 'unavailable' && !product.isAvailable)
        || (filter === 'promotion' && product.variants.some((variant) => variant.promotionalPriceCents !== null))
        || (filter === 'featured' && product.isFeatured)
        || (filter === 'no-image' && !product.imageKey)
      return matchesSearch && matchesState
    })
  }, [activeCategory, data, filter, search])
  const products = useMemo(() => {
    if (!organizing || !draftOrder.length) return filteredProducts
    const byId = new Map(filteredProducts.map((product) => [product.id, product]))
    return draftOrder.map((id) => byId.get(id)).filter((product): product is Product => Boolean(product))
  }, [draftOrder, filteredProducts, organizing])
  const canOrganize = Boolean(activeCategory) && !search && filter === 'all'
  const orderingEnabled = canOrganize && organizing
  const invalidate = async () => { await queryClient.invalidateQueries({ queryKey: ['admin'] }) }
  const reorder = useMutation({ mutationFn: (ordered: Product[]) => api('/admin/api/products/reorder', { method: 'POST', body: jsonBody({ items: ordered.map((item, index) => ({ id: item.id, sortOrder: index })) }) }), onSuccess: async () => { setOrganizing(false); setDraftOrder([]); setFeedback(publicChangeNotice('Ordem dos produtos salva.')); await invalidate() }, onError: (cause) => setFeedback({ kind: 'error', message: `${messageFromError(cause)} A ordem em edição foi mantida para você tentar novamente.` }) })
  const availability = useMutation({
    mutationFn: ({ product, next }: { product: Product; next: boolean }) => api<Product>(`/admin/api/products/${product.id}`, { method: 'PATCH', body: jsonBody(productToInput(product, { isAvailable: next })) }),
    onMutate: async ({ product, next }) => {
      await queryClient.cancelQueries({ queryKey: ['admin', 'menu'] })
      const previous = queryClient.getQueryData<MenuResponse>(['admin', 'menu'])
      queryClient.setQueryData<MenuResponse>(['admin', 'menu'], (menu) => replaceProduct(menu, { ...product, isAvailable: next }))
      return { previous }
    },
    onError: (cause, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(['admin', 'menu'], context.previous)
      setFeedback({ kind: 'error', message: `${messageFromError(cause)} O estado anterior foi restaurado.` })
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<MenuResponse>(['admin', 'menu'], (menu) => replaceProduct(menu, saved))
      setFeedback(publicChangeNotice(saved.isAvailable ? 'Produto marcado como disponível.' : 'Produto marcado como indisponível.'))
    },
    onSettled: invalidate,
  })
  const duplicate = useMutation({ mutationFn: (id: string) => api<Product>(`/admin/api/products/${id}/duplicate`, { method: 'POST' }), onSuccess: async (copy) => { setFeedback(publicChangeNotice('Cópia criada. Revise os dados antes de continuar.')); await invalidate(); setEditing(copy) }, onError: (cause) => setFeedback({ kind: 'error', message: messageFromError(cause) }) })
  const remove = useMutation({ mutationFn: (id: string) => api(`/admin/api/products/${id}`, { method: 'DELETE' }), onSuccess: async () => { setDeleting(null); setFeedback(publicChangeNotice('Produto excluído.')); await invalidate() }, onError: (cause) => setFeedback({ kind: 'error', message: messageFromError(cause) }) })
  const setOrderedProducts = (ordered: Product[]) => { if (orderingEnabled) setDraftOrder(ordered.map((product) => product.id)) }
  const onDragEnd = (event: DragEndEvent) => { if (!event.over || event.active.id === event.over.id || !orderingEnabled) return; const from = products.findIndex((item) => item.id === event.active.id); const to = products.findIndex((item) => item.id === event.over?.id); setOrderedProducts(arrayMove(products, from, to)) }
  const startOrganizing = () => { setDraftOrder(filteredProducts.map((product) => product.id)); setOrganizing(true); setFeedback(null) }
  const cancelOrganizing = () => { setDraftOrder([]); setOrganizing(false) }
  const changeCategory = (nextCategoryId: string) => {
    setCategoryId(nextCategoryId)
    cancelOrganizing()
    const next = new URLSearchParams(searchParams)
    if (nextCategoryId === 'all') next.delete('categoria')
    else next.set('categoria', nextCategoryId)
    setSearchParams(next, { replace: true })
  }
  const changeFilter = (nextFilter: ProductFilter) => {
    setFilter(nextFilter)
    cancelOrganizing()
    const next = new URLSearchParams(searchParams)
    if (nextFilter === 'all') next.delete('filtro')
    else next.set('filtro', nextFilter)
    setSearchParams(next, { replace: true })
  }
  const clearFilters = () => {
    setSearch('')
    changeFilter('all')
  }
  const closeProductForm = () => {
    setEditing(null)
    if (!searchParams.has('acao')) return
    const next = new URLSearchParams(searchParams)
    next.delete('acao')
    setSearchParams(next, { replace: true })
  }

  if (isLoading) return <AdminState message="Carregando produtos…" />
  if (error || !data) return <AdminState error message={messageFromError(error)} onRetry={() => void refetch()} retrying={isFetching} />
  return <div className="mx-auto w-full max-w-[72rem]">
    <div className="mb-[1.3rem] flex flex-wrap items-end justify-between gap-4"><div><p className="mb-[.2rem] text-[.75rem] font-[850] uppercase tracking-[.1em] text-[var(--color-brand-strong)]">Cardápio</p><h1 className="m-0 text-[clamp(1.8rem,7vw,2.5rem)] tracking-[-.035em]">Produtos</h1><span className="mt-[.35rem] block text-muted">Edite informações, preços, tamanhos e disponibilidade dos produtos.</span></div><button className={primaryButton} type="button" disabled={!data.categories.length} onClick={() => { setFeedback(null); setEditing('new') }}><Plus /> Novo produto</button></div>
    {feedback && <AdminNotice notice={feedback} />}
    <div className="mb-[.8rem] grid gap-[.7rem] min-[650px]:grid-cols-[minmax(10rem,.8fr)_minmax(10rem,.8fr)_minmax(14rem,1.4fr)]"><label className={fieldLabel}>Categoria<select className={textInput} value={selectedCategoryId} onChange={(event) => changeCategory(event.target.value)}><option value="all">Todas as categorias</option>{data.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className={fieldLabel}>Mostrar<select className={textInput} value={filter} onChange={(event) => changeFilter(event.target.value as ProductFilter)}>{PRODUCT_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className={`${fieldLabel} relative`}><Search className="absolute bottom-[.75rem] left-[.8rem] w-[1.1rem] text-muted" /><span>Pesquisar</span><input className={`${textInput} pl-10`} type="search" placeholder="Nome ou ingrediente" value={search} onChange={(event) => { setSearch(event.target.value); if (event.target.value) cancelOrganizing() }} /></label></div>
    <div className="mb-[.65rem] flex min-h-12 flex-wrap items-center justify-between gap-[.6rem] text-[.82rem] text-muted max-[649px]:items-stretch">{organizing ? <><span>Organize por arraste ou pelos botões.</span><div className="flex flex-wrap gap-2 max-[649px]:grid max-[649px]:w-full max-[649px]:grid-cols-2"><button className={secondaryButton} type="button" onClick={cancelOrganizing}><X /> Cancelar</button><button className={primaryButton} type="button" disabled={reorder.isPending} onClick={() => reorder.mutate(products)}><Check /> {reorder.isPending ? 'Salvando…' : 'Salvar ordem'}</button></div></> : canOrganize ? <button className={secondaryButton} type="button" onClick={startOrganizing}><ListOrdered /> Organizar produtos</button> : products.length > 0 ? <span className="text-[.8rem] text-muted">Escolha uma categoria e limpe a pesquisa para organizar.</span> : null}</div>
    <section className={cn('rounded-[.85rem] border border-border bg-surface-strong p-[.4rem] shadow-menu-sm', organizing && 'border-[color-mix(in_srgb,var(--color-brand)_45%,var(--color-border))]')}>{!products.length ? <div className="grid justify-items-center gap-2 p-12 text-center text-muted"><strong className="text-text">Nenhum produto encontrado.</strong><span>{search || filter !== 'all' ? 'Tente outra busca ou limpe os filtros.' : 'Adicione o primeiro produto para começar.'}</span>{search || filter !== 'all' ? <button className={secondaryButton} type="button" onClick={clearFilters}>Limpar filtros</button> : <button className={primaryButton} type="button" disabled={!data.categories.length} onClick={() => { setFeedback(null); setEditing('new') }}><Plus /> Adicionar produto</button>}</div> : <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}><SortableContext items={products.map((item) => item.id)} strategy={verticalListSortingStrategy}>{products.map((product, index) => <SortableProduct key={product.id} product={product} categoryName={categoryNames.get(product.categoryId) ?? 'Sem categoria'} index={index} total={products.length} orderingEnabled={orderingEnabled} availabilityBusy={availability.isPending && availability.variables?.product.id === product.id} onMove={(direction) => setOrderedProducts(arrayMove(products, index, index + direction))} onEdit={() => { setFeedback(null); setEditing(product) }} onToggleAvailability={() => availability.mutate({ product, next: !product.isAvailable })} onDuplicate={() => duplicate.mutate(product.id)} onDelete={() => { setFeedback(null); setDeleting(product) }} />)}</SortableContext></DndContext>}</section>
    {editing && <ProductForm product={editing === 'new' ? null : editing} categories={data.categories} initialCategoryId={activeCategory?.id} onClose={closeProductForm} onCategoryCreated={invalidate} onSaved={async (message) => { await invalidate(); setFeedback(publicChangeNotice(message)) }} />}
    {deleting && <ConfirmDialog title={`Excluir “${deleting.name}”?`} description="O produto e sua foto serão removidos permanentemente. Essa ação não pode ser desfeita." confirmLabel="Excluir produto" busy={remove.isPending} onClose={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting.id)} />}
  </div>
}
