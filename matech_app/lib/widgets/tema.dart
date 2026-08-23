// ---------------------------------------------------------------------------
// TEMA · a marca MATECH aplicada ao aplicativo
// ---------------------------------------------------------------------------
// Verde #1B4D33, a cor da marca, monocromática. O resto do esquema o Flutter
// deriva sozinho a partir dela com ColorScheme.fromSeed — o que evita a
// tentação de escolher doze cores à mão e acabar com uma tela que não parece
// do mesmo sistema que a web.
//
// Alvos de toque grandes (48dp) não são preciosismo: quem usa este aplicativo
// está em pé, no meio de um erval, possivelmente de luva.

import 'package:flutter/material.dart';

const Color verdeMatech = Color(0xFF1B4D33);

ThemeData temaMatech() {
  final esquema = ColorScheme.fromSeed(
    seedColor: verdeMatech,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: esquema,
    scaffoldBackgroundColor: const Color(0xFFF7F8F6),
    appBarTheme: const AppBarTheme(
      backgroundColor: verdeMatech,
      foregroundColor: Colors.white,
      elevation: 0,
      centerTitle: false,
    ),
    inputDecorationTheme: const InputDecorationTheme(
      border: OutlineInputBorder(),
      filled: true,
      fillColor: Colors.white,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(48),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
      ),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.black.withValues(alpha: 0.08)),
      ),
    ),
    listTileTheme: const ListTileThemeData(minVerticalPadding: 12),
  );
}
