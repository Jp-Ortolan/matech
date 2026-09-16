import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../dados/avaliacao_dao.dart';
import '../dados/foto_dao.dart';
import '../modelos/avaliacao.dart';
import '../modelos/foto.dart';
import '../servicos/arquivos.dart';
import '../servicos/sincronizador.dart';
import '../widgets/comuns.dart';
import '../widgets/tema.dart';
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
                      style: const TextStyle(color: Cores.cinza600),
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
                          color: Cores.cinza400,
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

    final ({Color fundo, Color borda, Color texto}) tom =
        sincronizada
            ? (fundo: Cores.mate100, borda: Cores.mate300, texto: Cores.mate800)
            : (fundo: Cores.cabecalho, borda: Cores.borda, texto: Cores.cinza600);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tom.fundo,
        borderRadius: raioPadrao,
        border: Border.all(color: tom.borda),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              EtiquetaSincronizacao(situacao),
              const Spacer(),
              Text(
                'alterada ${formatarDataHora(avaliacao.alteradoEmOrigem)}',
                style: const TextStyle(fontSize: 11, color: Cores.cinza400),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            texto,
            style: TextStyle(fontSize: 13, color: tom.texto, height: 1.4),
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
              style: TextStyle(color: Cores.cinza400),
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
                color: Cores.cinza400,
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
    return FutureBuilder<Uint8List?>(
      future: Arquivos.lerFoto(foto.caminhoLocal),
      builder: (context, quadro) {
        if (quadro.connectionState != ConnectionState.done) {
          return Container(
            height: 100,
            width: 100,
            decoration: BoxDecoration(
              color: Cores.cabecalho,
              borderRadius: raioPadrao,
            ),
          );
        }

        final bytes = quadro.data;

        if (foto.caminhoLocal.isEmpty || bytes == null) return _semArquivo();

        return _comArquivo(context, bytes);
      },
    );
  }

  Widget _semArquivo() {
    return Container(
      height: 100,
      width: 100,
      decoration: const BoxDecoration(
        color: Cores.perigoFundo,
        borderRadius: raioPadrao,
      ),
      child: const Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.broken_image_outlined, color: Cores.perigo),
          SizedBox(height: 4),
          Text(
            'Arquivo\nsumiu',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 10, color: Cores.perigo),
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
            borderRadius: raioPadrao,
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
                  color: Cores.cinza600,
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
