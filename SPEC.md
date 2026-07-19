# Objetivo

Implemente integralmente, no diretório atual e vazio, a fundação do projeto **pipo-cardapio-digital**. Este é um cardápio digital público com painel administrativo, sem pedidos online. Trabalhe autonomamente em fases dentro da mesma execução. Faça um plano técnico curto no início apenas para orientar a execução, mas **não pare para pedir aprovação**. Pare somente diante de um bloqueio real que não possa ser resolvido localmente sem criar ou alterar recursos remotos.

O projeto deve ser entregável, executável localmente, testado e preparado para implantação manual na Cloudflare. Não crie recursos na conta Cloudflare, não faça deploy e não registre domínio.

## Contexto do negócio

- Estabelecimento: **Pipo Lanches & Porções**, Joinville/SC.
- O cardápio e os preços iniciais são herdados do antigo Rafa's Dog, mas a marca mudou.
- **Não deixe “Rafa's”, “Rafa’s” ou “Rafas” em nenhuma interface, dado inicial, metadado, documentação pública ou texto final.**
- Renomeie os itens de marca:
  - `DOG RAFA'S` -> `DOG PIPO`
  - `X-TUDO RAFA'S` -> `X-TUDO PIPO`
- A identidade visual ainda está em desenvolvimento. Implemente uma interface neutra, profissional e mobile-first, com tokens CSS fáceis de substituir posteriormente.
- Não invente logo, slogan, endereço, telefone, WhatsApp, Instagram, Facebook ou zonas de entrega. Campos ainda desconhecidos devem permanecer vazios no banco e ser ocultados no site público até serem configurados.
- Fuso padrão: `America/Sao_Paulo`.
- Segunda-feira é fechada. Os demais horários ainda não foram informados.
- Domínio ainda não registrado. Possibilidades futuras:
  - `pipolancheseporcoesjoinville.com.br`
  - `pipolancheseporcoes.com.br`
- Use `PUBLIC_SITE_URL` configurável. Em desenvolvimento, faça fallback seguro para a origem da requisição.

## Escopo obrigatório

### Incluído

- Cardápio público responsivo e mobile-first.
- Pesquisa por nome e ingredientes, sem diferenciar maiúsculas, minúsculas ou acentos.
- Navegação sticky por categorias.
- Seção de destaques.
- Seção de promoções, exibida somente quando houver promoção ativa.
- Cards de produtos com imagem ou placeholder por ícone.
- Detalhes do produto em modal/bottom sheet acessível.
- Produtos indisponíveis continuam visíveis com marcação clara de “Indisponível”.
- Preço antigo riscado e preço promocional em destaque.
- Suporte a produtos com um preço e produtos com variações, como `Média` e `Grande`.
- Botão flutuante de WhatsApp apenas quando o número estiver configurado.
- Rodapé com endereço, horários e botão do Google Maps apenas quando configurados.
- Banner/capa configurável.
- Formas de pagamento configuráveis.
- Regiões e taxas de entrega configuráveis, apenas informativas.
- QR Code do cardápio no painel, com visualização e download em SVG.
- SEO básico preparado: title, description, Open Graph, canonical e JSON-LD `Restaurant`/`LocalBusiness`, usando somente dados configurados.
- Painel administrativo mobile-first.
- CRUD de categorias, produtos, variações e configurações.
- Ordenação de categorias e produtos.
- Upload, substituição e remoção de imagem por produto.
- Duplicação de produto.
- Exportação e importação versionada em JSON.
- Confirmação antes de exclusões destrutivas.
- Migrações D1 e seed inicial completo.
- Documentação local e de implantação manual.
- Testes unitários e de integração leves, sem Playwright.

### Excluído

Não implemente:

- pedidos;
- carrinho;
- checkout;
- pagamentos;
- cadastro de consumidores;
- sistema de delivery;
- cálculo de frete;
- PWA;
- impressão;
- histórico de alterações;
- multi-tenancy;
- SaaS;
- autenticação própria;
- recuperação de senha;
- CSV;
- SSR;
- filas;
- cron jobs;
- CI/CD;
- deploy automático;
- criação de recursos remotos;
- Cloudflare Web Analytics via código. Apenas documente como habilitar pelo dashboard.

## Arquitetura obrigatória

Use um único repositório e um único projeto full-stack:

- React + Vite + TypeScript estrito.
- Cloudflare Workers com Static Assets.
- Plugin oficial da Cloudflare para Vite.
- Hono no Worker.
- Cloudflare D1 para dados.
- Cloudflare R2 para imagens.
- Cloudflare Access para proteção do painel.
- React Router.
- TanStack Query.
- React Hook Form.
- Zod compartilhado entre frontend e backend.
- Tailwind CSS com tokens/variáveis CSS neutras para futura identidade.
- `@dnd-kit/core` e `@dnd-kit/sortable` para ordenação.
- `qrcode` ou biblioteca equivalente pequena para QR Code.
- `jose` para validação do JWT do Cloudflare Access, salvo se a versão atual do template oficial oferecer solução oficial melhor.
- Vitest. Não instale Playwright.

