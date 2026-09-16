import 'dart:async';

import 'package:flutter/material.dart';

import '../dados/banco_local.dart';
import '../modelos/usuario.dart';
import '../servicos/sessao.dart';
import '../servicos/sincronizador.dart';
import '../widgets/tema.dart';
import 'avaliacoes.dart';
import 'preparo.dart';
import 'produtores.dart';
import 'sincronizacao.dart';

class TelaInicio extends StatefulWidget {
  const TelaInicio({super.key});

  @override
  State<TelaInicio> createState() => _TelaInicioState();
}

class _TelaInicioState extends State<TelaInicio> {
  int _aba = 0;

  static const _telas = [
    TelaAvaliacoes(),
    TelaProdutores(),
    TelaSincronizacao(),
  ];
  static const _titulos = ['Avaliações', 'Produtores', 'Sincronização'];

  static const _chaveDoPreparo = 'preparo_oferecido';

  @override
  void initState() {
    super.initState();

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      unawaited(sincronizador.sincronizar());

      await _oferecerPreparoNaPrimeiraVez();
    });
  }

  Future<void> _oferecerPreparoNaPrimeiraVez() async {
    final jaFoi = await BancoLocal.obterAjuste(_chaveDoPreparo, () => 'nao');
    if (jaFoi == 'sim' || !mounted) return;

    await BancoLocal.gravarAjuste(_chaveDoPreparo, 'sim');
    if (!mounted) return;

    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => const TelaPreparo(),
        fullscreenDialog: true,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final usuario = sessao.usuario;

    return Scaffold(
      appBar: AppBar(
        title: Text(_titulos[_aba]),
        actions: [
          if (usuario != null)
            PopupMenuButton<String>(
              tooltip: 'Conta',
              icon: CircleAvatar(
                radius: 16,
                backgroundColor: Colors.white24,
                child: Text(
                  usuario.iniciais,
                  style: const TextStyle(fontSize: 12, color: Colors.white),
                ),
              ),
              itemBuilder:
                  (context) => [
                    PopupMenuItem(
                      enabled: false,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            usuario.nome,
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                          Text(
                            rotuloPerfil[usuario.perfil] ?? usuario.perfil,
                            style: const TextStyle(fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    const PopupMenuDivider(),
                    const PopupMenuItem(
                      value: 'preparo',
                      child: Text('Preparar para o campo'),
                    ),
                    const PopupMenuItem(
                      value: 'sair',
                      child: Text('Sair da conta'),
                    ),
                  ],
              onSelected: (v) {
                if (v == 'sair') _confirmarSaida(context);
                if (v == 'preparo') {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const TelaPreparo(),
                      fullscreenDialog: true,
                    ),
                  );
                }
              },
            ),
        ],
      ),
      body: IndexedStack(index: _aba, children: _telas),
      bottomNavigationBar: ListenableBuilder(
        listenable: sincronizador,
        builder:
            (context, _) => NavigationBar(
              selectedIndex: _aba,
              onDestinationSelected: (i) => setState(() => _aba = i),
              destinations: [
                const NavigationDestination(
                  icon: Icon(Icons.assignment_outlined),
                  selectedIcon: Icon(Icons.assignment),
                  label: 'Avaliações',
                ),
                const NavigationDestination(
                  icon: Icon(Icons.people_outline),
                  selectedIcon: Icon(Icons.people),
                  label: 'Produtores',
                ),
                NavigationDestination(
                  icon: Badge(
                    isLabelVisible:
                        sincronizador.pendentes > 0 ||
                        sincronizador.comErro > 0,
                    label: Text(
                      '${sincronizador.pendentes + sincronizador.comErro}',
                    ),
                    backgroundColor:
                        sincronizador.comErro > 0
                            ? Cores.perigo
                            : Cores.alerta,
                    child: const Icon(Icons.sync_outlined),
                  ),
                  selectedIcon: const Icon(Icons.sync),
                  label: 'Sincronizar',
                ),
              ],
            ),
      ),
    );
  }

  Future<void> _confirmarSaida(BuildContext context) async {
    final pendentes = sincronizador.pendentes;

    final confirmou = await showDialog<bool>(
      context: context,
      builder:
          (context) => AlertDialog(
            title: const Text('Sair da conta?'),
            content: Text(
              pendentes == 0
                  ? 'Você precisará de internet para entrar de novo.'
                  : 'Há $pendentes ${pendentes == 1 ? "registro" : "registros"} '
                      'que ainda não subiram. Eles CONTINUAM no aparelho e sobem '
                      'quando você entrar de novo — mas você precisará de internet '
                      'para entrar.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancelar'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Sair'),
              ),
            ],
          ),
    );

    if (confirmou == true) await sessao.sair();
  }
}
