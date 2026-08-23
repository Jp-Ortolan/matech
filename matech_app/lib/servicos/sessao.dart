// ---------------------------------------------------------------------------
// SERVIÇO · sessão  (quem está usando o aplicativo)
// ---------------------------------------------------------------------------
// GERÊNCIA DE ESTADO, E POR QUE NÃO TEM PACOTE NENHUM AQUI:
//
// Esta classe é um ChangeNotifier, que já vem no Flutter. As telas escutam com
// ListenableBuilder, que também já vem. Em seis telas, é o suficiente — e um
// provider/riverpod/bloc custaria mais explicação na banca do que economiza
// de código. A fronteira é honesta: se o aplicativo crescesse para trinta
// telas com estado cruzado, a conta viraria.
//
// O TOKEN FICA NO SQLITE, não em shared_preferences: um lugar de
// armazenamento em vez de dois, e uma dependência a menos.

import 'package:flutter/foundation.dart';

import '../dados/banco_local.dart';
import '../dados/sessao_dao.dart';
import '../modelos/usuario.dart';
import 'api.dart';
import 'identificadores.dart';
import 'token.dart';

class Sessao extends ChangeNotifier {
  Usuario? _usuario;
  String? _dispositivoId;
  bool _carregando = true;

  Usuario? get usuario => _usuario;
  bool get autenticado => _usuario != null && !_usuario!.expirado;
  bool get carregando => _carregando;

  /// Identificador deste aparelho. Nasce uma vez, fica no banco local e não
  /// muda mais — é por ele que o servidor separa a taxa de sincronização do
  /// Quadro 7 por celular.
  String get dispositivoId => _dispositivoId ?? 'desconhecido';

  /// Chamado uma vez, na subida do aplicativo. Recupera a sessão gravada:
  /// quem abriu o aplicativo no meio do erval, sem sinal, continua logado.
  Future<void> iniciar() async {
    _dispositivoId = await BancoLocal.obterAjuste(
      'dispositivo_id',
      novoDispositivoId,
    );
    _usuario = await SessaoDao.atual();
    _carregando = false;
    notifyListeners();
  }

  /// O login é a ÚNICA operação do aplicativo que exige conexão, e não há como
  /// ser diferente: a senha é conferida contra o hash que está no servidor.
  /// Por isso a orientação de uso é entrar no aplicativo antes de sair a
  /// campo. Uma vez logado, o token vale 8 horas e nada mais precisa de rede.
  Future<void> entrar(String usuario, String senha) async {
    final resposta = await Api.login(usuario.trim(), senha);

    final dados = resposta['usuario'] as Map<String, dynamic>;
    final token = resposta['token'] as String;

    final logado = Usuario(
      id: dados['id'] as String,
      nome: dados['nome'] as String,
      usuario: dados['usuario'] as String,
      perfil: dados['perfil'] as String,
      token: token,
      expiraEm: Token.expiraEm(token),
    );

    await SessaoDao.guardar(logado);
    _usuario = logado;
    notifyListeners();
  }

  /// Sair apaga a sessão e NADA MAIS. Os produtores, as avaliações, as fotos
  /// e a fila continuam no aparelho — sair da conta não pode significar perder
  /// um dia de coleta que ainda não subiu.
  Future<void> sair() async {
    await SessaoDao.encerrar();
    _usuario = null;
    notifyListeners();
  }
}

/// Uma instância para o aplicativo inteiro, criada na subida pelo main().
/// Global porque é literalmente estado global: existe um usuário logado por
/// aparelho, e todas as telas perguntam a mesma coisa a ele.
final Sessao sessao = Sessao();
