import { X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { Product, ProductVariant } from '../../../../shared/schemas'
import { formatMoney } from '../../../../shared/utils'
import { CART_NOTE_MAX_LENGTH, CART_QUANTITY_MAX, getActiveVariants, getVariantPriceCents } from './cart/cart-utils'
import { QuantityControl } from './QuantityControl'

function hasActivePromotion(product: Product): boolean {
  return getActiveVariants(product)
    .some((variant) => variant.promotionalPriceCents !== null)
}

function CardPrice({ product }: { product: Product }) {
  const activeVariants = getActiveVariants(product)

  if (!activeVariants.length) {
    return <span className="menu-card-price-empty">Preço não informado</span>
  }

  if (activeVariants.length === 1) {
    const variant = activeVariants[0]
    const finalPrice = getVariantPriceCents(variant)

    return (
      <div className="menu-card-price">
        {variant.promotionalPriceCents !== null && (
          <del>{formatMoney(variant.priceCents)}</del>
        )}

        <strong>{formatMoney(finalPrice)}</strong>
      </div>
    )
  }

  const lowestPrice = Math.min(
    ...activeVariants.map(
      (variant) => getVariantPriceCents(variant),
    ),
  )

  return (
    <div className="menu-card-price menu-card-price--starting">
      <span>A partir de</span>
      <strong>{formatMoney(lowestPrice)}</strong>
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
        className={`menu-product-image${
          modal ? ' menu-product-image--modal' : ''
        }`}
        src={`/media/${product.imageKey}`}
        alt=""
        loading={modal ? 'eager' : 'lazy'}
        decoding="async"
      />
    )
  }

  return (
    <div
      className={`menu-product-placeholder${
        modal ? ' menu-product-placeholder--modal' : ''
      }`}
      aria-hidden="true"
    >
      <span>{initial}</span>
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
  onAdd: (product: Product, variant: ProductVariant, quantity: number, note: string) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const onCloseRef = useRef(onClose)
  const activeVariants = getActiveVariants(product)
  const [selectedVariantId, setSelectedVariantId] = useState(
    activeVariants.length === 1 ? activeVariants[0].id : '',
  )
  const [quantity, setQuantity] = useState(1)
  const [note, setNote] = useState('')
  const optionGroupId = useId()
  const promoted = hasActivePromotion(product)
  const selectedVariant = activeVariants.find((variant) => variant.id === selectedVariantId)
  const canConfigure = product.isAvailable && activeVariants.length > 0
  const canAdd = canConfigure && Boolean(selectedVariant)
  const totalCents = selectedVariant ? getVariantPriceCents(selectedVariant) * quantity : null

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
      className="menu-product-dialog"
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
      <article className="menu-dialog-sheet">
        <div className="menu-dialog-media">
          <ProductImage product={product} modal />

          <button
            className="menu-dialog-close"
            type="button"
            aria-label="Fechar detalhes"
            onClick={() => dialogRef.current?.close()}
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <form
          className="menu-dialog-content"
          onSubmit={(event) => {
            event.preventDefault()
            if (!selectedVariant || !canAdd) return
            onAdd(product, selectedVariant, quantity, note)
            dialogRef.current?.close()
          }}
        >
          <div className="menu-dialog-badges">
            {promoted && (
              <span className="menu-offer-badge">Oferta</span>
            )}

            {!product.isAvailable && (
              <span className="menu-unavailable-badge">
                Indisponível no momento
              </span>
            )}
          </div>

          <h2 id="menu-product-dialog-title">{product.name}</h2>

          {product.ingredients && (
            <p id="menu-product-dialog-description">
              {product.ingredients}
            </p>
          )}

          {!product.isAvailable && (
            <p className="menu-dialog-unavailable-note">
              Este item não pode ser adicionado ao pedido no momento.
            </p>
          )}

          {!activeVariants.length && (
            <div className="menu-variant-empty">Preço indisponível</div>
          )}

          {activeVariants.length === 1 && selectedVariant && (
            <div className="menu-selected-price">
              <span>Preço</span>
              <span className="menu-variant-values">
                {selectedVariant.promotionalPriceCents !== null && (
                  <del>{formatMoney(selectedVariant.priceCents)}</del>
                )}
                <strong>{formatMoney(getVariantPriceCents(selectedVariant))}</strong>
              </span>
            </div>
          )}

          {activeVariants.length > 1 && (
            <fieldset className="menu-option-group" aria-describedby={`${optionGroupId}-help`}>
              <legend>Escolha uma opção</legend>
              <p id={`${optionGroupId}-help`}>Selecione uma opção para continuar.</p>
              <div>
                {activeVariants.map((variant, index) => (
                  <label
                    className={selectedVariantId === variant.id ? 'menu-option--selected' : ''}
                    key={variant.id}
                  >
                    <input
                      type="radio"
                      name={optionGroupId}
                      value={variant.id}
                      checked={selectedVariantId === variant.id}
                      onChange={() => setSelectedVariantId(variant.id)}
                    />
                    <span>{variant.label?.trim() || `Opção ${index + 1}`}</span>
                    <span className="menu-variant-values">
                      {variant.promotionalPriceCents !== null && (
                        <del>{formatMoney(variant.priceCents)}</del>
                      )}
                      <strong>{formatMoney(getVariantPriceCents(variant))}</strong>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <section className="menu-item-quantity" aria-labelledby={`${optionGroupId}-quantity`}>
            <h3 id={`${optionGroupId}-quantity`}>Quantidade</h3>
            <QuantityControl
              itemName={product.name}
              quantity={quantity}
              decreaseDisabled={!canConfigure || quantity <= 1}
              increaseDisabled={!canConfigure || quantity >= CART_QUANTITY_MAX}
              onDecrease={() => setQuantity((current) => Math.max(1, current - 1))}
              onIncrease={() => setQuantity((current) => Math.min(CART_QUANTITY_MAX, current + 1))}
            />
          </section>

          <div className="menu-item-note">
            <label htmlFor={`${optionGroupId}-note`}>Observação deste item <span>(opcional)</span></label>
            <textarea
              id={`${optionGroupId}-note`}
              value={note}
              maxLength={CART_NOTE_MAX_LENGTH}
              rows={3}
              placeholder="Ex.: sem cebola, cortar ao meio"
              onChange={(event) => setNote(event.target.value)}
            />
            <small>A observação vale para esta quantidade.</small>
          </div>

          <button className="menu-add-to-cart" type="submit" disabled={!canAdd}>
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
      className={`menu-product-card${
        product.isAvailable ? '' : ' menu-product-card--unavailable'
      }`}
      type="button"
      onClick={(event) => {
        onSelect(product, event.currentTarget)
      }}
      aria-label={`Ver detalhes de ${product.name}${
        product.isAvailable ? '' : ', indisponível no momento'
      }`}
    >
      <div className="menu-product-copy">
        <div className="menu-product-labels">
          {promoted && (
            <span className="menu-offer-label">Oferta</span>
          )}

          {!product.isAvailable && (
            <span className="menu-unavailable-label">
              Indisponível
            </span>
          )}
        </div>

        <h3>{product.name}</h3>

        {product.ingredients && (
          <p>{product.ingredients}</p>
        )}

        <CardPrice product={product} />
      </div>

      <ProductImage product={product} />
    </button>
  )
}
