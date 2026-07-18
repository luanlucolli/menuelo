import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { Category, CategoryInput } from '../../../../shared/schemas'
import { categoryInputSchema } from '../../../../shared/schemas'
import { api, jsonBody, messageFromError } from '../../lib/api'
import { AdminState } from './DashboardPage'
import { useAdminMenu } from './hooks'

function SortableCategory({ category, index, total, onEdit, onDelete, onMove }: { category: Category; index: number; total: number; onEdit: () => void; onDelete: () => void; onMove: (direction: -1 | 1) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id })
  return <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`admin-list-row${isDragging ? ' dragging' : ''}`}>
    <button className="drag-handle" type="button" aria-label={`Arrastar ${category.name}`} {...attributes} {...listeners}><GripVertical /></button>
    <div className="list-copy"><strong>{category.name}</strong><span>{category.products.length} produto(s) · {category.isActive ? 'Ativa' : 'Inativa'}</span></div>
    <div className="row-actions"><button type="button" disabled={index === 0} aria-label="Mover para cima" onClick={() => onMove(-1)}><ArrowUp /></button><button type="button" disabled={index === total - 1} aria-label="Mover para baixo" onClick={() => onMove(1)}><ArrowDown /></button><button type="button" aria-label="Editar" onClick={onEdit}><Pencil /></button><button className="danger-icon" type="button" aria-label="Excluir" onClick={onDelete}><Trash2 /></button></div>
  </article>
}

export function CategoriesPage() {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useAdminMenu()
  const [order, setOrder] = useState<string[]>([])
  const [editing, setEditing] = useState<Category | null | 'new'>(null)
  const [feedback, setFeedback] = useState('')
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const form = useForm<CategoryInput>({ resolver: zodResolver(categoryInputSchema), defaultValues: { name: '', description: null, isActive: true, sortOrder: 0 } })
  const items = useMemo(() => {
    const base = [...(data?.categories ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)
    if (!order.length) return base
    const byId = new Map(base.map((category) => [category.id, category]))
    return [...order.map((id) => byId.get(id)).filter((category): category is Category => Boolean(category)), ...base.filter((category) => !order.includes(category.id))]
  }, [data, order])
  useEffect(() => {
    if (editing && editing !== 'new') form.reset({ name: editing.name, description: editing.description, isActive: editing.isActive, sortOrder: editing.sortOrder })
    if (editing === 'new') form.reset({ name: '', description: null, isActive: true, sortOrder: items.length })
  }, [editing, form, items.length])

  const invalidate = async () => { await queryClient.invalidateQueries({ queryKey: ['admin'] }); await queryClient.invalidateQueries({ queryKey: ['menu'] }) }
  const reorder = useMutation({ mutationFn: (ordered: Category[]) => api('/admin/api/categories/reorder', { method: 'POST', body: jsonBody({ items: ordered.map((item, index) => ({ id: item.id, sortOrder: index })) }) }), onSuccess: invalidate, onError: (cause) => setFeedback(messageFromError(cause)) })
  const save = useMutation({ mutationFn: (input: CategoryInput) => {
    if (editing === 'new') return api('/admin/api/categories', { method: 'POST', body: jsonBody(input) })
    if (!editing) throw new Error('Categoria não selecionada.')
    return api(`/admin/api/categories/${editing.id}`, { method: 'PATCH', body: jsonBody(input) })
  }, onSuccess: async () => { setEditing(null); setFeedback('Categoria salva.'); await invalidate() }, onError: (cause) => setFeedback(messageFromError(cause)) })
  const remove = useMutation({ mutationFn: (id: string) => api(`/admin/api/categories/${id}`, { method: 'DELETE' }), onSuccess: async () => { setFeedback('Categoria excluída.'); await invalidate() }, onError: (cause) => setFeedback(messageFromError(cause)) })

  const persistOrder = (ordered: Category[]) => { setOrder(ordered.map((category) => category.id)); reorder.mutate(ordered) }
  const onDragEnd = (event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) return
    const from = items.findIndex((item) => item.id === event.active.id)
    const to = items.findIndex((item) => item.id === event.over?.id)
    persistOrder(arrayMove(items, from, to))
  }
  const move = (index: number, direction: -1 | 1) => persistOrder(arrayMove(items, index, index + direction))

  if (isLoading) return <AdminState message="Carregando categorias…" />
  if (error) return <AdminState error message={messageFromError(error)} />
  return <div className="admin-page">
    <div className="admin-heading"><div><p>Cardápio</p><h1>Categorias</h1><span>Arraste pela alça ou use as setas para definir a ordem.</span></div><button className="primary-button" type="button" onClick={() => setEditing('new')}><Plus /> Nova categoria</button></div>
    {feedback && <p className="feedback" role="status">{feedback}</p>}
    <section className="admin-card list-card">
      {!items.length ? <div className="admin-empty">Nenhuma categoria cadastrada.</div> : <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}><SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>{items.map((category, index) => <SortableCategory key={category.id} category={category} index={index} total={items.length} onMove={(direction) => move(index, direction)} onEdit={() => setEditing(category)} onDelete={() => { if (window.confirm(`Excluir a categoria “${category.name}”?`)) remove.mutate(category.id) }} />)}</SortableContext></DndContext>}
    </section>
    {editing && <div className="form-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null) }}><section className="admin-form-dialog" role="dialog" aria-modal="true" aria-labelledby="category-form-title"><div className="form-dialog-heading"><h2 id="category-form-title">{editing === 'new' ? 'Nova categoria' : 'Editar categoria'}</h2><button type="button" aria-label="Fechar" onClick={() => setEditing(null)}>×</button></div><form onSubmit={form.handleSubmit((input) => save.mutate(input))}>
      <label>Nome<input {...form.register('name')} autoFocus />{form.formState.errors.name && <small>{form.formState.errors.name.message}</small>}</label>
      <label>Descrição<textarea rows={3} {...form.register('description', { setValueAs: (value) => value || null })} /></label>
      <label className="check-field"><input type="checkbox" {...form.register('isActive')} /> Categoria ativa</label>
      <div className="form-actions"><button className="secondary-button" type="button" onClick={() => setEditing(null)}>Cancelar</button><button className="primary-button" type="submit" disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar categoria'}</button></div>
    </form></section></div>}
  </div>
}
