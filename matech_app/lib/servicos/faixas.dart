const int kMaxNome = 120;

const int kMaxTelefone = 20;

const int kMaxMunicipio = 60;

const int kMaxChavePix = 77;

// Mesmos limites da API (src/lib/textos.js).
const int kMaxTitular = 120;

const int kMaxBanco = 60;

const int kMaxAgencia = 10;

const int kMaxConta = 20;

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

// Mesmas regras de texto da API (src/lib/textos.js).
final _letraRepetida = RegExp(r'(\p{L})\1{4,}', unicode: true, caseSensitive: false);
final _palavraGigante = RegExp(r'\S{41,}');
final _letra = RegExp(r'\p{L}', unicode: true);

// Recusa texto sem sentido ("aaaaaAAAA", palavra de 80 letras).
// Com [nome], exige também pelo menos 3 letras.
String? erroNoTexto(String? valor, String rotulo, {bool nome = false}) {
  final texto = (valor ?? '').trim();
  if (texto.isEmpty) return null;
  if (nome && _letra.allMatches(texto).length < 3) {
    return 'Confira $rotulo: precisa ter pelo menos 3 letras';
  }
  if (_letraRepetida.hasMatch(texto)) {
    return 'Confira $rotulo: há uma letra repetida muitas vezes';
  }
  if (_palavraGigante.hasMatch(texto)) {
    return 'Confira $rotulo: há uma palavra com mais de 40 letras';
  }
  return null;
}

// Telefone: DDD + número (10 ou 11 dígitos). Vazio é permitido.
String? erroNoTelefone(String? valor) {
  final digitos = (valor ?? '').replaceAll(RegExp(r'\D'), '');
  if (digitos.isEmpty) return null;
  if (digitos.length < 10 || digitos.length > 11) {
    return 'Informe DDD e número, como (42) 99999-9999';
  }
  return null;
}

String _kg(double n) =>
    '${n.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+$)'), (m) => '${m[1]}.')} kg';
