import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ImageIcon, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import {
  deliveryZoneInputSchema,
  hourInputSchema,
  paymentMethodInputSchema,
  settingsInputSchema,
  type BusinessHour,
  type DeliveryZone,
  type DeliveryZoneInput,
  type HourInput,
  type PaymentMethod,
  type PaymentMethodInput,
  type SettingsInput,
} from '../../../../shared/schemas'
import { formatMoney } from '../../../../shared/utils'
import { api, jsonBody, messageFromError } from '../../lib/api'
import { prepareImage } from '../../lib/image'
import { AdminState } from './DashboardPage'
import { useAdminMenu } from './hooks'

const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const nullable = { setValueAs: (value: string) => value.trim() || null }

function HoursEditor({ hours, refresh }: { hours: BusinessHour[]; refresh: () => Promise<void> }) {
  const [editing, setEditing] = useState<BusinessHour | null | 'new'>(null)
  const [feedback, setFeedback] = useState('')
  const form = useForm<HourInput>({ resolver: zodResolver(hourInputSchema), defaultValues: { weekday: 0, opensAt: '18:00', closesAt: '23:00', isClosed: false, sortOrder: 0 } })
  useEffect(() => {
    if (editing === 'new') form.reset({ weekday: 0, opensAt: '18:00', closesAt: '23:00', isClosed: false, sortOrder: 0 })
    if (editing && editing !== 'new') form.reset({ weekday: editing.weekday, opensAt: editing.opensAt, closesAt: editing.closesAt, isClosed: editing.isClosed, sortOrder: editing.sortOrder })
  }, [editing, form])
  const save = async (input: HourInput) => {
    try {
      await api(editing && editing !== 'new' ? `/admin/api/hours/${editing.id}` : '/admin/api/hours', { method: editing === 'new' ? 'POST' : 'PATCH', body: jsonBody(input) })
      setEditing(null); setFeedback('Horário salvo.'); await refresh()
    } catch (cause) { setFeedback(messageFromError(cause)) }
  }
  const closed = useWatch({ control: form.control, name: 'isClosed' })
  return <section className="admin-card settings-section"><div className="card-heading"><div><h2>Horários</h2><p>Cadastre todos os dias para habilitar o status automático. É possível ter vários intervalos e fechar após meia-noite.</p></div><button className="secondary-button" type="button" onClick={() => setEditing('new')}><Plus /> Horário</button></div>{feedback && <p className="feedback" role="status">{feedback}</p>}
    <div className="compact-list">{[...hours].sort((a, b) => a.weekday - b.weekday || a.sortOrder - b.sortOrder).map((hour) => <div key={hour.id}><span><strong>{WEEKDAYS[hour.weekday]}</strong><small>{hour.isClosed ? 'Fechado' : `${hour.opensAt}–${hour.closesAt}`}</small></span><div><button type="button" aria-label="Editar horário" onClick={() => setEditing(hour)}><Pencil /></button><button type="button" aria-label="Excluir horário" onClick={async () => { if (!window.confirm('Excluir este horário?')) return; try { await api(`/admin/api/hours/${hour.id}`, { method: 'DELETE' }); await refresh() } catch (cause) { setFeedback(messageFromError(cause)) } }}><Trash2 /></button></div></div>)}</div>
    {editing && <form className="inline-editor" onSubmit={form.handleSubmit(save)}><label>Dia<select {...form.register('weekday', { valueAsNumber: true })}>{WEEKDAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label><label className="check-field"><input type="checkbox" {...form.register('isClosed', { onChange: (event) => { if (event.target.checked) { form.setValue('opensAt', null); form.setValue('closesAt', null) } else { form.setValue('opensAt', '18:00'); form.setValue('closesAt', '23:00') } } })} /> Fechado</label>{!closed && <><label>Abre<input type="time" {...form.register('opensAt')} /></label><label>Fecha<input type="time" {...form.register('closesAt')} /></label></>}<div className="form-actions"><button type="button" className="secondary-button" onClick={() => setEditing(null)}>Cancelar</button><button type="submit" className="primary-button">Salvar</button></div></form>}
  </section>
}

function PaymentsEditor({ methods, refresh }: { methods: PaymentMethod[]; refresh: () => Promise<void> }) {
  const [editing, setEditing] = useState<PaymentMethod | null | 'new'>(null)
  const [feedback, setFeedback] = useState('')
  const form = useForm<PaymentMethodInput>({ resolver: zodResolver(paymentMethodInputSchema), defaultValues: { name: '', isActive: true, sortOrder: 0 } })
  useEffect(() => { if (editing === 'new') form.reset({ name: '', isActive: true, sortOrder: methods.length }); else if (editing) form.reset({ name: editing.name, isActive: editing.isActive, sortOrder: editing.sortOrder }) }, [editing, form, methods.length])
  const save = async (input: PaymentMethodInput) => { try { await api(editing && editing !== 'new' ? `/admin/api/payment-methods/${editing.id}` : '/admin/api/payment-methods', { method: editing === 'new' ? 'POST' : 'PATCH', body: jsonBody(input) }); setEditing(null); setFeedback('Forma de pagamento salva.'); await refresh() } catch (cause) { setFeedback(messageFromError(cause)) } }
  return <section className="admin-card settings-section"><div className="card-heading"><div><h2>Formas de pagamento</h2><p>A seção pública fica oculta enquanto a lista estiver vazia.</p></div><button className="secondary-button" type="button" onClick={() => setEditing('new')}><Plus /> Forma</button></div>{feedback && <p className="feedback">{feedback}</p>}<div className="compact-list">{methods.map((method) => <div key={method.id}><span><strong>{method.name}</strong><small>{method.isActive ? 'Ativa' : 'Inativa'}</small></span><div><button type="button" onClick={() => setEditing(method)} aria-label="Editar forma"><Pencil /></button><button type="button" aria-label="Excluir forma" onClick={async () => { if (!window.confirm(`Excluir “${method.name}”?`)) return; try { await api(`/admin/api/payment-methods/${method.id}`, { method: 'DELETE' }); await refresh() } catch (cause) { setFeedback(messageFromError(cause)) } }}><Trash2 /></button></div></div>)}</div>{editing && <form className="inline-editor" onSubmit={form.handleSubmit(save)}><label>Nome<input {...form.register('name')} /></label><label className="check-field"><input type="checkbox" {...form.register('isActive')} /> Ativa</label><div className="form-actions"><button className="secondary-button" type="button" onClick={() => setEditing(null)}>Cancelar</button><button className="primary-button" type="submit">Salvar</button></div></form>}</section>
}

function ZonesEditor({ zones, refresh }: { zones: DeliveryZone[]; refresh: () => Promise<void> }) {
  const [editing, setEditing] = useState<DeliveryZone | null | 'new'>(null)
  const [feedback, setFeedback] = useState('')
  const form = useForm<DeliveryZoneInput>({ resolver: zodResolver(deliveryZoneInputSchema), defaultValues: { name: '', feeCents: null, notes: null, isActive: true, sortOrder: 0 } })
  useEffect(() => { if (editing === 'new') form.reset({ name: '', feeCents: null, notes: null, isActive: true, sortOrder: zones.length }); else if (editing) form.reset({ name: editing.name, feeCents: editing.feeCents, notes: editing.notes, isActive: editing.isActive, sortOrder: editing.sortOrder }) }, [editing, form, zones.length])
  const save = async (input: DeliveryZoneInput) => { try { await api(editing && editing !== 'new' ? `/admin/api/delivery-zones/${editing.id}` : '/admin/api/delivery-zones', { method: editing === 'new' ? 'POST' : 'PATCH', body: jsonBody(input) }); setEditing(null); setFeedback('Região salva.'); await refresh() } catch (cause) { setFeedback(messageFromError(cause)) } }
  return <section className="admin-card settings-section"><div className="card-heading"><div><h2>Regiões e taxas informativas</h2><p>Não há cálculo de frete ou sistema de delivery.</p></div><button className="secondary-button" type="button" onClick={() => setEditing('new')}><Plus /> Região</button></div>{feedback && <p className="feedback">{feedback}</p>}<div className="compact-list">{zones.map((zone) => <div key={zone.id}><span><strong>{zone.name}</strong><small>{zone.feeCents === null ? 'Taxa a consultar' : formatMoney(zone.feeCents)}{zone.notes ? ` · ${zone.notes}` : ''} · {zone.isActive ? 'Ativa' : 'Inativa'}</small></span><div><button type="button" onClick={() => setEditing(zone)} aria-label="Editar região"><Pencil /></button><button type="button" aria-label="Excluir região" onClick={async () => { if (!window.confirm(`Excluir “${zone.name}”?`)) return; try { await api(`/admin/api/delivery-zones/${zone.id}`, { method: 'DELETE' }); await refresh() } catch (cause) { setFeedback(messageFromError(cause)) } }}><Trash2 /></button></div></div>)}</div>{editing && <form className="inline-editor zone-editor" onSubmit={form.handleSubmit(save)}><label>Nome<input {...form.register('name')} /></label><label>Taxa em centavos<input type="number" min="0" placeholder="Opcional" {...form.register('feeCents', { setValueAs: (value) => value === '' ? null : Number(value) })} /></label><label>Observação<input {...form.register('notes', nullable)} /></label><label className="check-field"><input type="checkbox" {...form.register('isActive')} /> Ativa</label><div className="form-actions"><button className="secondary-button" type="button" onClick={() => setEditing(null)}>Cancelar</button><button className="primary-button" type="submit">Salvar</button></div></form>}</section>
}

export function SettingsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useAdminMenu()
  const [feedback, setFeedback] = useState('')
  const [imageBusy, setImageBusy] = useState(false)
  const form = useForm<SettingsInput>({ resolver: zodResolver(settingsInputSchema) })
  useEffect(() => { if (data) { const { business } = data; form.reset({ name: business.name, slug: business.slug, slogan: business.slogan, description: business.description, whatsapp: business.whatsapp, phone: business.phone, instagramUrl: business.instagramUrl, facebookUrl: business.facebookUrl, address: business.address, mapsUrl: business.mapsUrl, timezone: business.timezone, specialMessage: business.specialMessage, publicSiteUrl: business.publicSiteUrl, seoTitle: business.seoTitle, seoDescription: business.seoDescription }) } }, [data, form])
  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: ['admin'] }); await queryClient.invalidateQueries({ queryKey: ['menu'] }) }
  const save = useMutation({ mutationFn: (input: SettingsInput) => api('/admin/api/settings', { method: 'PATCH', body: jsonBody(input) }), onSuccess: async () => { setFeedback('Configurações salvas.'); await refresh() }, onError: (cause) => setFeedback(messageFromError(cause)) })
  if (isLoading) return <AdminState message="Carregando configurações…" />
  if (error || !data) return <AdminState error message={messageFromError(error)} />
  const business = data.business
  return <div className="admin-page settings-page"><div className="admin-heading"><div><p>Estabelecimento</p><h1>Configurações</h1><span>Campos vazios permanecem ocultos no cardápio público.</span></div></div>{feedback && <p className="feedback" role="status">{feedback}</p>}
    <form onSubmit={form.handleSubmit((input) => save.mutate(input))}>
      <section className="admin-card settings-section"><div className="card-heading"><div><h2>Identidade textual</h2><p>Logo, cores e fontes permanecem centralizados no código nesta versão.</p></div></div><div className="settings-grid"><label>Nome<input {...form.register('name')} /></label><label>Slug<input {...form.register('slug')} /></label><label>Slogan<input {...form.register('slogan', nullable)} /></label><label className="wide">Descrição<textarea rows={3} {...form.register('description', nullable)} /></label><label className="wide">Mensagem especial<textarea rows={2} {...form.register('specialMessage', nullable)} /></label><label>Fuso horário<input {...form.register('timezone')} /></label></div></section>
      <section className="admin-card settings-section"><div className="card-heading"><div><h2>Banner/capa</h2><p>Imagem opcional exibida no topo do cardápio.</p></div></div><div className="cover-admin">{business.coverImageKey ? <img src={`/media/${business.coverImageKey}`} alt="Capa atual" /> : <div><ImageIcon /><span>Nenhuma capa configurada</span></div>}<div className="inline-actions"><label className="secondary-button file-button">{imageBusy ? 'Processando…' : 'Enviar capa'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={imageBusy} onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setImageBusy(true); try { const blob = await prepareImage(file); await api('/admin/api/settings/cover-image', { method: 'POST', headers: { 'Content-Type': 'image/webp' }, body: blob }); setFeedback('Capa atualizada.'); await refresh() } catch (cause) { setFeedback(messageFromError(cause)) } finally { setImageBusy(false) } }} /></label>{business.coverImageKey && <button type="button" className="text-danger" onClick={async () => { if (!window.confirm('Remover a capa atual?')) return; try { await api('/admin/api/settings/cover-image', { method: 'DELETE' }); await refresh() } catch (cause) { setFeedback(messageFromError(cause)) } }}>Remover capa</button>}</div></div></section>
      <section className="admin-card settings-section"><div className="card-heading"><div><h2>Contato e localização</h2><p>Não preencha dados que ainda não foram confirmados.</p></div></div><div className="settings-grid"><label>WhatsApp<input {...form.register('whatsapp', nullable)} placeholder="Somente quando confirmado" /></label><label>Telefone<input {...form.register('phone', nullable)} /></label><label>Instagram (URL)<input type="url" {...form.register('instagramUrl', nullable)} /></label><label>Facebook (URL)<input type="url" {...form.register('facebookUrl', nullable)} /></label><label className="wide">Endereço<textarea rows={2} {...form.register('address', nullable)} /></label><label className="wide">Google Maps (URL)<input type="url" {...form.register('mapsUrl', nullable)} /></label></div></section>
      <section className="admin-card settings-section"><div className="card-heading"><div><h2>URL pública e SEO</h2><p>A URL pública é usada no canonical e no QR Code.</p></div></div><div className="settings-grid"><label className="wide">URL pública<input type="url" {...form.register('publicSiteUrl', nullable)} placeholder="https://..." /></label><label className="wide">Título SEO<input {...form.register('seoTitle', nullable)} /></label><label className="wide">Descrição SEO<textarea rows={3} {...form.register('seoDescription', nullable)} /></label></div></section>
      <div className="settings-save"><button className="primary-button" type="submit" disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar configurações'}</button></div>
    </form>
    <HoursEditor hours={data.hours} refresh={refresh} />
    <PaymentsEditor methods={data.paymentMethods} refresh={refresh} />
    <ZonesEditor zones={data.deliveryZones} refresh={refresh} />
  </div>
}
