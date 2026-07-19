import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const menu = JSON.parse(await readFile(resolve(root, 'seeds/menu.json'), 'utf8'))
const sqlString = (value) => value === null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`
const statements = [
  'PRAGMA foreign_keys = ON;',
  "INSERT INTO business_settings (id, name, slug, description, timezone, special_message, seo_title, seo_description) VALUES (1, 'Pipo Lanches & Porções', 'pipo-lanches-e-porcoes', 'Consulte nosso cardápio digital.', 'America/Sao_Paulo', 'Fechado às segundas-feiras.', 'Pipo Lanches & Porções | Cardápio digital', 'Consulte o cardápio digital da Pipo Lanches & Porções.') ON CONFLICT(id) DO NOTHING;",
  'UPDATE business_settings SET cover_image_key=NULL WHERE id=1;',
  "INSERT INTO business_hours (id, weekday, opens_at, closes_at, is_closed, sort_order) VALUES ('seed-monday-closed', 1, NULL, NULL, 1, 0) ON CONFLICT(id) DO UPDATE SET weekday=excluded.weekday, opens_at=NULL, closes_at=NULL, is_closed=1, sort_order=0;",
  'DELETE FROM products;',
  'DELETE FROM categories;',
]

let productCount = 0
let variantCount = 0

for (const [categoryIndex, category] of menu.categories.entries()) {
  const categoryId = `seed-category-${String(categoryIndex + 1).padStart(2, '0')}`
  const slug = category.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  statements.push(`INSERT INTO categories (id, name, slug, description, is_active, sort_order) VALUES (${sqlString(categoryId)}, ${sqlString(category.name)}, ${sqlString(slug)}, ${sqlString(category.description ?? null)}, 1, ${categoryIndex}) ON CONFLICT(id) DO UPDATE SET name=excluded.name, slug=excluded.slug, description=excluded.description, is_active=1, sort_order=excluded.sort_order, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now');`)

  for (const [productIndex, product] of category.products.entries()) {
    productCount += 1
    const productId = `seed-product-${String(productCount).padStart(3, '0')}`
    statements.push(`INSERT INTO products (id, category_id, name, ingredients, image_key, is_available, is_featured, sort_order) VALUES (${sqlString(productId)}, ${sqlString(categoryId)}, ${sqlString(product.name)}, ${sqlString(product.ingredients)}, NULL, ${product.is_available ? 1 : 0}, ${product.is_featured ? 1 : 0}, ${productIndex}) ON CONFLICT(id) DO UPDATE SET category_id=excluded.category_id, name=excluded.name, ingredients=excluded.ingredients, image_key=NULL, is_available=excluded.is_available, is_featured=excluded.is_featured, sort_order=excluded.sort_order, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now');`)

    for (const [variantIndex, variant] of product.variants.entries()) {
      variantCount += 1
      const variantId = `seed-variant-${String(variantCount).padStart(3, '0')}`
      statements.push(`INSERT INTO product_variants (id, product_id, label, price_cents, promotional_price_cents, is_active, sort_order) VALUES (${sqlString(variantId)}, ${sqlString(productId)}, ${sqlString(variant.label)}, ${variant.price_cents}, ${sqlString(variant.promotional_price_cents)}, 1, ${variantIndex}) ON CONFLICT(id) DO UPDATE SET product_id=excluded.product_id, label=excluded.label, price_cents=excluded.price_cents, promotional_price_cents=excluded.promotional_price_cents, is_active=1, sort_order=excluded.sort_order;`)
    }
  }
}

if (menu.categories.length !== 4 || productCount !== 23) {
  throw new Error(`Contagem canônica inesperada: ${menu.categories.length} categorias e ${productCount} produtos`)
}

await mkdir(resolve(root, 'seeds'), { recursive: true })
await writeFile(resolve(root, 'seeds/menu.json'), `${JSON.stringify(menu, null, 2)}\n`)
await writeFile(resolve(root, 'seeds/seed.sql'), `${statements.join('\n')}\n`)
console.log(`Seed gerado: ${menu.categories.length} categorias, ${productCount} produtos e ${variantCount} variações.`)
