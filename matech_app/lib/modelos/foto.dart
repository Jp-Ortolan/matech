// ---------------------------------------------------------------------------
// MODELO · foto do erval
// ---------------------------------------------------------------------------
// A foto é o item mais pesado da coleta e o mais frágil no envio: 2 a 4 MB
// atravessando uma conexão de zona rural. Por isso ela NÃO viaja junto da
// avaliação — vai depois, uma requisição por foto.
//
// A consequência prática: a avaliação (uns poucos KB) sobe de primeira, e as
// fotos vão pingando conforme o sinal permite. Se a terceira foto falhar, a
// avaliação e as duas primeiras já estão salvas no servidor. Se elas viajassem
// juntas, a mesma falha derrubaria tudo.

class Foto {
  final String clientId;
  final String? id;
  final String avaliacaoClientId;

  /// Caminho do arquivo NO APARELHO. Enquanto não sincroniza, é o único lugar
  /// onde a imagem existe.
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
