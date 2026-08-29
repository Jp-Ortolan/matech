// ---------------------------------------------------------------------------
// ARQUIVOS · falhas que a tela precisa distinguir
// ---------------------------------------------------------------------------
// Este arquivo existe separado porque é o único pedaço da camada de fotos que
// não depende de plataforma. As duas implementações — a do aparelho e a do
// navegador — lançam os mesmos erros, e as telas tratam os dois iguais.

/// Falhas de armazenamento que a tela precisa distinguir.
enum FalhaDeArquivo {
  /// Não há espaço para guardar a imagem.
  semEspaco,

  /// A gravação falhou por outro motivo.
  escritaFalhou,
}

class ErroDeArquivo implements Exception {
  final FalhaDeArquivo falha;
  final String mensagem;
  const ErroDeArquivo(this.falha, this.mensagem);
  @override
  String toString() => mensagem;
}
