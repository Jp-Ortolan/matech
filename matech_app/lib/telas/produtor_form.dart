// ---------------------------------------------------------------------------
// TELA · cadastro rápido de produtor  (RF01 e RF02)
// ---------------------------------------------------------------------------
// "RÁPIDO" É REQUISITO, NÃO ADJETIVO. Este formulário é preenchido em pé, no
// meio de um erval, muitas vezes com o produtor esperando ao lado. Por isso:
//
//   - só nome e documento são obrigatórios; o resto pode ficar para depois,
//     e o cadastro sobe assim mesmo (o servidor exige exatamente esses dois);
//   - a chave Pix está aqui, e não numa segunda tela, porque é o dado que o
//     produtor tem na cabeça NAQUELE momento — perguntar depois, por telefone,
//     custa uma ligação e um dia;
//   - a checagem de documento duplicado é local e imediata. O servidor também
//     barraria (cpfCnpj é @unique), mas só na sincronização, horas depois,
//     longe de quem digitou. Um erro descoberto no erval custa dez segundos;
//     o mesmo erro descoberto no escritório custa uma viagem.
//
// Ao salvar, o produtor entra no SQLite e na fila NA MESMA TRANSAÇÃO. Nenhuma
// linha deste arquivo fala com a rede.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../dados/produtor_dao.dart';
import '../modelos/produtor.dart';
import '../servicos/identificadores.dart';
import '../servicos/sincronizador.dart';
import '../widgets/comuns.dart';

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

    final documento = _somenteDigitos(_documento.text);

    // Checagem local antes de gravar — ver o comentário no topo do arquivo.
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
      // O clientId nasce AQUI, antes de qualquer conexão. É ele que impede a
      // duplicação se o envio for repetido — a chave de idempotência.
      clientId: novoClientId(),
      nome: _nome.text.trim(),
      cpfCnpj: documento,
      telefone: _vazioVirauNulo(_telefone.text),
      municipio: _vazioVirauNulo(_municipio.text),
      uf: _vazioVirauNulo(_uf.text)?.toUpperCase(),
      // formaPagamento fica no padrão do modelo, que já é PIX — é como a
      // ervateira paga hoje.
      tipoChavePix: _chavePix.text.trim().isEmpty ? null : _tipoChave,
      chavePix: _vazioVirauNulo(_chavePix.text),
      criadoOffline: true,
    );

    await ProdutorDao.criarEmCampo(produtor);
    await sincronizador.atualizarContagens();

    // Uma tentativa de subir na hora. Se não houver sinal, falha em silêncio —
    // o produtor já está salvo e a fila já sabe que precisa enviá-lo.
    // unawaited() é do dart:async: dispara e segue, deixando explícito
    // que não esperar aqui é intencional.
    unawaited(sincronizador.sincronizar());

    if (mounted) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Cadastrar produtor')),
      body: Form(
        key: _formulario,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const _Secao('Identificação'),
            TextFormField(
              controller: _nome,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(labelText: 'Nome completo *'),
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
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: const InputDecoration(
                labelText: 'CPF ou CNPJ *',
                helperText: 'Só os números',
              ),
              validator: (v) {
                final d = _somenteDigitos(v ?? '');
                if (d.length != 11 && d.length != 14) {
                  return 'CPF tem 11 dígitos e CNPJ tem 14';
                }
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _telefone,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'Telefone'),
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
                    decoration: const InputDecoration(labelText: 'Município'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _uf,
                    textCapitalization: TextCapitalization.characters,
                    maxLength: 2,
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
            const Text(
              'A chave vai junto do cadastro para que a ordem de pagamento, '
              'lá no escritório, já saiba para onde pagar.',
              style: TextStyle(
                fontSize: 12,
                color: Colors.black54,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 12),
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
              decoration: const InputDecoration(labelText: 'Chave Pix'),
            ),

            const SizedBox(height: 32),
            FilledButton.icon(
              onPressed: _salvando ? null : _salvar,
              icon: const Icon(Icons.save_outlined),
              label: Text(_salvando ? 'Salvando...' : 'Salvar no aparelho'),
            ),
            const SizedBox(height: 12),
            const Text(
              'O cadastro é salvo no aparelho na hora e entra na fila de '
              'sincronização. Não é preciso ter internet agora.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                color: Colors.black54,
                height: 1.4,
              ),
            ),
          ],
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
        color: Colors.black45,
      ),
    ),
  );
}

String _somenteDigitos(String v) => v.replaceAll(RegExp(r'[^0-9]'), '');
String? _vazioVirauNulo(String v) => v.trim().isEmpty ? null : v.trim();
