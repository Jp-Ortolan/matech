// ---------------------------------------------------------------------------
// TELA · detalhe da avaliação
// ---------------------------------------------------------------------------
// Mostra uma avaliação inteira e é a porta para a edição.
//
// O QUE ELA DEIXA CLARO, E POR QUÊ: o estado de sincronização aparece em
// destaque, no topo, e não como um detalhe no rodapé. Quem abre esta tela
// costuma estar respondendo a uma pergunta específica — "essa avaliação já
// chegou no escritório?" — e a resposta não pode exigir procurar.
//
// As fotos abrem em tamanho cheio porque é para isso que elas existem: provar
// o que foi visto. Uma miniatura de 96 pixels não prova nada sobre folha,
// talo ou queima.


import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../dados/avaliacao_dao.dart';
import '../dados/foto_dao.dart';
import '../modelos/avaliacao.dart';
import '../modelos/foto.dart';
import '../servicos/arquivos.dart';
import '../servicos/sincronizador.dart';
import '../widgets/comuns.dart';
import 'avaliacao_editar.dart';

class TelaDetalheAvaliacao extends StatefulWidget {
  final String clientId;
  const TelaDetalheAvaliacao(this.clientId, {super.key});

  @override
  State<TelaDetalheAvaliacao> createState() => _TelaDetalheAvaliacaoState();
}

class _TelaDetalheAvaliacaoState extends State<TelaDetalheAvaliacao> {
  ResumoAvaliacao? _resumo;
  List<Foto> _fotos = const [];
  bool _carregando = true;

  /// true se algo mudou — a lista anterior precisa se recarregar ao voltar.
  bool _houveMudanca = false;

  @override
  void initState() {
    super.initState();
    _carregar();
    sincronizador.addListener(_carregar);
  }

  @override
  void dispose() {
    sincronizador.removeListener(_carregar);
    super.dispose();
  }

  Future<void> _carregar() async {
    final resumo = await AvaliacaoDao.detalhe(widget.clientId);
    final fotos = await FotoDao.daAvaliacao(widget.clientId);
    if (!mounted) return;
    setState(() {
      _resumo = resumo;
      _fotos = fotos;
      _carregando = false;
    });
  }

  Future<void> _editar() async {
    final editou = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => TelaEditarAvaliacao(_resumo!.avaliacao),
      ),
    );
    if (editou == true) {
      _houveMudanca = true;
      await _carregar();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_carregando) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_resumo == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Avaliação')),
        body: const Vazio(
          icone: Icons.help_outline,
          titulo: 'Avaliação não encontrada',
          descricao: 'Ela pode ter sido removida deste aparelho.',
        ),
      );
    }

    final r = _resumo!;
    final a = r.avaliacao;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (jaSaiu, _) {
        if (!jaSaiu) Navigator.pop(context, _houveMudanca);
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Avaliação'),
          actions: [
            IconButton(
              icon: const Icon(Icons.edit_outlined),
              tooltip: 'Editar',
              onPressed: _editar,
            ),
          ],
        ),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // O estado vai em primeiro, e sozinho: é a pergunta que traz a
            // maioria das pessoas a esta tela.
            _FaixaDeEstado(situacao: r.situacaoFila, avaliacao: a),
            const SizedBox(height: 16),

            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      r.produtorNome,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      r.ervalIdentificacao,
                      style: const TextStyle(color: Colors.black54),
                    ),
                    const Divider(height: 28),
                    LinhaDado('Data', formatarDataHora(a.dataAvaliacao)),
                    LinhaDado(
                      'Tipo de erva',
                      rotuloTipoErva[a.tipoErva] ?? a.tipoErva,
                    ),
                    LinhaDado(
                      'Erva queimada',
                      rotuloQueima[a.ervaQueimada] ?? a.ervaQueimada,
                    ),
                    LinhaDado(
                      'Quantidade estimada',
                      formatarKg(a.quantidadeEstimadaKg),
                    ),
                    if (a.idadeErvalAnos != null)
                      LinhaDado('Idade do erval', '${a.idadeErvalAnos} anos'),
                    if (a.valorCombinadoKg != null)
                      LinhaDado(
                        'Valor combinado',
                        '${formatarReais(a.valorCombinadoKg)} por kg',
                      ),
                    LinhaDado(
                      'Localização',
                      a.temLocalizacao
                          ? '${a.latitude!.toStringAsFixed(6)}, ${a.longitude!.toStringAsFixed(6)}'
                          : 'não registrada',
                    ),
                  ],
                ),
              ),
            ),

            if (a.observacoes != null && a.observacoes!.isNotEmpty) ...[
              const SizedBox(height: 16),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'OBSERVAÇÕES',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1,
                          color: Colors.black45,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(a.observacoes!, style: const TextStyle(height: 1.5)),
                    ],
                  ),
                ),
              ),
            ],

            const SizedBox(height: 16),
            _Fotos(fotos: _fotos),
          ],
        ),
      ),
    );
  }
}

