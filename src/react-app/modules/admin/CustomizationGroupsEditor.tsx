import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { Controller, useFieldArray, useWatch, type UseFormReturn } from 'react-hook-form'
import type { ProductInput } from '../../../../shared/schemas'
import { MoneyInput } from './MoneyInput'

function errorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('message' in error)) return undefined
  const message = error.message
  return typeof message === 'string' ? message : undefined
}

function groupErrorAt(form: UseFormReturn<ProductInput>, index: number): Record<string, unknown> | undefined {
  const errors = form.formState.errors.customizationGroups
  const error = Array.isArray(errors) ? errors[index] : undefined
  return error && typeof error === 'object' ? error as Record<string, unknown> : undefined
}

function CustomizationGroupEditor({ form, index, groupId, total, onMove, onRemove }: { form: UseFormReturn<ProductInput>; index: number; groupId: string; total: number; onMove: (from: number, to: number) => void; onRemove: (index: number) => void }) {
  const optionsName = `customizationGroups.${index}.options` as const
  const groupName = `customizationGroups.${index}` as const
  const options = useFieldArray({ control: form.control, name: optionsName })
  const group = useWatch({ control: form.control, name: groupName })
  const groupError = groupErrorAt(form, index)
  const optionErrors = groupError?.options
  const optionErrorList = Array.isArray(optionErrors) ? optionErrors : []
  const groupNameError = errorMessage(groupError?.name)
  const groupMinError = errorMessage(groupError?.minSelections)
  const groupMaxError = errorMessage(groupError?.maxSelections)
  const groupOptionsError = errorMessage(groupError?.options)

  const appendOption = () => options.append({
    name: '',
    description: null,
    priceDeltaCents: 0,
    isActive: true,
    sortOrder: options.fields.length,
  })

  return (
    <section className="customization-group-editor">
      <div className="customization-editor-heading">
        <div>
          <strong>{group?.name?.trim() || `Grupo ${index + 1}`}</strong>
          <small>{group?.isActive ? `${group?.minSelections ?? 0} a ${group?.maxSelections ?? 0} escolha(s)` : 'Desativado'}</small>
        </div>
        <div className="customization-editor-actions">
          <button type="button" className="icon-text-button" disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={`Mover grupo ${index + 1} para cima`}><ArrowUp /></button>
          <button type="button" className="icon-text-button" disabled={index === total - 1} onClick={() => onMove(index, index + 1)} aria-label={`Mover grupo ${index + 1} para baixo`}><ArrowDown /></button>
          <button type="button" className="remove-option" onClick={() => onRemove(index)}><Trash2 /> Remover grupo</button>
        </div>
      </div>

      <div className="customization-group-fields">
        <label>Nome do grupo
          <input maxLength={120} placeholder="Ex.: Escolha seu hambúrguer" aria-invalid={Boolean(groupError?.name)} {...form.register(`${groupName}.name`)} />
          {groupNameError && <small className="field-error">{groupNameError}</small>}
        </label>
        <div className="customization-count-fields">
          <label>Mínimo
            <input type="number" min={0} max={99} aria-invalid={Boolean(groupError?.minSelections)} {...form.register(`${groupName}.minSelections`, { valueAsNumber: true })} />
            {groupMinError && <small className="field-error">{groupMinError}</small>}
          </label>
          <label>Máximo
            <input type="number" min={0} max={99} aria-invalid={Boolean(groupError?.maxSelections)} {...form.register(`${groupName}.maxSelections`, { valueAsNumber: true })} />
            {groupMaxError && <small className="field-error">{groupMaxError}</small>}
          </label>
        </div>
        <label className="check-field"><input type="checkbox" {...form.register(`${groupName}.isActive`)} /> Exibir este grupo no cardápio</label>
        <input type="hidden" {...form.register(`${groupName}.sortOrder`, { valueAsNumber: true })} value={index} />
      </div>

      <div className="customization-options-heading"><div><strong>Opções</strong><small>O máximo vale para a soma das quantidades.</small></div><button className="secondary-button" type="button" disabled={options.fields.length >= 50} onClick={appendOption}><Plus /> Adicionar opção</button></div>
      {groupOptionsError && <small className="field-error">{groupOptionsError}</small>}
      {!options.fields.length && <p className="field-help">Nenhuma opção cadastrada. Grupos opcionais podem ficar vazios.</p>}
      <div className="customization-option-list">
        {options.fields.map((option, optionIndex) => {
          const optionError = optionErrorList[optionIndex]
          const optionName = `${optionsName}.${optionIndex}` as const
          return <section className="customization-option-editor" key={option.id}>
            <div className="customization-option-heading"><strong>Opção {optionIndex + 1}</strong><div><button type="button" className="icon-text-button" disabled={optionIndex === 0} onClick={() => options.move(optionIndex, optionIndex - 1)} aria-label={`Mover opção ${optionIndex + 1} para cima`}><ArrowUp /></button><button type="button" className="icon-text-button" disabled={optionIndex === options.fields.length - 1} onClick={() => options.move(optionIndex, optionIndex + 1)} aria-label={`Mover opção ${optionIndex + 1} para baixo`}><ArrowDown /></button><button type="button" className="remove-option" onClick={() => options.remove(optionIndex)}><Trash2 /> Remover</button></div></div>
            <label>Nome da opção
              <input maxLength={120} placeholder="Ex.: Hambúrguer Bacon" aria-invalid={Boolean(optionError && typeof optionError === 'object' && 'name' in optionError)} {...form.register(`${optionName}.name`)} />
              {errorMessage(optionError && typeof optionError === 'object' && 'name' in optionError ? optionError.name : undefined) && <small className="field-error">{errorMessage(optionError && typeof optionError === 'object' && 'name' in optionError ? optionError.name : undefined)}</small>}
            </label>
            <label>Descrição <span className="optional-label">(opcional)</span><textarea rows={2} maxLength={500} placeholder="Ex.: pão brioche e hambúrguer artesanal" {...form.register(`${optionName}.description`, { setValueAs: (value) => value || null })} /></label>
            <Controller control={form.control} name={`${optionName}.priceDeltaCents`} render={({ field }) => <MoneyInput id={`customization-price-${groupId}-${optionIndex}`} label="Valor adicional" value={field.value > 0 ? field.value : 0} onChange={(value) => field.onChange(value ?? 0)} error={errorMessage(optionError && typeof optionError === 'object' && 'priceDeltaCents' in optionError ? optionError.priceDeltaCents : undefined)} />} />
            <label className="check-field"><input type="checkbox" {...form.register(`${optionName}.isActive`)} /> Disponível para escolha</label>
            <input type="hidden" {...form.register(`${optionName}.sortOrder`, { valueAsNumber: true })} value={optionIndex} />
          </section>
        })}
      </div>
      {options.fields.length >= 50 && <small className="field-help">Você atingiu o limite de 50 opções neste grupo.</small>}
    </section>
  )
}

