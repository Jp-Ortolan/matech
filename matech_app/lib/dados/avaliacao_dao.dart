// ---------------------------------------------------------------------------
// DAO · avaliações em campo  (RF05, RF17 e RF18)
// ---------------------------------------------------------------------------
// É aqui que a ordem da fila é decidida, e ela é o ponto mais delicado do
// aplicativo inteiro.
//
// Uma avaliação pode nascer com até três coisas novas em volta: um produtor
// que acabou de ser cadastrado, uma área que ainda não existia e as fotos.
// Nenhuma delas tem id de servidor — todas se referenciam por clientId. Se
// subirem fora de ordem, o servidor responde DEPENDENCIA_PENDENTE e o dado
// fica dando voltas até a ordem se resolver por sorte.
//
// Por isso tudo é gravado e enfileirado numa TRANSAÇÃO SÓ, nesta ordem:
//
//     Erval  →  Avaliacao  →  Foto, Foto, Foto...
//
// (o produtor, quando é novo, já foi enfileirado antes, na tela de cadastro —
// e como a sequencia da fila é AUTOINCREMENT, ele necessariamente tem número
// menor e sobe primeiro.)
//
// A transação também responde à pergunta "e se o aplicativo fechar no meio?":
// ou a avaliação inteira existe com a fila correspondente, ou não existe nada.
// Meia avaliação salva seria pior que nenhuma.

import '../modelos/avaliacao.dart';
import '../modelos/erval.dart';
import '../modelos/foto.dart';
import 'banco_local.dart';
import 'erval_dao.dart';
import 'fila_dao.dart';
import 'foto_dao.dart';

class AvaliacaoDao {
  /// Todas as avaliações do aparelho, mais recente primeiro, já com o nome do
  /// produtor e a contagem de fotos — a lista da tela inicial.
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

  /// Uma avaliação com o contexto que a tela de detalhe mostra.
  /// Mesma consulta da lista, filtrada — para que as duas telas não divirjam
  /// no que consideram "situação" de uma avaliação.
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

  /// A gravação completa de uma avaliação feita no erval.
  ///
  /// [ervalNovo] só vem preenchido quando o avaliador nomeou uma área nova no
  /// próprio formulário. Se ele escolheu uma área já conhecida, vem nulo e
  /// nada é enfileirado para o erval — ele já está no servidor.
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

  /// Edição de uma avaliação já gravada.
  ///
  /// alteradoEmOrigem é REESCRITO com o instante da edição — e é justamente
  /// esse valor novo que vai ganhar o desempate no servidor, mesmo que o envio
  /// chegue lá depois de outro mais antigo. O payload da fila é substituído
  /// pelo novo (o enfileirar usa ConflictAlgorithm.replace na chave clientId),
  /// de modo que nunca sobe uma versão vencida.
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

/// A avaliação com o pouco de contexto que a lista precisa mostrar.
/// Existe para que a tela não faça uma consulta por linha da lista.
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
