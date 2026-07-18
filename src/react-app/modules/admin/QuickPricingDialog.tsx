import { useMutation } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Product, ProductInput } from '../../../../shared/schemas'
import { api, jsonBody, messageFromError } from '../../lib/api'
import { AdminDialog } from './AdminDialog'
import { AdminNotice } from './AdminNotice'
import { MoneyInput } from './MoneyInput'
import { productToInput } from './productInput'

interface PriceDraft {
  label: string | null
  priceCents: number | null
  promotionalPriceCents: number | null
  promotionEnabled: boolean
  isActive: boolean
  sortOrder: number
}

interface PriceError {
  price?: string
  promotion?: string
}

export function QuickPricingDialog({ product, onClose, onSaved }: { product: Product; onClose: () => void; onSaved: (product: Product, message: string) => Promise<void> }) {
  const initial = useMemo<PriceDraft[]>(() => product.variants.map((variant) => ({
    label: variant.label,
    priceCents: variant.priceCents,
    promotionalPriceCents: variant.promotionalPriceCents,
    promotionEnabled: variant.promotionalPriceCents !== null,
    isActive: variant.isActive,
    sortOrder: variant.sortOrder,
  })), [product])
  const [drafts, setDrafts] = useState(initial)
  const [errors, setErrors] = useState<PriceError[]>([])
  const [formError, setFormError] = useState('')
  const dirty = JSON.stringify(drafts) !== JSON.stringify(initial)

  const requestClose = () => {
    if (!dirty || window.confirm('Descartar as alterações de preço que não foram salvas?')) onClose()
  }

  const update = (index: number, values: Partial<PriceDraft>) => {
    setDrafts((current) => current.map((draft, currentIndex) => currentIndex === index ? { ...draft, ...values } : draft))
    setErrors((current) => current.map((error, currentIndex) => currentIndex === index ? {} : error))
    setFormError('')
  }

  const validate = (): boolean => {
    const next = drafts.map<PriceError>((draft) => {
      if (draft.priceCents === null || draft.priceCents <= 0) return { price: 'Informe um preço maior que zero.' }
      if (!draft.promotionEnabled) return {}
      if (draft.promotionalPriceCents === null || draft.promotionalPriceCents <= 0) return { promotion: 'Informe o preço promocional.' }
      if (draft.promotionalPriceCents >= draft.priceCents) return { promotion: 'O preço promocional precisa ser menor que o preço normal.' }
      return {}
    })
    setErrors(next)
    return next.every((error) => !error.price && !error.promotion)
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!validate()) throw new Error('Corrija os preços destacados antes de salvar.')
      const variants: ProductInput['variants'] = drafts.map((draft) => ({
        label: draft.label,
        priceCents: draft.priceCents!,
        promotionalPriceCents: draft.promotionEnabled ? draft.promotionalPriceCents : null,
        isActive: draft.isActive,
        sortOrder: draft.sortOrder,
      }))
      return api<Product>(`/admin/api/products/${product.id}`, { method: 'PATCH', body: jsonBody(productToInput(product, { variants })) })
    },
    onSuccess: async (saved) => {
      const hasPromotion = saved.variants.some((variant) => variant.promotionalPriceCents !== null)
      await onSaved(saved, hasPromotion ? 'Preços e promoções atualizados.' : 'Preços atualizados.')
      onClose()
    },
    onError: (cause) => setFormError(messageFromError(cause)),
  })

  return (
    <AdminDialog onClose={requestClose}>
      <section className="admin-form-dialog quick-pricing-dialog" aria-labelledby="quick-pricing-title">
        <div className="form-dialog-heading"><div><h2 id="quick-pricing-title">Preços e promoções</h2><p>{product.name}</p></div><button type="button" aria-label="Fechar" onClick={requestClose}><X /></button></div>
        {formError && <AdminNotice notice={{ kind: 'error', message: formError }} />}
        <div className="quick-price-list">
          {drafts.map((draft, index) => <section className="quick-price-item" key={`${draft.label ?? 'price'}-${draft.sortOrder}`}>
            <div className="quick-price-heading"><strong>{draft.label || 'Preço único'}</strong>{!draft.isActive && <span>Não exibido no cardápio</span>}</div>
            <MoneyInput id={`quick-price-${product.id}-${index}`} label="Preço normal" value={draft.priceCents} onChange={(value) => update(index, { priceCents: value })} error={errors[index]?.price} autoFocus={index === 0} />
            <label className="check-field"><input type="checkbox" checked={draft.promotionEnabled} onChange={(event) => update(index, { promotionEnabled: event.target.checked, promotionalPriceCents: event.target.checked ? draft.promotionalPriceCents : null })} /> Colocar em promoção</label>
            {draft.promotionEnabled && <MoneyInput id={`quick-promotion-${product.id}-${index}`} label="Preço promocional" value={draft.promotionalPriceCents} onChange={(value) => update(index, { promotionalPriceCents: value })} error={errors[index]?.promotion} />}
          </section>)}
        </div>
        <div className="form-actions sticky-actions"><button className="secondary-button" type="button" onClick={requestClose}>Cancelar</button><button className="primary-button" type="button" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Salvando…' : 'Salvar preços'}</button></div>
      </section>
    </AdminDialog>
  )
}
