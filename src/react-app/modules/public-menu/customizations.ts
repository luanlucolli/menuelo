import type { Product, ProductCustomizationGroup, ProductCustomizationOption } from '../../../../shared/schemas'

export interface CustomizationSelectionOption {
  optionId: string
  quantity: number
}

export interface CustomizationSelection {
  groupId: string
  options: CustomizationSelectionOption[]
}

export type CustomizationDraft = Record<string, Record<string, number>>

export interface ResolvedCustomizationOption extends CustomizationSelectionOption {
  name: string
  description: string | null
  priceDeltaCents: number
}

export interface ResolvedCustomization {
  groupId: string
  name: string
  options: ResolvedCustomizationOption[]
}

function orderedGroups(product: Product): ProductCustomizationGroup[] {
  return [...(product.customizationGroups ?? [])]
    .filter((group) => group.isActive)
    .sort((first, second) => first.sortOrder - second.sortOrder || first.id.localeCompare(second.id))
}

function orderedOptions(group: ProductCustomizationGroup): ProductCustomizationOption[] {
  return group.options
    .filter((option) => option.isActive)
    .sort((first, second) => first.sortOrder - second.sortOrder || first.id.localeCompare(second.id))
}

export function getActiveCustomizationGroups(product: Product): ProductCustomizationGroup[] {
  return orderedGroups(product).map((group) => ({ ...group, options: orderedOptions(group) }))
}

export function countCustomizationSelections(group: ProductCustomizationGroup, draft: Record<string, number> | undefined): number {
  return orderedOptions(group).reduce((total, option) => {
    const quantity = draft?.[option.id] ?? 0
    return total + (Number.isInteger(quantity) && quantity > 0 ? quantity : 0)
  }, 0)
}

export function emptyCustomizationDraft(product: Product): CustomizationDraft {
  return Object.fromEntries(getActiveCustomizationGroups(product).map((group) => [group.id, {}]))
}

export function updateCustomizationQuantity(
  draft: CustomizationDraft,
  group: ProductCustomizationGroup,
  optionId: string,
  delta: -1 | 1,
): CustomizationDraft {
  const current = draft[group.id]?.[optionId] ?? 0
  const total = countCustomizationSelections(group, draft[group.id])
  const next = Math.max(0, Math.min(99, current + delta))
  if (delta > 0 && total >= group.maxSelections) return draft
  if (next === current) return draft
  return {
    ...draft,
    [group.id]: { ...draft[group.id], [optionId]: next },
  }
}

export function toggleCustomizationOption(
  draft: CustomizationDraft,
  group: ProductCustomizationGroup,
  optionId: string,
): CustomizationDraft {
  const selected = (draft[group.id]?.[optionId] ?? 0) > 0
  if (selected) return { ...draft, [group.id]: { ...draft[group.id], [optionId]: 0 } }
  if (countCustomizationSelections(group, draft[group.id]) >= group.maxSelections) return draft
  return { ...draft, [group.id]: { ...draft[group.id], [optionId]: 1 } }
}

export function selectSingleCustomizationOption(
  draft: CustomizationDraft,
  group: ProductCustomizationGroup,
  optionId: string,
  selected: boolean,
): CustomizationDraft {
  const nextOptions = Object.fromEntries(orderedOptions(group).map((option) => [option.id, selected && option.id === optionId ? 1 : 0]))
  return { ...draft, [group.id]: nextOptions }
}

export function draftToCustomizations(product: Product, draft: CustomizationDraft): CustomizationSelection[] {
  return getActiveCustomizationGroups(product).flatMap((group) => {
    const options = orderedOptions(group).flatMap((option) => {
      const quantity = draft[group.id]?.[option.id] ?? 0
      return Number.isInteger(quantity) && quantity > 0 ? [{ optionId: option.id, quantity }] : []
    })
    return options.length ? [{ groupId: group.id, options }] : []
  })
}

