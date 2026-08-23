// ---------------------------------------------------------------------------
// MODELO · erval
// ---------------------------------------------------------------------------
// A área de onde a erva sai. O schema exige que toda avaliação pertença a um
// erval, e não diretamente ao produtor — o que está certo: quem avalia está
// fisicamente numa área, e é a área que tem coordenada, idade e tipo.
//
// Por isso o formulário de avaliação tem "erval", com criação rápida na hora:
// no mato, o avaliador não vai voltar a uma tela de cadastro para depois
// avaliar. Ele escolhe uma área conhecida ou nomeia uma nova ali mesmo.

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

  /// Vindo dentro de GET /api/produtores, que já devolve os ervais de cada
  /// produtor. Espelhar essas áreas importa mais do que parece: sem elas, um
  /// produtor baixado do servidor apareceria no aplicativo sem nenhuma área
  /// conhecida, e o avaliador seria obrigado a criar uma nova a cada visita —
  /// enchendo a web de áreas duplicadas da mesma propriedade.
  ///
  /// Como essas áreas nasceram no servidor, elas não têm clientId. O próprio
  /// id serve de chave local, já que ele existe e é único.
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

  /// O payload manda os DOIS identificadores do produtor. O servidor tenta
  /// primeiro pelo id e cai no clientId se ele ainda não existir lá — é assim
  /// que um erval de um produtor recém-criado offline encontra o dono.
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