Comece a partir do template oficial atual de React + Hono + Vite para Cloudflare Workers. Consulte apenas documentação oficial atual da Cloudflare quando necessário. Não crie um diretório filho; o projeto deve ocupar o diretório atual. Se o scaffolder não aceitar `.` diretamente, use um diretório temporário e mova os arquivos com segurança.

Estrutura esperada aproximada:

```text
src/
  react-app/
    app/
    components/
    modules/
      public-menu/
      admin/
    lib/
    styles/
  worker/
    index.ts
    routes/
      public/
      admin/
    middleware/
    services/
    repositories/
  shared/
    schemas/
    types/
    utils/
migrations/
seeds/
docs/
public/
AGENTS.md
README.md
wrangler.jsonc
```

Adapte à estrutura gerada pelo template, mas preserve separação clara entre interface pública, painel, Worker, regras compartilhadas e persistência.

## Rotas

### Frontend

- `/` — cardápio público.
- `/admin` — painel.
- `/admin/produtos`
- `/admin/categorias`
- `/admin/configuracoes`
- `/admin/importar-exportar`
- `/admin/qrcode`

### API pública

- `GET /api/menu`
- `GET /media/:key`

### API administrativa

Coloque a API administrativa sob `/admin/api/*`, para que uma única aplicação do Cloudflare Access em `/admin/*` proteja tanto a SPA quanto a API.

Inclua, no mínimo:

- `GET/POST /admin/api/categories`
- `PATCH/DELETE /admin/api/categories/:id`
- `POST /admin/api/categories/reorder`
- `GET/POST /admin/api/products`
- `GET/PATCH/DELETE /admin/api/products/:id`
- `POST /admin/api/products/:id/duplicate`
- `POST /admin/api/products/reorder`
- `POST /admin/api/products/:id/image`
- `DELETE /admin/api/products/:id/image`
- `GET/PATCH /admin/api/settings`
- CRUD de horários, formas de pagamento e zonas de entrega.
- `GET /admin/api/export`
- `POST /admin/api/import/validate`
- `POST /admin/api/import/apply`

Configure o roteamento de assets para executar o Worker primeiro em:

- `/api/*`
- `/admin/api/*`
- `/media/*`

E use fallback de SPA para as demais rotas.

## Autenticação e autorização

Não implemente login próprio.

Produção:

- O Cloudflare Access protegerá `/admin/*`.
- Use o **Cloudflare como Identity Provider**, sem código OTP.
- Restrinja a política ao membro/e-mail autorizado `luangstl@gmail.com`.
- O Worker deve validar de verdade `Cf-Access-Jwt-Assertion`.
- Valide assinatura, issuer, audience, expiração e e-mail.
- Faça dupla proteção:
  1. política do Cloudflare Access;
  2. allowlist `ADMIN_EMAILS` no Worker.
- Variáveis esperadas:
  - `CF_ACCESS_TEAM_DOMAIN`
  - `CF_ACCESS_AUD`
  - `ADMIN_EMAILS=luangstl@gmail.com`

Desenvolvimento local:

- Permita bypass somente quando:
  - `DEV_ADMIN_BYPASS=true`; e
  - hostname for `localhost`, `127.0.0.1` ou equivalente local.
- Mesmo que a variável seja configurada por engano em produção, o bypass deve falhar fechado.
- Crie `.dev.vars.example`, mas nunca versione `.dev.vars`.
- Nunca coloque segredo no frontend.

Não configure o Cloudflare Access remotamente. Crie documentação detalhada em `docs/cloudflare-setup.md`.

## Banco de dados

Use D1 com migrations versionadas.

### Modelo

#### `business_settings`

Tabela singleton, com pelo menos:

- `id`
- `name`
- `slug`
- `slogan` nullable
- `description` nullable
- `whatsapp` nullable
- `phone` nullable
- `instagram_url` nullable
- `facebook_url` nullable
- `address` nullable
- `maps_url` nullable
- `timezone`
- `special_message` nullable
- `cover_image_key` nullable
- `public_site_url` nullable
- `seo_title` nullable
- `seo_description` nullable
- `created_at`
- `updated_at`

#### `business_hours`

Permita múltiplos intervalos por dia e horários que atravessem a meia-noite:

- `id`
- `weekday` de 0 a 6
- `opens_at`
- `closes_at`
- `is_closed`
- `sort_order`

Seed: segunda-feira fechada. Não invente horários para os outros dias. Se a grade estiver incompleta, não exiba automaticamente “Aberto/Fechado”; exiba apenas a mensagem configurada.

#### `payment_methods`

- `id`
- `name`
- `is_active`
- `sort_order`

Não invente formas de pagamento no seed.

#### `delivery_zones`

- `id`
- `name`
- `fee_cents` nullable
- `notes` nullable
- `is_active`
- `sort_order`

Não invente zonas no seed.

#### `categories`

- `id`
- `name`
- `slug` único
- `description` nullable
- `is_active`
- `sort_order`
- timestamps

#### `products`

- `id`
- `category_id`
- `name`
- `ingredients` nullable
- `image_key` nullable
- `is_available`
- `is_featured`
- `sort_order`
- timestamps

#### `product_variants`

Use variações de forma uniforme, inclusive para produtos de preço único:

