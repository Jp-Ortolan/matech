// ---------------------------------------------------------------------------
// CONFIGURAÇÃO
// ---------------------------------------------------------------------------
// Um lugar só para o que muda de ambiente para ambiente.

import 'package:flutter/foundation.dart' show kIsWeb;

class Config {
  /// O endereço escolhido NESTE aparelho, na tela de login. Nulo enquanto
  /// ninguém escolheu — e aí vale o padrão do build.
  ///
  /// Quem grava isto é EnderecoServidor.salvar(); quem carrega, na subida do
  /// aplicativo, é EnderecoServidor.carregar(). Este arquivo não conhece o
  /// banco de propósito: config é o que muda de ambiente para ambiente, não
  /// quem sabe guardar coisas.
  static String? _escolhido;

  /// Endereço da API que vale AGORA.
  ///
  /// Precedência: o que a pessoa digitou > o --dart-define do build > o padrão.
  static String get enderecoApi => _escolhido ?? enderecoPadrao;

  /// O endereço de fábrica, sem o que foi escolhido no aparelho.
  ///
  /// ATENÇÃO ao número: 10.0.2.2 NÃO é um endereço qualquer. É o apelido que o
  /// emulador do Android dá para o "localhost" da máquina que o hospeda —
  /// dentro do emulador, 127.0.0.1 é o próprio emulador, não o seu computador.
  /// Em aparelho físico ele não existe: num celular de verdade é preciso o IP
  /// do notebook na rede local (192.168.0.x), com a API escutando em 0.0.0.0,
  /// ou — melhor — o endereço público do servidor.
  ///
  /// Dá para embutir um endereço no APK sem tocar no código:
  ///   flutter build apk --dart-define=MATECH_API=https://api.suaervateira.com
  /// É assim que se entrega o aplicativo já configurado para uma ervateira.
  /// Mesmo assim ele continua trocável na tela de login, porque servidor muda
  /// de casa e ninguém quer depender de um build novo para isso.
  ///
  /// NO NAVEGADOR O PADRÃO É OUTRO. 10.0.2.2 é o apelido do emulador do
  /// Android; num navegador ele não existe, e a primeira tela ficaria
  /// tentando falar com um endereço sem dono — o que parece falha do port e
  /// é só o endereço errado.
  static String get enderecoPadrao {
    const informado = String.fromEnvironment('MATECH_API');
    if (informado.isNotEmpty) return informado;
    return kIsWeb ? 'http://localhost:3000' : 'http://10.0.2.2:3000';
  }

  /// Passe null para voltar ao padrão do build.
  static void definirEndereco(String? endereco) => _escolhido = endereco;

  static const String nomeBancoLocal = 'matech.db';

  /// Quantas operações sobem por lote. O servidor aceita até 200; 25 mantém a
  /// requisição pequena o bastante para atravessar uma conexão ruim de zona
  /// rural, que é onde este aplicativo vai viver.
  static const int tamanhoDoLote = 25;

  /// Espera antes de tentar de novo, por número de tentativas já feitas.
  /// Cresce para não martelar um servidor que está fora do ar, e para não
  /// gastar bateria tentando sem parar no meio do erval.
  static const List<Duration> esperaEntreTentativas = [
    Duration(seconds: 15),
    Duration(minutes: 1),
    Duration(minutes: 5),
    Duration(minutes: 30),
    Duration(hours: 2),
  ];
}
