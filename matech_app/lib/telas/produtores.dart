import 'package:flutter/material.dart';

import '../dados/produtor_dao.dart';
import '../modelos/produtor.dart';
import '../servicos/api.dart';
import '../servicos/sincronizador.dart';
import '../widgets/comuns.dart';
import '../widgets/tema.dart';
import 'produtor_form.dart';

class TelaProdutores extends StatefulWidget {
  const TelaProdutores({super.key});

  @override
  State<TelaProdutores> createState() => _TelaProdutoresState();
}

class _TelaProdutoresState extends State<TelaProdutores> {
  final _busca = TextEditingController();
  List<Produtor> _lista = const [];
  bool _carregando = true;
  bool _baixando = false;

  @override
  void initState() {
    super.initState();
    _carregar();
  }

  @override
  void dispose() {
    _busca.dispose();
    super.dispose();
  }

  Future<void> _carregar() async {
    final lista = await ProdutorDao.listar(busca: _busca.text);
    if (!mounted) return;
    setState(() {
      _lista = lista;
      _carregando = false;
    });
  }

  Future<void> _baixarDoServidor() async {
    setState(() => _baixando = true);
    try {
      await sincronizador.baixarProdutores();
      await _carregar();
      if (mounted) {
        avisar(context, sincronizador.ultimaMensagem ?? 'Lista atualizada');
      }
    } on ErroDeRede catch (e) {
      if (mounted) {
        avisar(
          context,
          '${e.mensagem}. A lista continua com o que já havia.',
          erro: true,
        );
      }
    } on ErroDaApi catch (e) {
      if (mounted) avisar(context, e.mensagem, erro: true);
    } finally {
      if (mounted) setState(() => _baixando = false);
    }
  }

  Future<void> _abrirCadastro() async {
    final criou = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => const FormularioProdutor()),
    );
    if (criou == true) {
      await _carregar();
      await sincronizador.atualizarContagens();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _busca,
                    onChanged: (_) => _carregar(),
                    decoration: InputDecoration(
                      hintText: 'Buscar por nome ou documento',
                      prefixIcon: const Icon(Icons.search),
                      isDense: true,
                      suffixIcon:
                          _busca.text.isEmpty
                              ? null
                              : IconButton(
                                icon: const Icon(Icons.close),
                                onPressed: () {
                                  _busca.clear();
                                  _carregar();
                                },
                              ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filledTonal(
                  onPressed: _baixando ? null : _baixarDoServidor,
                  tooltip: 'Baixar produtores do servidor',
                  icon:
                      _baixando
                          ? const SizedBox(
                            height: 18,
                            width: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                          : const Icon(Icons.cloud_download_outlined),
                ),
              ],
            ),
          ),
          Expanded(
            child:
                _carregando
                    ? const Center(child: CircularProgressIndicator())
                    : _lista.isEmpty
                    ? Vazio(
                      icone: Icons.people_outline,
                      titulo:
                          _busca.text.isEmpty
                              ? 'Nenhum produtor no aparelho'
                              : 'Nada encontrado',
                      descricao:
                          _busca.text.isEmpty
                              ? 'Baixe a lista do servidor enquanto há sinal, ou '
                                  'cadastre um produtor aqui mesmo, no erval.'
                              : 'Nenhum produtor com "${_busca.text}". Se ele é '
                                  'novo, cadastre agora — o envio acontece depois.',
                      acao: FilledButton.icon(
                        onPressed: _abrirCadastro,
                        icon: const Icon(Icons.person_add_outlined),
                        label: const Text('Cadastrar produtor'),
                      ),
                    )
                    : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                      itemCount: _lista.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, i) => _CartaoProdutor(_lista[i]),
                    ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _abrirCadastro,
        icon: const Icon(Icons.person_add_outlined),
        label: const Text('Cadastrar'),
      ),
    );
  }
}

class _CartaoProdutor extends StatelessWidget {
  final Produtor produtor;
  const _CartaoProdutor(this.produtor);

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    produtor.nome,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                if (produtor.criadoOffline)
                  EtiquetaSincronizacao(
                    produtor.sincronizado ? 'ENVIADA' : 'PENDENTE',
                  ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              produtor.cpfCnpj,
              style: const TextStyle(color: Cores.cinza600),
            ),
            if (produtor.municipio != null)
              Text(
                '${produtor.municipio}${produtor.uf != null ? " · ${produtor.uf}" : ""}',
                style: const TextStyle(color: Cores.cinza600, fontSize: 13),
              ),
            if (produtor.chavePix != null && produtor.chavePix!.isNotEmpty) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.pix, size: 14, color: Cores.cinza400),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      produtor.chavePix!,
                      style: const TextStyle(
                        fontSize: 12,
                        color: Cores.cinza600,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
