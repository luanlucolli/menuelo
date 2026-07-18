# Orientações do repositório

- Use npm e mantenha TypeScript em modo estrito.
- Preserve a separação entre `src/react-app`, `worker` e `shared`.
- Nunca coloque segredos, `.dev.vars`, imagens em base64 ou credenciais no frontend.
- Toda entrada de API deve ser validada por Zod e toda entrada SQL deve usar prepared statements.
- Não execute deploy, criação de D1/R2/Access, migração remota ou alteração de DNS sem pedido explícito.
- O painel e a API administrativa ficam sob `/admin/*`; produção exige JWT válido do Cloudflare Access e allowlist de e-mail.
- Dados comerciais desconhecidos devem continuar vazios e ocultos na interface pública.
- Não introduza pedidos, carrinho, checkout, PWA, multi-tenancy ou autenticação própria.
- Antes de concluir, execute `npm run lint`, `npm run typecheck`, `npm run test:run` e `npm run build`.
