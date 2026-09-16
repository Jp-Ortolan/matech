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
