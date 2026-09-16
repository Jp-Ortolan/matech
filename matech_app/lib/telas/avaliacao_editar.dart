import 'dart:async';

import 'package:flutter/material.dart';

import '../dados/avaliacao_dao.dart';
import '../dados/foto_dao.dart';
import '../modelos/avaliacao.dart';
import '../modelos/foto.dart';
import '../servicos/arquivos.dart';
import '../servicos/captura_de_fotos.dart';
import '../servicos/faixas.dart';
import '../servicos/localizacao.dart';
import '../servicos/sincronizador.dart';
import '../widgets/comuns.dart';
import '../widgets/tema.dart';

class TelaEditarAvaliacao extends StatefulWidget {
  final Avaliacao original;
  const TelaEditarAvaliacao(this.original, {super.key});

  @override
  State<TelaEditarAvaliacao> createState() => _TelaEditarAvaliacaoState();
}

class _TelaEditarAvaliacaoState extends State<TelaEditarAvaliacao> {
  final _formulario = GlobalKey<FormState>();

  late final TextEditingController _quantidade;
  late final TextEditingController _idadeErval;
  late final TextEditingController _valorCombinado;
  late final TextEditingController _observacoes;

  late String _tipoErva;
  late String _queima;
  Localizacao? _localizacaoNova;

  final List<FotoCapturada> _fotosNovas = [];
  bool _lendoGps = false;
  bool _salvando = false;
  bool _salvou = false;

  @override
  void initState() {
    super.initState();
    final a = widget.original;

    _quantidade = TextEditingController(
      text:
          a.quantidadeEstimadaKg == null
              ? ''
              : a.quantidadeEstimadaKg!.toStringAsFixed(0),
    );
    _idadeErval = TextEditingController(
      text: a.idadeErvalAnos?.toString() ?? '',
    );
    _valorCombinado = TextEditingController(
      text:
          a.valorCombinadoKg == null
              ? ''
              : a.valorCombinadoKg!.toStringAsFixed(2).replaceAll('.', ','),
    );
    _observacoes = TextEditingController(text: a.observacoes ?? '');

    _tipoErva = a.tipoErva;
    _queima = a.ervaQueimada;
  }

  @override
  void dispose() {
    for (final c in [_quantidade, _idadeErval, _valorCombinado, _observacoes]) {
      c.dispose();
    }
    if (!_salvou) {
      for (final foto in _fotosNovas) {
        unawaited(Arquivos.apagarFoto(foto.caminho));
      }
    }
    super.dispose();
  }

  Future<void> _lerLocalizacao() async {
    setState(() => _lendoGps = true);
    final resultado = await ServicoDeLocalizacao.capturar();
    if (!mounted) return;

    setState(() {
      _lendoGps = false;
      if (resultado.temPosicao) _localizacaoNova = resultado.posicao;
    });

    if (!resultado.temPosicao || resultado.posicao!.aproximada) {
      avisar(context, resultado.mensagem, erro: !resultado.temPosicao);
    }
  }

  Future<void> _adicionarFotos(Future<ResultadoDeCaptura> captura) async {
    final resultado = await captura;
    if (!mounted) return;

    if (resultado.temFotos) {
      setState(() => _fotosNovas.addAll(resultado.fotos));
    }
    if (resultado.falha != null && resultado.mensagem != null) {
      avisar(context, resultado.mensagem!, erro: true);
    }
  }

