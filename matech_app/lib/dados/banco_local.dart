// ---------------------------------------------------------------------------
// BANCO LOCAL · sqflite
// ---------------------------------------------------------------------------
// O banco do aparelho não é um cache: é a fonte da verdade enquanto não há
// conexão. Toda tela lê daqui, sempre — inclusive quando há internet. A rede
// só alimenta este banco; nunca é consultada direto por uma tela.
//
// Essa regra é o que faz o aplicativo se comportar igual com e sem sinal. Se
// uma tela consultasse a API diretamente, ela ficaria em branco no erval, e o
// avaliador não saberia dizer se o produtor não existe ou se é o sinal que
// caiu.
//
// SEIS TABELAS:
//   sessao              quem está logado e o token
//   produtores          espelho do servidor + os criados em campo
//   ervais              as áreas de colheita
//   avaliacoes          o que este aplicativo produz
//   fotos               caminho no aparelho + estado de envio
//   fila_sincronizacao  a intenção de enviar cada coisa, em ordem
//
// PADRÃO QUE SE REPETE EM TODAS: client_id é a chave primária, e id (do
// servidor) é apenas mais uma coluna, que começa nula. Ao contrário do
// habitual, aqui a identidade nasce no aparelho, não no banco central — é o
// que permite criar um produtor e uma avaliação dele antes de existir conexão.

import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

import '../config.dart';

class BancoLocal {
  static Database? _instancia;

  /// Abre uma vez e reaproveita. Abrir a cada consulta esgotaria os descritores
  /// de arquivo do Android num dia de coleta.
  static Future<Database> get instancia async {
    _instancia ??= await _abrir();
    return _instancia!;
  }

  static Future<Database> _abrir() async {
    final caminho = p.join(await getDatabasesPath(), Config.nomeBancoLocal);
    return openDatabase(
      caminho,
      version: 1,
      onConfigure: (db) async {
        // As chaves estrangeiras deste banco apontam para client_id, e é o
        // SQLite que precisa ser avisado para respeitá-las.
        await db.execute('PRAGMA foreign_keys = ON');
      },
      onCreate: _criarTabelas,
    );
  }

  static Future<void> _criarTabelas(Database db, int versao) async {
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
    // A busca da tela de produtores filtra por nome; sem índice, cada tecla
    // digitada varreria a tabela inteira.
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

    // A fila. sequencia é AUTOINCREMENT porque a ORDEM importa: o produtor
    // precisa subir antes do erval, que precisa subir antes da avaliação.
    // Ordenar por data de criação não bastaria — dois registros criados no
    // mesmo segundo (o que acontece o tempo todo num formulário) empatariam.
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

    // Guarda o identificador deste aparelho. Nasce uma vez e não muda mais:
    // é por ele que o servidor separa a taxa de sincronização por celular.
    await db.execute(
      'CREATE TABLE ajustes (chave TEXT PRIMARY KEY, valor TEXT NOT NULL)',
    );
  }

  /// Usado ao sair do aplicativo: apaga a sessão, mas **preserva os dados e a
  /// fila**. Sair da conta não pode significar perder um dia de coleta que
  /// ainda não subiu.
  static Future<void> limparSessao() async {
    final db = await instancia;
    await db.delete('sessao');
  }

  /// Grava (ou substitui) um ajuste. Usado para marcar coisas que acontecem
  /// uma vez por instalação, como "o preparo para o campo já foi mostrado".
  static Future<void> gravarAjuste(String chave, String valor) async {
    final db = await instancia;
    await db.insert('ajustes', {
      'chave': chave,
      'valor': valor,
    }, conflictAlgorithm: ConflictAlgorithm.replace);
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
