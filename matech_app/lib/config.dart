// ---------------------------------------------------------------------------
// CONFIGURAÇÃO
// ---------------------------------------------------------------------------
// Um lugar só para o que muda de ambiente para ambiente.

import 'package:flutter/foundation.dart' show kIsWeb;

class Config {
  /// Endereço da API.
  ///
  /// ATENÇÃO ao número: 10.0.2.2 NÃO é um endereço qualquer. É o apelido que o
  /// emulador do Android dá para o "localhost" da máquina que o hospeda —
  /// dentro do emulador, 127.0.0.1 é o próprio emulador, não o seu computador.
  /// Em aparelho físico, troque pelo IP do notebook na rede local
  /// (algo como 192.168.0.x), com a API escutando em 0.0.0.0.
  ///
  /// Dá para trocar sem recompilar o código:
  ///   flutter run --dart-define=MATECH_API=http://192.168.0.42:3000
  /// NO NAVEGADOR O PADRÃO É OUTRO. 10.0.2.2 é o apelido do emulador do
  /// Android; num navegador ele não existe, e a primeira tela ficaria
  /// tentando falar com um endereço sem dono — o que parece falha do port e
  /// é só o endereço errado.
  static String get enderecoApi {
    const informado = String.fromEnvironment('MATECH_API');
    if (informado.isNotEmpty) return informado;
    return kIsWeb ? 'http://localhost:3000' : 'http://10.0.2.2:3000';
  }

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
