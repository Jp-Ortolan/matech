// ---------------------------------------------------------------------------
// SERVIÇO · localização
// ---------------------------------------------------------------------------
// A coordenada é o que prova ONDE a avaliação foi feita, e é o dado que mais
// se perde no processo em papel. Mas ela É OPCIONAL, e essa decisão precisa
// ser dita em voz alta porque contradiz o instinto de quem programa:
//
// No meio da mata, sob copa fechada, o GPS demora ou simplesmente não fecha
// posição. Se o formulário travasse esperando a coordenada, o avaliador
// perderia a avaliação inteira por causa de um dado acessório — e a alternativa
// dele seria voltar ao papel. Um sistema que só funciona com tudo perfeito não
// funciona no erval.
//
// Por isso este serviço NUNCA lança exceção para o chamador: ele devolve um
// resultado que ou tem a posição, ou tem uma falha nomeada e uma frase que dá
// para mostrar na tela. Quem chama decide o que fazer — e, no formulário, a
// decisão é sempre "avisa e deixa salvar assim mesmo".
//
// O RECURSO À ÚLTIMA POSIÇÃO CONHECIDA merece explicação. Quando o GPS não
// fecha uma posição nova a tempo, o Android costuma ter guardada a última que
// conseguiu. No erval, onde o avaliador andou poucas centenas de metros desde
// a última leitura, essa posição é aproximada — mas é muitíssimo melhor que
// nenhuma para dizer de qual propriedade a erva saiu. Ela vem marcada como
// aproximada, com a idade, para que ninguém a confunda com uma leitura fresca.

import 'package:geolocator/geolocator.dart';

/// Por que a captura falhou. Cada valor pede uma reação diferente da tela —
/// é essa a razão de ser um enum e não uma string de erro.
enum FalhaDeLocalizacao {
  /// A localização do aparelho está desligada nas configurações do sistema.
  servicoDesligado,

  /// O usuário negou agora. Dá para pedir de novo.
  permissaoNegada,

  /// O usuário negou permanentemente (ou a política do aparelho bloqueia).
  /// Pedir de novo NÃO abre mais o diálogo — só as configurações resolvem.
  permissaoBloqueada,

  /// O GPS não fechou posição no tempo dado. É o caso comum sob copa fechada.
  tempoEsgotado,

  /// Qualquer outra coisa.
  indisponivel,
}

class Localizacao {
  final double latitude;
  final double longitude;
  final double? precisaoMetros;
  final DateTime obtidaEm;

  /// true quando veio da última posição conhecida, e não de uma leitura nova.
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

/// O que o serviço devolve. Ou tem posição, ou tem falha — nunca os dois nulos.
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

  /// A tela usa isto para decidir se oferece o botão que abre as
  /// configurações do sistema — oferecer sempre seria ruído.
  bool get abreConfiguracoes =>
      falha == FalhaDeLocalizacao.servicoDesligado ||
      falha == FalhaDeLocalizacao.permissaoBloqueada;
}

class ServicoDeLocalizacao {
  /// Quanto esperar por uma posição nova antes de recorrer à última conhecida.
  /// Vinte segundos é o limite do aceitável com o produtor esperando ao lado.
  static const Duration _tempoLimite = Duration(seconds: 20);

  /// Idade máxima de uma última-posição-conhecida para ainda valer a pena.
  /// Meia hora cobre o deslocamento de um avaliador dentro de uma propriedade;
  /// mais que isso corre o risco de apontar para a fazenda anterior.
  static const Duration _idadeMaximaAproximada = Duration(minutes: 30);

  static Future<ResultadoDeLocalizacao> capturar() async {
    // 1. O serviço de localização do aparelho está ligado?
    //    Sem isto, pedir permissão e depois falhar confundiria o usuário: ele
    //    concederia o acesso e mesmo assim não teria coordenada.
    if (!await Geolocator.isLocationServiceEnabled()) {
      return const ResultadoDeLocalizacao._(
        falha: FalhaDeLocalizacao.servicoDesligado,
        mensagem:
            'A localização do aparelho está desligada. '
            'Ligue nas configurações para registrar onde a avaliação foi feita.',
      );
    }

    // 2. Permissão.
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

    // 3. Leitura nova.
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
      // Não fechou posição a tempo. Antes de desistir, a última conhecida.
      return _ultimaConhecida();
    }
  }

  /// O plano B. Sob copa fechada é o que normalmente sobra.
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
      // Nem a última conhecida veio. Cai no retorno abaixo.
    }

    return const ResultadoDeLocalizacao._(
      falha: FalhaDeLocalizacao.tempoEsgotado,
      mensagem:
          'O GPS não conseguiu posição aqui — é comum sob mata fechada. '
          'Dá para salvar a avaliação sem a coordenada e tentar de novo em '
          'campo aberto.',
    );
  }

  /// Abre a tela de configurações certa para cada falha. São DUAS telas
  /// diferentes no Android, e mandar o usuário para a errada é pior que não
  /// oferecer atalho nenhum.
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
