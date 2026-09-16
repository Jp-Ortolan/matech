import 'package:flutter/material.dart';

import 'dados/foto_dao.dart';
import 'servicos/arquivos.dart';
import 'servicos/endereco_servidor.dart';
import 'servicos/sessao.dart';
import 'servicos/sincronizador.dart';
import 'telas/inicio.dart';
import 'telas/login.dart';
import 'widgets/tema.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await EnderecoServidor.carregar();

  await sessao.iniciar();
  await sincronizador.atualizarContagens();

  await Arquivos.limparOrfas(await FotoDao.todosOsClientIds());

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
