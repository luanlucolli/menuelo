import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { ImageIcon, Plus, RotateCcw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import type { Category, CategoryInput, Product, ProductInput } from '../../../../shared/schemas'
import { productInputSchema } from '../../../../shared/schemas'
import { api, jsonBody, messageFromError, uploadBlob } from '../../lib/api'
import { prepareImage } from '../../lib/image'
import { AdminDialog } from './AdminDialog'
import { AdminNotice } from './AdminNotice'
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
  const [ingredientsOpen, setIngredientsOpen] = useState(Boolean(product?.ingredients))
  const [imageOpen, setImageOpen] = useState(Boolean(product?.imageKey))
  const [pricingOpen, setPricingOpen] = useState((product?.variants.length ?? 0) > 1)
  const errorRef = useRef<HTMLDivElement>(null)
  const form = useForm<ProductInput>({
    resolver: zodResolver(productInputSchema),
    defaultValues: product ? {
      categoryId: product.categoryId,
      name: product.name,
      ingredients: product.ingredients,
      isAvailable: product.isAvailable,
      isFeatured: product.isFeatured,
      sortOrder: product.sortOrder,
      variants: product.variants.map((variant) => ({ label: variant.label, priceCents: variant.priceCents, promotionalPriceCents: variant.promotionalPriceCents, isActive: variant.isActive, sortOrder: variant.sortOrder })),
    } : { categoryId: categories.some((category) => category.id === initialCategoryId) ? initialCategoryId! : categories[0]?.id ?? '', name: '', ingredients: null, isAvailable: true, isFeatured: false, sortOrder: 0, variants: [{ label: null, priceCents: 0, promotionalPriceCents: null, isActive: true, sortOrder: 0 }] },
  })
  const fields = useFieldArray({ control: form.control, name: 'variants' })
  const watchedVariants = useWatch({ control: form.control, name: 'variants' })
  const categoryOptions = createdCategory && !categories.some((category) => category.id === createdCategory.id)
    ? [...categories.map((category) => ({ id: category.id, name: category.name })), createdCategory]
    : categories.map((category) => ({ id: category.id, name: category.name }))

  useEffect(() => () => { if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview) }, [imagePreview])

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
      form.setValue('categoryId', id, { shouldDirty: true, shouldValidate: true })
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

  const firstVariantError = form.formState.errors.variants?.[0]

  return <AdminDialog onClose={requestClose}><section className="admin-form-dialog product-form-dialog" aria-labelledby="product-form-title">
    <div className="form-dialog-heading"><div><h2 id="product-form-title">{product ? 'Editar produto' : 'Novo produto'}</h2><p>Comece pelo nome, categoria e preço. O restante é opcional.</p></div><button type="button" aria-label="Fechar" onClick={requestClose}><X /></button></div>
    <form noValidate onSubmit={form.handleSubmit((input) => save.mutate(input))}>
      {formError && <div ref={errorRef} tabIndex={-1}><AdminNotice notice={{ kind: 'error', message: formError }} /></div>}
      <section className="essential-fields" aria-labelledby="essential-title">
        <div className="section-heading"><h3 id="essential-title">Informações principais</h3><span>Obrigatório</span></div>
        <label>Nome do produto<input {...form.register('name')} autoFocus aria-invalid={Boolean(form.formState.errors.name)} />{form.formState.errors.name && <small className="field-error">{form.formState.errors.name.message}</small>}</label>
        <div className="category-field"><label>Categoria<select {...form.register('categoryId')} aria-invalid={Boolean(form.formState.errors.categoryId)}>{categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>{form.formState.errors.categoryId && <small className="field-error">{form.formState.errors.categoryId.message}</small>}</label><button className="text-button" type="button" onClick={() => setCreatingCategory((value) => !value)}>{creatingCategory ? 'Cancelar nova categoria' : 'Criar nova categoria'}</button></div>
        {creatingCategory && <div className="inline-create-category"><label>Nome da nova categoria<input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} /></label><button className="secondary-button" type="button" disabled={!categoryName.trim() || createCategory.isPending} onClick={() => createCategory.mutate()}>{createCategory.isPending ? 'Criando…' : 'Criar e selecionar'}</button></div>}
        {fields.fields[0] && <Controller control={form.control} name="variants.0.priceCents" render={({ field }) => <MoneyInput id="product-main-price" label={fields.fields.length > 1 ? `Preço — ${watchedVariants?.[0]?.label || 'primeira opção'}` : 'Preço'} value={field.value > 0 ? field.value : null} onChange={(value) => field.onChange(value ?? 0)} error={firstVariantError?.priceCents?.message} />} />}
      </section>

      <details className="progressive-section" open={ingredientsOpen} onToggle={(event) => setIngredientsOpen(event.currentTarget.open)}><summary>Ingredientes ou descrição <span>Opcional</span></summary><div><label>Texto exibido no cardápio<textarea rows={4} {...form.register('ingredients', { setValueAs: (value) => value || null })} /></label></div></details>

      <details className="progressive-section" open={imageOpen} onToggle={(event) => setImageOpen(event.currentTarget.open)}><summary>Foto do produto <span>Opcional</span></summary><div><fieldset className="image-field"><legend className="sr-only">Foto do produto</legend>{imagePreview ? <img src={imagePreview} alt="Prévia do produto" /> : <div className="image-preview-placeholder"><ImageIcon /><span>Sem foto</span></div>}{imageError && <AdminNotice notice={{ kind: 'error', message: imageError }} />}{removeExistingImage && <AdminNotice notice={{ kind: 'info', message: 'A foto atual será removida quando você salvar o produto.' }} action={<button className="text-button" type="button" onClick={restoreImage}><RotateCcw /> Desfazer</button>} />}<div className="inline-actions"><label className="secondary-button file-button">{processingImage ? 'Preparando foto…' : imagePreview ? 'Substituir foto' : 'Escolher foto'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={processingImage || save.isPending} onChange={(event) => { const file = event.target.files?.[0]; if (file) void chooseImage(file); event.currentTarget.value = '' }} /></label>{imagePreview && <button type="button" className="text-danger" onClick={stageImageRemoval}>Remover foto</button>}</div>{uploadProgress !== null && <div className="upload-progress" role="status"><progress max="100" value={uploadProgress} /><span>Enviando foto: {uploadProgress}%</span></div>}<small>JPG, PNG ou WebP. A foto será otimizada antes do envio.</small></fieldset></div></details>

      <details className="progressive-section" open={pricingOpen} onToggle={(event) => setPricingOpen(event.currentTarget.open)}><summary>Promoção e tamanhos <span>Opcional</span></summary><div className="variants-field">
        <div className="variant-row compact-variant">
          <label>Nome da primeira opção<input placeholder={fields.fields.length === 1 ? 'Ex.: Único (opcional)' : 'Ex.: Pequeno'} {...form.register('variants.0.label', { setValueAs: (value) => value || null })} /></label>
          {watchedVariants?.[0]?.promotionalPriceCents === null ? <button className="secondary-button" type="button" onClick={() => form.setValue('variants.0.promotionalPriceCents', 0, { shouldDirty: true })}>Adicionar promoção</button> : <><Controller control={form.control} name="variants.0.promotionalPriceCents" render={({ field }) => <MoneyInput id="product-main-promotion" label="Preço promocional" value={field.value && field.value > 0 ? field.value : null} onChange={field.onChange} error={firstVariantError?.promotionalPriceCents?.message} />} /><button className="text-danger" type="button" onClick={() => form.setValue('variants.0.promotionalPriceCents', null, { shouldDirty: true, shouldValidate: true })}>Remover promoção</button></>}
          {(fields.fields.length > 1 || watchedVariants?.[0]?.isActive === false) && <label className="check-field"><input type="checkbox" {...form.register('variants.0.isActive')} /> Oferecer esta opção</label>}
          <input type="hidden" {...form.register('variants.0.sortOrder', { valueAsNumber: true })} value={0} />
        </div>
        {fields.fields.slice(1).map((field, slicedIndex) => { const index = slicedIndex + 1; const variantError = form.formState.errors.variants?.[index]; return <div className="variant-row" key={field.id}>
          <label>Nome da opção<input placeholder="Ex.: Médio" {...form.register(`variants.${index}.label`, { setValueAs: (value) => value || null })} /></label>
          <Controller control={form.control} name={`variants.${index}.priceCents`} render={({ field: priceField }) => <MoneyInput id={`product-price-${index}`} label="Preço" value={priceField.value > 0 ? priceField.value : null} onChange={(value) => priceField.onChange(value ?? 0)} error={variantError?.priceCents?.message} />} />
          {watchedVariants?.[index]?.promotionalPriceCents === null ? <button className="secondary-button" type="button" onClick={() => form.setValue(`variants.${index}.promotionalPriceCents`, 0, { shouldDirty: true })}>Adicionar promoção</button> : <><Controller control={form.control} name={`variants.${index}.promotionalPriceCents`} render={({ field: promotionField }) => <MoneyInput id={`product-promotion-${index}`} label="Preço promocional" value={promotionField.value && promotionField.value > 0 ? promotionField.value : null} onChange={promotionField.onChange} error={variantError?.promotionalPriceCents?.message} />} /><button className="text-danger" type="button" onClick={() => form.setValue(`variants.${index}.promotionalPriceCents`, null, { shouldDirty: true, shouldValidate: true })}>Remover promoção</button></>}
          <input type="hidden" {...form.register(`variants.${index}.sortOrder`, { valueAsNumber: true })} value={index} />
          <label className="check-field"><input type="checkbox" {...form.register(`variants.${index}.isActive`)} /> Oferecer esta opção</label>
          <button className="text-danger" type="button" onClick={() => fields.remove(index)}>Remover opção</button>
        </div>})}
        <button className="secondary-button" type="button" onClick={() => { fields.append({ label: null, priceCents: 0, promotionalPriceCents: null, isActive: true, sortOrder: fields.fields.length }); setPricingOpen(true) }}><Plus /> Adicionar tamanho ou opção</button>
      </div></details>

      <details className="progressive-section"><summary>Exibição no cardápio <span>Opcional</span></summary><div className="check-grid"><label className="check-field"><input type="checkbox" {...form.register('isAvailable')} /> Disponível para venda</label><label className="check-field"><input type="checkbox" {...form.register('isFeatured')} /> Mostrar nos destaques</label></div></details>

      <div className="form-actions sticky-actions"><button className="secondary-button" type="button" onClick={requestClose}>Cancelar</button><button className="primary-button" type="submit" disabled={save.isPending || processingImage}>{save.isPending ? uploadProgress !== null ? `Enviando foto… ${uploadProgress}%` : 'Salvando…' : imageError && image ? 'Tentar enviar foto novamente' : 'Salvar produto'}</button></div>
    </form>
  </section></AdminDialog>
}
