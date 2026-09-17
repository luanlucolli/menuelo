import { Minus, Plus } from 'lucide-react'
import { cn } from '../../lib/tailwind'

const quantityFocusRing = 'focus-visible:relative focus-visible:z-[1] focus-visible:outline-[3px] focus-visible:outline-[color-mix(in_srgb,var(--color-brand)_34%,transparent)] focus-visible:outline-offset-[-3px]'

export function QuantityControl({
  itemName,
  quantity,
  onDecrease,
  onIncrease,
  decreaseDisabled = false,
  increaseDisabled = false,
  compact = false,
}: {
  itemName: string
  quantity: number
  onDecrease: () => void
  onIncrease: () => void
  decreaseDisabled?: boolean
  increaseDisabled?: boolean
  compact?: boolean
}) {
  return (
    <div className={cn(compact ? 'grid grid-cols-[36px_34px_36px]' : 'grid grid-cols-[44px_48px_44px]', 'items-center overflow-hidden rounded-xl border border-menu-border bg-menu-surface [&_svg]:h-[18px] [&_svg]:w-[18px]')}>
      <button
        className={cn('grid cursor-pointer place-items-center bg-transparent', compact ? 'h-10 w-9' : 'h-11 w-11', quantityFocusRing, 'disabled:cursor-not-allowed disabled:opacity-[.35]')}
        type="button"
        aria-label={`Diminuir quantidade de ${itemName}`}
        disabled={decreaseDisabled}
        onClick={onDecrease}
      >
        <Minus aria-hidden="true" />
      </button>

      <output className={cn('text-center font-[800] text-menu-text', compact ? 'text-[.9rem]' : 'text-base')} aria-label={`Quantidade de ${itemName}`}>{quantity}</output>

      <button
        className={cn('grid cursor-pointer place-items-center bg-transparent', compact ? 'h-10 w-9' : 'h-11 w-11', quantityFocusRing, 'disabled:cursor-not-allowed disabled:opacity-[.35]')}
        type="button"
        aria-label={`Aumentar quantidade de ${itemName}`}
        disabled={increaseDisabled}
        onClick={onIncrease}
      >
        <Plus aria-hidden="true" />
      </button>
    </div>
  )
}