- `id`
- `product_id`
- `label` nullable para preço único
- `price_cents`
- `promotional_price_cents` nullable
- `is_active`
- `sort_order`

Regras:

- Dinheiro sempre em centavos inteiros.
- `promotional_price_cents`, quando preenchido, deve ser maior que zero e menor que `price_cents`.
- Foreign keys e `ON DELETE CASCADE` onde fizer sentido.
- Impedir exclusão de categoria que ainda possua produtos e retornar erro de domínio claro.
- Criar índices para ordenação, categoria, disponibilidade e destaques.
- Prepared statements em todas as entradas de usuário.
- Timestamps em UTC.
- Slugs determinísticos e collision-safe.
- Não criar coluna `business_id`; esta implantação é single-tenant por design.

## API e contratos

- Use Zod no backend para todos os payloads, parâmetros e importações.
- Reutilize schemas e tipos no frontend.
- Respostas JSON consistentes.
- Erros com status HTTP correto e corpo estruturado:
  - `code`
  - `message`
  - `fieldErrors` quando aplicável
- Não exponha stack trace.
- Defina limite razoável para JSON e uploads.
- Use consultas eficientes e evite N+1.
- `GET /api/menu` deve retornar tudo necessário em uma chamada:
  - empresa;
  - horários;
  - pagamentos;
  - zonas;
  - categorias;
  - produtos;
  - variações.
- Aplique `Cache-Control` com cache curto no cardápio público e `no-store` no admin.
- O frontend público deve usar TanStack Query com stale time coerente.
- Não implemente infraestrutura complexa de invalidação global. Após mutações, invalide queries no cliente.

## Imagens

- Armazene imagens no R2.
- Sirva publicamente por `/media/:key`.
- Use chaves UUID e prefixos seguros.
- Nunca aceite caminho arbitrário do cliente.
- Não use base64 no banco.
- No navegador:
  - aceitar JPEG, PNG e WebP;
  - preservar proporção;
  - redimensionar para no máximo 1600 px no maior lado;
  - converter para WebP;
  - qualidade inicial próxima de `0.82`;
  - reduzir qualidade iterativamente se necessário;
  - alvo de até 600 KB.
- No Worker:
  - aceitar somente WebP final;
  - validar magic bytes e MIME;
  - limite rígido de 800 KB;
  - retornar erro amigável.
- Cards usam `object-cover`; modal usa visualização sem corte indevido.
- Ao substituir:
  1. enviar nova imagem;
  2. atualizar banco;
  3. remover antiga;
  4. se o banco falhar, remover a nova.
- Ao excluir produto, remover a imagem antiga em best effort e não falhar a exclusão do banco por causa de um objeto órfão.
- Ao duplicar produto com imagem, copie o objeto para uma nova chave. Nunca compartilhe a mesma chave entre dois produtos.
- Placeholder: ícone neutro, sem fotografia falsa e sem logo inventada.
- Não implemente recorte manual.
- Documente que HEIC não é suportado nesta primeira versão.

## Interface pública

Mobile-first para larguras a partir de 320 px, sem rolagem horizontal.

### Cabeçalho e capa

- Nome textual `Pipo Lanches & Porções`.
- Banner neutro quando não houver capa.
- Não inventar logo.
- Mensagem especial configurável.
- Status aberto/fechado somente quando os horários necessários estiverem completos.

### Pesquisa e categorias

- Campo de pesquisa visível.
- Filtro client-side, pois o volume é pequeno.
- Normalização de acentos.
- Navegação sticky horizontal por categorias.
- Ao tocar em categoria, fazer scroll suave.
- Indicar categoria ativa com `IntersectionObserver`, sem dependência pesada.

### Produtos

- Cards compactos e legíveis no celular.
- Imagem, nome, ingredientes, preço/variações e disponibilidade.
- Se houver uma única variação, não mostrar label “Único”.
- Se houver promoção, exibir preço original riscado e novo preço.
- Modal/bottom sheet com foco, fechamento por Escape, botão e backdrop.
- Destaques e promoções devem desaparecer se vazios.
- Produtos indisponíveis permanecem visíveis, mas visualmente atenuados.

### Contato e rodapé

- Botão de WhatsApp só existe quando houver número válido.
- Não montar pedido nem mensagem com carrinho.
- Mapas, endereço, redes e telefone só aparecem quando configurados.
- Horários devem lidar corretamente com fechamento após meia-noite.
- Exibir formas de pagamento e zonas somente quando existirem.

### SEO

Mesmo sem identidade final:

- `title`: `Pipo Lanches & Porções | Cardápio digital`.
- Descrição inicial neutra, editável.
- canonical baseado em `PUBLIC_SITE_URL`.
- Open Graph com fallback neutro.
- JSON-LD somente com campos existentes.
- Nunca inserir endereço, telefone ou horários fictícios.

## Painel administrativo

Sem fluxo de rascunho/publicação. Decisão deliberada:

- Alterações entram no cardápio após salvar.
- Forneça preview do card do produto dentro do formulário.
- Forneça botão “Visualizar cardápio” em nova aba.
- Não implemente versionamento de publicação.

### Dashboard

