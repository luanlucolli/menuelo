import { expect, test, type APIRequestContext, type Locator } from '@playwright/test'
import { Buffer } from 'node:buffer'
import type { MenuResponse, Product, ProductInput, SettingsInput } from '../../shared/schemas'

async function menu(request: APIRequestContext): Promise<MenuResponse> {
  const response = await request.get('/admin/api/menu')
  expect(response.ok()).toBeTruthy()
  return response.json() as Promise<MenuResponse>
}

async function publicMenu(request: APIRequestContext): Promise<MenuResponse> {
  const response = await request.get('/api/menu')
  expect(response.ok()).toBeTruthy()
  return response.json() as Promise<MenuResponse>
}

function customizationGroupEditor(dialog: Locator, index: number): Locator {
  return dialog.getByLabel('Nome do grupo', { exact: true }).nth(index).locator('xpath=ancestor::section[1]')
}

function settingsInputFromMenu(current: MenuResponse): SettingsInput {
  const { business } = current
  return {
    name: business.name,
    slug: business.slug,
    slogan: business.slogan,
    description: business.description,
    whatsapp: business.whatsapp,
    phone: business.phone,
    instagramUrl: business.instagramUrl,
    facebookUrl: business.facebookUrl,
    address: business.address,
    addressPostalCode: business.addressPostalCode,
    addressStreet: business.addressStreet,
    addressNumber: business.addressNumber,
    addressComplement: business.addressComplement,
    addressNeighborhood: business.addressNeighborhood,
    addressCity: business.addressCity,
    addressState: business.addressState,
    mapsUrl: business.mapsUrl,
    timezone: business.timezone,
    specialMessage: business.specialMessage,
    primaryColor: business.primaryColor,
    publicSiteUrl: business.publicSiteUrl,
    seoTitle: business.seoTitle,
    seoDescription: business.seoDescription,
  }
}

function productInputFromMenu(product: Product): ProductInput {
  return {
    categoryId: product.categoryId,
    name: product.name,
    ingredients: product.ingredients,
    isAvailable: product.isAvailable,
    isFeatured: product.isFeatured,
    sortOrder: product.sortOrder,
    variants: product.variants.map(({ label, priceCents, promotionalPriceCents, isActive, sortOrder }) => ({ label, priceCents, promotionalPriceCents, isActive, sortOrder })),
    customizationGroups: product.customizationGroups.map((group) => ({
      name: group.name,
      minSelections: group.minSelections,
      maxSelections: group.maxSelections,
      isActive: group.isActive,
      sortOrder: group.sortOrder,
      options: group.options.map(({ name, description, priceDeltaCents, isActive, sortOrder }) => ({ name, description, priceDeltaCents, isActive, sortOrder })),
    })),
  }
}

test('HTML público contém conteúdo e SEO antes do JavaScript e hidrata sem refetch', async ({ browser, page, request }) => {
  const current = await publicMenu(request)
  const product = current.categories.flatMap((category) => category.products)[0]
  const response = await request.get('/')
  expect(response.ok()).toBeTruthy()
  const html = await response.text()
  expect(html).toContain(current.business.name)
  if (product) {
    expect(html).toContain(product.name)
    expect(html).toMatch(/R\$[^<]*\d/)
  }
  expect(html).toContain('<link rel="canonical"')
  expect(html).toContain('property="og:url"')
  expect(html).toContain('data-menu-json-ld')
  expect(html).toContain('id="__MENU_DATA__"')

  const noScriptContext = await browser.newContext({ javaScriptEnabled: false })
  const noScriptPage = await noScriptContext.newPage()
  await noScriptPage.goto('/')
  await expect(noScriptPage.getByRole('heading', { level: 1, name: current.business.name })).toBeVisible()
  if (product) await expect(noScriptPage.getByText(product.name, { exact: true }).first()).toBeVisible()
  await noScriptContext.close()

  let menuRequests = 0
  const hydrationErrors: string[] = []
  page.on('request', (browserRequest) => { if (new URL(browserRequest.url()).pathname === '/api/menu') menuRequests += 1 })
  page.on('console', (message) => { if (/hydration|did not match|server rendered/i.test(message.text())) hydrationErrors.push(message.text()) })
  await page.goto('/')
  await expect(page.getByRole('searchbox', { name: 'Pesquisar no cardápio' })).toBeVisible()
  expect(menuRequests).toBe(0)
  expect(hydrationErrors).toEqual([])
})

