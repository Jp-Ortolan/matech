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

// Mesmas três formas da web.
const _formasDePagamento = {
  'PIX': 'Pix',
  'CONTA_BANCARIA': 'Conta bancária',
  'DINHEIRO': 'Dinheiro',
};

const _dicasDeChave = {
  'CPF': 'Só os números do CPF',
  'TELEFONE': 'Com DDD',
  'EMAIL': 'nome@dominio.com',
  'ALEATORIA': 'A chave gerada pelo banco',
};

class FormularioProdutor extends StatefulWidget {
  // Com produtor: edição. Sem: cadastro novo.
  final Produtor? produtor;
  const FormularioProdutor({super.key, this.produtor});

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
  final _titular = TextEditingController();
  final _banco = TextEditingController();
  final _agencia = TextEditingController();
  final _conta = TextEditingController();

  String _forma = 'PIX';
  String _tipoChave = 'CPF';
  String _tipoConta = 'CORRENTE';
  bool _salvando = false;

  bool get _editando => widget.produtor != null;

  @override
  void initState() {
    super.initState();
    final p = widget.produtor;
    if (p == null) return;
    _nome.text = p.nome;
    _documento.text = p.cpfCnpj;
    _telefone.text = p.telefone ?? '';
    _municipio.text = p.municipio ?? '';
    _uf.text = p.uf ?? '';
    _chavePix.text = p.chavePix ?? '';
    _titular.text = p.titularConta ?? '';
    _banco.text = p.banco ?? '';
    _agencia.text = p.agencia ?? '';
    _conta.text = p.conta ?? '';
    _forma = p.formaPagamento;
    _tipoChave = p.tipoChavePix ?? 'CPF';
    _tipoConta = p.tipoConta ?? 'CORRENTE';
  }

