// ---------------------------------------------------------------------------
// DAO · produtores
// ---------------------------------------------------------------------------
// A tabela local guarda DUAS origens de produtor misturadas de propósito:
//
//   os que vieram do servidor (espelho, baixados quando havia sinal)
//   os que nasceram aqui, no erval, sem conexão
//
// Para a tela de busca não faz diferença nenhuma — e é esse o ponto. O
// avaliador procura "Fontana" e encontra, sem precisar saber se aquele
// produtor já existe no escritório ou se ele mesmo cadastrou há dez minutos.

import 'package:sqflite/sqflite.dart';

import '../modelos/erval.dart';
import '../modelos/produtor.dart';
import 'banco_local.dart';
import 'erval_dao.dart';
import 'fila_dao.dart';

class ProdutorDao {
  static Future<List<Produtor>> listar({String busca = ''}) async {
    final db = await BancoLocal.instancia;

    final termo = busca.trim();
    final linhas = await db.query(
      'produtores',
      where: termo.isEmpty ? null : 'nome LIKE ? OR cpf_cnpj LIKE ?',
      whereArgs: termo.isEmpty ? null : ['%$termo%', '%$termo%'],
      orderBy: 'nome COLLATE NOCASE ASC',
    );
    return linhas.map(Produtor.deLinha).toList();
  }

  static Future<Produtor?> porClientId(String clientId) async {
    final db = await BancoLocal.instancia;
    final linhas = await db.query(
      'produtores',
      where: 'client_id = ?',
      whereArgs: [clientId],
      limit: 1,
    );
    return linhas.isEmpty ? null : Produtor.deLinha(linhas.first);
  }

  /// Já existe alguém com este documento? Vale a checagem ANTES de gravar:
  /// o servidor barraria com 409 (cpfCnpj é @unique lá), mas isso só
  /// aconteceria horas depois, na sincronização, longe de quem digitou.
  static Future<Produtor?> porDocumento(String cpfCnpj) async {
    final db = await BancoLocal.instancia;
    final limpo = cpfCnpj.replaceAll(RegExp(r'[^0-9]'), '');
    if (limpo.isEmpty) return null;
    final linhas = await db.query(
      'produtores',
      where: 'cpf_cnpj = ?',
      whereArgs: [limpo],
      limit: 1,
    );
    return linhas.isEmpty ? null : Produtor.deLinha(linhas.first);
  }

  /// Cadastro feito em campo.
  ///
  /// Grava o produtor E enfileira o envio na MESMA transação. Se o aplicativo
  /// morrer entre uma coisa e outra, ou as duas aconteceram ou nenhuma — nunca
  /// um produtor salvo que ninguém vai enviar.
  static Future<void> criarEmCampo(Produtor produtor) async {
    final db = await BancoLocal.instancia;
    await db.transaction((txn) async {
      await txn.insert(
        'produtores',
        produtor.paraLinha(),
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
      await FilaDao.enfileirarNaTransacao(
        txn,
        clientId: produtor.clientId,
        entidade: 'Produtor',
        payload: produtor.paraPayload(),
      );
    });
  }

  /// Espelho vindo do servidor. NÃO enfileira nada: estes produtores já
  /// existem lá.
  ///
  /// Recebe cada produtor COM as áreas dele, e grava os dois numa transação
  /// só — assim nunca fica um produtor espelhado sem as áreas que a tela de
  /// avaliação vai oferecer logo em seguida.
  ///
  /// Em cima de um registro que já existe, atualiza apenas o cadastral.
  /// client_id e criado_offline ficam como estão: são a história de onde
  /// aquele registro nasceu, e um cadastro local que ainda não subiu não pode
  /// ser sobrescrito pelo espelho.
  static Future<int> guardarEspelho(
    List<({Produtor produtor, List<Erval> ervais})> doServidor,
  ) async {
    final db = await BancoLocal.instancia;
    var gravados = 0;

    await db.transaction((txn) async {
      for (final item in doServidor) {
        final p = item.produtor;

        final linhas = await txn.query(
          'produtores',
          where: 'id = ?',
          whereArgs: [p.id],
          limit: 1,
        );

        if (linhas.isEmpty) {
          await txn.insert(
            'produtores',
            p.paraLinha(),
            conflictAlgorithm: ConflictAlgorithm.ignore,
          );
          gravados++;
        } else {
          await txn.update(
            'produtores',
            {
              'nome': p.nome,
              'cpf_cnpj': p.cpfCnpj,
              'telefone': p.telefone,
              'endereco': p.endereco,
              'municipio': p.municipio,
              'uf': p.uf,
              'forma_pagamento': p.formaPagamento,
              'tipo_chave_pix': p.tipoChavePix,
              'chave_pix': p.chavePix,
              'titular_conta': p.titularConta,
            },
            where: 'id = ?',
            whereArgs: [p.id],
          );
        }

        await ErvalDao.guardarEspelho(txn, item.ervais);
      }
    });

    return gravados;
  }

  /// Chamado quando o servidor confirma o envio e devolve o id definitivo.
  static Future<void> confirmarSincronizacao(
    String clientId,
    String? idServidor,
  ) async {
    final db = await BancoLocal.instancia;
    await db.update(
      'produtores',
      {'id': idServidor, 'sincronizado_em': DateTime.now().toIso8601String()},
      where: 'client_id = ?',
      whereArgs: [clientId],
    );
    // O erval guarda o id do dono para poder subir sozinho depois.
    if (idServidor != null) {
      await db.update(
        'ervais',
        {'produtor_id': idServidor},
        where: 'produtor_client_id = ?',
        whereArgs: [clientId],
      );
    }
  }

  static Future<int> contarCriadosEmCampo() async {
    final db = await BancoLocal.instancia;
    final r = await db.rawQuery(
      'SELECT COUNT(*) AS total FROM produtores WHERE criado_offline = 1',
    );
    return (r.first['total'] as int?) ?? 0;
  }
}