- Resumo de categorias, produtos, indisponíveis, destaques e promoções.
- Atalhos para ações principais.
- Avisos de configuração pendente, sem bloquear uso.

### Categorias

- CRUD.
- Ativar/desativar.
- Ordenar via drag and drop.
- Em celular, drag handle explícito.
- Também oferecer botões mover para cima/baixo como fallback.
- Confirmar exclusão.
- Bloquear exclusão com produtos associados.

### Produtos

- Listar por categoria, com pesquisa administrativa.
- CRUD completo.
- Campos:
  - nome;
  - ingredientes;
  - categoria;
  - imagem;
  - disponibilidade;
  - destaque;
  - variações;
  - preço;
  - preço promocional;
  - ordem.
- Duplicar produto.
- Ordenar somente dentro da categoria.
- Alterar categoria no formulário.
- Confirmação antes de excluir.
- Formulário otimizado para toque e teclado móvel.

### Configurações

Permitir editar:

- nome;
- slogan;
- descrição;
- contatos;
- endereço;
- Maps;
- horários;
- mensagem especial;
- banner/capa;
- formas de pagamento;
- zonas e taxas de entrega;
- SEO;
- URL pública.

Não permitir editar pelo painel nesta versão:

- logo;
- cores;
- fontes.

Esses itens devem ficar centralizados em tokens de código para futura identidade.

### JSON

Formato versionado:

```json
{
  "schemaVersion": 1,
  "exportedAt": "ISO-8601",
  "business": {},
  "hours": [],
  "paymentMethods": [],
  "deliveryZones": [],
  "categories": []
}
```

- Exportar dados do cardápio e referências `imageKey`, sem binários.
- Importação em duas etapas:
  1. validar e mostrar resumo/diferenças;
  2. aplicar após confirmação explícita.
- Implementar modo `replace` para o menu, preservando a configuração de acesso.
- Usar `D1Database.batch()` para aplicar de forma transacional e fazer rollback em falha.
- Não excluir objetos R2 automaticamente durante importação.
- Se uma `imageKey` importada não existir, usar placeholder e informar no resumo.
- Limitar tamanho e quantidade de registros.
- Proteger contra IDs fornecidos pelo arquivo; gere IDs locais.
- Validar `schemaVersion`.

## QR Code

- Gerar a partir da URL pública configurada.
- Em desenvolvimento, usar a origem atual.
- Mostrar aviso quando a URL ainda for local ou não estiver configurada.
- Permitir download SVG.
- Não usar serviço externo de QR Code.

## Seed inicial

Crie um seed idempotente e um comando npm para aplicá-lo no D1 local.

Regras do seed:

- Nome do negócio: `Pipo Lanches & Porções`.
- Slug: `pipo-lanches-e-porcoes`.
- Timezone: `America/Sao_Paulo`.
- Mensagem inicial: `Fechado às segundas-feiras.`
- Segunda-feira fechada.
- Contatos, endereço, redes, URL do Maps, capa, pagamentos e zonas vazios.
- Nenhuma promoção inicial.
- Sem imagens iniciais.
- Os produtos marcados como `is_featured: true` abaixo são apenas a seleção demonstrativa inicial e devem ser editáveis.
- Ingredientes nulos significam “não informados na fonte”; não invente.
- Preserve preços em centavos.
- Use a ordem do JSON.
- O JSON abaixo é a fonte canônica do seed.

