// ---------------------------------------------------------------------------
// TESTE · identificadores
// ---------------------------------------------------------------------------
// O clientId é a chave de idempotência do trabalho inteiro: é ele que impede
// o reenvio de duplicar um registro no servidor, porque a coluna é @unique no
// PostgreSQL.
//
// Duas propriedades precisam valer, e as duas são testáveis aqui:
//   1. o formato tem que ser UUID v4 — o servidor grava numa coluna que espera
//      isso, e o nome do arquivo de foto é derivado dele;
//   2. dois identificadores nunca podem coincidir — uma colisão faria o
//      servidor tratar duas avaliações diferentes como reenvio da mesma, e uma
//      delas simplesmente sumiria.

import 'package:flutter_test/flutter_test.dart';
import 'package:matech_app/servicos/identificadores.dart';

final _formatoUuidV4 = RegExp(
  r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
);

void main() {
  group('novoClientId', () {
    test('tem o formato canônico de UUID versão 4', () {
      for (var i = 0; i < 200; i++) {
        final id = novoClientId();
        expect(
          _formatoUuidV4.hasMatch(id),
          isTrue,
          reason: '"$id" não está no formato 8-4-4-4-12 com versão 4',
        );
      }
    });

    test('não repete em dez mil gerações', () {
      final vistos = <String>{};
      for (var i = 0; i < 10000; i++) {
        expect(
          vistos.add(novoClientId()),
          isTrue,
          reason:
              'houve colisão — duas avaliações diferentes seriam '
              'tratadas como reenvio da mesma',
        );
      }
    });

    test('o nome de arquivo derivado é seguro', () {
      // O clientId vira nome de arquivo de foto e cabeçalho HTTP. Nenhum
      // caractere fora de [a-f0-9-] pode aparecer, senão o servidor o
      // higienizaria e o nome deixaria de casar com o registro.
      for (var i = 0; i < 100; i++) {
        expect(novoClientId(), matches(RegExp(r'^[a-f0-9-]+$')));
      }
    });
  });

  group('novoDispositivoId', () {
    test('começa com android- e é estável no formato', () {
      final id = novoDispositivoId();
      expect(id, startsWith('android-'));
      expect(id.length, greaterThan(10));
    });

    test('dois aparelhos não recebem o mesmo identificador', () {
      final vistos = <String>{};
      for (var i = 0; i < 1000; i++) {
        expect(vistos.add(novoDispositivoId()), isTrue);
      }
    });
  });
}
