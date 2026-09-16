# MATECH — rodar o aplicativo na apresentação

Escrito em 01/09/2026, para a apresentação de 02/09.

> **Faça a primeira execução HOJE, não amanhã.** A primeira vez que o
> `flutter run` roda contra um emulador novo, o Gradle compila o projeto
> Android inteiro — costuma levar de 3 a 10 minutos. Depois disso fica rápido.
> Descobrir isso com a sala esperando é o pior momento possível.

---

## Ordem de tudo, no dia

1. Subir o **PostgreSQL** (ele já sobe com o Windows, normalmente).
2. Subir a **API**: na pasta `swm_ervateira`, `npm run dev`. Confira em
   `http://localhost:3000/health`.
3. Subir a **web**: na pasta `swm_ervateira/web`, `npm run dev`. Abre em
   `http://localhost:5173`.
4. Subir o **emulador** e o aplicativo (abaixo).

A API precisa estar de pé antes do aplicativo — o login é a única operação do
app que exige rede, e é a primeira coisa que ele faz.

---

## Emulador Android — o caminho principal

### Ver o que existe na máquina

```
flutter devices
flutter emulators
```

O segundo lista os AVDs criados. Se a lista vier vazia, você ainda não tem
emulador: abra o Android Studio → **Device Manager** → **Create device**.
Um Pixel com uma imagem recente serve; não precisa de Play Store.

### Subir

```
flutter emulators --launch <id_do_emulador>
```

O `<id>` é o que apareceu na primeira coluna do `flutter emulators`.
Espere a tela inicial do Android aparecer antes do próximo passo.

### Rodar o aplicativo

Na pasta `matech_app`:

```
flutter run --release
```

`--release` de propósito: tira a faixa vermelha de DEBUG do canto e o
aplicativo fica visivelmente mais fluido na projeção. Você perde o hot reload,
que numa apresentação não faz falta.

### O endereço do servidor

**Não mexa em nada.** O padrão do aplicativo no Android já é
`http://10.0.2.2:3000`.

`10.0.2.2` é o apelido que o emulador dá para o `localhost` da máquina que o
hospeda — dentro do emulador, `127.0.0.1` seria o próprio emulador. Como é
tráfego de loopback, ele não passa pelo Wi-Fi nem pelo firewall do Windows.

Se por algum motivo o endereço estiver errado (você digitou outro numa sessão
anterior — o app grava o que foi digitado), a tela de login tem o campo do
endereço do servidor. Coloque `http://10.0.2.2:3000` e siga.

---

## Plano B — o aplicativo no navegador

Se o emulador não cooperar, o mesmo aplicativo roda em Chrome. É o caminho mais
confiável para projetar, porque não depende do SDK do Android.

Uma vez só, na pasta `matech_app`:

```
flutter pub get
dart run sqflite_common_ffi_web:setup
```

O segundo comando é obrigatório e é o que todo mundo esquece: sem ele o banco
local não abre no navegador e o aplicativo trava na primeira tela que consulta
alguma coisa.

Depois:

```
flutter run -d chrome --web-port=8080
```

A porta fixa importa: o Flutter sorteia uma porta a cada execução, e os dados
ficam gravados **por origem** — `localhost:1234` e `localhost:5678` são dois
bancos diferentes. Com `--web-port=8080` você mantém o mesmo banco entre
execuções.

No navegador o endereço padrão da API é `http://localhost:3000`, e também não
precisa mexer.

### O que muda no navegador, se perguntarem

| | Android | Navegador |
|---|---|---|
| Banco local | SQLite nativo | SQLite em WebAssembly, sobre IndexedDB |
| Foto | arquivo em disco | bytes numa tabela do banco local |
| Câmera | câmera do aparelho | seletor de arquivo |
| GPS | GPS do aparelho | localização do navegador (pede permissão) |

O esquema do banco, as consultas e a fila de sincronização são **os mesmos** nos
dois, e nenhum DAO sabe em qual está rodando. Isso é resposta de arguição, não
desculpa: é a camada de arquivos que troca, com
`export ... if (dart.library.js_interop)`, porque `dart:io` é erro de
**compilação** na web — `kIsWeb` não resolveria.

---

## Atualizar o APK no celular físico

Só vale a pena se você quiser mostrar o aparelho de verdade. Para projetar, o
emulador é melhor.

```
cd matech_app
flutter build apk --release
```

O arquivo sai em `build\app\outputs\flutter-apk\app-release.apk`.

Com o celular ligado por USB, com depuração USB ativada:

```
flutter install
```

### O endereço, no celular físico

Aqui `10.0.2.2` **não existe** — aquilo é coisa de emulador. No aparelho você
precisa do IP do seu PC na rede local. Descubra com:

```
ipconfig
```

Procure o **Endereço IPv4** do adaptador do Wi-Fi (algo como `192.168.0.42`).
Na tela de login do aplicativo, digite:

```
http://192.168.0.42:3000
```

Três coisas que costumam impedir isso de funcionar:

1. **Celular e PC precisam estar na mesma rede Wi-Fi.** Rede de faculdade
   costuma isolar os aparelhos entre si — se isolar, não há o que fazer pelo
   aplicativo.
2. **O firewall do Windows bloqueia a porta 3000 na primeira vez.** Quando o
   Node subir, o Windows pergunta se libera; se você já disse "não" alguma vez,
   precisa liberar em Firewall do Windows Defender → Permitir um aplicativo.
3. O IP muda quando o roteador entrega outro. Se parar de funcionar sem motivo,
   rode `ipconfig` de novo.

Alternativa sem rede nenhuma, com o cabo USB:

```
adb reverse tcp:3000 tcp:3000
```

Aí o endereço no aplicativo vira `http://localhost:3000`, e o tráfego vai pelo
cabo. Funciona mesmo com o Wi-Fi da faculdade isolando tudo.

---

## Checklist de cinco minutos antes

- [ ] PostgreSQL de pé
- [ ] API respondendo em `http://localhost:3000/health`
- [ ] Web abrindo em `http://localhost:5173`
- [ ] Emulador ligado e aplicativo aberto na tela de login
- [ ] Login feito no aplicativo **antes** da apresentação começar — o login é a
      única operação que exige rede, e é a que dá erro se algo estiver errado
- [ ] Janelas já posicionadas: web num monitor, emulador ao lado
