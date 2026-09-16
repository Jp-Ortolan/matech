import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../config.dart';
import '../dados/avaliacao_dao.dart';
import '../dados/erval_dao.dart';
import '../dados/fila_dao.dart';
import '../dados/foto_dao.dart';
import '../dados/produtor_dao.dart';
import '../modelos/erval.dart';
import '../modelos/operacao_pendente.dart';
import '../modelos/produtor.dart';
import 'api.dart';
import 'arquivos.dart';
import 'politica_de_tentativas.dart';
import 'sessao.dart';

class Sincronizador extends ChangeNotifier {
  bool _rodando = false;
  String? _ultimaMensagem;
  DateTime? _ultimaTentativa;
  Map<String, int> _contagens = const {};

  Timer? _despertador;
  DateTime? _proximoDespertar;

  Timer? _batida;
  bool _emPrimeiroPlano = true;

  bool _pausadoPorSessao = false;

  bool get rodando => _rodando;
  String? get ultimaMensagem => _ultimaMensagem;
  DateTime? get ultimaTentativa => _ultimaTentativa;
  Map<String, int> get contagens => _contagens;

  DateTime? get proximoDespertar => _proximoDespertar;

  int get pendentes =>
      (_contagens[OperacaoPendente.pendente] ?? 0) +
      (_contagens[OperacaoPendente.dependencia] ?? 0);
  int get comErro => _contagens[OperacaoPendente.erro] ?? 0;
  int get enviadas => _contagens[OperacaoPendente.enviada] ?? 0;

  double? get taxaSincronizacao {
    final total = enviadas + pendentes + comErro;
    if (total == 0) return null;
    return enviadas / total * 100;
  }

  Future<void> atualizarContagens() async {
    _contagens = await FilaDao.contagens();
    await _reavaliarBatida();
    notifyListeners();
  }

  Future<void> iniciarRetomadaAutomatica() => _remarcarDespertador();

  Future<void> aoVoltarParaOPrimeiroPlano() async {
    _emPrimeiroPlano = true;
    if (!sessao.autenticado) return;
    if (await FilaDao.temAlgoPronto()) {
      await sincronizar();
    } else {
      await _remarcarDespertador();
      await _reavaliarBatida();
    }
  }

  void aoIrParaSegundoPlano() {
    _emPrimeiroPlano = false;
    _batida?.cancel();
    _batida = null;
  }

  Future<void> _reavaliarBatida() async {
    final deveBater =
        _emPrimeiroPlano &&
        sessao.autenticado &&
        !_pausadoPorSessao &&
        (await FilaDao.temAlgoPronto());

    if (!deveBater) {
      _batida?.cancel();
      _batida = null;
      return;
    }

    if (_batida != null) return;

    _batida = Timer.periodic(_intervaloDaBatida, (_) {
      if (!_rodando) unawaited(sincronizar());
    });
  }

  static const Duration _intervaloDaBatida = Duration(seconds: 45);

  Future<void> _remarcarDespertador() async {
    _despertador?.cancel();
    _despertador = null;
    _proximoDespertar = null;

    if (!sessao.autenticado || _pausadoPorSessao) {
      notifyListeners();
      return;
    }

    final proximo = await FilaDao.proximoDespertar();
    final temPronto = await FilaDao.temAlgoPronto();

    if (proximo == null && !temPronto) {
      notifyListeners();
      return;
    }

    final espera =
        temPronto
            ? const Duration(seconds: 5)
            : proximo!.difference(DateTime.now());

    final esperaSegura =
        espera.isNegative ? const Duration(seconds: 1) : espera;

    _proximoDespertar = DateTime.now().add(esperaSegura);
    _despertador = Timer(esperaSegura, () {
      unawaited(sincronizar());
    });

    notifyListeners();
  }

  Future<void> tentarTodasDeNovo() async {
    final quantas = await FilaDao.reativarTodas();
    if (quantas == 0) {
      _ultimaMensagem = 'Não há registros recusados.';
      notifyListeners();
      return;
    }
    await sincronizar();
  }

  @override
  void dispose() {
    _despertador?.cancel();
    _batida?.cancel();
    super.dispose();
  }

