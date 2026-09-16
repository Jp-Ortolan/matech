import 'package:flutter/material.dart';

abstract final class Cores {
  static const mate900 = Color(0xFF0E2418);
  static const mate800 = Color(0xFF16351F);
  static const mate700 = Color(0xFF1B4D33); // ação primária e item ativo
  static const mate500 = Color(0xFF2E7D50);
  static const mate300 = Color(0xFF73A987);
  static const mate100 = Color(0xFFE4EEE8);

  static const barra = Color(0xFFE7EFE9);
  static const barraBorda = Color(0xFFCBDCD1);
  static const barraTinta = Color(0xFF16351F);
  static const barraTenue = Color(0xFF4C6354);

  static const tinta = Color(0xFF1F2422);
  static const cinza600 = Color(0xFF5A6360);
  static const cinza400 = Color(0xFF8B938F);
  static const borda = Color(0xFFDFE3E1);
  static const cabecalho = Color(0xFFF2F4F2);
  static const fundo = Color(0xFFF5F6F5);

  static const alerta = Color(0xFFB4740E);
  static const alertaFundo = Color(0xFFFDF6E3);
  static const perigo = Color(0xFFA33028);
  static const perigoFundo = Color(0xFFF9E7E5);
}

const double raio = 3;
const BorderRadius raioPadrao = BorderRadius.all(Radius.circular(raio));

const Color verdeMatech = Cores.mate700;

ThemeData temaMatech() {
  final esquema = ColorScheme.fromSeed(
    seedColor: Cores.mate700,
    primary: Cores.mate700,
    onPrimary: Colors.white,
    secondary: Cores.mate500,
    surface: Colors.white,
    onSurface: Cores.tinta,
    error: Cores.perigo,
    onError: Colors.white,
  );

  OutlineInputBorder contorno(Color cor, [double largura = 1]) =>
      OutlineInputBorder(
        borderRadius: raioPadrao,
        borderSide: BorderSide(color: cor, width: largura),
      );

  return ThemeData(
    useMaterial3: true,
    colorScheme: esquema,
    scaffoldBackgroundColor: Cores.fundo,

    appBarTheme: const AppBarTheme(
      backgroundColor: Cores.barra,
      foregroundColor: Cores.barraTinta,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      shape: Border(bottom: BorderSide(color: Cores.barraBorda)),
      titleTextStyle: TextStyle(
        color: Cores.barraTinta,
        fontSize: 18,
        fontWeight: FontWeight.w700,
      ),
      iconTheme: IconThemeData(color: Cores.barraTinta),
    ),

    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: contorno(Cores.borda),
      enabledBorder: contorno(Cores.borda),
      focusedBorder: contorno(Cores.mate700, 1.6),
      errorBorder: contorno(Cores.perigo),
      focusedErrorBorder: contorno(Cores.perigo, 1.6),
      labelStyle: const TextStyle(color: Cores.cinza600),
      floatingLabelStyle: const TextStyle(color: Cores.mate700),
      hintStyle: const TextStyle(color: Cores.cinza400),
      prefixIconColor: Cores.cinza400,
      suffixIconColor: Cores.cinza400,
    ),

    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: Cores.mate700,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(48),
        shape: const RoundedRectangleBorder(borderRadius: raioPadrao),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
      ),
    ),

    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: Cores.tinta,
        minimumSize: const Size.fromHeight(48),
        side: const BorderSide(color: Cores.borda),
        shape: const RoundedRectangleBorder(borderRadius: raioPadrao),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
      ),
    ),

    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: Cores.mate700,
        textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
      ),
    ),

    cardTheme: const CardThemeData(
      elevation: 0,
      color: Colors.white,
      surfaceTintColor: Colors.transparent,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: raioPadrao,
        side: BorderSide(color: Cores.borda),
      ),
    ),

    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Cores.barra,
      surfaceTintColor: Colors.transparent,
      indicatorColor: Cores.mate700,
      elevation: 0,
      height: 64,
      labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      iconTheme: WidgetStateProperty.resolveWith(
        (estados) => IconThemeData(
          size: 22,
          color: estados.contains(WidgetState.selected)
              ? Colors.white
              : Cores.barraTenue,
        ),
      ),
      labelTextStyle: WidgetStateProperty.resolveWith(
        (estados) => TextStyle(
          fontSize: 11.5,
          fontWeight: estados.contains(WidgetState.selected)
              ? FontWeight.w700
              : FontWeight.w500,
          color: estados.contains(WidgetState.selected)
              ? Cores.barraTinta
              : Cores.barraTenue,
        ),
      ),
    ),

    floatingActionButtonTheme: const FloatingActionButtonThemeData(
      backgroundColor: Cores.mate700,
      foregroundColor: Colors.white,
      elevation: 2,
      shape: const RoundedRectangleBorder(borderRadius: raioPadrao),
    ),

    chipTheme: ChipThemeData(
      backgroundColor: Cores.cabecalho,
      side: const BorderSide(color: Cores.borda),
      shape: const RoundedRectangleBorder(borderRadius: raioPadrao),
      labelStyle: const TextStyle(fontSize: 11.5, color: Cores.cinza600),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
    ),

    dividerTheme: const DividerThemeData(
      color: Cores.borda,
      thickness: 1,
      space: 1,
    ),

    listTileTheme: const ListTileThemeData(
      minVerticalPadding: 12,
      iconColor: Cores.cinza400,
      textColor: Cores.tinta,
    ),

    snackBarTheme: const SnackBarThemeData(
      backgroundColor: Cores.tinta,
      contentTextStyle: TextStyle(color: Colors.white, fontSize: 13.5),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: raioPadrao),
    ),

    dialogTheme: const DialogThemeData(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: raioPadrao),
    ),

    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: Cores.mate700,
    ),
  );
}

class MarcaMatech extends StatelessWidget {
  final double tamanho;
  const MarcaMatech({super.key, this.tamanho = 72});

  @override
  Widget build(BuildContext context) => Image.asset(
    'assets/marca/matech-marca.png',
    width: tamanho,
    height: tamanho,
  );
}
