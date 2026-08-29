// ---------------------------------------------------------------------------
// TELA · login
// ---------------------------------------------------------------------------
// A ÚNICA tela do aplicativo que exige conexão, e não há como ser diferente:
// a senha é conferida contra o hash que está no PostgreSQL, no servidor. Não
// existe login offline sem guardar credencial no aparelho, e guardar
// credencial no aparelho é pior do que exigir sinal uma vez por dia.
//
// Daí a orientação de uso que a própria tela dá: entre no aplicativo antes de
// sair a campo. O token vale 8 horas, e a partir dele nada mais precisa de rede.

import 'package:flutter/material.dart';

import '../servicos/api.dart';
import '../servicos/sessao.dart';
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

  bool _entrando = false;
  bool _mostrarSenha = false;
  String? _erro;

  @override
  void dispose() {
    _usuario.dispose();
    _senha.dispose();
    super.dispose();
  }

  Future<void> _entrar() async {
    if (!_formulario.currentState!.validate()) return;

    setState(() {
      _entrando = true;
      _erro = null;
    });

    try {
      await sessao.entrar(_usuario.text, _senha.text);
      // Não navega: o ListenableBuilder do main() percebe a mudança e troca
      // a tela sozinho. Uma fonte de verdade em vez de duas.
    } on ErroDeRede catch (e) {
      setState(
        () =>
            _erro =
                '${e.mensagem}. O login precisa de internet — verifique o endereço da API e o sinal.',
      );
    } on ErroDaApi catch (e) {
      setState(() => _erro = e.mensagem);
    } finally {
      if (mounted) setState(() => _entrando = false);
    }
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
                        color: Colors.red.shade50,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.red.shade200),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.error_outline,
                            color: Colors.red.shade700,
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _erro!,
                              style: TextStyle(
                                color: Colors.red.shade900,
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
                      color: Colors.black54,
                      height: 1.5,
                    ),
                  ),
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
  Widget build(BuildContext context) => Column(
    children: [
      Container(
        height: 72,
        width: 72,
        decoration: BoxDecoration(
          color: verdeMatech,
          borderRadius: BorderRadius.circular(18),
        ),
        child: const Icon(Icons.eco_outlined, color: Colors.white, size: 40),
      ),
      const SizedBox(height: 16),
      const Text(
        'MATECH',
        style: TextStyle(
          fontSize: 28,
          fontWeight: FontWeight.w700,
          letterSpacing: 4,
        ),
      ),
      const SizedBox(height: 4),
      const Text(
        'Avaliação de matéria-prima em campo',
        style: TextStyle(color: Colors.black54),
      ),
    ],
  );
}
