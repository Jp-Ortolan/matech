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

  static Future<List<dynamic>> listarProdutores(String token) {
    return _tentar(() async {
      final r = await http
          .get(_url('/api/produtores'), headers: _cabecalhos(token))
          .timeout(_tempoLimite);
      return (_corpo(r)['produtores'] as List<dynamic>?) ?? const [];
    });
  }

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
