import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';
import 'package:sqflite_common_ffi_web/sqflite_ffi_web.dart';

import '../config.dart';

class BancoLocal {
  static Database? _instancia;

  static Future<Database> get instancia async {
    _instancia ??= await _abrir();
    return _instancia!;
  }

  static Future<Database> _abrir() async {
    if (kIsWeb) {
      databaseFactory = databaseFactoryFfiWeb;
      return openDatabase(
        Config.nomeBancoLocal,
        version: _versao,
        onConfigure: _configurar,
        onCreate: _criarTabelas,
        onUpgrade: _atualizar,
      );
    }

    final caminho = p.join(await getDatabasesPath(), Config.nomeBancoLocal);
    return openDatabase(
      caminho,
      version: _versao,
      onConfigure: _configurar,
      onCreate: _criarTabelas,
      onUpgrade: _atualizar,
    );
  }

  static const int _versao = 2;

  static Future<void> _configurar(Database db) async {
    await db.execute('PRAGMA foreign_keys = ON');
  }

  static Future<void> _atualizar(Database db, int de, int para) async {
    if (de < 2) await _criarTabelaDeFotos(db);
  }

  static Future<void> _criarTabelaDeFotos(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS fotos_arquivo (
        client_id TEXT PRIMARY KEY,
        bytes     BLOB NOT NULL
      )
    ''');
  }

  static Future<void> _criarTabelas(Database db, int versao) async {
    await _criarTabelaDeFotos(db);

    await db.execute('''
      CREATE TABLE sessao (
        id          TEXT PRIMARY KEY,
        nome        TEXT NOT NULL,
        usuario     TEXT NOT NULL,
        perfil      TEXT NOT NULL,
        token       TEXT NOT NULL,
        expira_em   TEXT
      )
    ''');

    await db.execute('''
      CREATE TABLE produtores (
        client_id        TEXT PRIMARY KEY,
        id               TEXT UNIQUE,
        nome             TEXT NOT NULL,
        cpf_cnpj         TEXT NOT NULL,
        telefone         TEXT,
        endereco         TEXT,
        municipio        TEXT,
        uf               TEXT,
        forma_pagamento  TEXT NOT NULL DEFAULT 'PIX',
        tipo_chave_pix   TEXT,
        chave_pix        TEXT,
        titular_conta    TEXT,
        criado_offline   INTEGER NOT NULL DEFAULT 0,
        sincronizado_em  TEXT
      )
    ''');
    await db.execute('CREATE INDEX idx_produtores_nome ON produtores(nome)');
    await db.execute('CREATE INDEX idx_produtores_cpf ON produtores(cpf_cnpj)');

    await db.execute('''
      CREATE TABLE ervais (
        client_id              TEXT PRIMARY KEY,
        id                     TEXT UNIQUE,
        produtor_client_id     TEXT NOT NULL REFERENCES produtores(client_id) ON DELETE CASCADE,
        produtor_id            TEXT,
        identificacao          TEXT NOT NULL,
        tipo_erva              TEXT NOT NULL DEFAULT 'NATIVA',
        quantidade_estimada_kg REAL,
        idade_anos             INTEGER,
        latitude               REAL,
        longitude              REAL,
        criado_offline         INTEGER NOT NULL DEFAULT 1,
        sincronizado_em        TEXT
      )
    ''');
    await db.execute(
      'CREATE INDEX idx_ervais_produtor ON ervais(produtor_client_id)',
    );

    await db.execute('''
      CREATE TABLE avaliacoes (
        client_id              TEXT PRIMARY KEY,
        id                     TEXT UNIQUE,
        produtor_client_id     TEXT NOT NULL,
        erval_client_id        TEXT NOT NULL REFERENCES ervais(client_id) ON DELETE CASCADE,
        erval_id               TEXT,
        data_avaliacao         TEXT NOT NULL,
        tipo_erva              TEXT NOT NULL DEFAULT 'NATIVA',
        erva_queimada          TEXT NOT NULL DEFAULT 'NAO',
        idade_erval_anos       INTEGER,
        quantidade_estimada_kg REAL,
        classificacao          TEXT,
        umidade_estimada       REAL,
        talo_aparente          TEXT,
        valor_combinado_kg     REAL,
        latitude               REAL,
        longitude              REAL,
        observacoes            TEXT,
        alterado_em_origem     TEXT NOT NULL,
        sincronizado_em        TEXT
      )
    ''');
    await db.execute(
      'CREATE INDEX idx_avaliacoes_produtor ON avaliacoes(produtor_client_id)',
    );
    await db.execute(
      'CREATE INDEX idx_avaliacoes_data ON avaliacoes(data_avaliacao)',
    );

    await db.execute('''
      CREATE TABLE fotos (
        client_id            TEXT PRIMARY KEY,
        id                   TEXT UNIQUE,
        avaliacao_client_id  TEXT NOT NULL REFERENCES avaliacoes(client_id) ON DELETE CASCADE,
        caminho_local        TEXT NOT NULL,
        tamanho_bytes        INTEGER,
        largura              INTEGER,
        altura               INTEGER,
        sincronizado_em      TEXT
      )
    ''');
    await db.execute(
      'CREATE INDEX idx_fotos_avaliacao ON fotos(avaliacao_client_id)',
    );

    await db.execute('''
      CREATE TABLE fila_sincronizacao (
        sequencia            INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id            TEXT NOT NULL UNIQUE,
        entidade             TEXT NOT NULL,
        operacao             TEXT NOT NULL DEFAULT 'CREATE',
        payload              TEXT NOT NULL,
        situacao             TEXT NOT NULL DEFAULT 'PENDENTE',
        tentativas           INTEGER NOT NULL DEFAULT 0,
        ultimo_erro          TEXT,
        criado_em_origem     TEXT NOT NULL,
        proxima_tentativa_em TEXT
      )
    ''');
    await db.execute(
      'CREATE INDEX idx_fila_situacao ON fila_sincronizacao(situacao, sequencia)',
    );

    await db.execute(
      'CREATE TABLE ajustes (chave TEXT PRIMARY KEY, valor TEXT NOT NULL)',
    );
  }

  static Future<void> limparSessao() async {
    final db = await instancia;
    await db.delete('sessao');
  }

  static Future<void> gravarAjuste(String chave, String valor) async {
    final db = await instancia;
    await db.insert('ajustes', {
      'chave': chave,
      'valor': valor,
    }, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  static Future<String?> lerAjuste(String chave) async {
    final db = await instancia;
    final linhas = await db.query(
      'ajustes',
      where: 'chave = ?',
      whereArgs: [chave],
      limit: 1,
    );
    if (linhas.isEmpty) return null;
    return linhas.first['valor'] as String;
  }

  static Future<String> obterAjuste(
    String chave,
    String Function() seNaoExistir,
  ) async {
    final db = await instancia;
    final linhas = await db.query(
      'ajustes',
      where: 'chave = ?',
      whereArgs: [chave],
      limit: 1,
    );
    if (linhas.isNotEmpty) return linhas.first['valor'] as String;

    final valor = seNaoExistir();
    await db.insert('ajustes', {'chave': chave, 'valor': valor});
    return valor;
  }
}
