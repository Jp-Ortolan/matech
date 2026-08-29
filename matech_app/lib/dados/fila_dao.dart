// ---------------------------------------------------------------------------
// DAO · fila de sincronização
// ---------------------------------------------------------------------------
// A fila é uma tabela como outra qualquer. O que a torna confiável são duas
// regras que este arquivo impõe:
//
//   1. Nada entra na fila fora da transação que grava o dado. Por isso o
//      método enfileirar() EXIGE receber uma transação: quem chama é obrigado
//      a estar dentro de uma. Não existe caminho no código que salve uma
//      avaliação e "esqueça" de enfileirá-la.
//
//   2. A ordem de saída é a de entrada (sequencia AUTOINCREMENT), porque o
//      produtor tem de subir antes do erval, que tem de subir antes da
//      avaliação.

import 'dart:convert';

import 'package:sqflite/sqflite.dart';

import '../config.dart';
import '../modelos/operacao_pendente.dart';
import 'banco_local.dart';

class FilaDao {
  /// Acrescenta uma operação à fila DENTRO da transação de quem chamou.
  ///
  /// O tipo do parâmetro é DatabaseExecutor, que tanto Database quanto
  /// Transaction implementam — mas todos os chamadores deste projeto passam
  /// uma Transaction, e é assim que a atomicidade fica garantida.
  static Future<void> enfileirar(
    DatabaseExecutor txn, {
    required String clientId,
    required String entidade,
    required Map<String, dynamic> payload,
    required DateTime criadoEmOrigem,
    String operacao = 'CREATE',
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
        'criado_em_origem': criadoEmOrigem.toIso8601String(),
      },
      // Editar uma avaliação que ainda não subiu substitui a operação na fila
      // em vez de criar uma segunda. O servidor receberia as duas e a segunda
      // venceria de qualquer jeito — mandar as duas seria gastar a conexão do
      // avaliador com um dado que já nasce descartado.
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  /// O próximo lote a enviar: em ordem de entrada, só o que está aguardando e
  /// só o que já passou da hora de tentar de novo.
  static Future<List<OperacaoPendente>> proximoLote({int? limite}) async {
    final db = await BancoLocal.instancia;
    final agora = DateTime.now().toIso8601String();

    final linhas = await db.query(
      'fila_sincronizacao',
      where: 'situacao IN (?, ?) AND (proxima_tentativa_em IS NULL OR proxima_tentativa_em <= ?)',
      whereArgs: [OperacaoPendente.pendente, OperacaoPendente.dependencia, agora],
      orderBy: 'sequencia ASC',
      limit: limite ?? Config.tamanhoDoLote,
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
        'tentativas': 0,
      },
      where: 'client_id = ?',
      whereArgs: [clientId],
    );
  }

  /// Recusa por regra de negócio (4xx). Insistir não resolve — um CPF
  /// duplicado continuará duplicado na décima tentativa. Fica parado,
  /// visível na tela de Fila, esperando uma pessoa decidir o que fazer.
  static Future<void> marcarErro(String clientId, String mensagem) async {
    final db = await BancoLocal.instancia;
    await db.rawUpdate(
      'UPDATE fila_sincronizacao SET situacao = ?, ultimo_erro = ?, '
      'tentativas = tentativas + 1, proxima_tentativa_em = NULL WHERE client_id = ?',
      [OperacaoPendente.erro, mensagem, clientId],
    );
  }

  /// O servidor entendeu, mas a dependência ainda não chegou lá. Volta para a
  /// fila SEM contar como erro: a próxima passada resolve sozinha, depois que
  /// o produtor (ou o erval) subir.
  static Future<void> marcarDependenciaPendente(String clientId, String? mensagem) async {
    final db = await BancoLocal.instancia;
    await db.update(
      'fila_sincronizacao',
      {
        'situacao': OperacaoPendente.dependencia,
        'ultimo_erro': mensagem,
        'proxima_tentativa_em': DateTime.now().add(const Duration(seconds: 5)).toIso8601String(),
      },
      where: 'client_id = ?',
      whereArgs: [clientId],
    );
  }

  /// Falha de rede ou servidor fora do ar: reagenda com espera crescente.
  static Future<void> reagendar(String clientId, int tentativasFeitas, String motivo) async {
    final db = await BancoLocal.instancia;
    final indice = tentativasFeitas.clamp(0, Config.esperaEntreTentativas.length - 1);
    final espera = Config.esperaEntreTentativas[indice];

    await db.rawUpdate(
      'UPDATE fila_sincronizacao SET tentativas = tentativas + 1, ultimo_erro = ?, '
      'proxima_tentativa_em = ?, situacao = ? WHERE client_id = ?',
      [motivo, DateTime.now().add(espera).toIso8601String(), OperacaoPendente.pendente, clientId],
    );
  }

  /// Reabre um item que estava em ERRO, depois de a pessoa corrigir o dado.
  static Future<void> tentarDeNovo(String clientId) async {
    final db = await BancoLocal.instancia;
    await db.update(
      'fila_sincronizacao',
      {'situacao': OperacaoPendente.pendente, 'proxima_tentativa_em': null, 'ultimo_erro': null},
      where: 'client_id = ?',
      whereArgs: [clientId],
    );
  }

  static Future<List<OperacaoPendente>> todas({String? situacao}) async {
    final db = await BancoLocal.instancia;
    final linhas = await db.query(
      'fila_sincronizacao',
      where: situacao == null ? null : 'situacao = ?',
      whereArgs: situacao == null ? null : [situacao],
      orderBy: 'sequencia DESC',
      limit: 300,
    );
    return linhas.map(OperacaoPendente.deLinha).toList();
  }

  /// Os números que a tela inicial mostra — e que espelham, do lado do
  /// aparelho, a taxa de sincronização do Quadro 7.
  static Future<ResumoDaFila> resumo() async {
    final db = await BancoLocal.instancia;
    final linhas = await db.rawQuery(
      'SELECT situacao, COUNT(*) AS total FROM fila_sincronizacao GROUP BY situacao',
    );

    var pendentes = 0, enviadas = 0, comErro = 0, aguardandoDependencia = 0;
    for (final l in linhas) {
      final total = (l['total'] as int?) ?? 0;
      switch (l['situacao'] as String) {
        case OperacaoPendente.pendente:
          pendentes = total;
        case OperacaoPendente.enviada:
          enviadas = total;
        case OperacaoPendente.erro:
          comErro = total;
        case OperacaoPendente.dependencia:
          aguardandoDependencia = total;
      }
    }
    return ResumoDaFila(
      pendentes: pendentes,
      enviadas: enviadas,
      comErro: comErro,
      aguardandoDependencia: aguardandoDependencia,
    );
  }
}

class ResumoDaFila {
  final int pendentes;
  final int enviadas;
  final int comErro;
  final int aguardandoDependencia;

  const ResumoDaFila({
    required this.pendentes,
    required this.enviadas,
    required this.comErro,
    required this.aguardandoDependencia,
  });

  int get total => pendentes + enviadas + comErro + aguardandoDependencia;
  int get aguardando => pendentes + aguardandoDependencia;

  /// Enviadas ÷ total coletado. É o indicador do Quadro 7, visto do aparelho.
  double? get taxaSincronizacao => total == 0 ? null : (enviadas / total) * 100;
}
