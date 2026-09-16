import '../config.dart';

class PoliticaDeTentativas {
  static const int rodadasDeDependencia = 10;

  static const int rodadasBaratas = 3;

  static const Duration esperaBarata = Duration(seconds: 20);

  static Duration esperaPara(int tentativas) {
    const degraus = Config.esperaEntreTentativas;
    final indice = (tentativas - 1).clamp(0, degraus.length - 1);
    return degraus[indice];
  }

  static Duration esperaDeDependencia(int rodadas) {
    if (rodadas <= rodadasBaratas) return esperaBarata;

    final escada = _escadaDeDependencia;
    if (escada.isEmpty) return esperaBarata;

    final indice = (rodadas - rodadasBaratas - 1).clamp(0, escada.length - 1);
    return escada[indice];
  }

  static List<Duration> get _escadaDeDependencia =>
      Config.esperaEntreTentativas
          .where((degrau) => degrau > esperaBarata)
          .toList();

  static bool desistirDaDependencia(int rodadas) =>
      rodadas >= rodadasDeDependencia;
}