  Future<void> _salvar() async {
    if (!_formulario.currentState!.validate()) return;
    setState(() => _salvando = true);

    final a = widget.original;

    final editada = Avaliacao(
      clientId: a.clientId, // a identidade não muda — é ela que
      id: a.id, // amarra esta edição ao registro original
      produtorClientId: a.produtorClientId,
      ervalClientId: a.ervalClientId,
      ervalId: a.ervalId,
      dataAvaliacao: a.dataAvaliacao,
      tipoErva: _tipoErva,
      ervaQueimada: _queima,
      idadeErvalAnos: inteiroDigitado(_idadeErval.text),
      quantidadeEstimadaKg: numeroDigitado(_quantidade.text),
      classificacao: a.classificacao,
      umidadeEstimada: a.umidadeEstimada,
      taloAparente: a.taloAparente,
      valorCombinadoKg: numeroDigitado(_valorCombinado.text),
      latitude: _localizacaoNova?.latitude ?? a.latitude,
      longitude: _localizacaoNova?.longitude ?? a.longitude,
      observacoes:
          _observacoes.text.trim().isEmpty ? null : _observacoes.text.trim(),
      alteradoEmOrigem: a.alteradoEmOrigem,
    );

    await AvaliacaoDao.atualizarEmCampo(editada);

    if (_fotosNovas.isNotEmpty) {
      await FotoDao.acrescentarAAvaliacao(
        _fotosNovas
            .map(
              (f) => Foto(
                clientId: f.clientId,
                avaliacaoClientId: a.clientId,
                caminhoLocal: f.caminho,
                largura: f.largura,
                altura: f.altura,
                tamanhoBytes: f.tamanhoBytes,
              ),
            )
            .toList(),
      );
    }

    _salvou = true;
    await sincronizador.atualizarContagens();
    unawaited(sincronizador.sincronizar());

    if (mounted) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    final a = widget.original;

    return Scaffold(
      appBar: AppBar(title: const Text('Editar avaliação')),
      body: Form(
        key: _formulario,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Card(
                color: Colors.black.withValues(alpha: 0.03),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      LinhaDado('Avaliação de', formatarData(a.dataAvaliacao)),
                      const SizedBox(height: 4),
                      const Text(
                        'Produtor, área e data não mudam.',
                        style: TextStyle(fontSize: 12, color: Cores.cinza600),
                      ),
                    ],
                  ),
                ),
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
                      validator: (v) {
                        final n = numeroDigitado(v ?? '');
                        if (n == null || n <= 0) return 'Informe a estimativa';
                        return null;
                      },
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
                  helperText: 'Deixe vazio para remover o valor combinado',
                ),
              ),

              const SizedBox(height: 24),
              const _Secao('Localização'),
              Card(
                child: ListTile(
                  leading: Icon(
                    (_localizacaoNova != null || a.temLocalizacao)
                        ? Icons.location_on
                        : Icons.location_off_outlined,
                    color:
                        (_localizacaoNova != null || a.temLocalizacao)
                            ? Cores.mate700
                            : Cores.cinza400,
                  ),
                  title: Text(
                    _localizacaoNova?.resumo ??
                        (a.temLocalizacao
                            ? '${a.latitude!.toStringAsFixed(6)}, ${a.longitude!.toStringAsFixed(6)}'
                            : 'Sem coordenada'),
                  ),
                  subtitle: Text(
                    _localizacaoNova == null
                        ? 'Toque para ler de novo, se estiver no local'
                        : 'Nova leitura — substitui a anterior ao salvar',
                  ),
                  trailing:
                      _lendoGps
                          ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                          : const Icon(Icons.my_location),
                  onTap: _lendoGps ? null : _lerLocalizacao,
                ),
              ),

              const SizedBox(height: 24),
              _Secao(
                'Acrescentar fotos'
                '${_fotosNovas.isEmpty ? "" : " (${_fotosNovas.length})"}',
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _adicionarFotos(CapturaDeFotos.daCamera()),
                      icon: const Icon(Icons.photo_camera_outlined),
                      label: const Text('Câmera'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed:
                          () => _adicionarFotos(CapturaDeFotos.daGaleria()),
                      icon: const Icon(Icons.photo_library_outlined),
                      label: const Text('Galeria'),
                    ),
                  ),
                ],
              ),
              if (_fotosNovas.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  '${_fotosNovas.length} '
                  '${_fotosNovas.length == 1 ? "foto nova será enviada" : "fotos novas serão enviadas"} '
                  'junto.',
                ),
              ],

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
                label: Text(_salvando ? 'Salvando...' : 'Salvar alteração'),
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
