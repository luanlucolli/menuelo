import { useMutation } from '@tanstack/react-query'
import { Plus, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Product, ProductInput } from '../../../../shared/schemas'
import { api, jsonBody, messageFromError } from '../../lib/api'
import { AdminDialog } from './AdminDialog'
import { AdminNotice } from './AdminNotice'
import { MoneyInput } from './MoneyInput'
import { productToInput } from './productInput'

interface PriceDraft {
  key: string
  label: string | null
  priceCents: number | null
  promotionalPriceCents: number | null
  promotionEnabled: boolean
  isActive: boolean
}

interface PriceError {
  label?: string
  price?: string
  promotion?: string
}

export function QuickPricingDialog({ product, onClose, onSaved }: { product: Product; onClose: () => void; onSaved: (product: Product, message: string) => Promise<void> }) {
  const initial = useMemo<PriceDraft[]>(() => product.variants.map((variant) => ({
    key: variant.id,
    label: variant.label,
    priceCents: variant.priceCents,
    promotionalPriceCents: variant.promotionalPriceCents,
    promotionEnabled: variant.promotionalPriceCents !== null,
    isActive: variant.isActive,
  })), [product])
  const [drafts, setDrafts] = useState(initial)
  const [errors, setErrors] = useState<PriceError[]>([])
  const [formError, setFormError] = useState('')
  const dirty = JSON.stringify(drafts) !== JSON.stringify(initial)

  const requestClose = () => {
    if (!dirty || window.confirm('Descartar as alterações de preços e opções que não foram salvas?')) onClose()
  }

  const update = (index: number, values: Partial<PriceDraft>) => {
    setDrafts((current) => current.map((draft, currentIndex) => currentIndex === index ? { ...draft, ...values } : draft))
    setErrors((current) => current.map((error, currentIndex) => currentIndex === index ? {} : error))
    setFormError('')
  }

  const addOption = () => {
    if (drafts.length >= 20) return
    setDrafts((current) => [...current, {
      key: crypto.randomUUID(),
      label: null,
      priceCents: null,
      promotionalPriceCents: null,
      promotionEnabled: false,
      isActive: true,
    }])
    setErrors((current) => [...current, {}])
    setFormError('')
  }

  const removeOption = (index: number) => {
    setDrafts((current) => current.filter((_, currentIndex) => currentIndex !== index))
    setErrors((current) => current.filter((_, currentIndex) => currentIndex !== index))
    setFormError('')
  }

  const validate = (): boolean => {
    const next = drafts.map<PriceError>((draft) => {
      const label = draft.label?.trim() ?? ''
      if (label.length > 40) return { label: 'Use no máximo 40 caracteres.' }
      if (drafts.length > 1 && !label) return { label: 'Dê um nome para diferenciar esta opção.' }
      if (label && drafts.some((candidate) => candidate !== draft && candidate.label?.trim().toLocaleLowerCase('pt-BR') === label.toLocaleLowerCase('pt-BR'))) {
        return { label: 'Use um nome diferente para cada opção.' }
      }
      if (draft.priceCents === null || draft.priceCents <= 0) return { price: 'Informe um preço maior que zero.' }
      if (!draft.promotionEnabled) return {}
      if (draft.promotionalPriceCents === null || draft.promotionalPriceCents <= 0) return { promotion: 'Informe o preço promocional.' }
      if (draft.promotionalPriceCents >= draft.priceCents) return { promotion: 'O preço promocional precisa ser menor que o preço normal.' }
      return {}
    })
    setErrors(next)
    return next.every((error) => !error.label && !error.price && !error.promotion)
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!validate()) throw new Error('Corrija os campos destacados antes de salvar.')
      const variants: ProductInput['variants'] = drafts.map((draft, index) => ({
        label: draft.label?.trim() || null,
        priceCents: draft.priceCents!,
        promotionalPriceCents: draft.promotionEnabled ? draft.promotionalPriceCents : null,
        isActive: draft.isActive,
        sortOrder: index,
      }))
      return api<Product>(`/admin/api/products/${product.id}`, { method: 'PATCH', body: jsonBody(productToInput(product, { variants })) })
    },
    onSuccess: async (saved) => {
      await onSaved(saved, 'Preços, promoções e opções atualizados.')
      onClose()
    },
    onError: (cause) => setFormError(messageFromError(cause)),
  })

  return (
    <AdminDialog onClose={requestClose}>
      <section className="admin-form-dialog quick-pricing-dialog" aria-labelledby="quick-pricing-title">
        <div className="form-dialog-heading"><div><h2 id="quick-pricing-title">Preços e opções</h2><p>{product.name} · gerencie tamanhos e promoções aqui</p></div><button type="button" aria-label="Fechar" onClick={requestClose}><X /></button></div>
        {formError && <AdminNotice notice={{ kind: 'error', message: formError }} />}
        <div className="quick-price-list">
          {drafts.map((draft, index) => <section className="quick-price-item" key={draft.key}>
            <div className="quick-price-heading"><strong>{drafts.length === 1 ? 'Preço principal' : `Opção ${index + 1}`}</strong>{drafts.length > 1 && <button className="remove-option" type="button" aria-label={`Remover opção ${index + 1}`} onClick={() => removeOption(index)}><Trash2 /> Remover</button>}</div>
            <label>Nome da opção {drafts.length === 1 && <span className="optional-label">(opcional)</span>}<input value={draft.label ?? ''} placeholder={drafts.length === 1 ? 'Ex.: Único' : 'Ex.: Pequeno'} maxLength={40} aria-invalid={Boolean(errors[index]?.label)} onChange={(event) => update(index, { label: event.target.value || null })} />{errors[index]?.label && <small className="field-error">{errors[index].label}</small>}</label>
            <MoneyInput id={`quick-price-${product.id}-${index}`} label="Preço normal" value={draft.priceCents} onChange={(value) => update(index, { priceCents: value })} error={errors[index]?.price} autoFocus={index === 0} />
            <label className="check-field"><input type="checkbox" checked={draft.promotionEnabled} onChange={(event) => update(index, { promotionEnabled: event.target.checked, promotionalPriceCents: event.target.checked ? draft.promotionalPriceCents : null })} /> Colocar em promoção</label>
            {draft.promotionEnabled && <MoneyInput id={`quick-promotion-${product.id}-${index}`} label="Preço promocional" value={draft.promotionalPriceCents} onChange={(value) => update(index, { promotionalPriceCents: value })} error={errors[index]?.promotion} />}
            <label className="check-field"><input type="checkbox" checked={draft.isActive} onChange={(event) => update(index, { isActive: event.target.checked })} /> Mostrar esta opção no cardápio</label>
          </section>)}
        </div>
        <button className="secondary-button add-price-option" type="button" disabled={drafts.length >= 20} onClick={addOption}><Plus /> Adicionar tamanho ou opção</button>
        {drafts.length >= 20 && <small className="field-help">Você atingiu o limite de 20 opções neste produto.</small>}
        <div className="form-actions sticky-actions"><button className="secondary-button" type="button" onClick={requestClose}>Cancelar</button><button className="primary-button" type="button" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Salvando…' : 'Salvar preços e opções'}</button></div>
      </section>
    </AdminDialog>
  )
}
