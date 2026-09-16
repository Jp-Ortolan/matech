import '../config.dart';
import '../dados/banco_local.dart';

String? erroNoEndereco(String? valor) {
  final texto = (valor ?? '').trim();
  if (texto.isEmpty) return 'Informe o endereço do servidor';

  final minusculo = texto.toLowerCase();
  if (!minusculo.startsWith('http://') && !minusculo.startsWith('https://')) {
    return 'Falta http:// ou https:// no começo';
  }

  final uri = Uri.tryParse(texto);
  if (uri == null || uri.host.isEmpty) {
    return 'Não consegui entender esse endereço. Exemplo: http://192.168.0.42:3000';
  }

  if (uri.hasQuery || uri.hasFragment) {
    return 'O endereço é só o servidor — tire o que vem depois de ? ou #';
  }

  final caminho = uri.path.replaceAll(RegExp(r'/+$'), '').toLowerCase();
  if (caminho.endsWith('/api')) {
    return 'Tire o /api do final: o aplicativo acrescenta esse trecho sozinho';
  }

  return null;
}

String normalizarEndereco(String valor) =>
    valor.trim().replaceAll(RegExp(r'/+$'), '');

abstract final class EnderecoServidor {
  static const String _chave = 'endereco_api';

  static Future<void> carregar() async {
    final salvo = await BancoLocal.lerAjuste(_chave);
    if (salvo != null && salvo.trim().isNotEmpty) {
      Config.definirEndereco(normalizarEndereco(salvo));
    }
  }

  static Future<void> salvar(String valor) async {
    final endereco = normalizarEndereco(valor);
    await BancoLocal.gravarAjuste(_chave, endereco);
    Config.definirEndereco(endereco);
  }

  static Future<void> voltarAoPadrao() async {
    await BancoLocal.gravarAjuste(_chave, '');
    Config.definirEndereco(null);
  }
}
