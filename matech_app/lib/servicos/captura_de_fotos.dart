import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';

import 'arquivos.dart';
import 'identificadores.dart';

enum FalhaDeFoto {
  permissaoNegada,

  permissaoBloqueada,

  cameraIndisponivel,

  semEspaco,

  armazenamentoFalhou,

  imagemInvalida,

  indisponivel,
}

class FotoCapturada {
  final String clientId;
  final String caminho;
  final int? largura;
  final int? altura;
  final int tamanhoBytes;

  const FotoCapturada({
    required this.clientId,
    required this.caminho,
    required this.tamanhoBytes,
    this.largura,
    this.altura,
  });
}

class ResultadoDeCaptura {
  final List<FotoCapturada> fotos;
  final FalhaDeFoto? falha;
  final String? mensagem;

  const ResultadoDeCaptura._({
    this.fotos = const [],
    this.falha,
    this.mensagem,
  });

  bool get temFotos => fotos.isNotEmpty;

  bool get cancelado => fotos.isEmpty && falha == null;

  bool get abreConfiguracoes => falha == FalhaDeFoto.permissaoBloqueada;
}

class CapturaDeFotos {
  static const double _larguraMaxima = 1600;
  static const int _qualidade = 70;

  static Future<ResultadoDeCaptura> daCamera() => _capturar(() async {
    final imagem = await ImagePicker().pickImage(
      source: ImageSource.camera,
      maxWidth: _larguraMaxima,
      imageQuality: _qualidade,
    );
    return imagem == null ? <XFile>[] : <XFile>[imagem];
  });

  static Future<ResultadoDeCaptura> daGaleria() => _capturar(
    () => ImagePicker().pickMultiImage(
      maxWidth: _larguraMaxima,
      imageQuality: _qualidade,
    ),
  );

  static Future<ResultadoDeCaptura> _capturar(
    Future<List<XFile>> Function() escolher,
  ) async {
    final List<XFile> escolhidas;
    try {
      escolhidas = await escolher();
    } on PlatformException catch (e) {
      return _traduzir(e);
    } catch (_) {
      return const ResultadoDeCaptura._(
        falha: FalhaDeFoto.indisponivel,
        mensagem: 'Não foi possível abrir a câmera neste aparelho.',
      );
    }

    if (escolhidas.isEmpty) return const ResultadoDeCaptura._();

    final prontas = <FotoCapturada>[];

    for (final imagem in escolhidas) {
      final clientId = novoClientId();

      try {
        final caminho = await Arquivos.guardarFoto(
          clientId,
          caminhoDeOrigem: imagem.path,
          lerBytesDaOrigem: imagem.readAsBytes,
        );
        final medidas = await Arquivos.dimensoes(caminho);
        final bytes = await Arquivos.lerFoto(caminho);

        if (bytes == null) {
          await Arquivos.apagarFoto(caminho);
          return const ResultadoDeCaptura._(
            falha: FalhaDeFoto.imagemInvalida,
            mensagem: 'A imagem não pôde ser lida depois de copiada.',
          );
        }

        prontas.add(
          FotoCapturada(
            clientId: clientId,
            caminho: caminho,
            tamanhoBytes: bytes.length,
            largura: medidas?.largura,
            altura: medidas?.altura,
          ),
        );
      } on ErroDeArquivo catch (e) {
        return ResultadoDeCaptura._(
          fotos: prontas,
          falha:
              e.falha == FalhaDeArquivo.semEspaco
                  ? FalhaDeFoto.semEspaco
                  : FalhaDeFoto.armazenamentoFalhou,
          mensagem:
              prontas.isEmpty
                  ? e.mensagem
                  : '${e.mensagem} As ${prontas.length} '
                      '${prontas.length == 1 ? "foto já copiada foi mantida" : "fotos já copiadas foram mantidas"}.',
        );
      }
    }

    return ResultadoDeCaptura._(fotos: prontas);
  }

  static ResultadoDeCaptura _traduzir(PlatformException e) {
    switch (e.code) {
      case 'camera_access_denied':
      case 'photo_access_denied':
        return const ResultadoDeCaptura._(
          falha: FalhaDeFoto.permissaoBloqueada,
          mensagem:
              'A permissão de câmera está bloqueada para o MATECH. '
              'Só dá para liberar nas configurações do aparelho.',
        );

      case 'camera_access_restricted':
        return const ResultadoDeCaptura._(
          falha: FalhaDeFoto.permissaoBloqueada,
          mensagem: 'O uso da câmera está restrito neste aparelho.',
        );

      case 'no_available_camera':
        return const ResultadoDeCaptura._(
          falha: FalhaDeFoto.cameraIndisponivel,
          mensagem:
              'Este aparelho não tem câmera disponível. '
              'Dá para escolher imagens da galeria.',
        );

      case 'invalid_image':
        return const ResultadoDeCaptura._(
          falha: FalhaDeFoto.imagemInvalida,
          mensagem: 'A imagem escolhida não pôde ser lida.',
        );

      case 'multiple_request':
        return const ResultadoDeCaptura._();

      default:
        return ResultadoDeCaptura._(
          falha: FalhaDeFoto.indisponivel,
          mensagem: e.message ?? 'Não foi possível usar a câmera.',
        );
    }
  }

  static Future<void> abrirConfiguracoes() => Geolocator.openAppSettings();
}
