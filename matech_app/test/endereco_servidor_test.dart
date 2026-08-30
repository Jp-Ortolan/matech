// ---------------------------------------------------------------------------
// TESTES · endereço do servidor
// ---------------------------------------------------------------------------
// Cada teste aqui guarda um erro de digitação que já custou uma tarde de
// alguém. Nenhum deles é hipotético: são as quatro formas de escrever um
// endereço que "parece certo" e não conecta, e o sintoma de todas é o mesmo
// "sem conexão com o servidor" — que aponta para a rede quando o problema
// está no texto.

import 'package:flutter_test/flutter_test.dart';
import 'package:matech_app/servicos/endereco_servidor.dart';

void main() {
  group('erroNoEndereco aceita', () {
    test('o servidor da nuvem, com https', () {
      expect(erroNoEndereco('https://matech-api.onrender.com'), isNull);
    });

    test('o notebook na rede local, com porta', () {
      expect(erroNoEndereco('http://192.168.0.42:3000'), isNull);
    });

    test('o apelido do emulador', () {
      expect(erroNoEndereco('http://10.0.2.2:3000'), isNull);
    });

    test('espaço em volta, que é o que a colagem traz junto', () {
      expect(erroNoEndereco('  http://192.168.0.42:3000  '), isNull);
    });
  });

  group('erroNoEndereco recusa', () {
    test('vazio', () {
      expect(erroNoEndereco(''), isNotNull);
      expect(erroNoEndereco(null), isNotNull);
      expect(erroNoEndereco('   '), isNotNull);
    });

    test('sem http:// — o erro mais comum de todos', () {
      // Uri.parse engole isto sem reclamar: vira um caminho sem host. Por isso
      // a conferência do esquema é feita no texto, antes de parsear.
      final erro = erroNoEndereco('192.168.0.42:3000');
      expect(erro, isNotNull);
      expect(erro, contains('http://'));
    });

    test('esquema que não é http nem https', () {
      expect(erroNoEndereco('ftp://192.168.0.42'), isNotNull);
    });

    test('endereço terminado em /api', () {
      // A Api monta '/api/auth/login' por conta própria. Com /api no fim, a
      // URL vira /api/api/auth/login e o servidor responde 404 — que parece
      // "usuário não encontrado" e não é.
      final erro = erroNoEndereco('https://matech-api.onrender.com/api');
      expect(erro, isNotNull);
      expect(erro, contains('/api'));
    });

    test('URL de endpoint colada inteira', () {
      expect(
        erroNoEndereco('https://matech-api.onrender.com/api/auth/login?x=1'),
        isNotNull,
      );
    });

    test('só o esquema, sem servidor', () {
      expect(erroNoEndereco('http://'), isNotNull);
    });
  });

  group('normalizarEndereco', () {
    test('tira a barra do fim', () {
      // A Api concatena texto: com a barra, a URL sairia com // no meio.
      expect(
        normalizarEndereco('http://192.168.0.42:3000/'),
        'http://192.168.0.42:3000',
      );
    });

    test('tira mais de uma barra', () {
      expect(normalizarEndereco('http://servidor///'), 'http://servidor');
    });

    test('tira o espaço em volta', () {
      expect(normalizarEndereco('  https://api.exemplo.com  '), 'https://api.exemplo.com');
    });

    test('não mexe no que já está certo', () {
      expect(
        normalizarEndereco('https://api.exemplo.com'),
        'https://api.exemplo.com',
      );
    });

    test('preserva a porta e o caminho de prefixo', () {
      // Uma ervateira pode servir a API atrás de um proxy, em /matech.
      expect(
        normalizarEndereco('https://exemplo.com:8443/matech/'),
        'https://exemplo.com:8443/matech',
      );
    });
  });
}