/// Faixa do estado de sincronização, com a explicação do que ele significa.
class _FaixaDeEstado extends StatelessWidget {
  final String? situacao;
  final Avaliacao avaliacao;
  const _FaixaDeEstado({required this.situacao, required this.avaliacao});

  @override
  Widget build(BuildContext context) {
    final sincronizada = avaliacao.sincronizado;

    final texto =
        sincronizada
            ? 'Esta avaliação está no servidor. O escritório já a enxerga.'
            : 'Esta avaliação existe SÓ neste aparelho. Ela sobe sozinha quando '
                'houver sinal.';

    final cor = sincronizada ? Colors.green : Colors.blueGrey;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: cor.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: cor.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              EtiquetaSincronizacao(situacao),
              const Spacer(),
              // A hora da última alteração NO APARELHO. É este carimbo que
              // decide o conflito no servidor, e por isso ele é exibido: se
              // duas versões da mesma avaliação existirem, é por ele que se
              // explica qual venceu.
              Text(
                'alterada ${formatarDataHora(avaliacao.alteradoEmOrigem)}',
                style: const TextStyle(fontSize: 11, color: Colors.black45),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            texto,
            style: TextStyle(fontSize: 13, color: cor.shade900, height: 1.4),
          ),
        ],
      ),
    );
  }
}

class _Fotos extends StatelessWidget {
  final List<Foto> fotos;
  const _Fotos({required this.fotos});

  @override
  Widget build(BuildContext context) {
    if (fotos.isEmpty) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Center(
            child: Text(
              'Nenhuma foto nesta avaliação',
              style: TextStyle(color: Colors.black45),
            ),
          ),
        ),
      );
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'FOTOS (${fotos.length})',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                letterSpacing: 1,
                color: Colors.black45,
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: fotos.map((f) => _Miniatura(f)).toList(),
            ),
          ],
        ),
      ),
    );
  }
}

class _Miniatura extends StatelessWidget {
  final Foto foto;
  const _Miniatura(this.foto);

  @override
  Widget build(BuildContext context) {
    // A LEITURA VIROU ASSÍNCRONA, e não por gosto: no navegador a foto não é
    // um arquivo em disco que se possa perguntar se existe de forma síncrona —
    // é uma linha no banco local. Uma porta só para as duas plataformas custa
    // este FutureBuilder.
    //
    // cacheWidth de 200 para uma miniatura de 100: sem ele o Flutter decodifica
    // a foto inteira, de vários megapixels, para desenhar um quadrado pequeno.
    return FutureBuilder<Uint8List?>(
      future: Arquivos.lerFoto(foto.caminhoLocal),
      builder: (context, quadro) {
        if (quadro.connectionState != ConnectionState.done) {
          return Container(
            height: 100,
            width: 100,
            decoration: BoxDecoration(
              color: Colors.grey.shade200,
              borderRadius: BorderRadius.circular(8),
            ),
          );
        }

        final bytes = quadro.data;
        // caminho vazio é a marca de "o arquivo sumiu do aparelho" — ver
        // FotoDao.marcarArquivoAusente. A linha continua existindo de
        // propósito: ela é a prova de que a avaliação teve esta foto.
        final ausente = foto.caminhoLocal.isEmpty || bytes == null;

        return ausente ? _semArquivo() : _comArquivo(context, bytes);
      },
    );
  }

  Widget _semArquivo() {
    {
      return Container(
        height: 100,
        width: 100,
        decoration: BoxDecoration(
          color: Colors.red.shade50,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.broken_image_outlined, color: Colors.red.shade300),
            const SizedBox(height: 4),
            Text(
              'Arquivo\nsumiu',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 10, color: Colors.red.shade700),
            ),
          ],
        ),
      );
    }

  Widget _comArquivo(BuildContext context, Uint8List bytes) {
    return GestureDetector(
      onTap:
          () => Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => _FotoInteira(bytes)),
          ),
      child: Stack(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: Image.memory(
              bytes,
              height: 100,
              width: 100,
              fit: BoxFit.cover,
              cacheWidth: 200,
            ),
          ),
          if (!foto.sincronizada)
            Positioned(
              bottom: 4,
              right: 4,
              child: Container(
                padding: const EdgeInsets.all(3),
                decoration: const BoxDecoration(
                  color: Colors.black54,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.schedule,
                  size: 12,
                  color: Colors.white,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _FotoInteira extends StatelessWidget {
  final Uint8List bytes;
  const _FotoInteira(this.bytes);

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: Colors.black,
    appBar: AppBar(
      backgroundColor: Colors.black,
      foregroundColor: Colors.white,
    ),
    body: Center(
      child: InteractiveViewer(maxScale: 5, child: Image.memory(bytes)),
    ),
  );
}