```json
{
  "schemaVersion": 1,
  "categories": [
    {
      "name": "Dogs Prensados",
      "products": [
        {
          "name": "DOG PRENSADO DUPLO",
          "ingredients": "Pão, 2 salsichas, milho, ervilha e batata palha.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 1800,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG ALCATRA",
          "ingredients": "Pão, salsicha, alcatra, milho, ervilha e batata palha.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3800,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG PIZZA",
          "ingredients": "Pão, salsicha, queijo mussarela, tomate, orégano e batata palha.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 2700,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG CATUPIRY",
          "ingredients": "Pão, salsicha, catupiry, milho, ervilha e batata palha.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 2700,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG CHEDDAR",
          "ingredients": "Pão, salsicha, cheddar, milho, ervilha e batata palha.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 2700,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG CALABRESA",
          "ingredients": "Pão, salsicha, calabresa, milho, ervilha e batata palha.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 2700,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG BACON",
          "ingredients": "Pão, salsicha, bacon, milho, ervilha e batata palha.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 2700,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG FRANGO",
          "ingredients": "Pão, salsicha, frango, milho, ervilha e batata palha.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 2700,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG CORAÇÃO",
          "ingredients": "Pão, salsicha, coração, milho, ervilha e batata palha.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3000,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG EGG",
          "ingredients": "Pão, salsicha, ovo, milho, ervilha e batata palha.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3000,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG BACON EGG",
          "ingredients": "Pão, salsicha, maionese e batata palha.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3000,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG FRANGO EGG",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3000,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG FRANGO BACON",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3000,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG FRANGO CATUPIRY",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3000,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG FRANGO CHEDDAR",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3000,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG FRANGO CALABRESA",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3000,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG FRANGO CORAÇÃO",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3200,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG PIZZA BACON",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3000,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG PIZZA FRANGO",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3000,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG PIZZA CATUPIRY",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3000,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG PIZZA CORAÇÃO",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3000,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG PIZZA CALABRESA EGG",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3300,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG PIZZA CALABRESA CATUPIRY",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3300,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG PIZZA FRANGO BACON",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3300,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG PIZZA FRANGO CALABRESA",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3300,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG CORAÇÃO FRANGO BACON EGG",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3300,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG EGG FRANGO CATUPIRY",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3300,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG FRANGO CORAÇÃO BACON",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3500,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG BACON EGG CORAÇÃO",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3500,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG FRANGO CORAÇÃO CATUPIRY",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3500,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG FRANGO CORAÇÃO CALABRESA",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3500,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG PIZZA CORAÇÃO BACON EGG",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3800,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG PIZZA CALABRESA EGG CORAÇÃO",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3800,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG PIZZA CALABRESA CATUPIRY CORAÇÃO",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3800,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG PIPO",
          "ingredients": "Pão, salsicha, frango, calabresa, coração, bacon, ovo, catupiry, cheddar, queijo mussarela, tomate, milho, ervilha e batata palha. Servido no prato.",
          "is_available": true,
          "is_featured": true,
          "variants": [
            {
              "label": null,
              "price_cents": 4700,
              "promotional_price_cents": null
            }
          ]
        }
      ]
    },
    {
      "name": "Hot Dogs Tradicionais",
      "products": [
        {
          "name": "HOT DOG TRADICIONAL",
          "ingredients": "Salsicha, molho de tomate, milho, ervilha, vinagrete, farofa, batata palha, maionese e catchup.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 2000,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "HOT DOG TRADICIONAL DUPLO",
          "ingredients": "2 salsichas, molho de tomate, mussarela, milho, ervilha, vinagrete, farofa, batata palha, maionese e catchup.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 2200,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "HOT DOG TRADICIONAL BACON",
          "ingredients": "Salsicha, bacon, molho de tomate, mussarela, milho, ervilha, vinagrete, farofa, batata palha, maionese e catchup.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 2700,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "HOT DOG TRADICIONAL CATUPIRY",
          "ingredients": "Salsicha, molho de tomate, catupiry, milho, ervilha, vinagrete, farofa, batata palha, maionese e catchup.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 2700,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "HOT DOG TRADICIONAL CHEDDAR",
          "ingredients": "Salsicha, molho de tomate, cheddar, milho, ervilha, vinagrete, farofa, batata palha, maionese e catchup.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 2700,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "HOT DOG TRADICIONAL BACON CHEDDAR",
          "ingredients": "Salsicha, bacon, molho de tomate, cheddar, milho, ervilha, vinagrete, farofa, batata palha, maionese e catchup.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3000,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "HOT DOG TRADICIONAL BACON CATUPIRY",
          "ingredients": "Salsicha, bacon, molho de tomate, catupiry, milho, ervilha, vinagrete, farofa, batata palha, maionese e catchup.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3000,
              "promotional_price_cents": null
            }
          ]
        }
      ]
    },
    {
      "name": "Lanches Especiais",
      "products": [
        {
          "name": "X GOURMET NO PRATO",
          "ingredients": "Hambúrguer gourmet de 150 g, alface, tomate, cebola roxa, pepino, queijo cheddar e 3 opções de acompanhamentos: bacon, calabresa ou ovo.",
          "is_available": true,
          "is_featured": true,
          "variants": [
            {
              "label": null,
              "price_cents": 3300,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "X COSTELA NO PACOTE",
          "ingredients": "Carne de costela 150 g, cebola roxa, alface, tomate, pepino e queijo mussarela.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3500,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "X GOURMET DUPLO NO PRATO",
          "ingredients": "2 hambúrgueres gourmet de 150 g, alface, tomate, cebola roxa, pepino, queijo cheddar e 3 opções de acompanhamentos: bacon, calabresa ou ovo.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3900,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "X ALCATRA NO PACOTE",
          "ingredients": "Alcatra, cebola chapeada, queijo mussarela derretido, alface e tomate.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3900,
              "promotional_price_cents": null
            }
          ]
        }
      ]
    },
    {
      "name": "Lanches",
      "products": [
        {
          "name": "X-BURGUER",
          "ingredients": "Pão, hambúrguer e queijo.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 1500,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "X-BURGUER EGG",
          "ingredients": "Pão, hambúrguer, ovo e queijo.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 1800,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "X-SALADA",
          "ingredients": "Pão, hambúrguer, alface, tomate e queijo.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 1800,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "BAURU",
          "ingredients": "Pão, queijo mussarela e tomate.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 1800,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "X-SALADA COMPLETO",
          "ingredients": "Pão, hambúrguer, alface, tomate, queijo, milho, ervilha e batata palha.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 2400,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "EGGDU",
          "ingredients": "Pão, hambúrguer, ovo, queijo mussarela, tomate e orégano.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 2500,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "EGGCATU",
          "ingredients": "Pão, hambúrguer, catupiry, queijo, alface e tomate.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 2500,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "BAURU CALABRESA",
          "ingredients": "Pão, calabresa, queijo mussarela e tomate.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 2500,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "X-BURGUER BACON",
          "ingredients": "Pão, hambúrguer, bacon e queijo.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 2500,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "X-EGG",
          "ingredients": "Pão, hambúrguer, ovo, alface, tomate, queijo, milho, ervilha e batata palha.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 2800,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "MISTO FRANGO",
          "ingredients": "Pão, frango e queijo mussarela.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 2800,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "MISTO CORAÇÃO",
          "ingredients": "Pão, coração e queijo mussarela.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3000,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "X-SALADA GOURMET",
          "ingredients": "Pão, hambúrguer artesanal 150 g, alface, tomate, queijo cheddar, pepino e cebola roxa.",
          "is_available": true,
          "is_featured": true,
          "variants": [
            {
              "label": null,
              "price_cents": 3000,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "X-FRANGO",
          "ingredients": "Pão, frango, alface, tomate, queijo, milho, ervilha e batata palha.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3300,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "X-BACON",
          "ingredients": "Pão, hambúrguer, bacon, alface, tomate, queijo, milho, ervilha e batata palha.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3300,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "X-CALABRESA",
          "ingredients": "Pão, hambúrguer, calabresa, alface, tomate, queijo, milho, ervilha e batata palha.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3300,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "MISTO BACON",
          "ingredients": "Pão, bacon e queijo mussarela.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3300,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "MISTO BACON EGG",
          "ingredients": "Pão, bacon, ovo e queijo mussarela.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3400,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "X-FRANGO BACON",
          "ingredients": "Pão, frango, bacon, alface, tomate, queijo, milho, ervilha e batata palha.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3500,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "X-FRANGO EGG",
          "ingredients": "Pão, frango, ovo, alface, tomate, queijo, milho, ervilha e batata palha.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3500,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "X-BACON EGG",
          "ingredients": "Pão, hambúrguer, bacon, ovo, alface, tomate, queijo, milho, ervilha e batata palha.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3500,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "X-CORAÇÃO",
          "ingredients": "Pão, hambúrguer, coração, alface, tomate, queijo, milho, ervilha e batata palha.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3500,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "X-FRANGO CALABRESA",
          "ingredients": "Pão, frango, calabresa, alface, tomate, queijo, milho, ervilha e batata palha.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3500,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "MISTO FRANGO CORAÇÃO",
          "ingredients": "Pão, frango, coração e queijo mussarela.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3700,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "X-FRANGO CORAÇÃO",
          "ingredients": "Pão, frango, coração, alface, tomate, queijo, milho, ervilha e batata palha.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3700,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "X-ALCATRA EGG",
          "ingredients": "Pão, alcatra, ovo, alface, tomate, queijo, milho, ervilha e batata palha.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 4000,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "X-TUDO PIPO",
          "ingredients": "Pão, hambúrguer, bacon, ovo, frango, calabresa, coração, catupiry, alface, tomate, queijo, milho, ervilha e batata palha. Servido no prato.",
          "is_available": true,
          "is_featured": true,
          "variants": [
            {
              "label": null,
              "price_cents": 5200,
              "promotional_price_cents": null
            }
          ]
        }
      ]
    },
    {
      "name": "Lanches com Fritas no Prato",
      "products": [
        {
          "name": "X BURGUER COM FRITAS",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 2500,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "X SALADA COM FRITAS",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 2800,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "X EGG COM FRITAS",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3500,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "X GOURMET COM FRITAS",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3600,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "X FRANGO COM FRITAS",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3900,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "X BACON COM FRITAS",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3900,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "X CALABRESA COM FRITAS",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 3900,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "X CORAÇÃO COM FRITAS",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 4000,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "X COSTELA COM FRITAS",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 4100,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "X DOG ALCATRA COM FRITAS",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 4300,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "X BIFE COM FRITAS",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 4500,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "X ALCATRA COM FRITAS",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 4700,
              "promotional_price_cents": null
            }
          ]
        }
      ]
    },
    {
      "name": "Porções",
      "products": [
        {
          "name": "FRANGO A PASSARINHO (COXINHA DA ASA)",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": "Média",
              "price_cents": 4800,
              "promotional_price_cents": null
            },
            {
              "label": "Grande",
              "price_cents": 6900,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "FRITAS",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": "Média",
              "price_cents": 5000,
              "promotional_price_cents": null
            },
            {
              "label": "Grande",
              "price_cents": 7200,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "FRITAS COM CALABRESA",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": "Média",
              "price_cents": 5800,
              "promotional_price_cents": null
            },
            {
              "label": "Grande",
              "price_cents": 7400,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "FRITAS COM FRANGO",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": "Média",
              "price_cents": 5900,
              "promotional_price_cents": null
            },
            {
              "label": "Grande",
              "price_cents": 7700,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "FRITAS COM BACON",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": "Média",
              "price_cents": 6200,
              "promotional_price_cents": null
            },
            {
              "label": "Grande",
              "price_cents": 7400,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "FRITAS COM CHEDDAR",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": "Média",
              "price_cents": 6400,
              "promotional_price_cents": null
            },
            {
              "label": "Grande",
              "price_cents": 7500,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "FRITAS COM CORAÇÃO",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": "Média",
              "price_cents": 6500,
              "promotional_price_cents": null
            },
            {
              "label": "Grande",
              "price_cents": 7700,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "FRITAS COM ALCATRA",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": "Média",
              "price_cents": 7200,
              "promotional_price_cents": null
            },
            {
              "label": "Grande",
              "price_cents": 8700,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "FRITAS COM CHEDDAR E BACON",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": "Média",
              "price_cents": 7200,
              "promotional_price_cents": null
            },
            {
              "label": "Grande",
              "price_cents": 8700,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "FRITAS COMPLETA",
          "ingredients": "Coração, frango, calabresa, alcatra e bacon.",
          "is_available": true,
          "is_featured": true,
          "variants": [
            {
              "label": "Média",
              "price_cents": 9500,
              "promotional_price_cents": null
            },
            {
              "label": "Grande",
              "price_cents": 14900,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "FRITAS KIDS",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 2000,
              "promotional_price_cents": null
            }
          ]
        }
      ]
    },
    {
      "name": "Torre de Batata",
      "products": [
        {
          "name": "QUEIJO, FRANGO, CHEDDAR E CATUPIRY",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": "Média",
              "price_cents": 8500,
              "promotional_price_cents": null
            },
            {
              "label": "Grande",
              "price_cents": 11000,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "QUEIJO, BACON, CHEDDAR E CATUPIRY",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": "Média",
              "price_cents": 8900,
              "promotional_price_cents": null
            },
            {
              "label": "Grande",
              "price_cents": 9900,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "QUEIJO, BACON, CALABRESA, CHEDDAR E CATUPIRY",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": "Média",
              "price_cents": 9800,
              "promotional_price_cents": null
            },
            {
              "label": "Grande",
              "price_cents": 12500,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "QUEIJO, BACON, ALCATRA, CHEDDAR E CATUPIRY",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": "Média",
              "price_cents": 10000,
              "promotional_price_cents": null
            },
            {
              "label": "Grande",
              "price_cents": 14500,
              "promotional_price_cents": null
            }
          ]
        }
      ]
    },
    {
      "name": "Hot Dogs Doces",
      "products": [
        {
          "name": "DOG CHOCO",
          "ingredients": "Pão, queijo mussarela derretido e chocolate.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 1600,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG SENSAÇÃO",
          "ingredients": "Pão, queijo mussarela derretido, chocolate e morango.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 1800,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG CHARGE",
          "ingredients": "Pão, queijo mussarela derretido, chocolate e amendoim.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 1800,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG PRESTÍGIO",
          "ingredients": "Pão, queijo mussarela derretido, chocolate e coco ralado.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 1800,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "DOG LOVE",
          "ingredients": "Pão, queijo mussarela derretido, chocolate, morango, amendoim e coco ralado.",
          "is_available": true,
          "is_featured": true,
          "variants": [
            {
              "label": null,
              "price_cents": 2300,
              "promotional_price_cents": null
            }
          ]
        }
      ]
    },
    {
      "name": "Sobremesas",
      "products": [
        {
          "name": "TAÇA DE SORVETE",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 1600,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "PETIT GATEAU",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 1800,
              "promotional_price_cents": null
            }
          ]
        }
      ]
    },
    {
      "name": "Drinks",
      "products": [
        {
          "name": "DOSE",
          "ingredients": "Steinhager ou Smirnoff.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 1200,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "ICE",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 1500,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "REDBULL",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 1600,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "CUBA",
          "ingredients": "Steinhager ou Smirnoff.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 1800,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "CAIPIRA",
          "ingredients": "Steinhager ou Smirnoff.",
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 2000,
              "promotional_price_cents": null
            }
          ]
        }
      ]
    },
    {
      "name": "Cervejas",
      "products": [
        {
          "name": "ORIGINAL 600ML",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 1700,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "HEINEKEN 600ML",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 2300,
              "promotional_price_cents": null
            }
          ]
        }
      ]
    },
    {
      "name": "Bebidas",
      "products": [
        {
          "name": "ÁGUA MINERAL",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 500,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "REFRIGERANTE LATA",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 800,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "SUCO POLPA",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 1000,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "REFRIGERANTE 600ML",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 1200,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "CERVEJA LONG NECK",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 1500,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "REFRIGERANTE 1 LITRO",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 1600,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "CERVEJA LONG NECK (STELLA ARTOIS, HEINEKEN)",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 1700,
              "promotional_price_cents": null
            }
          ]
        },
        {
          "name": "REFRIGERANTE 2 LITROS",
          "ingredients": null,
          "is_available": true,
          "is_featured": false,
          "variants": [
            {
              "label": null,
              "price_cents": 2000,
              "promotional_price_cents": null
            }
          ]
        }
      ]
    }
  ]
}
```

