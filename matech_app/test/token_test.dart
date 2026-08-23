// ---------------------------------------------------------------------------
// TESTE · leitura do JWT
// ---------------------------------------------------------------------------
// A conversão de "exp" (segundos) para DateTime (milissegundos) é o tipo de
// erro que passa despercebido: esquecer o fator mil faz toda sessão parecer
// vencida desde 1970, e o aplicativo pede login a cada abertura — inclusive
// no meio do erval, onde não há sinal para fazer login.
//
// Os tokens aqui são montados na hora, com assinatura falsa. Não há problema:
// este código NÃO valida assinatura, e não deve mesmo — quem valida é o
// servidor. Aqui só se lê o corpo, que num JWT vai aberto.

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:matech_app/servicos/token.dart';

/// Monta um JWT com o "exp" pedido. A assinatura é literalmente a palavra
/// "falsa" — este código nunca a confere.
String tokenCom(Map<String, dynamic> corpo) {
  String parte(Map<String, dynamic> m) =>
      base64Url.encode(utf8.encode(jsonEncode(m))).replaceAll('=', '');
  return '${parte({'alg': 'HS256', 'typ': 'JWT'})}.${parte(corpo)}.falsa';
}

void main() {
  group('expiraEm', () {
    test('lê o exp em segundos e devolve a data certa', () {
      final alvo = DateTime.now().add(const Duration(hours: 8));
      final token = tokenCom({'exp': alvo.millisecondsSinceEpoch ~/ 1000});

      final lido = Token.expiraEm(token);

      expect(lido, isNotNull);
      // Um segundo de tolerância: o exp do JWT não tem milissegundos.
      expect(lido!.difference(alvo).inSeconds.abs(), lessThanOrEqualTo(1));
    });

    test('um token de 8 horas não vence agora', () {
      final token = tokenCom({
        'exp':
            DateTime.now()
                .add(const Duration(hours: 8))
                .millisecondsSinceEpoch ~/
            1000,
      });
      expect(Token.venceu(token), isFalse);
    });

    test('um token vencido é reconhecido como vencido', () {
      final token = tokenCom({
        'exp':
            DateTime.now()
                .subtract(const Duration(minutes: 1))
                .millisecondsSinceEpoch ~/
            1000,
      });
      expect(Token.venceu(token), isTrue);
    });
  });

  group('tokens que não dá para ler', () {
    // Todos devolvem null em vez de lançar. A autoridade sobre a validade é do
    // servidor: um token que o aplicativo não entende não pode impedir o login.
    test('texto que não é JWT', () {
      expect(Token.expiraEm('isto-nao-e-um-token'), isNull);
      expect(Token.expiraEm(''), isNull);
      expect(Token.expiraEm('so.duas'), isNull);
    });

    test('corpo que não é base64 válido', () {
      expect(Token.expiraEm('abc.!!!!!.def'), isNull);
    });

    test('corpo sem o campo exp', () {
      expect(Token.expiraEm(tokenCom({'sub': 'alguem'})), isNull);
    });

    test('exp que não é número', () {
      expect(Token.expiraEm(tokenCom({'exp': 'amanhã'})), isNull);
    });

    test('venceu() é falso quando não dá para saber', () {
      // Importante: na dúvida, NÃO trata como vencido. Deslogar alguém por
      // causa de um token ilegível seria pior que deixar o servidor recusar.
      expect(Token.venceu('lixo'), isFalse);
    });
  });
}
