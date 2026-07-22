import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock3, CreditCard, ImageIcon, MapPin, Pencil, Plus, Settings2, Store, Trash2 } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  DEFAULT_PRIMARY_COLOR,
  deliveryZoneInputSchema,
  hourInputSchema,
  paymentMethodInputSchema,
  settingsInputSchema,
  type BusinessSettings,
  type BusinessHour,
  type DeliveryZone,
  type DeliveryZoneInput,
  type HourInput,
  type PaymentMethod,
  type PaymentMethodInput,
  type SettingsInput,
} from '../../../../shared/schemas'
import { formatMoney, readableBrandText } from '../../../../shared/utils'
import { api, jsonBody, messageFromError, uploadBlob } from '../../lib/api'
import { prepareImage } from '../../lib/image'
import { AdminNotice, type Notice } from './AdminNotice'
import { AddressFields } from './AddressFields'
import { ConfirmDialog } from './ConfirmDialog'
import { AdminState } from './DashboardPage'
import { MoneyInput } from './MoneyInput'
import { publicChangeNotice } from './publicationNotice'
import { BackupManager } from './ImportExportPage'
import { useAdminMenu } from './hooks'

const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const nullable = { setValueAs: (value: unknown) => typeof value === 'string' ? value.trim() || null : null }
type SettingsSection = 'business' | 'contact' | 'hours' | 'service' | 'appearance' | 'advanced'
type ColorPreviewStyle = CSSProperties & { '--preview-brand': string; '--preview-brand-text': string }

const sections: { id: SettingsSection; label: string; icon: typeof Store }[] = [
  { id: 'business', label: 'Lanchonete', icon: Store },
  { id: 'contact', label: 'Contato e endereço', icon: MapPin },
  { id: 'hours', label: 'Horários', icon: Clock3 },
  { id: 'service', label: 'Atendimento', icon: CreditCard },
  { id: 'appearance', label: 'Aparência', icon: ImageIcon },
  { id: 'advanced', label: 'Avançado', icon: Settings2 },
]

const settingsFieldsBySection: Partial<Record<SettingsSection, readonly (keyof SettingsInput)[]>> = {
  business: ['name', 'slogan', 'description', 'specialMessage'],
  contact: ['whatsapp', 'phone', 'instagramUrl', 'facebookUrl', 'address', 'addressPostalCode', 'addressStreet', 'addressNumber', 'addressComplement', 'addressNeighborhood', 'addressCity', 'addressState', 'mapsUrl'],
  appearance: ['primaryColor'],
  advanced: ['slug', 'timezone', 'seoTitle', 'seoDescription'],
}

function formatSectionList(labels: string[]): string {
  return new Intl.ListFormat('pt-BR', { style: 'long', type: 'conjunction' }).format(labels)
}

function settingsFromBusiness(business: BusinessSettings): SettingsInput {
  return settingsInputSchema.parse(business)
}

