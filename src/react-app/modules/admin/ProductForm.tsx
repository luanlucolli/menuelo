import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { ImageIcon, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import type { Category, CategoryInput, Product, ProductInput } from '../../../../shared/schemas'
import { productInputFormSchema } from '../../../../shared/schemas'
import { api, jsonBody, messageFromError, uploadBlob } from '../../lib/api'
import { prepareImage } from '../../lib/image'
import { checkField, cn, fieldError, fieldHelp, fieldLabel, focusRing, primaryButton, secondaryButton, textInput } from '../../lib/tailwind'
import { AdminDialog } from './AdminDialog'
import { AdminNotice } from './AdminNotice'
import { CustomizationGroupsEditor } from './CustomizationGroupsEditor'
import { MoneyInput } from './MoneyInput'

interface CreatedCategory {
  id: string
  name: string
}

interface SaveResult {
  saved: Product
  imageError?: string
}

export function ProductForm({ product, categories, initialCategoryId, onClose, onSaved, onCategoryCreated }: { product: Product | null; categories: Category[]; initialCategoryId?: string; onClose: () => void; onSaved: (message: string) => Promise<void>; onCategoryCreated?: () => Promise<void> }) {
  const [persistedProduct, setPersistedProduct] = useState<Product | null>(product)
  const [image, setImage] = useState<Blob | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(product?.imageKey ? `/media/${product.imageKey}` : null)
  const [removeExistingImage, setRemoveExistingImage] = useState(false)
  const [processingImage, setProcessingImage] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [imageError, setImageError] = useState('')
  const [formError, setFormError] = useState('')
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [createdCategory, setCreatedCategory] = useState<CreatedCategory | null>(null)
  const [pricingOpen, setPricingOpen] = useState(!product)
  const [pricingFocus, setPricingFocus] = useState<string | null>(null)
  const [ingredientsOpen, setIngredientsOpen] = useState(false)
  const [customizationOpen, setCustomizationOpen] = useState(false)
  const [imageOpen, setImageOpen] = useState(Boolean(product?.imageKey))
  const errorRef = useRef<HTMLDivElement>(null)
  const pricingRef = useRef<HTMLDetailsElement>(null)
  const form = useForm<ProductInput>({
    resolver: zodResolver(productInputFormSchema),
    defaultValues: product ? {
      categoryId: product.categoryId,
      name: product.name,
      ingredients: product.ingredients,
      isAvailable: product.isAvailable,
      isFeatured: product.isFeatured,
      sortOrder: product.sortOrder,
      variants: product.variants.map((variant) => ({ label: variant.label, priceCents: variant.priceCents, promotionalPriceCents: variant.promotionalPriceCents, isActive: variant.isActive, sortOrder: variant.sortOrder })),
      customizationGroups: product.customizationGroups.map((group) => ({
        name: group.name,
        minSelections: group.minSelections,
        maxSelections: group.maxSelections,
        isActive: group.isActive,
        sortOrder: group.sortOrder,
        options: group.options.map((option) => ({ name: option.name, description: option.description, priceDeltaCents: option.priceDeltaCents, isActive: option.isActive, sortOrder: option.sortOrder })),
      })),
    } : { categoryId: categories.some((category) => category.id === initialCategoryId) ? initialCategoryId! : categories[0]?.id ?? '', name: '', ingredients: null, isAvailable: true, isFeatured: false, sortOrder: 0, variants: [{ label: null, priceCents: 0, promotionalPriceCents: null, isActive: true, sortOrder: 0 }], customizationGroups: [] },
  })
  const variants = useFieldArray({ control: form.control, name: 'variants' })
  const watchedVariants = useWatch({ control: form.control, name: 'variants' })
  const watchedCustomizationGroups = useWatch({ control: form.control, name: 'customizationGroups' })
  const hasMultipleSizes = variants.fields.length > 1
  const customizationGroupCount = watchedCustomizationGroups?.length ?? 0
  const categoryOptions = createdCategory && !categories.some((category) => category.id === createdCategory.id)
    ? [...categories.map((category) => ({ id: category.id, name: category.name })), createdCategory]
    : categories.map((category) => ({ id: category.id, name: category.name }))

  useEffect(() => () => { if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview) }, [imagePreview])
  useEffect(() => {
    if (createdCategory) form.setValue('categoryId', createdCategory.id, { shouldDirty: true, shouldValidate: true })
  }, [createdCategory, form])
  useEffect(() => {
    if (!pricingOpen || !pricingFocus) return
    requestAnimationFrame(() => {
      pricingRef.current?.scrollIntoView({ block: 'center' })
      pricingRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    })
  }, [pricingFocus, pricingOpen])

  const showFormError = (cause: unknown) => {
    setFormError(messageFromError(cause))
    requestAnimationFrame(() => {
      errorRef.current?.scrollIntoView({ block: 'center' })
      errorRef.current?.focus()
    })
  }

  const requestClose = () => {
    const hasPendingImage = Boolean(image) || removeExistingImage
    if (!form.formState.isDirty && !hasPendingImage) return onClose()
    if (window.confirm('Descartar as alterações que ainda não foram salvas?')) onClose()
  }

  const createCategory = useMutation({
    mutationFn: () => {
      const input: CategoryInput = { name: categoryName, description: null, isActive: true, sortOrder: categories.length }
      return api<{ id: string; slug: string }>('/admin/api/categories', { method: 'POST', body: jsonBody(input) })
    },
    onSuccess: async ({ id }) => {
      const created = { id, name: categoryName.trim() }
      setCreatedCategory(created)
      setCategoryName('')
      setCreatingCategory(false)
      await onCategoryCreated?.()
    },
    onError: showFormError,
  })

  const save = useMutation({
    mutationFn: async (input: ProductInput): Promise<SaveResult> => {
      const currentProduct = persistedProduct
      let saved = currentProduct
        ? await api<Product>(`/admin/api/products/${currentProduct.id}`, { method: 'PATCH', body: jsonBody(input) })
        : await api<Product>('/admin/api/products', { method: 'POST', body: jsonBody(input) })

      try {
        if (image) {
          setUploadProgress(0)
          const uploaded = await uploadBlob<{ imageKey: string }>(`/admin/api/products/${saved.id}/image`, image, setUploadProgress)
          saved = { ...saved, imageKey: uploaded.imageKey }
        } else if (removeExistingImage && currentProduct?.imageKey) {
          await api(`/admin/api/products/${saved.id}/image`, { method: 'DELETE' })
          saved = { ...saved, imageKey: null }
        }
        return { saved }
      } catch (cause) {
        return { saved, imageError: messageFromError(cause) }
      } finally {
        setUploadProgress(null)
      }
    },
    onSuccess: async ({ saved, imageError: uploadError }, input) => {
      setPersistedProduct(saved)
      form.reset(input)
      await onSaved(uploadError ? 'Produto salvo; a foto ainda precisa ser enviada.' : product ? 'Produto atualizado.' : 'Produto criado.')
      if (uploadError) {
        setImageError(`O produto foi salvo, mas não conseguimos atualizar a foto. ${uploadError}`)
        return
      }
      setImage(null)
      setRemoveExistingImage(false)
      onClose()
    },
    onError: showFormError,
  })

  const chooseImage = async (file: File) => {
    setProcessingImage(true)
    setImageError('')
    try {
      const blob = await prepareImage(file)
      setImage(blob)
      setRemoveExistingImage(false)
      setImagePreview(URL.createObjectURL(blob))
    } catch (cause) {
      setImageError(messageFromError(cause))
    } finally {
      setProcessingImage(false)
    }
  }

  const stageImageRemoval = () => {
    setImage(null)
    setImagePreview(null)
    setImageError('')
    setRemoveExistingImage(Boolean(persistedProduct?.imageKey))
  }

  const restoreImage = () => {
    setRemoveExistingImage(false)
    setImagePreview(persistedProduct?.imageKey ? `/media/${persistedProduct.imageKey}` : null)
  }

  const useMultipleSizes = () => {
    if (hasMultipleSizes) return
    const current = form.getValues('variants.0')
    variants.replace([
      { ...current, label: current.label?.trim() || 'Médio', isActive: true, sortOrder: 0 },
      { label: 'Grande', priceCents: 0, promotionalPriceCents: null, isActive: true, sortOrder: 1 },
    ])
    form.clearErrors('variants')
  }

  const useSinglePrice = () => {
    if (!hasMultipleSizes) return
    if (!window.confirm('Usar apenas um preço? Os outros tamanhos serão removidos quando você salvar o produto.')) return
    const current = form.getValues('variants.0')
    variants.replace([{ ...current, label: null, isActive: true, sortOrder: 0 }])
    form.clearErrors('variants')
  }

  const addAnotherSize = () => {
    const lastLabel = form.getValues(`variants.${variants.fields.length - 1}.label`)?.trim().toLocaleLowerCase('pt-BR')
    const suggestedLabel = lastLabel === 'pequeno' ? 'Médio' : lastLabel === 'médio' || lastLabel === 'media' || lastLabel === 'média' ? 'Grande' : lastLabel === 'grande' ? 'Família' : null
    variants.append({ label: suggestedLabel, priceCents: 0, promotionalPriceCents: null, isActive: true, sortOrder: variants.fields.length })
  }

  const focusPricingError = () => {
    setPricingOpen(true)
    setPricingFocus(crypto.randomUUID())
  }

  const submit = form.handleSubmit((input) => {
    form.clearErrors('variants')
    const labels = input.variants.map((variant) => variant.label?.trim() ?? '')
    let firstLabelError = -1
    if (input.variants.length > 1) {
      labels.forEach((label, index) => {
        let message = ''
        if (!label) message = 'Dê um nome para diferenciar este tamanho.'
        else if (labels.some((candidate, candidateIndex) => candidateIndex !== index && candidate.toLocaleLowerCase('pt-BR') === label.toLocaleLowerCase('pt-BR'))) message = 'Use um nome diferente para cada tamanho.'
        if (!message) return
        if (firstLabelError < 0) firstLabelError = index
        form.setError(`variants.${index}.label`, { type: 'manual', message })
      })
    }
    if (firstLabelError >= 0) return focusPricingError()
    const singlePrice = input.variants.length === 1
    save.mutate({
      ...input,
      variants: input.variants.map((variant, index) => ({ ...variant, label: singlePrice ? null : variant.label?.trim() || null, isActive: singlePrice ? true : variant.isActive, sortOrder: index })),
      customizationGroups: input.customizationGroups.map((group, groupIndex) => ({
        ...group,
        name: group.name.trim(),
        sortOrder: groupIndex,
        options: group.options.map((option, optionIndex) => ({ ...option, name: option.name.trim(), description: option.description?.trim() || null, sortOrder: optionIndex })),
      })),
    })
  }, (errors) => {
    if (errors.variants) focusPricingError()
    if (errors.customizationGroups) setCustomizationOpen(true)
  })

  const progressiveSection = 'rounded-[.75rem] border border-border bg-surface-strong [&>summary]:flex [&>summary]:min-h-[50px] [&>summary]:cursor-pointer [&>summary]:items-center [&>summary]:justify-between [&>summary]:gap-[.7rem] [&>summary]:px-[.85rem] [&>summary]:py-3 [&>summary]:font-[800] [&>summary]:marker:text-[var(--color-brand)] [&[open]>summary]:border-b [&[open]>summary]:border-border [&>div]:grid [&>div]:gap-[.8rem] [&>div]:p-[.85rem]'
  return <AdminDialog onClose={requestClose}><section className="w-full max-h-[94dvh] overflow-y-auto rounded-[1.2rem_1.2rem_0_0] bg-surface-strong p-4 pb-0 shadow-menu-lg min-[650px]:m-auto min-[650px]:max-h-[calc(100dvh_-_3rem)] min-[650px]:w-[min(100%,68rem)] min-[650px]:rounded-[1rem]" aria-labelledby="product-form-title">
    <div className="mb-4 flex items-center justify-between gap-4"><div><h2 className="m-0" id="product-form-title">{product ? 'Editar produto' : 'Novo produto'}</h2><p className="mt-1 text-muted">{product ? 'Altere dados, preços, tamanhos e apresentação.' : 'Informe nome, categoria e preço para começar.'}</p></div><button className={`grid h-11 w-11 cursor-pointer place-items-center rounded-full bg-[#efebe5] text-[1.5rem] ${focusRing}`} type="button" aria-label="Fechar" onClick={requestClose}><X /></button></div>
    <form className="grid gap-[.9rem]" noValidate onSubmit={submit}>
      {formError && <div ref={errorRef} tabIndex={-1}><AdminNotice notice={{ kind: 'error', message: formError }} /></div>}
      <section className="grid gap-4 rounded-[.8rem] border border-border bg-[#faf8f4] p-4" aria-labelledby="essential-title">
        <div className="flex items-center justify-between gap-3"><div><h3 className="m-0 text-base" id="essential-title">Informações principais</h3><p className="mt-[.2rem] text-[.78rem] font-[500] text-muted">Identificação e localização no cardápio.</p></div><span className="rounded-full bg-[var(--color-brand-soft)] px-2 py-1 text-[.7rem] font-[800] text-[var(--color-brand-strong)]">Obrigatório</span></div>
        <div className="grid gap-[.9rem] min-[650px]:grid-cols-2 min-[650px]:items-start">
          <label className={fieldLabel}>Nome do produto<input className={textInput} {...form.register('name')} autoFocus aria-invalid={Boolean(form.formState.errors.name)} />{form.formState.errors.name && <small className={fieldError}>{form.formState.errors.name.message}</small>}</label>
          <div className="grid min-w-0 gap-[.55rem] min-[650px]:grid-cols-[minmax(0,1fr)_auto] min-[650px]:items-end"><label className={fieldLabel}>Categoria<select className={textInput} {...form.register('categoryId')} aria-invalid={Boolean(form.formState.errors.categoryId)}>{categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>{form.formState.errors.categoryId && <small className={fieldError}>{form.formState.errors.categoryId.message}</small>}</label><button className={`${secondaryButton} justify-self-start whitespace-nowrap`} type="button" onClick={() => setCreatingCategory((value) => !value)}>{creatingCategory ? <><X /> Cancelar</> : <><Plus /> Nova categoria</>}</button></div>
        </div>
        {creatingCategory && <div className="grid gap-[.7rem] rounded-[.65rem] border border-[color-mix(in_srgb,var(--color-brand)_30%,var(--color-border))] bg-[var(--color-brand-soft)] p-3 min-[650px]:grid-cols-[minmax(0,1fr)_auto] min-[650px]:items-end"><label className={fieldLabel}>Nome da nova categoria<input className={textInput} value={categoryName} maxLength={80} placeholder="Ex.: Bebidas" onChange={(event) => setCategoryName(event.target.value)} /></label><button className={secondaryButton} type="button" disabled={!categoryName.trim() || createCategory.isPending} onClick={() => createCategory.mutate()}>{createCategory.isPending ? 'Criando…' : 'Criar e selecionar'}</button></div>}
      </section>

      <details ref={pricingRef} className={`${progressiveSection} scroll-mb-4`} open={pricingOpen} onToggle={(event) => setPricingOpen(event.currentTarget.open)}><summary>Preços e tamanhos <span className="ml-auto text-[.72rem] font-[600] text-muted">{product ? hasMultipleSizes ? `${variants.fields.length} tamanhos` : 'Preço único' : 'Obrigatório'}</span></summary><div>
        <div className="grid gap-[.7rem]"><div className="grid gap-[.15rem]"><strong>Como este produto é vendido?</strong><span className="text-[.8rem] text-muted">Escolha a opção que combina com o cardápio.</span></div><div className="grid grid-cols-2 gap-[.55rem]" role="group" aria-label="Forma de venda do produto"><button className={`grid min-h-[70px] cursor-pointer content-center gap-[.15rem] rounded-[.65rem] border border-border bg-white p-[.65rem] text-left ${focusRing} aria-[pressed=true]:!border-[var(--color-brand)] aria-[pressed=true]:!bg-[var(--color-brand)] aria-[pressed=true]:!text-[var(--color-brand-text)] [&[aria-pressed=true]>small]:!text-[var(--color-brand-text)]`} type="button" aria-pressed={!hasMultipleSizes} onClick={useSinglePrice}><strong className="text-[.84rem]">Um preço só</strong><small className="text-[.72rem] leading-[1.35] text-muted">Não possui tamanhos.</small></button><button className={`grid min-h-[70px] cursor-pointer content-center gap-[.15rem] rounded-[.65rem] border border-border bg-white p-[.65rem] text-left ${focusRing} aria-[pressed=true]:!border-[var(--color-brand)] aria-[pressed=true]:!bg-[var(--color-brand)] aria-[pressed=true]:!text-[var(--color-brand-text)] [&[aria-pressed=true]>small]:!text-[var(--color-brand-text)]`} type="button" aria-pressed={hasMultipleSizes} onClick={useMultipleSizes}><strong className="text-[.84rem]">Mais de um tamanho</strong><small className="text-[.72rem] leading-[1.35] text-muted">Ex.: Médio e Grande.</small></button></div></div>
        {product && <p className="m-0 border-l-[3px] border-[var(--color-brand)] bg-[var(--color-brand-soft)] px-[.65rem] py-[.45rem] text-[.78rem] text-muted">Editando preços de <strong className="text-text">{product.name}</strong></p>}
        <div className="grid gap-[.8rem] min-[650px]:grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))]">
          {variants.fields.map((variant, index) => { const variantError = form.formState.errors.variants?.[index]; const promotionEnabled = watchedVariants?.[index]?.promotionalPriceCents !== null; return <section className={cn('grid min-w-0 content-start gap-[.7rem] rounded-[.75rem] border border-border bg-[#faf8f4] p-[.85rem]', !hasMultipleSizes && 'w-full max-w-[32rem]')} key={variant.id}>
            <div className="flex items-center justify-between gap-[.6rem]"><div className="grid gap-[.15rem]"><strong>{hasMultipleSizes ? watchedVariants?.[index]?.label || `Tamanho ${index + 1}` : 'Preço do produto'}</strong>{!hasMultipleSizes && <span className="text-[.74rem] font-[500] text-muted">O cliente verá apenas o valor, sem nome de tamanho.</span>}</div>{hasMultipleSizes && <button className={`inline-flex min-h-11 cursor-pointer items-center gap-[.35rem] border-0 bg-transparent px-[.45rem] text-[.75rem] font-[750] text-danger ${focusRing}`} type="button" aria-label={`Remover tamanho ${index + 1}`} onClick={() => variants.remove(index)}><Trash2 className="w-4" /> Remover</button>}</div>
            {hasMultipleSizes && <label className={fieldLabel}>Nome do tamanho<input className={`${textInput} min-h-[46px] py-[.65rem]`} placeholder="Ex.: Médio" maxLength={40} aria-invalid={Boolean(variantError?.label)} {...form.register(`variants.${index}.label`, { setValueAs: (value) => value || null })} />{variantError?.label && <small className={fieldError}>{variantError.label.message}</small>}</label>}
            <Controller control={form.control} name={`variants.${index}.priceCents`} render={({ field }) => <MoneyInput id={`product-price-${index}`} label="Preço normal" value={field.value > 0 ? field.value : null} onChange={(value) => field.onChange(value ?? 0)} error={variantError?.priceCents?.message} />} />
            <label className={checkField}><input className="h-[1.15rem] w-[1.15rem] accent-[var(--color-brand)]" type="checkbox" checked={promotionEnabled} onChange={(event) => form.setValue(`variants.${index}.promotionalPriceCents`, event.target.checked ? 0 : null, { shouldDirty: true, shouldValidate: !event.target.checked })} /> {hasMultipleSizes ? 'Este tamanho está em promoção' : 'Este produto está em promoção'}</label>
            {promotionEnabled && <Controller control={form.control} name={`variants.${index}.promotionalPriceCents`} render={({ field }) => <MoneyInput id={`product-promotion-${index}`} label="Preço promocional" value={field.value && field.value > 0 ? field.value : null} onChange={field.onChange} error={variantError?.promotionalPriceCents?.message} />} />}
            {hasMultipleSizes && <label className={checkField}><input className="h-[1.15rem] w-[1.15rem] accent-[var(--color-brand)]" type="checkbox" {...form.register(`variants.${index}.isActive`)} /> Este tamanho está disponível</label>}
            <input type="hidden" {...form.register(`variants.${index}.sortOrder`, { valueAsNumber: true })} value={index} />
          </section>})}
        </div>
        {hasMultipleSizes && <button className={`${secondaryButton} justify-self-start`} type="button" disabled={variants.fields.length >= 20} onClick={addAnotherSize}><Plus /> Adicionar outro tamanho</button>}
        {variants.fields.length >= 20 && <small className={fieldHelp}>Você atingiu o limite de 20 tamanhos neste produto.</small>}
      </div></details>

      <details className={progressiveSection} open={customizationOpen} onToggle={(event) => setCustomizationOpen(event.currentTarget.open)}><summary>Montagem e adicionais <span className="ml-auto text-[.72rem] font-[600] text-muted">{customizationGroupCount ? `${customizationGroupCount} ${customizationGroupCount === 1 ? 'grupo' : 'grupos'}` : 'Opcional'}</span></summary><div className="min-w-0"><CustomizationGroupsEditor form={form} /></div></details>

      <details className={progressiveSection} open={ingredientsOpen} onToggle={(event) => setIngredientsOpen(event.currentTarget.open)}><summary>Ingredientes ou descrição <span className="ml-auto text-[.72rem] font-[600] text-muted">Opcional</span></summary><div><label className={fieldLabel}>Texto exibido no cardápio<textarea className={`${textInput} resize-y`} rows={4} {...form.register('ingredients', { setValueAs: (value) => value || null })} /></label></div></details>

      <details className={progressiveSection} open={imageOpen} onToggle={(event) => setImageOpen(event.currentTarget.open)}><summary>Foto do produto <span className="ml-auto text-[.72rem] font-[600] text-muted">Opcional</span></summary><div><fieldset className="grid min-w-0 gap-[.7rem] rounded-[.7rem] border border-border p-3"><legend className="sr-only">Foto do produto</legend>{imagePreview ? <img className="aspect-[16/9] max-h-[15rem] w-full rounded-[.6rem] bg-[#ece8e1] object-contain" src={imagePreview} alt="Prévia do produto" /> : <div className="grid aspect-[16/9] max-h-[15rem] place-content-center justify-items-center gap-[.35rem] rounded-[.6rem] bg-[#ece8e1] text-muted"><ImageIcon /><span>Sem foto</span></div>}{imageError && <AdminNotice notice={{ kind: 'error', message: imageError }} />}{removeExistingImage && <AdminNotice notice={{ kind: 'info', message: 'A foto atual será removida quando você salvar o produto.' }} action={<button className={`inline-flex min-h-11 cursor-pointer items-center gap-[.35rem] border-0 bg-transparent px-[.2rem] font-[800] text-[var(--color-brand-strong)] ${focusRing}`} type="button" onClick={restoreImage}><RotateCcw /> Desfazer</button>} />}<div className="flex flex-wrap items-center gap-[.65rem]"><label className={`relative inline-flex min-h-11 cursor-pointer items-center justify-center gap-[.4rem] rounded-[.55rem] border border-border bg-surface-strong px-[.9rem] py-[.65rem] font-[750] ${focusRing}`}>{processingImage ? 'Preparando foto…' : imagePreview ? 'Substituir foto' : 'Escolher foto'}<input className="absolute h-px w-px opacity-0" type="file" accept="image/jpeg,image/png,image/webp" disabled={processingImage || save.isPending} onChange={(event) => { const file = event.target.files?.[0]; if (file) void chooseImage(file); event.currentTarget.value = '' }} /></label>{imagePreview && <button type="button" className={`min-h-[42px] cursor-pointer border-0 bg-transparent px-2 font-[750] text-danger ${focusRing}`} onClick={stageImageRemoval}>Remover foto</button>}</div>{uploadProgress !== null && <div className="grid gap-[.3rem] text-[.78rem] text-muted" role="status"><progress className="h-[.65rem] w-full accent-[var(--color-brand)]" max="100" value={uploadProgress} /><span>Enviando foto: {uploadProgress}%</span></div>}<small className="text-[.78rem] text-muted">JPG, PNG ou WebP. A foto será otimizada antes do envio.</small></fieldset></div></details>

      <details className={progressiveSection}><summary>Destaque no cardápio <span className="ml-auto text-[.72rem] font-[600] text-muted">Opcional</span></summary><div><label className={checkField}><input className="h-[1.15rem] w-[1.15rem] accent-[var(--color-brand)]" type="checkbox" {...form.register('isFeatured')} /> Mostrar este produto nos destaques</label></div></details>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap justify-end gap-[.55rem] border-t border-border bg-surface-strong p-[.8rem_1rem] shadow-sm"><button className={secondaryButton} type="button" onClick={requestClose}>Cancelar</button><button className={primaryButton} type="submit" disabled={save.isPending || processingImage}>{save.isPending ? uploadProgress !== null ? `Enviando foto… ${uploadProgress}%` : 'Salvando…' : imageError && image ? 'Tentar enviar foto novamente' : 'Salvar produto'}</button></div>
    </form>
  </section></AdminDialog>
}
