import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Copy, GripVertical, ImageIcon, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import type { Category, Product, ProductInput } from '../../../../shared/schemas'
import { productInputSchema } from '../../../../shared/schemas'
import { formatMoney, normalizeSearch } from '../../../../shared/utils'
import { api, jsonBody, messageFromError } from '../../lib/api'
import { prepareImage } from '../../lib/image'
import { AdminState } from './DashboardPage'
import { useAdminMenu } from './hooks'

function SortableProduct({ product, index, total, disabled, onMove, onEdit, onDuplicate, onDelete }: { product: Product; index: number; total: number; disabled: boolean; onMove: (direction: -1 | 1) => void; onEdit: () => void; onDuplicate: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: product.id, disabled })
  const price = product.variants.filter((variant) => variant.isActive)[0]
  return <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`admin-list-row product-admin-row${isDragging ? ' dragging' : ''}${!product.isAvailable ? ' muted' : ''}`}>
    <button className="drag-handle" type="button" disabled={disabled} aria-label={`Arrastar ${product.name}`} {...attributes} {...listeners}><GripVertical /></button>
    {product.imageKey ? <img src={`/media/${product.imageKey}`} alt="" /> : <span className="tiny-placeholder"><ImageIcon /></span>}
    <div className="list-copy"><strong>{product.name}</strong><span>{price ? formatMoney(price.promotionalPriceCents ?? price.priceCents) : 'Sem preço'} · {product.isAvailable ? 'Disponível' : 'Indisponível'}{product.isFeatured ? ' · Destaque' : ''}</span></div>
    <div className="row-actions"><button type="button" disabled={disabled || index === 0} aria-label="Mover para cima" onClick={() => onMove(-1)}><ArrowUp /></button><button type="button" disabled={disabled || index === total - 1} aria-label="Mover para baixo" onClick={() => onMove(1)}><ArrowDown /></button><button type="button" aria-label="Duplicar" onClick={onDuplicate}><Copy /></button><button type="button" aria-label="Editar" onClick={onEdit}><Pencil /></button><button className="danger-icon" type="button" aria-label="Excluir" onClick={onDelete}><Trash2 /></button></div>
  </article>
}

