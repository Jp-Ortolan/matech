// ---------------------------------------------------------------------------
// DAO · fotos do erval
// ---------------------------------------------------------------------------
// A linha aqui guarda o CAMINHO da imagem no aparelho, não a imagem. O arquivo
// fica no diretório privado do aplicativo (ver servicos/arquivos.dart) e é ele
// que o sincronizador lê na hora de enviar.
//
// Enquanto sincronizado_em é nulo, aquele arquivo é o ÚNICO lugar do mundo
// onde a foto existe — motivo pelo qual ele não é apagado depois do envio:
// apagar é operação irreversível em cima da prova de uma avaliação.

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
      // O payload da foto não leva a imagem: leva onde encontrá-la. Guardar
      // 3 MB em base64 dentro da fila incharia o banco local sem motivo —
      // o arquivo já está em disco.
      payload: {
        'avaliacaoClientId': foto.avaliacaoClientId,
        'caminhoLocal': foto.caminhoLocal,
        'largura': foto.largura,
        'altura': foto.altura,
      },
    );
  }

  /// Acrescenta fotos a uma avaliação QUE JÁ EXISTE.
  ///
  /// Diferente do caminho de criação, onde as fotos entram na mesma transação
  /// da avaliação: aqui a avaliação já está gravada (e talvez já sincronizada),
  /// e só as fotos novas precisam de linha e de fila.
  ///
  /// A avaliação NÃO é reenfileirada por causa disto. Uma foto nova não muda
  /// nenhum campo dela, e reenviá-la só para acompanhar a foto gastaria dados
  /// e ainda mexeria no alteradoEmOrigem — fazendo o servidor pensar que houve
  /// uma edição que não houve, com risco de essa "edição" vazia vencer uma
  /// correção de verdade feita em outro lugar.
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

  /// Todos os client_id de foto que o banco conhece.
  ///
  /// É a lista contra a qual a varredura de órfãs compara os arquivos em
  /// disco. Vem do banco, e não da pasta, porque o banco é a autoridade: um
  /// arquivo sem linha é lixo; uma linha sem arquivo é um problema (tratado
  /// em `marcarArquivoAusente`).
  static Future<Set<String>> todosOsClientIds() async {
    final db = await BancoLocal.instancia;
    final linhas = await db.query('fotos', columns: ['client_id']);
    return linhas.map((l) => l['client_id'] as String).toSet();
  }

  /// O arquivo sumiu do aparelho — o sistema limpou, o usuário apagou por
  /// algum gerenciador, o cartão foi removido.
  ///
  /// A linha NÃO é apagada. Ela é a prova de que aquela avaliação teve uma
  /// foto, e apagá-la faria o registro parecer completo quando não está. Fica
  /// gravada com o motivo, visível na tela de sincronização, para que alguém
  /// possa decidir — inclusive voltar ao erval e fotografar de novo.
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
