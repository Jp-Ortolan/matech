// ---------------------------------------------------------------------------
// SERVIÇO · captura de fotos
// ---------------------------------------------------------------------------
// Abre a câmera (ou a galeria), copia o que vier para o diretório do
// aplicativo e devolve fotos prontas para entrar na avaliação.
//
// NADA AQUI FALA COM A REDE, e é por isso que fotografar funciona sem sinal:
// a foto é um arquivo local com uma linha no SQLite, exatamente como a
// avaliação. O envio é assunto do sincronizador, depois.
//
// COMO OS ERROS SÃO TRATADOS
//
// O image_picker sinaliza tudo com PlatformException e um código de texto.
// Traduzir esses códigos para um enum aqui, num lugar só, evita que a tela
// precise conhecer strings como 'camera_access_denied' — e evita o pior
// resultado possível, que é despejar a mensagem crua da plataforma na cara de
// alguém que está no meio de um erval.
//
// A distinção entre permissão NEGADA e BLOQUEADA é a mais importante: na
// primeira, pedir de novo funciona; na segunda, o Android nem mostra mais o
// diálogo, e insistir só produz a mesma recusa. Aí o único caminho é abrir as
// configurações — e a tela precisa saber disso para oferecer o botão certo.

import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';

import 'arquivos.dart';
import 'identificadores.dart';

enum FalhaDeFoto {
  /// Negou agora. Dá para pedir de novo.
  permissaoNegada,

  /// Negou permanentemente, ou a política do aparelho bloqueia.
  /// Só as configurações resolvem.
  permissaoBloqueada,

  /// Não há câmera utilizável — acontece em emulador sem câmera configurada.
  cameraIndisponivel,

  /// Sem espaço para guardar o arquivo.
  semEspaco,

  /// A cópia para o diretório do aplicativo falhou.
  armazenamentoFalhou,

  /// A imagem veio corrompida ou num formato que não dá para ler.
  imagemInvalida,

  indisponivel,
}

/// Uma foto já copiada para o diretório do aplicativo, pronta para virar
/// linha na tabela `fotos`.
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

  /// Cancelar não é falha: o usuário fechou a câmera de propósito, e a tela
  /// não deve mostrar erro nenhum por causa disso.
  bool get cancelado => fotos.isEmpty && falha == null;

  bool get abreConfiguracoes => falha == FalhaDeFoto.permissaoBloqueada;
}

class CapturaDeFotos {
  /// Reduzir aqui não é preciosismo de estética.
  ///
  /// Uma foto de celular tem de 2 a 4 MB; com largura máxima de 1600 e
  /// qualidade 70 ela cai para uns 300 KB. Numa conexão de zona rural, é a
  /// diferença entre a foto subir e a foto ficar tentando a tarde inteira —
  /// e a resolução que sobra continua mostrando folha, talo e queima, que é o
  /// que a foto precisa provar.
  ///
  /// Também importa para o armazenamento: um dia de coleta com quarenta fotos
  /// ocupa 12 MB em vez de 160 MB.
  static const double _larguraMaxima = 1600;
  static const int _qualidade = 70;

  /// Uma foto pela câmera.
  static Future<ResultadoDeCaptura> daCamera() => _capturar(() async {
    final imagem = await ImagePicker().pickImage(
      source: ImageSource.camera,
      maxWidth: _larguraMaxima,
      imageQuality: _qualidade,
    );
    return imagem == null ? <XFile>[] : <XFile>[imagem];
  });

  /// VÁRIAS fotos da galeria, numa seleção só.
  ///
  /// pickMultiImage em vez de abrir a galeria N vezes: o avaliador que
  /// fotografou o erval antes de abrir o aplicativo escolhe as seis fotos de
  /// uma vez, em vez de repetir o mesmo gesto seis vezes com o produtor
  /// esperando ao lado.
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

    // Lista vazia = o usuário voltou sem escolher. Não é erro.
    if (escolhidas.isEmpty) return const ResultadoDeCaptura._();

    final prontas = <FotoCapturada>[];

    for (final imagem in escolhidas) {
      // O clientId nasce AQUI, antes de qualquer conexão, e vira o nome do
      // arquivo. É ele que amarra arquivo, linha do banco e upload.
      final clientId = novoClientId();

      try {
        final caminho = await Arquivos.guardarFoto(imagem.path, clientId);
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
        // As que já foram copiadas nesta seleção são MANTIDAS: se o espaço
        // acabou na quinta foto, as quatro primeiras continuam boas e não há
        // motivo para descartá-las junto.
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

  /// Traduz os códigos do image_picker para algo que a tela saiba tratar.
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

      // Duas chamadas ao seletor ao mesmo tempo — toque duplo no botão.
      // Não é erro que valha mostrar: o primeiro pedido segue em pé.
      case 'multiple_request':
        return const ResultadoDeCaptura._();

      default:
        return ResultadoDeCaptura._(
          falha: FalhaDeFoto.indisponivel,
          mensagem: e.message ?? 'Não foi possível usar a câmera.',
        );
    }
  }

  /// Abre as configurações do aplicativo, para o caso de permissão bloqueada.
  ///
  /// Vem do geolocator, que já está no projeto e expõe isto — em vez de
  /// acrescentar o permission_handler só para abrir uma tela. É a mesma tela
  /// de configurações do aplicativo, seja a permissão de câmera ou de GPS.
  static Future<void> abrirConfiguracoes() => Geolocator.openAppSettings();
}
