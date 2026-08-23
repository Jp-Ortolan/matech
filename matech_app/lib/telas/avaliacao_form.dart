// ---------------------------------------------------------------------------
// TELA · avaliação em campo  (RF05, RF17 e RF18)
// ---------------------------------------------------------------------------
// O formulário que este aplicativo existe para ter.
//
// A SEQUÊNCIA DOS CAMPOS SEGUE A SEQUÊNCIA DO TRABALHO, não a do banco de
// dados: chega-se à propriedade (produtor), caminha-se até a área (erval),
// olha-se a erva (tipo, queima, quantidade), combina-se o preço, fotografa-se
// e anota-se o que não coube em campo nenhum. Um formulário organizado por
// tabela obrigaria o avaliador a pular para frente e para trás.
//
// A ÁREA PODE SER CRIADA AQUI DENTRO. No mato ninguém volta a uma tela de
// cadastro para depois avaliar: ou dá para nomear a área na hora, ou o
// aplicativo não serve. Quando a área é nova, ela entra na fila ANTES da
// avaliação — ver o comentário no AvaliacaoDao.
//
// NADA NESTE ARQUIVO FALA COM A REDE. Salvar grava no SQLite e enfileira.

import 'dart:async';
import 'dart:io';

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
import '../servicos/identificadores.dart';
import '../servicos/localizacao.dart';
import '../servicos/sincronizador.dart';
import '../widgets/comuns.dart';

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

  /// Guardada como objeto, e não como dois doubles soltos, para não perder o
  /// aviso de "aproximada" — uma última posição conhecida não pode chegar ao
  /// escritório parecendo uma leitura fresca.
  Localizacao? _localizacao;
  bool _lendoGps = false;

  final List<FotoCapturada> _fotos = [];
  bool _salvando = false;

  /// Marca que a avaliação foi gravada. Enquanto for false, as fotos copiadas
  /// para o disco são rascunho — e o dispose as apaga.
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

    // Saiu sem salvar: as fotos já estavam copiadas em disco, mas nenhuma
    // linha no banco aponta para elas. Apagar aqui é mais limpo que deixar
    // para a varredura da próxima subida do aplicativo — e é o mesmo efeito.
    //
    // Sem await de propósito: o dispose não espera, e apagar arquivo é
    // manutenção. Se falhar, a varredura de órfãs recolhe depois.
    if (!_salvou) {
      for (final foto in _fotos) {
        unawaited(Arquivos.apagarFoto(foto.caminho));
      }
    }

    super.dispose();
  }

  // -------------------------------------------------------------------------
  // Produtor e área
  // -------------------------------------------------------------------------

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
      // Se o produtor não tem área conhecida, já abre no modo "área nova":
      // é o caso mais comum de um produtor cadastrado agora, no erval.
      _areaNova = ervais.isEmpty;
      _ervalEscolhido = ervais.isEmpty ? null : ervais.first;
    });
  }

  // -------------------------------------------------------------------------
  // GPS
  // -------------------------------------------------------------------------
  // A coordenada é o que prova ONDE a avaliação foi feita — e é o dado que
  // mais se perde no processo em papel. Mas ela não é obrigatória: no meio da
  // mata o sinal de GPS demora ou não vem, e travar o formulário por causa
  // disso significaria perder a avaliação inteira. Falha, avisa, e segue.

  Future<void> _lerLocalizacao() async {
    setState(() => _lendoGps = true);

    final resultado = await ServicoDeLocalizacao.capturar();

    if (!mounted) return;
    setState(() {
      _lendoGps = false;
      if (resultado.temPosicao) _localizacao = resultado.posicao;
    });

    // Sucesso com ressalva (posição aproximada) também é avisado: o avaliador
    // precisa saber que aquela coordenada não é uma leitura fresca, porque é
    // ele quem sabe se andou muito desde a última.
    if (resultado.temPosicao) {
      if (resultado.posicao!.aproximada) {
        avisar(context, resultado.mensagem);
      }
      return;
    }

    // Falhou. Se for coisa que só as configurações resolvem, o aviso vira
    // diálogo com atalho — repetir "sem permissão" num rodapé não ajuda
    // ninguém que já negou duas vezes.
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

  /// Diálogo com atalho para as configurações do sistema.
  ///
  /// Sempre diz, no corpo, que a avaliação pode ser salva assim mesmo. É a
  /// informação que evita o pior desfecho possível: alguém abandonar a
  /// avaliação achando que ela não vale sem foto ou sem coordenada.
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

  // -------------------------------------------------------------------------
  // Fotos
  // -------------------------------------------------------------------------
  // A captura, a redução e a cópia para o disco moram em CapturaDeFotos. Aqui
  // fica só a reação da tela ao que aconteceu — que é onde a decisão de
  // produto está: NENHUMA falha de foto impede salvar a avaliação.
  //
  // Essa é a regra que mais importa neste arquivo. Uma permissão negada, uma
  // câmera que não abre ou um cartão cheio não podem custar o registro de que
  // a erva foi vista, porque a alternativa do avaliador é o papel.

  Future<void> _adicionarDaCamera() => _adicionar(CapturaDeFotos.daCamera());

  Future<void> _adicionarDaGaleria() => _adicionar(CapturaDeFotos.daGaleria());

  Future<void> _adicionar(Future<ResultadoDeCaptura> captura) async {
    final resultado = await captura;
    if (!mounted) return;

    // As fotos que deram certo entram MESMO quando houve falha depois. Se o
    // espaço acabou na quinta, as quatro primeiras são boas e descartá-las
    // junto seria jogar fora trabalho que já foi feito.
    if (resultado.temFotos) {
      setState(() => _fotos.addAll(resultado.fotos));
    }

    // Voltou sem escolher nada: fechou a câmera de propósito. Não é erro.
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

  /// Descartar uma foto ANTES de salvar apaga o arquivo na hora. Depois de
  /// salva, a foto é prova do que foi visto no erval e o aplicativo não a
  /// apaga por conta própria.
  Future<void> _removerFoto(FotoCapturada foto) async {
    setState(() => _fotos.remove(foto));
    await Arquivos.apagarFoto(foto.caminho);
  }

  // -------------------------------------------------------------------------
  // Salvar
  // -------------------------------------------------------------------------

  Future<void> _salvar() async {
    if (_produtor == null) {
      avisar(context, 'Escolha o produtor', erro: true);
      return;
    }
    if (!_formulario.currentState!.validate()) return;

    final produtor = _produtor!;
    setState(() => _salvando = true);

    // A área: ou uma nova, que vai junto na fila, ou uma já conhecida.
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
        quantidadeEstimadaKg: _numero(_quantidade.text),
        idadeAnos: _inteiro(_idadeErval.text),
        latitude: _localizacao?.latitude,
        longitude: _localizacao?.longitude,
        // criadoOffline fica no padrão do modelo, que já é true: todo erval
        // criado por este aplicativo nasce em campo.
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
      idadeErvalAnos: _inteiro(_idadeErval.text),
      quantidadeEstimadaKg: _numero(_quantidade.text),
      valorCombinadoKg: _numero(_valorCombinado.text),
      latitude: _localizacao?.latitude,
      longitude: _localizacao?.longitude,
      observacoes:
          _observacoes.text.trim().isEmpty ? null : _observacoes.text.trim(),
      // O relógio do APARELHO. É este valor que decide o conflito no servidor,
      // e não a hora em que a operação chegar lá.
      alteradoEmOrigem: agora,
    );

    // ÚLTIMA CONFERÊNCIA ANTES DE ENFILEIRAR.
    //
    // Entre tirar a foto e salvar a avaliação pode passar meia hora, e nesse
    // intervalo o sistema pode ter limpado o arquivo por falta de espaço.
    // Enfileirar uma foto que já não existe geraria uma operação condenada a
    // falhar — e, pior, um registro que parece ter foto e não tem.
    //
    // As que sumiram são deixadas de fora, e o avaliador é avisado enquanto
    // ainda está no erval, onde dá para fotografar de novo.
    final fotos = <Foto>[];
    var sumiram = 0;

    for (final f in _fotos) {
      final arquivo = File(f.caminho);
      if (!arquivo.existsSync() || arquivo.lengthSync() == 0) {
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
          tamanhoBytes: arquivo.lengthSync(),
        ),
      );
    }

    // Área, avaliação e fotos: uma transação, na ordem que a fila precisa.
    await AvaliacaoDao.criarEmCampo(
      ervalNovo: ervalNovo,
      avaliacao: avaliacao,
      fotos: fotos,
    );

    // A partir daqui as fotos deixaram de ser rascunho: o dispose não as apaga.
    _salvou = true;

    await sincronizador.atualizarContagens();

    // Uma tentativa de subir na hora. Sem sinal, falha em silêncio — a
    // avaliação já está salva e a fila já sabe que precisa enviá-la.
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

  // -------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Avaliação em campo')),
      body: Form(
        key: _formulario,
        child: ListView(
          padding: const EdgeInsets.all(16),
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
                      validator: (v) {
                        final n = _numero(v ?? '');
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
              const SizedBox(height: 8),
              const Text(
                'A estimativa é comparada depois com o peso real da balança. '
                'É dela que sai o indicador de acurácia da avaliação em campo.',
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.black54,
                  height: 1.4,
                ),
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
                  helperText:
                      'Opcional — só se o preço já foi acertado no erval',
                ),
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
                            ? Colors.black45
                            : _localizacao!.aproximada
                            ? Colors.orange.shade800
                            : Colors.green.shade700,
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
              const SizedBox(height: 8),
              const Text(
                'As fotos ficam no aparelho e sobem uma a uma, depois da '
                'avaliação. Se uma falhar, as outras não são afetadas.',
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.black54,
                  height: 1.4,
                ),
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
                style: TextStyle(fontSize: 12, color: Colors.black54),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Peças da tela
// ---------------------------------------------------------------------------

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
          border: Border.all(color: Colors.black12),
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Text(
          'Nenhuma foto ainda',
          style: TextStyle(color: Colors.black45),
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
                      borderRadius: BorderRadius.circular(8),
                      child: Image.file(
                        File(f.caminho),
                        height: 96,
                        width: 96,
                        fit: BoxFit.cover,
                        // O arquivo pode ter sumido entre a captura e agora — o
                        // Android limpa armazenamento sem avisar. Sem este
                        // tratamento a miniatura quebraria a tela inteira; com
                        // ele, a foto ausente fica visível como tal, e o
                        // avaliador pode refazê-la ainda no erval.
                        errorBuilder:
                            (context, erro, pilha) => Container(
                              height: 96,
                              width: 96,
                              color: Colors.red.shade50,
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    Icons.broken_image_outlined,
                                    color: Colors.red.shade300,
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Sumiu',
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: Colors.red.shade700,
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
                            color: Colors.black54,
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

/// Busca de produtor em folha de baixo. Lê o SQLite, como todo o resto.
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
                color: Colors.black26,
                borderRadius: BorderRadius.circular(2),
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
        color: Colors.black45,
      ),
    ),
  );
}

double? _numero(String v) {
  final limpo = v.trim().replaceAll('.', '').replaceAll(',', '.');
  if (limpo.isEmpty) return null;
  return double.tryParse(limpo);
}

int? _inteiro(String v) => v.trim().isEmpty ? null : int.tryParse(v.trim());