export function CustomizationGroupsEditor({ form }: { form: UseFormReturn<ProductInput> }) {
  const groups = useFieldArray({ control: form.control, name: 'customizationGroups' })

  const appendGroup = () => groups.append({
    name: '',
    minSelections: 0,
    maxSelections: 1,
    isActive: true,
    sortOrder: groups.fields.length,
    options: [],
  })

  return <div className="customization-groups-editor">
    <div className="customization-groups-intro"><p>Crie escolhas que o cliente combina antes de adicionar o produto. O mínimo e o máximo consideram a soma das quantidades.</p><button className="secondary-button" type="button" disabled={groups.fields.length >= 20} onClick={appendGroup}><Plus /> Adicionar grupo</button></div>
    {!groups.fields.length && <p className="field-help">Nenhum grupo configurado. O produto continuará funcionando como antes.</p>}
    <div className="customization-group-list">
      {/* O índice no key força remount após move/remove; o useFieldArray aninhado nunca troca de name em uma mesma instância. */}
      {groups.fields.map((group, index) => <CustomizationGroupEditor key={`${group.id}-${index}`} form={form} index={index} groupId={group.id} total={groups.fields.length} onMove={groups.move} onRemove={groups.remove} />)}
    </div>
    {groups.fields.length >= 20 && <small className="field-help">Você atingiu o limite de 20 grupos neste produto.</small>}
  </div>
}
