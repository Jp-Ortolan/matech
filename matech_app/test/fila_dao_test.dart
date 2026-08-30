// ---------------------------------------------------------------------------
// TESTES · o payload congelado da fila aprende o id do pai
// ---------------------------------------------------------------------------
// O CASO QUE ESTES TESTES GUARDAM, contado por inteiro:
//
// O avaliador cadastra o produtor João em campo, sem sinal. O aparelho gera um
// clientId para ele — digamos "A" — e enfileira, na mesma transação, o produtor
// e o erval. O payload do erval é fechado (jsonEncode) naquele instante, quando
// o produtor ainda não tem id de servidor: sai com produtorClientId "A" e
// produtorId nulo.
//
// Só que o João já estava cadastrado. Outro avaliador, em outro celular, subiu
// o mesmo produtor semana passada com o clientId "B". O servidor reconhece o
// CPF, responde DUPLICADO e devolve o id do cadastro que já existia lá.
//
// Sem o que se testa aqui, o erval fica procurando para sempre um clientId "A"
// que o servidor nunca viu: DEPENDENCIA_PENDENTE em toda rodada, até desistir —
// e a avaliação, que depende do erval, desiste junto. O avaliador vê "2
// recusadas" e não tem o que fazer.

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:matech_app/dados/fila_dao.dart';

void main() {
  // O payload do erval como ele nasce: sabe o clientId do dono, não sabe o id.
  String ervalNaFila({String? produtorId, String produtorClientId = 'A'}) =>
      jsonEncode({
        'produtorId': produtorId,
        'produtorClientId': produtorClientId,
        'identificacao': 'Talhão do fundo',
        'quantidadeEstimadaKg': 7000.0,
      });

  group('payloadApontandoPai', () {
    test('grava o id do servidor quando o pai é este', () {
      final corrigido = payloadApontandoPai(
        ervalNaFila(),
        campoClientId: 'produtorClientId',
        campoId: 'produtorId',
        clientIdDoPai: 'A',
        idDoPai: 'id-do-servidor',
      );

      expect(corrigido, isNotNull);
      final p = jsonDecode(corrigido!) as Map<String, dynamic>;
      expect(p['produtorId'], 'id-do-servidor');
    });

    test('NÃO PERDE NENHUM OUTRO CAMPO no caminho', () {
      // Este é o teste que justifica decodificar e recodificar em vez de mexer
      // no texto do JSON. Perder a quantidade estimada aqui seria perder o dado
      // que a avaliação inteira existe para registrar.
      final corrigido = payloadApontandoPai(
        ervalNaFila(),
        campoClientId: 'produtorClientId',
        campoId: 'produtorId',
        clientIdDoPai: 'A',
        idDoPai: 'id-do-servidor',
      )!;

      final p = jsonDecode(corrigido) as Map<String, dynamic>;
      expect(p['identificacao'], 'Talhão do fundo');
      expect(p['quantidadeEstimadaKg'], 7000.0);
      // O clientId do pai CONTINUA lá de propósito: ele é o histórico de como
      // o dado nasceu, e o servidor tenta o id primeiro de qualquer jeito.
      expect(p['produtorClientId'], 'A');
    });

    test('não toca no erval de outro produtor', () {
      final intacto = payloadApontandoPai(
        ervalNaFila(produtorClientId: 'OUTRO'),
        campoClientId: 'produtorClientId',
        campoId: 'produtorId',
        clientIdDoPai: 'A',
        idDoPai: 'id-do-servidor',
      );
      expect(intacto, isNull);
    });

    test('não gasta escrita quando o id já é o que seria gravado', () {
      final semMudanca = payloadApontandoPai(
        ervalNaFila(produtorId: 'id-do-servidor'),
        campoClientId: 'produtorClientId',
        campoId: 'produtorId',
        clientIdDoPai: 'A',
        idDoPai: 'id-do-servidor',
      );
      expect(semMudanca, isNull);
    });

    test('SUBSTITUI um id antigo que não vale mais', () {
      // Acontece quando o servidor foi restaurado de um backup e devolveu um id
      // diferente para o mesmo clientId. O que vale é a resposta de agora.
      final corrigido = payloadApontandoPai(
        ervalNaFila(produtorId: 'id-antigo'),
        campoClientId: 'produtorClientId',
        campoId: 'produtorId',
        clientIdDoPai: 'A',
        idDoPai: 'id-novo',
      );
      expect(jsonDecode(corrigido!)['produtorId'], 'id-novo');
    });

    test('serve para a avaliação e o erval com os mesmos parâmetros', () {
      final avaliacao = jsonEncode({
        'ervalId': null,
        'ervalClientId': 'E1',
        'classificacao': 'BOA',
      });

      final corrigido = payloadApontandoPai(
        avaliacao,
        campoClientId: 'ervalClientId',
        campoId: 'ervalId',
        clientIdDoPai: 'E1',
        idDoPai: 'id-do-erval',
      );
      expect(jsonDecode(corrigido!)['ervalId'], 'id-do-erval');
    });

    test('payload ilegível não derruba a passada de sincronização', () {
      // Reescrever aqui só esconderia a causa: a operação falha sozinha no
      // envio, com a mensagem certa na tela de sincronização.
      final resultado = payloadApontandoPai(
        'isto não é json',
        campoClientId: 'produtorClientId',
        campoId: 'produtorId',
        clientIdDoPai: 'A',
        idDoPai: 'id-do-servidor',
      );
      expect(resultado, isNull);
    });
  });
}
