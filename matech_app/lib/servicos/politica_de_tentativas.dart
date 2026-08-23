// ---------------------------------------------------------------------------
// POLÍTICA DE TENTATIVAS
// ---------------------------------------------------------------------------
// Quando insistir, quanto esperar e quando desistir.
//
// POR QUE ISTO É UM ARQUIVO SÓ, E NÃO CÓDIGO ESPALHADO
//
// Estas regras estavam escritas em dois lugares — no FilaDao e no
// Sincronizador —, cada um com sua leitura da escada do Config. Duas cópias da
// mesma regra é uma que vai divergir: bastaria alguém ajustar a espera num
// lugar e esquecer o outro para que a fila esperasse 30 minutos e o
// despertador acordasse em 5, sem que nada acusasse o problema.
//
// E há uma razão melhor: sem Flutter, sem sqflite e sem rede aqui dentro, esta
// política é PURA — recebe números, devolve durações. É a única parte do
// aplicativo que dá para testar com `flutter test` sem emulador nem banco, e é
// justamente a parte cuja lógica é mais fácil de errar em silêncio.
//
// A ESCADA, E O QUE ELA PROTEGE
//
// A espera cresce a cada fracasso e para de crescer no último degrau. Não é
// otimização de servidor: é bateria. Um aplicativo que tenta de dez em dez
// segundos o dia inteiro, sem sinal, chega ao fim da tarde com o celular
// morto — e aí não há coleta nenhuma para sincronizar.

import '../config.dart';

class PoliticaDeTentativas {
  /// Quantas rodadas de dependência pendente até desistir.
  ///
  /// O número existe por causa de um caso real: se o produtor de uma avaliação
  /// foi RECUSADO pelo servidor (CPF duplicado, por exemplo), ele nunca vai
  /// chegar lá — e a avaliação filha ficaria pedindo por ele a cada vinte
  /// segundos, para sempre, gastando bateria e dados sem chance nenhuma de
  /// sucesso. Depois de dez rodadas o aplicativo para de insistir e mostra o
  /// caso para uma pessoa, que é quem pode consertar o cadastro do pai.
  static const int rodadasDeDependencia = 10;

  /// Quantas rodadas de dependência custam apenas vinte segundos.
  ///
  /// Chegar fora de ordem é o caso NORMAL, não um erro: na esmagadora maioria
  /// das vezes a rodada seguinte resolve. Escalonar logo na primeira faria o
  /// aplicativo punir o comportamento esperado.
  static const int rodadasBaratas = 3;

  static const Duration esperaBarata = Duration(seconds: 20);

  /// Espera depois de uma falha de rede ou de um erro do servidor (5xx).
  ///
  /// [tentativas] é a contagem já incrementada: a primeira falha chama com 1.
  /// Acima do último degrau, a espera para de crescer — dobrar para sempre
  /// acabaria agendando a próxima tentativa para depois do fim do expediente.
  static Duration esperaPara(int tentativas) {
    const degraus = Config.esperaEntreTentativas;
    final indice = (tentativas - 1).clamp(0, degraus.length - 1);
    return degraus[indice];
  }

  /// Espera de uma operação que chegou antes da dependência dela.
  ///
  /// As primeiras rodadas são baratas. A partir daí já não é mais "fora de
  /// ordem": é sinal de que o pai não está subindo, e aí vale escalonar.
  ///
  /// A ARMADILHA QUE ISTO EVITA — e que só apareceu porque havia teste:
  ///
  /// A versão anterior escalonava direto para `esperaPara(rodadas - baratas)`,
  /// ou seja, para o PRIMEIRO degrau da escada do Config. Só que esse degrau
  /// são 15 segundos, e a espera barata são 20 — de modo que a quarta rodada
  /// esperava MENOS que a terceira. A espera diminuía justo quando deveria
  /// crescer, e nada acusaria: a sincronização continuaria "funcionando", só
  /// que insistindo mais rápido num pai que não vinha.
  ///
  /// A correção não é somar um ao índice — isso quebraria de novo no dia em
  /// que alguém mexesse na escada ou na espera barata. Em vez disso, a escada
  /// de dependência é DERIVADA: só entram nela os degraus que de fato são
  /// maiores que a espera barata. Assim "nunca diminui" passa a valer por
  /// construção, e não por coincidência entre dois números soltos.
  static Duration esperaDeDependencia(int rodadas) {
    if (rodadas <= rodadasBaratas) return esperaBarata;

    final escada = _escadaDeDependencia;
    if (escada.isEmpty) return esperaBarata;

    final indice = (rodadas - rodadasBaratas - 1).clamp(0, escada.length - 1);
    return escada[indice];
  }

  /// Os degraus do Config que valem a pena depois das rodadas baratas.
  static List<Duration> get _escadaDeDependencia =>
      Config.esperaEntreTentativas
          .where((degrau) => degrau > esperaBarata)
          .toList();

  /// Já se insistiu o bastante numa dependência que não chega?
  static bool desistirDaDependencia(int rodadas) =>
      rodadas >= rodadasDeDependencia;
}
