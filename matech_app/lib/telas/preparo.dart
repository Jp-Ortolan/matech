// ---------------------------------------------------------------------------
// TELA · preparo para o campo
// ---------------------------------------------------------------------------
// Aparece uma vez, logo depois do primeiro login, e resolve um problema de
// SEQUÊNCIA — não de interface.
//
// O ANDROID PEDE PERMISSÃO NO MOMENTO DO USO. Sem esta tela, o avaliador só
// veria o diálogo de câmera e de GPS quando já estivesse dentro do erval, na
// frente do produtor, com o formulário aberto. Se negasse ali — por pressa,
// por desconfiança, por engano — perderia a foto e a coordenada daquela
// avaliação, e recuperar exigiria voltar à propriedade.
//
// Pedir aqui, com calma, no escritório, muda a natureza da pergunta: em vez de
// um diálogo do sistema interrompendo o trabalho, é uma tela que explica para
// que serve cada permissão antes de pedi-la.
//
// A MESMA LÓGICA VALE PARA OS PRODUTORES. Baixar o espelho é a única coisa do
// aplicativo que degrada sem conexão, e é justamente a que precisa ser feita
// ANTES de sair. Deixar isso a cargo da memória do avaliador seria garantir
// que um dia ele esqueceria — e descobriria no erval, sem sinal, que o
// produtor que procura não está na lista.
//
// NADA AQUI É OBRIGATÓRIO. O botão de pular existe e é honesto: quem já
// concedeu tudo, ou quem está saindo às pressas, não deve ser barrado por uma
// tela de preparo. Ela informa, não impõe.

import 'package:flutter/material.dart';

import '../servicos/api.dart';
import '../servicos/arquivos.dart';
import '../servicos/captura_de_fotos.dart';
import '../servicos/localizacao.dart';
import '../servicos/sincronizador.dart';
import '../widgets/tema.dart';

/// Estado de cada passo, para a tela saber que ícone mostrar.
enum _Passo { pendente, fazendo, feito, falhou }

class TelaPreparo extends StatefulWidget {
  const TelaPreparo({super.key});

  @override
  State<TelaPreparo> createState() => _TelaPreparoState();
}

class _TelaPreparoState extends State<TelaPreparo> {
  _Passo _localizacao = _Passo.pendente;
  _Passo _camera = _Passo.pendente;
  _Passo _produtores = _Passo.pendente;

  String? _detalheLocalizacao;
  String? _detalheCamera;
  String? _detalheProdutores;

  bool get _terminou =>
      _localizacao != _Passo.pendente &&
      _camera != _Passo.pendente &&
      _produtores != _Passo.pendente;

  // -------------------------------------------------------------------------

  /// Pede a permissão de localização DE FATO — capturando uma posição.
  ///
  /// Não existe "só pedir a permissão" sem tentar usar: é o pedido de uso que
  /// dispara o diálogo do sistema. E tentar de verdade tem uma vantagem: se o
  /// GPS estiver desligado, o avaliador descobre agora, no escritório, e não
  /// no meio do mato.
  Future<void> _pedirLocalizacao() async {
    setState(() => _localizacao = _Passo.fazendo);

    final resultado = await ServicoDeLocalizacao.capturar();
    if (!mounted) return;

    setState(() {
      if (resultado.temPosicao) {
        _localizacao = _Passo.feito;
        _detalheLocalizacao = 'Liberada e funcionando.';
      } else {
        _localizacao = _Passo.falhou;
        _detalheLocalizacao = resultado.mensagem;
      }
    });

    if (!resultado.temPosicao && resultado.abreConfiguracoes) {
      await ServicoDeLocalizacao.abrirConfiguracoes(resultado.falha!);
    }
  }

  /// Mesma ideia: abrir a câmera é o que dispara o pedido de permissão.
  /// A foto tirada aqui é descartada — o objetivo é a permissão, não a imagem.
  Future<void> _pedirCamera() async {
    setState(() => _camera = _Passo.fazendo);

    final resultado = await CapturaDeFotos.daCamera();
    if (!mounted) return;

    // Descarta o que foi capturado: era só para provocar o diálogo do sistema.
    for (final foto in resultado.fotos) {
      await Arquivos.apagarFoto(foto.caminho);
    }
    if (!mounted) return;

    setState(() {
      if (resultado.temFotos) {
        _camera = _Passo.feito;
        _detalheCamera = 'Liberada e funcionando.';
      } else if (resultado.cancelado) {
        // Fechou a câmera sem tirar foto. A permissão foi concedida — senão
        // a câmera nem teria aberto —, então isto conta como sucesso.
        _camera = _Passo.feito;
        _detalheCamera = 'Liberada.';
      } else {
        _camera = _Passo.falhou;
        _detalheCamera = resultado.mensagem;
      }
    });

    if (resultado.falha != null && resultado.abreConfiguracoes) {
      await CapturaDeFotos.abrirConfiguracoes();
    }
  }

