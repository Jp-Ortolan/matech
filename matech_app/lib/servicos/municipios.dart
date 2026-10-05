import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;

// Municípios do IBGE por UF, embutidos no app (assets/municipios.json).
// Funciona sem internet, que é o caso do erval.

const ufs = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
  'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

Map<String, List<String>>? _tabela;

Future<List<String>> municipiosDa(String? uf) async {
  if (uf == null || uf.isEmpty) return const [];
  if (_tabela == null) {
    final texto = await rootBundle.loadString('assets/municipios.json');
    final bruto = jsonDecode(texto) as Map<String, dynamic>;
    _tabela = bruto.map(
      (k, v) => MapEntry(k, (v as List<dynamic>).cast<String>()),
    );
  }
  return _tabela![uf] ?? const [];
}

// Busca sem acento e sem diferença de maiúscula: "guarap" acha Guarapuava.
List<String> filtrarMunicipios(List<String> lista, String digitado, {int limite = 8}) {
  final termo = semAcento(digitado.trim());
  if (termo.isEmpty) return const [];
  final comecam = <String>[];
  final contem = <String>[];
  for (final m in lista) {
    final nome = semAcento(m);
    if (nome.startsWith(termo)) {
      comecam.add(m);
    } else if (nome.contains(termo)) {
      contem.add(m);
    }
  }
  return [...comecam, ...contem].take(limite).toList();
}

String semAcento(String texto) {
  const de = 'áàâãäéèêëíìîïóòôõöúùûüçñ';
  const para = 'aaaaaeeeeiiiiooooouuuucn';
  final minusculo = texto.toLowerCase();
  final saida = StringBuffer();
  for (final c in minusculo.split('')) {
    final i = de.indexOf(c);
    saida.write(i >= 0 ? para[i] : c);
  }
  return saida.toString();
}
