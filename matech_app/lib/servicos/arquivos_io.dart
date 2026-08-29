// ---------------------------------------------------------------------------
// SERVIÇO · arquivos de foto NO APARELHO
// ---------------------------------------------------------------------------
// Esta é a implementação do Android. A do navegador está em arquivos_web.dart,
// e quem escolhe entre as duas é o export condicional em arquivos.dart —
// nenhuma tela importa este arquivo diretamente.
//
// O comportamento aqui NÃO MUDOU ao ganhar a versão web. A única diferença é
// a assinatura de guardarFoto, que passou a receber também um jeito de ler os
// bytes da origem: no aparelho ele é ignorado, porque copiar arquivo é mais
// barato que carregar a imagem inteira na memória para gravá-la de volta.
// ---------------------------------------------------------------------------
// ONDE A FOTO FICA, E POR QUÊ
//
// A câmera entrega o arquivo num diretório de CACHE. Cache, no Android, é a
// primeira coisa que o sistema apaga quando o armazenamento aperta — e o
// aparelho de quem passa o dia no erval fotografando é exatamente o aparelho
// onde o armazenamento aperta. Guardar só o caminho do cache faria a foto
// sumir dias depois, sem aviso, e o sincronizador encontraria um caminho
// apontando para o nada.
//
// Então a foto é COPIADA, no ato da captura, para:
//
//     <diretório privado do aplicativo>/fotos/<clientId>.jpg
//
// e ali ela só some se o aplicativo for desinstalado.
//
// O NOME DO ARQUIVO É O clientId, e isso não é conveniência: é o que amarra o
// arquivo ao registro. O mesmo identificador aparece em três lugares —
//
//     o nome do arquivo em disco
//     a coluna client_id da tabela fotos (com avaliacao_client_id apontando
//       para a avaliação dona)
//     a linha da fila_sincronizacao com entidade 'FotoErval'
//
// — e é ele que viaja no cabeçalho x-client-id do upload, servindo de chave de
// idempotência no servidor. Um UUID: dois envios nunca disputam o mesmo
// arquivo, e reenviar não cria uma segunda cópia lá.
//
// POR QUE ISSO NÃO USA path_provider: o sqflite já sabe dizer onde fica o
// diretório privado deste aplicativo, porque é lá que ele põe o banco. Uma
// dependência inteira para descobrir um caminho que já temos não se paga.

import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

import 'arquivos_erros.dart';

class Arquivos {
  static Future<Directory> pastaDeFotos() async {
    // getDatabasesPath() devolve .../<pacote>/databases; subimos um nível.
    final base = p.dirname(await getDatabasesPath());
    final pasta = Directory(p.join(base, 'fotos'));
    // Versões síncronas de propósito: em Dart, as assíncronas de metadado
    // (exists, length, delete) são mais LENTAS que as diretas, e o
    // analisador avisa sobre isso. A leitura e a cópia do arquivo em si
    // continuam assíncronas, que é onde o custo real está.
    if (!pasta.existsSync()) pasta.createSync(recursive: true);
    return pasta;
  }

  static Future<String> caminhoDe(String clientId) async =>
      p.join((await pastaDeFotos()).path, '$clientId.jpg');

  /// Copia a imagem da câmera para o diretório do aplicativo.
  ///
  /// CONFERE O RESULTADO em vez de confiar que a cópia deu certo. Um disco
  /// cheio faz a escrita falhar de formas silenciosas em algumas versões do
  /// Android, e uma foto de zero byte enfileirada é pior que uma foto ausente:
  /// ela sobe, o servidor aceita, e o que chega ao escritório é um arquivo
  /// vazio que ninguém percebe até precisar dele.
  static Future<String> guardarFoto(
    String clientId, {
    required String caminhoDeOrigem,
    required Future<Uint8List> Function() lerBytesDaOrigem,
  }) async {
    // lerBytesDaOrigem não é usado aqui de propósito: no aparelho a imagem já
    // é um arquivo, e copiar arquivo para arquivo evita trazer uma foto de
    // vários megabytes para a memória só para gravá-la de volta. O parâmetro
    // existe porque no navegador não há arquivo nenhum para copiar.
    final destino = await caminhoDe(clientId);

    try {
      await File(caminhoDeOrigem).copy(destino);
    } on FileSystemException catch (e) {
      // 28 é ENOSPC no Linux/Android: sem espaço no dispositivo.
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
      // Limpa o rastro antes de reclamar: um arquivo de zero byte na pasta
      // seria varrido depois como se fosse foto de verdade.
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
    // Arquivo existe mas está vazio: para o upload dá no mesmo que não existir,
    // e é melhor descobrir aqui do que mandar zero byte para o servidor.
    return bytes.isEmpty ? null : bytes;
  }

  /// Apaga uma foto DESCARTADA no formulário, antes de salvar.
  ///
  /// Só é chamado aqui: depois que a avaliação existe, a foto é prova do que
  /// foi visto no erval e não se apaga por conta do aplicativo.
  static Future<void> apagarFoto(String caminho) async {
    try {
      final arquivo = File(caminho);
      if (arquivo.existsSync()) arquivo.deleteSync();
    } catch (_) {
      // Falhar ao apagar não é motivo para atrapalhar o usuário: no pior caso
      // sobra um arquivo, e a varredura de órfãs abaixo o recolhe depois.
    }
  }

  /// Varredura de órfãs, na subida do aplicativo.
  ///
  /// O caso que ela resolve: o avaliador tira quatro fotos, é interrompido e
  /// fecha o formulário sem salvar. Os arquivos já foram copiados, mas nenhuma
  /// linha no banco aponta para eles — e sem uma varredura eles ficariam
  /// ocupando espaço para sempre, num aparelho onde espaço é escasso.
  ///
  /// A regra é conservadora de propósito: só apaga o que NÃO está no banco.
  /// Na dúvida, mantém — perder uma foto de avaliação é irreversível, e o
  /// custo de manter é alguns megabytes.
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
      // Varredura é manutenção: se falhar, o aplicativo segue normalmente.
    }

    return apagadas;
  }

  /// Largura e altura, lidas do próprio arquivo com o decodificador que já vem
  /// no Flutter. Vão em cabeçalho junto do upload para que a web consiga
  /// montar a miniatura sem abrir a imagem inteira.
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
      // Dimensão é informação acessória: se não der para ler, a foto sobe do
      // mesmo jeito. Não vale derrubar um upload por causa disto.
      return null;
    }
  }
}
