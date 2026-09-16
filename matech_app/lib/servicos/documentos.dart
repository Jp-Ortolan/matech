String apenasDigitos(String? valor) =>
    (valor ?? '').replaceAll(RegExp(r'\D'), '');

int _digitoPorPesos(List<int> digitos, List<int> pesos) {
  var soma = 0;
  for (var i = 0; i < pesos.length; i++) {
    soma += digitos[i] * pesos[i];
  }
  final resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

bool cpfValido(String? valor) {
  final d = apenasDigitos(valor).split('').map(int.parse).toList();
  if (d.length != 11 || d.every((n) => n == d[0])) return false;

  return d[9] == _digitoPorPesos(d, const [10, 9, 8, 7, 6, 5, 4, 3, 2]) &&
      d[10] == _digitoPorPesos(d, const [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
}

bool cnpjValido(String? valor) {
  final d = apenasDigitos(valor).split('').map(int.parse).toList();
  if (d.length != 14 || d.every((n) => n == d[0])) return false;

  return d[12] ==
          _digitoPorPesos(d, const [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) &&
      d[13] ==
          _digitoPorPesos(d, const [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
}

String? erroNoDocumento(String? valor) {
  final d = apenasDigitos(valor);
  if (d.isEmpty) return 'Informe o CPF ou CNPJ';

  if (d.length != 11 && d.length != 14) {
    return 'CPF tem 11 dígitos e CNPJ tem 14 — foram digitados ${d.length}';
  }

  final ok = d.length == 11 ? cpfValido(d) : cnpjValido(d);
  if (!ok) {
    return d.length == 11
        ? 'CPF inválido: confira, algum dígito está trocado'
        : 'CNPJ inválido: confira, algum dígito está trocado';
  }
  return null;
}
