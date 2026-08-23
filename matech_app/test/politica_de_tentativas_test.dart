// ---------------------------------------------------------------------------
// TESTE · política de tentativas
// ---------------------------------------------------------------------------
// Cobre a linha "Unitários" do Quadro 8 do artigo, do lado do aplicativo.
//
// Estes testes rodam com `flutter test`, sem emulador, sem banco e sem
// servidor — o que só é possível porque a política é pura. É o mesmo argumento
// que vale para o calcularPagamento na API: regra isolada é regra testável.
//
// E o que eles cobrem não é decoração. A escada de espera é o tipo de código
// que erra em silêncio: um clamp trocado faria o aplicativo tentar de dez em
// dez segundos o dia inteiro, matando a bateria, e nada acusaria — a
// sincronização continuaria "funcionando".

import 'package:flutter_test/flutter_test.dart';
import 'package:matech_app/config.dart';
import 'package:matech_app/servicos/politica_de_tentativas.dart';

void main() {
  group('esperaPara · falha de rede', () {
    test('a primeira falha usa o primeiro degrau', () {
      expect(
        PoliticaDeTentativas.esperaPara(1),
        Config.esperaEntreTentativas.first,
      );
    });

    test('a espera cresce a cada falha', () {
      var anterior = Duration.zero;
      for (
        var tentativa = 1;
        tentativa <= Config.esperaEntreTentativas.length;
        tentativa++
      ) {
        final atual = PoliticaDeTentativas.esperaPara(tentativa);
        expect(
          atual,
          greaterThan(anterior),
          reason: 'a tentativa $tentativa deveria esperar mais que a anterior',
        );
        anterior = atual;
      }
    });

    test('para de crescer no último degrau', () {
      final ultimo = Config.esperaEntreTentativas.last;
      expect(PoliticaDeTentativas.esperaPara(99), ultimo);
      expect(PoliticaDeTentativas.esperaPara(1000), ultimo);
    });

    test('tentativa zero ou negativa não estoura', () {
      // Não deveria acontecer, mas um erro de contagem em outro lugar não pode
      // virar RangeError no meio de uma sincronização em campo.
      expect(
        PoliticaDeTentativas.esperaPara(0),
        Config.esperaEntreTentativas.first,
      );
      expect(
        PoliticaDeTentativas.esperaPara(-5),
        Config.esperaEntreTentativas.first,
      );
    });
  });

  group('esperaDeDependencia · chegou fora de ordem', () {
    test('as primeiras rodadas são baratas', () {
      for (
        var rodada = 1;
        rodada <= PoliticaDeTentativas.rodadasBaratas;
        rodada++
      ) {
        expect(
          PoliticaDeTentativas.esperaDeDependencia(rodada),
          PoliticaDeTentativas.esperaBarata,
          reason:
              'chegar fora de ordem é normal e a rodada $rodada '
              'ainda não deveria escalonar',
        );
      }
    });

    test('depois das baratas, passa a escalonar', () {
      final primeiraCara = PoliticaDeTentativas.esperaDeDependencia(
        PoliticaDeTentativas.rodadasBaratas + 1,
      );
      expect(primeiraCara, greaterThan(PoliticaDeTentativas.esperaBarata));
    });

    test('a espera de dependência nunca diminui', () {
      var anterior = Duration.zero;
      for (
        var rodada = 1;
        rodada <= PoliticaDeTentativas.rodadasDeDependencia;
        rodada++
      ) {
        final atual = PoliticaDeTentativas.esperaDeDependencia(rodada);
        expect(atual, greaterThanOrEqualTo(anterior));
        anterior = atual;
      }
    });
  });

  group('desistirDaDependencia', () {
    test('não desiste antes do limite', () {
      for (
        var rodada = 0;
        rodada < PoliticaDeTentativas.rodadasDeDependencia;
        rodada++
      ) {
        expect(PoliticaDeTentativas.desistirDaDependencia(rodada), isFalse);
      }
    });

    test('desiste no limite e depois dele', () {
      expect(
        PoliticaDeTentativas.desistirDaDependencia(
          PoliticaDeTentativas.rodadasDeDependencia,
        ),
        isTrue,
      );
      expect(PoliticaDeTentativas.desistirDaDependencia(999), isTrue);
    });

    test('o limite é maior que as rodadas baratas', () {
      // Se fosse menor, o aplicativo desistiria antes mesmo de escalonar uma
      // vez — e uma avaliação que chegou vinte segundos adiantada viraria erro.
      expect(
        PoliticaDeTentativas.rodadasDeDependencia,
        greaterThan(PoliticaDeTentativas.rodadasBaratas),
      );
    });
  });

  group('a escada configurada', () {
    test('não está vazia', () {
      expect(Config.esperaEntreTentativas, isNotEmpty);
    });

    test('está em ordem crescente', () {
      for (var i = 1; i < Config.esperaEntreTentativas.length; i++) {
        expect(
          Config.esperaEntreTentativas[i],
          greaterThan(Config.esperaEntreTentativas[i - 1]),
          reason: 'o degrau $i está fora de ordem — a escada precisa subir',
        );
      }
    });

    test('o lote cabe no teto de 200 que o servidor aceita', () {
      expect(Config.tamanhoDoLote, greaterThan(0));
      expect(Config.tamanhoDoLote, lessThanOrEqualTo(200));
    });
  });
}
