# MATECH · API e sistema web

Back-end REST e interface web do **MATECH**, sistema de gestão de matéria-prima
para indústrias ervateiras. O aplicativo móvel fica em `../matech_app`.

---

## O que este serviço faz

Concentra **toda a regra de negócio** do sistema. Os dois clientes — a web em
React e o aplicativo em Flutter — não calculam nada que valha dinheiro: eles
perguntam, exibem e enviam. A conta que vale acontece aqui.

| Módulo | Responsabilidade |
|---|---|
| `auth` | login, token JWT e os quatro perfis de acesso |
| `produtores` | cadastro de quem entrega, com validação de CPF/CNPJ |
| `motoristas` | motoristas e veículos, com a tara guardada por placa |
| `cargas` | pesagem, ticket sequencial e o cálculo do RF10 |
| `qualidade` | análise de laboratório e o desconto por palito |
| `pagamentos` | ordens de pagamento agrupadas por período |
| `sincronizacao` | recebimento do lote coletado em campo, sem conexão |
| `avaliacoes` | consulta do que o aplicativo produziu no erval |

---

## Rodar

Requisitos: **Node 24+** e **PostgreSQL 18** rodando localmente.

```bash
cp ../.env.exemplo .env      # e preencha DATABASE_URL e JWT_SECRET
npm install
npx prisma migrate dev       # cria as 12 tabelas
npm run seed                 # dados de exemplo
npm run dev                  # http://localhost:3000
```

Confira em `http://localhost:3000/health` — deve responder
`{"status":"ok","banco":"conectado"}`.

O front:

```bash
cd web
npm install
npm run dev                  # http://localhost:5173
```

Usuários de exemplo, senha **matech123** para todos:

| Usuário | Perfil | O que pode |
|---|---|---|
| `rogerio.anselmo` | Operador de balança | registrar pesagem, cadastrar motorista |
| `cristiane.modesto` | Analista de qualidade | lançar análise e aplicar o desconto |
| `marcos.ferrari` | Comprador / avaliador | cadastrar produtor, sincronizar o aplicativo |
| `solange.petry` | Administrativo | tudo |

Outros comandos: `npm test`, `npm run studio`, `npm run lint` (dentro de `web`).
O arquivo `requisicoes.http` tem requisições prontas para a extensão REST Client
do VS Code.

---

## Como o código está organizado

```
src/
├── config/env.js       lê o .env e RECUSA subir se faltar variável
├── lib/
│   ├── prisma.js       conexão única com o banco
│   └── documentos.js   validação de CPF e CNPJ por dígito verificador
├── middlewares/        autenticação · autorização · tratamento de erros
├── modules/            um diretório por assunto do domínio
│   └── <assunto>/      rotas · controlador · serviço · testes
├── app.js              monta o Express — NÃO abre porta
└── server.js           sobe na porta
```

**Módulos por assunto, e não por tipo de arquivo.** A alternativa comum é
`controllers/`, `services/`, `routes/`. O problema é que uma alteração em
pagamentos obrigaria a abrir três pastas. Agrupando por assunto, tudo que fala
de pagamento está num lugar só — e um módulo poderia ser extraído amanhã, se
algum dia precisar virar serviço separado.

**`app.js` separado de `server.js`.** O `app.js` monta a aplicação mas não abre
porta, o que permite a um teste importar o app e disparar requisições sem
ocupar a 3000.

**Dentro de cada módulo:** `rota → controlador → serviço → banco`. A rota diz
quem pode acessar. O controlador traduz HTTP. O serviço guarda a regra e não
sabe o que é `req` ou `res` — é por isso que ele é testável sem subir servidor.

---

## Decisões que valem conhecer antes de mexer

**A senha nunca é guardada.** Só o hash bcrypt, com custo 10. E a mensagem de
erro é idêntica para "usuário não existe" e "senha errada" — se fossem
diferentes, alguém descobriria quais usuários existem testando nomes.

**Peso líquido e valor total são gravados calculados**, não recalculados a cada
consulta. São dados que não mudam depois de registrados e que são lidos o tempo
todo: é troca consciente de espaço por tempo.

**Transações na análise e na emissão de ordem.** Criar a análise e mudar a
situação da carga acontecem juntas ou não acontecem. Sem isso, uma falha no meio
deixaria uma análise apontando para uma carga ainda "aguardando" —
inconsistência silenciosa, das piores de achar depois.

**`chavePixSnapshot` na ordem de pagamento** copia a chave no momento da
emissão. Se o produtor trocar de chave no mês seguinte, a ordem antiga continua
mostrando para onde o dinheiro realmente foi.

**Numeração de ticket sob concorrência.** Gerar o número é "ler o maior e somar
um", e entre a leitura e a gravação há uma janela. Dois operadores pesando ao
mesmo instante colidiam no índice único. Hoje o sistema tenta o número seguinte,
até três vezes — e uma duplicidade em *outro* campo sobe na hora, sem retentar,
porque insistir não conserta um CPF repetido.

**A única porta de entrada de uma avaliação é `POST /api/sincronizacao`.** Não
existe rota genérica para criar avaliação, e a ausência é proposital: uma
segunda porta entraria sem `clientId`, sem `alteradoEmOrigem` e sem auditoria —
e a garantia de não duplicar valeria metade do tempo.

**`env.js` recusa subir sem `DATABASE_URL` ou `JWT_SECRET`**, com mensagem
clara, em vez de quebrar no meio de uma requisição meia hora depois.

---

## A regra do palito

O percentual de palito medido no laboratório desconta o preço por quilo:

```
excedente      = palito medido − limite aceito     (nunca negativo)
desconto (%)   = excedente × percentual por ponto
preço ajustado = preço base × (1 − desconto/100)
valor total    = peso líquido × preço ajustado
```

**Limite de 30% e 1% por ponto percentual são provisórios** — a fórmula oficial
ainda será confirmada com a ervateira. Está isolada em `cargas.service.js` e
espelhada em `web/src/lib/calculo.js` apenas para pré-visualização enquanto o
analista digita. O servidor recalcula e é quem vale.

---

## Testes

```bash
npm test
```

33 casos, sem banco e sem servidor — só é possível porque a regra está isolada
nos serviços. Cobrem o cálculo de pagamento (RF10), a validação de documentos e
a numeração sequencial sob concorrência.

---

## Segurança

- O `.env` **nunca** vai para o repositório: tem a senha do banco e a chave que
  assina os tokens. Quem tiver essa chave forja um token e entra como qualquer
  usuário.
- Esconder um botão por perfil no front é conveniência. Quem protege é o
  `permitir()` no back-end — uma requisição forjada toma 403 do mesmo jeito.
- CPF e CNPJ são validados no servidor, e não só na tela, porque o aplicativo
  móvel também grava produtor.
- `usesCleartextTraffic` no Android e o CORS aberto valem **para
  desenvolvimento**. Em produção a API precisa de certificado e de origem
  restrita.
