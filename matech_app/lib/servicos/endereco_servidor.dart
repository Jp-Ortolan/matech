// ---------------------------------------------------------------------------
// ENDEREÇO DO SERVIDOR · onde este aparelho procura a API
// ---------------------------------------------------------------------------
// POR QUE ISTO DEIXOU DE SER UMA CONSTANTE DE COMPILAÇÃO.
//
// O endereço vinha de --dart-define, fixado na hora de gerar o APK. Isso tem
// três consequências, e as três apareceram na prática:
//
//   1. UM APK POR ENDEREÇO. O sistema atende várias ervateiras, e cada uma tem
//      o seu servidor. Com o endereço no build, cada ervateira precisaria de
//      um APK próprio — e cada troca de servidor, de um APK novo.
//   2. O IP DA REDE LOCAL MUDA. Um APK apontando para 192.168.0.42 para de
//      funcionar quando o roteador entrega outro número ao notebook. O
//      sintoma é "o aplicativo parou de sincronizar", e a causa não aparece
//      em lugar nenhum.
//   3. TESTAR CUSTA UM BUILD. Alternar entre o servidor da máquina e o da
//      nuvem exigia recompilar, o que na prática significa não alternar.
//
// Agora o endereço é um AJUSTE do aparelho, gravado na tabela `ajustes` — a
// mesma que já guarda o dispositivoId. A ordem de precedência é:
//
//   1. o que a pessoa digitou na tela de login (fica gravado);
//   2. o --dart-define do build, se houver;
//   3. o padrão do Config (o apelido do emulador, ou localhost na web).
//
// O (2) continua valendo porque é como se entrega um APK já configurado para
// uma ervateira: ela recebe o aplicativo funcionando, e ainda assim consegue
// trocar o endereço se o servidor mudar de casa.

import '../config.dart';
import '../dados/banco_local.dart';

/// Confere o que foi digitado. Devolve null quando está bom, ou a frase do
/// erro — no formato que o validator do Flutter espera.
///
/// É função pura e está fora da classe de propósito: é onde mora o erro que o
/// usuário comete, e por isso é o que precisa de teste.
String? erroNoEndereco(String? valor) {
  final texto = (valor ?? '').trim();
  if (texto.isEmpty) return 'Informe o endereço do servidor';

  // O esquema é conferido pelo texto, e não pelo Uri.parse, porque
  // "192.168.0.42:3000" — o erro mais comum — é aceito pelo Uri como um
  // caminho qualquer, sem host. A mensagem precisa dizer o que fazer.
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

  // ARMADILHA COMUM: colar a URL de um endpoint em vez da do servidor. O
  // aplicativo acrescenta /api sozinho em cada chamada, então um endereço
  // terminado em /api viraria /api/api/auth/login — e o erro que aparece é
  // "404", que não diz nada sobre a causa.
  final caminho = uri.path.replaceAll(RegExp(r'/+$'), '').toLowerCase();
  if (caminho.endsWith('/api')) {
    return 'Tire o /api do final: o aplicativo acrescenta esse trecho sozinho';
  }

  return null;
}

/// Tira o espaço em volta e a barra do fim.
///
/// A barra final importa: a Api monta a URL concatenando texto
/// ('$endereco$caminho'), então "http://servidor/" viraria
/// "http://servidor//api/auth/login". Alguns servidores toleram a barra
/// dobrada e outros devolvem 404 — e depender de qual é uma aposta boba.
String normalizarEndereco(String valor) =>
    valor.trim().replaceAll(RegExp(r'/+$'), '');

abstract final class EnderecoServidor {
  static const String _chave = 'endereco_api';

  /// Chamado uma vez, na subida do aplicativo, ANTES de qualquer chamada de
  /// rede. Sem isto a primeira requisição sairia para o endereço padrão.
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

  /// Volta ao endereço que veio no build. Útil para desfazer um endereço
  /// digitado errado sem precisar lembrar qual era o certo.
  static Future<void> voltarAoPadrao() async {
    await BancoLocal.gravarAjuste(_chave, '');
    Config.definirEndereco(null);
  }
}
