// ---------------------------------------------------------------------------
// FAIXAS · o que é número plausível numa avaliação de campo
// ---------------------------------------------------------------------------
// ISTO NÃO É REGRA DE NEGÓCIO, e a diferença importa.
//
// Regra de negócio é o limite de palito que reprova uma carga: ela é da
// ervateira, muda por negociação, e por isso mora numa tabela editável do
// servidor. O que está aqui é outra coisa — é a defesa contra o DEDO ERRADO.
//
// O caso real: o avaliador digita a estimativa com luva, no sol, e sai 70000
// em vez de 7000. Ninguém confere, a avaliação sobe, e o número errado vira
// base de comparação com a pesagem lá no escritório — onde o desvio de 900%
// aparece como problema de avaliação, e não como problema de digitação.
//
// Os limites são LARGOS de propósito. Não estão aqui para dizer o que é uma
// carga boa, e sim o que é impossível: um erval de duzentos anos, um preço de
// mil reais o quilo, uma umidade de 300%. Apertar mais que isso seria inventar
// regra de negócio pelas costas de quem decide, que é o dono da ervateira.
//
// Por isso as mensagens perguntam em vez de afirmar: "confira" e não "errado".

/// O maior peso que um caminhão de erva-mate entrega. Um bitrem carregado
/// passa longe disto; o número existe para pegar o zero a mais.
const double kPesoMaximoKg = 100000;

/// Erval de mais de um século existe, mas não se colhe. Cem anos é folga.
const int kIdadeMaximaAnos = 100;

/// Preço por quilo. A erva-mate verde é negociada em reais e centavos; cem
/// reais o quilo é duas ordens de grandeza acima de qualquer safra.
const double kPrecoMaximoKg = 100;

/// Converte o que foi digitado, na convenção brasileira: PONTO É MILHAR e
/// vírgula é decimal. "7.500" são sete mil e quinhentos quilos, não sete e
/// meio.
///
/// Esta função tinha de ser exatamente a mesma que a tela usa para GRAVAR, e
/// por pouco não foi: a primeira versão daqui tratava o ponto como decimal.
/// O efeito seria silencioso e feio — o validador aprovaria "70.000" lendo
/// setenta, e o banco guardaria setenta mil. Validar com uma régua e gravar
/// com outra é pior que não validar, porque dá a impressão de que alguém
/// conferiu.
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

/// Estimativa de quantidade. Obrigatória: é ela que o relatório de acurácia
/// compara com a pesagem, e sem ela a avaliação não mede nada.
String? erroNaQuantidade(String? valor) {
  final n = numeroDigitado(valor);
  if (n == null) return 'Informe a estimativa';
  if (n <= 0) return 'A estimativa deve ser maior que zero';
  if (n > kPesoMaximoKg) {
    return 'Confira: ${_kg(n)} é mais que um caminhão inteiro';
  }
  return null;
}

/// Idade do erval. Opcional — nem todo avaliador sabe, e chutar é pior que
/// deixar em branco.
String? erroNaIdade(String? valor) {
  final texto = (valor ?? '').trim();
  if (texto.isEmpty) return null;

  final n = inteiroDigitado(texto);
  if (n == null) return 'Use só números inteiros';
  if (n <= 0) return 'A idade deve ser maior que zero';
  if (n > kIdadeMaximaAnos) return 'Confira: $n anos é muito para um erval';
  return null;
}

/// Valor por quilo combinado no erval. Opcional: na maioria das vezes o preço
/// só é acertado depois, na emissão da ordem de pagamento.
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
