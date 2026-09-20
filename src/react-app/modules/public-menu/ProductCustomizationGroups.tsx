import { formatMoney } from '../../../../shared/utils'
import type { Product } from '../../../../shared/schemas'
import {
  countCustomizationSelections,
  customizationRuleText,
  getActiveCustomizationGroups,
  selectSingleCustomizationOption,
  updateCustomizationQuantity,
  type CustomizationDraft,
} from './customizations'
import { QuantityControl } from './QuantityControl'
import { cn } from '../../lib/tailwind'

export function ProductCustomizationGroups({ product, draft, onChange }: { product: Product; draft: CustomizationDraft; onChange: (draft: CustomizationDraft) => void }) {
  const groups = getActiveCustomizationGroups(product)
  if (!groups.length) return null

  return <div className="mt-6 grid gap-[22px]">
    {groups.map((group) => {
      const selectedCount = countCustomizationSelections(group, draft[group.id])
      const selectionValid = selectedCount >= group.minSelections && selectedCount <= group.maxSelections
      const rule = customizationRuleText(group)
      return <fieldset className="menu-customization-group m-0 min-w-0 border-0 p-0" key={group.id} aria-describedby={`customization-help-${group.id}`}>
        <legend className="max-w-full p-0 text-base font-[780] text-menu-text [overflow-wrap:anywhere]">{group.name}</legend>
        <p id={`customization-help-${group.id}`} className="my-[5px] mb-[11px] flex items-center justify-between gap-[10px] text-[.78rem] text-menu-muted"><span>{rule}</span><span className="shrink-0 [font-variant-numeric:tabular-nums]" aria-live="polite">{selectedCount}/{group.maxSelections}</span></p>
        {!selectionValid && <p className="mb-[9px] mt-0 text-[.76rem] font-[700] leading-[1.4] text-menu-danger" role="status">{selectedCount < group.minSelections ? `Selecione pelo menos ${group.minSelections - selectedCount} opção(ões) neste grupo.` : `Remova ${selectedCount - group.maxSelections} opção(ões) para continuar.`}</p>}
        <div className="grid min-w-0 gap-2">
          {group.options.map((option) => {
            const quantity = draft[group.id]?.[option.id] ?? 0
            const selected = quantity > 0
            if (group.maxSelections === 1) {
              const inputId = `customization-${group.id}-${option.id}`
              return <label className={cn('menu-customization-option grid min-h-[58px] cursor-pointer grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-[10px] rounded-xl border border-menu-border px-3 py-2 text-[.88rem] font-[680] focus-within:outline-[3px] focus-within:outline-[color-mix(in_srgb,var(--color-brand)_28%,transparent)] focus-within:outline-offset-2', selected && 'border-[var(--color-brand)] bg-[color-mix(in_srgb,var(--color-brand)_7%,#fff)]')} htmlFor={inputId} key={option.id}>
                <input className="m-0 h-5 w-5 accent-[var(--color-brand)]" id={inputId} type="checkbox" checked={selected} onChange={(event) => onChange(selectSingleCustomizationOption(draft, group, option.id, event.target.checked))} />
                <span className="grid min-w-0 gap-[3px]"><strong className="min-w-0 [overflow-wrap:anywhere]">{option.name}</strong>{option.description && <small className="text-[.74rem] font-[500] leading-[1.4] text-menu-muted [overflow-wrap:anywhere]">{option.description}</small>}</span>
                {option.priceDeltaCents > 0 && <strong className="shrink-0 whitespace-nowrap text-[.8rem] font-[800] text-[var(--color-brand)]">+ {formatMoney(option.priceDeltaCents)}</strong>}
              </label>
            }
            return <div className={cn('menu-customization-option flex min-h-[70px] min-w-0 items-center justify-between gap-3 rounded-xl border border-menu-border bg-menu-surface px-3 py-2.5 aria-[selected=true]:!border-[var(--color-brand)] aria-[selected=true]:!bg-[color-mix(in_srgb,var(--color-brand)_7%,#fff)]', selected && 'border-[var(--color-brand)] bg-[color-mix(in_srgb,var(--color-brand)_7%,#fff)]')} key={option.id} aria-selected={selected}>
              <div className="grid min-w-0 flex-1 gap-[3px]"><strong className="min-w-0 text-[.87rem] font-[700] [overflow-wrap:anywhere]">{option.name}</strong>{option.description && <small className="text-[.74rem] font-[500] leading-[1.4] text-menu-muted [overflow-wrap:anywhere]">{option.description}</small>}</div>
              <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2">
                {option.priceDeltaCents > 0 && <strong className="shrink-0 whitespace-nowrap text-[.8rem] font-[800] text-[var(--color-brand)]">+ {formatMoney(option.priceDeltaCents)}</strong>}
                <QuantityControl
                  itemName={option.name}
                  quantity={quantity}
                  decreaseDisabled={quantity <= 0}
                  increaseDisabled={selectedCount >= group.maxSelections}
                  compact
                  onDecrease={() => onChange(updateCustomizationQuantity(draft, group, option.id, -1))}
                  onIncrease={() => onChange(updateCustomizationQuantity(draft, group, option.id, 1))}
                />
              </div>
            </div>
          })}
        </div>
      </fieldset>
    })}
  </div>
}
