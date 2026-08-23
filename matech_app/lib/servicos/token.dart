// ---------------------------------------------------------------------------
// TOKEN · leitura do JWT
// ---------------------------------------------------------------------------
// Lê o campo "exp" de dentro do próprio token.
//
// O corpo de um JWT vai em base64, ABERTO — qualquer um consegue ler, e é por
// isso que só entram dados não sensíveis nele. O que protege o token é a
// ASSINATURA, que só o servidor sabe conferir. Ler a expiração aqui não é
// falha de segurança: serve para o aplicativo avisar "sessão vencida" na hora
// certa, em vez de descobrir isso na próxima sincronização, longe do sinal.
//
// Fica separado da Sessao porque é lógica pura — sem Flutter, sem banco, sem
// rede — e por isso testável com `flutter test`, sem emulador. Uma função que
// decodifica base64 e faz aritmética de data é exatamente o tipo de código que
// erra em silêncio e passa despercebido até o dia em que a sessão vence.

import 'dart:convert';

class Token {
  /// Quando este token expira, ou null se não der para saber.
  ///
  /// Devolve null — em vez de lançar — para qualquer coisa malformada. Um
  /// token que o aplicativo não sabe ler não deve impedir o login: a
  /// autoridade sobre a validade é do servidor, que vai recusar com 401 na
  /// primeira requisição. Aqui é só uma cortesia para avisar antes.
  static DateTime? expiraEm(String token) {
    try {
      final partes = token.split('.');
      if (partes.length != 3) return null;

      // base64Url sem preenchimento: o padrão do JWT omite os '='.
      final corpo = utf8.decode(
        base64Url.decode(base64Url.normalize(partes[1])),
      );
      final dados = jsonDecode(corpo);
      if (dados is! Map) return null;

      final exp = dados['exp'];
      if (exp is! int) return null;

      // "exp" é em SEGUNDOS desde a época, e o Dart trabalha em
      // milissegundos. Esquecer o fator mil faria toda sessão parecer vencida
      // desde 1970 — e o aplicativo pediria login a cada abertura.
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
