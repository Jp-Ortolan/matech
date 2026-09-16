import 'dart:convert';

import 'package:sqflite/sqflite.dart';

import '../modelos/operacao_pendente.dart';
import '../servicos/politica_de_tentativas.dart';
import 'banco_local.dart';

class FilaDao {
  static Future<void> enfileirarNaTransacao(
    Transaction txn, {
    required String clientId,
    required String entidade,
    required Map<String, dynamic> payload,
    String operacao = 'CREATE',
    DateTime? criadoEmOrigem,
  }) async {
    await txn.insert(
      'fila_sincronizacao',
      {
        'client_id': clientId,
        'entidade': entidade,
        'operacao': operacao,
        'payload': jsonEncode(payload),
        'situacao': OperacaoPendente.pendente,
        'tentativas': 0,
        'criado_em_origem':
            (criadoEmOrigem ?? DateTime.now()).toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  static Future<List<OperacaoPendente>> proximasDoLote({
    required int limite,
  }) async {
    final db = await BancoLocal.instancia;
    final agora = DateTime.now().toIso8601String();

    final linhas = await db.query(
      'fila_sincronizacao',
      where: '''
        situacao IN (?, ?)
        AND entidade != ?
        AND (proxima_tentativa_em IS NULL OR proxima_tentativa_em <= ?)
      ''',
      whereArgs: [
        OperacaoPendente.pendente,
        OperacaoPendente.dependencia,
        'FotoErval',
        agora,
      ],
      orderBy: 'sequencia ASC',
      limit: limite,
    );
    return linhas.map(OperacaoPendente.deLinha).toList();
  }

  static Future<List<OperacaoPendente>> proximasFotos({
    required int limite,
  }) async {
    final db = await BancoLocal.instancia;
    final agora = DateTime.now().toIso8601String();

    final linhas = await db.query(
      'fila_sincronizacao',
      where: '''
        situacao IN (?, ?)
        AND entidade = ?
        AND (proxima_tentativa_em IS NULL OR proxima_tentativa_em <= ?)
      ''',
      whereArgs: [
        OperacaoPendente.pendente,
        OperacaoPendente.dependencia,
        'FotoErval',
        agora,
      ],
      orderBy: 'sequencia ASC',
      limit: limite,
    );
    return linhas.map(OperacaoPendente.deLinha).toList();
  }

  static Future<void> marcarEnviada(String clientId) async {
    final db = await BancoLocal.instancia;
    await db.update(
      'fila_sincronizacao',
      {
        'situacao': OperacaoPendente.enviada,
        'ultimo_erro': null,
        'proxima_tentativa_em': null,
      },
      where: 'client_id = ?',
      whereArgs: [clientId],
    );
  }

  static Future<int> apontarPaiPeloId({
    required String campoClientId,
    required String campoId,
    required String clientIdDoPai,
    required String idDoPai,
  }) async {
    final db = await BancoLocal.instancia;
    var corrigidas = 0;

    await db.transaction((txn) async {
      final linhas = await txn.query(
        'fila_sincronizacao',
        columns: ['client_id', 'payload'],
        where: 'situacao <> ?',
        whereArgs: [OperacaoPendente.enviada],
      );

      for (final l in linhas) {
        final novoPayload = payloadApontandoPai(
          l['payload'] as String,
          campoClientId: campoClientId,
          campoId: campoId,
          clientIdDoPai: clientIdDoPai,
          idDoPai: idDoPai,
        );
        if (novoPayload == null) continue;

        await txn.update(
          'fila_sincronizacao',
          {'payload': novoPayload},
          where: 'client_id = ?',
          whereArgs: [l['client_id']],
        );
        corrigidas++;
      }
    });

    return corrigidas;
  }

  static Future<void> marcarDependenciaPendente(
    String clientId,
    String? motivo, {
    required int rodadas,
  }) async {
    final db = await BancoLocal.instancia;

    if (PoliticaDeTentativas.desistirDaDependencia(rodadas)) {
      await marcarErro(
        clientId,
        'O registro do qual esta operação depende não chegou ao servidor '
        'depois de $rodadas tentativas. Verifique se ele foi recusado.',
      );
      return;
    }

    final espera = PoliticaDeTentativas.esperaDeDependencia(rodadas);

    await db.update(
      'fila_sincronizacao',
      {
        'situacao': OperacaoPendente.dependencia,
        'tentativas': rodadas,
        'ultimo_erro': motivo,
        'proxima_tentativa_em': DateTime.now().add(espera).toIso8601String(),
      },
      where: 'client_id = ?',
      whereArgs: [clientId],
    );
  }

  static Future<void> marcarErro(String clientId, String mensagem) async {
    final db = await BancoLocal.instancia;
    await db.update(
      'fila_sincronizacao',
      {
        'situacao': OperacaoPendente.erro,
        'ultimo_erro': mensagem,
        'proxima_tentativa_em': null,
      },
      where: 'client_id = ?',
      whereArgs: [clientId],
    );
  }

  static Future<void> reagendar(
    String clientId, {
    required int tentativas,
    required Duration espera,
    String? motivo,
  }) async {
    final db = await BancoLocal.instancia;
    await db.update(
      'fila_sincronizacao',
      {
        'situacao': OperacaoPendente.pendente,
        'tentativas': tentativas,
        'ultimo_erro': motivo,
        'proxima_tentativa_em': DateTime.now().add(espera).toIso8601String(),
      },
      where: 'client_id = ?',
      whereArgs: [clientId],
    );
  }

  static Future<void> reativar(String clientId) async {
    final db = await BancoLocal.instancia;
    await db.update(
      'fila_sincronizacao',
      {
        'situacao': OperacaoPendente.pendente,
        'tentativas': 0,
        'ultimo_erro': null,
        'proxima_tentativa_em': null,
      },
      where: 'client_id = ?',
      whereArgs: [clientId],
    );
  }

  static Future<void> liberarDependentes() async {
    final db = await BancoLocal.instancia;
    await db.update(
      'fila_sincronizacao',
      {'proxima_tentativa_em': null},
      where: 'situacao = ?',
      whereArgs: [OperacaoPendente.dependencia],
    );
  }

  static Future<void> adiarProntos(Duration espera) async {
    final db = await BancoLocal.instancia;
    final agora = DateTime.now().toIso8601String();

    await db.update(
      'fila_sincronizacao',
      {'proxima_tentativa_em': DateTime.now().add(espera).toIso8601String()},
      where: '''
        situacao IN (?, ?)
        AND (proxima_tentativa_em IS NULL OR proxima_tentativa_em <= ?)
      ''',
      whereArgs: [
        OperacaoPendente.pendente,
        OperacaoPendente.dependencia,
        agora,
      ],
    );
  }

  static Future<DateTime?> proximoDespertar() async {
    final db = await BancoLocal.instancia;
    final linhas = await db.rawQuery(
      '''
      SELECT MIN(proxima_tentativa_em) AS proximo
        FROM fila_sincronizacao
       WHERE situacao IN (?, ?)
         AND proxima_tentativa_em IS NOT NULL
      ''',
      [OperacaoPendente.pendente, OperacaoPendente.dependencia],
    );

    final valor = linhas.first['proximo'] as String?;
    return valor == null ? null : DateTime.tryParse(valor);
  }

  static Future<bool> temAlgoPronto() async {
    final db = await BancoLocal.instancia;
    final agora = DateTime.now().toIso8601String();
    final linhas = await db.rawQuery(
      '''
      SELECT COUNT(*) AS total
        FROM fila_sincronizacao
       WHERE situacao IN (?, ?)
         AND (proxima_tentativa_em IS NULL OR proxima_tentativa_em <= ?)
      ''',
      [OperacaoPendente.pendente, OperacaoPendente.dependencia, agora],
    );
    return ((linhas.first['total'] as int?) ?? 0) > 0;
  }

  static Future<int> reativarTodas() async {
    final db = await BancoLocal.instancia;
    return db.update(
      'fila_sincronizacao',
      {
        'situacao': OperacaoPendente.pendente,
        'tentativas': 0,
        'ultimo_erro': null,
        'proxima_tentativa_em': null,
      },
      where: 'situacao = ?',
      whereArgs: [OperacaoPendente.erro],
    );
  }

  static Future<Map<String, int>> contagens() async {
    final db = await BancoLocal.instancia;
    final linhas = await db.rawQuery(
      'SELECT situacao, COUNT(*) AS total FROM fila_sincronizacao GROUP BY situacao',
    );

    final mapa = <String, int>{
      OperacaoPendente.pendente: 0,
      OperacaoPendente.dependencia: 0,
      OperacaoPendente.enviada: 0,
      OperacaoPendente.erro: 0,
    };
    for (final l in linhas) {
      mapa[l['situacao'] as String] = (l['total'] as int?) ?? 0;
    }
    return mapa;
  }

  static Future<List<OperacaoPendente>> todas({String? situacao}) async {
    final db = await BancoLocal.instancia;
    final linhas = await db.query(
      'fila_sincronizacao',
      where: situacao == null ? null : 'situacao = ?',
      whereArgs: situacao == null ? null : [situacao],
      orderBy: 'sequencia DESC',
      limit: 200,
    );
    return linhas.map(OperacaoPendente.deLinha).toList();
  }
}

String? payloadApontandoPai(
  String payloadJson, {
  required String campoClientId,
  required String campoId,
  required String clientIdDoPai,
  required String idDoPai,
}) {
  final Map<String, dynamic> payload;
  try {
    payload = jsonDecode(payloadJson) as Map<String, dynamic>;
  } catch (_) {
    return null;
  }

  if (payload[campoClientId] != clientIdDoPai) return null;
  if (payload[campoId] == idDoPai) return null;

  payload[campoId] = idDoPai;
  return jsonEncode(payload);
}