## UX e acessibilidade

- Interface em português do Brasil.
- Formatação de moeda com `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`.
- Datas/horários no fuso configurado.
- Elementos interativos com área de toque adequada.
- Contraste suficiente e foco visível.
- Labels associados aos campos.
- Feedback de loading, erro, sucesso e estado vazio.
- Diálogos acessíveis.
- Respeitar `prefers-reduced-motion`.
- Sem animações excessivas.
- Desktop funcional, mas prioridade para Android e iPhone em navegadores atuais.

## Qualidade e testes

Crie scripts npm para:

- `dev`
- `build`
- `preview`
- `deploy`
- `lint`
- `typecheck`
- `test`
- `test:run`
- `db:migrate:local`
- `db:seed:local`

Testar pelo menos:

- formatação de dinheiro;
- validação de preço promocional;
- normalização de pesquisa;
- cálculo de aberto/fechado, inclusive após meia-noite;
- schemas de produto e importação;
- serialização de exportação;
- autenticação local fechando por padrão;
- middleware de Access com JWT inválido;
- handlers críticos com ambiente mockado;
- importação transacional em cenário válido e rejeição de schema inválido.

Não adicione Playwright. Não faça E2E.

Use TypeScript strict, sem `any` não justificado. Evite abstrações genéricas prematuras. Não introduza repository pattern excessivo, mas mantenha SQL isolado da UI e dos handlers.

