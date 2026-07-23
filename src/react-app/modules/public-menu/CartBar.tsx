import { ShoppingBag } from 'lucide-react'
import type { MouseEvent } from 'react'
import { formatMoney } from '../../../../shared/utils'

export function CartBar({
  itemCount,
  totalCents,
  onOpen,
}: {
  itemCount: number
  totalCents: number
  onOpen: (trigger: HTMLButtonElement) => void
}) {
  const itemLabel = `${itemCount} ${itemCount === 1 ? 'item' : 'itens'}`

  return (
    <aside className="menu-cart-bar" aria-label="Resumo do pedido">
      <button
        type="button"
        onClick={(event: MouseEvent<HTMLButtonElement>) => onOpen(event.currentTarget)}
      >
        <span className="menu-cart-bar-title">
          <ShoppingBag aria-hidden="true" />
          Ver pedido
        </span>
        <span>{itemLabel} · {formatMoney(totalCents)}</span>
      </button>

      <span className="sr-only" aria-live="polite" aria-atomic="true">
        Pedido atualizado: {itemLabel}, total {formatMoney(totalCents)}.
      </span>
    </aside>
  )
}
