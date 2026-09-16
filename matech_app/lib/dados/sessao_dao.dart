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

  static Future<void> encerrar() => BancoLocal.limparSessao();
}
