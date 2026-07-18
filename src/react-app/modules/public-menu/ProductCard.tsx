import { ImageIcon, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { Product } from '../../../../shared/schemas'
import { formatMoney } from '../../../../shared/utils'

function Prices({ product }: { product: Product }) {
  const active = product.variants.filter((variant) => variant.isActive)
  return (
    <div className="price-list">
      {active.map((variant) => (
        <div key={variant.id} className="price-line">
          {active.length > 1 && variant.label && <span>{variant.label}</span>}
          <span className="price-values">
            {variant.promotionalPriceCents !== null && <del>{formatMoney(variant.priceCents)}</del>}
            <strong>{formatMoney(variant.promotionalPriceCents ?? variant.priceCents)}</strong>
          </span>
        </div>
      ))}
    </div>
  )
}

function ProductImage({ product, modal = false }: { product: Product; modal?: boolean }) {
  return product.imageKey
    ? <img className={modal ? 'modal-product-image' : 'product-image'} src={`/media/${product.imageKey}`} alt="" loading="lazy" />
    : <div className={modal ? 'modal-placeholder' : 'product-placeholder'} aria-hidden="true"><ImageIcon /></div>
}

export function ProductDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    const close = () => onCloseRef.current()
    dialog.addEventListener('close', close)
    return () => {
      dialog.removeEventListener('close', close)
    }
  }, [])

  return (
    <dialog ref={ref} className="product-dialog" aria-labelledby="product-dialog-title" onClick={(event) => { if (event.target === ref.current) ref.current?.close() }}>
      <div className="dialog-sheet">
        <button className="dialog-close" type="button" aria-label="Fechar detalhes" onClick={() => ref.current?.close()}><X /></button>
        <ProductImage product={product} modal />
        <div className="dialog-content">
          {!product.isAvailable && <span className="availability-badge">Indisponível</span>}
          <h2 id="product-dialog-title">{product.name}</h2>
          {product.ingredients && <p>{product.ingredients}</p>}
          <Prices product={product} />
        </div>
      </div>
    </dialog>
  )
}

export function ProductCard({ product, onSelect }: { product: Product; onSelect: (product: Product, trigger: HTMLButtonElement) => void }) {
  return (
    <button className={`product-card${product.isAvailable ? '' : ' unavailable'}`} type="button" onClick={(event) => onSelect(product, event.currentTarget)} aria-label={`Ver detalhes de ${product.name}`}>
      <ProductImage product={product} />
      <div className="product-copy">
        <div className="product-heading">
          <h3>{product.name}</h3>
          {!product.isAvailable && <span className="availability-badge">Indisponível</span>}
        </div>
        {product.ingredients && <p>{product.ingredients}</p>}
        <Prices product={product} />
      </div>
    </button>
  )
}
