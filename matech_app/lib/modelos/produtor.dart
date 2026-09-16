class Produtor {
  final String clientId;
  final String? id;
  final String nome;
  final String cpfCnpj;
  final String? telefone;
  final String? endereco;
  final String? municipio;
  final String? uf;
  final String formaPagamento;
  final String? tipoChavePix;
  final String? chavePix;
  final String? titularConta;
  final bool criadoOffline;
  final DateTime? sincronizadoEm;

  const Produtor({
    required this.clientId,
    this.id,
    required this.nome,
    required this.cpfCnpj,
    this.telefone,
    this.endereco,
    this.municipio,
    this.uf,
    this.formaPagamento = 'PIX',
    this.tipoChavePix,
    this.chavePix,
    this.titularConta,
    this.criadoOffline = false,
    this.sincronizadoEm,
  });

  bool get sincronizado => id != null && sincronizadoEm != null;

  Produtor copiarCom({String? id, DateTime? sincronizadoEm}) => Produtor(
    clientId: clientId,
    id: id ?? this.id,
    nome: nome,
    cpfCnpj: cpfCnpj,
    telefone: telefone,
    endereco: endereco,
    municipio: municipio,
    uf: uf,
    formaPagamento: formaPagamento,
    tipoChavePix: tipoChavePix,
    chavePix: chavePix,
    titularConta: titularConta,
    criadoOffline: criadoOffline,
    sincronizadoEm: sincronizadoEm ?? this.sincronizadoEm,
  );

  Map<String, Object?> paraLinha() => {
    'client_id': clientId,
    'id': id,
    'nome': nome,
    'cpf_cnpj': cpfCnpj,
    'telefone': telefone,
    'endereco': endereco,
    'municipio': municipio,
    'uf': uf,
    'forma_pagamento': formaPagamento,
    'tipo_chave_pix': tipoChavePix,
    'chave_pix': chavePix,
    'titular_conta': titularConta,
    'criado_offline': criadoOffline ? 1 : 0,
    'sincronizado_em': sincronizadoEm?.toIso8601String(),
  };

  factory Produtor.deLinha(Map<String, Object?> l) => Produtor(
    clientId: l['client_id'] as String,
    id: l['id'] as String?,
    nome: l['nome'] as String,
    cpfCnpj: l['cpf_cnpj'] as String,
    telefone: l['telefone'] as String?,
    endereco: l['endereco'] as String?,
    municipio: l['municipio'] as String?,
    uf: l['uf'] as String?,
    formaPagamento: (l['forma_pagamento'] as String?) ?? 'PIX',
    tipoChavePix: l['tipo_chave_pix'] as String?,
    chavePix: l['chave_pix'] as String?,
    titularConta: l['titular_conta'] as String?,
    criadoOffline: (l['criado_offline'] as int? ?? 0) == 1,
    sincronizadoEm: _data(l['sincronizado_em']),
  );

  factory Produtor.daApi(Map<String, dynamic> j) => Produtor(
    clientId: (j['clientId'] as String?) ?? 'servidor:${j['id']}',
    id: j['id'] as String?,
    nome: j['nome'] as String,
    cpfCnpj: j['cpfCnpj'] as String,
    telefone: j['telefone'] as String?,
    endereco: j['endereco'] as String?,
    municipio: j['municipio'] as String?,
    uf: j['uf'] as String?,
    formaPagamento: (j['formaPagamento'] as String?) ?? 'PIX',
    tipoChavePix: j['tipoChavePix'] as String?,
    chavePix: j['chavePix'] as String?,
    titularConta: j['titularConta'] as String?,
    criadoOffline: (j['criadoOffline'] as bool?) ?? false,
    sincronizadoEm: DateTime.now(),
  );

  Map<String, dynamic> paraPayload() => {
    'nome': nome,
    'cpfCnpj': cpfCnpj,
    'telefone': telefone,
    'endereco': endereco,
    'municipio': municipio,
    'uf': uf,
    'formaPagamento': formaPagamento,
    'tipoChavePix': tipoChavePix,
    'chavePix': chavePix,
    'titularConta': titularConta,
  };
}

DateTime? _data(Object? v) => v == null ? null : DateTime.tryParse(v as String);
