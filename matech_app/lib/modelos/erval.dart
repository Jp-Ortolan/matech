class Erval {
  final String clientId;
  final String? id;
  final String produtorClientId;
  final String? produtorId;
  final String identificacao;
  final String tipoErva; // PLANTADA | NATIVA
  final double? quantidadeEstimadaKg;
  final int? idadeAnos;
  final double? latitude;
  final double? longitude;
  final bool criadoOffline;
  final DateTime? sincronizadoEm;

  const Erval({
    required this.clientId,
    this.id,
    required this.produtorClientId,
    this.produtorId,
    required this.identificacao,
    this.tipoErva = 'NATIVA',
    this.quantidadeEstimadaKg,
    this.idadeAnos,
    this.latitude,
    this.longitude,
    this.criadoOffline = true,
    this.sincronizadoEm,
  });

  bool get sincronizado => id != null && sincronizadoEm != null;

  Map<String, Object?> paraLinha() => {
    'client_id': clientId,
    'id': id,
    'produtor_client_id': produtorClientId,
    'produtor_id': produtorId,
    'identificacao': identificacao,
    'tipo_erva': tipoErva,
    'quantidade_estimada_kg': quantidadeEstimadaKg,
    'idade_anos': idadeAnos,
    'latitude': latitude,
    'longitude': longitude,
    'criado_offline': criadoOffline ? 1 : 0,
    'sincronizado_em': sincronizadoEm?.toIso8601String(),
  };

  factory Erval.deLinha(Map<String, Object?> l) => Erval(
    clientId: l['client_id'] as String,
    id: l['id'] as String?,
    produtorClientId: l['produtor_client_id'] as String,
    produtorId: l['produtor_id'] as String?,
    identificacao: l['identificacao'] as String,
    tipoErva: (l['tipo_erva'] as String?) ?? 'NATIVA',
    quantidadeEstimadaKg: (l['quantidade_estimada_kg'] as num?)?.toDouble(),
    idadeAnos: l['idade_anos'] as int?,
    latitude: (l['latitude'] as num?)?.toDouble(),
    longitude: (l['longitude'] as num?)?.toDouble(),
    criadoOffline: (l['criado_offline'] as int? ?? 1) == 1,
    sincronizadoEm:
        l['sincronizado_em'] == null
            ? null
            : DateTime.tryParse(l['sincronizado_em'] as String),
  );

  factory Erval.daApi(
    Map<String, dynamic> j, {
    required String produtorClientId,
    required String? produtorId,
  }) => Erval(
    clientId: (j['clientId'] as String?) ?? 'servidor:${j['id']}',
    id: j['id'] as String?,
    produtorClientId: produtorClientId,
    produtorId: produtorId,
    identificacao: j['identificacao'] as String,
    tipoErva: (j['tipoErva'] as String?) ?? 'NATIVA',
    quantidadeEstimadaKg: (j['quantidadeEstimadaKg'] as num?)?.toDouble(),
    idadeAnos: j['idadeAnos'] as int?,
    criadoOffline: false,
    sincronizadoEm: DateTime.now(),
  );

  Map<String, dynamic> paraPayload() => {
    'produtorId': produtorId,
    'produtorClientId': produtorClientId,
    'identificacao': identificacao,
    'tipoErva': tipoErva,
    'quantidadeEstimadaKg': quantidadeEstimadaKg,
    'idadeAnos': idadeAnos,
    'latitude': latitude,
    'longitude': longitude,
  };
}