  Future<void> sincronizar() async {
    if (_rodando) return; // duas passadas ao mesmo tempo brigariam pela fila
    if (!sessao.autenticado) {
      _ultimaMensagem = 'Faça login para sincronizar';
      notifyListeners();
      return;
    }

    _rodando = true;
    _ultimaMensagem = null;
    _pausadoPorSessao = false;
    notifyListeners();

    try {
      final enviadasAgora = await _subirLotes();
      final fotosAgora = await _subirFotos();

      _ultimaTentativa = DateTime.now();
      _ultimaMensagem = _resumoDaPassada(enviadasAgora, fotosAgora);

      try {
        await baixarProdutores();
      } catch (_) {
      }
    } on ErroDeRede catch (e) {
      await FilaDao.adiarProntos(const Duration(seconds: 30));
      _ultimaMensagem =
          '${e.mensagem}. Nada foi perdido: a fila continua no aparelho.';
    } on ErroDaApi catch (e) {
      if (e.status == 401) {
        _pausadoPorSessao = true;
        _ultimaMensagem =
            'Sessão expirada. Entre de novo para sincronizar — os dados '
            'continuam salvos no aparelho.';
      } else {
        _ultimaMensagem = e.toString();
      }
    } finally {
      _rodando = false;
      await atualizarContagens();
      await _remarcarDespertador();
    }
  }

  Future<int> _subirLotes() async {
    var confirmadas = 0;

    var voltas = 0;
    const maximoDeVoltas = 100;

    while (voltas++ < maximoDeVoltas) {
      final pendentes = await FilaDao.proximasDoLote(
        limite: Config.tamanhoDoLote,
      );
      if (pendentes.isEmpty) break;

      final operacoes =
          pendentes
              .map(
                (o) => {
                  'clientId': o.clientId,
                  'entidade': o.entidade,
                  'criadoEmOrigem': o.criadoEmOrigem.toIso8601String(),
                  'payload': jsonDecode(o.payloadJson),
                },
              )
              .toList();

      final Map<String, dynamic> resposta;
      try {
        resposta = await Api.enviarLote(
          token: sessao.usuario!.token,
          dispositivoId: sessao.dispositivoId,
          operacoes: operacoes,
        );
      } on ErroDeRede catch (e) {
        await _reagendarTodas(pendentes, e.mensagem);
        rethrow;
      } on ErroDaApi catch (e) {
        if (e.definitivo && e.status != 401) {
          await _reagendarTodas(pendentes, e.toString());
        }
        rethrow;
      }

      final resultados = <String, Map<String, dynamic>>{};
      for (final bruto
          in (resposta['resultados'] as List<dynamic>? ?? const [])) {
        final r = bruto as Map<String, dynamic>;
        final clientId = r['clientId'] as String?;
        if (clientId != null) resultados[clientId] = r;
      }

      var houveAceite = false;

      for (final operacao in pendentes) {
        final resultado = resultados[operacao.clientId];

        if (resultado == null) {
          await _reagendar(operacao, 'O servidor não confirmou esta operação');
          continue;
        }

        final tratada = await _aplicarResultado(operacao, resultado);
        if (tratada) {
          confirmadas++;
          houveAceite = true;
        }
      }

      if (houveAceite) await FilaDao.liberarDependentes();

      if (!await FilaDao.temAlgoPronto()) break;
    }

    return confirmadas;
  }

  Future<bool> _aplicarResultado(
    OperacaoPendente operacao,
    Map<String, dynamic> resultado,
  ) async {
    final situacao = resultado['situacao'] as String?;
    final idServidor = resultado['id'] as String?;

    switch (situacao) {
      case 'ACEITO':
      case 'DUPLICADO':
        await _gravarIdDoServidor(operacao, idServidor);
        await FilaDao.marcarEnviada(operacao.clientId);
        return true;

      case 'DEPENDENCIA_PENDENTE':
        await FilaDao.marcarDependenciaPendente(
          operacao.clientId,
          resultado['erro'] as String?,
          rodadas: operacao.tentativas + 1,
        );
        return false;

      case 'ERRO':
      default:
        await FilaDao.marcarErro(
          operacao.clientId,
          (resultado['erro'] as String?) ?? 'O servidor recusou o registro',
        );
        return false;
    }
  }

  Future<void> _gravarIdDoServidor(
    OperacaoPendente operacao,
    String? id,
  ) async {
    switch (operacao.entidade) {
      case 'Produtor':
        await ProdutorDao.confirmarSincronizacao(operacao.clientId, id);
        if (id != null) {
          await FilaDao.apontarPaiPeloId(
            campoClientId: 'produtorClientId',
            campoId: 'produtorId',
            clientIdDoPai: operacao.clientId,
            idDoPai: id,
          );
        }
      case 'Erval':
        await ErvalDao.confirmarSincronizacao(operacao.clientId, id);
        if (id != null) {
          await FilaDao.apontarPaiPeloId(
            campoClientId: 'ervalClientId',
            campoId: 'ervalId',
            clientIdDoPai: operacao.clientId,
            idDoPai: id,
          );
        }
      case 'Avaliacao':
        await AvaliacaoDao.confirmarSincronizacao(operacao.clientId, id);
      case 'FotoErval':
        await FotoDao.confirmarSincronizacao(operacao.clientId, id);
    }
  }

