import 'package:flutter/foundation.dart' show kIsWeb;

class Config {
  static String? _escolhido;

  static String get enderecoApi => _escolhido ?? enderecoPadrao;

  static String get enderecoPadrao {
    const informado = String.fromEnvironment('MATECH_API');
    if (informado.isNotEmpty) return informado;
    return kIsWeb ? 'http://localhost:3000' : 'http://10.0.2.2:3000';
  }

  static void definirEndereco(String? endereco) => _escolhido = endereco;

  static const String nomeBancoLocal = 'matech.db';

  static const int tamanhoDoLote = 25;

  static const List<Duration> esperaEntreTentativas = [
    Duration(seconds: 15),
    Duration(minutes: 1),
    Duration(minutes: 5),
    Duration(minutes: 30),
    Duration(hours: 2),
  ];
}
