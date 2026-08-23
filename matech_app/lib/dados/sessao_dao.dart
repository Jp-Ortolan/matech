// ---------------------------------------------------------------------------
// DAO · sessão
// ---------------------------------------------------------------------------
// Guarda quem está logado e o token, no próprio SQLite.
//
// A tabela tem no máximo UMA linha: o aplicativo é de um avaliador por
// aparelho. Por isso gravar é sempre "apaga tudo e insere" — não há caso de
// dois usuários coexistindo, e tentar suportar isso complicaria o resto sem
// necessidade.

import '../modelos/usuario.dart';
import 'banco_local.dart';

class SessaoDao {
  static Future<Usuario?> atual() async {
    final db = await BancoLocal.instancia;
    final linhas = await db.query('sessao', limit: 1);
    if (linhas.isEmpty) return null;
    return Usuario.deLinha(linhas.first);
  }

  static Future<void> guardar(Usuario usuario) async {
    final db = await BancoLocal.instancia;
    await db.transaction((txn) async {
      await txn.delete('sessao');
      await txn.insert('sessao', usuario.paraLinha());
    });
  }

  /// Apaga só a sessão. Os dados coletados e a fila FICAM — ver
  /// BancoLocal.limparSessao. Sair da conta não pode custar um dia de coleta.
  static Future<void> encerrar() => BancoLocal.limparSessao();
}
