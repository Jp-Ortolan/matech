// ---------------------------------------------------------------------------
// IDENTIFICADORES · o clientId, gerado no aparelho
// ---------------------------------------------------------------------------
// Este arquivo é pequeno mas é o alicerce da sincronização.
//
// Cada registro criado neste aplicativo nasce com um UUID gerado AQUI, antes
// de qualquer conexão. É esse identificador que o servidor usa como chave de
// idempotência: reenviar o mesmo registro dez vezes cria um registro só,
// porque a gravação lá é um upsert em clientId, que é @unique no banco.
//
// A alternativa — deixar o servidor gerar o id — não funciona sem conexão:
// no erval não há servidor para perguntar, e a avaliação precisa existir e se
// relacionar com o produtor e o erval antes de qualquer um deles ter id.
//
// Vinte linhas de dart:math em vez do pacote uuid. A versão 4 do UUID é
// simplesmente 122 bits aleatórios com quatro bits de versão e dois de
// variante fixados — não é criptografia, é formatação.

import 'dart:math';

final Random _aleatorio = Random.secure();

/// Gera um UUID versão 4 no formato canônico 8-4-4-4-12.
String novoClientId() {
  final bytes = List<int>.generate(16, (_) => _aleatorio.nextInt(256));

  // Versão 4: os quatro bits altos do byte 6 viram 0100.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  // Variante RFC 4122: os dois bits altos do byte 8 viram 10.
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
      '${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

/// Identificador do aparelho: nasce uma vez e é guardado no banco local.
/// É o que permite ao servidor saber de qual celular veio cada operação —
/// e é por dispositivo que a taxa de sincronização do Quadro 7 é medida.
String novoDispositivoId() => 'android-${novoClientId().substring(0, 13)}';
