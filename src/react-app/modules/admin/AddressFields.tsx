import { CircleCheck, ExternalLink, LoaderCircle, MapPin, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Controller, useWatch, type UseFormReturn } from 'react-hook-form'
import type { SettingsInput } from '../../../../shared/schemas'
import { buildGoogleMapsDirectionsUrl, formatStructuredAddress, hasStructuredAddress } from '../../../../shared/utils'
import { api, messageFromError } from '../../lib/api'
import { cn, fieldError, fieldHelp, fieldLabel, focusRing, secondaryButton, textInput } from '../../lib/tailwind'

const BRAZILIAN_STATES = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']
const nullable = { setValueAs: (value: unknown) => typeof value === 'string' ? value.trim() || null : null }

interface PostalCodeLookup {
  postalCode: string
  street: string
  neighborhood: string
  city: string
  state: string
}

const viaCepFields = ['addressStreet', 'addressNeighborhood', 'addressCity', 'addressState'] as const
type ViaCepField = typeof viaCepFields[number]

function formatPostalCodeInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

export function AddressFields({ form }: { form: UseFormReturn<SettingsInput> }) {
  const [lookupBusy, setLookupBusy] = useState(false)
  const [lookupFeedback, setLookupFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const lookupVersion = useRef(0)
  const lastSuccessfulLookup = useRef<string | null>(null)
  const autoFilledValues = useRef<Pick<SettingsInput, ViaCepField> | null>(null)
  const [postalCode, street, number, complement, neighborhood, city, state, legacyAddress] = useWatch({
    control: form.control,
    name: ['addressPostalCode', 'addressStreet', 'addressNumber', 'addressComplement', 'addressNeighborhood', 'addressCity', 'addressState', 'address'],
  })
  const addressFields = {
    addressPostalCode: postalCode,
    addressStreet: street,
    addressNumber: number,
    addressComplement: complement,
    addressNeighborhood: neighborhood,
    addressCity: city,
    addressState: state,
  }
  const structuredAddress = formatStructuredAddress(addressFields)
  const visibleAddress = structuredAddress ?? legacyAddress
  const directionsUrl = buildGoogleMapsDirectionsUrl(visibleAddress)
  const hasStructuredFields = hasStructuredAddress(addressFields)
  const errors = form.formState.errors

  const clearAutoFilledFields = () => {
    lookupVersion.current += 1
    lastSuccessfulLookup.current = null
    const values = autoFilledValues.current
    if (values) {
      for (const field of viaCepFields) {
        if (form.getValues(field) === values[field]) form.setValue(field, null, { shouldDirty: true, shouldValidate: true })
      }
    }
    autoFilledValues.current = null
    form.clearErrors(viaCepFields)
    setLookupBusy(false)
    setLookupFeedback(null)
  }

  const lookupPostalCode = async () => {
    const digits = (form.getValues('addressPostalCode') ?? '').replace(/\D/g, '')
    if (!digits) return
    if (digits.length !== 8) {
      form.setError('addressPostalCode', { type: 'manual', message: 'Digite os 8 números do CEP.' })
      setLookupFeedback(null)
      return
    }
    if (lastSuccessfulLookup.current === digits) return
    const requestVersion = ++lookupVersion.current
    setLookupBusy(true)
    setLookupFeedback(null)
    form.clearErrors('addressPostalCode')
    try {
      const result = await api<PostalCodeLookup>(`/admin/api/address/cep/${digits}`)
      if (requestVersion !== lookupVersion.current || (form.getValues('addressPostalCode') ?? '').replace(/\D/g, '') !== digits) return
      form.setValue('addressPostalCode', result.postalCode, { shouldDirty: true, shouldValidate: true })
      const values = { addressStreet: result.street || null, addressNeighborhood: result.neighborhood || null, addressCity: result.city || null, addressState: result.state || null }
      for (const field of viaCepFields) form.setValue(field, values[field], { shouldDirty: true, shouldValidate: true })
      autoFilledValues.current = values
      lastSuccessfulLookup.current = digits
      setLookupFeedback({ kind: 'success', message: 'Endereço encontrado. Agora informe o número.' })
      form.setFocus('addressNumber')
    } catch (cause) {
      if (requestVersion === lookupVersion.current) setLookupFeedback({ kind: 'error', message: messageFromError(cause) })
    } finally {
      if (requestVersion === lookupVersion.current) setLookupBusy(false)
    }
  }

  const removeAddress = () => {
    const fields: (keyof SettingsInput)[] = ['address', 'addressPostalCode', 'addressStreet', 'addressNumber', 'addressComplement', 'addressNeighborhood', 'addressCity', 'addressState', 'mapsUrl']
    for (const field of fields) form.setValue(field, null, { shouldDirty: true, shouldValidate: true })
    setLookupFeedback(null)
  }

  return <section className="mt-4 grid gap-4 rounded-[.85rem] border border-border bg-surface-strong p-4 shadow-menu-sm">
    <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-[.65rem] bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]"><MapPin className="w-5" /></span><div><h2 className="m-0 text-[1.1rem]">Endereço da lanchonete</h2><p className="mt-[.2rem] leading-[1.45] text-muted">Digite o CEP para preencher o endereço mais rápido. Você poderá corrigir qualquer campo.</p></div></div>
    <input type="hidden" {...form.register('address')} />

    {legacyAddress && !hasStructuredFields && <div className="rounded-[.65rem] border border-[#b9cee3] bg-[#edf6ff] p-3 text-[#234f74]"><div><strong>Endereço cadastrado atualmente</strong><p className="mt-1">{legacyAddress}</p><small className="mt-[.35rem] block">Preencha os campos abaixo para atualizar esse endereço.</small></div></div>}

    <div className="grid gap-[.8rem] min-[650px]:grid-cols-4">
      <div className="grid gap-[.35rem] text-[.8rem] font-[750] text-[#423e38] min-[650px]:col-span-full"><label htmlFor="address-postal-code">CEP</label>
        <div className="min-w-0">
          <Controller control={form.control} name="addressPostalCode" render={({ field }) => <input className={textInput} {...field} id="address-postal-code" value={field.value ?? ''} inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" maxLength={9} aria-invalid={Boolean(errors.addressPostalCode)} onChange={(event) => { const nextValue = formatPostalCodeInput(event.target.value); field.onChange(nextValue || null); if (!nextValue) clearAutoFilledFields(); else { form.clearErrors('addressPostalCode'); setLookupFeedback(null); if (nextValue.replace(/\D/g, '') !== lastSuccessfulLookup.current) lastSuccessfulLookup.current = null } }} onBlur={() => { field.onBlur(); void lookupPostalCode() }} />} />
        </div>
        {errors.addressPostalCode && <small className={fieldError}>{errors.addressPostalCode.message}</small>}
      </div>
      {lookupBusy && <div className="flex items-center gap-[.45rem] rounded-[.55rem] bg-[#e7f5ed] px-3 py-[.65rem] text-[.8rem] text-[#155b36] min-[650px]:col-span-full" role="status"><LoaderCircle className="w-4 animate-[spin_.8s_linear_infinite]" /><span>Buscando endereço…</span></div>}
      {lookupFeedback && !lookupBusy && <div className={cn('flex items-center gap-[.45rem] rounded-[.55rem] px-3 py-[.65rem] text-[.8rem] min-[650px]:col-span-full', lookupFeedback.kind === 'success' ? 'bg-[#e7f5ed] text-[#155b36]' : 'bg-[#fff0f0] text-danger')} role="status">{lookupFeedback.kind === 'success' && <CircleCheck />}<span>{lookupFeedback.message}</span></div>}

      <label className={`${fieldLabel} min-[650px]:col-span-3`}>Rua ou avenida<input className={textInput} autoComplete="address-line1" {...form.register('addressStreet', nullable)} aria-invalid={Boolean(errors.addressStreet)} />{errors.addressStreet && <small className={fieldError}>{errors.addressStreet.message}</small>}</label>
      <label className={`${fieldLabel} min-[650px]:col-span-1`}>Número<input className={textInput} autoComplete="address-line2" {...form.register('addressNumber', nullable)} placeholder="Ex.: 123 ou S/N" aria-invalid={Boolean(errors.addressNumber)} />{errors.addressNumber && <small className={fieldError}>{errors.addressNumber.message}</small>}</label>
      <label className={`${fieldLabel} min-[650px]:col-span-2`}>Complemento <small>(opcional)</small><input className={textInput} {...form.register('addressComplement', nullable)} placeholder="Ex.: fundos, loja 2" /></label>
      <label className={`${fieldLabel} min-[650px]:col-span-2`}>Bairro<input className={textInput} {...form.register('addressNeighborhood', nullable)} aria-invalid={Boolean(errors.addressNeighborhood)} />{errors.addressNeighborhood && <small className={fieldError}>{errors.addressNeighborhood.message}</small>}</label>
      <label className={`${fieldLabel} min-[650px]:col-span-3`}>Cidade<input className={textInput} autoComplete="address-level2" {...form.register('addressCity', nullable)} aria-invalid={Boolean(errors.addressCity)} />{errors.addressCity && <small className={fieldError}>{errors.addressCity.message}</small>}</label>
      <label className={`${fieldLabel} min-[650px]:col-span-1`}>Estado<select className={textInput} autoComplete="address-level1" {...form.register('addressState', nullable)} aria-invalid={Boolean(errors.addressState)}><option value="">Selecione</option>{BRAZILIAN_STATES.map((uf) => <option key={uf} value={uf}>{uf}</option>)}</select>{errors.addressState && <small className={fieldError}>{errors.addressState.message}</small>}</label>
    </div>

    {visibleAddress && <div className="grid gap-3 rounded-[.7rem] border border-[color-mix(in_srgb,var(--color-brand)_30%,var(--color-border))] bg-[var(--color-brand-soft)] p-3 min-[650px]:grid-cols-[minmax(0,1fr)_auto] min-[650px]:items-center"><div><strong>Como aparecerá no cardápio</strong><p className="mt-1 leading-[1.45] text-muted">{visibleAddress}</p></div>{directionsUrl && <a className={`${secondaryButton} justify-self-start bg-white`} href={directionsUrl} target="_blank" rel="noreferrer">Conferir no mapa <ExternalLink /></a>}</div>}

    <details className="rounded-[.7rem] border border-border [&[open]>summary]:border-b [&[open]>summary]:border-border"><summary className="flex min-h-12 cursor-pointer items-center gap-[.6rem] px-3 py-[.7rem] text-[.82rem] font-[800] marker:text-[var(--color-brand)]"><span>Usar um link específico do Google Maps</span><span className="ml-auto text-[.72rem] font-[600] text-muted">Opcional</span></summary><div className="p-3"><label className={fieldLabel}>Link do estabelecimento<input className={textInput} type="url" {...form.register('mapsUrl')} placeholder="https://maps.app.goo.gl/..." aria-invalid={Boolean(errors.mapsUrl)} />{errors.mapsUrl && <small className={fieldError}>Informe um link completo.</small>}<small className={fieldHelp}>Se ficar vazio, criaremos automaticamente o botão “Como chegar” usando o endereço acima.</small></label></div></details>

    {visibleAddress && <button className={`inline-flex min-h-[42px] items-center justify-self-start gap-[.35rem] border-0 bg-transparent px-2 font-[750] text-danger ${focusRing}`} type="button" onClick={removeAddress}><Trash2 className="w-4" /> Remover endereço</button>}
  </section>
}
