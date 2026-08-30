// ---------------------------------------------------------------------------
// TESTES · faixas plausíveis e leitura de número digitado
// ---------------------------------------------------------------------------
// O teste que mais importa aqui é o do separador: o validador e a gravação
// precisam ler o texto do mesmo jeito. Se divergirem, a tela aprova um número
// e o banco guarda outro — e a validação passa a dar uma impressão de conferência
// que não existe.

import 'package:flutter_test/flutter_test.dart';
import 'package:matech_app/servicos/faixas.dart';

void main() {
  group('numeroDigitado · convenção brasileira', () {
    test('vírgula é decimal', () {
      expect(numeroDigitado('4,85'), 4.85);
    });

    test('PONTO É MILHAR, e não decimal', () {
      // A trava principal deste arquivo. Se isto inverter, "70.000" passa a
      // valer setenta para quem valida e setenta mil para quem grava.
      expect(numeroDigitado('7.500'), 7500);
      expect(numeroDigitado('70.000'), 70000);
    });

    test('milhar e decimal juntos', () {
      expect(numeroDigitado('7.500,50'), 7500.5);
    });

    test('vazio é nulo, e não zero', () {
      // Campo opcional em branco não é "zero": é "não informado". Zero num
      // campo de preço geraria pagamento de R\$ 0,00.
      expect(numeroDigitado(''), isNull);
      expect(numeroDigitado('   '), isNull);
      expect(numeroDigitado(null), isNull);
    });

    test('texto que não é número devolve nulo', () {
      expect(numeroDigitado('abc'), isNull);
    });
  });

  group('erroNaQuantidade', () {
    test('estimativa comum passa', () {
      expect(erroNaQuantidade('7.500'), isNull);
      expect(erroNaQuantidade('1000'), isNull);
    });

    test('é obrigatória', () {
      expect(erroNaQuantidade(''), 'Informe a estimativa');
    });

    test('zero e negativo não passam', () {
      expect(erroNaQuantidade('0'), isNotNull);
      expect(erroNaQuantidade('-5'), isNotNull);
    });

    test('pega o zero a mais', () {
      // O erro real: digitar 70000 em vez de 7000, com luva e no sol. Sem
      // isto, o número errado vira base de comparação com a pesagem e o
      // desvio aparece como problema de avaliação lá no escritório.
      expect(erroNaQuantidade('700000'), contains('caminhão'));
    });
  });

  group('erroNaIdade', () {
    test('em branco passa: nem todo avaliador sabe a idade', () {
      expect(erroNaIdade(''), isNull);
      expect(erroNaIdade(null), isNull);
    });

    test('idade comum passa', () {
      expect(erroNaIdade('2'), isNull);
      expect(erroNaIdade('40'), isNull);
    });

    test('recusa o impossível', () {
      expect(erroNaIdade('0'), isNotNull);
      expect(erroNaIdade('-3'), isNotNull);
      expect(erroNaIdade('500'), contains('muito para um erval'));
    });

    test('recusa decimal: idade de erval é em anos inteiros', () {
      expect(erroNaIdade('2,5'), isNotNull);
    });
  });

  group('erroNoValorPorQuilo', () {
    test('em branco passa: o preço costuma ser acertado depois', () {
      expect(erroNoValorPorQuilo(''), isNull);
    });

    test('preço comum passa', () {
      expect(erroNoValorPorQuilo('4,85'), isNull);
      expect(erroNoValorPorQuilo('0,80'), isNull);
    });

    test('zero não passa', () {
      // Zero não gera erro adiante: gera uma ordem de pagamento de R\$ 0,00,
      // que é bem pior que um erro.
      expect(erroNoValorPorQuilo('0'), isNotNull);
    });

    test('recusa o absurdo', () {
      expect(erroNoValorPorQuilo('500'), contains('fora da faixa'));
    });
  });
}
