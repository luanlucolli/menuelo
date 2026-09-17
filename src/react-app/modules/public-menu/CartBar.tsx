import { ShoppingBag } from 'lucide-react'
import type { MouseEvent } from 'react'
import { formatMoney } from '../../../../shared/utils'
import { publicCartFocusRing } from '../../lib/tailwind'

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
    <aside className="fixed inset-x-0 bottom-0 z-[36] bg-[color-mix(in_srgb,var(--color-menu-surface)_94%,transparent)] px-3 py-[10px] pb-[max(10px,env(safe-area-inset-bottom))] shadow-[0_-7px_24px_rgb(26_22_18_/_16%)] backdrop-blur-[12px] min-[720px]:right-6 min-[720px]:bottom-6 min-[720px]:left-auto min-[720px]:w-[340px] min-[720px]:rounded-[15px] min-[720px]:bg-transparent min-[720px]:p-0 min-[720px]:shadow-[0_12px_34px_rgb(26_22_18_/_24%)]" aria-label="Resumo do pedido">
      <button
        className={`flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 rounded-[14px] border-0 bg-[var(--color-brand)] px-3.5 py-2.5 text-right text-[.82rem] font-[760] text-[var(--color-brand-text)] ${publicCartFocusRing}`}
        type="button"
        onClick={(event: MouseEvent<HTMLButtonElement>) => onOpen(event.currentTarget)}
      >
        <span className="inline-flex items-center gap-2 text-left text-[.96rem] font-[820]">
          <ShoppingBag className="h-5 w-5" aria-hidden="true" />
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