## Cloudflare local e produção

Há apenas:

- desenvolvimento local;
- uma implantação de produção.

Não crie ambiente de staging.

Crie `wrangler.jsonc` funcional para desenvolvimento local com bindings:

- `DB`
- `MENU_IMAGES`

Para D1, use nome `pipo-cardapio-db`. Se o Wrangler exigir `database_id` mesmo em local, use UUID claramente fictício e documente a substituição antes do deploy.

Para R2, use nome `pipo-cardapio-images`.

Não execute:

- `wrangler d1 create`;
- `wrangler r2 bucket create`;
- migrações remotas;
- `wrangler deploy`;
- alterações de DNS;
- criação de Access;
- criação de domínio.

Prepare em `docs/cloudflare-setup.md` os comandos exatos para eu executar depois:

1. autenticar no Wrangler;
2. criar D1;
3. criar R2;
4. substituir IDs/bindings;
5. aplicar migrations remotas;
6. aplicar seed remoto;
7. configurar variáveis/segredos;
8. configurar Cloudflare Access em `/admin/*` usando Cloudflare IdP;
9. restringir ao e-mail `luangstl@gmail.com`;
10. configurar domínio quando registrado;
11. executar deploy manual;
12. habilitar Web Analytics opcionalmente no dashboard.

Explique também como trocar o e-mail administrativo no futuro.