function ProductForm({ product, categories, onClose, onSaved }: { product: Product | null; categories: Category[]; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [image, setImage] = useState<Blob | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(product?.imageKey ? `/media/${product.imageKey}` : null)
  const [processingImage, setProcessingImage] = useState(false)
  const [formError, setFormError] = useState('')
  const form = useForm<ProductInput>({
    resolver: zodResolver(productInputSchema),
    defaultValues: product ? {
      categoryId: product.categoryId,
      name: product.name,
      ingredients: product.ingredients,
      isAvailable: product.isAvailable,
      isFeatured: product.isFeatured,
      sortOrder: product.sortOrder,
      variants: product.variants.map((variant) => ({ label: variant.label, priceCents: variant.priceCents, promotionalPriceCents: variant.promotionalPriceCents, isActive: variant.isActive, sortOrder: variant.sortOrder })),
    } : { categoryId: categories[0]?.id ?? '', name: '', ingredients: null, isAvailable: true, isFeatured: false, sortOrder: 0, variants: [{ label: null, priceCents: 0, promotionalPriceCents: null, isActive: true, sortOrder: 0 }] },
  })
  const fields = useFieldArray({ control: form.control, name: 'variants' })
  const previewName = useWatch({ control: form.control, name: 'name' })
  const previewIngredients = useWatch({ control: form.control, name: 'ingredients' })
  const previewVariants = useWatch({ control: form.control, name: 'variants' })

  useEffect(() => () => { if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview) }, [imagePreview])

  const save = useMutation({ mutationFn: async (input: ProductInput) => {
    const saved = product
      ? await api<Product>(`/admin/api/products/${product.id}`, { method: 'PATCH', body: jsonBody(input) })
      : await api<Product>('/admin/api/products', { method: 'POST', body: jsonBody(input) })
    if (image) await api(`/admin/api/products/${saved.id}/image`, { method: 'POST', headers: { 'Content-Type': 'image/webp' }, body: image })
    return saved
  }, onSuccess: async () => { await onSaved(product ? 'Produto atualizado.' : 'Produto criado.'); onClose() }, onError: (cause) => setFormError(messageFromError(cause)) })

  const removeImage = async () => {
    if (!product?.imageKey) { setImage(null); setImagePreview(null); return }
    if (!window.confirm('Remover a imagem deste produto?')) return
    try { await api(`/admin/api/products/${product.id}/image`, { method: 'DELETE' }); setImagePreview(null); await onSaved('Imagem removida.') } catch (cause) { setFormError(messageFromError(cause)) }
  }

  return <div className="form-overlay" role="presentation"><section className="admin-form-dialog product-form-dialog" role="dialog" aria-modal="true" aria-labelledby="product-form-title">
    <div className="form-dialog-heading"><h2 id="product-form-title">{product ? 'Editar produto' : 'Novo produto'}</h2><button type="button" aria-label="Fechar" onClick={onClose}><X /></button></div>
    <form onSubmit={form.handleSubmit((input) => save.mutate(input))}>
      {formError && <p className="feedback error" role="alert">{formError}</p>}
      <div className="form-columns"><div className="form-stack">
        <label>Nome<input {...form.register('name')} autoFocus />{form.formState.errors.name && <small>{form.formState.errors.name.message}</small>}</label>
        <label>Categoria<select {...form.register('categoryId')}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>{form.formState.errors.categoryId && <small>{form.formState.errors.categoryId.message}</small>}</label>
        <label>Ingredientes<textarea rows={4} {...form.register('ingredients', { setValueAs: (value) => value || null })} /></label>
        <div className="check-grid"><label className="check-field"><input type="checkbox" {...form.register('isAvailable')} /> Disponível</label><label className="check-field"><input type="checkbox" {...form.register('isFeatured')} /> Destaque</label></div>
        <fieldset className="image-field"><legend>Imagem</legend>{imagePreview ? <img src={imagePreview} alt="Prévia do produto" /> : <div className="image-preview-placeholder"><ImageIcon /><span>Sem imagem</span></div>}<div className="inline-actions"><label className="secondary-button file-button">{processingImage ? 'Processando…' : 'Escolher imagem'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={processingImage} onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setProcessingImage(true); setFormError(''); try { const blob = await prepareImage(file); setImage(blob); setImagePreview(URL.createObjectURL(blob)) } catch (cause) { setFormError(messageFromError(cause)) } finally { setProcessingImage(false) } }} /></label>{imagePreview && <button type="button" className="text-danger" onClick={removeImage}>Remover</button>}</div><small>JPEG, PNG ou WebP. HEIC não é suportado. A imagem será convertida e reduzida no navegador.</small></fieldset>
      </div><div className="form-stack">
        <fieldset className="variants-field"><legend>Preços e variações</legend>{fields.fields.map((field, index) => <div className="variant-row" key={field.id}>
          <label>Nome da variação<input placeholder={fields.fields.length === 1 ? 'Opcional para preço único' : 'Ex.: Média'} {...form.register(`variants.${index}.label`, { setValueAs: (value) => value || null })} /></label>
          <label>Preço em centavos<input type="number" min="1" step="1" {...form.register(`variants.${index}.priceCents`, { valueAsNumber: true })} /><small>Ex.: 2500 = R$ 25,00</small></label>
          <label>Promocional em centavos<input type="number" min="1" step="1" placeholder="Opcional" {...form.register(`variants.${index}.promotionalPriceCents`, { setValueAs: (value) => value === '' ? null : Number(value) })} /></label>
          <input type="hidden" {...form.register(`variants.${index}.sortOrder`, { valueAsNumber: true })} value={index} />
          <label className="check-field"><input type="checkbox" {...form.register(`variants.${index}.isActive`)} /> Variação ativa</label>
          {fields.fields.length > 1 && <button className="text-danger" type="button" onClick={() => fields.remove(index)}>Remover variação</button>}
          {form.formState.errors.variants?.[index] && <small className="field-error">Revise os preços desta variação.</small>}
        </div>)}<button className="secondary-button" type="button" onClick={() => fields.append({ label: null, priceCents: 0, promotionalPriceCents: null, isActive: true, sortOrder: fields.fields.length })}><Plus /> Adicionar variação</button></fieldset>
        <section className="card-preview"><p>Prévia do card</p><div><strong>{previewName || 'Nome do produto'}</strong><span>{previewIngredients || 'Ingredientes ou descrição'}</span>{previewVariants?.map((variant, index) => <small key={index}>{variant.label ? `${variant.label}: ` : ''}{Number.isFinite(variant.priceCents) ? formatMoney(variant.promotionalPriceCents ?? variant.priceCents) : 'Preço'}</small>)}</div></section>
      </div></div>
      <div className="form-actions sticky-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancelar</button><button className="primary-button" type="submit" disabled={save.isPending || processingImage}>{save.isPending ? 'Salvando…' : 'Salvar produto'}</button></div>
    </form>
  </section></div>
}

