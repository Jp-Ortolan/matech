// ---------------------------------------------------------------------------
// SERVIÇO · cliente HTTP
// ---------------------------------------------------------------------------
// O ÚNICO arquivo do aplicativo que fala com a rede. Nenhuma tela importa
// este arquivo — quem o usa é o sincronizador. Essa regra é o que garante que
// o aplicativo se comporte igual com e sem sinal: se uma tela chamasse a API
// direto, ela ficaria em branco no erval.
//
// A DISTINÇÃO QUE MAIS IMPORTA AQUI É ENTRE DOIS TIPOS DE FRACASSO:
//
//   ErroDeRede    não deu para perguntar. Sem sinal, servidor fora, tempo
//                 esgotado. A operação continua boa — vale tentar de novo.
//   ErroDaApi     deu para perguntar e a resposta foi não. Um 400 ou 409:
//                 CPF duplicado, campo faltando. Tentar de novo não conserta.
//
// Tratar os dois igual é o erro clássico: ou o aplicativo desiste de um dado
// perfeito porque o sinal caiu, ou fica reenviando eternamente um CPF que já
// existe. É por isso que são duas classes.

import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import '../config.dart';

class ErroDeRede implements Exception {
  final String mensagem;
  const ErroDeRede(this.mensagem);
  @override
  String toString() => mensagem;
}

class ErroDaApi implements Exception {
  final int status;
  final String mensagem;
  final String? detalhe;
  const ErroDaApi(this.status, this.mensagem, [this.detalhe]);

  /// 4xx é decisão do servidor sobre o conteúdo — insistir não muda.
  /// 5xx é problema dele, e aí vale tentar de novo mais tarde.
  bool get definitivo => status >= 400 && status < 500;

  @override
  String toString() => detalhe == null ? mensagem : '$mensagem — $detalhe';
}

class Api {
  static const Duration _tempoLimite = Duration(seconds: 20);

  static Uri _url(String caminho) => Uri.parse('${Config.enderecoApi}$caminho');

  static Map<String, String> _cabecalhos(String? token) => {
    'Content-Type': 'application/json',
    if (token != null) 'Authorization': 'Bearer $token',
  };

  /// Envolve toda chamada: transforma as falhas de rede em ErroDeRede, para
  /// que o resto do aplicativo não precise conhecer o tipo de exceção que cada
  /// plataforma lança.
  ///
  /// POR QUE NÃO SE CAPTURA MAIS SocketException PELO TIPO: ela vem de
  /// `dart:io`, que não compila para web — importar aquele pacote aqui
  /// quebraria o build do navegador inteiro por causa de uma linha de catch.
  ///
  /// O `http` do próprio time do Dart já resolve isso: em qualquer plataforma
  /// ele embrulha a falha de transporte em ClientException, e é ela que
  /// chega aqui. Perde-se distinguir "sem rota para o host" de "conexão
  /// recusada" — o que não muda nada, porque as duas viravam a mesma frase.
  static Future<T> _tentar<T>(Future<T> Function() chamada) async {
    try {
      return await chamada();
    } on http.ClientException {
      throw const ErroDeRede('Sem conexão com o servidor');
    } on FormatException {
      throw const ErroDeRede('Resposta do servidor em formato inesperado');
    } catch (e) {
      if (e is ErroDaApi || e is ErroDeRede) rethrow;
      throw ErroDeRede('Não foi possível falar com o servidor: $e');
    }
  }

  /// Lê o corpo e transforma status de erro em ErroDaApi, aproveitando o
  /// formato padronizado que o middleware de erros da API devolve:
  /// { "erro": "...", "detalhe": "..." }
  static Map<String, dynamic> _corpo(http.Response r) {
    final texto = r.body.isEmpty ? '{}' : r.body;
    final dados = jsonDecode(texto) as Map<String, dynamic>;

    if (r.statusCode >= 400) {
      throw ErroDaApi(
        r.statusCode,
        (dados['erro'] as String?) ?? 'Erro ${r.statusCode}',
        dados['detalhe'] as String?,
      );
    }
    return dados;
  }