  @override
  void dispose() {
    for (final c in [
      _nome,
      _documento,
      _telefone,
      _municipio,
      _uf,
      _chavePix,
      _titular,
      _banco,
      _agencia,
      _conta,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _salvar() async {
    if (!_formulario.currentState!.validate()) return;

    final documento = apenasDigitos(_documento.text);

    final jaExiste =
        _editando ? null : await ProdutorDao.porDocumento(documento);
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

    final ehPix = _forma == 'PIX';
    final ehConta = _forma == 'CONTA_BANCARIA';
    final ehDinheiro = _forma == 'DINHEIRO';

    final antigo = widget.produtor;
    final produtor = Produtor(
      clientId: antigo?.clientId ?? novoClientId(),
      id: antigo?.id,
      endereco: antigo?.endereco,
      sincronizadoEm: antigo?.sincronizadoEm,
      nome: _nome.text.trim(),
      cpfCnpj: antigo?.cpfCnpj ?? documento,
      telefone: _vazioVirauNulo(_telefone.text),
      municipio: _vazioVirauNulo(_municipio.text),
      uf: _vazioVirauNulo(_uf.text)?.toUpperCase(),
      formaPagamento: _forma,
      // Só vai o que vale para a forma escolhida, como na web.
      tipoChavePix: ehPix ? _tipoChave : null,
      chavePix: ehPix ? _vazioVirauNulo(_chavePix.text) : null,
      titularConta: ehDinheiro ? null : _vazioVirauNulo(_titular.text),
      banco: ehConta ? _vazioVirauNulo(_banco.text) : null,
      agencia: ehConta ? _vazioVirauNulo(_agencia.text) : null,
      conta: ehConta ? _vazioVirauNulo(_conta.text) : null,
      tipoConta: ehConta ? _tipoConta : null,
      criadoOffline: antigo?.criadoOffline ?? true,
    );

    if (_editando) {
      await ProdutorDao.atualizarEmCampo(produtor);
    } else {
      await ProdutorDao.criarEmCampo(produtor);
    }
    await sincronizador.atualizarContagens();

    unawaited(sincronizador.sincronizar(agora: true));

    if (mounted) Navigator.pop(context, true);
  }

  // Campos que mudam conforme a forma de pagamento.
  List<Widget> _camposDePagamento() {
    String? obrigatorio(String? v, String rotulo) =>
        (v == null || v.trim().isEmpty) ? 'Informe $rotulo' : null;

    final titular = TextFormField(
      controller: _titular,
      textCapitalization: TextCapitalization.words,
      maxLength: kMaxTitular,
      decoration: InputDecoration(
        labelText: _forma == 'PIX' ? 'Titular da chave' : 'Titular da conta',
        counterText: '',
      ),
    );

    switch (_forma) {
      case 'PIX':
        return [
          DropdownButtonFormField<String>(
            initialValue: _tipoChave,
            decoration: const InputDecoration(labelText: 'Tipo da chave'),
            items:
                _tiposDeChave.entries
                    .map(
                      (e) =>
                          DropdownMenuItem(value: e.key, child: Text(e.value)),
                    )
                    .toList(),
            onChanged: (v) => setState(() => _tipoChave = v ?? 'CPF'),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _chavePix,
            maxLength: kMaxChavePix,
            decoration: InputDecoration(
              labelText: 'Chave Pix *',
              helperText: _dicasDeChave[_tipoChave],
              counterText: '',
            ),
            validator: (v) => obrigatorio(v, 'a chave Pix'),
          ),
          const SizedBox(height: 12),
          titular,
        ];
      case 'CONTA_BANCARIA':
        return [
          TextFormField(
            controller: _banco,
            maxLength: kMaxBanco,
            decoration: const InputDecoration(
              labelText: 'Banco *',
              counterText: '',
            ),
            validator: (v) => obrigatorio(v, 'o banco'),
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: TextFormField(
                  controller: _agencia,
                  keyboardType: TextInputType.number,
                  maxLength: kMaxAgencia,
                  decoration: const InputDecoration(
                    labelText: 'Agência *',
                    counterText: '',
                  ),
                  validator: (v) => obrigatorio(v, 'a agência'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: TextFormField(
                  controller: _conta,
                  keyboardType: TextInputType.number,
                  maxLength: kMaxConta,
                  decoration: const InputDecoration(
                    labelText: 'Conta *',
                    counterText: '',
                  ),
                  validator: (v) => obrigatorio(v, 'a conta'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _tipoConta,
            decoration: const InputDecoration(labelText: 'Tipo de conta *'),
            items: const [
              DropdownMenuItem(value: 'CORRENTE', child: Text('Corrente')),
              DropdownMenuItem(value: 'POUPANCA', child: Text('Poupança')),
            ],
            onChanged: (v) => setState(() => _tipoConta = v ?? 'CORRENTE'),
          ),
          const SizedBox(height: 12),
          titular,
        ];
      default:
        return [
          Container(
            padding: const EdgeInsets.all(12),
            color: Cores.alertaFundo,
            child: const Text(
              'Pagamento em espécie: a ordem sai sem destino bancário.',
              style: TextStyle(fontSize: 13, color: Cores.tinta),
            ),
          ),
        ];
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_editando ? 'Editar produtor' : 'Cadastrar produtor'),
      ),
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
                // O documento não muda: é ele que evita produtor duplicado.
                enabled: !_editando,
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
              const _Secao('Como este produtor recebe'),
              SegmentedButton<String>(
                segments:
                    _formasDePagamento.entries
                        .map(
                          (e) => ButtonSegment(
                            value: e.key,
                            label: Text(e.value),
                          ),
                        )
                        .toList(),
                selected: {_forma},
                onSelectionChanged: (s) => setState(() => _forma = s.first),
              ),
              const SizedBox(height: 12),
              ..._camposDePagamento(),

              const SizedBox(height: 32),
              FilledButton.icon(
                onPressed: _salvando ? null : _salvar,
                icon: const Icon(Icons.save_outlined),
                label: Text(
                  _salvando
                      ? 'Salvando...'
                      : _editando
                      ? 'Salvar alterações'
                      : 'Salvar no aparelho',
                ),
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
