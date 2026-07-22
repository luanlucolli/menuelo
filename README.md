# Menuelo

Base white label para cardápios digitais com painel administrativo. Cada estabelecimento usa uma implantação isolada, com seu próprio Worker, banco D1, bucket R2, endereço público e aplicação Cloudflare Access. O endereço pode começar em `workers.dev` e receber um domínio personalizado depois. O produto publica o cardápio e informações comerciais; não recebe pedidos.

## Stack

- React 19, React Router, TanStack Query e React Hook Form;
- Vite com o plugin oficial da Cloudflare e TypeScript estrito;
- Hono em Cloudflare Workers com Static Assets;
- Cloudflare D1 para dados e R2 para imagens;
- Cloudflare Access com código por e-mail em `/admin` e `/admin/*`;
- Zod compartilhado entre frontend, Worker e ferramentas de implantação;
- Vitest e Playwright.

## Executar localmente

Requisitos: Node.js 22 ou versão compatível com Vite 8 e npm.

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run db:seed:demo:local
npm run dev
```

Em `.dev.vars`, `DEV_ADMIN_BYPASS=true` libera o painel somente em hostnames locais. Nunca copie essa opção para produção.

- Cardápio: `http://localhost:5173/`
- Painel: `http://localhost:5173/admin`

O seed de demonstração é deliberadamente neutro e substitui apenas os dados locais. Dados e fotos reais de clientes não pertencem ao repositório.

## Scripts

| Comando | Função |
| --- | --- |
| `npm run dev` | Inicia frontend, Worker e bindings locais |
| `npm run build` | Verifica TypeScript e gera o build neutro |
| `npm run lint` | Executa o ESLint |
| `npm run typecheck` | Verifica TypeScript estrito |
| `npm run test:run` | Executa testes unitários e de integração |
| `npm run test:e2e` | Executa fluxos críticos no navegador |
| `npm run db:migrate:local` | Aplica migrations no D1 local |
| `npm run db:seed:demo:local` | Carrega a demonstração no D1 local |
| `npm run demo:seed:generate` | Regenera `seeds/demo.sql` |
| `npm run client:check -- ARQUIVOS...` | Valida perfis externos e o isolamento entre clientes |
| `npm run client:build -- ARQUIVO` | Gera um build para um cliente |
| `npm run client:dry-run -- ARQUIVO` | Valida o pacote de deploy sem publicar |
| `npm run client:db:migrate:remote -- ARQUIVO` | Aplica migrations no D1 do cliente indicado |
| `npm run client:deploy -- ARQUIVO` | Publica somente a instância indicada |

As quatro últimas operações que recebem um único arquivo recusam execução ambígua. Perfis reais devem permanecer fora do repositório e são validados antes que qualquer comando seja iniciado.

O SSR público fica ativado por padrão em toda nova instância. A propriedade opcional `features.publicSsr: false` existe somente como rollback temporário e explícito.

## Estrutura

```text
src/react-app/          interface pública, painel, estilos e cliente HTTP
worker/                 API, autenticação, persistência e imagens
shared/                 schemas, tipos e utilitários compartilhados
migrations/             migrations versionadas e bootstrap neutro do D1
seeds/                  demonstração local sem dados de cliente
scripts/                seed e comandos de implantação por perfil
deploy/                 somente o contrato de exemplo do perfil
test/                   testes unitários, integração e navegador
docs/                   arquitetura e operação
```

## Dados, imagens e identidade

Nome, inicial, cor principal, contatos e metadados públicos vêm das configurações do estabelecimento. Valores desconhecidos permanecem vazios e ocultos. O fallback visual é neutro (`#374151`) e “Menuelo” não aparece como marca do estabelecimento.

Dinheiro é armazenado em centavos. Produtos com preço único usam uma variação sem nome. Imagens são convertidas para WebP no navegador; o R2 continua privado e o Worker as entrega por `/media/:key`.

Exportações JSON não contêm os binários das imagens. Guarde cópias dos dados e das fotos fora do Git.

Para preparar duas instâncias isoladas, consulte [docs/cloudflare-setup.md](docs/cloudflare-setup.md).
