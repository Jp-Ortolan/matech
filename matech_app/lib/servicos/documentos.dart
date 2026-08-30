// ---------------------------------------------------------------------------
// DOCUMENTOS · validação de CPF e CNPJ no aparelho
// ---------------------------------------------------------------------------
// TERCEIRA CÓPIA DO MESMO ALGORITMO, e é deliberada. Ele já existe em
// swm_ervateira/src/lib/documentos.js, no servidor, e em web/src/lib, no
// navegador. O motivo é o mesmo do cálculo de pagamento: a tela avisa CEDO, o
// servidor GARANTE. Nenhum cliente é confiável — nem a web, nem este
// aplicativo, nem o próximo que vier.
//
// AQUI A CÓPIA VALE MAIS QUE NAS OUTRAS DUAS, e é o ponto:
//
// Este é o único cliente que trabalha SEM O SERVIDOR DO OUTRO LADO. No
// navegador, um CPF errado volta recusado em meio segundo e o operador
// corrige com o produtor na frente. No erval não há para quem perguntar: o
// cadastro entra na fila, o avaliador vai embora, e a recusa só aparece horas
// depois, na sincronização — quando o produtor está a quarenta quilômetros e
// ninguém sabe qual dígito estava trocado.
//
// Validar aqui é o que transforma um erro irrecuperável num erro de digitação.
//
// A duplicação é pequena e estável: o algoritmo do dígito verificador não muda
// desde 1970. Compartilhar o arquivo entre Node, navegador e Dart exigiria um
// pacote comum e uma etapa de build só para isso.

String apenasDigitos(String? valor) =>
    (valor ?? '').replaceAll(RegExp(r'\D'), '');

/// O dígito verificador, pela soma ponderada que a Receita define.
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
  // Onze dígitos iguais passam na conta dos pesos e não são CPF de ninguém.
  // 111.111.111-11 é o caso que aparece em teste de sistema o tempo todo.
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

/// Mensagem de recusa, ou nulo.
///
/// TEXTO E NÃO BOOLEANO, pelo mesmo motivo da web: "inválido" não conserta
/// nada. Quem está no erval precisa saber se faltou dígito ou se trocou um —
/// são dois consertos diferentes, e um deles é olhar o documento de novo.
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
