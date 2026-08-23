// ---------------------------------------------------------------------------
// TESTE DE WIDGET · etiqueta de sincronização
// ---------------------------------------------------------------------------
// Este arquivo substitui o que o `flutter create` gerou, que testava um
// aplicativo de contador que nunca existiu neste projeto — e que por isso
// falhava ao compilar, procurando uma classe MyApp inexistente.
//
// POR QUE JUSTAMENTE ESTA ETIQUETA, E NÃO UMA TELA INTEIRA:
//
// As telas do MATECH abrem o SQLite na primeira linha, por decisão de
// arquitetura — nenhuma delas fala com a rede, todas leem o banco local.
// Testá-las exigiria um banco de mentira e transformaria um teste de widget
// num teste de integração disfarçado.
//
// Esta etiqueta, por outro lado, não depende de nada: recebe uma situação e
// desenha. E é o widget mais importante do aplicativo para quem o usa — é
// nele que o avaliador olha, no fim do dia, para decidir se pode ir embora.
// Se ele mostrasse "Sincronizada" para algo que ainda está na fila, o dado
// seria dado como salvo e ninguém perceberia.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:matech_app/modelos/operacao_pendente.dart';
import 'package:matech_app/widgets/comuns.dart';

/// Monta a etiqueta sozinha, com o mínimo de árvore em volta.
Future<void> mostrar(WidgetTester tester, String? situacao) async {
  await tester.pumpWidget(
    MaterialApp(home: Scaffold(body: EtiquetaSincronizacao(situacao))),
  );
}

void main() {
  testWidgets('PENDENTE aparece como "Pendente"', (tester) async {
    await mostrar(tester, OperacaoPendente.pendente);
    expect(find.text('Pendente'), findsOneWidget);
  });

  testWidgets('ENVIADA aparece como "Sincronizada"', (tester) async {
    await mostrar(tester, OperacaoPendente.enviada);
    expect(find.text('Sincronizada'), findsOneWidget);
  });

  testWidgets('PENDENTE_DEPENDENCIA aparece como "Aguardando"', (tester) async {
    await mostrar(tester, OperacaoPendente.dependencia);
    expect(find.text('Aguardando'), findsOneWidget);
  });

  testWidgets('ERRO aparece como "Recusada"', (tester) async {
    await mostrar(tester, OperacaoPendente.erro);
    expect(find.text('Recusada'), findsOneWidget);
  });

  testWidgets('sem linha na fila, o registro é tratado como pendente', (
    tester,
  ) async {
    // Este é o caso que mais importa acertar. Um registro sem linha na fila
    // existe no aparelho e ninguém confirmou — pendente é exatamente o que ele
    // é. Mostrá-lo como sincronizado faria o avaliador ir embora achando que o
    // dia inteiro já está no escritório.
    await mostrar(tester, null);
    expect(find.text('Pendente'), findsOneWidget);
    expect(find.text('Sincronizada'), findsNothing);
  });

  testWidgets('uma situação desconhecida não vira "Sincronizada"', (
    tester,
  ) async {
    // Se um estado novo aparecer no futuro e alguém esquecer de tratá-lo, o
    // padrão precisa errar para o lado seguro: pendente, nunca sincronizada.
    await mostrar(tester, 'ESTADO_QUE_AINDA_NAO_EXISTE');
    expect(find.text('Sincronizada'), findsNothing);
    expect(find.text('Pendente'), findsOneWidget);
  });

  testWidgets('cada estado tem um ícone próprio', (tester) async {
    // Cor sozinha não basta: parte das pessoas não distingue verde de
    // vermelho, e no sol do meio-dia a tela lava. O ícone é o que sobra.
    final icones = <IconData>{};

    for (final situacao in [
      OperacaoPendente.pendente,
      OperacaoPendente.enviada,
      OperacaoPendente.dependencia,
      OperacaoPendente.erro,
    ]) {
      await mostrar(tester, situacao);
      icones.add(tester.widget<Icon>(find.byType(Icon)).icon!);
    }

    expect(icones.length, 4, reason: 'dois estados estão usando o mesmo ícone');
  });
}
