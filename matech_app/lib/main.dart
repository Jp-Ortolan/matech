// ---------------------------------------------------------------------------
// MATECH · aplicativo de avaliação em campo
// ---------------------------------------------------------------------------
// Ponto de entrada. Faz três coisas e sai da frente:
//
//   1. abre o banco local e recupera a sessão gravada
//   2. monta o tema da marca
//   3. decide a primeira tela — login ou início
//
// A DECISÃO MAIS IMPORTANTE DESTE ARQUIVO é a ordem: a sessão é recuperada do
// SQLITE, não perguntada ao servidor. Quem abre o aplicativo no meio do erval,
// sem sinal, continua logado e trabalha normalmente. Se a subida dependesse de
// uma chamada de rede, o aplicativo seria inútil exatamente onde precisa
// funcionar.

import 'package:flutter/material.dart';

import 'dados/foto_dao.dart';
import 'servicos/arquivos.dart';
import 'servicos/sessao.dart';
import 'servicos/sincronizador.dart';
import 'telas/inicio.dart';
import 'telas/login.dart';
import 'widgets/tema.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await sessao.iniciar();
  await sincronizador.atualizarContagens();

  // Recolhe as fotos que ficaram em disco sem linha no banco.
  //
  // O caso que isto resolve é comum: o avaliador tira quatro fotos, é
  // interrompido e fecha o formulário sem salvar. Os arquivos já foram
  // copiados, mas nada aponta para eles — e sem esta varredura ficariam
  // ocupando espaço para sempre, num aparelho onde espaço é escasso.
  //
  // A regra é conservadora: só apaga o que NÃO está no banco. Perder uma foto
  // de avaliação é irreversível; o custo de manter é alguns megabytes.
  await Arquivos.limparOrfas(await FotoDao.todosOsClientIds());

  // Liga o despertador da fila. A partir daqui, o que estiver reagendado é
  // retentado sozinho na hora marcada, sem o usuário precisar fazer nada.
  await sincronizador.iniciarRetomadaAutomatica();

  runApp(const AplicativoMatech());
}

class AplicativoMatech extends StatefulWidget {
  const AplicativoMatech({super.key});

  @override
  State<AplicativoMatech> createState() => _AplicativoMatechState();
}

class _AplicativoMatechState extends State<AplicativoMatech> {
  late final AppLifecycleListener _cicloDeVida;

  @override
  void initState() {
    super.initState();

    // O GATILHO MAIS IMPORTANTE DA SINCRONIZAÇÃO, e o mais fácil de esquecer.
    //
    // O caminho real é este: o avaliador passa a manhã no erval sem sinal,
    // volta para a estrada, o celular pega sinal no bolso e ele abre o
    // aplicativo para conferir o dia. É NESSE instante que a fila deve subir —
    // não trinta minutos depois, quando o despertador vencer.
    //
    // AppLifecycleListener é do próprio Flutter. Nenhuma dependência de
    // detecção de rede entrou no projeto por causa disto.
    // E o desligamento, que é a outra metade do mesmo gatilho. Sem ele a
    // batida de quarenta e cinco segundos continuaria rodando com o aplicativo
    // no bolso, gastando bateria de um aparelho que passa o dia fora de
    // tomada. Em segundo plano quem cuida da fila é o despertador, que acorda
    // uma vez só, na hora marcada.
    _cicloDeVida = AppLifecycleListener(
      onResume: () => sincronizador.aoVoltarParaOPrimeiroPlano(),
      onPause: sincronizador.aoIrParaSegundoPlano,
    );
  }

  @override
  void dispose() {
    _cicloDeVida.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MATECH',
      debugShowCheckedModeBanner: false,
      theme: temaMatech(),
      // ListenableBuilder é do próprio Flutter: quando a sessão muda (login ou
      // logout), esta parte da árvore reconstrói e a tela troca sozinha.
      // É todo o "gerenciamento de estado" de navegação que este app precisa.
      home: ListenableBuilder(
        listenable: sessao,
        builder: (context, _) {
          if (sessao.carregando) {
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
          }
          return sessao.autenticado ? const TelaInicio() : const TelaLogin();
        },
      ),
    );
  }
}
