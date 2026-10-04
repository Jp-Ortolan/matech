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
  bool _vencidaNoServidor = false;

  Usuario? get usuario => _usuario;
  // Sessão local: continua valendo com o token vencido, para registrar offline.
  bool get autenticado => _usuario != null;

  // Token ainda aceito pelo servidor.
  bool get podeSincronizar =>
      _usuario != null && !_usuario!.expirado && !_vencidaNoServidor;
  bool get carregando => _carregando;

  String get dispositivoId => _dispositivoId ?? 'desconhecido';

  Future<void> iniciar() async {
    _dispositivoId = await BancoLocal.obterAjuste(
      'dispositivo_id',
      novoDispositivoId,
    );
    _usuario = await SessaoDao.atual();
    _carregando = false;
    notifyListeners();
  }

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
    _vencidaNoServidor = false;
    notifyListeners();
  }

  // Novo token para o mesmo usuário; a fila do aparelho não é tocada.
  Future<void> renovar(String senha) async {
    final atual = _usuario;
    if (atual == null) return;
    await entrar(atual.usuario, senha);
  }

  void marcarVencida() {
    if (_vencidaNoServidor) return;
    _vencidaNoServidor = true;
    notifyListeners();
  }

  Future<void> sair() async {
    await SessaoDao.encerrar();
    _usuario = null;
    _vencidaNoServidor = false;
    notifyListeners();
  }
}

final Sessao sessao = Sessao();
