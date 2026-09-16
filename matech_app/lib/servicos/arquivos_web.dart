import 'dart:typed_data';
import 'dart:ui' as ui;

import '../dados/banco_local.dart';
import 'arquivos_erros.dart';

class Arquivos {
  static const String _tabela = 'fotos_arquivo';

  static Future<String> caminhoDe(String clientId) async => clientId;

  static Future<String> guardarFoto(
    String clientId, {
    required String caminhoDeOrigem,
    required Future<Uint8List> Function() lerBytesDaOrigem,
  }) async {
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

  static Future<void> apagarFoto(String localizador) async {
    try {
      final db = await BancoLocal.instancia;
      await db.delete(_tabela, where: 'client_id = ?', whereArgs: [localizador]);
    } catch (_) {
    }
  }

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
      return null;
    }
  }
}
