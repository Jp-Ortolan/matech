// ---------------------------------------------------------------------------
// TELA · avaliações em campo
// ---------------------------------------------------------------------------
// A lista do que este aparelho produziu. Cada linha diz, sem rodeio, se aquela
// avaliação já está a salvo no escritório ou se ainda existe só aqui.
//
// A ordem é por data da avaliação, a mais recente primeiro — no fim do dia o
// avaliador quer conferir o que fez hoje, não o que fez semana passada.

import 'package:flutter/material.dart';

import '../dados/avaliacao_dao.dart';
import '../modelos/avaliacao.dart';
import '../servicos/sincronizador.dart';
import '../widgets/comuns.dart';
import '../widgets/tema.dart';
import 'avaliacao_detalhe.dart';
import 'avaliacao_form.dart';

class TelaAvaliacoes extends StatefulWidget {
  const TelaAvaliacoes({super.key});

  @override
  State<TelaAvaliacoes> createState() => _TelaAvaliacoesState();
}

class _TelaAvaliacoesState extends State<TelaAvaliacoes> {
  List<ResumoAvaliacao> _lista = const [];
  bool _carregando = true;

  @override
  void initState() {
    super.initState();
    _carregar();
    // Quando o sincronizador termina uma passada, as etiquetas desta lista
    // mudam. Escutar evita que o avaliador precise sair e voltar para ver.
    sincronizador.addListener(_carregar);
  }

  @override
  void dispose() {
    sincronizador.removeListener(_carregar);
    super.dispose();
  }

  Future<void> _carregar() async {
    final lista = await AvaliacaoDao.listar();
    if (!mounted) return;
    setState(() {
      _lista = lista;
      _carregando = false;
    });
  }

  Future<void> _abrirDetalhe(ResumoAvaliacao resumo) async {
    final mudou = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => TelaDetalheAvaliacao(resumo.avaliacao.clientId),
      ),
    );
    if (mudou == true) await _carregar();
  }

  Future<void> _abrirFormulario() async {
    final criou = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => const FormularioAvaliacao()),
    );
    if (criou == true) await _carregar();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body:
          _carregando
              ? const Center(child: CircularProgressIndicator())
              : _lista.isEmpty
              ? Vazio(
                icone: Icons.assignment_outlined,
                titulo: 'Nenhuma avaliação ainda',
                descricao: 'Salva no aparelho e sobe quando houver sinal.',
                acao: FilledButton.icon(
                  onPressed: _abrirFormulario,
                  icon: const Icon(Icons.add),
                  label: const Text('Nova avaliação'),
                ),
              )
              : RefreshIndicator(
                onRefresh: () async {
                  await sincronizador.sincronizar();
                  await _carregar();
                },
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                  itemCount: _lista.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder:
                      (context, i) => _CartaoAvaliacao(
                        _lista[i],
                        aoTocar: () => _abrirDetalhe(_lista[i]),
                      ),
                ),
              ),
      // O BOTÃO FLUTUANTE SOME COM A LISTA VAZIA.
      //
      // Com a lista vazia havia dois botões para a mesma ação a dez
      // centímetros um do outro: o "Nova avaliação" no meio da tela e o
      // "Avaliar" flutuando no canto. Dois convites para a mesma coisa fazem a
      // pessoa parar para descobrir a diferença — e não há diferença.
      //
      // Com a lista cheia o flutuante é necessário: ele acompanha a rolagem, e
      // é a única forma de começar uma avaliação sem voltar ao topo.
      floatingActionButton:
          _carregando || _lista.isEmpty
              ? null
              : FloatingActionButton.extended(
                onPressed: _abrirFormulario,
                icon: const Icon(Icons.add),
                label: const Text('Avaliar'),
              ),
    );
  }
}

class _CartaoAvaliacao extends StatelessWidget {
  final ResumoAvaliacao resumo;
  final VoidCallback aoTocar;
  const _CartaoAvaliacao(this.resumo, {required this.aoTocar});

  @override
  Widget build(BuildContext context) {
    final a = resumo.avaliacao;

    return Card(
      child: InkWell(
        onTap: aoTocar,
        borderRadius: raioPadrao,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      resumo.produtorNome,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  EtiquetaSincronizacao(resumo.situacaoFila),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                resumo.ervalIdentificacao,
                style: const TextStyle(color: Cores.cinza600, fontSize: 13),
              ),

              const SizedBox(height: 12),
              Wrap(
                spacing: 16,
                runSpacing: 8,
                children: [
                  _Dado(
                    Icons.calendar_today_outlined,
                    formatarData(a.dataAvaliacao),
                  ),
                  _Dado(
                    Icons.eco_outlined,
                    rotuloTipoErva[a.tipoErva] ?? a.tipoErva,
                  ),
                  _Dado(
                    Icons.scale_outlined,
                    formatarKg(a.quantidadeEstimadaKg),
                  ),
                  if (a.valorCombinadoKg != null)
                    _Dado(
                      Icons.sell_outlined,
                      '${formatarReais(a.valorCombinadoKg)}/kg',
                    ),
                  if (resumo.totalFotos > 0)
                    _Dado(Icons.photo_camera_outlined, '${resumo.totalFotos}'),
                  if (a.temLocalizacao)
                    const _Dado(Icons.location_on_outlined, 'GPS'),
                ],
              ),

              if (a.observacoes != null && a.observacoes!.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(
                  a.observacoes!,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 13, color: Cores.tinta),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Dado extends StatelessWidget {
  final IconData icone;
  final String texto;
  const _Dado(this.icone, this.texto);

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(icone, size: 14, color: Cores.cinza400),
      const SizedBox(width: 4),
      Text(texto, style: const TextStyle(fontSize: 13, color: Cores.tinta)),
    ],
  );
}
