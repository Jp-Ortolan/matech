# Publicar o MATECH na internet (Render + Neon)

A API e a web sobem juntas no **Render**, num endereço só (o Express serve a
tela do React). O banco PostgreSQL fica no **Neon**. Os dois têm plano grátis.
Contas e cliques ficam com você; o projeto já está pronto para isso
(`render.yaml` na raiz).

## 1. Mandar o código para o GitHub

```
git push
```

## 2. Banco no Neon

Já feito pelo CLI (`neon link` dentro de `swm_ervateira`). O projeto está em
`us-east-2` e o `neon link` gravou no `.env` o `DATABASE_URL` (pooled) e o
`DATABASE_URL_UNPOOLED` (direto). No Render, use o valor do
`DATABASE_URL_UNPOOLED` como `DATABASE_URL`.

## 3. Serviço no Render

1. Crie a conta em render.com entrando com o GitHub.
2. **New → Blueprint** e escolha o repositório `matech`. O Render lê o
   `render.yaml` e pede dois valores:
   - `DATABASE_URL`: o valor do `DATABASE_URL_UNPOOLED` do `.env`.
   - `SENHA_SEED`: a senha que os usuários de teste vão usar na versão
     publicada. Não use `matech123`.
3. Clique em **Apply**. A primeira publicação leva uns 5 minutos. Ela instala
   tudo, gera a tela da web e cria as tabelas no Neon (`prisma migrate deploy`).
4. O endereço fica parecido com `https://matech-xxxx.onrender.com`.
   Teste `https://matech-xxxx.onrender.com/health`: tem que responder
   `"banco": "conectado"`.

O `JWT_SECRET` é gerado pelo próprio Render, longo e aleatório.

## 4. Dados de demonstração (uma vez só)

O seed roda do seu PC, apontando para o banco do Neon. No PowerShell, dentro
de `swm_ervateira`:

```
$env:DATABASE_URL="(endereço do Neon)"
$env:SENHA_SEED="(a mesma senha do passo 3)"
npm run seed
```

Feche o PowerShell depois, para o PC voltar a usar o banco local do `.env`.

## 5. Aplicativo apontando para a API publicada

Dentro de `matech_app`:

```
flutter build apk --release --dart-define=MATECH_API=https://matech-xxxx.onrender.com
```

O APK sai em `build\app\outputs\flutter-apk\app-release.apk`. Mande para o
celular e instale. Ele funciona em qualquer rede (Wi-Fi, 4G), sem precisar do
PC ligado.

No emulador, para usar a versão publicada:

```
flutter run --release --dart-define=MATECH_API=https://matech-xxxx.onrender.com
```

## Cuidados

- **O plano grátis dorme** depois de 15 minutos sem uso. A primeira chamada
  depois disso leva uns 50 segundos. Antes da banca, abra o site uns minutos
  antes. O app não perde nada nesse tempo: a fila espera e envia depois.
- **Fotos** ficam no banco (o disco do Render é apagado a cada reinício).
  O Neon grátis tem 0,5 GB, o que dá alguns milhares de fotos.
- **Segurança:** a versão instalada do app só aceita https (menos para o
  emulador, em `10.0.2.2`). A versão de depuração (`flutter run` sem
  `--release`) continua aceitando http, para testar com a API local pelo Wi-Fi.
- **CORS:** em produção nenhum outro site pode chamar a API. Se um dia precisar
  liberar um endereço, coloque-o em `CORS_ORIGENS` no Render.
