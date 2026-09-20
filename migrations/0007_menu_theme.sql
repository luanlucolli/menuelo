ALTER TABLE business_settings
  ADD COLUMN theme TEXT NOT NULL DEFAULT 'classic'
  CHECK (theme IN ('classic', 'rustic'));
