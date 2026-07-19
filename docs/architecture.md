# Arquitetura e decisões

## Fluxo

O Vite entrega uma SPA React por Workers Static Assets. As rotas `/api/*`, `/admin/api/*` e `/media/*` executam primeiro o Worker Hono; as demais usam fallback de SPA. `GET /api/menu` agrega configurações, horários, pagamentos, regiões, categorias, produtos e variações sem N+1 e aplica cache público curto. Todas as respostas administrativas usam `no-store`.

O cardápio filtra nome e ingredientes no cliente, pois o volume é pequeno. TanStack Query mantém o cache e é invalidado após mutações. Schemas Zod em `shared/` validam os mesmos contratos no frontend e no backend.

## Segurança administrativa

Em produção, Cloudflare Access protege os caminhos `/admin` e `/admin/*`. Usuários autorizados entram com um código temporário enviado ao e-mail e não precisam possuir conta Cloudflare. A API aplica uma segunda camada: verifica `Cf-Access-Jwt-Assertion` com as chaves JWKS rotativas do domínio da equipe, issuer, audience, expiração e e-mail. O e-mail também precisa constar em `ADMIN_EMAILS`.

O bypass local requer simultaneamente `DEV_ADMIN_BYPASS=true` e hostname loopback/local. Configurá-lo por engano em um domínio real não libera a API.

## Persistência

Todas as entradas SQL usam prepared statements. Foreign keys impedem categoria com produtos de ser excluída e removem variações em cascata. Slugs são determinísticos e recebem sufixo em colisões. IDs novos e chaves R2 usam `crypto.randomUUID()`.

Substituição de imagem envia o novo objeto, atualiza o banco e só depois remove o anterior. Se o banco falhar, o objeto novo é removido. Exclusão de produto remove o objeto antigo em best effort sem desfazer a exclusão do banco. Duplicação copia o objeto para uma nova chave.

## Limites deliberados

Não há pedidos, carrinho, checkout, consumidores, pagamento, cálculo de frete, PWA, impressão, histórico, multi-tenancy, autenticação própria, SSR, filas ou cron. Não há recorte manual nem suporte a HEIC. Web Analytics deve ser ativado pelo dashboard, sem script no código.
