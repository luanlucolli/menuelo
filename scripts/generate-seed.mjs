import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const sourcePath = resolve(root, 'seeds/demo-menu.json')
const outputPath = resolve(root, 'seeds/demo.sql')
const menu = JSON.parse(await readFile(sourcePath, 'utf8'))
const sqlString = (value) => value === null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`
const statements = [
  'PRAGMA foreign_keys = ON;',
  "INSERT INTO business_settings (id, name, slug, description, timezone, primary_color) VALUES (1, 'Lanchonete de demonstração', 'lanchonete-de-demonstracao', 'Este conteúdo existe apenas para facilitar os testes locais.', 'America/Sao_Paulo', '#374151') ON CONFLICT(id) DO UPDATE SET name=excluded.name, slug=excluded.slug, slogan=NULL, description=excluded.description, whatsapp=NULL, phone=NULL, instagram_url=NULL, facebook_url=NULL, address=NULL, maps_url=NULL, timezone=excluded.timezone, special_message=NULL, cover_image_key=NULL, public_site_url=NULL, seo_title=NULL, seo_description=NULL, address_postal_code=NULL, address_street=NULL, address_number=NULL, address_complement=NULL, address_neighborhood=NULL, address_city=NULL, address_state=NULL, primary_color=excluded.primary_color, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now');",
  'DELETE FROM business_hours;',
  'DELETE FROM payment_methods;',
  'DELETE FROM delivery_zones;',
  'DELETE FROM products;',
  'DELETE FROM categories;',
]

let productCount = 0
let variantCount = 0

for (const [categoryIndex, category] of menu.categories.entries()) {
  const categoryId = `demo-category-${String(categoryIndex + 1).padStart(2, '0')}`
  const slug = category.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  statements.push(`INSERT INTO categories (id, name, slug, description, is_active, sort_order) VALUES (${sqlString(categoryId)}, ${sqlString(category.name)}, ${sqlString(slug)}, ${sqlString(category.description ?? null)}, 1, ${categoryIndex});`)

  for (const [productIndex, product] of category.products.entries()) {
    productCount += 1
    const productId = `demo-product-${String(productCount).padStart(3, '0')}`
    statements.push(`INSERT INTO products (id, category_id, name, ingredients, image_key, is_available, is_featured, sort_order) VALUES (${sqlString(productId)}, ${sqlString(categoryId)}, ${sqlString(product.name)}, ${sqlString(product.ingredients ?? null)}, NULL, ${product.is_available ? 1 : 0}, ${product.is_featured ? 1 : 0}, ${productIndex});`)

    for (const [variantIndex, variant] of product.variants.entries()) {
      variantCount += 1
      const variantId = `demo-variant-${String(variantCount).padStart(3, '0')}`
      statements.push(`INSERT INTO product_variants (id, product_id, label, price_cents, promotional_price_cents, is_active, sort_order) VALUES (${sqlString(variantId)}, ${sqlString(productId)}, ${sqlString(variant.label)}, ${variant.price_cents}, ${sqlString(variant.promotional_price_cents)}, 1, ${variantIndex});`)
    }
  }
}

if (menu.categories.length === 0 || productCount === 0) {
  throw new Error('O cardápio de demonstração precisa ter ao menos uma categoria e um produto.')
}

await mkdir(resolve(root, 'seeds'), { recursive: true })
await writeFile(sourcePath, `${JSON.stringify(menu, null, 2)}\n`)
await writeFile(outputPath, `${statements.join('\n')}\n`)
console.log(`Demonstração gerada: ${menu.categories.length} categorias, ${productCount} produtos e ${variantCount} preços.`)
