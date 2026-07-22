import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { Product } from '../../../../shared/schemas'
import { formatMoney } from '../../../../shared/utils'

function getActiveVariants(product: Product) {
  return [...product.variants]
    .filter((variant) => variant.isActive)
    .sort((first, second) => first.sortOrder - second.sortOrder)
}

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
    const finalPrice = variant.promotionalPriceCents ?? variant.priceCents

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
      (variant) => variant.promotionalPriceCents ?? variant.priceCents,
    ),
  )

  return (
    <div className="menu-card-price menu-card-price--starting">
      <span>A partir de</span>
      <strong>{formatMoney(lowestPrice)}</strong>
    </div>
  )
}

function VariantPrices({ product }: { product: Product }) {
  const activeVariants = getActiveVariants(product)

  if (!activeVariants.length) {
    return (
      <div className="menu-variant-empty">
        Preço ainda não informado.
      </div>
    )
  }

  return (
    <div className="menu-variant-list" aria-label="Preços disponíveis">
      {activeVariants.map((variant) => (
        <div key={variant.id} className="menu-variant-row">
          <span className="menu-variant-name">
            {variant.label || (activeVariants.length === 1 ? 'Valor' : 'Opção')}
          </span>

          <span className="menu-variant-values">
            {variant.promotionalPriceCents !== null && (
              <del>{formatMoney(variant.priceCents)}</del>
            )}

            <strong>
              {formatMoney(
                variant.promotionalPriceCents ?? variant.priceCents,
              )}
            </strong>
          </span>
        </div>
      ))}
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
}: {
  product: Product
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const onCloseRef = useRef(onClose)
  const promoted = hasActivePromotion(product)

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

        <div className="menu-dialog-content">
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

          <VariantPrices product={product} />
        </div>
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