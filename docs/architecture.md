# Arquitetura

## Aplicação

O Vite entrega uma SPA React por Workers Static Assets. `/api/*`, `/admin/api/*` e `/media/*` executam primeiro o Worker Hono; as demais rotas usam fallback da SPA. `GET /api/menu` agrega configurações, horários, pagamentos, regiões, categorias, produtos e preços. Schemas Zod em `shared/` validam contratos nos dois lados.

O cardápio público e o painel leem a identidade do banco. Nome, inicial e cor não são constantes de uma lanchonete. Quando o estabelecimento ainda não foi configurado, o bootstrap mostra um estado neutro e não inventa contatos ou dados comerciais.

## Isolamento white label

O código é único, mas cada cliente é uma implantação independente:

```text
perfil externo do cliente
  ├── Worker + Static Assets
  ├── banco D1
  ├── bucket R2 privado
  ├── endereço workers.dev temporário ou domínio personalizado
  └── aplicação e política Cloudflare Access
```

Não há coluna `tenant_id`, seleção de cliente em runtime nem banco compartilhado. Essa separação reduz o risco de vazamento e mantém a arquitetura atual. `scripts/client-command.mjs` materializa temporariamente uma configuração Wrangler a partir de um perfil externo, valida duplicidades e apaga o arquivo ao terminar.

## Segurança administrativa

Em produção, Cloudflare Access protege `/admin` e `/admin/*`. Usuários autorizados recebem um código temporário no próprio e-mail; não precisam de conta Cloudflare. A API verifica novamente o JWT, issuer, audience, expiração e allowlist `ADMIN_EMAILS`.

O bypass local requer `DEV_ADMIN_BYPASS=true` e hostname local. Ele não libera a API em um domínio real.

## Persistência

Todas as entradas SQL usam prepared statements. Foreign keys impedem excluir categorias ocupadas e removem preços em cascata. IDs e chaves de imagem usam `crypto.randomUUID()`.

Substituição de imagem grava o objeto novo, atualiza o banco e só então tenta remover o anterior. Importação valida o documento antes de substituir os dados e não apaga objetos R2.

## Limites deliberados

Não há pedidos, carrinho, checkout, consumidores, pagamento, frete, PWA, impressão, histórico, multi-tenancy ou autenticação própria. A criação dos recursos Cloudflare e do Access continua sendo uma etapa operacional explícita para cada cliente.
