# MATECH · API e plataforma web

API REST e interface web do **MATECH**. O aplicativo móvel fica em [`../matech_app`](../matech_app) e a visão geral do projeto no [README principal](../README.md).

---

## O que este serviço faz

Concentra **toda a regra de negócio** do sistema. Os dois clientes, a web em React e o aplicativo em Flutter, não calculam nada que valha dinheiro: eles consultam, exibem e enviam. O cálculo que vale acontece aqui.

São 11 módulos e 37 rotas, documentadas em `/api/docs` (OpenAPI):

| Módulo | Responsabilidade |
|---|---|
| `auth` | login, token JWT e troca da própria senha |
| `usuarios` | contas de acesso e os cinco perfis |
| `produtores` | cadastro de quem entrega, com validação de CPF/CNPJ e forma de pagamento |
| `motoristas` | motoristas e veículos |
| `cargas` | pesagem em duas etapas (bruto e tara), ticket sequencial e peso líquido |
| `qualidade` | fila de amostras e análise (palito, umidade, folha, aprovação) |
| `pagamentos` | ordens de pagamento por produtor e período, e a baixa |
| `sincronizacao` | recebimento da fila do aplicativo, sem duplicar |
| `avaliacoes` | consulta das avaliações feitas em campo |
| `aparelhos` | último contato e fila pendente de cada celular |
| `auditoria` | registro de alterações de todo o sistema |

---

## Rodar

Requisitos: **Node 24+** e **PostgreSQL** rodando localmente.

```bash
cp ../.env.exemplo .env      # e preencha DATABASE_URL e JWT_SECRET
npm install
npx prisma migrate dev       # cria as 14 tabelas
npm run seed                 # dados de exemplo
npm run dev                  # http://localhost:3000
```

Confira em `http://localhost:3000/health`, que deve responder `{"status":"ok","banco":"conectado"}`.

A plataforma web:

```bash
cd web
npm install
npm run dev                  # http://localhost:5173
```

Usuários de exemplo, com a senha **matech123** no ambiente local:

| Usuário | Perfil | O que pode |
|---|---|---|
| `rogerio.anselmo` | Operador de balança | registrar e fechar pesagens, cadastrar motorista |
| `cristiane.modesto` | Analista de qualidade | lançar a análise |
| `marcos.ferrari` | Comprador / avaliador | cadastrar produtor, sincronizar o aplicativo |
| `solange.petry` | Administrativo | todas as operações do negócio, inclusive pagamentos |
| `admin.matech` | Administrador | tudo, mais contas de acesso e registro de alterações |

Na versão publicada, a senha dos usuários de exemplo vem da variável `SENHA_SEED` (ver [`docs/publicar.md`](../docs/publicar.md)).

Outros comandos: `npm test` e `npm run studio`. O arquivo `requisicoes.http` tem requisições prontas para a extensão REST Client do VS Code.

---

## Como o código está organizado

```
src/
├── config/env.js       lê o .env e recusa subir se faltar variável
├── docs/               documentação OpenAPI das rotas
├── lib/                regras puras: documentos, números, pagamento, auditoria...
├── middlewares/        autenticação · autorização por perfil · tratamento de erros
├── modules/            um diretório por assunto do domínio
│   └── <assunto>/      rotas · controlador · serviço · testes
├── app.js              monta o Express (não abre porta)
└── server.js           sobe na porta
web/                    plataforma web em React + Vite
prisma/                 schema.prisma, migrações e seed
```

**Módulos por assunto, e não por tipo de arquivo.** Tudo que fala de pagamento está num lugar só, em vez de espalhado por `controllers/`, `services/` e `routes/`.

**`app.js` separado de `server.js`.** O teste importa o app e dispara requisições sem ocupar a porta 3000.

**Dentro de cada módulo:** `rota → controlador → serviço → banco`. A rota diz quem pode acessar, o controlador traduz HTTP e o serviço guarda a regra, sem saber o que é `req` ou `res`. Por isso a regra é testável sem subir servidor.

---

## Regras de negócio

**Preço acordado por carga.** Não existe tabela fixa: o preço por quilo é combinado com o produtor e informado na emissão da ordem.

```
peso líquido = peso bruto − tara
valor total  = peso líquido × preço acordado por quilo
```

**Pesagem em duas etapas.** A entrada registra o peso bruto com o caminhão carregado; a carga fica "aguardando tara" até o caminhão voltar vazio. Os pesos aceitos ficam entre 1.000 e 80.000 kg, e a tara não pode ser maior que o bruto.

**Valores gravados já calculados.** Peso líquido e valor não são recalculados a cada consulta: ficam como estavam no momento do recebimento.

**Destino do pagamento copiado na ordem.** A ordem guarda a forma de pagamento, a chave Pix ou os dados da conta no momento da emissão. Se o produtor trocar de chave depois, a ordem antiga continua mostrando para onde o dinheiro foi.

---

## Decisões que valem conhecer antes de mexer

**A senha nunca é guardada.** Só o hash bcrypt. A mensagem de erro é a mesma para "usuário não existe" e "senha errada", para não revelar quais usuários existem.

**Transações na análise e na emissão de ordem.** Criar a análise e mudar a situação da carga acontecem juntas ou não acontecem.

**Numeração de ticket sob concorrência.** Se dois operadores pesarem ao mesmo tempo e o número colidir, o sistema tenta o número seguinte, até três vezes.

**A única porta de entrada de uma avaliação é `POST /api/sincronizacao`.** Assim toda avaliação chega com `clientId` e `alteradoEmOrigem`, e a garantia de não duplicar vale sempre.

**Registro de alterações.** Cadastros, pesagens, análises, pagamentos, dados do aplicativo e contas ficam registrados com quem fez, quando e o que mudou. Senha nunca entra no registro.

**`env.js` recusa subir sem `DATABASE_URL` ou `JWT_SECRET`**, com mensagem clara, em vez de quebrar no meio de uma requisição.

---

## Testes

```bash
npm test
```

193 testes com `node:test` (164 da API e 29 da web), sem banco e sem servidor. Cobrem o cálculo de peso e valor, a leitura de números no padrão brasileiro, as faixas de peso, tara e preço, a validação de CPF e CNPJ, as regras de pagamento, a numeração de tickets e ordens, as permissões de cada perfil, o tipo das fotos e, na web, a formatação, a paginação e os filtros.

---

## Segurança

- O `.env` **nunca** vai para o repositório: tem a senha do banco e a chave que assina os tokens.
- Esconder um botão por perfil no front é conveniência. Quem protege é o `permitir()` no back-end: uma requisição forjada recebe 403 do mesmo jeito.
- CPF, CNPJ, pesos e preços são validados no servidor, e não só na tela, porque o aplicativo também grava dados.
- Em produção, o CORS aceita só as origens configuradas e a comunicação é feita por HTTPS.