  // -------------------------------------------------------------------------
  // AUTENTICAÇÃO
  // -------------------------------------------------------------------------

  /// POST /api/auth/login → { token, usuario: { id, nome, usuario, perfil } }
  static Future<Map<String, dynamic>> login(String usuario, String senha) {
    return _tentar(() async {
      final r = await http
          .post(
            _url('/api/auth/login'),
            headers: _cabecalhos(null),
            body: jsonEncode({'usuario': usuario, 'senha': senha}),
          )
          .timeout(_tempoLimite);
      return _corpo(r);
    });
  }

  // -------------------------------------------------------------------------
  // PRODUTORES · o espelho que o aplicativo baixa enquanto há sinal
  // -------------------------------------------------------------------------

  /// GET /api/produtores → { total, produtores: [...] }
  static Future<List<dynamic>> listarProdutores(String token) {
    return _tentar(() async {
      final r = await http
          .get(_url('/api/produtores'), headers: _cabecalhos(token))
          .timeout(_tempoLimite);
      return (_corpo(r)['produtores'] as List<dynamic>?) ?? const [];
    });
  }

  // -------------------------------------------------------------------------
  // SINCRONIZAÇÃO
  // -------------------------------------------------------------------------

  /// POST /api/sincronizacao
  ///
  /// O corpo é { dispositivoId, operacoes: [...] } e cada operação leva
  /// clientId, entidade, criadoEmOrigem e payload — exatamente o que o
  /// sincronizacao.service.js do servidor espera.
  ///
  /// A resposta traz um resultado por operação, e é ela que decide o destino
  /// de cada linha da fila.
  static Future<Map<String, dynamic>> enviarLote({
    required String token,
    required String dispositivoId,
    required List<Map<String, dynamic>> operacoes,
  }) {
    return _tentar(() async {
      final r = await http
          .post(
            _url('/api/sincronizacao'),
            headers: _cabecalhos(token),
            body: jsonEncode({
              'dispositivoId': dispositivoId,
              'operacoes': operacoes,
            }),
          )
          .timeout(const Duration(seconds: 60)); // lote é maior que o resto
      return _corpo(r);
    });
  }

  /// POST /api/sincronizacao/fotos
  ///
  /// O corpo é a imagem CRUA, e os metadados vão em cabeçalho. É assim porque
  /// do outro lado a rota usa express.raw() — nenhuma biblioteca de upload
  /// entrou no projeto, nem aqui nem lá.
  ///
  /// O 409 aqui não é falha: é o servidor dizendo que a avaliação da foto
  /// ainda não chegou. A foto volta para a fila e sobe na próxima passada.
  static Future<Map<String, dynamic>> enviarFoto({
    required String token,
    required String dispositivoId,
    required String clientId,
    required String avaliacaoClientId,
    required Uint8List bytes,
    int? largura,
    int? altura,
  }) {
    return _tentar(() async {
      final r = await http
          .post(
            _url('/api/sincronizacao/fotos'),
            headers: {
              'Authorization': 'Bearer $token',
              'Content-Type': 'image/jpeg',
              'x-client-id': clientId,
              'x-avaliacao-client-id': avaliacaoClientId,
              'x-dispositivo-id': dispositivoId,
              if (largura != null) 'x-largura': '$largura',
              if (altura != null) 'x-altura': '$altura',
            },
            body: bytes,
          )
          .timeout(const Duration(seconds: 90)); // foto em rede ruim demora
      return _corpo(r);
    });
  }

  /// GET /api/sincronizacao/resumo → a taxa de sincronização do Quadro 7,
  /// vista do lado do servidor.
  static Future<Map<String, dynamic>> resumo({
    required String token,
    required String dispositivoId,
  }) {
    return _tentar(() async {
      final r = await http
          .get(
            _url('/api/sincronizacao/resumo?dispositivoId=$dispositivoId'),
            headers: _cabecalhos(token),
          )
          .timeout(_tempoLimite);
      return _corpo(r);
    });
  }
}
