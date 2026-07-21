# Preparar uma instância na Cloudflare

Repita este procedimento para cada estabelecimento. Os nomes abaixo são apenas um padrão; use uma chave curta e exclusiva, como `lanchonete-centro`. Nunca reutilize D1, R2, domínio ou AUD entre clientes.

## 1. Criar os recursos

Autentique o Wrangler e crie recursos exclusivos:

```bash
npx wrangler login
npx wrangler d1 create menuelo-CHAVE-db
npx wrangler r2 bucket create menuelo-CHAVE-images
```

Anote o nome e o ID retornados pelo D1. O bucket não precisa ser público: imagens são servidas por `/media/:key`.

## 2. Configurar o Cloudflare Access

No Zero Trust:

1. habilite **One-time PIN** como provedor de identidade;
2. crie uma aplicação **Self-hosted** para o domínio do cardápio;
3. proteja os caminhos `/admin` e `/admin/*` na mesma aplicação;
4. crie uma política **Allow** com os e-mails completos autorizados;
5. não use `Everyone`, sufixo de domínio nem `Bypass`;
6. selecione apenas **One-time PIN** e uma duração de sessão adequada;
7. copie o **Application Audience (AUD) Tag**.

O cliente usa o próprio e-mail para receber o código e não precisa ter conta Cloudflare. Mantenha um e-mail de suporte na política somente quando isso tiver sido combinado.

## 3. Criar o perfil fora do Git

Use [deploy/client-profile.example.json](../deploy/client-profile.example.json) como contrato, mas salve cada cópia fora do repositório, por exemplo:

```text
/home/usuario/menuelo-clientes/lanchonete-a.json
/home/usuario/menuelo-clientes/lanchonete-b.json
```

Preencha nomes exclusivos, ID real do D1, endereço HTTPS, domínio da equipe Access, AUD e e-mails.

Para uma implantação definitiva com domínio próprio, mantenha o formato do arquivo de exemplo. O valor de `route.pattern` deve ser igual ao hostname de `publicSiteUrl`.

Enquanto o cliente ainda não tiver domínio, use o endereço atribuído à sua conta Workers:

```json
{
  "workerName": "menuelo-rafas-dog",
  "publicSiteUrl": "https://menuelo-rafas-dog.SEU-SUBDOMINIO.workers.dev",
  "route": {
    "workersDev": true
  }
}
```

Substitua `SEU-SUBDOMINIO` pelo subdomínio Workers da sua conta. O nome antes dele deve ser exatamente o mesmo de `workerName`. Nesse modo, URLs de preview permanecem desativadas. Configure o Cloudflare Access para proteger somente `/admin` e `/admin/*`, deixando o cardápio público.

Valide as duas instâncias juntas para detectar reutilização acidental:

```bash
npm run client:check -- /caminho/lanchonete-a.json /caminho/lanchonete-b.json
```

O validador recusa marcadores de exemplo, perfis dentro do repositório e recursos compartilhados.

## 4. Validar e publicar uma instância

Execute uma instância por vez e confira o caminho antes de confirmar qualquer operação remota:

```bash
npm run client:build -- /caminho/lanchonete-a.json
npm run client:dry-run -- /caminho/lanchonete-a.json
npm run client:db:migrate:remote -- /caminho/lanchonete-a.json
npm run client:deploy -- /caminho/lanchonete-a.json
```

- `build` e `dry-run` não publicam;
- `client:db:migrate:remote` altera somente o D1 indicado;
- `client:deploy` publica somente o Worker, assets e o endereço do perfil indicado;
- não existe comando de seed remoto: configure o cliente pelo painel ou importe uma cópia revisada.

O arquivo Wrangler temporário é ignorado pelo Git e removido ao fim. O build emitido contém a configuração da instância; não o versione.

## 5. Configurar o estabelecimento

Depois do primeiro deploy:

1. entre em `/admin` usando um e-mail autorizado;
2. informe nome, cor, contatos, endereço, horários e demais dados reais;
3. cadastre produtos manualmente ou importe uma cópia JSON revisada;
4. envie as imagens pelo painel;
5. confira o cardápio público e o QR Code.

Dados desconhecidos devem continuar vazios para permanecerem ocultos no cardápio.

## 6. Trocas e manutenção

Para autorizar ou remover uma pessoa, altere tanto a política Access quanto `access.adminEmails` no perfil e publique novamente. Para uma atualização de código, rode os testes uma vez e depois `client:dry-run`/`client:deploy` separadamente para cada cliente.

Não edite `wrangler.jsonc` com dados reais: ele é apenas a configuração local neutra.
