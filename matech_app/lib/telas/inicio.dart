// ---------------------------------------------------------------------------
// TELA · início (casca com as três abas)
// ---------------------------------------------------------------------------
// TRÊS ABAS, E O ESCOPO ESTÁ AÍ: avaliar, consultar produtor, sincronizar.
// Não há pesagem, não há análise de laboratório, não há pagamento — essas
// telas são da web, e reproduzi-las aqui seria transformar o aplicativo numa
// segunda versão do sistema, com o dobro de código para manter e nenhum
// ganho: a balança fica no pátio, onde há computador e internet.
//
// O contador de pendências no rótulo da aba de sincronização é a informação
// mais importante do aplicativo inteiro. É o que responde, sem o avaliador
// precisar perguntar, "quanto do meu dia ainda está só neste celular?".

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

  /// Chave do ajuste que marca que o preparo já foi oferecido.
  /// Uma vez por instalação, e não por login: quem já concedeu as permissões
  /// não precisa vê-lo de novo a cada vez que troca de conta no aparelho.
  static const _chaveDoPreparo = 'preparo_oferecido';

  @override
  void initState() {
    super.initState();

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      // Uma tentativa de subir a fila assim que o aplicativo abre. Se não
      // houver sinal, falha em silêncio e reagenda — o avaliador não precisa
      // saber.
      unawaited(sincronizador.sincronizar());

      await _oferecerPreparoNaPrimeiraVez();
    });
  }

  /// Mostra a tela de preparo na primeira vez, e só nela.
  ///
  /// Vai aqui, e não logo depois do login, porque o preparo precisa que o
  /// aplicativo já esteja de pé — ele baixa produtores e usa a sessão. E vai
  /// num addPostFrameCallback porque empurrar uma rota durante o build da
  /// própria tela que a empurra é erro clássico de Flutter.
  Future<void> _oferecerPreparoNaPrimeiraVez() async {
    final jaFoi = await BancoLocal.obterAjuste(_chaveDoPreparo, () => 'nao');
    if (jaFoi == 'sim' || !mounted) return;

    // Marca ANTES de abrir. Se marcasse depois, um fechamento abrupto no meio
    // do preparo faria a tela voltar a aparecer toda vez — e uma tela de
    // boas-vindas insistente é pior que nenhuma.
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
                    // Continua acessível depois da primeira vez: baixar os
                    // produtores é rotina de todo dia em que se sai a campo, não
                    // um passo de instalação.
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

  /// A confirmação existe por causa de uma coisa só: deixar claro, antes, que
  /// sair NÃO apaga o que ainda não subiu. Sem esse texto, um avaliador com
  /// trinta avaliações na fila hesitaria em sair — ou sairia com medo.
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
