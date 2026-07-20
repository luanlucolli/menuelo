# Especificação do Menuelo

Menuelo é uma base white label de cardápio digital público com painel administrativo, sem pedidos, carrinho ou checkout.

## Produto

- o cardápio exibe somente informações comerciais configuradas;
- o painel permite administrar categorias, produtos, preços, promoções, disponibilidade, imagens, ordenação e dados do estabelecimento;
- nome, inicial, cor principal, metadados e arquivos exportados derivam do estabelecimento;
- o estado inicial é neutro e orienta a configuração;
- a linguagem do painel é simples e voltada a pessoas com pouca familiaridade digital.

## Arquitetura white label

- o código-fonte é compartilhado;
- cada estabelecimento possui Worker, D1, R2, domínio e Cloudflare Access isolados;
- perfis reais de implantação ficam fora do repositório;
- não existe multi-tenancy ou autenticação própria;
- `/admin` e `/admin/*` exigem Cloudflare Access em produção, além da validação de JWT e e-mail no Worker.

## Dados e segurança

- entradas de API são validadas por Zod;
- SQL usa prepared statements;
- valores monetários são persistidos em centavos;
- imagens ficam em R2 privado e são servidas pelo Worker;
- nenhum segredo, credencial, dado ou foto real de cliente deve ser versionado;
- migrations criam somente um estado neutro; dados de demonstração são exclusivamente locais;
- operações remotas exigem um perfil externo explícito e validado.

## Qualidade

- TypeScript permanece estrito;
- frontend, Worker e contratos compartilhados permanecem separados;
- lint, typecheck, testes, fluxos de navegador e build devem passar antes da publicação;
- novos dados comerciais desconhecidos permanecem vazios e ocultos.
