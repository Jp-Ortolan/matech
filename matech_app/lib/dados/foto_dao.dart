import 'package:sqflite/sqflite.dart';

import '../modelos/foto.dart';
import 'banco_local.dart';
import 'fila_dao.dart';

class FotoDao {
  static Future<List<Foto>> daAvaliacao(String avaliacaoClientId) async {
    final db = await BancoLocal.instancia;
    final linhas = await db.query(
      'fotos',
      where: 'avaliacao_client_id = ?',
      whereArgs: [avaliacaoClientId],
      orderBy: 'rowid ASC',
    );
    return linhas.map(Foto.deLinha).toList();
  }

  static Future<void> criarNaTransacao(Transaction txn, Foto foto) async {
    await txn.insert(
      'fotos',
      foto.paraLinha(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
    await FilaDao.enfileirarNaTransacao(
      txn,
      clientId: foto.clientId,
      entidade: 'FotoErval',
      payload: {
        'avaliacaoClientId': foto.avaliacaoClientId,
        'caminhoLocal': foto.caminhoLocal,
        'largura': foto.largura,
        'altura': foto.altura,
      },
    );
  }

  static Future<void> acrescentarAAvaliacao(List<Foto> fotos) async {
    if (fotos.isEmpty) return;

    final db = await BancoLocal.instancia;
    await db.transaction((txn) async {
      for (final foto in fotos) {
        await criarNaTransacao(txn, foto);
      }
    });
  }

  static Future<void> confirmarSincronizacao(
    String clientId,
    String? idServidor,
  ) async {
    final db = await BancoLocal.instancia;
    await db.update(
      'fotos',
      {'id': idServidor, 'sincronizado_em': DateTime.now().toIso8601String()},
      where: 'client_id = ?',
      whereArgs: [clientId],
    );
  }

  static Future<Set<String>> todosOsClientIds() async {
    final db = await BancoLocal.instancia;
    final linhas = await db.query('fotos', columns: ['client_id']);
    return linhas.map((l) => l['client_id'] as String).toSet();
  }

  static Future<void> marcarArquivoAusente(String clientId) async {
    final db = await BancoLocal.instancia;
    await db.update(
      'fotos',
      {'caminho_local': ''},
      where: 'client_id = ? AND sincronizado_em IS NULL',
      whereArgs: [clientId],
    );
  }

  static Future<int> contarPendentes() async {
    final db = await BancoLocal.instancia;
    final r = await db.rawQuery(
      'SELECT COUNT(*) AS total FROM fotos WHERE sincronizado_em IS NULL',
    );
    return (r.first['total'] as int?) ?? 0;
  }
}
