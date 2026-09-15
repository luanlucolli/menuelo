PRAGMA foreign_keys = ON;

CREATE TABLE product_customization_groups (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE,
  name TEXT NOT NULL,
  min_selections INTEGER NOT NULL DEFAULT 0 CHECK (min_selections BETWEEN 0 AND 99),
  max_selections INTEGER NOT NULL DEFAULT 0 CHECK (max_selections BETWEEN 0 AND 99),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  CHECK (min_selections <= max_selections)
);

CREATE TABLE product_customization_options (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES product_customization_groups(id) ON DELETE CASCADE ON UPDATE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_delta_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_delta_cents BETWEEN 0 AND 10000000),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0)
);

CREATE INDEX idx_customization_groups_product_order
  ON product_customization_groups(product_id, is_active, sort_order, id);
CREATE INDEX idx_customization_options_group_order
  ON product_customization_options(group_id, is_active, sort_order, id);
