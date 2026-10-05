import 'package:flutter_test/flutter_test.dart';
import 'package:matech_app/modelos/produtor.dart';

void main() {
  const conta = Produtor(
    clientId: 'c1',
    nome: 'Ana Souza',
    cpfCnpj: '12345678909',
    formaPagamento: 'CONTA_BANCARIA',
    titularConta: 'Ana Souza',
    banco: 'Sicredi',
    agencia: '0101',
    conta: '12345-6',
    tipoConta: 'POUPANCA',
  );

  test('conta bancária sobrevive à ida e volta no SQLite', () {
    final volta = Produtor.deLinha(conta.paraLinha());
    expect(volta.formaPagamento, 'CONTA_BANCARIA');
    expect(volta.banco, 'Sicredi');
    expect(volta.agencia, '0101');
    expect(volta.conta, '12345-6');
    expect(volta.tipoConta, 'POUPANCA');
  });

  test('o envio ao servidor leva os dados da conta', () {
    final payload = conta.paraPayload();
    expect(payload['formaPagamento'], 'CONTA_BANCARIA');
    expect(payload['banco'], 'Sicredi');
    expect(payload['tipoConta'], 'POUPANCA');
  });
}
