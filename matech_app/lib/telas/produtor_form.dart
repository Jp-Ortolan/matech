import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../dados/produtor_dao.dart';
import '../modelos/produtor.dart';
import '../servicos/documentos.dart';
import '../servicos/faixas.dart';
import '../servicos/identificadores.dart';
import '../servicos/sincronizador.dart';
import '../widgets/comuns.dart';
import '../widgets/tema.dart';

const _tiposDeChave = {
  'CPF': 'CPF',
  'TELEFONE': 'Telefone',
  'EMAIL': 'E-mail',
  'ALEATORIA': 'Chave aleatória',
};

class FormularioProdutor extends StatefulWidget {
  const FormularioProdutor({super.key});

  @override
  State<FormularioProdutor> createState() => _FormularioProdutorState();
}

class _FormularioProdutorState extends State<FormularioProdutor> {
  final _formulario = GlobalKey<FormState>();

  final _nome = TextEditingController();
  final _documento = TextEditingController();
  final _telefone = TextEditingController();
  final _municipio = TextEditingController();
  final _uf = TextEditingController();
  final _chavePix = TextEditingController();

  String _tipoChave = 'CPF';
  bool _salvando = false;

  @override
  void dispose() {
    for (final c in [
      _nome,
      _documento,
      _telefone,
      _municipio,
      _uf,
      _chavePix,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _salvar() async {
    if (!_formulario.currentState!.validate()) return;

    final documento = apenasDigitos(_documento.text);

    final jaExiste = await ProdutorDao.porDocumento(documento);
    if (jaExiste != null) {
      if (mounted) {
        avisar(
          context,
          'Este documento já está cadastrado para ${jaExiste.nome}.',
          erro: true,
        );
      }
      return;
    }

    setState(() => _salvando = true);

    final produtor = Produtor(
      clientId: novoClientId(),
      nome: _nome.text.trim(),
      cpfCnpj: documento,
      telefone: _vazioVirauNulo(_telefone.text),
      municipio: _vazioVirauNulo(_municipio.text),
      uf: _vazioVirauNulo(_uf.text)?.toUpperCase(),
      tipoChavePix: _chavePix.text.trim().isEmpty ? null : _tipoChave,
      chavePix: _vazioVirauNulo(_chavePix.text),
      criadoOffline: true,
    );

    await ProdutorDao.criarEmCampo(produtor);
    await sincronizador.atualizarContagens();

    unawaited(sincronizador.sincronizar());

    if (mounted) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Cadastrar produtor')),
      body: Form(
        key: _formulario,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const _Secao('Identificação'),
              TextFormField(
                controller: _nome,
                textCapitalization: TextCapitalization.words,
                maxLength: kMaxNome,
                decoration: const InputDecoration(
                  labelText: 'Nome completo *',
                  counterText: '',
                ),
                validator:
                    (v) =>
                        (v == null || v.trim().length < 3)
                            ? 'Informe o nome'
                            : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _documento,
                keyboardType: TextInputType.number,
                maxLength: kMaxDocumento,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: const InputDecoration(
                  labelText: 'CPF ou CNPJ *',
                  helperText: 'Só os números',
                  counterText: '',
                ),
                validator: erroNoDocumento,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _telefone,
                keyboardType: TextInputType.phone,
                maxLength: kMaxTelefone,
                decoration: const InputDecoration(
                  labelText: 'Telefone',
                  counterText: '',
                ),
              ),

              const SizedBox(height: 24),
              const _Secao('Localização'),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    flex: 3,
                    child: TextFormField(
                      controller: _municipio,
                      textCapitalization: TextCapitalization.words,
                      maxLength: kMaxMunicipio,
                      decoration: const InputDecoration(
                        labelText: 'Município',
                        counterText: '',
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _uf,
                      textCapitalization: TextCapitalization.characters,
                      maxLength: 2,
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(RegExp('[A-Za-z]')),
                      ],
                      decoration: const InputDecoration(
                        labelText: 'UF',
                        counterText: '',
                      ),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 24),
              const _Secao('Pagamento'),
              const SizedBox(height: 4),
              DropdownButtonFormField<String>(
                initialValue: _tipoChave,
                decoration: const InputDecoration(labelText: 'Tipo de chave Pix'),
                items:
                    _tiposDeChave.entries
                        .map(
                          (e) => DropdownMenuItem(
                            value: e.key,
                            child: Text(e.value),
                          ),
                        )
                        .toList(),
                onChanged: (v) => setState(() => _tipoChave = v ?? 'CPF'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _chavePix,
                maxLength: kMaxChavePix,
                decoration: const InputDecoration(
                  labelText: 'Chave Pix',
                  counterText: '',
                ),
              ),

              const SizedBox(height: 32),
              FilledButton.icon(
                onPressed: _salvando ? null : _salvar,
                icon: const Icon(Icons.save_outlined),
                label: Text(_salvando ? 'Salvando...' : 'Salvar no aparelho'),
              ),
              const SizedBox(height: 12),
              const Text(
                'Salvo no aparelho. Sobe quando houver sinal.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: Cores.cinza600),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Secao extends StatelessWidget {
  final String texto;
  const _Secao(this.texto);

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Text(
      texto.toUpperCase(),
      style: const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w700,
        letterSpacing: 1,
        color: Cores.cinza400,
      ),
    ),
  );
}

String? _vazioVirauNulo(String v) => v.trim().isEmpty ? null : v.trim();
