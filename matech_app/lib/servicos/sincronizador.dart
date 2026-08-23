// ---------------------------------------------------------------------------
// SERVIÇO · sincronizador  (RF17, RF18 e RNF08)
// ---------------------------------------------------------------------------
// O componente que este TCC existe para demonstrar.
//
// Ele faz uma coisa só: pega o que está na fila e entrega ao servidor, na
// ordem, aguentando a conexão cair no meio. Nenhuma tela chama a API; todas
// gravam no SQLite e é este serviço que, depois, leva os dados embora.
//
// AS TRÊS GARANTIAS, E ONDE CADA UMA MORA
//
// 1. NÃO DUPLICAR. O clientId nasce no aparelho, antes de qualquer conexão, e
//    é @unique lá no PostgreSQL. Se a resposta do servidor se perder no
//    caminho — e no meio do mato ela se perde — este serviço reenvia o mesmo
//    pacote, e o servidor devolve DUPLICADO em vez de criar outro registro. A
//    garantia é do banco, não de um "if" que alguém pode esquecer de escrever.
//
// 2. NÃO PERDER. Nada sai da fila por conta própria. Uma operação só vira
//    ENVIADA quando o servidor confirma, nominalmente, aquele clientId. Falha
//    de rede reagenda; falha de regra fica parada e visível.
//
// 3. NÃO SE CONTRADIZER. A avaliação leva alteradoEmOrigem — o relógio do
//    APARELHO. É ele que decide o conflito no servidor, e não a ordem de
//    chegada. Uma correção feita às 15h30 sem sinal ganha de um envio que saiu
//    antes e chegou depois.
//
// POR QUE NÃO EXISTE connectivity_plus AQUI: detectar Wi-Fi não é detectar
// servidor. Um celular conectado a um roteador sem internet responde "tenho
// conexão" e o envio falha do mesmo jeito. Este serviço simplesmente TENTA, e
// o fracasso da tentativa é a única informação confiável sobre a rede. Uma
// dependência a menos e um modo de falha a menos.

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

  /// O despertador. É ele que faz a espera crescente do Config valer alguma
  /// coisa: sem ele, uma operação reagendada para daqui a trinta minutos só
  /// seria retentada se o usuário abrisse o aplicativo de novo, e a escada
  /// seria enfeite.
  ///
  /// Um Timer só, sempre marcado para a próxima operação que vence — e não um
  /// laço de "tenta a cada X segundos". A diferença importa na bateria: com o
  /// aparelho no bolso e nada vencendo, este aplicativo não acorda.
  Timer? _despertador;
  DateTime? _proximoDespertar;

  /// Trava o despertador quando o servidor devolve 401.
  ///
  /// Sem ela haveria um laço apertado: o token vencido faz o lote falhar sem
  /// reagendar nada, a fila continua elegível, o despertador acorda em cinco
  /// segundos e tudo se repete — martelando o servidor com requisições que
  /// não têm a menor chance de funcionar até alguém digitar a senha de novo.
  ///
  /// Uma tentativa manual (ou a subida do aplicativo) limpa a trava.
  bool _pausadoPorSessao = false;

  bool get rodando => _rodando;
  String? get ultimaMensagem => _ultimaMensagem;
  DateTime? get ultimaTentativa => _ultimaTentativa;
  Map<String, int> get contagens => _contagens;

  /// Quando será a próxima tentativa automática. A tela mostra isso para que
  /// "sincroniza sozinho" não seja um ato de fé.
  DateTime? get proximoDespertar => _proximoDespertar;

  int get pendentes =>
      (_contagens[OperacaoPendente.pendente] ?? 0) +
      (_contagens[OperacaoPendente.dependencia] ?? 0);
  int get comErro => _contagens[OperacaoPendente.erro] ?? 0;
  int get enviadas => _contagens[OperacaoPendente.enviada] ?? 0;

  /// A taxa do Quadro 7 calculada do lado do aparelho: confirmadas ÷ total.
  double? get taxaSincronizacao {
    final total = enviadas + pendentes + comErro;
    if (total == 0) return null;
    return enviadas / total * 100;
  }

  Future<void> atualizarContagens() async {
    _contagens = await FilaDao.contagens();
    notifyListeners();
  }

  // -------------------------------------------------------------------------
  // RETOMADA AUTOMÁTICA
  // -------------------------------------------------------------------------
  // "Quando existir conexão, tentar sincronizar" — e a pergunta é como saber
  // que existe conexão.
  //
  // A resposta deste aplicativo é: NÃO SE PERGUNTA, SE TENTA. Detectar Wi-Fi
  // não é detectar servidor — um celular conectado a um roteador sem internet
  // responde "tenho conexão" e o envio falha do mesmo jeito. O fracasso de uma
  // tentativa real é a única informação confiável sobre a rede, e é de graça:
  // já estávamos tentando.
  //
  // Então a retomada tem três gatilhos, e nenhum deles é um detector de rede:
  //
  //   1. o despertador, marcado para a hora da próxima operação que vence
  //   2. o aplicativo voltar para o primeiro plano (o usuário chegou num
  //      lugar com sinal e abriu o aplicativo — o caso mais comum de todos)
  //   3. o botão "Sincronizar agora", quando a pessoa quer decidir a hora

  /// Liga a retomada automática. Chamado uma vez, na subida do aplicativo.
  Future<void> iniciarRetomadaAutomatica() => _remarcarDespertador();

  /// Chamado quando o aplicativo volta do segundo plano — ver main.dart.
  ///
  /// Não sincroniza sempre: só quando há algo pronto para subir. Voltar ao
  /// aplicativo com a fila vazia não deve custar uma requisição.
  Future<void> aoVoltarParaOPrimeiroPlano() async {
    if (!sessao.autenticado) return;
    if (await FilaDao.temAlgoPronto()) {
      await sincronizar();
    } else {
      await _remarcarDespertador();
    }
  }

  /// Marca o despertador para a próxima operação que vence.
  ///
  /// Um Timer único, sempre reescrito. Se algo já venceu enquanto o aplicativo
  /// estava parado, dispara em um segundo em vez de no passado.
  Future<void> _remarcarDespertador() async {
    _despertador?.cancel();
    _despertador = null;
    _proximoDespertar = null;

    // Sem sessão válida, ou com a sessão vencida no meio da passada, o
    // despertador fica desligado: insistir sem token é gastar bateria para
    // colecionar 401. Quem destrava é uma ação da pessoa.
    if (!sessao.autenticado || _pausadoPorSessao) {
      notifyListeners();
      return;
    }

    final proximo = await FilaDao.proximoDespertar();
    final temPronto = await FilaDao.temAlgoPronto();

    // Nada esperando: o despertador fica desligado. Um aplicativo que acorda
    // de dez em dez minutos sem ter o que fazer é um aplicativo que chega ao
    // fim da tarde com a bateria no fim — e aí não há coleta para sincronizar.
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
      // Sem await: o Timer não espera ninguém. sincronizar() já se protege
      // contra duas passadas ao mesmo tempo e remarca o despertador no fim.
      unawaited(sincronizar());
    });

    notifyListeners();
  }

  /// Solta todas as operações recusadas de volta para a fila.
  ///
  /// Existe porque a causa costuma ser comum a várias — o servidor estava fora
  /// do ar, a sessão tinha expirado — e nesses casos reativar uma por uma é
  /// trabalho manual sem propósito nenhum.
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
    super.dispose();
  }

  // -------------------------------------------------------------------------
  // A PASSADA
  // -------------------------------------------------------------------------

  /// Sobe tudo que está aguardando: primeiro os lotes, depois as fotos.
  ///
  /// A ordem entre os dois não é estética. A foto só é aceita depois que a
  /// avaliação dela chegou — mandar as fotos antes garantiria uma rodada
  /// inteira de 409 e um gasto de dados que a zona rural não perdoa.
  Future<void> sincronizar() async {
    if (_rodando) return; // duas passadas ao mesmo tempo brigariam pela fila
    if (!sessao.autenticado) {
      _ultimaMensagem = 'Faça login para sincronizar';
      notifyListeners();
      return;
    }

    _rodando = true;
    _ultimaMensagem = null;
    // Toda passada começa destravada: se a pessoa entrou de novo, a trava por
    // sessão vencida não deve sobreviver à nova tentativa.
    _pausadoPorSessao = false;
    notifyListeners();

    try {
      final enviadasAgora = await _subirLotes();
      final fotosAgora = await _subirFotos();

      _ultimaTentativa = DateTime.now();
      _ultimaMensagem = _resumoDaPassada(enviadasAgora, fotosAgora);
    } on ErroDeRede catch (e) {
      // A rede está fora AGORA. O que nem chegou a ser tentado é empurrado
      // meio minuto para frente — senão o despertador acordaria em cinco
      // segundos para bater na mesma porta fechada.
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
      // Marca o despertador para a próxima operação que vence. Vai aqui, no
      // finally, porque precisa acontecer mesmo quando a passada fracassou —
      // é justamente aí que há coisa reagendada esperando.
      await _remarcarDespertador();
    }
  }

  /// Envia os lotes de Produtor, Erval e Avaliacao, 25 por vez.
  Future<int> _subirLotes() async {
    var confirmadas = 0;

    // Teto de segurança. Não deve ser alcançado — o laço termina sozinho —
    // mas um erro de lógica futuro viraria um laço infinito com requisições
    // de rede dentro, que é o pior tipo de laço infinito que existe.
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
        // A rede caiu no meio. NENHUMA operação é dada como perdida: todas
        // voltam para a fila com espera crescente. É o caso normal no erval.
        await _reagendarTodas(pendentes, e.mensagem);
        rethrow;
      } on ErroDaApi catch (e) {
        if (e.definitivo && e.status != 401) {
          // O servidor recusou o LOTE inteiro (corpo malformado, por exemplo).
          // Marcar tudo como erro seria exagero, mas insistir sem parar
          // também: reagenda contando a tentativa.
          await _reagendarTodas(pendentes, e.toString());
        }
        rethrow;
      }

      // A resposta traz um resultado por operação, endereçado pelo clientId.
      //
      // O endereçamento é NOMINAL, e não por posição na lista. Parear pelo
      // índice pareceria funcionar e seria uma bomba: bastaria o servidor
      // devolver os resultados fora de ordem, ou omitir um, para uma avaliação
      // ser marcada como enviada por causa da confirmação de outra.
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
          // O servidor não falou sobre esta operação. Sem confirmação
          // nominal, ela NÃO sai da fila — é a garantia número 2.
          await _reagendar(operacao, 'O servidor não confirmou esta operação');
          continue;
        }

        final tratada = await _aplicarResultado(operacao, resultado);
        if (tratada) {
          confirmadas++;
          houveAceite = true;
        }
      }

      // Um pai acabou de subir: quem estava esperando por ele já pode ir, sem
      // cumprir os vinte segundos que foram agendados quando ele ainda não
      // existia. É o que faz produtor, área e avaliação subirem na MESMA
      // passada, em vez de exigirem três.
      if (houveAceite) await FilaDao.liberarDependentes();

      // Continua enquanto houver algo pronto. Não basta olhar o tamanho do
      // lote: se um pai acabou de ser aceite e liberou os dependentes, eles
      // ficaram prontos AGORA e precisam entrar nesta mesma passada.
      //
      // O laço termina porque toda operação sai daqui num de três estados:
      // ENVIADA (fora da fila), ERRO (fora da fila) ou reagendada para o
      // futuro (não está pronta). Nenhum deles continua elegível.
      if (!await FilaDao.temAlgoPronto()) break;
    }

    return confirmadas;
  }

  /// Traduz o veredito do servidor sobre uma operação em estado local.
  /// Devolve true quando a operação foi definitivamente confirmada.
  Future<bool> _aplicarResultado(
    OperacaoPendente operacao,
    Map<String, dynamic> resultado,
  ) async {
    final situacao = resultado['situacao'] as String?;
    final idServidor = resultado['id'] as String?;

    switch (situacao) {
      // ACEITO e DUPLICADO terminam no mesmo lugar de propósito: em ambos o
      // registro EXISTE no servidor com aquele clientId, que é tudo que a
      // idempotência promete. DUPLICADO é o reenvio funcionando, não um erro.
      case 'ACEITO':
      case 'DUPLICADO':
        await _gravarIdDoServidor(operacao, idServidor);
        await FilaDao.marcarEnviada(operacao.clientId);
        return true;

      // O dado está bom, só chegou antes do registro de que depende.
      // Volta para a fila SEM contar tentativa — a próxima passada resolve.
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

  /// Escreve o id definitivo na tabela da entidade e propaga para os filhos —
  /// o erval passa a conhecer o id do produtor, a avaliação o id do erval.
  /// A partir daí, um envio futuro encontra o pai pelo id do servidor, sem
  /// depender de o clientId ainda estar lá.
  Future<void> _gravarIdDoServidor(
    OperacaoPendente operacao,
    String? id,
  ) async {
    switch (operacao.entidade) {
      case 'Produtor':
        await ProdutorDao.confirmarSincronizacao(operacao.clientId, id);
      case 'Erval':
        await ErvalDao.confirmarSincronizacao(operacao.clientId, id);
      case 'Avaliacao':
        await AvaliacaoDao.confirmarSincronizacao(operacao.clientId, id);
      case 'FotoErval':
        await FotoDao.confirmarSincronizacao(operacao.clientId, id);
    }
  }

  // -------------------------------------------------------------------------
  // FOTOS · uma requisição cada
  // -------------------------------------------------------------------------
  // Foto de celular tem de 2 a 4 MB. Se viajassem dentro do lote, em base64, a
  // requisição incharia em um terço e a queda do sinal no meio da terceira
  // foto derrubaria a avaliação junto. Indo sozinhas, o fracasso de uma não
  // arrasta as outras — nem o dado que realmente importa.

  /// Quantas fotos sobem por rodada. Poucas de propósito: cada uma é uma
  /// requisição inteira, e travar o envio dos dados por causa de trinta fotos
  /// seria inverter a prioridade — o dado importa mais que a imagem.
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
          // O arquivo sumiu do aparelho — o sistema limpou, alguém apagou por
          // um gerenciador, o cartão saiu. Insistir não o traz de volta, então
          // a operação para aqui em vez de ficar rodando para sempre.
          //
          // Marca nos DOIS lugares: a fila, para não tentar mais, e a linha da
          // foto, para que o registro não pareça completo. A linha não é
          // apagada — ela é a prova de que aquela avaliação teve uma foto, e
          // é o que permite a alguém decidir voltar ao erval e refazê-la.
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
          // 409 é a avaliação ainda não ter chegado — não é falha da foto.
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

  // -------------------------------------------------------------------------
  // Espera crescente
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // ESPELHO · trazer os produtores do servidor
  // -------------------------------------------------------------------------
  // Feito de propósito no sentido oposto ao envio: aqui o servidor manda e o
  // aparelho recebe. É o que permite ao avaliador encontrar, no meio do mato,
  // um produtor cadastrado no escritório mês passado.
  //
  // Deve ser rodado ANTES de sair a campo, com sinal. É a única parte do
  // aplicativo que degrada sem conexão — e degrada de forma honesta: a lista
  // fica com o que havia da última vez, em vez de ficar vazia.

  Future<int> baixarProdutores() async {
    if (!sessao.autenticado) return 0;

    final lista = await Api.listarProdutores(sessao.usuario!.token);

    // O GET /api/produtores já devolve os ervais dentro de cada produtor, e
    // vale aproveitá-los: sem as áreas, o avaliador seria obrigado a criar uma
    // "área nova" a cada visita, duplicando na web a mesma propriedade.
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

/// Uma instância para o aplicativo inteiro — ver o comentário em sessao.dart.
final Sincronizador sincronizador = Sincronizador();
