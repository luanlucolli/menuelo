import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Check, GripVertical, ListOrdered, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import type { Category, CategoryInput } from '../../../../shared/schemas'
import { categoryInputSchema } from '../../../../shared/schemas'
import { api, jsonBody, messageFromError } from '../../lib/api'
import { AdminDialog } from './AdminDialog'
import { AdminNotice, type Notice } from './AdminNotice'
import { ConfirmDialog } from './ConfirmDialog'
import { AdminState } from './DashboardPage'
import { useAdminMenu } from './hooks'
import { publicChangeNotice } from './publicationNotice'
import { cn, fieldError, fieldHelp, fieldLabel, focusRing, primaryButton, secondaryButton, textInput, checkField } from '../../lib/tailwind'

function SortableCategory({ category, index, total, organizing, onEdit, onDelete, onMove }: { category: Category; index: number; total: number; organizing: boolean; onEdit: () => void; onDelete: () => void; onMove: (direction: -1 | 1) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id, disabled: !organizing })
  return <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn('flex min-w-0 items-center gap-2 border-b border-border bg-surface-strong px-[.35rem] py-[.65rem] last:border-b-0 max-[649px]:grid max-[649px]:grid-cols-[minmax(0,1fr)_auto] max-[649px]:gap-[.55rem]', organizing && 'max-[649px]:grid-cols-[44px_minmax(0,1fr)]', isDragging && 'z-[5] rounded-[.6rem] border border-[var(--color-brand)] shadow-menu-lg')}>
    {organizing && <button className={`grid h-11 w-11 shrink-0 place-items-center rounded-[.5rem] bg-transparent [touch-action:none] ${focusRing}`} type="button" aria-label={`Arrastar ${category.name}`} {...attributes} {...listeners}><GripVertical className="w-[1.15rem] text-muted" /></button>}
    <div className="grid min-w-0 flex-1"><strong className="overflow-hidden text-ellipsis">{category.name}</strong><span className="mt-[.15rem] overflow-hidden text-ellipsis text-[.78rem] text-muted">{category.products.length} {category.products.length === 1 ? 'produto' : 'produtos'} · {category.isActive ? 'Visível' : 'Oculta'}</span></div>
    <div className="flex flex-wrap justify-end gap-[.2rem] max-[649px]:col-span-full max-[649px]:grid max-[649px]:grid-cols-2">{organizing ? <><button className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-[.3rem] rounded-[.45rem] bg-transparent px-[.55rem] py-[.45rem] text-[.76rem] font-[700] disabled:cursor-not-allowed disabled:opacity-50 max-[649px]:bg-[#f5f2ed] ${focusRing}`} type="button" disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp /><span>Subir</span></button><button className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-[.3rem] rounded-[.45rem] bg-transparent px-[.55rem] py-[.45rem] text-[.76rem] font-[700] disabled:cursor-not-allowed disabled:opacity-50 max-[649px]:bg-[#f5f2ed] ${focusRing}`} type="button" disabled={index === total - 1} onClick={() => onMove(1)}><ArrowDown /><span>Descer</span></button></> : <><button className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-[.3rem] rounded-[.45rem] bg-transparent px-[.55rem] py-[.45rem] text-[.76rem] font-[700] ${focusRing}`} type="button" onClick={onEdit}><Pencil /><span>Editar</span></button><button className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-[.3rem] rounded-[.45rem] bg-transparent px-[.55rem] py-[.45rem] text-[.76rem] font-[700] text-danger max-[649px]:bg-[#f5f2ed] ${focusRing}`} type="button" onClick={onDelete}><Trash2 /><span>Excluir</span></button></>}</div>
  </article>
}

export function CategoriesPage() {
  const queryClient = useQueryClient()
  const { data, isLoading, error, refetch, isFetching } = useAdminMenu()
  const [order, setOrder] = useState<string[]>([])
  const [organizing, setOrganizing] = useState(false)
  const [editing, setEditing] = useState<Category | null | 'new'>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)
  const [blockedCategory, setBlockedCategory] = useState<Category | null>(null)
  const [feedback, setFeedback] = useState<Notice | null>(null)
  const [formError, setFormError] = useState('')
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const form = useForm<CategoryInput>({ resolver: zodResolver(categoryInputSchema), defaultValues: { name: '', description: null, isActive: true, sortOrder: 0 } })
  const items = useMemo(() => {
    const base = [...(data?.categories ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)
    if (!organizing || !order.length) return base
    const byId = new Map(base.map((category) => [category.id, category]))
    return order.map((id) => byId.get(id)).filter((category): category is Category => Boolean(category))
  }, [data, order, organizing])

  useEffect(() => {
    if (editing && editing !== 'new') form.reset({ name: editing.name, description: editing.description, isActive: editing.isActive, sortOrder: editing.sortOrder })
    if (editing === 'new') form.reset({ name: '', description: null, isActive: true, sortOrder: items.length })
  }, [editing, form, items.length])

  const invalidate = async () => { await queryClient.invalidateQueries({ queryKey: ['admin'] }) }
  const reorder = useMutation({ mutationFn: (ordered: Category[]) => api('/admin/api/categories/reorder', { method: 'POST', body: jsonBody({ items: ordered.map((item, index) => ({ id: item.id, sortOrder: index })) }) }), onSuccess: async () => { setOrganizing(false); setOrder([]); setFeedback(publicChangeNotice('Ordem das categorias salva.')); await invalidate() }, onError: (cause) => setFeedback({ kind: 'error', message: `${messageFromError(cause)} A ordem em edição foi mantida para você tentar novamente.` }) })
  const save = useMutation({ mutationFn: (input: CategoryInput) => {
    if (editing === 'new') return api('/admin/api/categories', { method: 'POST', body: jsonBody(input) })
    if (!editing) throw new Error('Categoria não selecionada.')
    return api(`/admin/api/categories/${editing.id}`, { method: 'PATCH', body: jsonBody(input) })
  }, onSuccess: async () => { setEditing(null); setFeedback(publicChangeNotice('Categoria salva.')); await invalidate() }, onError: (cause) => setFormError(messageFromError(cause)) })
  const remove = useMutation({ mutationFn: (id: string) => api(`/admin/api/categories/${id}`, { method: 'DELETE' }), onSuccess: async () => { setDeleting(null); setFeedback(publicChangeNotice('Categoria excluída.')); await invalidate() }, onError: (cause) => { setDeleting(null); setFeedback({ kind: 'error', message: messageFromError(cause) }) } })

  const setOrderedCategories = (ordered: Category[]) => { if (organizing) setOrder(ordered.map((category) => category.id)) }
  const onDragEnd = (event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id || !organizing) return
    const from = items.findIndex((item) => item.id === event.active.id)
    const to = items.findIndex((item) => item.id === event.over?.id)
    setOrderedCategories(arrayMove(items, from, to))
  }
  const startOrganizing = () => { setOrder(items.map((category) => category.id)); setOrganizing(true); setFeedback(null) }
  const cancelOrganizing = () => { setOrder([]); setOrganizing(false) }
  const requestFormClose = () => {
    if (!form.formState.isDirty || window.confirm('Descartar as alterações que ainda não foram salvas?')) { setFormError(''); setEditing(null) }
  }
  const requestDelete = (category: Category) => {
    if (category.products.length > 0) {
      setBlockedCategory(category)
      setFeedback({ kind: 'error', message: `“${category.name}” contém ${category.products.length} ${category.products.length === 1 ? 'produto' : 'produtos'}. Mova ou exclua esses produtos antes.` })
      return
    }
    setBlockedCategory(null)
    setDeleting(category)
  }

  if (isLoading) return <AdminState message="Carregando categorias…" />
  if (error || !data) return <AdminState error message={messageFromError(error)} onRetry={() => void refetch()} retrying={isFetching} />
  return <div className="mx-auto w-full max-w-[72rem]">
    <div className="mb-[1.3rem] flex flex-wrap items-end justify-between gap-4"><div><p className="mb-[.2rem] text-[.75rem] font-[850] uppercase tracking-[.1em] text-[var(--color-brand-strong)]">Cardápio</p><h1 className="m-0 text-[clamp(1.8rem,7vw,2.5rem)] tracking-[-.035em]">Categorias</h1><span className="mt-[.35rem] block text-muted">Crie as seções do cardápio e organize quando precisar.</span></div><button className={primaryButton} type="button" onClick={() => { setFormError(''); setEditing('new') }}><Plus /> Nova categoria</button></div>
    {feedback && <AdminNotice notice={feedback} action={blockedCategory ? <Link className={`font-[800] text-inherit ${focusRing}`} to={`/admin/produtos?categoria=${encodeURIComponent(blockedCategory.id)}`}>Ver produtos</Link> : undefined} />}
    <div className="mb-[.65rem] flex min-h-12 flex-wrap items-center justify-between gap-[.6rem] text-[.82rem] text-muted max-[649px]:items-stretch">{organizing ? <><span>Organize por arraste ou pelos botões.</span><div className="flex flex-wrap gap-2 max-[649px]:grid max-[649px]:w-full max-[649px]:grid-cols-2"><button className={secondaryButton} type="button" onClick={cancelOrganizing}><X /> Cancelar</button><button className={primaryButton} type="button" disabled={reorder.isPending} onClick={() => reorder.mutate(items)}><Check /> {reorder.isPending ? 'Salvando…' : 'Salvar ordem'}</button></div></> : items.length > 1 ? <button className={secondaryButton} type="button" onClick={startOrganizing}><ListOrdered /> Organizar categorias</button> : null}</div>
    <section className={cn('rounded-[.85rem] border border-border bg-surface-strong p-[.4rem] shadow-menu-sm', organizing && 'border-[color-mix(in_srgb,var(--color-brand)_45%,var(--color-border))]')}>
      {!items.length ? <div className="grid justify-items-center gap-2 p-12 text-center text-muted"><strong className="text-text">Nenhuma categoria cadastrada.</strong><span>Crie uma categoria antes de adicionar produtos.</span><button className={primaryButton} type="button" onClick={() => { setFormError(''); setEditing('new') }}><Plus /> Criar categoria</button></div> : <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}><SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>{items.map((category, index) => <SortableCategory key={category.id} category={category} index={index} total={items.length} organizing={organizing} onMove={(direction) => setOrderedCategories(arrayMove(items, index, index + direction))} onEdit={() => { setFormError(''); setEditing(category) }} onDelete={() => requestDelete(category)} />)}</SortableContext></DndContext>}
    </section>
    {editing && <AdminDialog onClose={requestFormClose}><section className="w-full max-h-[94dvh] overflow-y-auto rounded-[1.2rem_1.2rem_0_0] bg-surface-strong p-4 shadow-menu-lg md:w-[min(100%,42rem)] md:rounded-[1rem]" aria-labelledby="category-form-title"><div className="mb-4 flex items-center justify-between gap-4"><h2 className="m-0" id="category-form-title">{editing === 'new' ? 'Nova categoria' : 'Editar categoria'}</h2><button className={`grid h-11 w-11 place-items-center rounded-full bg-[#efebe5] text-[1.5rem] ${focusRing}`} type="button" aria-label="Fechar" onClick={requestFormClose}><X /></button></div><form className="grid gap-[.9rem]" noValidate onSubmit={form.handleSubmit((input) => save.mutate(input))}>
      {formError && <AdminNotice notice={{ kind: 'error', message: formError }} />}
      <label className={fieldLabel}>Nome<input className={textInput} {...form.register('name')} autoFocus maxLength={80} placeholder="Ex.: Bebidas" aria-invalid={Boolean(form.formState.errors.name)} /><small className={fieldHelp}>Prefira nomes curtos, com duas ou três palavras. Use a descrição para explicar detalhes.</small>{form.formState.errors.name && <small className={fieldError}>{form.formState.errors.name.message}</small>}</label>
      <label className={fieldLabel}>Descrição <small>(opcional)</small><textarea className={`${textInput} resize-y`} rows={3} {...form.register('description', { setValueAs: (value) => value || null })} /></label>
      <label className={checkField}><input className="h-[1.15rem] w-[1.15rem] accent-[var(--color-brand)]" type="checkbox" {...form.register('isActive')} /> Mostrar categoria no cardápio</label>
      <div className="mt-2 flex flex-wrap justify-end gap-[.55rem]"><button className={secondaryButton} type="button" onClick={requestFormClose}>Cancelar</button><button className={primaryButton} type="submit" disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar categoria'}</button></div>
    </form></section></AdminDialog>}
    {deleting && <ConfirmDialog title={`Excluir “${deleting.name}”?`} description="A categoria está vazia e será removida permanentemente. Essa ação não pode ser desfeita." confirmLabel="Excluir categoria" busy={remove.isPending} onClose={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting.id)} />}
  </div>
}
