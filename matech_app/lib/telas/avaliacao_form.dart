import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../dados/avaliacao_dao.dart';
import '../dados/erval_dao.dart';
import '../dados/produtor_dao.dart';
import '../modelos/avaliacao.dart';
import '../modelos/erval.dart';
import '../modelos/foto.dart';
import '../modelos/produtor.dart';
import '../servicos/arquivos.dart';
import '../servicos/captura_de_fotos.dart';
import '../servicos/faixas.dart';
import '../servicos/identificadores.dart';
import '../servicos/localizacao.dart';
import '../servicos/sincronizador.dart';
import '../widgets/comuns.dart';
import '../widgets/tema.dart';

class FormularioAvaliacao extends StatefulWidget {
  const FormularioAvaliacao({super.key});

  @override
  State<FormularioAvaliacao> createState() => _FormularioAvaliacaoState();
}

class _FormularioAvaliacaoState extends State<FormularioAvaliacao> {
  final _formulario = GlobalKey<FormState>();

  Produtor? _produtor;
  List<Erval> _ervais = const [];
  Erval? _ervalEscolhido;
  bool _areaNova = false;

  final _identificacaoArea = TextEditingController();
  final _quantidade = TextEditingController();
  final _idadeErval = TextEditingController();
  final _valorCombinado = TextEditingController();
  final _observacoes = TextEditingController();

  String _tipoErva = 'NATIVA';
  String _queima = 'NAO';

  Localizacao? _localizacao;
  bool _lendoGps = false;

  final List<FotoCapturada> _fotos = [];
  bool _salvando = false;

  bool _salvou = false;

  @override
  void dispose() {
    for (final c in [
      _identificacaoArea,
      _quantidade,
      _idadeErval,
      _valorCombinado,
      _observacoes,
    ]) {
      c.dispose();
    }

    if (!_salvou) {
      for (final foto in _fotos) {
        unawaited(Arquivos.apagarFoto(foto.caminho));
      }
    }

    super.dispose();
  }

  Future<void> _escolherProdutor() async {
    final escolhido = await showModalBottomSheet<Produtor>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _SeletorDeProdutor(),
    );
    if (escolhido == null) return;

    final ervais = await ErvalDao.doProdutor(escolhido.clientId);
    if (!mounted) return;

