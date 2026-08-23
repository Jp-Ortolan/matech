// ---------------------------------------------------------------------------
// MODELO · operação na fila de sincronização
// ---------------------------------------------------------------------------
// Uma linha da fila é a INTENÇÃO de enviar alguma coisa. Ela é gravada na
// mesma transação do SQLite que grava o dado — de modo que nunca existe um
// instante em que a avaliação está salva e a vontade de enviá-la não está.
//
// AS QUATRO SITUAÇÕES E O QUE CADA UMA SIGNIFICA NA PRÁTICA:
//
//   PENDENTE  ainda não subiu. É o estado normal no meio do erval.
//   ENVIADA   o servidor confirmou. A linha fica como histórico.
//   ERRO      o servidor recusou por regra de negócio (um 4xx). Insistir não
//             conserta: um CPF duplicado continuará duplicado na décima
//             tentativa. Precisa aparecer para uma pessoa decidir.
//   PENDENTE_DEPENDENCIA  o servidor entendeu, mas o registro do qual esta
//             operação depende ainda não chegou lá. NÃO é erro: a próxima
//             passada resolve sozinha, depois que o produtor subir.

class OperacaoPendente {
  static const String pendente = 'PENDENTE';
  static const String enviada = 'ENVIADA';
  static const String erro = 'ERRO';
  static const String dependencia = 'PENDENTE_DEPENDENCIA';

  final int? sequencia; // AUTOINCREMENT: é o que garante a ordem FIFO
  final String clientId;
  final String entidade; // Produtor | Erval | Avaliacao | FotoErval
  final String operacao; // CREATE | UPDATE
  final String payloadJson;
  final String situacao;
  final int tentativas;
  final String? ultimoErro;
  final DateTime criadoEmOrigem;
  final DateTime? proximaTentativaEm;

  const OperacaoPendente({
    this.sequencia,
    required this.clientId,
    required this.entidade,
    this.operacao = 'CREATE',
    required this.payloadJson,
    this.situacao = pendente,
    this.tentativas = 0,
    this.ultimoErro,
    required this.criadoEmOrigem,
    this.proximaTentativaEm,
  });

  bool get aguardando => situacao == pendente || situacao == dependencia;

  Map<String, Object?> paraLinha() => {
    'sequencia': sequencia,
    'client_id': clientId,
    'entidade': entidade,
    'operacao': operacao,
    'payload': payloadJson,
    'situacao': situacao,
    'tentativas': tentativas,
    'ultimo_erro': ultimoErro,
    'criado_em_origem': criadoEmOrigem.toIso8601String(),
    'proxima_tentativa_em': proximaTentativaEm?.toIso8601String(),
  };

  factory OperacaoPendente.deLinha(Map<String, Object?> l) => OperacaoPendente(
    sequencia: l['sequencia'] as int?,
    clientId: l['client_id'] as String,
    entidade: l['entidade'] as String,
    operacao: (l['operacao'] as String?) ?? 'CREATE',
    payloadJson: l['payload'] as String,
    situacao: (l['situacao'] as String?) ?? pendente,
    tentativas: (l['tentativas'] as int?) ?? 0,
    ultimoErro: l['ultimo_erro'] as String?,
    criadoEmOrigem: DateTime.parse(l['criado_em_origem'] as String),
    proximaTentativaEm:
        l['proxima_tentativa_em'] == null
            ? null
            : DateTime.tryParse(l['proxima_tentativa_em'] as String),
  );
}
