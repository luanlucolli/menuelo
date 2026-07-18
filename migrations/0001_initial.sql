PRAGMA foreign_keys = ON;

CREATE TABLE business_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  slogan TEXT,
  description TEXT,
  whatsapp TEXT,
  phone TEXT,
  instagram_url TEXT,
  facebook_url TEXT,
  address TEXT,
  maps_url TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  special_message TEXT,
  cover_image_key TEXT,
  public_site_url TEXT,
  seo_title TEXT,
  seo_description TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE business_hours (
  id TEXT PRIMARY KEY,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  opens_at TEXT CHECK (opens_at IS NULL OR opens_at GLOB '[0-2][0-9]:[0-5][0-9]'),
  closes_at TEXT CHECK (closes_at IS NULL OR closes_at GLOB '[0-2][0-9]:[0-5][0-9]'),
  is_closed INTEGER NOT NULL DEFAULT 0 CHECK (is_closed IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  CHECK ((is_closed = 1 AND opens_at IS NULL AND closes_at IS NULL) OR (is_closed = 0 AND opens_at IS NOT NULL AND closes_at IS NOT NULL))
);

CREATE TABLE payment_methods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE delivery_zones (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  fee_cents INTEGER CHECK (fee_cents IS NULL OR fee_cents >= 0),
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  name TEXT NOT NULL,
  ingredients TEXT,
  image_key TEXT,
  is_available INTEGER NOT NULL DEFAULT 1 CHECK (is_available IN (0, 1)),
  is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE,
  label TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents > 0),
  promotional_price_cents INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  CHECK (promotional_price_cents IS NULL OR (promotional_price_cents > 0 AND promotional_price_cents < price_cents))
);

CREATE INDEX idx_hours_weekday_order ON business_hours(weekday, sort_order);
CREATE INDEX idx_payments_active_order ON payment_methods(is_active, sort_order);
CREATE INDEX idx_zones_active_order ON delivery_zones(is_active, sort_order);
CREATE INDEX idx_categories_active_order ON categories(is_active, sort_order);
CREATE INDEX idx_products_category_order ON products(category_id, sort_order);
CREATE INDEX idx_products_available ON products(is_available);
CREATE INDEX idx_products_featured ON products(is_featured);
CREATE INDEX idx_variants_product_order ON product_variants(product_id, sort_order);
