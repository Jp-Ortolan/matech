# MATECH · aplicativo móvel

Coleta de avaliações de erva-mate **no erval, sem conexão**, com sincronização
posterior contra a API do MATECH.

O escopo é estreito de propósito: **login, produtores e avaliação em campo**.
Não há pesagem, análise de laboratório nem pagamento — essas telas são da web,
e reproduzi-las aqui seria manter duas versões do mesmo sistema. A balança fica
no pátio, onde há computador e internet.

---

## 1. Antes de rodar pela primeira vez

O projeto está com o código, mas **sem as pastas de plataforma** (`android/`,
`ios/`). Elas são geradas pelo próprio Flutter:

```powershell
cd "C:\Users\joaop\Documents\Faculdade 2026\Tcc\desenvolvimento\matech_app"
flutter create . --platforms=android --org br.com.matech
flutter pub get
```

O `flutter create .` numa pasta que já tem `lib/` e `pubspec.yaml` **não
sobrescreve** o que existe: ele só acrescenta o que falta.

### Permissões do Android

Depois do `flutter create`, abra
`android/app/src/main/AndroidManifest.xml` e acrescente, **antes** da tag
`<application>`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.CAMERA" />
```

E, **só para desenvolvimento**, adicione na tag `<application>`:

```xml
android:usesCleartextTraffic="true"
```

Sem isso o Android bloqueia HTTP sem TLS e o login falha com erro de rede — a
API local roda em `http://`, não em `https://`. Em produção isso sai e a API
passa a ter certificado.

---

## 2. Apontar para a API

O endereço padrão é `http://10.0.2.2:3000`, que é o apelido que o **emulador do
Android** dá para o `localhost` da máquina que o hospeda. Dentro do emulador,
`127.0.0.1` seria o próprio emulador.

**Em aparelho físico**, use o IP do notebook na rede local e suba a API
escutando em todas as interfaces:

```powershell
flutter run --dart-define=MATECH_API=http://192.168.0.42:3000
```

Descubra o IP com `ipconfig`. O celular e o notebook precisam estar no mesmo
Wi-Fi.

---

## 3. Rodar

```powershell
# terminal 1 — a API
cd "..\swm_ervateira"
npm run dev

# terminal 2 — o aplicativo
cd "..\matech_app"
flutter run
```

Entre com **`marcos.ferrari`** / **`matech123`** — é o perfil
`COMPRADOR_AVALIADOR`, o único (junto do administrativo) que a rota
`POST /api/sincronizacao` aceita.

---

## 4. Como o código está organizado

```
lib/
├── main.dart          sobe o app e decide: login ou início
├── config.dart        endereço da API, tamanho do lote, espera entre tentativas
│
├── modelos/           as classes de dados, com paraLinha/deLinha (SQLite)
│                      e paraPayload (o que vai para a API)
│
├── dados/             um DAO por tabela, sobre o banco_local.dart
│   ├── banco_local.dart    as 7 tabelas do SQLite
│   ├── fila_dao.dart       a fila de sincronização (padrão Outbox)
│   └── ...
│
├── servicos/
│   ├── api.dart                    ÚNICO arquivo que fala com a rede
│   ├── sessao.dart                 quem está logado
│   ├── sincronizador.dart          a fila indo para o servidor
│   ├── politica_de_tentativas.dart quando insistir e quando desistir (puro)
│   ├── token.dart                  leitura do exp do JWT (puro)
│   ├── localizacao.dart            GPS, com falhas nomeadas
│   ├── captura_de_fotos.dart       câmera e galeria, com falhas nomeadas
│   └── arquivos.dart               onde as fotos ficam no aparelho
│
├── test/                   testes unitários — rodam sem emulador
│
├── telas/             login · preparo · início · produtores (+cadastro) ·
│                      avaliações (lista, formulário, detalhe, edição) ·
│                      sincronização
└── widgets/           tema da marca e peças reaproveitadas
```

### A regra que sustenta o offline

**Nenhuma tela chama a API.** A tela grava no SQLite; o sincronizador, depois,
lê a fila e conversa com o servidor. É por isso que o aplicativo se comporta
igual com e sem sinal — se uma tela consultasse a rede direto, ela ficaria em
branco no erval, e o avaliador não saberia dizer se o produtor não existe ou se
foi o sinal que caiu.

A única exceção é o **login**, e não há como ser diferente: a senha é conferida
contra o hash que está no PostgreSQL.

---

## 5. As três garantias da sincronização

