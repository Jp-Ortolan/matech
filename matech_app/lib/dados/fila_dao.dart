// ---------------------------------------------------------------------------
// DAO · fila de sincronização  (RNF08)
// ---------------------------------------------------------------------------
// A fila é o padrão Outbox: a INTENÇÃO de enviar é gravada no mesmo banco, e
// na mesma transação, que o dado. Não existe instante em que a avaliação está
// salva e a vontade de enviá-la não está — que é exatamente o buraco por onde
// os dados somem em aplicativos que "enviam depois".
//
// A ORDEM É PARTE DA CORREÇÃO, não um detalhe de desempenho. O servidor
// resolve as dependências dentro do lote lendo as operações uma a uma, na
// ordem em que chegam. Se a avaliação subisse antes do erval, o servidor
// responderia DEPENDENCIA_PENDENTE e o dado ficaria dando voltas. A coluna
// sequencia (AUTOINCREMENT) é o que garante o FIFO — e ela existe porque
// ordenar por data de criação empataria: produtor, erval e avaliação de um
// mesmo formulário nascem no mesmo segundo.

import 'dart:convert';

import 'package:sqflite/sqflite.dart';

import '../modelos/operacao_pendente.dart';
import '../servicos/politica_de_tentativas.dart';
import 'banco_local.dart';

class FilaDao {
  /// Enfileira DENTRO de uma transação já aberta. É sempre assim que o
  /// enfileiramento acontece: junto da gravação do dado, nunca solto.
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
      // Reenfileirar o mesmo clientId SUBSTITUI a linha: o payload novo é o
      // que vale, e nunca sobe uma versão vencida. A linha nova ganha uma
      // sequencia nova, ou seja, vai para o fim da fila — o que é correto,
      // porque nesse ponto o produtor e o erval de que ela depende já subiram.
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  /// O que sobe na próxima passada.
  ///
  /// Dois filtros importam: só entra o que está aguardando (PENDENTE ou
  /// PENDENTE_DEPENDENCIA) e só o que já passou da hora de tentar de novo —
  /// é a espera crescente da PoliticaDeTentativas, que evita martelar um
  /// servidor fora do ar.
  ///
  /// [limite] é OBRIGATÓRIO de propósito. Ele já teve um valor padrão de 25
  /// aqui, igual ao Config.tamanhoDoLote — e o analisador acusou o argumento
  /// como redundante, o que estava certo pelo motivo errado: o problema não
  /// era passar o número, era ele existir em DOIS lugares. Bastaria alguém
  /// ajustar o Config para o padrão daqui continuar valendo em silêncio em
  /// qualquer chamada que esquecesse o argumento.
  ///
  /// Além disso, tamanho de lote não é decisão deste arquivo. A fila sabe ler
  /// a fila; quanto cabe numa requisição é assunto de quem conhece a rede.
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

  /// As fotos saem por fora do lote, uma requisição cada — ver o modelo Foto.
  ///
  /// [limite] obrigatório pelo mesmo motivo de proximasDoLote: o número vive
  /// num lugar só, com quem decide.
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

  /// DEPENDENCIA_PENDENTE não é falha: o dado está bom, só chegou fora de
  /// ordem, e na esmagadora maioria das vezes a rodada seguinte resolve.
  ///
  /// Por isso as três primeiras rodadas são baratas — vinte segundos, sem
  /// escalonar. Só a partir da quarta a espera passa a crescer pela mesma
  /// escada dos erros de rede, porque aí já não é mais "fora de ordem": é
  /// sinal de que o pai não está subindo.
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

  /// O servidor recusou por regra de negócio (4xx). Insistir não conserta:
  /// um CPF duplicado continua duplicado na décima tentativa. Fica parado,
  /// visível na tela de sincronização, esperando uma pessoa decidir.
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

  /// Falhou por rede ou por erro do servidor (5xx). Aí vale insistir, com
  /// espera crescente — a escada está em PoliticaDeTentativas.
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

  /// Usado pela tela de sincronização, no botão "tentar de novo": zera a
  /// espera e a contagem de uma operação que estava parada em ERRO.
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

  /// Chamado logo depois de uma operação ser ACEITA pelo servidor.
  ///
  /// Se o produtor acabou de subir, a área e a avaliação que esperavam por ele
  /// já podem ir — não faz sentido deixá-las esperando os vinte segundos que
  /// foram agendados quando o pai ainda não existia. Zerar a espera faz a
  /// mesma passada de sincronização resolver a cadeia inteira, em vez de
  /// precisar de três passadas para subir produtor, área e avaliação.
  static Future<void> liberarDependentes() async {
    final db = await BancoLocal.instancia;
    await db.update(
      'fila_sincronizacao',
      {'proxima_tentativa_em': null},
      where: 'situacao = ?',
      whereArgs: [OperacaoPendente.dependencia],
    );
  }

  /// Empurra para frente tudo que está pronto para subir agora.
  ///
  /// Usado quando a passada inteira fracassou por REDE. Sem isto, as operações
  /// que nem chegaram a ser tentadas continuariam elegíveis, o despertador
  /// acordaria em cinco segundos e o aplicativo entraria num laço apertado
  /// tentando falar com um servidor que se sabe inalcançável — gastando
  /// bateria justamente onde ela é mais escassa.
  ///
  /// Não conta como tentativa: elas de fato não foram tentadas.
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

  /// Quando é a hora da próxima operação que está esperando.
  ///
  /// É o que permite ao aplicativo HONRAR a espera crescente. Sem isto, uma
  /// operação reagendada para daqui a trinta minutos só seria retentada se o
  /// usuário abrisse o aplicativo de novo — a escada do Config seria decorativa.
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

  /// Existe alguma operação pronta para subir AGORA?
  /// Usado para decidir se vale acordar e tentar.
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

  /// Reativa TODAS as operações recusadas de uma vez.
  ///
  /// Serve para o caso em que a causa era comum a várias — o servidor estava
  /// fora do ar, a sessão tinha expirado — e reativar uma a uma seria
  /// trabalho manual sem propósito.
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

  /// Os números da tela de sincronização — e o mesmo indicador que o servidor
  /// calcula no /resumo, só que visto do lado do aparelho.
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
