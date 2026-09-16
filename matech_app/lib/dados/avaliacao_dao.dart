import '../modelos/avaliacao.dart';
import '../modelos/erval.dart';
import '../modelos/foto.dart';
import 'banco_local.dart';
import 'erval_dao.dart';
import 'fila_dao.dart';
import 'foto_dao.dart';

class AvaliacaoDao {
  static Future<List<ResumoAvaliacao>> listar() async {
    final db = await BancoLocal.instancia;
    final linhas = await db.rawQuery('''
      SELECT  a.*,
              p.nome                       AS produtor_nome,
              e.identificacao              AS erval_identificacao,
              (SELECT COUNT(*) FROM fotos f
                WHERE f.avaliacao_client_id = a.client_id) AS total_fotos,
              (SELECT situacao FROM fila_sincronizacao q
                WHERE q.client_id = a.client_id)           AS situacao_fila
        FROM  avaliacoes a
        JOIN  produtores p ON p.client_id = a.produtor_client_id
        JOIN  ervais     e ON e.client_id = a.erval_client_id
    ORDER BY  a.data_avaliacao DESC
    ''');

    return linhas
        .map(
          (l) => ResumoAvaliacao(
            avaliacao: Avaliacao.deLinha(l),
            produtorNome: l['produtor_nome'] as String,
            ervalIdentificacao: l['erval_identificacao'] as String,
            totalFotos: (l['total_fotos'] as int?) ?? 0,
            situacaoFila: l['situacao_fila'] as String?,
          ),
        )
        .toList();
  }

  static Future<ResumoAvaliacao?> detalhe(String clientId) async {
    final db = await BancoLocal.instancia;
    final linhas = await db.rawQuery(
      '''
      SELECT  a.*,
              p.nome                       AS produtor_nome,
              e.identificacao              AS erval_identificacao,
              (SELECT COUNT(*) FROM fotos f
                WHERE f.avaliacao_client_id = a.client_id) AS total_fotos,
              (SELECT situacao FROM fila_sincronizacao q
                WHERE q.client_id = a.client_id)           AS situacao_fila
        FROM  avaliacoes a
        JOIN  produtores p ON p.client_id = a.produtor_client_id
        JOIN  ervais     e ON e.client_id = a.erval_client_id
       WHERE  a.client_id = ?
    ''',
      [clientId],
    );

    if (linhas.isEmpty) return null;
    final l = linhas.first;

    return ResumoAvaliacao(
      avaliacao: Avaliacao.deLinha(l),
      produtorNome: l['produtor_nome'] as String,
      ervalIdentificacao: l['erval_identificacao'] as String,
      totalFotos: (l['total_fotos'] as int?) ?? 0,
      situacaoFila: l['situacao_fila'] as String?,
    );
  }

  static Future<Avaliacao?> porClientId(String clientId) async {
    final db = await BancoLocal.instancia;
    final linhas = await db.query(
      'avaliacoes',
      where: 'client_id = ?',
      whereArgs: [clientId],
      limit: 1,
    );
    return linhas.isEmpty ? null : Avaliacao.deLinha(linhas.first);
  }

  static Future<void> criarEmCampo({
    Erval? ervalNovo,
    required Avaliacao avaliacao,
    required List<Foto> fotos,
  }) async {
    final db = await BancoLocal.instancia;

    await db.transaction((txn) async {
      if (ervalNovo != null) {
        await ErvalDao.criarNaTransacao(txn, ervalNovo);
      }

      await txn.insert('avaliacoes', avaliacao.paraLinha());
      await FilaDao.enfileirarNaTransacao(
        txn,
        clientId: avaliacao.clientId,
        entidade: 'Avaliacao',
        payload: avaliacao.paraPayload(),
        criadoEmOrigem: avaliacao.alteradoEmOrigem,
      );

      for (final foto in fotos) {
        await FotoDao.criarNaTransacao(txn, foto);
      }
    });
  }

  static Future<void> atualizarEmCampo(Avaliacao avaliacao) async {
    final db = await BancoLocal.instancia;
    final editada = avaliacao.copiarComAlteracao(DateTime.now());

    await db.transaction((txn) async {
      await txn.update(
        'avaliacoes',
        editada.paraLinha(),
        where: 'client_id = ?',
        whereArgs: [editada.clientId],
      );
      await FilaDao.enfileirarNaTransacao(
        txn,
        clientId: editada.clientId,
        entidade: 'Avaliacao',
        operacao: 'UPDATE',
        payload: editada.paraPayload(),
        criadoEmOrigem: editada.alteradoEmOrigem,
      );
    });
  }

  static Future<void> confirmarSincronizacao(
    String clientId,
    String? idServidor,
  ) async {
    final db = await BancoLocal.instancia;
    await db.update(
      'avaliacoes',
      {'id': idServidor, 'sincronizado_em': DateTime.now().toIso8601String()},
      where: 'client_id = ?',
      whereArgs: [clientId],
    );
  }

  static Future<int> contarNaoSincronizadas() async {
    final db = await BancoLocal.instancia;
    final r = await db.rawQuery(
      'SELECT COUNT(*) AS total FROM avaliacoes WHERE sincronizado_em IS NULL',
    );
    return (r.first['total'] as int?) ?? 0;
  }
}

class ResumoAvaliacao {
  final Avaliacao avaliacao;
  final String produtorNome;
  final String ervalIdentificacao;
  final int totalFotos;
  final String? situacaoFila;

  const ResumoAvaliacao({
    required this.avaliacao,
    required this.produtorNome,
    required this.ervalIdentificacao,
    required this.totalFotos,
    this.situacaoFila,
  });
}