| Garantia | Onde mora |
|---|---|
| **Não duplicar** | `clientId` gerado no aparelho (`servicos/identificadores.dart`), `@unique` no PostgreSQL. Reenviar o mesmo pacote devolve `DUPLICADO`, não cria outro registro. |
| **Não perder** | Dado e fila gravados na **mesma transação** do SQLite. Nada sai da fila sem confirmação nominal do servidor para aquele `clientId`. |
| **Não se contradizer** | `alteradoEmOrigem` é o relógio do **aparelho**, não o de chegada. Uma correção feita às 15h30 sem sinal ganha de um envio que saiu antes e chegou depois. |

### Quando a sincronização acontece

"Quando existir conexão, tentar sincronizar" — e a pergunta é como saber que
existe conexão. A resposta deste aplicativo é **não se pergunta, se tenta**:
detectar Wi-Fi não é detectar servidor, e um celular ligado a um roteador sem
internet responde "tenho conexão" e falha do mesmo jeito. O fracasso de uma
tentativa real é a única informação confiável sobre a rede — e é de graça,
porque já estávamos tentando.

São quatro gatilhos, nenhum deles um detector de rede:

| Gatilho | Quando |
|---|---|
| **Ao salvar** | logo depois de gravar um produtor ou uma avaliação |
| **Ao voltar ao primeiro plano** | `AppLifecycleListener` no `main.dart`. É o caminho real: o avaliador volta para a estrada, o celular pega sinal e ele abre o aplicativo |
| **Despertador** | um `Timer` marcado para a hora da próxima operação que vence, segundo a escada do `Config` |
| **Manual** | o botão "Sincronizar agora" e o puxar-para-baixo nas listas |

O despertador é **um Timer só**, sempre remarcado para a próxima operação que
vence — e não um laço de "tenta a cada X segundos". Com o aparelho no bolso e
nada vencendo, este aplicativo não acorda. Um aplicativo que desperta de dez em
dez minutos sem ter o que fazer chega ao fim da tarde com a bateria no fim, e
aí não há coleta nenhuma para sincronizar.

Duas travas impedem laço apertado:

- **falha de rede** empurra tudo que estava pronto trinta segundos para frente,
  para o despertador não acordar em cinco segundos e bater na mesma porta;
- **401 (sessão vencida)** desliga o despertador até alguém agir — insistir sem
  token é gastar bateria colecionando 401.

### A ordem importa

Uma avaliação depende de um erval, que depende de um produtor — e nenhum dos
três tem id de servidor quando nasce. A coluna `sequencia` da fila é
`AUTOINCREMENT` justamente para garantir o FIFO: ordenar por data de criação
empataria, porque os três nascem no mesmo segundo.

Quando algo chega fora de ordem, o servidor responde `DEPENDENCIA_PENDENTE`.
Isso **não é erro**: as três primeiras rodadas custam vinte segundos, sem
escalonar. Melhor ainda: quando um pai é aceito, os dependentes são liberados
na hora, de modo que produtor, área e avaliação sobem na **mesma passada** em
vez de exigirem três.

A partir da quarta rodada a espera passa a crescer, e depois de dez o
aplicativo desiste e mostra o caso. Isso cobre um caso real: se o produtor de
uma avaliação foi *recusado* pelo servidor (CPF duplicado, por exemplo), ele
nunca vai chegar lá — e sem esse limite a avaliação filha pediria por ele a
cada vinte segundos, para sempre.

---

## 6. Localização e fotos

### Onde os arquivos ficam, e como se ligam à avaliação

A câmera entrega o arquivo num diretório de **cache** — a primeira coisa que o
Android apaga quando o armazenamento aperta, que é exatamente o que acontece no
aparelho de quem passa o dia fotografando. Por isso a foto é copiada, no ato da
captura, para o diretório privado do aplicativo:

```
<diretório do app>/fotos/<clientId>.jpg
```

O **nome do arquivo é o `clientId`**, e é ele que amarra tudo. O mesmo
identificador aparece em quatro lugares:

| Onde | O quê |
|---|---|
| disco | `fotos/<clientId>.jpg` |
| tabela `fotos` | `client_id`, com `avaliacao_client_id` apontando para a dona |
| tabela `fila_sincronizacao` | uma linha com `entidade = 'FotoErval'` |
| upload | cabeçalho `x-client-id`, a chave de idempotência no servidor |

Como é um UUID, dois envios nunca disputam o mesmo arquivo e reenviar não cria
uma segunda cópia no servidor.

### Rascunho, e a limpeza dele

Entre tirar a foto e salvar a avaliação, os arquivos são **rascunho**: existem
em disco sem nenhuma linha no banco apontando para eles. Três coisas cuidam
disso:

- descartar uma foto no formulário apaga o arquivo na hora;
- sair do formulário sem salvar apaga o que foi copiado;
- na subida do aplicativo, uma varredura recolhe o que sobrou de sessões
  anteriores — apagando **apenas** arquivos sem linha no banco. A regra é
  conservadora de propósito: perder uma foto de avaliação é irreversível, e o
  custo de manter é alguns megabytes.