test('cardápio público é responsivo, pesquisa sem duplicar e devolve o foco', async ({ page, request }) => {
  const current = await menu(request)
  const category = current.categories.find((item) => item.products.length > 0)
  test.skip(!category, 'O cardápio local precisa ter ao menos um produto.')
  const product = category!.products[0]

  for (const width of [359, 390, 430, 639, 650, 700, 719, 720, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 600 ? 800 : 900 })
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()

    const card = page.getByRole('button', { name: `Ver detalhes de ${product.name}` }).first()
    await expect(card).toBeVisible()
    if (width === 700 || width === 720) {
      const layout = await card.evaluate((element) => {
        const media = element.querySelector('img, [aria-hidden="true"]')
        const style = getComputedStyle(element)
        return {
          borderLeft: style.borderLeftWidth,
          radius: style.borderTopLeftRadius,
          grid: style.gridTemplateColumns,
          mediaWidth: media?.getBoundingClientRect().width ?? 0,
        }
      })
      if (width === 700) {
        expect(layout.borderLeft).toBe('0px')
        expect(layout.radius).toBe('0px')
        expect(layout.mediaWidth).toBe(104)
      } else {
        expect(layout.borderLeft).toBe('1px')
        expect(layout.radius).toBe('16px')
        expect(layout.mediaWidth).toBe(108)
      }
      expect(layout.grid).toContain('104px')
    }
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('searchbox', { name: 'Pesquisar no cardápio' }).fill(product.name)
  await expect(page.getByRole('heading', { name: 'Resultados da busca' })).toBeVisible()
  await expect(page.getByText(/item encontrado|itens encontrados/)).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Categorias do cardápio' })).toBeHidden()
  const result = page.getByRole('button', { name: `Ver detalhes de ${product.name}` })
  await expect(result).toHaveCount(1)
  await result.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const dialogBox = await dialog.boundingBox()
  const closeBox = await page.getByRole('button', { name: 'Fechar detalhes' }).boundingBox()
  expect(Math.round(dialogBox?.x ?? -1)).toBe(0)
  expect(Math.round(dialogBox?.width ?? -1)).toBe(390)
  expect(((dialogBox?.y ?? 845) + (dialogBox?.height ?? 0)) <= 844).toBeTruthy()
  expect((closeBox?.width ?? 0) >= 44).toBeTruthy()
  expect((closeBox?.height ?? 0) >= 44).toBeTruthy()
  const dialogMedia = dialog.locator('article > div').first().locator('img, [aria-hidden="true"]').first()
  expect(await dialogMedia.evaluate((element) => getComputedStyle(element).maxHeight)).toBe('300px')
  expect((await dialogMedia.boundingBox())?.height ?? 0).toBeLessThanOrEqual(300)
  await page.getByRole('button', { name: 'Fechar detalhes' }).click()
  await expect(result).toBeFocused()
  await page.getByRole('button', { name: 'Limpar pesquisa' }).click()

  const last = current.categories.filter((item) => item.products.length > 0).at(-1)
  if (last) {
    await page.locator(`#${last.slug}`).evaluate((element) => element.scrollIntoView({ block: 'start' }))
    await expect(page.locator(`button[data-category="${last.slug}"]`)).toHaveAttribute('aria-current', 'true')
  }
})

