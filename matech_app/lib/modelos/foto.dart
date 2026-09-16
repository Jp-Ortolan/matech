class Foto {
  final String clientId;
  final String? id;
  final String avaliacaoClientId;

  final String caminhoLocal;
  final int? tamanhoBytes;
  final int? largura;
  final int? altura;
  final DateTime? sincronizadoEm;

  const Foto({
    required this.clientId,
    this.id,
    required this.avaliacaoClientId,
    required this.caminhoLocal,
    this.tamanhoBytes,
    this.largura,
    this.altura,
    this.sincronizadoEm,
  });

  bool get sincronizada => sincronizadoEm != null;

  Map<String, Object?> paraLinha() => {
    'client_id': clientId,
    'id': id,
    'avaliacao_client_id': avaliacaoClientId,
    'caminho_local': caminhoLocal,
    'tamanho_bytes': tamanhoBytes,
    'largura': largura,
    'altura': altura,
    'sincronizado_em': sincronizadoEm?.toIso8601String(),
  };

  factory Foto.deLinha(Map<String, Object?> l) => Foto(
    clientId: l['client_id'] as String,
    id: l['id'] as String?,
    avaliacaoClientId: l['avaliacao_client_id'] as String,
    caminhoLocal: l['caminho_local'] as String,
    tamanhoBytes: l['tamanho_bytes'] as int?,
    largura: l['largura'] as int?,
    altura: l['altura'] as int?,
    sincronizadoEm:
        l['sincronizado_em'] == null
            ? null
            : DateTime.tryParse(l['sincronizado_em'] as String),
  );
}
