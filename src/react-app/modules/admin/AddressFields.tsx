import { CircleCheck, ExternalLink, LoaderCircle, MapPin, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Controller, useWatch, type UseFormReturn } from 'react-hook-form'
import type { SettingsInput } from '../../../../shared/schemas'
import { buildGoogleMapsDirectionsUrl, formatStructuredAddress, hasStructuredAddress } from '../../../../shared/utils'
import { api, messageFromError } from '../../lib/api'

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

  return <section className="admin-card settings-section address-section">
    <div className="address-heading"><span><MapPin /></span><div><h2>Endereço da lanchonete</h2><p>Digite o CEP para preencher o endereço mais rápido. Você poderá corrigir qualquer campo.</p></div></div>
    <input type="hidden" {...form.register('address')} />

    {legacyAddress && !hasStructuredFields && <div className="legacy-address"><div><strong>Endereço cadastrado atualmente</strong><p>{legacyAddress}</p><small>Preencha os campos abaixo para atualizar esse endereço.</small></div></div>}

    <div className="address-grid">
      <div className="postal-code-field"><label htmlFor="address-postal-code">CEP</label>
        <div className="postal-code-control">
          <Controller control={form.control} name="addressPostalCode" render={({ field }) => <input {...field} id="address-postal-code" value={field.value ?? ''} inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" maxLength={9} aria-invalid={Boolean(errors.addressPostalCode)} onChange={(event) => { const nextValue = formatPostalCodeInput(event.target.value); field.onChange(nextValue || null); if (!nextValue) clearAutoFilledFields(); else { form.clearErrors('addressPostalCode'); setLookupFeedback(null); if (nextValue.replace(/\D/g, '') !== lastSuccessfulLookup.current) lastSuccessfulLookup.current = null } }} onBlur={() => { field.onBlur(); void lookupPostalCode() }} />} />
        </div>
        {errors.addressPostalCode && <small className="field-error">{errors.addressPostalCode.message}</small>}
      </div>
      {lookupBusy && <div className="postal-code-feedback" role="status"><LoaderCircle className="spin-icon" /><span>Buscando endereço…</span></div>}
      {lookupFeedback && !lookupBusy && <div className={`postal-code-feedback ${lookupFeedback.kind}`} role="status">{lookupFeedback.kind === 'success' && <CircleCheck />}<span>{lookupFeedback.message}</span></div>}

      <label className="address-street">Rua ou avenida<input autoComplete="address-line1" {...form.register('addressStreet', nullable)} aria-invalid={Boolean(errors.addressStreet)} />{errors.addressStreet && <small className="field-error">{errors.addressStreet.message}</small>}</label>
      <label className="address-number">Número<input autoComplete="address-line2" {...form.register('addressNumber', nullable)} placeholder="Ex.: 123 ou S/N" aria-invalid={Boolean(errors.addressNumber)} />{errors.addressNumber && <small className="field-error">{errors.addressNumber.message}</small>}</label>
      <label className="address-complement">Complemento <small>(opcional)</small><input {...form.register('addressComplement', nullable)} placeholder="Ex.: fundos, loja 2" /></label>
      <label className="address-neighborhood">Bairro<input {...form.register('addressNeighborhood', nullable)} aria-invalid={Boolean(errors.addressNeighborhood)} />{errors.addressNeighborhood && <small className="field-error">{errors.addressNeighborhood.message}</small>}</label>
      <label className="address-city">Cidade<input autoComplete="address-level2" {...form.register('addressCity', nullable)} aria-invalid={Boolean(errors.addressCity)} />{errors.addressCity && <small className="field-error">{errors.addressCity.message}</small>}</label>
      <label className="address-state">Estado<select autoComplete="address-level1" {...form.register('addressState', nullable)} aria-invalid={Boolean(errors.addressState)}><option value="">Selecione</option>{BRAZILIAN_STATES.map((uf) => <option key={uf} value={uf}>{uf}</option>)}</select>{errors.addressState && <small className="field-error">{errors.addressState.message}</small>}</label>
    </div>

    {visibleAddress && <div className="address-preview"><div><strong>Como aparecerá no cardápio</strong><p>{visibleAddress}</p></div>{directionsUrl && <a className="secondary-button button-nowrap" href={directionsUrl} target="_blank" rel="noreferrer">Conferir no mapa <ExternalLink /></a>}</div>}

    <details className="maps-override"><summary>Usar um link específico do Google Maps <span>Opcional</span></summary><div><label>Link do estabelecimento<input type="url" {...form.register('mapsUrl')} placeholder="https://maps.app.goo.gl/..." aria-invalid={Boolean(errors.mapsUrl)} />{errors.mapsUrl && <small className="field-error">Informe um link completo.</small>}<small className="field-help">Se ficar vazio, criaremos automaticamente o botão “Como chegar” usando o endereço acima.</small></label></div></details>

    {visibleAddress && <button className="text-danger remove-address" type="button" onClick={removeAddress}><Trash2 /> Remover endereço</button>}
  </section>
}