## Regras de execução do Codex

- Use npm.
- Inspecione `node -v` e `npm -v`.
- Se a versão local for incompatível com o template oficial, pare e explique o requisito. Não instale ou altere Node globalmente.
- Inicialize Git.
- Não altere configuração global do Git.
- Faça commits lógicos apenas se `user.name` e `user.email` já estiverem configurados; caso contrário, não falhe e apenas reporte.
- Sugestão de commits:
  1. scaffold e infraestrutura local;
  2. banco, migrations, seed e API;
  3. cardápio público;
  4. painel administrativo;
  5. imagens, JSON, QR Code, testes e documentação.
- Não crie repositório GitHub.
- Não faça push.
- Não use serviços externos para imagens, auth ou QR.
- Não execute ações remotas.
- Não invente requisitos.
- Não pare entre fases para pedir aprovação.
- Depois de cada fase, rode verificações proporcionais.
- No final, rode obrigatoriamente:
  - lint;
  - typecheck;
  - testes;
  - build.
- Corrija todas as falhas causadas pelo projeto.
- Faça uma inspeção final por:
  - segredos versionados;
  - bypass de auth em produção;
  - SQL injection;
  - upload inseguro;
  - rotas admin desprotegidas;
  - referências à antiga marca;
  - layout quebrado em 320 px;
  - dados fictícios aparecendo publicamente.

## Critérios de aceite

A tarefa só está concluída quando:

1. `npm install` conclui.
2. O banco local pode ser migrado e semeado pelos scripts documentados.
3. `npm run dev` inicia frontend e Worker com D1/R2 locais.
4. O cardápio público exibe as 4 categorias e os 23 produtos do seed.
5. Produtos com tamanhos mostram corretamente Média/Grande.
6. Promoções são suportadas e a seção fica oculta quando vazia.
7. Indisponíveis permanecem visíveis.
8. O painel funciona localmente com bypass seguro.
9. Todas as rotas administrativas exigem autenticação fora de localhost.
10. CRUD, ordenação, duplicação, imagens, configurações e JSON funcionam.
11. O QR Code pode ser baixado em SVG.
12. Nenhum texto ou item mantém a marca Rafa's.
13. Não existem contatos, endereço ou horários fictícios visíveis.
14. Não há recursos remotos criados ou alterados.
15. Lint, typecheck, testes e build passam.
16. README e documentação de Cloudflare são suficientes para eu realizar a implantação manual.

## Entrega final da execução

Ao terminar, apresente um relatório objetivo contendo:

- resumo do que foi implementado;
- árvore principal de arquivos;
- comandos executados;
- resultados de lint, typecheck, testes e build;
- commits criados ou motivo para não criar;
- comandos que ainda precisam ser executados por mim na Cloudflare;
- placeholders pendentes da identidade e dados comerciais;
- riscos ou limitações reais restantes.

Comece agora e execute a implementação.