test('regressões críticas de layout público e admin respeitam breakpoints', async ({ page, request }) => {
  const current = await menu(request)
  const originalSettings = settingsInputFromMenu(current)
  const changedWhatsapp = !current.business.whatsapp
  const cacheBustingProduct = current.categories.flatMap((category) => category.products)[0]
  test.skip(!cacheBustingProduct, 'O cardápio local precisa ter ao menos um produto.')

  if (changedWhatsapp) {
    const response = await request.patch('/admin/api/settings', { data: { ...originalSettings, whatsapp: '5547999999999' } })
    expect(response.ok()).toBeTruthy()
    const cacheInvalidation = await request.patch(`/admin/api/products/${cacheBustingProduct!.id}`, { data: productInputFromMenu(cacheBustingProduct!) })
    expect(cacheInvalidation.ok()).toBeTruthy()
  }

  try {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/index.html')
    const fab = page.getByRole('link', { name: 'Abrir conversa no WhatsApp' })
    await expect(fab).toBeVisible()
    const fabStyle = await fab.locator('img').evaluate((element) => {
      const style = getComputedStyle(element)
      const box = element.getBoundingClientRect()
      return { width: box.width, height: box.height, clipPath: style.clipPath, objectFit: style.objectFit, filter: style.filter }
    })
    expect(fabStyle.width).toBeCloseTo(56, 0)
    expect(fabStyle.height).toBeCloseTo(56, 0)
    expect(fabStyle.clipPath).toBe('circle(42%)')
    expect(fabStyle.objectFit).toBe('contain')
    expect(fabStyle.filter).toContain('drop-shadow')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()

    for (const width of [390, 649, 650, 700, 767, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/admin')
      await expect(page.getByRole('heading', { name: 'O que você quer fazer?' })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
      const mobileMenu = page.getByRole('button', { name: 'Abrir menu' })
      if (width < 1024) await expect(mobileMenu).toBeVisible()
      else await expect(mobileMenu).toBeHidden()
    }

    await page.setViewportSize({ width: 700, height: 900 })
    await page.goto('/admin/produtos')
    await page.getByRole('button', { name: 'Novo produto' }).click()
    const productFormDialog = page.getByRole('dialog')
    const productFormPanel = productFormDialog.locator('section').first()
    await expect(productFormPanel).toBeVisible()
    const adminDialogLayout = await productFormPanel.evaluate((element) => {
      const style = getComputedStyle(element)
      const box = element.getBoundingClientRect()
      return { top: box.top, bottom: box.bottom, width: box.width, height: box.height, topLeftRadius: style.borderTopLeftRadius, bottomRightRadius: style.borderBottomRightRadius }
    })
    expect(adminDialogLayout.top).toBeGreaterThan(0)
    expect(adminDialogLayout.bottom).toBeLessThan(900)
    expect(adminDialogLayout.topLeftRadius).toBe('16px')
    expect(adminDialogLayout.bottomRightRadius).toBe('16px')
    expect(adminDialogLayout.height).toBeLessThanOrEqual(852)

    await page.setViewportSize({ width: 900, height: 900 })
    const wideProductFormPanel = await productFormPanel.boundingBox()
    expect(wideProductFormPanel?.width ?? 0).toBeGreaterThan(672)
    await productFormDialog.getByRole('button', { name: 'Fechar' }).click()
    await expect(productFormDialog).toBeHidden()

    await page.setViewportSize({ width: 1024, height: 600 })
    await page.goto('/admin/configuracoes')
    const settingsNav = page.getByRole('navigation', { name: 'Seções das configurações' })
    await expect(settingsNav).toBeVisible()
    expect(await settingsNav.evaluate((element) => getComputedStyle(element).position)).toBe('sticky')
    expect(await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)).toBeTruthy()
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await expect.poll(async () => Math.round((await settingsNav.boundingBox())?.y ?? -1)).toBe(0)

    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto('/admin/qrcode')
    const qrPreview = page.locator('section').filter({ has: page.getByRole('button', { name: 'Baixar SVG' }) })
    const qrWrapper = qrPreview.locator('div').first()
    const qrSvg = qrWrapper.locator('svg')
    await expect(qrSvg).toBeVisible()
    const qrLayout = await qrSvg.evaluate((element) => {
      const wrapper = element.parentElement
      const svgBox = element.getBoundingClientRect()
      return { svgWidth: svgBox.width, wrapperWidth: wrapper?.getBoundingClientRect().width ?? 0 }
    })
    expect(qrLayout.svgWidth).toBeLessThanOrEqual(qrLayout.wrapperWidth)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  } finally {
    if (changedWhatsapp) {
      const response = await request.patch('/admin/api/settings', { data: originalSettings })
      expect(response.ok()).toBeTruthy()
    }
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
  await expect(page.locator('#admin-sidebar').getByRole('link', { name: 'Cópia de segurança' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(menuButton).toBeFocused()

  await page.goto('/admin/importar-exportar')
  await expect(page).toHaveURL(/\/admin\/configuracoes\?secao=avancado$/)
  await expect(page.getByRole('heading', { name: 'Cópias e restauração' })).toBeVisible()
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
    await expect(page.getByRole('button', { name: /Um preço só/ })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByLabel('Nome do tamanho')).toHaveCount(0)
    await page.getByLabel('Nome do produto').fill(productName)
    await page.getByLabel('Preço normal').fill('2590')
    await page.getByRole('button', { name: 'Salvar produto' }).click()
    await expect(page.getByText('Produto criado.')).toBeVisible()

    const saved = (await menu(request)).categories.flatMap((item) => item.products).find((item) => item.name === productName)
    expect(saved).toBeTruthy()
    productIds.push(saved!.id)

    let row = page.locator('article').filter({ hasText: productName })
    await row.getByRole('button', { name: 'Editar dados' }).click()
    await expect(page.getByRole('heading', { name: 'Editar produto' })).toBeVisible()
    const pricingSection = page.locator('details').filter({ hasText: 'Preços e tamanhos' })
    await expect(pricingSection).not.toHaveAttribute('open', '')
    await pricingSection.locator('summary').click()
    await expect(pricingSection).toHaveAttribute('open', '')
    await page.getByLabel('Este produto está em promoção').check()
    await page.getByLabel('Preço promocional').fill('3000')
    await page.getByRole('button', { name: 'Salvar produto' }).click()
    await expect(page.getByText('O preço promocional deve ser menor que o preço original.')).toBeVisible()
    await page.getByLabel('Preço promocional').fill('1990')
    await page.getByRole('button', { name: /Mais de um tamanho/ }).click()
    const sizeLabels = page.getByLabel('Nome do tamanho')
    await expect(sizeLabels).toHaveCount(2)
    await expect(sizeLabels.first()).toHaveValue('Médio')
    const addedOption = sizeLabels.last().locator('xpath=ancestor::section[1]')
    await expect(addedOption.getByLabel('Nome do tamanho')).toHaveValue('Grande')
    await addedOption.getByLabel('Preço normal').fill('3490')
    await page.getByRole('button', { name: 'Salvar produto' }).click()
    await expect(page.getByText('Produto atualizado.')).toBeVisible()
    await expect.poll(async () => (await menu(request)).categories.flatMap((item) => item.products).find((item) => item.id === saved!.id)?.variants.map((variant) => variant.label)).toContain('Grande')

    row = page.locator('article').filter({ hasText: productName })
    await row.getByRole('button', { name: 'Indisponibilizar' }).click()
    await expect(row.getByText('Indisponível', { exact: true })).toBeVisible()
    await row.getByText('Mais ações', { exact: true }).click()
    await row.getByRole('button', { name: 'Duplicar' }).click()
    await expect(page.getByRole('heading', { name: 'Editar produto' })).toBeVisible()
    await expect(page.getByRole('dialog').getByText('Preços e tamanhos')).toBeVisible()
    await expect(page.locator('details').filter({ hasText: 'Preços e tamanhos' })).not.toHaveAttribute('open', '')
    await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click()

    const copy = (await menu(request)).categories.flatMap((item) => item.products).find((item) => item.name === `Cópia de ${productName}`)
    expect(copy).toBeTruthy()
    productIds.push(copy!.id)

    row = page.locator('article').filter({ hasText: productName }).first()
    await row.getByText('Mais ações', { exact: true }).click()
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

test('administra montagem obrigatória e cliente só adiciona uma configuração válida', async ({ page, request }) => {
  const suffix = Date.now().toString(36)
  const categoryName = `Categoria montagem ${suffix}`
  const productName = `Combo montagem ${suffix}`
  let categoryId = ''
  let productId = ''

  try {
    const categoryResponse = await request.post('/admin/api/categories', { data: { name: categoryName, description: null, isActive: true, sortOrder: 0 } })
    expect(categoryResponse.ok()).toBeTruthy()
    categoryId = (await categoryResponse.json() as { id: string }).id

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/admin/produtos?categoria=${categoryId}&acao=novo`)
    const adminDialog = page.getByRole('dialog')
    await adminDialog.getByLabel('Nome do produto').fill(productName)
    await adminDialog.getByLabel('Preço normal').fill('2590')
    await adminDialog.locator('details').filter({ hasText: 'Montagem e adicionais' }).locator('summary').click()
    await adminDialog.getByRole('button', { name: 'Adicionar grupo' }).click()
    const groupA = customizationGroupEditor(adminDialog, 0)
    await groupA.getByLabel('Nome do grupo').fill('Grupo A')
    await groupA.getByLabel('Mínimo').fill('1')
    await groupA.getByLabel('Máximo').fill('1')
    await groupA.getByRole('button', { name: 'Adicionar opção' }).click()
    await groupA.getByLabel('Nome da opção').fill('A1')
    await groupA.getByRole('button', { name: 'Adicionar opção' }).click()
    await groupA.getByLabel('Nome da opção').nth(1).fill('A2')

    await adminDialog.getByRole('button', { name: 'Adicionar grupo' }).click()
    const groupB = customizationGroupEditor(adminDialog, 1)
    await groupB.getByLabel('Nome do grupo').fill('Grupo B')
    await groupB.getByLabel('Mínimo').fill('1')
    await groupB.getByLabel('Máximo').fill('1')
    await groupB.getByRole('button', { name: 'Adicionar opção' }).click()
    await groupB.getByLabel('Nome da opção').fill('B1')
    await groupB.getByRole('button', { name: 'Adicionar opção' }).click()
    await groupB.getByLabel('Nome da opção').nth(1).fill('B2')

    await groupA.getByLabel('Mínimo').fill('')
    await adminDialog.getByRole('button', { name: 'Salvar produto' }).click()
    await expect(groupA.getByLabel('Mínimo')).toHaveAttribute('aria-invalid', 'true')
    await expect(groupA.getByLabel('Mínimo').locator('xpath=following-sibling::small')).toBeVisible()
    await groupA.getByLabel('Mínimo').fill('1')

    await adminDialog.getByRole('button', { name: 'Mover grupo 2 para cima' }).click()
    const firstGroupAfterMove = customizationGroupEditor(adminDialog, 0)
    const secondGroupAfterMove = customizationGroupEditor(adminDialog, 1)
    await expect(firstGroupAfterMove.getByLabel('Nome do grupo')).toHaveValue('Grupo B')
    await expect(firstGroupAfterMove.getByLabel('Nome da opção').nth(0)).toHaveValue('B1')
    await expect(firstGroupAfterMove.getByLabel('Nome da opção').nth(1)).toHaveValue('B2')
    await expect(secondGroupAfterMove.getByLabel('Nome do grupo')).toHaveValue('Grupo A')
    await expect(secondGroupAfterMove.getByLabel('Nome da opção').nth(0)).toHaveValue('A1')
    await expect(secondGroupAfterMove.getByLabel('Nome da opção').nth(1)).toHaveValue('A2')

    await adminDialog.getByRole('button', { name: 'Salvar produto' }).click()
    await expect(page.getByText('Produto criado.')).toBeVisible()

    const saved = (await menu(request)).categories.flatMap((item) => item.products).find((item) => item.name === productName)
    expect(saved?.customizationGroups.map((group) => group.name)).toEqual(['Grupo B', 'Grupo A'])
    expect(saved?.customizationGroups.map((group) => group.options.map((option) => option.name))).toEqual([['B1', 'B2'], ['A1', 'A2']])
    productId = saved?.id ?? ''

    const row = page.locator('article').filter({ hasText: productName })
    await row.getByRole('button', { name: 'Editar dados' }).click()
    const editDialog = page.getByRole('dialog')
    await editDialog.locator('details').filter({ hasText: 'Montagem e adicionais' }).locator('summary').click()
    await expect(customizationGroupEditor(editDialog, 0).getByLabel('Nome do grupo')).toHaveValue('Grupo B')
    await expect(customizationGroupEditor(editDialog, 0).getByLabel('Nome da opção').nth(0)).toHaveValue('B1')
    await expect(customizationGroupEditor(editDialog, 1).getByLabel('Nome do grupo')).toHaveValue('Grupo A')
    await expect(customizationGroupEditor(editDialog, 1).getByLabel('Nome da opção').nth(1)).toHaveValue('A2')
    await customizationGroupEditor(editDialog, 0).getByRole('button', { name: 'Remover grupo' }).click()
    await expect(editDialog.getByLabel('Nome do grupo', { exact: true })).toHaveCount(1)
    const remainingGroup = customizationGroupEditor(editDialog, 0)
    await expect(remainingGroup.getByLabel('Nome do grupo')).toHaveValue('Grupo A')
    await expect(remainingGroup.getByLabel('Nome da opção').nth(0)).toHaveValue('A1')
    await expect(remainingGroup.getByLabel('Nome da opção').nth(1)).toHaveValue('A2')
    await remainingGroup.getByLabel('Nome da opção').nth(1).fill('A2 editado')
    await editDialog.getByRole('button', { name: 'Salvar produto' }).click()
    await expect(page.getByText('Produto atualizado.')).toBeVisible()

    const edited = (await menu(request)).categories.flatMap((item) => item.products).find((item) => item.id === productId)
    expect(edited?.customizationGroups.map((group) => group.name)).toEqual(['Grupo A'])
    expect(edited?.customizationGroups[0]?.options.map((option) => option.name)).toEqual(['A1', 'A2 editado'])

    // O HTML público é cacheado por 60s; o shell força o bootstrap atual da API neste fluxo administrativo.
    await page.goto('/index.html')
    await page.getByRole('searchbox', { name: 'Pesquisar no cardápio' }).fill(productName)
    await page.getByRole('button', { name: `Ver detalhes de ${productName}` }).click()
    const productDialog = page.getByRole('dialog')
    await expect(productDialog).toContainText('Grupo A')
    await expect(productDialog).not.toContainText('Grupo B')
    await expect(productDialog).toContainText('A1')
    await expect(productDialog).toContainText('A2 editado')
    const addButton = productDialog.getByRole('button', { name: /Adicionar ao pedido/ })
    await expect(addButton).toBeDisabled()
    await productDialog.getByRole('checkbox', { name: 'A2 editado' }).check()
    await expect(addButton).toBeEnabled()
    await expect(addButton).toContainText('R$')
    await addButton.click()
    await page.getByRole('button', { name: 'Ver pedido' }).click()
    const cartDialog = page.getByRole('dialog')
    await expect(cartDialog).toContainText('Grupo A')
    await expect(cartDialog).toContainText('1x A2 editado')
    await expect(cartDialog).not.toContainText('Grupo B')
    await expect(cartDialog).not.toContainText('B1')
  } finally {
    if (categoryId) {
      const current = await menu(request)
      const temporaryCategory = current.categories.find((category) => category.id === categoryId)
      for (const product of temporaryCategory?.products ?? []) await request.delete(`/admin/api/products/${product.id}`)
      await request.delete(`/admin/api/categories/${categoryId}`)
    } else if (productId) {
      await request.delete(`/admin/api/products/${productId}`)
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

test('cria categoria dentro do produto e bloqueia exclusão de categoria ocupada', async ({ page, request }) => {
  const current = await menu(request)
  const occupied = current.categories.find((category) => category.products.length > 0)
  const categoryName = `Categoria rápida ${Date.now().toString(36)}`
  let categoryId = ''
  try {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/admin/produtos?acao=novo')
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Nova categoria' }).click()
    await dialog.getByLabel('Nome da nova categoria').fill(categoryName)
    await dialog.getByRole('button', { name: 'Criar e selecionar' }).click()
    await expect(dialog.getByLabel('Categoria').locator('option:checked')).toHaveText(categoryName)
    categoryId = (await menu(request)).categories.find((category) => category.name === categoryName)?.id ?? ''

    page.once('dialog', (confirmation) => confirmation.accept())
    await dialog.getByRole('button', { name: 'Cancelar' }).click()
    await page.goto('/admin/categorias')
    const createdRow = page.locator('article').filter({ hasText: categoryName })
    await createdRow.getByRole('button', { name: 'Excluir' }).click()
    await page.getByRole('button', { name: 'Excluir categoria' }).click()
    await expect(page.getByText('Categoria excluída.')).toBeVisible()
    categoryId = ''

    if (occupied) {
      const occupiedRow = page.locator('article').filter({ hasText: occupied.name })
      await occupiedRow.getByRole('button', { name: 'Excluir' }).click()
      await expect(page.getByText(new RegExp(`“${occupied.name}” contém`))).toBeVisible()
      await expect(page.getByRole('link', { name: 'Ver produtos' })).toHaveAttribute('href', `/admin/produtos?categoria=${occupied.id}`)
    }
  } finally {
    if (categoryId) await request.delete(`/admin/api/categories/${categoryId}`)
  }
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
    await row.getByRole('button', { name: 'Editar dados' }).click()
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

    await page.locator('article').filter({ hasText: product.name }).getByRole('button', { name: 'Editar dados' }).click()
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
    await expect(page.getByRole('heading', { name: 'Cópias e restauração' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()

    const exported = await request.get('/admin/api/export')
    const copy = await exported.body()
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