function HoursEditor({ hours, refresh }: { hours: BusinessHour[]; refresh: () => Promise<void> }) {
  const [editing, setEditing] = useState<BusinessHour | null | 'new'>(null)
  const [deleting, setDeleting] = useState<BusinessHour | null>(null)
  const [copyDays, setCopyDays] = useState<number[]>([])
  const [feedback, setFeedback] = useState<Notice | null>(null)
  const [saving, setSaving] = useState(false)
  const form = useForm<HourInput>({ resolver: zodResolver(hourInputSchema), defaultValues: { weekday: 1, opensAt: '18:00', closesAt: '23:00', isClosed: false, sortOrder: 0 } })
  const closed = useWatch({ control: form.control, name: 'isClosed' })
  const selectedWeekday = useWatch({ control: form.control, name: 'weekday' })
  const usedWeekdays = new Set(hours.map((hour) => hour.weekday))
  const firstAvailableWeekday = WEEKDAYS.findIndex((_day, index) => !usedWeekdays.has(index))

  const openNew = () => { if (firstAvailableWeekday < 0) return; form.reset({ weekday: firstAvailableWeekday, opensAt: '18:00', closesAt: '23:00', isClosed: false, sortOrder: hours.length }); setCopyDays([]); setEditing('new'); setFeedback(null) }
  const openEdit = (hour: BusinessHour) => { form.reset({ weekday: hour.weekday, opensAt: hour.opensAt, closesAt: hour.closesAt, isClosed: hour.isClosed, sortOrder: hour.sortOrder }); setCopyDays([]); setEditing(hour); setFeedback(null) }
  const cancel = () => { if (!form.formState.isDirty || window.confirm('Descartar as alterações deste horário?')) setEditing(null) }
  const save = async (input: HourInput) => {
    setSaving(true)
    try {
      await api(editing && editing !== 'new' ? `/admin/api/hours/${editing.id}` : '/admin/api/hours', { method: editing === 'new' ? 'POST' : 'PATCH', body: jsonBody(input) })
      if (editing === 'new') {
        const copies = await Promise.allSettled(copyDays.filter((day) => day !== input.weekday && !usedWeekdays.has(day)).map((weekday, index) => api('/admin/api/hours', { method: 'POST', body: jsonBody({ ...input, weekday, sortOrder: hours.length + index + 1 }) })))
        const failures = copies.filter((result) => result.status === 'rejected').length
        setEditing(null)
        await refresh()
        if (failures) {
          setFeedback({ kind: 'error', message: `O horário principal foi salvo, mas ${failures} ${failures === 1 ? 'dia não foi copiado' : 'dias não foram copiados'}. Revise a lista e tente novamente.` })
          return
        }
      }
      setEditing(null); setFeedback(publicChangeNotice(copyDays.length ? 'Horários da semana salvos.' : 'Horário salvo.')); await refresh()
    } catch (cause) { setFeedback({ kind: 'error', message: messageFromError(cause) }) } finally { setSaving(false) }
  }
  const remove = async () => {
    if (!deleting) return
    try { await api(`/admin/api/hours/${deleting.id}`, { method: 'DELETE' }); setDeleting(null); setFeedback(publicChangeNotice('Horário excluído.')); await refresh() } catch (cause) { setDeleting(null); setFeedback({ kind: 'error', message: messageFromError(cause) }) }
  }

  return <section className="admin-card settings-section"><div className="card-heading"><div><h2>Horários de atendimento</h2><p>Cadastre os sete dias para mostrar automaticamente se a lanchonete está aberta.</p></div><button className="secondary-button" type="button" disabled={firstAvailableWeekday < 0} onClick={openNew}><Plus /> {firstAvailableWeekday < 0 ? 'Semana completa' : 'Adicionar horário'}</button></div>
    {feedback && <AdminNotice notice={feedback} />}
    {!hours.length ? <div className="admin-empty compact-empty"><strong>Nenhum horário informado.</strong><span>Adicione o primeiro dia para começar.</span><button className="secondary-button" type="button" onClick={openNew}><Plus /> Adicionar horário</button></div> : <div className="compact-list">{[...hours].sort((a, b) => a.weekday - b.weekday || a.sortOrder - b.sortOrder).map((hour) => <div key={hour.id}><span><strong>{WEEKDAYS[hour.weekday]}</strong><small>{hour.isClosed ? 'Fechado' : `${hour.opensAt}–${hour.closesAt}`}</small></span><div><button type="button" aria-label={`Editar horário de ${WEEKDAYS[hour.weekday]}`} onClick={() => openEdit(hour)}><Pencil /></button><button type="button" className="danger-icon" aria-label={`Excluir horário de ${WEEKDAYS[hour.weekday]}`} onClick={() => setDeleting(hour)}><Trash2 /></button></div></div>)}</div>}
    {editing && <form className="inline-editor" noValidate onSubmit={form.handleSubmit(save)}><label>Dia<select {...form.register('weekday', { valueAsNumber: true })}>{WEEKDAYS.map((day, index) => <option key={day} value={index} disabled={usedWeekdays.has(index) && (editing === 'new' || editing.weekday !== index)}>{day}{usedWeekdays.has(index) && (editing === 'new' || editing.weekday !== index) ? ' — já cadastrado' : ''}</option>)}</select></label><label className="check-field"><input type="checkbox" {...form.register('isClosed', { onChange: (event) => { if (event.target.checked) { form.setValue('opensAt', null); form.setValue('closesAt', null) } else { form.setValue('opensAt', '18:00'); form.setValue('closesAt', '23:00') } } })} /> Fechado neste dia</label>{!closed && <><label>Abre às<input type="time" {...form.register('opensAt')} />{form.formState.errors.opensAt && <small className="field-error">{form.formState.errors.opensAt.message}</small>}</label><label>Fecha às<input type="time" {...form.register('closesAt')} />{form.formState.errors.closesAt && <small className="field-error">{form.formState.errors.closesAt.message}</small>}</label></>}{editing === 'new' && <fieldset className="copy-days"><legend>Repetir este horário em outros dias <small>(opcional)</small></legend>{WEEKDAYS.map((day, index) => index === selectedWeekday || usedWeekdays.has(index) ? null : <label className="check-field" key={day}><input type="checkbox" checked={copyDays.includes(index)} onChange={(event) => setCopyDays((current) => event.target.checked ? [...current, index] : current.filter((dayIndex) => dayIndex !== index))} /> {day}</label>)}</fieldset>}<div className="form-actions"><button type="button" className="secondary-button" disabled={saving} onClick={cancel}>Cancelar</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Salvando…' : 'Salvar horário'}</button></div></form>}
    {deleting && <ConfirmDialog title={`Excluir horário de ${WEEKDAYS[deleting.weekday]}?`} description="Este horário deixará de aparecer no cardápio." confirmLabel="Excluir horário" onClose={() => setDeleting(null)} onConfirm={() => void remove()} />}
  </section>
}

function PaymentsEditor({ methods, refresh }: { methods: PaymentMethod[]; refresh: () => Promise<void> }) {
  const [editing, setEditing] = useState<PaymentMethod | null | 'new'>(null)
  const [deleting, setDeleting] = useState<PaymentMethod | null>(null)
  const [feedback, setFeedback] = useState<Notice | null>(null)
  const form = useForm<PaymentMethodInput>({ resolver: zodResolver(paymentMethodInputSchema), defaultValues: { name: '', isActive: true, sortOrder: 0 } })
  const openNew = () => { form.reset({ name: '', isActive: true, sortOrder: methods.length }); setEditing('new'); setFeedback(null) }
  const openEdit = (method: PaymentMethod) => { form.reset({ name: method.name, isActive: method.isActive, sortOrder: method.sortOrder }); setEditing(method); setFeedback(null) }
  const cancel = () => { if (!form.formState.isDirty || window.confirm('Descartar as alterações?')) setEditing(null) }
  const save = async (input: PaymentMethodInput) => { try { await api(editing && editing !== 'new' ? `/admin/api/payment-methods/${editing.id}` : '/admin/api/payment-methods', { method: editing === 'new' ? 'POST' : 'PATCH', body: jsonBody(input) }); setEditing(null); setFeedback(publicChangeNotice('Forma de pagamento salva.')); await refresh() } catch (cause) { setFeedback({ kind: 'error', message: messageFromError(cause) }) } }
  const remove = async () => { if (!deleting) return; try { await api(`/admin/api/payment-methods/${deleting.id}`, { method: 'DELETE' }); setDeleting(null); setFeedback(publicChangeNotice('Forma de pagamento excluída.')); await refresh() } catch (cause) { setDeleting(null); setFeedback({ kind: 'error', message: messageFromError(cause) }) } }
  return <section className="admin-card settings-section"><div className="card-heading"><div><h2>Formas de pagamento</h2><p>Mostre aos clientes quais formas são aceitas.</p></div><button className="secondary-button" type="button" onClick={openNew}><Plus /> Adicionar forma</button></div>{feedback && <AdminNotice notice={feedback} />}{!methods.length ? <div className="admin-empty compact-empty"><strong>Nenhuma forma cadastrada.</strong><span>Essa informação permanece oculta no cardápio.</span></div> : <div className="compact-list">{methods.map((method) => <div key={method.id}><span><strong>{method.name}</strong><small>{method.isActive ? 'Exibida no cardápio' : 'Oculta'}</small></span><div><button type="button" onClick={() => openEdit(method)} aria-label={`Editar ${method.name}`}><Pencil /></button><button type="button" className="danger-icon" aria-label={`Excluir ${method.name}`} onClick={() => setDeleting(method)}><Trash2 /></button></div></div>)}</div>}{editing && <form className="inline-editor" noValidate onSubmit={form.handleSubmit(save)}><label>Nome<input {...form.register('name')} autoFocus aria-invalid={Boolean(form.formState.errors.name)} />{form.formState.errors.name && <small className="field-error">Informe o nome da forma de pagamento.</small>}</label><label className="check-field"><input type="checkbox" {...form.register('isActive')} /> Mostrar no cardápio</label><div className="form-actions"><button className="secondary-button" type="button" onClick={cancel}>Cancelar</button><button className="primary-button" type="submit">Salvar forma</button></div></form>}{deleting && <ConfirmDialog title={`Excluir “${deleting.name}”?`} description="A forma de pagamento deixará de aparecer no cardápio." confirmLabel="Excluir forma" onClose={() => setDeleting(null)} onConfirm={() => void remove()} />}</section>
}

function ZonesEditor({ zones, refresh }: { zones: DeliveryZone[]; refresh: () => Promise<void> }) {
  const [editing, setEditing] = useState<DeliveryZone | null | 'new'>(null)
  const [deleting, setDeleting] = useState<DeliveryZone | null>(null)
  const [feedback, setFeedback] = useState<Notice | null>(null)
  const form = useForm<DeliveryZoneInput>({ resolver: zodResolver(deliveryZoneInputSchema), defaultValues: { name: '', feeCents: null, notes: null, isActive: true, sortOrder: 0 } })
  const openNew = () => { form.reset({ name: '', feeCents: null, notes: null, isActive: true, sortOrder: zones.length }); setEditing('new'); setFeedback(null) }
  const openEdit = (zone: DeliveryZone) => { form.reset({ name: zone.name, feeCents: zone.feeCents, notes: zone.notes, isActive: zone.isActive, sortOrder: zone.sortOrder }); setEditing(zone); setFeedback(null) }
  const cancel = () => { if (!form.formState.isDirty || window.confirm('Descartar as alterações?')) setEditing(null) }
  const save = async (input: DeliveryZoneInput) => { try { await api(editing && editing !== 'new' ? `/admin/api/delivery-zones/${editing.id}` : '/admin/api/delivery-zones', { method: editing === 'new' ? 'POST' : 'PATCH', body: jsonBody(input) }); setEditing(null); setFeedback(publicChangeNotice('Região salva.')); await refresh() } catch (cause) { setFeedback({ kind: 'error', message: messageFromError(cause) }) } }
  const remove = async () => { if (!deleting) return; try { await api(`/admin/api/delivery-zones/${deleting.id}`, { method: 'DELETE' }); setDeleting(null); setFeedback(publicChangeNotice('Região excluída.')); await refresh() } catch (cause) { setDeleting(null); setFeedback({ kind: 'error', message: messageFromError(cause) }) } }
  return <section className="admin-card settings-section"><div className="card-heading"><div><h2>Regiões e taxas informativas</h2><p>Esses valores são apenas informativos; não há cálculo de entrega.</p></div><button className="secondary-button" type="button" onClick={openNew}><Plus /> Adicionar região</button></div>{feedback && <AdminNotice notice={feedback} />}{!zones.length ? <div className="admin-empty compact-empty"><strong>Nenhuma região cadastrada.</strong><span>Essa informação permanece oculta no cardápio.</span></div> : <div className="compact-list">{zones.map((zone) => <div key={zone.id}><span><strong>{zone.name}</strong><small>{zone.feeCents === null ? 'Taxa a consultar' : formatMoney(zone.feeCents)}{zone.notes ? ` · ${zone.notes}` : ''} · {zone.isActive ? 'Exibida' : 'Oculta'}</small></span><div><button type="button" onClick={() => openEdit(zone)} aria-label={`Editar ${zone.name}`}><Pencil /></button><button type="button" className="danger-icon" aria-label={`Excluir ${zone.name}`} onClick={() => setDeleting(zone)}><Trash2 /></button></div></div>)}</div>}{editing && <form className="inline-editor zone-editor" noValidate onSubmit={form.handleSubmit(save)}><label>Nome da região<input {...form.register('name')} autoFocus aria-invalid={Boolean(form.formState.errors.name)} />{form.formState.errors.name && <small className="field-error">Informe o nome da região.</small>}</label><Controller control={form.control} name="feeCents" render={({ field }) => <MoneyInput id="delivery-zone-fee" label="Taxa" optional value={field.value} onChange={field.onChange} error={form.formState.errors.feeCents?.message} />} /><label>Observação <small>(opcional)</small><input {...form.register('notes', nullable)} /></label><label className="check-field"><input type="checkbox" {...form.register('isActive')} /> Mostrar no cardápio</label><div className="form-actions"><button className="secondary-button" type="button" onClick={cancel}>Cancelar</button><button className="primary-button" type="submit">Salvar região</button></div></form>}{deleting && <ConfirmDialog title={`Excluir “${deleting.name}”?`} description="A região e sua taxa deixarão de aparecer no cardápio." confirmLabel="Excluir região" onClose={() => setDeleting(null)} onConfirm={() => void remove()} />}</section>
}

export function SettingsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { data, isLoading, error, refetch, isFetching } = useAdminMenu()
  const [searchParams] = useSearchParams()
  const [activeSection, setActiveSection] = useState<SettingsSection>(() => searchParams.get('secao') === 'avancado' ? 'advanced' : 'business')
  const [feedback, setFeedback] = useState<Notice | null>(null)
  const [imageBusy, setImageBusy] = useState(false)
  const [imageProgress, setImageProgress] = useState<number | null>(null)
  const [faviconBusy, setFaviconBusy] = useState(false)
  const [faviconProgress, setFaviconProgress] = useState<number | null>(null)
  const [confirmCoverRemoval, setConfirmCoverRemoval] = useState(false)
  const [confirmFaviconRemoval, setConfirmFaviconRemoval] = useState(false)
  const [confirmDiscardChanges, setConfirmDiscardChanges] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
  const form = useForm<SettingsInput>({ resolver: zodResolver(settingsInputSchema) })
  const primaryColor = useWatch({ control: form.control, name: 'primaryColor' }) || DEFAULT_PRIMARY_COLOR
  useEffect(() => { if (data && !form.formState.isDirty) form.reset(settingsFromBusiness(data.business)) }, [data, form])
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (!form.formState.isDirty) return; event.preventDefault() }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn) }, [form.formState.isDirty])
  useEffect(() => {
    if (!form.formState.isDirty) return
    const interceptNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest<HTMLAnchorElement>('a[href]')
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const destination = new URL(anchor.href, window.location.href)
      if (destination.origin !== window.location.origin) return
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
      const next = `${destination.pathname}${destination.search}${destination.hash}`
      if (next === current) return
      event.preventDefault()
      setPendingNavigation(next)
    }
    document.addEventListener('click', interceptNavigation, true)
    return () => document.removeEventListener('click', interceptNavigation, true)
  }, [form.formState.isDirty])
  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: ['admin'] }) }
  const save = useMutation({ mutationFn: (input: SettingsInput) => api<BusinessSettings>('/admin/api/settings', { method: 'PATCH', body: jsonBody(input) }), onSuccess: async (saved) => { form.reset(settingsFromBusiness(saved)); setFeedback(publicChangeNotice('Informações salvas.')); await refresh() }, onError: (cause) => setFeedback({ kind: 'error', message: messageFromError(cause) }) })

  const uploadCover = async (file: File) => {
    setImageBusy(true); setImageProgress(null); setFeedback(null)
    try { const blob = await prepareImage(file); setImageProgress(0); await uploadBlob('/admin/api/settings/cover-image', blob, setImageProgress); setFeedback(publicChangeNotice(form.formState.isDirty ? 'Capa salva automaticamente. A alteração de cor ainda precisa ser salva.' : 'Capa atualizada e salva automaticamente.')); await refresh() } catch (cause) { setFeedback({ kind: 'error', message: messageFromError(cause) }) } finally { setImageBusy(false); setImageProgress(null) }
  }
  const removeCover = async () => { try { await api('/admin/api/settings/cover-image', { method: 'DELETE' }); setConfirmCoverRemoval(false); setFeedback(publicChangeNotice(form.formState.isDirty ? 'Capa removida e salva automaticamente. A alteração de cor ainda precisa ser salva.' : 'Capa removida e alteração salva automaticamente.')); await refresh() } catch (cause) { setConfirmCoverRemoval(false); setFeedback({ kind: 'error', message: messageFromError(cause) }) } }
  const uploadFavicon = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.ico')) {
      setFeedback({ kind: 'error', message: 'Escolha um arquivo no formato ICO.' })
      return
    }
    setFaviconBusy(true); setFaviconProgress(0); setFeedback(null)
    try { await uploadBlob('/admin/api/settings/favicon', file, setFaviconProgress); setFeedback(publicChangeNotice('Ícone do navegador atualizado.')); await refresh() } catch (cause) { setFeedback({ kind: 'error', message: messageFromError(cause) }) } finally { setFaviconBusy(false); setFaviconProgress(null) }
  }
  const removeFavicon = async () => { try { await api('/admin/api/settings/favicon', { method: 'DELETE' }); setConfirmFaviconRemoval(false); setFeedback(publicChangeNotice('Ícone do navegador removido.')); await refresh() } catch (cause) { setConfirmFaviconRemoval(false); setFeedback({ kind: 'error', message: messageFromError(cause) }) } }

  if (isLoading) return <AdminState message="Carregando configurações…" />
  if (error || !data) return <AdminState error message={messageFromError(error)} onRetry={() => void refetch()} retrying={isFetching} />
  const business = data.business
  const formSection = activeSection === 'business' || activeSection === 'contact' || activeSection === 'appearance' || activeSection === 'advanced'
  const dirtySections = sections.filter(({ id }) => settingsFieldsBySection[id]?.some((field) => Boolean(form.formState.dirtyFields[field])))
  const dirtySectionIds = new Set(dirtySections.map(({ id }) => id))
  const dirtySectionNames = formatSectionList(dirtySections.map(({ label }) => label)) || 'Configurações'
  const submitSettings = form.handleSubmit(
    (input) => save.mutate(input),
    (errors) => {
      const invalidSection = sections.find(({ id }) => settingsFieldsBySection[id]?.some((field) => Boolean(errors[field])))
      if (invalidSection) setActiveSection(invalidSection.id)
      setFeedback({ kind: 'error', message: 'Corrija os campos destacados antes de salvar.' })
    },
  )
  const discardChanges = () => {
    const navigation = pendingNavigation
    form.reset(settingsFromBusiness(business))
    setConfirmDiscardChanges(false)
    setPendingNavigation(null)
    setFeedback(null)
    if (navigation) navigate(navigation)
  }
  return <div className="admin-page settings-page"><div className="admin-heading"><div><p>Estabelecimento</p><h1>Configurações</h1><span>Escolha uma seção e altere somente o que precisa.</span></div></div>
    <nav className="settings-nav" aria-label="Seções das configurações">{sections.map(({ id, label, icon: Icon }) => <button className={activeSection === id ? 'active' : ''} type="button" key={id} onClick={() => { setActiveSection(id); setFeedback(null) }} aria-label={dirtySectionIds.has(id) ? `${label}, alterações não salvas` : label}><Icon />{label}{dirtySectionIds.has(id) && <span className="settings-unsaved">Não salvo</span>}</button>)}</nav>
    {feedback && <AdminNotice notice={feedback} />}
    {formSection && <form className="settings-main-form" noValidate onSubmit={(event) => void submitSettings(event)}>
      {activeSection === 'business' && <section className="admin-card settings-section"><div className="card-heading"><div><h2>Dados da lanchonete</h2><p>Estas informações aparecem no topo e nas mensagens do cardápio.</p></div></div><div className="settings-grid"><label>Nome da lanchonete<input {...form.register('name')} aria-invalid={Boolean(form.formState.errors.name)} />{form.formState.errors.name && <small className="field-error">Informe o nome da lanchonete.</small>}</label><label>Slogan <small>(opcional)</small><input {...form.register('slogan', nullable)} /></label><label className="wide">Descrição <small>(opcional)</small><textarea rows={3} {...form.register('description', nullable)} /></label><label className="wide">Mensagem especial <small>(opcional)</small><textarea rows={2} {...form.register('specialMessage', nullable)} placeholder="Ex.: Hoje atendemos até 23h" /></label></div></section>}
      {activeSection === 'contact' && <><section className="admin-card settings-section"><div className="card-heading"><div><h2>Contato</h2><p>Campos vazios não aparecem para os clientes.</p></div></div><div className="settings-grid"><label>WhatsApp<input inputMode="tel" {...form.register('whatsapp', nullable)} placeholder="Ex.: (11) 99999-9999" /></label><label>Telefone <small>(opcional)</small><input inputMode="tel" {...form.register('phone', nullable)} /></label><label>Link do Instagram <small>(opcional)</small><input type="url" {...form.register('instagramUrl', nullable)} placeholder="https://instagram.com/..." />{form.formState.errors.instagramUrl && <small className="field-error">Informe um link completo, começando com https://.</small>}</label><label>Link do Facebook <small>(opcional)</small><input type="url" {...form.register('facebookUrl', nullable)} />{form.formState.errors.facebookUrl && <small className="field-error">Informe um link completo.</small>}</label></div></section><AddressFields form={form} /></>}
      {activeSection === 'appearance' && <div className="settings-subsections"><section className="admin-card settings-section"><div className="card-heading"><div><h2>Cor principal do cardápio</h2><p>Usada nos destaques, botões e detalhes vistos pelos clientes.</p></div></div><Controller control={form.control} name="primaryColor" render={({ field }) => {
        const validColor = /^#[0-9a-fA-F]{6}$/.test(field.value) ? field.value : DEFAULT_PRIMARY_COLOR
        const previewStyle: ColorPreviewStyle = { '--preview-brand': validColor, '--preview-brand-text': readableBrandText(validColor) }
        return <div className="color-editor"><div className="color-fields"><label className="color-picker-field">Escolher cor<input type="color" value={validColor} onChange={(event) => field.onChange(event.target.value.toUpperCase())} aria-label="Escolher a cor principal" /></label><label>Código da cor<input ref={field.ref} name={field.name} value={field.value} onChange={(event) => field.onChange(event.target.value.toUpperCase())} onBlur={field.onBlur} inputMode="text" maxLength={7} placeholder={DEFAULT_PRIMARY_COLOR} aria-invalid={Boolean(form.formState.errors.primaryColor)} />{form.formState.errors.primaryColor && <small className="field-error">{form.formState.errors.primaryColor.message}</small>}</label></div><div className="color-preview" style={previewStyle} aria-label="Prévia da cor no cardápio"><span>Prévia no cardápio</span><strong>{business.name}</strong><span className="preview-button">Ver detalhes</span></div><button className="secondary-button reset-color" type="button" disabled={primaryColor === DEFAULT_PRIMARY_COLOR} onClick={() => form.setValue('primaryColor', DEFAULT_PRIMARY_COLOR, { shouldDirty: true, shouldValidate: true })}>Voltar à cor padrão</button></div>
      }} /></section><section className="admin-card settings-section"><div className="card-heading"><div><h2>Capa do cardápio</h2><p>Imagem opcional exibida no topo do cardápio.</p></div></div><div className="cover-admin">{business.coverImageKey ? <img src={`/media/${business.coverImageKey}`} alt="Capa atual" /> : <div><ImageIcon /><span>Nenhuma capa configurada</span></div>}<div className="inline-actions"><label className="secondary-button file-button">{imageBusy ? imageProgress === null ? 'Preparando capa…' : `Enviando… ${imageProgress}%` : business.coverImageKey ? 'Substituir capa' : 'Enviar capa'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={imageBusy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadCover(file); event.currentTarget.value = '' }} /></label>{business.coverImageKey && <button type="button" className="text-danger" onClick={() => setConfirmCoverRemoval(true)}>Remover capa</button>}</div>{imageProgress !== null && <div className="upload-progress" role="status"><progress max="100" value={imageProgress} /><span>Enviando capa: {imageProgress}%</span></div>}</div></section><section className="admin-card settings-section"><div className="card-heading"><div><h2>Ícone do navegador</h2><p>Pequeno ícone exibido na aba do navegador. Use um arquivo ICO.</p></div></div><div className="favicon-admin">{business.faviconKey ? <img src={`/media/${business.faviconKey}`} alt="Ícone atual" /> : <div><ImageIcon /><span>Nenhum ícone configurado</span></div>}<div className="inline-actions"><label className="secondary-button file-button">{faviconBusy ? `Enviando… ${faviconProgress ?? 0}%` : business.faviconKey ? 'Substituir ícone' : 'Enviar ícone'}<input type="file" accept=".ico,image/x-icon,image/vnd.microsoft.icon" disabled={faviconBusy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadFavicon(file); event.currentTarget.value = '' }} /></label>{business.faviconKey && <button type="button" className="text-danger" onClick={() => setConfirmFaviconRemoval(true)}>Remover ícone</button>}</div>{faviconProgress !== null && <div className="upload-progress" role="status"><progress max="100" value={faviconProgress} /><span>Enviando ícone: {faviconProgress}%</span></div>}<small>Use preferencialmente um ícone quadrado com 32×32 ou 48×48 pixels.</small></div></section></div>}
      {activeSection === 'advanced' && <section className="admin-card settings-section"><div className="card-heading"><div><h2>Opções avançadas</h2><p>Normalmente estes campos não precisam ser alterados.</p></div></div><div className="warning-box"><Settings2 /><div><strong>Altere somente se souber o impacto</strong><p>O endereço curto, o fuso e os textos para o Google afetam a publicação do cardápio.</p></div></div><div className="settings-grid"><label>Endereço curto do link<input {...form.register('slug')} aria-invalid={Boolean(form.formState.errors.slug)} />{form.formState.errors.slug && <small className="field-error">Use apenas letras minúsculas, números e hífens.</small>}</label><label>Fuso horário<input {...form.register('timezone')} aria-invalid={Boolean(form.formState.errors.timezone)} />{form.formState.errors.timezone && <small className="field-error">Informe um fuso válido.</small>}</label><label className="wide">Link público do cardápio<input type="url" readOnly aria-readonly="true" {...form.register('publicSiteUrl', nullable)} /><small>Definido na implantação desta lanchonete.</small></label><label className="wide">Título para o Google <small>(opcional)</small><input {...form.register('seoTitle', nullable)} /></label><label className="wide">Descrição para o Google <small>(opcional)</small><textarea rows={3} {...form.register('seoDescription', nullable)} /></label></div></section>}
    </form>}
    {activeSection === 'advanced' && <section className="admin-card settings-section settings-backup"><div className="card-heading"><div><h2>Cópias e restauração</h2><p>Baixe uma cópia dos dados ou restaure uma cópia anterior.</p></div></div><BackupManager /></section>}
    {activeSection === 'hours' && <HoursEditor hours={data.hours} refresh={refresh} />}
    {activeSection === 'service' && <div className="settings-subsections"><PaymentsEditor methods={data.paymentMethods} refresh={refresh} /><ZonesEditor zones={data.deliveryZones} refresh={refresh} /></div>}
    {form.formState.isDirty && <div className="settings-save"><span aria-live="polite">Alterações não salvas em <strong>{dirtySectionNames}</strong>.</span><div><button className="secondary-button" type="button" disabled={save.isPending} onClick={() => setConfirmDiscardChanges(true)}>Descartar</button><button className="primary-button" type="button" disabled={save.isPending} onClick={() => void submitSettings()}>{save.isPending ? 'Salvando…' : dirtySections.length === 1 && dirtySections[0]?.id === 'appearance' ? 'Salvar cor' : 'Salvar alterações'}</button></div></div>}
    {confirmCoverRemoval && <ConfirmDialog title="Remover a capa atual?" description="O cardápio voltará a usar o fundo padrão. Você poderá enviar outra imagem depois." confirmLabel="Remover capa" onClose={() => setConfirmCoverRemoval(false)} onConfirm={() => void removeCover()} />}
    {confirmFaviconRemoval && <ConfirmDialog title="Remover o ícone do navegador?" description="O navegador voltará a usar o ícone padrão até você enviar outro arquivo." confirmLabel="Remover ícone" onClose={() => setConfirmFaviconRemoval(false)} onConfirm={() => void removeFavicon()} />}
    {(confirmDiscardChanges || pendingNavigation) && <ConfirmDialog title={pendingNavigation ? 'Sair sem salvar?' : 'Descartar alterações?'} description={pendingNavigation ? 'Você fez alterações nas configurações. Se sair agora, elas serão descartadas.' : 'As alterações ainda não salvas serão perdidas. Essa ação não afeta informações que já foram salvas.'} confirmLabel="Descartar alterações" onClose={() => { setConfirmDiscardChanges(false); setPendingNavigation(null) }} onConfirm={discardChanges} />}
  </div>
}
