<div align="center">

# MATECH

**Sistema web e móvel para o controle de recebimento, avaliação em campo e pagamento de matéria-prima em indústrias ervateiras**

![Node.js](https://img.shields.io/badge/Node.js-24-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Flutter](https://img.shields.io/badge/Flutter-3-02569B?logo=flutter&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)

Trabalho de Conclusão de Curso · Engenharia de Software · Centro Universitário Campo Real · Guarapuava/PR · 2026

</div>

---

## Sobre o projeto

Em muitas ervateiras, o recebimento de erva-mate e lenha ainda é anotado em fichas de papel e depois digitado em planilhas, em momentos e por pessoas diferentes. Isso gera trabalho repetido, erros de digitação e dificulta saber de qual erval veio uma carga, como ela foi avaliada e se já foi paga.

O MATECH reúne todo esse caminho em um único sistema:

1. **No erval**, o comprador cadastra o produtor e registra a avaliação pelo aplicativo, **mesmo sem internet**.
2. **Na balança**, o operador registra o peso bruto do caminhão carregado e, depois da descarga, a tara.
3. **No laboratório**, o analista lança palito, umidade e folha e aprova ou reprova a carga.
4. **No administrativo**, as cargas aprovadas viram uma **ordem de pagamento** por produtor, com o destino do Pix ou da conta.

Cada dado é digitado uma única vez, por quem está onde ele é produzido, e todas as alterações ficam registradas em um **registro de auditoria**.

## Funcionalidades

**Plataforma web** (setores internos)
- Pesagem em duas etapas (bruto e tara), com ticket impresso
- Fila de amostras para a análise de qualidade
- Ordens de pagamento por produtor e período, com baixa do pagamento
- Cadastro de produtores, motoristas e veículos
- Relatórios de recebimento, qualidade, matéria-prima e financeiro, com exportação em CSV e PDF
- Acompanhamento das avaliações de campo e dos aparelhos
- Contas de acesso por perfil e registro de alterações

**Aplicativo móvel** (campo)
- Funciona **sem conexão**: tudo é gravado no próprio celular
- Cadastro de produtores e ervais, avaliação com fotos e localização
- Sincronização automática quando o sinal volta, **sem duplicar e sem perder** registros

## Arquitetura

```
 Aplicativo (Flutter + SQLite)          Plataforma web (React + Vite)
          │  fila de envio                         │
          └──────────────► API REST ◄──────────────┘
                     (Node.js + Express + Prisma)
                                │
                        PostgreSQL (Neon)
```

- **A regra de negócio fica toda na API.** Web e aplicativo não calculam nada que valha dinheiro: o peso líquido e o valor são calculados e gravados no servidor.
- **O aplicativo nunca fala direto com o banco.** Ele grava no SQLite do aparelho junto com um item da fila (padrão *Outbox*), e o sincronizador envia a fila quando há conexão.
- **Cada operação do aplicativo tem um `clientId`**, por isso o reenvio do mesmo pacote não cria registro repetido.

Os diagramas (casos de uso, classes e arquitetura) estão em [`docs/diagramas`](docs/diagramas).

## Perfis de acesso

| Perfil | O que faz |
|---|---|
| Operador de balança | registra a entrada e fecha a pesagem, cadastra motoristas |
| Analista de qualidade | lança a análise da amostra |
| Comprador / avaliador | cadastra produtores e usa o aplicativo de campo |
| Administrativo | emite ordens de pagamento, dá baixa e vê os relatórios financeiros; pode fazer todas as operações do negócio |
| Administrador | tudo o que o administrativo faz, mais as contas de acesso e o registro de alterações |

As permissões são conferidas na API, e não só na tela: uma requisição feita por fora da interface recebe o mesmo bloqueio.

## Tecnologias

| Parte | Tecnologias |
|---|---|
| API | Node.js 24, Express 5, Prisma 7, JWT, bcrypt, documentação OpenAPI em `/api/docs` |
| Web | React 19, Vite, Tailwind CSS, React Router |
| Aplicativo | Flutter, SQLite (`sqflite`), câmera e GPS do aparelho |
| Banco | PostgreSQL, hospedado no Neon |
| Publicação | Render (API e web no mesmo serviço) |

## Estrutura do repositório

```
matech/
├── swm_ervateira/      API REST e plataforma web
│   ├── src/            módulos da API (um por assunto: cargas, pagamentos...)
│   ├── prisma/         esquema do banco, migrações e dados de exemplo
│   └── web/            plataforma web em React
├── matech_app/         aplicativo móvel em Flutter
├── docs/
│   ├── diagramas/      diagramas UML
│   ├── publicar.md     como publicar no Render e no Neon
│   └── rodar-o-app.md  como rodar o aplicativo no emulador ou no navegador
├── render.yaml         configuração da publicação
└── .env.exemplo        modelo das variáveis de ambiente
```

## Como rodar

**Requisitos:** Node.js 24, PostgreSQL e, para o aplicativo, o Flutter SDK.

```bash
# API
cd swm_ervateira
cp ../.env.exemplo .env        # preencha DATABASE_URL e JWT_SECRET
npm install
npx prisma migrate dev         # cria as tabelas
npm run seed                   # dados de exemplo
npm run dev                    # http://localhost:3000

# Web (em outro terminal)
cd swm_ervateira/web
npm install
npm run dev                    # http://localhost:5173

# Aplicativo (em outro terminal)
cd matech_app
flutter pub get
flutter run
```

Os dados de exemplo criam um usuário para cada perfil (por exemplo, `admin.matech`), com a senha `matech123` no ambiente local.

Mais detalhes em [`swm_ervateira/README.md`](swm_ervateira/README.md), [`matech_app/README.md`](matech_app/README.md) e [`docs/rodar-o-app.md`](docs/rodar-o-app.md).

## Testes

```bash
cd swm_ervateira && npm test     # API e web (node:test)
cd matech_app && flutter test    # aplicativo
```

Os testes cobrem o cálculo de peso e valor, as faixas de peso e preço, a validação de CPF e CNPJ, as permissões de cada perfil, a numeração de tickets e ordens, a paginação e a fila de sincronização do aplicativo.

## Autor

**João Pedro Ortolan Pereira**
Engenharia de Software · Centro Universitário Campo Real

Orientadora: Prof.ª Isabela Taques Vitek