Depois de salva, a foto é prova do que foi visto no erval e o aplicativo não a
apaga — nem depois de sincronizar.

### Nada é enviado offline

O envio acontece **só** dentro do sincronizador, e só quando ele consegue falar
com o servidor. O formulário nunca toca a rede. A ordem também é fixa: os lotes
de dados primeiro, as fotos depois — mandar as fotos antes garantiria uma rodada
inteira de 409 (`DEPENDENCIA_PENDENTE`) e um gasto de dados que a zona rural não
perdoa.

Cada foto viaja sozinha, em corpo binário puro (`express.raw` do outro lado).
Se a terceira falhar, a avaliação e as duas primeiras já estão no servidor — se
viajassem juntas, a mesma falha derrubaria tudo.

### O que acontece quando dá errado

| Falha | Tratamento |
|---|---|
| **Permissão negada** | mensagem explicando o que se perde; dá para salvar assim mesmo |
| **Permissão bloqueada** | diálogo com atalho para as configurações — pedir de novo não abriria mais o sistema |
| **GPS desligado** | atalho para as configurações de *localização* (tela diferente da de permissões) |
| **GPS não fecha posição** | recorre à última posição conhecida, se tiver menos de 30 min, marcada como **aproximada** |
| **Câmera indisponível** | avisa e sugere a galeria |
| **Sem espaço** | as fotos já copiadas são mantidas; só a que faltou é reportada |
| **Arquivo ausente ao salvar** | a foto fica de fora, a avaliação é gravada, e o avaliador é avisado enquanto ainda dá para refazer |
| **Arquivo ausente ao enviar** | a fila para de tentar e a linha da foto é marcada — mas **não é apagada**: ela é a prova de que aquela avaliação teve uma foto |
| **Falha no upload (4xx)** | fica em "Recusada", visível, com botão de tentar de novo |
| **Perda de conexão no meio** | a foto volta para a fila com espera crescente; o que já subiu está confirmado nominalmente e não é reenviado |

A decisão de produto que atravessa a tabela inteira: **nenhuma falha de GPS ou
de foto impede salvar a avaliação**. Uma permissão negada não pode custar o
registro de que a erva foi vista — porque a alternativa do avaliador é o papel.

---

## 7. Preparo para o campo

O Android pede permissão **no momento do uso**. Sem tratamento, o avaliador só
veria os diálogos de câmera e GPS já dentro do erval, na frente do produtor — e
se negasse ali, por pressa ou engano, perderia a foto e a coordenada daquela
avaliação.

A tela de preparo aparece uma vez, logo depois do primeiro login, e faz os três
passos que precisam de internet e de calma: pede a localização, pede a câmera e
baixa os produtores. Fica acessível depois pelo menu da conta, porque baixar os
produtores é rotina de todo dia em que se sai a campo, não passo de instalação.

Nada nela é obrigatório — quem pular tem o comportamento antigo, com as
permissões pedidas no momento do uso.

---

## 8. Editar uma avaliação, e a resolução de conflito

Esta é a tela que torna o diferencial do trabalho **demonstrável**. O mecanismo
de última escrita válida já existia no modelo, no DAO e no servidor, mas sem
uma tela de edição não havia como acioná-lo — e um mecanismo que ninguém
consegue disparar é indistinguível de um que não funciona.

Ao salvar uma edição:

1. `alteradoEmOrigem` é reescrito com o relógio **deste aparelho**, agora;
2. a linha é atualizada e `sincronizado_em` volta a ser nulo;
3. a operação é reenfileirada com o payload novo, **substituindo** o antigo — a
   fila usa o `clientId` como chave, então nunca sobe versão vencida;
4. no servidor, o applicator compara o `alteradoEmOrigem` que chegou com o que
   está gravado, e o mais recente vence, independente da ordem de chegada.

**O que não se edita:** produtor, área e data. Eles são a *identidade* do
registro, não atributos dele. Uma avaliação de outro produtor não é a mesma
avaliação corrigida — é outra, e deve nascer com `clientId` próprio.

### Demonstração do conflito, em dois minutos

1. Crie uma avaliação e sincronize. Confirme no Prisma Studio.
2. Ative o modo avião. Edite a quantidade no aplicativo — repare no carimbo
   de "alterada" mudando na tela de detalhe.
3. Ainda offline, altere a **mesma** avaliação direto no banco, pelo Prisma
   Studio, com um `alteradoEmOrigem` **anterior** ao do aparelho.
