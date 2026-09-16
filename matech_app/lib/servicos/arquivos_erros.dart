enum FalhaDeArquivo {
  semEspaco,

  escritaFalhou,
}

class ErroDeArquivo implements Exception {
  final FalhaDeArquivo falha;
  final String mensagem;
  const ErroDeArquivo(this.falha, this.mensagem);
  @override
  String toString() => mensagem;
}