  static const int _fotosPorRodada = 5;

  Future<int> _subirFotos() async {
    var enviadas = 0;

    while (true) {
      final pendentes = await FilaDao.proximasFotos(limite: _fotosPorRodada);
      if (pendentes.isEmpty) break;

      for (final operacao in pendentes) {
        final payload =
            jsonDecode(operacao.payloadJson) as Map<String, dynamic>;
        final caminho = payload['caminhoLocal'] as String;

        final bytes = await Arquivos.lerFoto(caminho);
        if (bytes == null) {
          await FilaDao.marcarErro(
            operacao.clientId,
            'O arquivo desta foto não está mais no aparelho. '
            'A avaliação continua salva; só a imagem se perdeu.',
          );
          await FotoDao.marcarArquivoAusente(operacao.clientId);
          continue;
        }

        try {
          final resposta = await Api.enviarFoto(
            token: sessao.usuario!.token,
            dispositivoId: sessao.dispositivoId,
            clientId: operacao.clientId,
            avaliacaoClientId: payload['avaliacaoClientId'] as String,
            bytes: bytes,
            largura: payload['largura'] as int?,
            altura: payload['altura'] as int?,
          );
          await _aplicarResultado(operacao, resposta);
          enviadas++;
        } on ErroDaApi catch (e) {
          if (e.status == 409) {
            await FilaDao.marcarDependenciaPendente(
              operacao.clientId,
              e.mensagem,
              rodadas: operacao.tentativas + 1,
            );
          } else if (e.definitivo) {
            await FilaDao.marcarErro(operacao.clientId, e.toString());
          } else {
            await _reagendar(operacao, e.toString());
          }
        } on ErroDeRede catch (e) {
          await _reagendar(operacao, e.mensagem);
          rethrow; // sem rede, não adianta tentar as próximas fotos
        }
      }

      if (pendentes.length < _fotosPorRodada) break;
    }

    return enviadas;
  }

  Future<void> _reagendar(OperacaoPendente operacao, String motivo) async {
    final tentativas = operacao.tentativas + 1;
    await FilaDao.reagendar(
      operacao.clientId,
      tentativas: tentativas,
      espera: PoliticaDeTentativas.esperaPara(tentativas),
      motivo: motivo,
    );
  }

  Future<void> _reagendarTodas(
    List<OperacaoPendente> operacoes,
    String motivo,
  ) async {
    for (final o in operacoes) {
      await _reagendar(o, motivo);
    }
  }

  String _resumoDaPassada(int operacoes, int fotos) {
    if (operacoes == 0 && fotos == 0) {
      return pendentes > 0
          ? 'Nada subiu nesta passada. $pendentes na fila.'
          : 'Nada pendente para enviar.';
    }
    final partes = <String>[];
    if (operacoes > 0) {
      partes.add('$operacoes ${operacoes == 1 ? "registro" : "registros"}');
    }
    if (fotos > 0) partes.add('$fotos ${fotos == 1 ? "foto" : "fotos"}');
    return '${partes.join(" e ")} no servidor.';
  }

  Future<int> baixarProdutores() async {
    if (!sessao.autenticado) return 0;

    final lista = await Api.listarProdutores(sessao.usuario!.token);

    final comAreas =
        lista.map((bruto) {
          final j = bruto as Map<String, dynamic>;
          final produtor = Produtor.daApi(j);
          final ervais =
              ((j['ervais'] as List<dynamic>?) ?? const [])
                  .map(
                    (e) => Erval.daApi(
                      e as Map<String, dynamic>,
                      produtorClientId: produtor.clientId,
                      produtorId: produtor.id,
                    ),
                  )
                  .toList();
          return (produtor: produtor, ervais: ervais);
        }).toList();

    final novos = await ProdutorDao.guardarEspelho(comAreas);
    _ultimaMensagem =
        novos == 0
            ? 'Lista de produtores já estava atualizada.'
            : '$novos ${novos == 1 ? "produtor novo" : "produtores novos"} baixados.';
    notifyListeners();
    return novos;
  }
}

final Sincronizador sincronizador = Sincronizador();
