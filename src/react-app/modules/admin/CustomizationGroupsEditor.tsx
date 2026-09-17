import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { Controller, useFieldArray, useWatch, type UseFormReturn } from 'react-hook-form'
import type { ProductInput } from '../../../../shared/schemas'
import { checkField, fieldError, fieldHelp, fieldLabel, focusRing, iconButton, secondaryButton, textInput } from '../../lib/tailwind'
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
    <section className="grid min-w-0 gap-3 rounded-[.75rem] border border-border bg-[#faf8f4] p-[.85rem]">
      <div className="flex items-start justify-between gap-[.65rem]">
        <div>
          <strong>{group?.name?.trim() || `Grupo ${index + 1}`}</strong>
          <small className="text-[.72rem] text-muted">{group?.isActive ? `${group?.minSelections ?? 0} a ${group?.maxSelections ?? 0} escolha(s)` : 'Desativado'}</small>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-[.2rem]">
          <button type="button" className={iconButton} disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={`Mover grupo ${index + 1} para cima`}><ArrowUp /></button>
          <button type="button" className={iconButton} disabled={index === total - 1} onClick={() => onMove(index, index + 1)} aria-label={`Mover grupo ${index + 1} para baixo`}><ArrowDown /></button>
          <button type="button" className={`inline-flex min-h-9 cursor-pointer items-center gap-[.35rem] border-0 bg-transparent px-[.35rem] text-[.75rem] font-[750] text-danger ${focusRing}`} onClick={() => onRemove(index)}><Trash2 className="w-4" /> Remover grupo</button>
        </div>
      </div>

      <div className="grid gap-[.7rem]">
        <label className={fieldLabel}>Nome do grupo
          <input className={textInput} maxLength={120} placeholder="Ex.: Escolha seu hambúrguer" aria-invalid={Boolean(groupError?.name)} {...form.register(`${groupName}.name`)} />
          {groupNameError && <small className={fieldError}>{groupNameError}</small>}
        </label>
        <div className="grid grid-cols-2 gap-[.7rem]">
          <label className={fieldLabel}>Mínimo
            <input className={textInput} type="number" min={0} max={99} aria-invalid={Boolean(groupError?.minSelections)} {...form.register(`${groupName}.minSelections`, { valueAsNumber: true })} />
            {groupMinError && <small className={fieldError}>{groupMinError}</small>}
          </label>
          <label className={fieldLabel}>Máximo
            <input className={textInput} type="number" min={0} max={99} aria-invalid={Boolean(groupError?.maxSelections)} {...form.register(`${groupName}.maxSelections`, { valueAsNumber: true })} />
            {groupMaxError && <small className={fieldError}>{groupMaxError}</small>}
          </label>
        </div>
        <label className={checkField}><input className="h-[1.15rem] w-[1.15rem] accent-[var(--color-brand)]" type="checkbox" {...form.register(`${groupName}.isActive`)} /> Exibir este grupo no cardápio</label>
        <input type="hidden" {...form.register(`${groupName}.sortOrder`, { valueAsNumber: true })} value={index} />
      </div>

      <div className="flex items-start justify-between gap-[.65rem]"><div className="grid gap-[.15rem]"><strong>Opções</strong><small className="text-[.72rem] text-muted">O máximo vale para a soma das quantidades.</small></div><button className={secondaryButton} type="button" disabled={options.fields.length >= 50} onClick={appendOption}><Plus /> Adicionar opção</button></div>
      {groupOptionsError && <small className={fieldError}>{groupOptionsError}</small>}
      {!options.fields.length && <p className={fieldHelp}>Nenhuma opção cadastrada. Grupos opcionais podem ficar vazios.</p>}
      <div className="grid gap-3 border-t border-border pt-3">
        {options.fields.map((option, optionIndex) => {
          const optionError = optionErrorList[optionIndex]
          const optionName = `${optionsName}.${optionIndex}` as const
          return <section className="grid gap-[.65rem] rounded-[.65rem] border border-border bg-white p-3" key={option.id}>
            <div className="flex items-start justify-between gap-[.65rem]"><strong className="text-[.82rem]">Opção {optionIndex + 1}</strong><div className="flex flex-wrap items-center justify-end gap-[.2rem]"><button type="button" className={iconButton} disabled={optionIndex === 0} onClick={() => options.move(optionIndex, optionIndex - 1)} aria-label={`Mover opção ${optionIndex + 1} para cima`}><ArrowUp /></button><button type="button" className={iconButton} disabled={optionIndex === options.fields.length - 1} onClick={() => options.move(optionIndex, optionIndex + 1)} aria-label={`Mover opção ${optionIndex + 1} para baixo`}><ArrowDown /></button><button type="button" className="inline-flex min-h-9 cursor-pointer items-center gap-[.35rem] border-0 bg-transparent px-[.35rem] text-[.75rem] font-[750] text-danger" onClick={() => options.remove(optionIndex)}><Trash2 className="w-4" /> Remover</button></div></div>
            <label className={fieldLabel}>Nome da opção
              <input className={textInput} maxLength={120} placeholder="Ex.: Hambúrguer Bacon" aria-invalid={Boolean(optionError && typeof optionError === 'object' && 'name' in optionError)} {...form.register(`${optionName}.name`)} />
              {errorMessage(optionError && typeof optionError === 'object' && 'name' in optionError ? optionError.name : undefined) && <small className={fieldError}>{errorMessage(optionError && typeof optionError === 'object' && 'name' in optionError ? optionError.name : undefined)}</small>}
            </label>
            <label className={fieldLabel}>Descrição <span className="font-[500] text-muted">(opcional)</span><textarea className={`${textInput} min-h-[66px] resize-y`} rows={2} maxLength={500} placeholder="Ex.: pão brioche e hambúrguer artesanal" {...form.register(`${optionName}.description`, { setValueAs: (value) => value || null })} /></label>
            <Controller control={form.control} name={`${optionName}.priceDeltaCents`} render={({ field }) => <MoneyInput id={`customization-price-${groupId}-${optionIndex}`} label="Valor adicional" value={field.value > 0 ? field.value : 0} onChange={(value) => field.onChange(value ?? 0)} error={errorMessage(optionError && typeof optionError === 'object' && 'priceDeltaCents' in optionError ? optionError.priceDeltaCents : undefined)} />} />
            <label className={checkField}><input className="h-[1.15rem] w-[1.15rem] accent-[var(--color-brand)]" type="checkbox" {...form.register(`${optionName}.isActive`)} /> Disponível para escolha</label>
            <input type="hidden" {...form.register(`${optionName}.sortOrder`, { valueAsNumber: true })} value={optionIndex} />
          </section>
        })}
      </div>
      {options.fields.length >= 50 && <small className={fieldHelp}>Você atingiu o limite de 50 opções neste grupo.</small>}
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

  return <div className="grid gap-3">
    <div className="flex items-start justify-between gap-3"><p className="m-0 max-w-[42rem] text-[.8rem] leading-[1.45] text-muted">Crie escolhas que o cliente combina antes de adicionar o produto. O mínimo e o máximo consideram a soma das quantidades.</p><button className={`${secondaryButton} shrink-0`} type="button" disabled={groups.fields.length >= 20} onClick={appendGroup}><Plus /> Adicionar grupo</button></div>
    {!groups.fields.length && <p className={fieldHelp}>Nenhum grupo configurado. O produto continuará funcionando como antes.</p>}
    <div className="grid gap-3">
      {/* O índice no key força remount após move/remove; o useFieldArray aninhado nunca troca de name em uma mesma instância. */}
      {groups.fields.map((group, index) => <CustomizationGroupEditor key={`${group.id}-${index}`} form={form} index={index} groupId={group.id} total={groups.fields.length} onMove={groups.move} onRemove={groups.remove} />)}
    </div>
    {groups.fields.length >= 20 && <small className={fieldHelp}>Você atingiu o limite de 20 grupos neste produto.</small>}
  </div>
}
