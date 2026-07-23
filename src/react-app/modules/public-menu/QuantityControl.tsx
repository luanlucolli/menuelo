import { Minus, Plus } from 'lucide-react'

export function QuantityControl({
  itemName,
  quantity,
  onDecrease,
  onIncrease,
  decreaseDisabled = false,
  increaseDisabled = false,
}: {
  itemName: string
  quantity: number
  onDecrease: () => void
  onIncrease: () => void
  decreaseDisabled?: boolean
  increaseDisabled?: boolean
}) {
  return (
    <div className="menu-quantity-control">
      <button
        type="button"
        aria-label={`Diminuir quantidade de ${itemName}`}
        disabled={decreaseDisabled}
        onClick={onDecrease}
      >
        <Minus aria-hidden="true" />
      </button>

      <output aria-label={`Quantidade de ${itemName}`}>{quantity}</output>

      <button
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
