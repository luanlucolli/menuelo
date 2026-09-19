import { X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { Product, ProductVariant } from '../../../../shared/schemas'
import { formatMoney } from '../../../../shared/utils'
import { CART_NOTE_MAX_LENGTH, CART_QUANTITY_MAX, getActiveVariants, getVariantPriceCents } from './cart/cart-utils'
import { ProductCustomizationGroups } from './ProductCustomizationGroups'
import { calculateCustomizationCost, draftToCustomizations, emptyCustomizationDraft, normalizeCustomizations, type CustomizationSelection } from './customizations'
import { QuantityControl } from './QuantityControl'
import { cn, focusRing, publicAddFocusRing, publicFieldFocusRing } from '../../lib/tailwind'

function hasActivePromotion(product: Product): boolean {
  return getActiveVariants(product)
    .some((variant) => variant.promotionalPriceCents !== null)
}

function CardPrice({ product }: { product: Product }) {
  const activeVariants = getActiveVariants(product)

  if (!activeVariants.length) {
    return <span className="mt-auto pt-[9px] text-[.76rem] text-menu-muted">Preço não informado</span>
  }

  if (activeVariants.length === 1) {
    const variant = activeVariants[0]
    const finalPrice = getVariantPriceCents(variant)

    return (
      <div className="mt-auto flex min-h-[26px] flex-wrap items-baseline gap-[7px] pt-[9px]">
        {variant.promotionalPriceCents !== null && (
          <del className="text-[.73rem] text-[#938d85]">{formatMoney(variant.priceCents)}</del>
        )}

        <strong className="text-base font-[820] tracking-[-.02em] text-menu-text">{formatMoney(finalPrice)}</strong>
      </div>
    )
  }

  const lowestPrice = Math.min(
    ...activeVariants.map(
      (variant) => getVariantPriceCents(variant),
    ),
  )

  return (
    <div className="mt-auto flex min-h-[26px] flex-wrap items-baseline gap-[5px] pt-[9px]">
      <span className="text-[.7rem] text-menu-muted">A partir de</span>
      <strong className="text-base font-[820] tracking-[-.02em] text-menu-text">{formatMoney(lowestPrice)}</strong>
    </div>
  )
}

function ProductImage({
  product,
  modal = false,
}: {
  product: Product
  modal?: boolean
}) {
  const initial =
    product.name.trim().charAt(0).toLocaleUpperCase('pt-BR') || '•'

  if (product.imageKey) {
    return (
      <img
        className={modal ? 'block aspect-[16/10] max-h-[360px] min-h-[220px] w-full object-cover max-[639px]:max-h-[300px]' : cn('block h-[104px] w-[104px] rounded-[14px] bg-menu-surface-muted object-cover max-[360px]:h-[92px] max-[360px]:w-[92px] min-[720px]:h-[108px] min-[720px]:w-[108px]', !product.isAvailable && 'grayscale-[.35] opacity-[.72]')}
        src={`/media/${product.imageKey}`}
        alt=""
        loading={modal ? 'eager' : 'lazy'}
        decoding="async"
      />
    )
  }

  return (
    <div
        className={modal ? 'grid aspect-[16/10] max-h-[360px] min-h-[220px] w-full place-items-center bg-menu-surface-muted max-[639px]:max-h-[300px]' : cn('grid h-[104px] w-[104px] place-items-center rounded-[14px] bg-[color-mix(in_srgb,var(--color-brand)_8%,var(--color-menu-surface-muted))] text-[color-mix(in_srgb,var(--color-brand)_58%,#5f5850)] max-[360px]:h-[92px] max-[360px]:w-[92px] min-[720px]:h-[108px] min-[720px]:w-[108px]', !product.isAvailable && 'grayscale-[.35] opacity-[.72]')}
      aria-hidden="true"
    >
      <span className={modal ? 'text-[3rem]' : 'text-[1.55rem] font-[820]'}>{initial}</span>
    </div>
  )
}

export function ProductDialog({
  product,
  onClose,
  onAdd,
}: {
  product: Product
  onClose: () => void
  onAdd: (product: Product, variant: ProductVariant, quantity: number, note: string, customizations: CustomizationSelection[]) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const onCloseRef = useRef(onClose)
  const activeVariants = getActiveVariants(product)
  const [selectedVariantId, setSelectedVariantId] = useState(
    activeVariants.length === 1 ? activeVariants[0].id : '',
  )
  const [quantity, setQuantity] = useState(1)
  const [note, setNote] = useState('')
  const [customizationDraft, setCustomizationDraft] = useState(() => emptyCustomizationDraft(product))
  const optionGroupId = useId()
  const promoted = hasActivePromotion(product)
  const selectedVariant = activeVariants.find((variant) => variant.id === selectedVariantId)
  const canConfigure = product.isAvailable && activeVariants.length > 0
  const customizations = draftToCustomizations(product, customizationDraft)
  const customizationValid = normalizeCustomizations(product, customizations) !== null
  const canAdd = canConfigure && Boolean(selectedVariant) && customizationValid
  const unitPriceCents = selectedVariant ? getVariantPriceCents(selectedVariant) + calculateCustomizationCost(product, customizations) : null
  const totalCents = unitPriceCents === null ? null : unitPriceCents * quantity

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const dialog = dialogRef.current

    if (!dialog) {
      return
    }

    if (!dialog.open) {
      dialog.showModal()
    }

    const handleClose = () => {
      onCloseRef.current()
    }

    dialog.addEventListener('close', handleClose)

    return () => {
      dialog.removeEventListener('close', handleClose)
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto h-auto max-h-[90dvh] w-[min(calc(100%_-_30px),560px)] max-w-none overflow-visible border-0 bg-transparent p-0 text-menu-text motion-reduce:scroll-auto max-[639px]:inset-auto max-[639px]:right-0 max-[639px]:bottom-0 max-[639px]:left-0 max-[639px]:m-0 max-[639px]:max-h-[calc(100dvh_-_max(8px,env(safe-area-inset-top)))] max-[639px]:w-full max-[639px]:overflow-hidden backdrop:bg-[rgb(24_21_18_/_68%)] backdrop:backdrop-blur-[2px]"
      aria-labelledby="menu-product-dialog-title"
      aria-describedby={
        product.ingredients
          ? 'menu-product-dialog-description'
          : undefined
      }
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          event.currentTarget.close()
        }
      }}
    >
      <article className="w-full max-h-[90dvh] overflow-y-auto overscroll-contain rounded-[22px] bg-menu-surface shadow-[0_28px_70px_rgb(0_0_0_/_34%)] [-webkit-overflow-scrolling:touch] motion-reduce:scroll-auto max-[639px]:max-h-[calc(100dvh_-_max(8px,env(safe-area-inset-top)))] max-[639px]:rounded-[22px_22px_0_0]">
        <div className="relative min-h-[220px] overflow-hidden bg-menu-surface-muted">
          <ProductImage product={product} modal />

          <button
            className={`absolute right-3 top-3 z-[1] grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-[rgb(255_255_255_/_42%)] bg-[rgb(20_19_17_/_68%)] text-white backdrop-blur-[8px] max-[639px]:h-11 max-[639px]:w-11 ${focusRing}`}
            type="button"
            aria-label="Fechar detalhes"
            onClick={() => dialogRef.current?.close()}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form
          className="px-5 pb-6 pt-[22px] max-[639px]:px-[18px] max-[639px]:pb-[max(24px,calc(16px_+_env(safe-area-inset-bottom)))]"
          onSubmit={(event) => {
            event.preventDefault()
            if (!selectedVariant || !canAdd) return
            onAdd(product, selectedVariant, quantity, note, customizations)
            dialogRef.current?.close()
          }}
        >
          <div className="flex flex-wrap items-center gap-[7px] empty:hidden">
            {promoted && (
              <span className="inline-flex min-h-[21px] items-center rounded-[6px] bg-[color-mix(in_srgb,var(--color-brand)_11%,#fff)] px-[7px] py-[3px] text-[.67rem] font-[780] leading-none text-[color-mix(in_srgb,var(--color-brand)_76%,#211f1c)]">Oferta</span>
            )}

            {!product.isAvailable && (
              <span className="inline-flex min-h-[21px] items-center rounded-[6px] bg-menu-danger-background px-[7px] py-[3px] text-[.67rem] font-[780] leading-none text-menu-danger">
                Indisponível no momento
              </span>
            )}
          </div>

          <h2 className="m-0 mt-[10px] text-[clamp(1.45rem,6vw,2rem)] font-[820] leading-[1.12] tracking-[-.04em] [text-wrap:balance] [overflow-wrap:anywhere]" id="menu-product-dialog-title">{product.name}</h2>

          {product.ingredients && (
            <p className="mt-[11px] text-[.93rem] leading-[1.55] text-menu-muted [overflow-wrap:anywhere]" id="menu-product-dialog-description">
              {product.ingredients}
            </p>
          )}

          {!product.isAvailable && (
            <p className="mt-[11px] rounded-[10px] bg-menu-danger-background px-3 py-2 text-[.93rem] font-[650] leading-[1.55] text-menu-danger [overflow-wrap:anywhere]">
              Este item não pode ser adicionado ao pedido no momento.
            </p>
          )}

          {!activeVariants.length && (
            <div className="mt-5 text-[.86rem] text-menu-muted">Preço indisponível</div>
          )}

          {activeVariants.length === 1 && selectedVariant && (
            <div className="my-5 flex min-h-[60px] items-center justify-between gap-[18px] border-y border-menu-border py-3 text-[.9rem] font-[700]">
              <span>Preço</span>
              <span className="flex flex-wrap items-baseline justify-end gap-2">
                {selectedVariant.promotionalPriceCents !== null && (
                  <del className="text-[.76rem] text-[#948e87]">{formatMoney(selectedVariant.priceCents)}</del>
                )}
                <strong className="text-base font-[820]">{formatMoney(getVariantPriceCents(selectedVariant))}</strong>
              </span>
            </div>
          )}

          {activeVariants.length > 1 && (
            <fieldset className="m-0 mt-[22px] min-w-0 border-0 p-0" aria-describedby={`${optionGroupId}-help`}>
              <legend className="p-0 text-base font-[780] text-menu-text">Escolha uma opção</legend>
              <p className="my-[5px] mb-3 text-[.78rem] text-menu-muted" id={`${optionGroupId}-help`}>Selecione uma opção para continuar.</p>
              <div className="grid gap-2">
                {activeVariants.map((variant, index) => (
                  <label
                    className={cn('grid min-h-[58px] grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-[10px] rounded-xl border border-menu-border px-3 py-2.5 text-[.88rem] font-[680] max-[360px]:!gap-[7px] max-[360px]:!px-[9px] focus-within:outline-[3px] focus-within:outline-[color-mix(in_srgb,var(--color-brand)_28%,transparent)] focus-within:outline-offset-2', selectedVariantId === variant.id && 'border-[var(--color-brand)] bg-[color-mix(in_srgb,var(--color-brand)_7%,#fff)]')}
                    key={variant.id}
                  >
                    <input
                      className="m-0 h-5 w-5 accent-[var(--color-brand)]"
                      type="radio"
                      name={optionGroupId}
                      value={variant.id}
                      checked={selectedVariantId === variant.id}
                      onChange={() => setSelectedVariantId(variant.id)}
                    />
                    <span>{variant.label?.trim() || `Opção ${index + 1}`}</span>
                    <span className="flex flex-wrap items-baseline justify-end gap-2 max-[360px]:!grid max-[360px]:!gap-[2px] max-[360px]:!text-right">
                      {variant.promotionalPriceCents !== null && (
                        <del className="text-[.76rem] text-[#948e87]">{formatMoney(variant.priceCents)}</del>
                      )}
                      <strong className="text-base font-[820]">{formatMoney(getVariantPriceCents(variant))}</strong>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <ProductCustomizationGroups product={product} draft={customizationDraft} onChange={setCustomizationDraft} />

          <section className="mt-6 flex items-center justify-between gap-[18px]" aria-labelledby={`${optionGroupId}-quantity`}>
            <h3 className="m-0 p-0 text-base font-[780] text-menu-text" id={`${optionGroupId}-quantity`}>Quantidade</h3>
            <QuantityControl
              itemName={product.name}
              quantity={quantity}
              decreaseDisabled={!canConfigure || quantity <= 1}
              increaseDisabled={!canConfigure || quantity >= CART_QUANTITY_MAX}
              onDecrease={() => setQuantity((current) => Math.max(1, current - 1))}
              onIncrease={() => setQuantity((current) => Math.min(CART_QUANTITY_MAX, current + 1))}
            />
          </section>

          <div className="mt-6 grid gap-[7px]">
            <label className="text-[.88rem] font-[740] text-menu-text" htmlFor={`${optionGroupId}-note`}>Observação deste item <span className="font-[500] text-menu-muted">(opcional)</span></label>
            <textarea
              id={`${optionGroupId}-note`}
              value={note}
              maxLength={CART_NOTE_MAX_LENGTH}
              rows={3}
              className={`min-h-[86px] w-full resize-y rounded-[11px] border border-menu-border bg-menu-surface px-3 py-[11px] text-[.9rem] leading-[1.45] text-menu-text ${publicFieldFocusRing}`}
              placeholder="Ex.: sem cebola, cortar ao meio"
              onChange={(event) => setNote(event.target.value)}
            />
            <small className="text-[.73rem] leading-[1.4] text-menu-muted">A observação vale para esta quantidade.</small>
          </div>

          <button className={`mt-[22px] min-h-[52px] w-full cursor-pointer rounded-[13px] border-0 bg-[var(--color-brand)] px-4 py-[11px] text-[.94rem] font-[800] text-[var(--color-brand-text)] disabled:cursor-not-allowed disabled:bg-[#dad6d0] disabled:text-[#6e6962] ${publicAddFocusRing}`} type="submit" disabled={!canAdd}>
            {totalCents === null
              ? 'Adicionar ao pedido'
              : `Adicionar ao pedido · ${formatMoney(totalCents)}`}
          </button>
        </form>
      </article>
    </dialog>
  )
}

export function ProductCard({
  product,
  onSelect,
}: {
  product: Product
  onSelect: (
    product: Product,
    trigger: HTMLButtonElement,
  ) => void
}) {
  const promoted = hasActivePromotion(product)

  return (
    <button
      className={cn('grid min-h-[132px] w-full cursor-pointer grid-cols-[minmax(0,1fr)_104px] items-center gap-[14px] border-0 border-b border-menu-border bg-menu-surface px-4 py-[15px] text-left text-menu-text transition-[background-color] duration-[140ms] ease-[ease] motion-reduce:transition-none hover:bg-[#fcfbf9] focus-visible:relative focus-visible:z-[1] focus-visible:outline-[3px] focus-visible:outline-[color-mix(in_srgb,var(--color-brand)_28%,transparent)] focus-visible:outline-offset-[-3px] last:border-b-0 max-[360px]:grid-cols-[minmax(0,1fr)_92px] min-[720px]:min-h-[142px] min-[720px]:rounded-2xl min-[720px]:border min-[720px]:last:border-b', !product.isAvailable && 'bg-[#fbfaf8]')}
      type="button"
      onClick={(event) => {
        onSelect(product, event.currentTarget)
      }}
      aria-label={`Ver detalhes de ${product.name}${
        product.isAvailable ? '' : ', indisponível no momento'
      }`}
    >
      <div className="flex h-full min-w-0 flex-col items-start">
        <div className="mb-1 flex min-h-5 flex-wrap items-center gap-[6px] empty:hidden">
          {promoted && (
            <span className="inline-flex min-h-[21px] items-center rounded-[6px] bg-[color-mix(in_srgb,var(--color-brand)_11%,#fff)] px-[7px] py-[3px] text-[.67rem] font-[780] leading-none text-[color-mix(in_srgb,var(--color-brand)_76%,#211f1c)]">Oferta</span>
          )}

          {!product.isAvailable && (
            <span className="inline-flex min-h-[21px] items-center rounded-[6px] bg-menu-danger-background px-[7px] py-[3px] text-[.67rem] font-[780] leading-none text-menu-danger">
              Indisponível
            </span>
          )}
        </div>

        <h3 className="m-0 line-clamp-2 overflow-hidden text-[1rem] font-[760] leading-[1.25] tracking-[-.018em] text-menu-text [overflow-wrap:anywhere]">{product.name}</h3>

        {product.ingredients && (
          <p className="mt-[6px] line-clamp-2 overflow-hidden text-[.79rem] leading-[1.4] text-menu-muted">{product.ingredients}</p>
        )}

        <CardPrice product={product} />
      </div>

      <ProductImage product={product} />
    </button>
  )
}
