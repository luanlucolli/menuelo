# Pipo Cardápio Digital

Cardápio público e painel administrativo da **Pipo Lanches & Porções**. O projeto não recebe pedidos: ele publica produtos, preços, promoções e informações comerciais configuráveis.

## Stack

- React 19, React Router, TanStack Query e React Hook Form;
- Vite com o plugin oficial da Cloudflare;
- TypeScript estrito, Zod compartilhado e Tailwind CSS com tokens neutros;
- Hono em Cloudflare Workers com Static Assets;
- Cloudflare D1 para dados e R2 para imagens;
- Cloudflare Access com código por e-mail para `/admin` e `/admin/*`, com validação JWT adicional no Worker;
- Vitest, sem Playwright.

## Executar localmente

Requisitos: Node.js 22 ou versão compatível com Vite 8 e npm.

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

Em `.dev.vars`, mantenha `DEV_ADMIN_BYPASS=true` apenas para desenvolvimento. O bypass também exige hostname local (`localhost`, `127.0.0.1` ou equivalente), portanto falha fechado fora da máquina local.

- Cardápio: `http://localhost:5173/`
- Painel: `http://localhost:5173/admin`

O seed substitui integralmente o cardápio por 4 categorias, 23 produtos e 23 variações, removendo as referências de imagens dos produtos e da capa. Segunda-feira começa marcada como fechada; os outros horários e todos os contatos permanecem vazios.

## Scripts

| Comando | Função |
| --- | --- |
| `npm run dev` | Vite + Worker + bindings D1/R2 locais |
| `npm run build` | TypeScript e build de produção |
| `npm run preview` | Build e preview local |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript estrito de frontend, Worker e testes |
| `npm test` | Vitest em modo watch |
| `npm run test:run` | Vitest uma vez |
| `npm run db:migrate:local` | Migrações D1 locais |
| `npm run db:seed:local` | Seed D1 local |
| `npm run seed:generate` | Regenera o seed a partir do JSON canônico da especificação |
| `npm run deploy` | Build e deploy manual; não é executado automaticamente |

## Estrutura principal

```text
src/react-app/          interface pública, painel, estilos e cliente HTTP
worker/                 Hono, rotas, autenticação, persistência e serviços
shared/                 schemas, tipos e utilitários compartilhados
migrations/             migrations versionadas do D1
seeds/                  JSON canônico e SQL idempotente
scripts/                geração mecânica do seed
test/                   testes unitários e integrações com bindings simulados
docs/                   arquitetura e implantação manual
public/                 assets estáticos
wrangler.jsonc          Worker, Static Assets, D1, R2 e variáveis
```

## Dados e imagens

Dinheiro é armazenado em centavos. Produtos de preço único também usam uma variação com `label: null`. Imagens são convertidas no navegador para WebP, redimensionadas para até 1600 px e reduzidas visando 600 KB; o Worker valida WebP por MIME e magic bytes e impõe 800 KB. HEIC não é suportado nesta versão.

Exportações JSON contêm chaves de imagem, nunca os binários. Uma importação `replace` valida e mostra diferenças antes da confirmação, gera IDs locais e usa `D1Database.batch()` para rollback atômico em falha. Objetos R2 não são excluídos pela importação.

## Produção

Consulte [docs/cloudflare-setup.md](docs/cloudflare-setup.md) para criar manualmente D1/R2, configurar Access e publicar. O repositório usa um UUID D1 deliberadamente fictício que deve ser substituído antes do deploy.

Dados ainda pendentes e ocultos até configuração: identidade visual definitiva, capa, contatos, redes sociais, endereço, Maps, horários de terça a domingo, formas de pagamento, regiões/taxas e domínio público.