  Future<void> _baixarProdutores() async {
    setState(() => _produtores = _Passo.fazendo);

    try {
      await sincronizador.baixarProdutores();
      if (!mounted) return;
      setState(() {
        _produtores = _Passo.feito;
        _detalheProdutores = sincronizador.ultimaMensagem;
      });
    } on ErroDeRede catch (e) {
      if (!mounted) return;
      setState(() {
        _produtores = _Passo.falhou;
        _detalheProdutores =
            '${e.mensagem}. Sem isto, só aparecerão no erval os produtores '
            'que já estavam no aparelho.';
      });
    } on ErroDaApi catch (e) {
      if (!mounted) return;
      setState(() {
        _produtores = _Passo.falhou;
        _detalheProdutores = e.mensagem;
      });
    }
  }

  Future<void> _prepararTudo() async {
    await _pedirLocalizacao();
    await _pedirCamera();
    await _baixarProdutores();
  }

  // -------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Antes de sair a campo'),
        automaticallyImplyLeading: false,
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text(
            'Três coisas precisam de internet. Depois disto, o aplicativo '
            'funciona sem sinal o dia todo.',
            style: TextStyle(fontSize: 15, height: 1.4),
          ),
          const SizedBox(height: 24),

          _CartaoDePasso(
            icone: Icons.location_on_outlined,
            titulo: 'Localização',
            descricao:
                'Em que ponto do erval a avaliação foi feita.',
            estado: _localizacao,
            detalhe: _detalheLocalizacao,
            aoTocar: _localizacao == _Passo.fazendo ? null : _pedirLocalizacao,
          ),
          const SizedBox(height: 12),

          _CartaoDePasso(
            icone: Icons.photo_camera_outlined,
            titulo: 'Câmera',
            descricao:
                'A foto tirada agora é descartada: serve só para liberar a permissão.',
            estado: _camera,
            detalhe: _detalheCamera,
            aoTocar: _camera == _Passo.fazendo ? null : _pedirCamera,
          ),
          const SizedBox(height: 12),

          _CartaoDePasso(
            icone: Icons.cloud_download_outlined,
            titulo: 'Baixar os produtores',
            descricao:
                'Traz a lista do escritório. É a única que não dá para fazer no erval.',
            estado: _produtores,
            detalhe: _detalheProdutores,
            aoTocar: _produtores == _Passo.fazendo ? null : _baixarProdutores,
          ),

          const SizedBox(height: 32),
          FilledButton.icon(
            onPressed: _prepararTudo,
            icon: const Icon(Icons.play_arrow),
            label: const Text('Preparar tudo'),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(_terminou ? 'Continuar' : 'Pular por agora'),
          ),
          const SizedBox(height: 16),
          const Text(
            'Se pular, cada permissão é pedida na hora de usar.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12, color: Cores.cinza600),
          ),
        ],
      ),
    );
  }
}

class _CartaoDePasso extends StatelessWidget {
  final IconData icone;
  final String titulo;
  final String descricao;
  final _Passo estado;
  final String? detalhe;
  final VoidCallback? aoTocar;

  const _CartaoDePasso({
    required this.icone,
    required this.titulo,
    required this.descricao,
    required this.estado,
    required this.detalhe,
    required this.aoTocar,
  });

  @override
  Widget build(BuildContext context) {
    final (cor, marca) = switch (estado) {
      _Passo.feito => (Cores.mate700, Icons.check_circle),
      _Passo.falhou => (Cores.alerta, Icons.error_outline),
      _ => (Cores.cinza400, Icons.chevron_right),
    };

    return Card(
      child: InkWell(
        onTap: aoTocar,
        borderRadius: raioPadrao,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icone, color: Cores.cinza600),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      titulo,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      descricao,
                      style: const TextStyle(
                        fontSize: 13,
                        color: Cores.cinza600,
                        height: 1.4,
                      ),
                    ),
                    if (detalhe != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        detalhe!,
                        style: TextStyle(fontSize: 12, color: cor, height: 1.4),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
              estado == _Passo.fazendo
                  ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                  : Icon(marca, color: cor),
            ],
          ),
        ),
      ),
    );
  }
}
