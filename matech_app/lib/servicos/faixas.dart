const int kMaxNome = 120;

const int kMaxTelefone = 20;

const int kMaxMunicipio = 60;

const int kMaxChavePix = 77;

const int kMaxDocumento = 14;

const int kMaxIdentificacao = 80;

const int kMaxObservacoes = 1000;

const double kPesoMaximoKg = 100000;

const int kIdadeMaximaAnos = 100;

const double kPrecoMaximoKg = 100;

double? numeroDigitado(String? valor) {
  final limpo = (valor ?? '').trim().replaceAll('.', '').replaceAll(',', '.');
  if (limpo.isEmpty) return null;
  return double.tryParse(limpo);
}

int? inteiroDigitado(String? valor) {
  final limpo = (valor ?? '').trim();
  if (limpo.isEmpty) return null;
  return int.tryParse(limpo);
}

String? erroNaQuantidade(String? valor) {
  final n = numeroDigitado(valor);
  if (n == null) return 'Informe a estimativa';
  if (n <= 0) return 'A estimativa deve ser maior que zero';
  if (n > kPesoMaximoKg) {
    return 'Confira: ${_kg(n)} é mais que um caminhão inteiro';
  }
  return null;
}

String? erroNaIdade(String? valor) {
  final texto = (valor ?? '').trim();
  if (texto.isEmpty) return null;

  final n = inteiroDigitado(texto);
  if (n == null) return 'Use só números inteiros';
  if (n <= 0) return 'A idade deve ser maior que zero';
  if (n > kIdadeMaximaAnos) return 'Confira: $n anos é muito para um erval';
  return null;
}

String? erroNoValorPorQuilo(String? valor) {
  final texto = (valor ?? '').trim();
  if (texto.isEmpty) return null;

  final n = numeroDigitado(texto);
  if (n == null) return 'Use números, com vírgula para os centavos';
  if (n <= 0) return 'O valor deve ser maior que zero';
  if (n > kPrecoMaximoKg) {
    return 'Confira: R\$ ${n.toStringAsFixed(2)} por quilo está fora da faixa';
  }
  return null;
}

String _kg(double n) =>
    '${n.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+$)'), (m) => '${m[1]}.')} kg';
