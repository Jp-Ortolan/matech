import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

import 'arquivos_erros.dart';

class Arquivos {
  static Future<Directory> pastaDeFotos() async {
    final base = p.dirname(await getDatabasesPath());
    final pasta = Directory(p.join(base, 'fotos'));
    if (!pasta.existsSync()) pasta.createSync(recursive: true);
    return pasta;
  }

  static Future<String> caminhoDe(String clientId) async =>
      p.join((await pastaDeFotos()).path, '$clientId.jpg');

  static Future<String> guardarFoto(
    String clientId, {
    required String caminhoDeOrigem,
    required Future<Uint8List> Function() lerBytesDaOrigem,
  }) async {
    final destino = await caminhoDe(clientId);

    try {
      await File(caminhoDeOrigem).copy(destino);
    } on FileSystemException catch (e) {
      final semEspaco =
          e.osError?.errorCode == 28 ||
          (e.osError?.message.toLowerCase().contains('no space') ?? false);

      throw ErroDeArquivo(
        semEspaco ? FalhaDeArquivo.semEspaco : FalhaDeArquivo.escritaFalhou,
        semEspaco
            ? 'Não há espaço no aparelho para guardar a foto. Libere espaço e '
                'tente de novo — a avaliação em si continua podendo ser salva.'
            : 'Não foi possível guardar a foto no aparelho.',
      );
    }

    final gravado = File(destino);
    if (!gravado.existsSync() || gravado.lengthSync() == 0) {
      if (gravado.existsSync()) gravado.deleteSync();
      throw const ErroDeArquivo(
        FalhaDeArquivo.escritaFalhou,
        'A foto foi copiada vazia. Pode ser falta de espaço no aparelho.',
      );
    }

    return destino;
  }

  static Future<Uint8List?> lerFoto(String caminho) async {
    final arquivo = File(caminho);
    if (!arquivo.existsSync()) return null;

    final bytes = await arquivo.readAsBytes();
    return bytes.isEmpty ? null : bytes;
  }

  static Future<void> apagarFoto(String caminho) async {
    try {
      final arquivo = File(caminho);
      if (arquivo.existsSync()) arquivo.deleteSync();
    } catch (_) {
    }
  }

  static Future<int> limparOrfas(Set<String> clientIdsConhecidos) async {
    var apagadas = 0;

    try {
      final pasta = await pastaDeFotos();
      await for (final item in pasta.list()) {
        if (item is! File) continue;

        final nome = p.basenameWithoutExtension(item.path);
        if (clientIdsConhecidos.contains(nome)) continue;

        item.deleteSync();
        apagadas++;
      }
    } catch (_) {
    }

    return apagadas;
  }

  static Future<({int largura, int altura})?> dimensoes(String caminho) async {
    try {
      final bytes = await lerFoto(caminho);
      if (bytes == null) return null;

      final codec = await ui.instantiateImageCodec(bytes);
      final quadro = await codec.getNextFrame();
      final medidas = (
        largura: quadro.image.width,
        altura: quadro.image.height,
      );
      quadro.image.dispose();
      codec.dispose();
      return medidas;
    } catch (_) {
      return null;
    }
  }
}
