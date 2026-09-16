import 'dart:async';

import 'package:flutter/material.dart';

import '../config.dart';
import '../servicos/api.dart';
import '../servicos/endereco_servidor.dart';
import '../servicos/sessao.dart';
import '../servicos/sincronizador.dart';
import '../widgets/tema.dart';

class TelaLogin extends StatefulWidget {
  const TelaLogin({super.key});

  @override
  State<TelaLogin> createState() => _TelaLoginState();
}

class _TelaLoginState extends State<TelaLogin> {
  final _formulario = GlobalKey<FormState>();
  final _usuario = TextEditingController();
  final _senha = TextEditingController();

  late final _endereco = TextEditingController(text: Config.enderecoApi);

  bool _entrando = false;
  bool _mostrarSenha = false;
  bool _mostrarServidor = false;
  String? _erro;
  String? _avisoServidor;

  @override
  void dispose() {
    _usuario.dispose();
    _senha.dispose();
    _endereco.dispose();
    super.dispose();
  }

  Future<void> _salvarEndereco() async {
    final problema = erroNoEndereco(_endereco.text);
    if (problema != null) {
      setState(() => _avisoServidor = problema);
      return;
    }

    await EnderecoServidor.salvar(_endereco.text);
    if (!mounted) return;
    setState(() {
      _endereco.text = Config.enderecoApi;
      _avisoServidor = null;
      _erro = null;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Servidor: ${Config.enderecoApi}')),
    );
  }

  Future<void> _entrar() async {
    if (!_formulario.currentState!.validate()) return;

    setState(() {
      _entrando = true;
      _erro = null;
    });

    try {
      await sessao.entrar(_usuario.text, _senha.text);

      unawaited(sincronizador.sincronizar());
    } on ErroDeRede catch (e) {
      setState(
        () =>
            _erro =
                '${e.mensagem}.\n\nTentei falar com ${Config.enderecoApi}. '
                'Confira o sinal e, se o endereço estiver errado, toque em '
                '"Configurar servidor" abaixo.',
      );
    } on ErroDaApi catch (e) {
      setState(() => _erro = e.mensagem);
    } finally {
      if (mounted) setState(() => _entrando = false);
    }
  }

  String get _mensagemDoServidor {
    final atual = Config.enderecoApi.toLowerCase();
    if (atual.startsWith('https://')) {
      return 'O aplicativo procura a API neste endereço.';
    }
    return 'Endereço sem https: só funciona quando o celular está na mesma '
        'rede que o servidor.';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _formulario,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const _Marca(),
                  const SizedBox(height: 40),

                  TextFormField(
                    controller: _usuario,
                    decoration: const InputDecoration(
                      labelText: 'Usuário',
                      prefixIcon: Icon(Icons.person_outline),
                    ),
                    textInputAction: TextInputAction.next,
                    autocorrect: false,
                    validator:
                        (v) =>
                            (v == null || v.trim().isEmpty)
                                ? 'Informe o usuário'
                                : null,
                  ),
                  const SizedBox(height: 16),

                  TextFormField(
                    controller: _senha,
                    obscureText: !_mostrarSenha,
                    decoration: InputDecoration(
                      labelText: 'Senha',
                      prefixIcon: const Icon(Icons.lock_outline),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _mostrarSenha
                              ? Icons.visibility_off_outlined
                              : Icons.visibility_outlined,
                        ),
                        onPressed:
                            () =>
                                setState(() => _mostrarSenha = !_mostrarSenha),
                      ),
                    ),
                    onFieldSubmitted: (_) => _entrar(),
                    validator:
                        (v) =>
                            (v == null || v.isEmpty) ? 'Informe a senha' : null,
                  ),

                  if (_erro != null) ...[
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Cores.perigoFundo,
                        borderRadius: raioPadrao,
                        border: Border.all(color: Cores.perigo),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.error_outline,
                            color: Cores.perigo,
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _erro!,
                              style: const TextStyle(
                                color: Cores.perigo,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: _entrando ? null : _entrar,
                    child:
                        _entrando
                            ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                            : const Text('Entrar'),
                  ),

                  const SizedBox(height: 24),
                  const Text(
                    'Entre com sinal antes de sair a campo.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 12,
                      color: Cores.cinza600,
                      height: 1.5,
                    ),
                  ),

                  const SizedBox(height: 8),
                  TextButton.icon(
                    onPressed:
                        () => setState(() {
                          _mostrarServidor = !_mostrarServidor;
                          _avisoServidor = null;
                        }),
                    icon: Icon(
                      _mostrarServidor
                          ? Icons.expand_less
                          : Icons.dns_outlined,
                      size: 18,
                    ),
                    label: Text(
                      _mostrarServidor ? 'Ocultar' : 'Configurar servidor',
                      style: const TextStyle(fontSize: 12),
                    ),
                  ),

                  if (_mostrarServidor) ...[
                    const SizedBox(height: 4),
                    TextFormField(
                      controller: _endereco,
                      keyboardType: TextInputType.url,
                      autocorrect: false,
                      textCapitalization: TextCapitalization.none,
                      decoration: InputDecoration(
                        labelText: 'Endereço do servidor',
                        prefixIcon: const Icon(Icons.dns_outlined),
                        helperText: _mensagemDoServidor,
                        helperMaxLines: 3,
                        errorText: _avisoServidor,
                        errorMaxLines: 3,
                      ),
                      onFieldSubmitted: (_) => _salvarEndereco(),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () async {
                              await EnderecoServidor.voltarAoPadrao();
                              if (!mounted) return;
                              setState(() {
                                _endereco.text = Config.enderecoApi;
                                _avisoServidor = null;
                              });
                            },
                            child: const Text('Padrão'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          flex: 2,
                          child: FilledButton.tonal(
                            onPressed: _salvarEndereco,
                            child: const Text('Salvar servidor'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Marca extends StatelessWidget {
  const _Marca();

  @override
  Widget build(BuildContext context) => const Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          MarcaMatech(tamanho: 76),
          SizedBox(width: 7),
          Text(
            'atech',
            style: TextStyle(
              fontSize: 42,
              fontWeight: FontWeight.w700,
              letterSpacing: 2.5,
              color: Cores.barraTinta,
              height: 1,
            ),
          ),
        ],
      ),
      SizedBox(height: 12),
      Text(
        'Avaliação de matéria-prima em campo',
        style: TextStyle(color: Cores.cinza600, fontSize: 13.5),
      ),
    ],
  );
}
