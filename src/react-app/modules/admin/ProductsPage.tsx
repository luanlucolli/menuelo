import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, BadgeDollarSign, Check, CircleCheck, CircleOff, Copy, GripVertical, ImageIcon, ListOrdered, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { MenuResponse, Product } from '../../../../shared/schemas'
import { formatMoney, normalizeSearch } from '../../../../shared/utils'
import { api, jsonBody, messageFromError } from '../../lib/api'
import { AdminNotice, type Notice } from './AdminNotice'
import { AdminState } from './DashboardPage'
import { ConfirmDialog } from './ConfirmDialog'
import { ProductForm } from './ProductForm'
import { QuickPricingDialog } from './QuickPricingDialog'
import { useAdminMenu } from './hooks'
import { productToInput, replaceProduct } from './productInput'

type ProductsNotice = Notice & { refreshToken?: string }
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

function successNotice(message: string): ProductsNotice {
  return { kind: 'success', message, refreshToken: crypto.randomUUID() }
}

function SortableProduct({ product, categoryName, index, total, orderingEnabled, availabilityBusy, onMove, onEdit, onPricing, onToggleAvailability, onDuplicate, onDelete }: { product: Product; categoryName: string; index: number; total: number; orderingEnabled: boolean; availabilityBusy: boolean; onMove: (direction: -1 | 1) => void; onEdit: () => void; onPricing: () => void; onToggleAvailability: () => void; onDuplicate: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: product.id, disabled: !orderingEnabled })
  const price = product.variants.filter((variant) => variant.isActive)[0]
  return <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`admin-list-row product-admin-row${isDragging ? ' dragging' : ''}${!product.isAvailable ? ' muted' : ''}`}>
    {orderingEnabled && <button className="drag-handle" type="button" aria-label={`Arrastar ${product.name}`} {...attributes} {...listeners}><GripVertical /></button>}
    {product.imageKey ? <img src={`/media/${product.imageKey}`} alt="" /> : <span className="tiny-placeholder"><ImageIcon /></span>}
    <div className="list-copy"><strong>{product.name}</strong><span>{categoryName} · {price ? formatMoney(price.promotionalPriceCents ?? price.priceCents) : 'Sem preço'}</span><span className={`product-row-status${product.isAvailable ? '' : ' unavailable'}`}>{product.isAvailable ? 'Disponível' : 'Indisponível'}{product.isFeatured ? ' · Destaque' : ''}</span></div>
    <div className="row-actions">
      {orderingEnabled ? <><button type="button" disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp /><span>Subir</span></button><button type="button" disabled={index === total - 1} onClick={() => onMove(1)}><ArrowDown /><span>Descer</span></button></> : <>
        <button type="button" className={`availability-action${product.isAvailable ? '' : ' unavailable'}`} aria-pressed={!product.isAvailable} disabled={availabilityBusy} onClick={onToggleAvailability}>{product.isAvailable ? <CircleOff /> : <CircleCheck />}<span>{availabilityBusy ? 'Salvando…' : product.isAvailable ? 'Indisponibilizar' : 'Disponibilizar'}</span></button>
        <button type="button" onClick={onPricing}><BadgeDollarSign /><span>Preços</span></button>
        <button type="button" onClick={onDuplicate}><Copy /><span>Duplicar</span></button>
        <button type="button" onClick={onEdit}><Pencil /><span>Editar</span></button>
        <button className="danger-icon" type="button" onClick={onDelete}><Trash2 /><span>Excluir</span></button>
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
  const [pricing, setPricing] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState<Product | null>(null)
  const [organizing, setOrganizing] = useState(false)
  const [draftOrder, setDraftOrder] = useState<string[]>([])
  const [feedback, setFeedback] = useState<ProductsNotice | null>(null)
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
  const invalidate = async () => { await queryClient.invalidateQueries({ queryKey: ['admin'] }); await queryClient.invalidateQueries({ queryKey: ['menu'] }) }
  const reorder = useMutation({ mutationFn: (ordered: Product[]) => api('/admin/api/products/reorder', { method: 'POST', body: jsonBody({ items: ordered.map((item, index) => ({ id: item.id, sortOrder: index })) }) }), onSuccess: async () => { setOrganizing(false); setDraftOrder([]); setFeedback({ kind: 'success', message: 'Ordem dos produtos salva.' }); await invalidate() }, onError: (cause) => setFeedback({ kind: 'error', message: `${messageFromError(cause)} A ordem em edição foi mantida para você tentar novamente.` }) })
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
      setFeedback(successNotice(saved.isAvailable ? 'Produto marcado como disponível.' : 'Produto marcado como indisponível.'))
    },
    onSettled: invalidate,
  })
  const duplicate = useMutation({ mutationFn: (id: string) => api<Product>(`/admin/api/products/${id}/duplicate`, { method: 'POST' }), onSuccess: async (copy) => { setFeedback(successNotice('Cópia criada. Revise os dados antes de continuar.')); await invalidate(); setEditing(copy) }, onError: (cause) => setFeedback({ kind: 'error', message: messageFromError(cause) }) })
  const remove = useMutation({ mutationFn: (id: string) => api(`/admin/api/products/${id}`, { method: 'DELETE' }), onSuccess: async () => { setDeleting(null); setFeedback(successNotice('Produto excluído.')); await invalidate() }, onError: (cause) => setFeedback({ kind: 'error', message: messageFromError(cause) }) })
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
  return <div className="admin-page">
    <div className="admin-heading"><div><p>Cardápio</p><h1>Produtos</h1><span>Altere preços, promoções e disponibilidade sem percorrer o cadastro inteiro.</span></div><button className="primary-button" type="button" disabled={!data.categories.length} onClick={() => { setFeedback(null); setEditing('new') }}><Plus /> Novo produto</button></div>
    {feedback && <AdminNotice notice={feedback} action={feedback.refreshToken ? <a className="feedback-action" href={`/?refresh=${feedback.refreshToken}`} target="_blank" rel="noreferrer">Ver no cardápio</a> : undefined} />}
    <div className="admin-filters"><label>Categoria<select value={selectedCategoryId} onChange={(event) => changeCategory(event.target.value)}><option value="all">Todas as categorias</option>{data.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Mostrar<select value={filter} onChange={(event) => changeFilter(event.target.value as ProductFilter)}>{PRODUCT_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="filter-search"><Search /><span>Pesquisar</span><input type="search" placeholder="Nome ou ingrediente" value={search} onChange={(event) => { setSearch(event.target.value); if (event.target.value) cancelOrganizing() }} /></label></div>
    <div className="organizing-toolbar">{organizing ? <><span>Organize por arraste ou pelos botões.</span><div><button className="secondary-button" type="button" onClick={cancelOrganizing}><X /> Cancelar</button><button className="primary-button" type="button" disabled={reorder.isPending} onClick={() => reorder.mutate(products)}><Check /> {reorder.isPending ? 'Salvando…' : 'Salvar ordem'}</button></div></> : canOrganize ? <button className="secondary-button" type="button" onClick={startOrganizing}><ListOrdered /> Organizar produtos</button> : products.length > 0 ? <span className="helper-text">Escolha uma categoria e limpe a pesquisa para organizar.</span> : null}</div>
    <section className={`admin-card list-card${organizing ? ' organizing' : ''}`}>{!products.length ? <div className="admin-empty"><strong>Nenhum produto encontrado.</strong><span>{search || filter !== 'all' ? 'Tente outra busca ou limpe os filtros.' : 'Adicione o primeiro produto para começar.'}</span>{search || filter !== 'all' ? <button className="secondary-button" type="button" onClick={clearFilters}>Limpar filtros</button> : <button className="primary-button" type="button" disabled={!data.categories.length} onClick={() => { setFeedback(null); setEditing('new') }}><Plus /> Adicionar produto</button>}</div> : <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}><SortableContext items={products.map((item) => item.id)} strategy={verticalListSortingStrategy}>{products.map((product, index) => <SortableProduct key={product.id} product={product} categoryName={categoryNames.get(product.categoryId) ?? 'Sem categoria'} index={index} total={products.length} orderingEnabled={orderingEnabled} availabilityBusy={availability.isPending && availability.variables?.product.id === product.id} onMove={(direction) => setOrderedProducts(arrayMove(products, index, index + direction))} onEdit={() => { setFeedback(null); setEditing(product) }} onPricing={() => { setFeedback(null); setPricing(product) }} onToggleAvailability={() => availability.mutate({ product, next: !product.isAvailable })} onDuplicate={() => duplicate.mutate(product.id)} onDelete={() => { setFeedback(null); setDeleting(product) }} />)}</SortableContext></DndContext>}</section>
    {editing && <ProductForm product={editing === 'new' ? null : editing} categories={data.categories} initialCategoryId={activeCategory?.id} onClose={closeProductForm} onCategoryCreated={invalidate} onSaved={async (message) => { await invalidate(); setFeedback(successNotice(message)) }} />}
    {pricing && <QuickPricingDialog product={pricing} onClose={() => setPricing(null)} onSaved={async (saved, message) => { queryClient.setQueryData<MenuResponse>(['admin', 'menu'], (menu) => replaceProduct(menu, saved)); setFeedback(successNotice(message)); await invalidate() }} />}
    {deleting && <ConfirmDialog title={`Excluir “${deleting.name}”?`} description="O produto e sua foto serão removidos permanentemente. Essa ação não pode ser desfeita." confirmLabel="Excluir produto" busy={remove.isPending} onClose={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting.id)} />}
  </div>
}
