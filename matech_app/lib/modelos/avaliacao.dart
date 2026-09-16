const List<String> tiposDeErva = ['NATIVA', 'PLANTADA'];
const List<String> grausDeQueima = ['NAO', 'EM_PARTE', 'SIM'];
const List<String> classificacoes = ['A', 'B', 'C'];

const Map<String, String> rotuloTipoErva = {
  'NATIVA': 'Nativa',
  'PLANTADA': 'Plantada',
};
const Map<String, String> rotuloQueima = {
  'NAO': 'Sem queima',
  'EM_PARTE': 'Queimada em parte',
  'SIM': 'Queimada',
};

class Avaliacao {
  final String clientId;
  final String? id;

  final String
  produtorClientId; // guardado local, para listar sem juntar tabelas
  final String ervalClientId;
  final String? ervalId;

  final DateTime dataAvaliacao;
  final String tipoErva;
  final String ervaQueimada;
  final int? idadeErvalAnos;
  final double? quantidadeEstimadaKg;
  final String? classificacao;
  final double? umidadeEstimada;
  final String? taloAparente;
  final double? valorCombinadoKg;
  final double? latitude;
  final double? longitude;
  final String? observacoes;

  final DateTime alteradoEmOrigem;
  final DateTime? sincronizadoEm;

  const Avaliacao({
    required this.clientId,
    this.id,
    required this.produtorClientId,
    required this.ervalClientId,
    this.ervalId,
    required this.dataAvaliacao,
    this.tipoErva = 'NATIVA',
    this.ervaQueimada = 'NAO',
    this.idadeErvalAnos,
    this.quantidadeEstimadaKg,
    this.classificacao,
    this.umidadeEstimada,
    this.taloAparente,
    this.valorCombinadoKg,
    this.latitude,
    this.longitude,
    this.observacoes,
    required this.alteradoEmOrigem,
    this.sincronizadoEm,
  });

  bool get sincronizado => id != null && sincronizadoEm != null;
  bool get temLocalizacao => latitude != null && longitude != null;

  Avaliacao copiarComAlteracao(DateTime alteradoAgora) => Avaliacao(
    clientId: clientId,
    id: id,
    produtorClientId: produtorClientId,
    ervalClientId: ervalClientId,
    ervalId: ervalId,
    dataAvaliacao: dataAvaliacao,
    tipoErva: tipoErva,
    ervaQueimada: ervaQueimada,
    idadeErvalAnos: idadeErvalAnos,
    quantidadeEstimadaKg: quantidadeEstimadaKg,
    classificacao: classificacao,
    umidadeEstimada: umidadeEstimada,
    taloAparente: taloAparente,
    valorCombinadoKg: valorCombinadoKg,
    latitude: latitude,
    longitude: longitude,
    observacoes: observacoes,
    alteradoEmOrigem: alteradoAgora,
  );

  Map<String, Object?> paraLinha() => {
    'client_id': clientId,
    'id': id,
    'produtor_client_id': produtorClientId,
    'erval_client_id': ervalClientId,
    'erval_id': ervalId,
    'data_avaliacao': dataAvaliacao.toIso8601String(),
    'tipo_erva': tipoErva,
    'erva_queimada': ervaQueimada,
    'idade_erval_anos': idadeErvalAnos,
    'quantidade_estimada_kg': quantidadeEstimadaKg,
    'classificacao': classificacao,
    'umidade_estimada': umidadeEstimada,
    'talo_aparente': taloAparente,
    'valor_combinado_kg': valorCombinadoKg,
    'latitude': latitude,
    'longitude': longitude,
    'observacoes': observacoes,
    'alterado_em_origem': alteradoEmOrigem.toIso8601String(),
    'sincronizado_em': sincronizadoEm?.toIso8601String(),
  };

  factory Avaliacao.deLinha(Map<String, Object?> l) => Avaliacao(
    clientId: l['client_id'] as String,
    id: l['id'] as String?,
    produtorClientId: l['produtor_client_id'] as String,
    ervalClientId: l['erval_client_id'] as String,
    ervalId: l['erval_id'] as String?,
    dataAvaliacao: DateTime.parse(l['data_avaliacao'] as String),
    tipoErva: (l['tipo_erva'] as String?) ?? 'NATIVA',
    ervaQueimada: (l['erva_queimada'] as String?) ?? 'NAO',
    idadeErvalAnos: l['idade_erval_anos'] as int?,
    quantidadeEstimadaKg: (l['quantidade_estimada_kg'] as num?)?.toDouble(),
    classificacao: l['classificacao'] as String?,
    umidadeEstimada: (l['umidade_estimada'] as num?)?.toDouble(),
    taloAparente: l['talo_aparente'] as String?,
    valorCombinadoKg: (l['valor_combinado_kg'] as num?)?.toDouble(),
    latitude: (l['latitude'] as num?)?.toDouble(),
    longitude: (l['longitude'] as num?)?.toDouble(),
    observacoes: l['observacoes'] as String?,
    alteradoEmOrigem: DateTime.parse(l['alterado_em_origem'] as String),
    sincronizadoEm:
        l['sincronizado_em'] == null
            ? null
            : DateTime.tryParse(l['sincronizado_em'] as String),
  );

  Map<String, dynamic> paraPayload() => {
    'ervalId': ervalId,
    'ervalClientId': ervalClientId,
    'dataAvaliacao': dataAvaliacao.toIso8601String(),
    'tipoErva': tipoErva,
    'ervaQueimada': ervaQueimada,
    'idadeErvalAnos': idadeErvalAnos,
    'quantidadeEstimadaKg': quantidadeEstimadaKg,
    'classificacao': classificacao,
    'umidadeEstimada': umidadeEstimada,
    'taloAparente': taloAparente,
    'valorCombinadoKg': valorCombinadoKg,
    'latitude': latitude,
    'longitude': longitude,
    'observacoes': observacoes,
    'alteradoEmOrigem': alteradoEmOrigem.toIso8601String(),
  };
}
