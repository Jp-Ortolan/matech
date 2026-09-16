import 'dart:convert';

class Token {
  static DateTime? expiraEm(String token) {
    try {
      final partes = token.split('.');
      if (partes.length != 3) return null;

      final corpo = utf8.decode(
        base64Url.decode(base64Url.normalize(partes[1])),
      );
      final dados = jsonDecode(corpo);
      if (dados is! Map) return null;

      final exp = dados['exp'];
      if (exp is! int) return null;

      return DateTime.fromMillisecondsSinceEpoch(exp * 1000);
    } catch (_) {
      return null;
    }
  }

  static bool venceu(String token) {
    final expiracao = expiraEm(token);
    return expiracao != null && DateTime.now().isAfter(expiracao);
  }
}
