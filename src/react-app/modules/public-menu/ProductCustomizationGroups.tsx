import { formatMoney } from '../../../../shared/utils'
import type { Product } from '../../../../shared/schemas'
import {
  countCustomizationSelections,
  getActiveCustomizationGroups,
  selectSingleCustomizationOption,
  updateCustomizationQuantity,
  type CustomizationDraft,
} from './customizations'
import { QuantityControl } from './QuantityControl'

export function ProductCustomizationGroups({ product, draft, onChange }: { product: Product; draft: CustomizationDraft; onChange: (draft: CustomizationDraft) => void }) {
  const groups = getActiveCustomizationGroups(product)
  if (!groups.length) return null

  return <div className="menu-customization-groups">
    {groups.map((group) => {
      const selectedCount = countCustomizationSelections(group, draft[group.id])
      const selectionValid = selectedCount >= group.minSelections && selectedCount <= group.maxSelections
      const rule = group.minSelections === 0 && group.maxSelections === 0
        ? 'Opcional'
        : group.minSelections === 0
          ? `Opcional · escolha até ${group.maxSelections}`
          : group.minSelections === group.maxSelections
            ? `Escolha ${group.minSelections}`
            : `Escolha de ${group.minSelections} a ${group.maxSelections}`
      return <fieldset className="menu-customization-group" key={group.id} aria-describedby={`customization-help-${group.id}`}>
        <legend>{group.name}</legend>
        <p id={`customization-help-${group.id}`} className="menu-customization-rule"><span>{rule}</span><span aria-live="polite">{selectedCount}/{group.maxSelections}</span></p>
        {!selectionValid && <p className="menu-customization-error" role="status">{selectedCount < group.minSelections ? `Selecione pelo menos ${group.minSelections - selectedCount} opção(ões) neste grupo.` : `Remova ${selectedCount - group.maxSelections} opção(ões) para continuar.`}</p>}
        <div className="menu-customization-options">
          {group.options.map((option) => {
            const quantity = draft[group.id]?.[option.id] ?? 0
            const selected = quantity > 0
            if (group.maxSelections === 1) {
              const inputId = `customization-${group.id}-${option.id}`
              return <label className={`menu-customization-option menu-customization-option--single${selected ? ' menu-option--selected' : ''}`} htmlFor={inputId} key={option.id}>
                <input id={inputId} type="checkbox" checked={selected} onChange={(event) => onChange(selectSingleCustomizationOption(draft, group, option.id, event.target.checked))} />
                <span className="menu-customization-option-copy"><strong>{option.name}</strong>{option.description && <small>{option.description}</small>}</span>
                {option.priceDeltaCents > 0 && <strong className="menu-customization-price">+ {formatMoney(option.priceDeltaCents)}</strong>}
              </label>
            }
            return <div className={`menu-customization-option${selected ? ' menu-option--selected' : ''}`} key={option.id}>
              <div className="menu-customization-option-copy"><strong>{option.name}</strong>{option.description && <small>{option.description}</small>}</div>
              <div className="menu-customization-option-end">
                {option.priceDeltaCents > 0 && <strong className="menu-customization-price">+ {formatMoney(option.priceDeltaCents)}</strong>}
                <QuantityControl
                  itemName={option.name}
                  quantity={quantity}
                  decreaseDisabled={quantity <= 0}
                  increaseDisabled={selectedCount >= group.maxSelections}
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
