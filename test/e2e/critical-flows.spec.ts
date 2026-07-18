import { expect, test, type APIRequestContext } from '@playwright/test'
import { Buffer } from 'node:buffer'
import type { MenuResponse } from '../../shared/schemas'

async function menu(request: APIRequestContext): Promise<MenuResponse> {
  const response = await request.get('/admin/api/menu')
  expect(response.ok()).toBeTruthy()
  return response.json() as Promise<MenuResponse>
}

test('cardápio público é responsivo, pesquisa sem duplicar e devolve o foco', async ({ page, request }) => {
  const current = await menu(request)
  const category = current.categories.find((item) => item.products.length > 0)
  test.skip(!category, 'O cardápio local precisa ter ao menos um produto.')
  const product = category!.products[0]

  for (const width of [360, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 600 ? 800 : 900 })
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('searchbox', { name: 'Pesquisar no cardápio' }).fill(product.name)
  await expect(page.getByRole('heading', { name: /item encontrado|itens encontrados/ })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Categorias do cardápio' })).toBeHidden()
  const result = page.getByRole('button', { name: `Ver detalhes de ${product.name}` })
  await expect(result).toHaveCount(1)
  await result.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Fechar detalhes' }).click()
  await expect(result).toBeFocused()
  await page.getByRole('button', { name: 'Limpar pesquisa' }).click()

  const last = current.categories.filter((item) => item.products.length > 0).at(-1)
  if (last) {
    await page.locator(`#${last.slug}`).evaluate((element) => element.scrollIntoView({ block: 'start' }))
    await expect(page.locator(`.category-nav button[data-category="${last.slug}"]`)).toHaveClass(/active/)
  }
})

test('painel mobile prioriza tarefas e mantém navegação acessível', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'O que você quer fazer?' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Adicionar produto/ })).toBeVisible()
  const menuButton = page.getByRole('button', { name: 'Abrir menu' })
  expect((await menuButton.boundingBox())!.x).toBeLessThan(60)
  await menuButton.click()
  await expect(page.locator('#admin-sidebar').getByRole('button', { name: 'Fechar', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menuButton).toBeFocused()

  await page.goto('/admin/importar-exportar')
  await expect(page.getByRole('heading', { name: 'Cópia de segurança' })).toBeVisible()
  await expect(page.getByText('Baixe uma cópia dos dados ou restaure uma cópia anterior.')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
})

test('cria produto, valida promoção, alterna disponibilidade, duplica e exclui', async ({ page, request }) => {
  const suffix = Date.now().toString(36)
  const categoryName = `Categoria teste ${suffix}`
  const productName = `Produto teste ${suffix}`
  const productIds: string[] = []
  let categoryId = ''

  try {
    const response = await request.post('/admin/api/categories', { data: { name: categoryName, description: null, isActive: true, sortOrder: 0 } })
    expect(response.ok()).toBeTruthy()
    categoryId = (await response.json() as { id: string }).id

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/admin/produtos?categoria=${categoryId}&acao=novo`)
    await expect(page.getByRole('heading', { name: 'Novo produto' })).toBeVisible()
    await expect(page.getByRole('dialog').getByLabel('Categoria')).toHaveValue(categoryId)
    await page.getByLabel('Nome do produto').fill(productName)
    await page.getByLabel(/^Preço$/).fill('2590')
    await page.getByRole('button', { name: 'Salvar produto' }).click()
    await expect(page.getByText('Produto criado.')).toBeVisible()

    const saved = (await menu(request)).categories.flatMap((item) => item.products).find((item) => item.name === productName)
    expect(saved).toBeTruthy()
    productIds.push(saved!.id)

    let row = page.locator('article').filter({ hasText: productName })
    await row.getByRole('button', { name: 'Preços' }).click()
    await page.getByLabel('Colocar em promoção').check()
    await page.getByLabel('Preço promocional').fill('3000')
    await page.getByRole('button', { name: 'Salvar preços' }).click()
    await expect(page.getByText('O preço promocional precisa ser menor que o preço normal.')).toBeVisible()
    await page.getByLabel('Preço promocional').fill('1990')
    await page.getByRole('button', { name: 'Salvar preços' }).click()
    await expect(page.getByText('Preços e promoções atualizados.')).toBeVisible()

    row = page.locator('article').filter({ hasText: productName })
    await row.getByRole('button', { name: 'Indisponibilizar' }).click()
    await expect(row.getByText('Indisponível', { exact: true })).toBeVisible()
    await row.getByRole('button', { name: 'Duplicar' }).click()
    await expect(page.getByRole('heading', { name: 'Editar produto' })).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click()

    const copy = (await menu(request)).categories.flatMap((item) => item.products).find((item) => item.name === `Cópia de ${productName}`)
    expect(copy).toBeTruthy()
    productIds.push(copy!.id)

    row = page.locator('article').filter({ hasText: productName }).first()
    await row.getByRole('button', { name: 'Excluir' }).click()
    await expect(page.getByRole('heading', { name: `Excluir “${productName}”?` })).toBeVisible()
    await page.getByRole('button', { name: 'Excluir produto' }).click()
    await expect(page.getByText('Produto excluído.')).toBeVisible()
    productIds.shift()
  } finally {
    if (categoryId) {
      const current = await menu(request)
      const temporaryCategory = current.categories.find((category) => category.id === categoryId)
      for (const product of temporaryCategory?.products ?? []) await request.delete(`/admin/api/products/${product.id}`)
      await request.delete(`/admin/api/categories/${categoryId}`)
    } else {
      for (const id of productIds) await request.delete(`/admin/api/products/${id}`)
    }
  }
})

test('organização oferece alternativa aos gestos de arrastar e filtros persistem', async ({ page, request }) => {
  const current = await menu(request)
  const category = current.categories.find((item) => item.products.length > 1)
  test.skip(!category, 'É preciso uma categoria local com dois produtos.')
  await page.setViewportSize({ width: 430, height: 900 })
  await page.goto(`/admin/produtos?categoria=${category!.id}`)
  await page.getByRole('button', { name: 'Organizar produtos' }).click()
  await expect(page.getByRole('button', { name: 'Subir' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Descer' }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await page.getByLabel('Mostrar').selectOption('promotion')
  await expect(page).toHaveURL(/filtro=promotion/)
})

test('falha no upload preserva o produto e permite reenviar e remover a foto', async ({ page, request }) => {
  const suffix = Date.now().toString(36)
  let categoryId = ''
  let productId = ''
  try {
    const categoryResponse = await request.post('/admin/api/categories', { data: { name: `Fotos teste ${suffix}`, description: null, isActive: true, sortOrder: 0 } })
    categoryId = (await categoryResponse.json() as { id: string }).id
    const productResponse = await request.post('/admin/api/products', { data: {
      categoryId, name: `Foto teste ${suffix}`, ingredients: null, isAvailable: true, isFeatured: false, sortOrder: 0,
      variants: [{ label: null, priceCents: 1000, promotionalPriceCents: null, isActive: true, sortOrder: 0 }],
    } })
    const product = await productResponse.json() as { id: string; name: string }
    productId = product.id

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/admin/produtos?categoria=${categoryId}`)
    const row = page.locator('article').filter({ hasText: product.name })
    await row.getByRole('button', { name: 'Editar' }).click()
    const photoSection = page.locator('details').filter({ hasText: 'Foto do produto' })
    await photoSection.locator('summary').click()
    const bytes = await page.evaluate(async () => {
      const canvas = document.createElement('canvas')
      canvas.width = 80; canvas.height = 80
      const context = canvas.getContext('2d')!
      context.fillStyle = '#7a3526'; context.fillRect(0, 0, 80, 80)
      context.fillStyle = '#ffffff'; context.fillRect(20, 20, 40, 40)
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((value) => resolve(value!), 'image/png'))
      return [...new Uint8Array(await blob.arrayBuffer())]
    })
    await page.locator('input[type="file"]').setInputFiles({ name: 'produto.png', mimeType: 'image/png', buffer: Buffer.from(bytes) })
    await expect(page.getByAltText('Prévia do produto')).toBeVisible()

    await page.route(`**/admin/api/products/${productId}/image`, (route) => route.abort('failed'))
    await page.getByRole('button', { name: 'Salvar produto' }).click()
    await expect(page.getByText(/produto foi salvo, mas não conseguimos atualizar a foto/i)).toBeVisible()
    expect((await menu(request)).categories.flatMap((item) => item.products).filter((item) => item.id === productId)).toHaveLength(1)
    await page.unroute(`**/admin/api/products/${productId}/image`)
    await page.getByRole('button', { name: 'Tentar enviar foto novamente' }).click()
    await expect(page.getByText('Produto atualizado.')).toBeVisible()
    await expect(page.getByRole('dialog')).toBeHidden()
    expect((await menu(request)).categories.flatMap((item) => item.products).find((item) => item.id === productId)?.imageKey).toBeTruthy()

    await page.locator('article').filter({ hasText: product.name }).getByRole('button', { name: 'Editar' }).click()
    await page.getByRole('button', { name: 'Remover foto' }).click()
    await expect(page.getByText('A foto atual será removida quando você salvar o produto.')).toBeVisible()
    await page.getByRole('button', { name: 'Salvar produto' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.getByText('Produto atualizado.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Editar produto' })).toBeHidden()
    expect((await menu(request)).categories.flatMap((item) => item.products).find((item) => item.id === productId)?.imageKey).toBeNull()
  } finally {
    if (categoryId) {
      const current = await menu(request)
      const temporaryCategory = current.categories.find((category) => category.id === categoryId)
      for (const product of temporaryCategory?.products ?? []) await request.delete(`/admin/api/products/${product.id}`)
      await request.delete(`/admin/api/categories/${categoryId}`)
    } else if (productId) await request.delete(`/admin/api/products/${productId}`)
  }
})

