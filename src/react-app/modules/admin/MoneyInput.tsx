import { formatMoney } from '../../../../shared/utils'
import { centsFromMoneyInput } from './money'
import { fieldError, fieldLabel, textInput } from '../../lib/tailwind'

export function MoneyInput({ id, label, value, onChange, error, optional = false, autoFocus = false }: { id: string; label: string; value: number | null; onChange: (value: number | null) => void; error?: string; optional?: boolean; autoFocus?: boolean }) {
  return (
    <label className={fieldLabel} htmlFor={id}>
      <span>{label}{optional && <small className="text-muted font-[500]"> (opcional)</small>}</span>
      <input
        className={textInput}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        value={value === null ? '' : formatMoney(value)}
        placeholder="R$ 0,00"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => onChange(centsFromMoneyInput(event.target.value))}
      />
      {error && <small className={fieldError} id={`${id}-error`}>{error}</small>}
    </label>
  )
}
