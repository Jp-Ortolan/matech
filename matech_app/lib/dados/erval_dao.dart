// ---------------------------------------------------------------------------
// DAO · ervais
// ---------------------------------------------------------------------------
// O erval é a área de onde a erva sai, e toda avaliação pertence a uma.
// Quem avalia está fisicamente numa área — é a área que tem coordenada,
// idade e tipo de erva, não o produtor.
//
// A criação do erval acontece DENTRO do formulário de avaliação, e por isso
// este DAO quase não é usado sozinho: quem grava os dois de uma vez, na mesma
// transação e na ordem certa, é o AvaliacaoDao.

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

  /// Grava e enfileira na transação recebida. Só é chamado de dentro de uma
  /// transação maior — ver AvaliacaoDao.criarEmCampo.
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

  /// Espelho das áreas que vieram junto dos produtores do servidor.
  ///
  /// Usa ConflictAlgorithm.ignore de propósito: se já existe uma linha com
  /// aquele client_id, ela é a versão local — possivelmente ainda não enviada —
  /// e sobrescrevê-la apagaria o que o avaliador registrou em campo.
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
    // A avaliação passa a conhecer o id definitivo da área a que pertence.
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
