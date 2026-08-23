// ---------------------------------------------------------------------------
// MODELO · usuário da sessão
// ---------------------------------------------------------------------------
// O token fica no SQLite, e não em shared_preferences — assim o aplicativo tem
// UM lugar de armazenamento em vez de dois, e uma dependência a menos.

class Usuario {
  final String id;
  final String nome;
  final String usuario;
  final String perfil;
  final String token;
  final DateTime? expiraEm;

  const Usuario({
    required this.id,
    required this.nome,
    required this.usuario,
    required this.perfil,
    required this.token,
    this.expiraEm,
  });

  /// Quem coleta em campo é o comprador/avaliador. O administrativo também
  /// passa, como no permitir() do servidor.
  bool get podeAvaliar =>
      perfil == 'COMPRADOR_AVALIADOR' || perfil == 'ADMINISTRATIVO';

  bool get expirado => expiraEm != null && DateTime.now().isAfter(expiraEm!);

  String get iniciais =>
      nome
          .split(' ')
          .where((p) => p.isNotEmpty)
          .take(2)
          .map((p) => p[0])
          .join()
          .toUpperCase();

  Map<String, Object?> paraLinha() => {
    'id': id,
    'nome': nome,
    'usuario': usuario,
    'perfil': perfil,
    'token': token,
    'expira_em': expiraEm?.toIso8601String(),
  };

  factory Usuario.deLinha(Map<String, Object?> l) => Usuario(
    id: l['id'] as String,
    nome: l['nome'] as String,
    usuario: l['usuario'] as String,
    perfil: l['perfil'] as String,
    token: l['token'] as String,
    expiraEm:
        l['expira_em'] == null
            ? null
            : DateTime.tryParse(l['expira_em'] as String),
  );
}

const Map<String, String> rotuloPerfil = {
  'OPERADOR_BALANCA': 'Operador de balança',
  'ANALISTA_QUALIDADE': 'Analista de qualidade',
  'COMPRADOR_AVALIADOR': 'Comprador / avaliador',
  'ADMINISTRATIVO': 'Administrativo',
};