export function ProductsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useAdminMenu()
  const [categoryId, setCategoryId] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Product | null | 'new'>(null)
  const [feedback, setFeedback] = useState('')
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const selectedCategoryId = categoryId || data?.categories[0]?.id || ''
  const activeCategory = data?.categories.find((category) => category.id === selectedCategoryId)
  const products = useMemo(() => {
    const term = normalizeSearch(search)
    const source = [...(activeCategory?.products ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)
    return term ? source.filter((product) => normalizeSearch(`${product.name} ${product.ingredients ?? ''}`).includes(term)) : source
  }, [activeCategory, search])
  const invalidate = async () => { await queryClient.invalidateQueries({ queryKey: ['admin'] }); await queryClient.invalidateQueries({ queryKey: ['menu'] }) }
  const reorder = useMutation({ mutationFn: (ordered: Product[]) => api('/admin/api/products/reorder', { method: 'POST', body: jsonBody({ items: ordered.map((item, index) => ({ id: item.id, sortOrder: index })) }) }), onSuccess: invalidate, onError: (cause) => setFeedback(messageFromError(cause)) })
  const duplicate = useMutation({ mutationFn: (id: string) => api(`/admin/api/products/${id}/duplicate`, { method: 'POST' }), onSuccess: async () => { setFeedback('Produto duplicado.'); await invalidate() }, onError: (cause) => setFeedback(messageFromError(cause)) })
  const remove = useMutation({ mutationFn: (id: string) => api(`/admin/api/products/${id}`, { method: 'DELETE' }), onSuccess: async () => { setFeedback('Produto excluído.'); await invalidate() }, onError: (cause) => setFeedback(messageFromError(cause)) })
  const persistOrder = (ordered: Product[]) => { if (!search) reorder.mutate(ordered) }
  const onDragEnd = (event: DragEndEvent) => { if (!event.over || event.active.id === event.over.id || search) return; const from = products.findIndex((item) => item.id === event.active.id); const to = products.findIndex((item) => item.id === event.over?.id); persistOrder(arrayMove(products, from, to)) }
  if (isLoading) return <AdminState message="Carregando produtos…" />
  if (error || !data) return <AdminState error message={messageFromError(error)} />
  return <div className="admin-page">
    <div className="admin-heading"><div><p>Cardápio</p><h1>Produtos</h1><span>Gerencie preços, variações, imagens e disponibilidade.</span></div><button className="primary-button" type="button" disabled={!data.categories.length} onClick={() => setEditing('new')}><Plus /> Novo produto</button></div>
    {feedback && <p className="feedback" role="status">{feedback}</p>}
    <div className="admin-filters"><label>Categoria<select value={selectedCategoryId} onChange={(event) => setCategoryId(event.target.value)}>{data.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="filter-search"><Search /><span className="sr-only">Pesquisar produtos</span><input type="search" placeholder="Pesquisar produtos" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
    {search && <p className="helper-text">Limpe a pesquisa para reordenar produtos.</p>}
    <section className="admin-card list-card">{!products.length ? <div className="admin-empty">Nenhum produto encontrado nesta categoria.</div> : <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}><SortableContext items={products.map((item) => item.id)} strategy={verticalListSortingStrategy}>{products.map((product, index) => <SortableProduct key={product.id} product={product} index={index} total={products.length} disabled={Boolean(search)} onMove={(direction) => persistOrder(arrayMove(products, index, index + direction))} onEdit={() => setEditing(product)} onDuplicate={() => duplicate.mutate(product.id)} onDelete={() => { if (window.confirm(`Excluir “${product.name}” e sua imagem?`)) remove.mutate(product.id) }} />)}</SortableContext></DndContext>}</section>
    {editing && <ProductForm product={editing === 'new' ? null : editing} categories={data.categories} onClose={() => setEditing(null)} onSaved={async (message) => { setFeedback(message); await invalidate() }} />}
  </div>
}
