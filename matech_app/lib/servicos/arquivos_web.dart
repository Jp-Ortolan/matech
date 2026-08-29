// ---------------------------------------------------------------------------
// SERVIÇO · fotos NO NAVEGADOR
// ---------------------------------------------------------------------------
// Esta é a implementação web. A do Android está em arquivos_io.dart, e quem
// escolhe entre as duas é o export condicional em arquivos.dart.
//
// ONDE A FOTO FICA AQUI
//
// Não existe diretório privado no navegador, e o caminho que o seletor de
// arquivos devolve é uma URL temporária que morre ao recarregar a página. Um
// localizador desses guardado no banco apontaria para o nada no dia seguinte —
// que é exatamente o problema que a versão do aparelho resolve copiando o
// arquivo para fora do cache.
//
// Então aqui os BYTES são guardados, numa tabela do próprio banco local. Como
// o banco local na web é o SQLite compilado em WebAssembly sobre o IndexedDB,
// a foto sobrevive a recarregar a página e a fechar o navegador — que é a
// mesma promessa que a versão do aparelho faz.
//
// O LOCALIZADOR É O clientId, sem extensão e sem barra. Ele não é um caminho e
// não deve parecer um: quem receber este valor só o devolve para lerFoto.
//
// O QUE NÃO DÁ PARA FAZER IGUAL, e está assumido:
//
//   · Não há como saber se falta espaço antes de tentar. O navegador recusa a
//     escrita com uma exceção genérica quando a cota do IndexedDB estoura, e é
//     dela que sai o erro de "sem espaço".
//   · Não há varredura de arquivos soltos: aqui não existe arquivo solto. A
//     órfã é uma LINHA sem dono, e limparOrfas apaga por diferença de conjunto,
//     que é mais confiável que listar um diretório.

import 'dart:typed_data';
import 'dart:ui' as ui;

import '../dados/banco_local.dart';
import 'arquivos_erros.dart';

class Arquivos {
  /// A tabela existe só na web, mas é criada nos dois — ver banco_local.dart.
  static const String _tabela = 'fotos_arquivo';

  /// No navegador o localizador é o próprio clientId.
  static Future<String> caminhoDe(String clientId) async => clientId;

  /// Grava os bytes da imagem escolhida.
  ///
  /// CONFERE O RESULTADO relendo o que gravou, pelo mesmo motivo da versão do
  /// aparelho: uma foto de zero byte enfileirada é pior que uma foto ausente —
  /// ela sobe, o servidor aceita, e o que chega ao escritório é um arquivo
  /// vazio que ninguém percebe até precisar dele.
  static Future<String> guardarFoto(
    String clientId, {
    required String caminhoDeOrigem,
    required Future<Uint8List> Function() lerBytesDaOrigem,
  }) async {
    // caminhoDeOrigem é ignorado aqui: na web ele é uma URL temporária que não
    // dá para abrir. O parâmetro existe porque no aparelho é ele que vale.
    late final Uint8List bytes;
    try {
      bytes = await lerBytesDaOrigem();
    } catch (_) {
      throw const ErroDeArquivo(
        FalhaDeArquivo.escritaFalhou,
        'Não foi possível ler a imagem escolhida.',
      );
    }

    if (bytes.isEmpty) {
      throw const ErroDeArquivo(
        FalhaDeArquivo.escritaFalhou,
        'A imagem escolhida está vazia.',
      );
    }

    final db = await BancoLocal.instancia;
    try {
      await db.insert(_tabela, {'client_id': clientId, 'bytes': bytes});
    } catch (e) {
      // O navegador recusa a escrita com exceção genérica quando a cota do
      // IndexedDB estoura. Sem código de erro para inspecionar, o texto é a
      // única pista — e errar para o lado de "sem espaço" é o mais útil,
      // porque é a causa provável e tem conserto do lado do usuário.
      final texto = e.toString().toLowerCase();
      final semEspaco =
          texto.contains('quota') || texto.contains('space') || texto.contains('full');

      throw ErroDeArquivo(
        semEspaco ? FalhaDeArquivo.semEspaco : FalhaDeArquivo.escritaFalhou,
        semEspaco
            ? 'O navegador não tem espaço para guardar a foto. Libere espaço do '
                'site e tente de novo — a avaliação em si continua podendo ser salva.'
            : 'Não foi possível guardar a foto no navegador.',
      );
    }

    if (await lerFoto(clientId) == null) {
      await apagarFoto(clientId);
      throw const ErroDeArquivo(
        FalhaDeArquivo.escritaFalhou,
        'A foto foi gravada vazia.',
      );
    }

    return clientId;
  }

  static Future<Uint8List?> lerFoto(String localizador) async {
    final db = await BancoLocal.instancia;
    final linhas = await db.query(
      _tabela,
      columns: ['bytes'],
      where: 'client_id = ?',
      whereArgs: [localizador],
      limit: 1,
    );
    if (linhas.isEmpty) return null;

    final bytes = linhas.first['bytes'];
    if (bytes is! Uint8List || bytes.isEmpty) return null;
    return bytes;
  }

  /// Descarta uma foto abandonada no formulário, antes de salvar.
  static Future<void> apagarFoto(String localizador) async {
    try {
      final db = await BancoLocal.instancia;
      await db.delete(_tabela, where: 'client_id = ?', whereArgs: [localizador]);
    } catch (_) {
      // Falhar ao apagar não atrapalha ninguém: a varredura de órfãs recolhe
      // depois.
    }
  }

  /// Varredura de órfãs, na subida do aplicativo.
  ///
  /// Aqui ela é uma diferença de conjunto em vez de uma listagem de diretório,
  /// e por isso é mais confiável que a do aparelho: o banco sabe exatamente
  /// quais linhas existem.
  ///
  /// A regra continua conservadora: só apaga o que NÃO está no conjunto
  /// conhecido. Perder uma foto de avaliação é irreversível.
  static Future<int> limparOrfas(Set<String> clientIdsConhecidos) async {
    try {
      final db = await BancoLocal.instancia;
      final guardadas = await db.query(_tabela, columns: ['client_id']);

      final orfas = guardadas
          .map((l) => l['client_id'] as String)
          .where((id) => !clientIdsConhecidos.contains(id))
          .toList();

      for (final id in orfas) {
        await db.delete(_tabela, where: 'client_id = ?', whereArgs: [id]);
      }
      return orfas.length;
    } catch (_) {
      return 0;
    }
  }

  /// Largura e altura, com o decodificador que já vem no Flutter. Vão em
  /// cabeçalho junto do upload para que a web monte a miniatura sem abrir a
  /// imagem inteira.
  static Future<({int largura, int altura})?> dimensoes(String localizador) async {
    try {
      final bytes = await lerFoto(localizador);
      if (bytes == null) return null;

      final codec = await ui.instantiateImageCodec(bytes);
      final quadro = await codec.getNextFrame();
      final medidas = (largura: quadro.image.width, altura: quadro.image.height);
      quadro.image.dispose();
      codec.dispose();
      return medidas;
    } catch (_) {
      // Dimensão é acessória: se não der para ler, a foto sobe do mesmo jeito.
      return null;
    }
  }
}
