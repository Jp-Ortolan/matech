import 'package:geolocator/geolocator.dart';

enum FalhaDeLocalizacao {
  servicoDesligado,

  permissaoNegada,

  permissaoBloqueada,

  tempoEsgotado,

  indisponivel,
}

class Localizacao {
  final double latitude;
  final double longitude;
  final double? precisaoMetros;
  final DateTime obtidaEm;

  final bool aproximada;

  const Localizacao({
    required this.latitude,
    required this.longitude,
    this.precisaoMetros,
    required this.obtidaEm,
    this.aproximada = false,
  });

  String get resumo =>
      '${latitude.toStringAsFixed(6)}, ${longitude.toStringAsFixed(6)}';
}

class ResultadoDeLocalizacao {
  final Localizacao? posicao;
  final FalhaDeLocalizacao? falha;
  final String mensagem;

  const ResultadoDeLocalizacao._({
    this.posicao,
    this.falha,
    required this.mensagem,
  });

  bool get temPosicao => posicao != null;

  bool get abreConfiguracoes =>
      falha == FalhaDeLocalizacao.servicoDesligado ||
      falha == FalhaDeLocalizacao.permissaoBloqueada;
}

class ServicoDeLocalizacao {
  static const Duration _tempoLimite = Duration(seconds: 20);

  static const Duration _idadeMaximaAproximada = Duration(minutes: 30);

  static Future<ResultadoDeLocalizacao> capturar() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      return const ResultadoDeLocalizacao._(
        falha: FalhaDeLocalizacao.servicoDesligado,
        mensagem:
            'A localização do aparelho está desligada. '
            'Ligue nas configurações para registrar onde a avaliação foi feita.',
      );
    }

    var permissao = await Geolocator.checkPermission();
    if (permissao == LocationPermission.denied) {
      permissao = await Geolocator.requestPermission();
    }

    if (permissao == LocationPermission.deniedForever) {
      return const ResultadoDeLocalizacao._(
        falha: FalhaDeLocalizacao.permissaoBloqueada,
        mensagem:
            'A permissão de localização está bloqueada para o MATECH. '
            'Só dá para liberar nas configurações do aparelho.',
      );
    }
    if (permissao == LocationPermission.denied) {
      return const ResultadoDeLocalizacao._(
        falha: FalhaDeLocalizacao.permissaoNegada,
        mensagem:
            'Sem permissão de localização. A avaliação pode ser salva '
            'sem a coordenada, mas não vai registrar onde foi feita.',
      );
    }

    try {
      final posicao = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: _tempoLimite,
        ),
      );

      return ResultadoDeLocalizacao._(
        posicao: Localizacao(
          latitude: posicao.latitude,
          longitude: posicao.longitude,
          precisaoMetros: posicao.accuracy,
          obtidaEm: posicao.timestamp,
        ),
        mensagem:
            'Localização registrada'
            '${posicao.accuracy > 0 ? " com precisão de ${posicao.accuracy.toStringAsFixed(0)} m" : ""}.',
      );
    } catch (_) {
      return _ultimaConhecida();
    }
  }

  static Future<ResultadoDeLocalizacao> _ultimaConhecida() async {
    try {
      final ultima = await Geolocator.getLastKnownPosition();

      if (ultima != null) {
        final idade = DateTime.now().difference(ultima.timestamp);

        if (idade <= _idadeMaximaAproximada) {
          return ResultadoDeLocalizacao._(
            posicao: Localizacao(
              latitude: ultima.latitude,
              longitude: ultima.longitude,
              precisaoMetros: ultima.accuracy,
              obtidaEm: ultima.timestamp,
              aproximada: true,
            ),
            mensagem:
                'O GPS não fechou posição nova. Usei a última conhecida, '
                'de ${_emPalavras(idade)} atrás — é aproximada.',
          );
        }
      }
    } catch (_) {
    }

    return const ResultadoDeLocalizacao._(
      falha: FalhaDeLocalizacao.tempoEsgotado,
      mensagem:
          'O GPS não conseguiu posição aqui — é comum sob mata fechada. '
          'Dá para salvar a avaliação sem a coordenada e tentar de novo em '
          'campo aberto.',
    );
  }

  static Future<void> abrirConfiguracoes(FalhaDeLocalizacao falha) async {
    if (falha == FalhaDeLocalizacao.servicoDesligado) {
      await Geolocator.openLocationSettings();
    } else {
      await Geolocator.openAppSettings();
    }
  }

  static String _emPalavras(Duration d) {
    if (d.inMinutes < 1) return 'menos de um minuto';
    if (d.inMinutes == 1) return 'um minuto';
    return '${d.inMinutes} minutos';
  }
}
