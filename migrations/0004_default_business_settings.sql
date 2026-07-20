INSERT INTO business_settings (
  id,
  name,
  slug,
  description,
  timezone,
  primary_color
) VALUES (
  1,
  'Cardápio em preparação',
  'cardapio-em-preparacao',
  NULL,
  'America/Sao_Paulo',
  '#374151'
)
ON CONFLICT(id) DO NOTHING;
