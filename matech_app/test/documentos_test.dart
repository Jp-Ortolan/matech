// ---------------------------------------------------------------------------
// TESTES · validação de CPF e CNPJ
// ---------------------------------------------------------------------------
// A trava aqui é a mesma do servidor: se o algoritmo divergir entre os três
// programas, o aplicativo aceita no erval o que o servidor recusa horas depois,
// quando o avaliador já foi embora.
//
// Os números usados são de teste, gerados pelo próprio algoritmo. Não
// pertencem a ninguém.

import 'package:flutter_test/flutter_test.dart';
import 'package:matech_app/servicos/documentos.dart';

void main() {
  group('cpfValido', () {
    test('aceita CPF com dígito verificador correto', () {
      expect(cpfValido('529.982.247-25'), isTrue);
      expect(cpfValido('52998224725'), isTrue);
    });

    test('recusa um dígito trocado', () {
      // O erro real de digitação: o documento tem o tamanho certo e um número
      // errado. É exatamente o que a verificação de comprimento deixava passar.
      expect(cpfValido('529.982.247-24'), isFalse);
    });

    test('recusa todos os dígitos iguais', () {
      // 111.111.111-11 passa na conta dos pesos e não é CPF de ninguém. É o
      // que se digita quando se quer "só preencher o campo".
      for (final n in ['00000000000', '11111111111', '99999999999']) {
        expect(cpfValido(n), isFalse, reason: n);
      }
    });

    test('recusa comprimento errado', () {
      expect(cpfValido('5299822472'), isFalse);
      expect(cpfValido('529982247255'), isFalse);
      expect(cpfValido(''), isFalse);
      expect(cpfValido(null), isFalse);
    });
  });

  group('cnpjValido', () {
    test('aceita CNPJ com dígito verificador correto', () {
      expect(cnpjValido('11.222.333/0001-81'), isTrue);
      expect(cnpjValido('11222333000181'), isTrue);
    });

    test('recusa um dígito trocado', () {
      expect(cnpjValido('11.222.333/0001-82'), isFalse);
    });

    test('recusa todos os dígitos iguais', () {
      expect(cnpjValido('11111111111111'), isFalse);
    });
  });

  group('erroNoDocumento', () {
    test('documento válido não gera mensagem', () {
      expect(erroNoDocumento('529.982.247-25'), isNull);
      expect(erroNoDocumento('11.222.333/0001-81'), isNull);
    });

    test('campo vazio pede o documento', () {
      expect(erroNoDocumento(''), 'Informe o CPF ou CNPJ');
      expect(erroNoDocumento(null), 'Informe o CPF ou CNPJ');
    });

    test('comprimento errado diz QUANTOS dígitos foram digitados', () {
      // A mensagem tem de dizer o que consertar. "Inválido" faz a pessoa
      // conferir o documento inteiro; o número faz ela ver que faltou um.
      expect(erroNoDocumento('5299822472'), contains('foram digitados 10'));
    });

    test('dígito trocado diz que é dígito trocado, e qual documento', () {
      expect(erroNoDocumento('529.982.247-24'), contains('CPF inválido'));
      expect(erroNoDocumento('11.222.333/0001-82'), contains('CNPJ inválido'));
    });

    test('pontuação não atrapalha', () {
      expect(erroNoDocumento('529 982 247 25'), isNull);
    });
  });
}