test('configurações são divididas por tarefa e restauração valida antes de substituir', async ({ page, request }) => {
  const current = await menu(request)
  const draftSlogan = `Rascunho não salvo ${Date.now().toString(36)}`
  const paymentName = `Pagamento teste ${Date.now().toString(36)}`
  let paymentId = ''
  await page.setViewportSize({ width: 390, height: 844 })
  try {
    await page.goto('/admin/configuracoes')
    await expect(page.getByLabel('Nome da lanchonete')).toBeVisible()
    const slogan = page.getByLabel(/^Slogan/)
    const originalSlogan = await slogan.inputValue()
    await slogan.fill(draftSlogan)

    await page.getByRole('button', { name: /Atendimento/ }).click()
    await page.getByRole('button', { name: 'Adicionar forma' }).click()
    await page.getByLabel('Nome', { exact: true }).fill(paymentName)
    await page.getByRole('button', { name: 'Salvar forma' }).click()
    await expect(page.getByText('Forma de pagamento salva.')).toBeVisible()
    paymentId = (await menu(request)).paymentMethods.find((method) => method.name === paymentName)?.id ?? ''

    await page.getByRole('button', { name: /Lanchonete/ }).click()
    await expect(slogan).toHaveValue(draftSlogan)
    await slogan.fill(originalSlogan)

    await page.getByRole('button', { name: /Horários/ }).click()
    await expect(page.getByRole('heading', { name: 'Horários de atendimento' })).toBeVisible()
    if (new Set(current.hours.map((hour) => hour.weekday)).size < 7) {
      await page.getByRole('button', { name: 'Adicionar horário' }).first().click()
      const daySelect = page.getByRole('combobox', { name: 'Dia', exact: true })
      const selectedDay = Number(await daySelect.inputValue())
      expect(current.hours.some((hour) => hour.weekday === selectedDay)).toBeFalsy()
      for (const weekday of new Set(current.hours.map((hour) => hour.weekday))) await expect(daySelect.locator(`option[value="${weekday}"]`)).toHaveAttribute('disabled', '')
      await page.getByRole('button', { name: 'Cancelar' }).click()
    }
    await page.getByRole('button', { name: /Avançado/ }).click()
    await expect(page.getByRole('heading', { name: 'Opções avançadas' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()

    const exported = await request.get('/admin/api/export')
    const copy = await exported.body()
    await page.goto('/admin/importar-exportar')
    await page.locator('input[type="file"]').setInputFiles({ name: 'copia.json', mimeType: 'application/json', buffer: copy })
    await expect(page.getByRole('heading', { name: 'Confira antes de substituir' })).toBeVisible()
    const replace = page.getByRole('button', { name: 'Substituir dados atuais' })
    await expect(replace).toBeDisabled()
    await page.getByLabel('Confirmação').fill('SUBSTITUIR')
    await expect(replace).toBeEnabled()
    await page.getByRole('button', { name: 'Cancelar' }).click()
    await expect(page.getByText('Restauração cancelada. Nenhum dado foi alterado.')).toBeVisible()
  } finally {
    if (paymentId) await request.delete(`/admin/api/payment-methods/${paymentId}`)
  }
})
