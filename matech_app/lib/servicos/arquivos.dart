// ---------------------------------------------------------------------------
// SERVIÇO · onde a foto do erval fica guardada
// ---------------------------------------------------------------------------
// UMA PORTA, DUAS IMPLEMENTAÇÕES.
//
// No aparelho a foto é um ARQUIVO no diretório privado do aplicativo. No
// navegador não existe diretório privado nem arquivo: a foto é uma linha de
// bytes no banco local, que no fim é o IndexedDB.
//
// A escolha acontece em tempo de COMPILAÇÃO, na linha de export abaixo. Isso
// importa por um motivo prático: `dart:io` não compila para web — é erro de
// build, não de execução. Um `if (kIsWeb)` dentro de um arquivo que importa
// `dart:io` não salvaria nada, porque o import já teria quebrado a compilação
// antes de qualquer verificação rodar.
//
// O QUE AS DUAS PROMETEM, e é só isso que as telas conhecem:
//
//   guardarFoto   recebe a imagem escolhida e devolve um LOCALIZADOR
//   lerFoto       devolve os bytes daquele localizador, ou nulo
//   apagarFoto    descarta
//   dimensoes     largura e altura, para o cabeçalho do upload
//   limparOrfas   varredura do que ficou sem dono
//
// LOCALIZADOR, e não "caminho": no aparelho ele é um caminho de arquivo mesmo;
// no navegador é a chave da linha. As telas nunca abrem esse valor — passam
// adiante para lerFoto. O nome da coluna no banco continua `caminho_local`
// para não migrar o esquema por causa de uma palavra.
//
// O clientId é o localizador nos dois casos, e isso não é conveniência: é o
// mesmo identificador que aparece no nome do arquivo, na coluna client_id da
// tabela fotos e no cabeçalho x-client-id do upload, servindo de chave de
// idempotência no servidor.

export 'arquivos_erros.dart';
export 'arquivos_io.dart' if (dart.library.js_interop) 'arquivos_web.dart';
