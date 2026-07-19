# Implantação manual na Cloudflare

Este guia deve ser executado somente quando o domínio e os dados comerciais estiverem prontos. Nenhum destes passos foi executado durante a criação do projeto.

## 1. Autenticar o Wrangler

```bash
npx wrangler login
npx wrangler whoami
```

## 2. Criar o D1

```bash
npx wrangler d1 create pipo-cardapio-db
```

Copie o `database_id` exibido e substitua `00000000-0000-0000-0000-000000000001` em `wrangler.jsonc`. Não altere o binding `DB` nem `database_name`.

## 3. Criar o R2

```bash
npx wrangler r2 bucket create pipo-cardapio-images
```

Confirme em `wrangler.jsonc`:

- binding: `MENU_IMAGES`;
- bucket: `pipo-cardapio-images`.

## 4. Configurar URL e variáveis

Antes do deploy, edite `vars` em `wrangler.jsonc`:

```jsonc
"vars": {
  "DEV_ADMIN_BYPASS": "false",
  "CF_ACCESS_TEAM_DOMAIN": "https://SUA-EQUIPE.cloudflareaccess.com",
  "CF_ACCESS_AUD": "AUD_COPIADO_DA_APLICACAO_ACCESS",
  "ADMIN_EMAILS": "luangstl@gmail.com",
  "PUBLIC_SITE_URL": "https://DOMINIO-DEFINITIVO"
}
```

`CF_ACCESS_TEAM_DOMAIN` deve incluir `https://` e não deve terminar com `/`. `PUBLIC_SITE_URL` é o fallback de canonical/QR; também pode ser editado no painel. Não configure `DEV_ADMIN_BYPASS=true` em produção.

O projeto não possui segredo de aplicação nesta versão. Se um segredo for adicionado futuramente, use o prompt interativo, nunca o valor na linha de comando ou no Git:

```bash
npx wrangler secret put NOME_DO_SEGREDO
```

Depois de qualquer mudança nos bindings, regenere os tipos:

```bash
npm run cf-typegen
```

## 5. Aplicar migrations e seed remotos

Revise primeiro se o `database_id` fictício foi substituído. Depois:

```bash
npm run db:migrate:remote
npm run db:seed:remote
```

O seed inicial não cria contatos, endereço, meios de pagamento, zonas ou horários fictícios.

## 6. Configurar o Cloudflare Access

No dashboard Zero Trust:

1. Abra **Integrations > Identity providers > Add new identity provider** e habilite **One-time PIN**.
2. Abra **Access controls > Applications > Add an application > Self-hosted**.
3. Use o hostname público e cadastre dois caminhos na mesma aplicação: `/admin` e `/admin/*`. O primeiro protege a entrada exata do painel; o segundo protege suas páginas e toda a API administrativa em `/admin/api/*`.
4. Crie uma política **Allow** com regras **Include > Emails** para cada endereço autorizado. Use endereços completos; não use `Everyone`, `Emails ending in`, `Login Methods` sozinho nem `Bypass`.
5. Selecione apenas **One-time PIN** como método de login. O usuário informará o e-mail autorizado e receberá um código temporário, sem precisar criar uma conta Cloudflare.
6. Na configuração da aplicação, selecione **Session duration > 7 days** e mantenha a política com a duração **Same as application**. O código será solicitado novamente quando a sessão expirar ou for encerrada.
7. Salve a aplicação e copie o **Application Audience (AUD) Tag** em **Additional settings**.
8. Coloque o AUD em `CF_ACCESS_AUD` e confirme o domínio da equipe em `CF_ACCESS_TEAM_DOMAIN`.

Os mesmos endereços completos da política devem constar em `ADMIN_EMAILS`, separados por vírgula. Cada proprietário ou funcionário deve usar seu próprio e-mail; mantenha também um e-mail da Menuelo somente quando o suporte administrativo for necessário.

O Worker valida novamente assinatura, issuer, audience, expiração e e-mail usando `jose` e o endpoint JWKS rotativo do Access. Isso é intencional e não substitui a política do Access.

Referências oficiais:

- <https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/>
- <https://developers.cloudflare.com/cloudflare-one/access-controls/policies/common-policies/>
- <https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/>
- <https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/>
- <https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/>
- <https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/>

## 7. Validar e fazer deploy manual

```bash
npm install
npm run lint
npm run typecheck
npm run test:run
npm run build
npm run deploy
```

`npm run deploy` é a única etapa desta lista que publica o Worker. Execute-a apenas quando D1, R2, variáveis e Access estiverem prontos.

## 8. Configurar domínio

Quando o domínio estiver registrado:

1. Abra **Workers & Pages > pipo-cardapio-digital > Settings > Domains & Routes**.
2. Adicione o domínio personalizado desejado.
3. Atualize `PUBLIC_SITE_URL` em `wrangler.jsonc` e a **URL pública** no painel.
4. Atualize o hostname da aplicação Access, preservando os dois caminhos `/admin` e `/admin/*`.
5. Faça novo deploy manual caso `wrangler.jsonc` tenha mudado.

Não é necessário tornar o bucket R2 público: todas as imagens são servidas por `/media/:key`.

## 9. Habilitar Web Analytics opcional

No dashboard, abra **Web Analytics**, adicione o site e habilite a integração oferecida para Workers/roteamento. Não adicione manualmente um beacon ao código deste projeto.

## Trocar o e-mail administrativo

A troca exige as duas camadas:

1. altere a regra **Emails** da política Access;
2. altere `ADMIN_EMAILS` em `wrangler.jsonc` (vários e-mails podem ser separados por vírgula);
3. execute `npm run deploy` manualmente.

Remover o e-mail em apenas uma camada continuará bloqueando o usuário, como esperado.