4. Desligue o modo avião e sincronize. Vence a versão do aparelho, e o
   `RegistroSincronizacao` fica com `houveConflito = true` e
   `versaoVencedora = 'dispositivo'`.
5. Repita invertendo: se o `alteradoEmOrigem` do servidor for mais recente, o
   servidor mantém a versão dele e registra `versaoVencedora = 'servidor'`.

O passo 5 é o que prova que não é "o último que chega ganha".

---

## 9. Como demonstrar isso para a banca

1. **Coletar sem conexão** — ative o modo avião, cadastre um produtor e faça
   uma avaliação com foto. Tudo é salvo; a aba Sincronização mostra a fila
   crescendo.
2. **Não duplicar** — desligue o modo avião e sincronize. Sincronize de novo:
   o contador não muda, porque o servidor devolve `DUPLICADO`. Confirme no
   Prisma Studio que existe **um** registro.
3. **A ordem funcionando** — colete produtor + avaliação offline e observe, na
   fila, o produtor subindo antes.
4. **As duas contas batendo** — compare a taxa da aba Sincronização com o que
   `GET /api/sincronizacao/resumo?dispositivoId=...` devolve. Bater é a melhor
   evidência de que a sincronização está correta.

---

## 10. Dependências, e por que cada uma

| Pacote | Por quê |
|---|---|
| `sqflite` | o banco local — é o que sustenta o funcionamento sem conexão |
| `path` | monta o caminho do arquivo do banco |
| `http` | fala com a API REST |
| `image_picker` | abre a câmera |
| `geolocator` | lê o GPS |

**O que ficou de fora, de propósito:** `provider`/`riverpod`/`bloc` (em seis
telas o `ChangeNotifier` que já vem no Flutter resolve), `uuid` (são vinte
linhas de `dart:math` em `servicos/identificadores.dart`), `connectivity_plus`
(detectar Wi-Fi não é detectar servidor — a fila simplesmente tenta e reagenda
quando falha, o que é mais confiável e uma dependência a menos),
`path_provider` (o `sqflite` já sabe onde fica o diretório privado do
aplicativo) e `dio` (o `http` do próprio time do Dart dá conta).

---

## 11. Verificar antes de apresentar

Dois comandos, nesta ordem, na pasta do aplicativo:

```powershell
flutter analyze   # erros de compilação e de estilo
flutter test      # os testes de test/
```

### Os testes

Rodam **sem emulador, sem banco e sem servidor** — o que só é possível porque
cobrem lógica pura. É o mesmo argumento que vale para o `calcularPagamento` na
API: regra isolada é regra testável.

| Arquivo | O que garante |
|---|---|
| `politica_de_tentativas_test.dart` | a escada de espera sobe, para de subir no último degrau e não estoura com contagem errada; a dependência custa pouco nas primeiras rodadas e desiste no limite |
| `token_test.dart` | o `exp` do JWT (em **segundos**) vira `DateTime` (em milissegundos) corretamente; token ilegível não desloga ninguém |
| `identificadores_test.dart` | o `clientId` tem formato UUID v4 e não colide em dez mil gerações |

Não são decoração. A escada de espera é o tipo de código que erra em silêncio:
um `clamp` trocado faria o aplicativo tentar de dez em dez segundos o dia
inteiro, matando a bateria — e a sincronização continuaria "funcionando".
E esquecer o fator mil no `exp` faria toda sessão parecer vencida desde 1970,
pedindo login a cada abertura, inclusive no erval, onde não há sinal para isso.

Do lado da API, `npm test` cobre o cálculo de pagamento e a numeração
sequencial sob concorrência — 20 testes.

---

## 12. Ponto sensível de versão

O código usa `DropdownButtonFormField(initialValue: ...)`, que substituiu o
antigo `value:` no Flutter 3.35. Se o `flutter analyze` reclamar de
`initialValue`, seu Flutter é anterior — troque por `value:` nos três lugares
(`produtor_form.dart` e `avaliacao_form.dart`) ou atualize o SDK.

Rode sempre `flutter analyze` antes de apresentar.

---

## 13. O que ainda não existe

- **Apagar uma avaliação.** Deliberado: o aplicativo não apaga registro de
  campo. Uma avaliação errada é corrigida pela edição, que deixa rastro.
- **Testes de widget e de integração.** Os unitários existem (seção 11); falta
  exercitar as telas e a sincronização ponta a ponta contra a API de verdade.
- **Sincronização com o aplicativo fechado.** Os quatro gatilhos acima cobrem
  o aplicativo aberto ou em segundo plano. Subir com o aplicativo encerrado
  exigiria `workmanager` ou equivalente — uma dependência com configuração
  nativa dos dois lados, que não se paga no escopo deste trabalho.
- **Testes de widget.**
