import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { ImageIcon, Plus, RotateCcw, Trash2, X } from 'lucide-react'
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
  const [pricingOpen, setPricingOpen] = useState(!product)
  const [pricingFocus, setPricingFocus] = useState<string | null>(null)
  const [ingredientsOpen, setIngredientsOpen] = useState(false)
  const [imageOpen, setImageOpen] = useState(Boolean(product?.imageKey))
  const errorRef = useRef<HTMLDivElement>(null)
  const pricingRef = useRef<HTMLDetailsElement>(null)
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
  const variants = useFieldArray({ control: form.control, name: 'variants' })
  const watchedVariants = useWatch({ control: form.control, name: 'variants' })
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
    save.mutate({ ...input, variants: input.variants.map((variant, index) => ({ ...variant, label: variant.label?.trim() || null, sortOrder: index })) })
  }, (errors) => {
    if (errors.variants) focusPricingError()
  })

  return <AdminDialog onClose={requestClose}><section className="admin-form-dialog product-form-dialog" aria-labelledby="product-form-title">
    <div className="form-dialog-heading"><div><h2 id="product-form-title">{product ? 'Editar produto' : 'Novo produto'}</h2><p>{product ? 'Altere dados, preços, tamanhos e apresentação.' : 'Informe nome, categoria e preço para começar.'}</p></div><button type="button" aria-label="Fechar" onClick={requestClose}><X /></button></div>
    <form noValidate onSubmit={submit}>
      {formError && <div ref={errorRef} tabIndex={-1}><AdminNotice notice={{ kind: 'error', message: formError }} /></div>}
      <section className="essential-fields" aria-labelledby="essential-title">
        <div className="section-heading"><div><h3 id="essential-title">Informações principais</h3><p>Identificação e localização no cardápio.</p></div><span>Obrigatório</span></div>
        <div className="product-main-fields">
          <label>Nome do produto<input {...form.register('name')} autoFocus aria-invalid={Boolean(form.formState.errors.name)} />{form.formState.errors.name && <small className="field-error">{form.formState.errors.name.message}</small>}</label>
          <div className="category-field"><label>Categoria<select {...form.register('categoryId')} aria-invalid={Boolean(form.formState.errors.categoryId)}>{categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>{form.formState.errors.categoryId && <small className="field-error">{form.formState.errors.categoryId.message}</small>}</label><button className="secondary-button category-create-button" type="button" onClick={() => setCreatingCategory((value) => !value)}>{creatingCategory ? <><X /> Cancelar</> : <><Plus /> Nova categoria</>}</button></div>
        </div>
        {creatingCategory && <div className="inline-create-category"><label>Nome da nova categoria<input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} /></label><button className="secondary-button" type="button" disabled={!categoryName.trim() || createCategory.isPending} onClick={() => createCategory.mutate()}>{createCategory.isPending ? 'Criando…' : 'Criar e selecionar'}</button></div>}
      </section>

      <details ref={pricingRef} className="progressive-section pricing-section" open={pricingOpen} onToggle={(event) => setPricingOpen(event.currentTarget.open)}><summary>Preços e tamanhos <span>{product ? variants.fields.length === 1 ? '1 preço' : `${variants.fields.length} tamanhos` : 'Obrigatório'}</span></summary><div>
        <p className="variant-section-intro">{product && <strong>{product.name}</strong>}Use um preço único ou crie tamanhos como Pequeno, Médio e Grande.</p>
        <div className="variant-editor-list">
          {variants.fields.map((variant, index) => { const variantError = form.formState.errors.variants?.[index]; const promotionEnabled = watchedVariants?.[index]?.promotionalPriceCents !== null; return <section className="variant-editor-item" key={variant.id}>
            <div className="variant-editor-heading"><strong>{variants.fields.length === 1 ? 'Preço principal' : `Tamanho ${index + 1}`}</strong>{variants.fields.length > 1 && <button className="remove-option" type="button" aria-label={`Remover tamanho ${index + 1}`} onClick={() => variants.remove(index)}><Trash2 /> Remover</button>}</div>
            <label>Nome do tamanho {variants.fields.length === 1 && <span className="optional-label">(opcional)</span>}<input placeholder={variants.fields.length === 1 ? 'Ex.: Único' : 'Ex.: Médio'} maxLength={40} aria-invalid={Boolean(variantError?.label)} {...form.register(`variants.${index}.label`, { setValueAs: (value) => value || null })} />{variantError?.label && <small className="field-error">{variantError.label.message}</small>}</label>
            <Controller control={form.control} name={`variants.${index}.priceCents`} render={({ field }) => <MoneyInput id={`product-price-${index}`} label="Preço normal" value={field.value > 0 ? field.value : null} onChange={(value) => field.onChange(value ?? 0)} error={variantError?.priceCents?.message} />} />
            <label className="check-field"><input type="checkbox" checked={promotionEnabled} onChange={(event) => form.setValue(`variants.${index}.promotionalPriceCents`, event.target.checked ? 0 : null, { shouldDirty: true, shouldValidate: !event.target.checked })} /> Colocar em promoção</label>
            {promotionEnabled && <Controller control={form.control} name={`variants.${index}.promotionalPriceCents`} render={({ field }) => <MoneyInput id={`product-promotion-${index}`} label="Preço promocional" value={field.value && field.value > 0 ? field.value : null} onChange={field.onChange} error={variantError?.promotionalPriceCents?.message} />} />}
            <label className="check-field"><input type="checkbox" {...form.register(`variants.${index}.isActive`)} /> Mostrar este tamanho no cardápio</label>
            <input type="hidden" {...form.register(`variants.${index}.sortOrder`, { valueAsNumber: true })} value={index} />
          </section>})}
        </div>
        <button className="secondary-button add-variant-option" type="button" disabled={variants.fields.length >= 20} onClick={() => variants.append({ label: null, priceCents: 0, promotionalPriceCents: null, isActive: true, sortOrder: variants.fields.length })}><Plus /> Adicionar tamanho</button>
        {variants.fields.length >= 20 && <small className="field-help">Você atingiu o limite de 20 tamanhos neste produto.</small>}
      </div></details>

      <details className="progressive-section" open={ingredientsOpen} onToggle={(event) => setIngredientsOpen(event.currentTarget.open)}><summary>Ingredientes ou descrição <span>Opcional</span></summary><div><label>Texto exibido no cardápio<textarea rows={4} {...form.register('ingredients', { setValueAs: (value) => value || null })} /></label></div></details>

      <details className="progressive-section" open={imageOpen} onToggle={(event) => setImageOpen(event.currentTarget.open)}><summary>Foto do produto <span>Opcional</span></summary><div><fieldset className="image-field"><legend className="sr-only">Foto do produto</legend>{imagePreview ? <img src={imagePreview} alt="Prévia do produto" /> : <div className="image-preview-placeholder"><ImageIcon /><span>Sem foto</span></div>}{imageError && <AdminNotice notice={{ kind: 'error', message: imageError }} />}{removeExistingImage && <AdminNotice notice={{ kind: 'info', message: 'A foto atual será removida quando você salvar o produto.' }} action={<button className="text-button" type="button" onClick={restoreImage}><RotateCcw /> Desfazer</button>} />}<div className="inline-actions"><label className="secondary-button file-button">{processingImage ? 'Preparando foto…' : imagePreview ? 'Substituir foto' : 'Escolher foto'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={processingImage || save.isPending} onChange={(event) => { const file = event.target.files?.[0]; if (file) void chooseImage(file); event.currentTarget.value = '' }} /></label>{imagePreview && <button type="button" className="text-danger" onClick={stageImageRemoval}>Remover foto</button>}</div>{uploadProgress !== null && <div className="upload-progress" role="status"><progress max="100" value={uploadProgress} /><span>Enviando foto: {uploadProgress}%</span></div>}<small>JPG, PNG ou WebP. A foto será otimizada antes do envio.</small></fieldset></div></details>

      <details className="progressive-section"><summary>Destaque no cardápio <span>Opcional</span></summary><div><label className="check-field"><input type="checkbox" {...form.register('isFeatured')} /> Mostrar este produto nos destaques</label></div></details>

      <div className="form-actions sticky-actions"><button className="secondary-button" type="button" onClick={requestClose}>Cancelar</button><button className="primary-button" type="submit" disabled={save.isPending || processingImage}>{save.isPending ? uploadProgress !== null ? `Enviando foto… ${uploadProgress}%` : 'Salvando…' : imageError && image ? 'Tentar enviar foto novamente' : 'Salvar produto'}</button></div>
    </form>
  </section></AdminDialog>
}
