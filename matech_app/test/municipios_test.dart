import 'package:flutter_test/flutter_test.dart';
import 'package:matech_app/servicos/municipios.dart';

void main() {
  const lista = ['Guarapuava', 'Guaraniaçu', 'Pinhão', 'São João do Triunfo'];

  test('acha pelo começo, sem acento e sem maiúscula', () {
    expect(filtrarMunicipios(lista, 'guarap'), ['Guarapuava']);
    expect(filtrarMunicipios(lista, 'pinhao'), ['Pinhão']);
  });

  test('quem começa com o termo vem antes de quem só contém', () {
    expect(filtrarMunicipios(lista, 'joao'), ['São João do Triunfo']);
    expect(filtrarMunicipios(lista, 'gua').first, 'Guarapuava');
  });

  test('vazio não sugere nada', () {
    expect(filtrarMunicipios(lista, '  '), isEmpty);
  });

  test('a lista tem as 27 UFs', () {
    expect(ufs.length, 27);
  });
}
