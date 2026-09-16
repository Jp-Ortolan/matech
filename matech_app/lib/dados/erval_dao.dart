import 'package:sqflite/sqflite.dart';

import '../modelos/erval.dart';
import 'banco_local.dart';
import 'fila_dao.dart';

class ErvalDao {
  static Future<List<Erval>> doProdutor(String produtorClientId) async {
    final db = await BancoLocal.instancia;
    final linhas = await db.query(
      'ervais',
      where: 'produtor_client_id = ?',
      whereArgs: [produtorClientId],
      orderBy: 'identificacao COLLATE NOCASE ASC',
    );
    return linhas.map(Erval.deLinha).toList();
  }

  static Future<Erval?> porClientId(String clientId) async {
    final db = await BancoLocal.instancia;
    final linhas = await db.query(
      'ervais',
      where: 'client_id = ?',
      whereArgs: [clientId],
      limit: 1,
    );
    return linhas.isEmpty ? null : Erval.deLinha(linhas.first);
  }

  static Future<void> criarNaTransacao(Transaction txn, Erval erval) async {
    await txn.insert(
      'ervais',
      erval.paraLinha(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
    await FilaDao.enfileirarNaTransacao(
      txn,
      clientId: erval.clientId,
      entidade: 'Erval',
      payload: erval.paraPayload(),
    );
  }

  static Future<void> guardarEspelho(
    Transaction txn,
    List<Erval> doServidor,
  ) async {
    for (final e in doServidor) {
      await txn.insert(
        'ervais',
        e.paraLinha(),
        conflictAlgorithm: ConflictAlgorithm.ignore,
      );
    }
  }

  static Future<void> confirmarSincronizacao(
    String clientId,
    String? idServidor,
  ) async {
    final db = await BancoLocal.instancia;
    await db.update(
      'ervais',
      {'id': idServidor, 'sincronizado_em': DateTime.now().toIso8601String()},
      where: 'client_id = ?',
      whereArgs: [clientId],
    );
    if (idServidor != null) {
      await db.update(
        'avaliacoes',
        {'erval_id': idServidor},
        where: 'erval_client_id = ?',
        whereArgs: [clientId],
      );
    }
  }
}