    setState(() {
      _produtor = escolhido;
      _ervais = ervais;
      _areaNova = ervais.isEmpty;
      _ervalEscolhido = ervais.isEmpty ? null : ervais.first;
    });
  }

  Future<void> _lerLocalizacao() async {
    setState(() => _lendoGps = true);

    final resultado = await ServicoDeLocalizacao.capturar();

    if (!mounted) return;
    setState(() {
      _lendoGps = false;
      if (resultado.temPosicao) _localizacao = resultado.posicao;
    });

    if (resultado.temPosicao) {
      if (resultado.posicao!.aproximada) {
        avisar(context, resultado.mensagem);
      }
      return;
    }

    if (resultado.abreConfiguracoes) {
      await _oferecerConfiguracoes(
        titulo: 'Localização indisponível',
        mensagem: resultado.mensagem,
        aoAbrir:
            () => ServicoDeLocalizacao.abrirConfiguracoes(resultado.falha!),
      );
      return;
    }

    avisar(context, resultado.mensagem, erro: true);
  }

  Future<void> _oferecerConfiguracoes({
    required String titulo,
    required String mensagem,
    required Future<void> Function() aoAbrir,
  }) async {
    final abrir = await showDialog<bool>(
      context: context,
      builder:
          (context) => AlertDialog(
            title: Text(titulo),
            content: Text(
              '$mensagem\n\n'
              'A avaliação pode ser salva assim mesmo — este dado é opcional.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Continuar sem'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Abrir configurações'),
              ),
            ],
          ),
    );

    if (abrir == true) await aoAbrir();
  }

  Future<void> _adicionarDaCamera() => _adicionar(CapturaDeFotos.daCamera());

  Future<void> _adicionarDaGaleria() => _adicionar(CapturaDeFotos.daGaleria());

  Future<void> _adicionar(Future<ResultadoDeCaptura> captura) async {
    final resultado = await captura;
    if (!mounted) return;

    if (resultado.temFotos) {
      setState(() => _fotos.addAll(resultado.fotos));
    }

    if (resultado.cancelado) return;

    if (resultado.falha == null) return;

    if (resultado.abreConfiguracoes) {
      await _oferecerConfiguracoes(
        titulo: 'Câmera indisponível',
        mensagem: resultado.mensagem!,
        aoAbrir: CapturaDeFotos.abrirConfiguracoes,
      );
      return;
    }

    avisar(context, resultado.mensagem!, erro: true);
  }

  Future<void> _removerFoto(FotoCapturada foto) async {
    setState(() => _fotos.remove(foto));
    await Arquivos.apagarFoto(foto.caminho);
  }

  Future<void> _salvar() async {
    if (_produtor == null) {
      avisar(context, 'Escolha o produtor', erro: true);
      return;
    }
    if (!_formulario.currentState!.validate()) return;

    if (_areaNova && _identificacaoArea.text.trim().length < 2) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Dê um nome à área antes de salvar.'),
        ),
      );
      return;
    }

    final produtor = _produtor!;
    setState(() => _salvando = true);

    Erval? ervalNovo;
    String ervalClientId;
    String? ervalId;

    if (_areaNova) {
      ervalNovo = Erval(
        clientId: novoClientId(),
        produtorClientId: produtor.clientId,
        produtorId: produtor.id,
        identificacao: _identificacaoArea.text.trim(),
        tipoErva: _tipoErva,
        quantidadeEstimadaKg: numeroDigitado(_quantidade.text),
        idadeAnos: inteiroDigitado(_idadeErval.text),
        latitude: _localizacao?.latitude,
        longitude: _localizacao?.longitude,
      );
      ervalClientId = ervalNovo.clientId;
      ervalId = null;
    } else {
      ervalClientId = _ervalEscolhido!.clientId;
      ervalId = _ervalEscolhido!.id;
    }

    final agora = DateTime.now();

    final avaliacao = Avaliacao(
      clientId: novoClientId(),
      produtorClientId: produtor.clientId,
      ervalClientId: ervalClientId,
      ervalId: ervalId,
      dataAvaliacao: agora,
      tipoErva: _tipoErva,
      ervaQueimada: _queima,
      idadeErvalAnos: inteiroDigitado(_idadeErval.text),
      quantidadeEstimadaKg: numeroDigitado(_quantidade.text),
      valorCombinadoKg: numeroDigitado(_valorCombinado.text),
      latitude: _localizacao?.latitude,
      longitude: _localizacao?.longitude,
      observacoes:
          _observacoes.text.trim().isEmpty ? null : _observacoes.text.trim(),
      alteradoEmOrigem: agora,
    );

    final fotos = <Foto>[];
    var sumiram = 0;

    for (final f in _fotos) {
      final bytes = await Arquivos.lerFoto(f.caminho);
      if (bytes == null) {
        sumiram++;
        continue;
      }
      fotos.add(
        Foto(
          clientId: f.clientId,
          avaliacaoClientId: avaliacao.clientId,
          caminhoLocal: f.caminho,
          largura: f.largura,
          altura: f.altura,
          tamanhoBytes: bytes.length,
        ),
      );
    }

    await AvaliacaoDao.criarEmCampo(
      ervalNovo: ervalNovo,
      avaliacao: avaliacao,
      fotos: fotos,
    );

    _salvou = true;

    await sincronizador.atualizarContagens();

    unawaited(sincronizador.sincronizar());

    if (!mounted) return;

    if (sumiram > 0) {
      avisar(
        context,
        '$sumiram ${sumiram == 1 ? "foto sumiu" : "fotos sumiram"} do aparelho '
        'e ${sumiram == 1 ? "não foi salva" : "não foram salvas"}. '
        'A avaliação foi gravada.',
        erro: true,
      );
    }

    Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Avaliação em campo')),
      body: Form(
        key: _formulario,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const _Secao('Produtor'),
              Card(
                child: ListTile(
                  leading: const Icon(Icons.person_outline),
                  title: Text(_produtor?.nome ?? 'Escolher produtor'),
                  subtitle: Text(
                    _produtor?.cpfCnpj ?? 'Toque para buscar no aparelho',
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: _escolherProdutor,
                ),
              ),

              if (_produtor != null) ...[
                const SizedBox(height: 24),
                const _Secao('Área de colheita'),
                if (_ervais.isNotEmpty) ...[
                  SegmentedButton<bool>(
                    segments: const [
                      ButtonSegment(value: false, label: Text('Área conhecida')),
                      ButtonSegment(value: true, label: Text('Área nova')),
                    ],
                    selected: {_areaNova},
                    onSelectionChanged:
                        (s) => setState(() => _areaNova = s.first),
                  ),
                  const SizedBox(height: 12),
                ],
                if (_areaNova)
                  TextFormField(
                    controller: _identificacaoArea,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: const InputDecoration(
                      labelText: 'Nome da área *',
                      helperText:
                          'Como o produtor chama: "Erval do fundo", "Talhão 3"',
                    ),
                    validator:
                        (v) =>
                            (_areaNova && (v == null || v.trim().length < 2))
                                ? 'Dê um nome à área'
                                : null,
                  )
                else
                  DropdownButtonFormField<Erval>(
                    initialValue: _ervalEscolhido,
                    decoration: const InputDecoration(labelText: 'Área'),
                    items:
                        _ervais
                            .map(
                              (e) => DropdownMenuItem(
                                value: e,
                                child: Text(
                                  e.identificacao,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            )
                            .toList(),
                    onChanged: (v) => setState(() => _ervalEscolhido = v),
                    validator:
                        (v) =>
                            (!_areaNova && v == null) ? 'Escolha a área' : null,
                  ),

                const SizedBox(height: 24),
                const _Secao('A erva'),
                SegmentedButton<String>(
                  segments:
                      tiposDeErva
                          .map(
                            (t) => ButtonSegment(
                              value: t,
                              label: Text(rotuloTipoErva[t] ?? t),
                            ),
                          )
                          .toList(),
                  selected: {_tipoErva},
                  onSelectionChanged: (s) => setState(() => _tipoErva = s.first),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _queima,
                  decoration: const InputDecoration(labelText: 'Erva queimada'),
                  items:
                      grausDeQueima
                          .map(
                            (g) => DropdownMenuItem(
                              value: g,
                              child: Text(rotuloQueima[g] ?? g),
                            ),
                          )
                          .toList(),
                  onChanged: (v) => setState(() => _queima = v ?? 'NAO'),
                ),
                const SizedBox(height: 12),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      flex: 2,
                      child: TextFormField(
                        controller: _quantidade,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        decoration: const InputDecoration(
                          labelText: 'Quantidade estimada *',
                          suffixText: 'kg',
                        ),
                        validator: erroNaQuantidade,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        controller: _idadeErval,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Idade',
                          suffixText: 'anos',
                        ),
                        validator: erroNaIdade,
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 24),
                const _Secao('Preço'),
                TextFormField(
                  controller: _valorCombinado,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: const InputDecoration(
                    labelText: 'Valor combinado por quilo',
                    prefixText: 'R\$ ',
                    helperText: 'Só se já foi acertado no erval',
                  ),
                  validator: erroNoValorPorQuilo,
                ),

                const SizedBox(height: 24),
                const _Secao('Localização'),
                Card(
                  child: ListTile(
                    leading: Icon(
                      _localizacao == null
                          ? Icons.location_off_outlined
                          : _localizacao!.aproximada
                          ? Icons.location_searching
                          : Icons.location_on,
                      color:
                          _localizacao == null
                              ? Cores.cinza400
                              : _localizacao!.aproximada
                              ? Cores.alerta
                              : Cores.mate700,
                    ),
                    title: Text(_localizacao?.resumo ?? 'Sem coordenada'),
                    subtitle: Text(
                      _localizacao == null
                          ? 'Opcional. O GPS não depende de internet.'
                          : _localizacao!.aproximada
                          ? 'Aproximada — veio da última posição conhecida'
                          : 'Precisão de ${_localizacao!.precisaoMetros?.toStringAsFixed(0) ?? "?"} m',
                    ),
                    trailing:
                        _lendoGps
                            ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                            : IconButton(
                              icon: const Icon(Icons.my_location),
                              tooltip: 'Ler a localização',
                              onPressed: _lerLocalizacao,
                            ),
                    onTap: _lendoGps ? null : _lerLocalizacao,
                  ),
                ),

                const SizedBox(height: 24),
                _Secao('Fotos${_fotos.isEmpty ? "" : " (${_fotos.length})"}'),
                _GradeDeFotos(fotos: _fotos, aoRemover: _removerFoto),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _adicionarDaCamera,
                        icon: const Icon(Icons.photo_camera_outlined),
                        label: const Text('Câmera'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _adicionarDaGaleria,
                        icon: const Icon(Icons.photo_library_outlined),
                        label: const Text('Galeria'),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 24),
                const _Secao('Observações'),
                TextFormField(
                  controller: _observacoes,
                  maxLines: 4,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(
                    hintText: 'O que não coube nos campos acima',
                    alignLabelWithHint: true,
                  ),
                ),

                const SizedBox(height: 32),
                FilledButton.icon(
                  onPressed: _salvando ? null : _salvar,
                  icon: const Icon(Icons.save_outlined),
                  label: Text(_salvando ? 'Salvando...' : 'Salvar avaliação'),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Salva no aparelho na hora. Sobe sozinha quando houver sinal.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 12, color: Cores.cinza600),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _GradeDeFotos extends StatelessWidget {
  final List<FotoCapturada> fotos;
  final void Function(FotoCapturada) aoRemover;
  const _GradeDeFotos({required this.fotos, required this.aoRemover});

  @override
  Widget build(BuildContext context) {
    if (fotos.isEmpty) {
      return Container(
        height: 80,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          border: Border.all(color: Cores.borda),
          borderRadius: raioPadrao,
        ),
        child: const Text(
          'Nenhuma foto ainda',
          style: TextStyle(color: Cores.cinza400),
        ),
      );
    }

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children:
          fotos
              .map(
                (f) => Stack(
                  children: [
                    ClipRRect(
                      borderRadius: raioPadrao,
                      child: _MiniaturaDaCaptura(
                        caminho: f.caminho,
                        height: 96,
                        width: 96,
                        fit: BoxFit.cover,
                        errorBuilder:
                            (context, erro, pilha) => Container(
                              height: 96,
                              width: 96,
                              color: Cores.perigoFundo,
                              child: const Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    Icons.broken_image_outlined,
                                    color: Cores.perigo,
                                  ),
                                  SizedBox(height: 4),
                                  Text(
                                    'Sumiu',
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: Cores.perigo,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                      ),
                    ),
                    Positioned(
                      top: 2,
                      right: 2,
                      child: GestureDetector(
                        onTap: () => aoRemover(f),
                        child: Container(
                          decoration: const BoxDecoration(
                            color: Cores.cinza600,
                            shape: BoxShape.circle,
                          ),
                          padding: const EdgeInsets.all(3),
                          child: const Icon(
                            Icons.close,
                            size: 15,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              )
              .toList(),
    );
  }
}

class _SeletorDeProdutor extends StatefulWidget {
  const _SeletorDeProdutor();

  @override
  State<_SeletorDeProdutor> createState() => _SeletorDeProdutorState();
}

class _SeletorDeProdutorState extends State<_SeletorDeProdutor> {
  final _busca = TextEditingController();
  List<Produtor> _lista = const [];

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
    if (mounted) setState(() => _lista = lista);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.75,
        child: Column(
          children: [
            const SizedBox(height: 12),
            Container(
              height: 4,
              width: 40,
              decoration: BoxDecoration(
                color: Cores.cinza400,
                borderRadius: raioPadrao,
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: TextField(
                controller: _busca,
                autofocus: true,
                onChanged: (_) => _carregar(),
                decoration: const InputDecoration(
                  hintText: 'Buscar produtor',
                  prefixIcon: Icon(Icons.search),
                  isDense: true,
                ),
              ),
            ),
            Expanded(
              child:
                  _lista.isEmpty
                      ? const Vazio(
                        icone: Icons.person_search_outlined,
                        titulo: 'Nenhum produtor',
                        descricao:
                            'Cadastre o produtor na aba Produtores antes de avaliar.',
                      )
                      : ListView.builder(
                        itemCount: _lista.length,
                        itemBuilder: (context, i) {
                          final p = _lista[i];
                          return ListTile(
                            leading: CircleAvatar(
                              child: Text(p.nome[0].toUpperCase()),
                            ),
                            title: Text(p.nome),
                            subtitle: Text(p.cpfCnpj),
                            onTap: () => Navigator.pop(context, p),
                          );
                        },
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
        color: Cores.cinza400,
      ),
    ),
  );
}

class _MiniaturaDaCaptura extends StatelessWidget {
  final String caminho;
  final double height;
  final double width;
  final BoxFit fit;
  final ImageErrorWidgetBuilder errorBuilder;

  const _MiniaturaDaCaptura({
    required this.caminho,
    required this.height,
    required this.width,
    required this.fit,
    required this.errorBuilder,
  });

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Uint8List?>(
      future: Arquivos.lerFoto(caminho),
      builder: (context, quadro) {
        if (quadro.connectionState != ConnectionState.done) {
          return SizedBox(
            height: height,
            width: width,
            child: const ColoredBox(color: Cores.cabecalho),
          );
        }

        final bytes = quadro.data;
        if (bytes == null) {
          return errorBuilder(
            context,
            const _FotoSumiu(),
            StackTrace.current,
          );
        }

        return Image.memory(
          bytes,
          height: height,
          width: width,
          fit: fit,
          cacheWidth: (width * 2).round(),
          errorBuilder: errorBuilder,
        );
      },
    );
  }
}

class _FotoSumiu implements Exception {
  const _FotoSumiu();
  @override
  String toString() => 'A foto não está mais guardada neste aparelho.';
}