export function normalizeCustomizations(product: Product, selections: CustomizationSelection[] | undefined): CustomizationSelection[] | null {
  const source = selections ?? []
  const activeGroups = getActiveCustomizationGroups(product)
  const groupsById = new Map(activeGroups.map((group) => [group.id, group]))
  const selectionsByGroup = new Map<string, CustomizationSelection>()

  for (const selection of source) {
    const group = groupsById.get(selection.groupId)
    if (!group || selectionsByGroup.has(selection.groupId)) return null
    const optionsById = new Map(orderedOptions(group).map((option) => [option.id, option]))
    const seenOptions = new Set<string>()
    const options = [] as CustomizationSelectionOption[]
    for (const selectedOption of selection.options) {
      if (!Number.isInteger(selectedOption.quantity) || selectedOption.quantity < 1 || selectedOption.quantity > 99 || seenOptions.has(selectedOption.optionId) || !optionsById.has(selectedOption.optionId)) return null
      seenOptions.add(selectedOption.optionId)
      options.push({ optionId: selectedOption.optionId, quantity: selectedOption.quantity })
    }
    selectionsByGroup.set(selection.groupId, { groupId: selection.groupId, options })
  }

  const normalized: CustomizationSelection[] = []
  for (const group of activeGroups) {
    const selection = selectionsByGroup.get(group.id)
    const options = selection?.options ?? []
    const total = options.reduce((sum, option) => sum + option.quantity, 0)
    if (total < group.minSelections || total > group.maxSelections) return null
    if (options.length) {
      normalized.push({
        groupId: group.id,
        options: [...options].sort((first, second) => first.optionId.localeCompare(second.optionId)),
      })
    }
  }
  return normalized
}

export function customizationSignature(selections: CustomizationSelection[] | undefined): string {
  return JSON.stringify(canonicalizeCustomizations(selections).map((selection) => ({
    groupId: selection.groupId,
    options: selection.options.map((option) => [option.optionId, option.quantity]),
  })))
}

export function canonicalizeCustomizations(selections: CustomizationSelection[] | undefined): CustomizationSelection[] {
  return (selections ?? [])
    .filter((selection) => selection.options.length > 0)
    .map((selection) => ({
      groupId: selection.groupId,
      options: [...selection.options].sort((first, second) => first.optionId.localeCompare(second.optionId)),
    }))
    .sort((first, second) => first.groupId.localeCompare(second.groupId))
}

export function calculateCustomizationCost(product: Product, selections: CustomizationSelection[] | undefined): number {
  const normalized = normalizeCustomizations(product, selections)
  if (!normalized) return 0
  const optionsById = new Map(getActiveCustomizationGroups(product).flatMap((group) => group.options).map((option) => [option.id, option]))
  return normalized.reduce((total, selection) => total + selection.options.reduce((groupTotal, selected) => groupTotal + (optionsById.get(selected.optionId)?.priceDeltaCents ?? 0) * selected.quantity, 0), 0)
}

export function resolveCustomizations(product: Product, selections: CustomizationSelection[] | undefined): ResolvedCustomization[] | null {
  const normalized = normalizeCustomizations(product, selections)
  if (!normalized) return null
  const groupsById = new Map(getActiveCustomizationGroups(product).map((group) => [group.id, group]))
  return normalized.map((selection) => {
    const group = groupsById.get(selection.groupId)!
    const optionsById = new Map(group.options.map((option) => [option.id, option]))
    return {
      groupId: group.id,
      name: group.name,
      options: selection.options.map((selected) => {
        const option = optionsById.get(selected.optionId)!
        return { ...selected, name: option.name, description: option.description, priceDeltaCents: option.priceDeltaCents }
      }),
    }
  })
}

export function customizationRuleText(group: ProductCustomizationGroup): string {
  if (group.minSelections === 0 && group.maxSelections === 0) return 'Opcional'
  if (group.minSelections === 0 && group.maxSelections === 1) return 'Opcional · escolha até 1'
  if (group.minSelections === 0) return `Opcional · escolha até ${group.maxSelections}`
  if (group.minSelections === group.maxSelections) return `Obrigatório · escolha ${group.minSelections}`
  return `Obrigatório · escolha de ${group.minSelections} a ${group.maxSelections}`
}

export function customizationRuleShortText(group: ProductCustomizationGroup): string {
  if (group.minSelections === 0 && group.maxSelections === 0) return 'Opcional'
  if (group.minSelections === 0) return `Escolha até ${group.maxSelections}`
  if (group.minSelections === group.maxSelections) return `Escolha ${group.minSelections}`
  return `Escolha de ${group.minSelections} a ${group.maxSelections}`
}
