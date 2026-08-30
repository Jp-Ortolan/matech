// ---------------------------------------------------------------------------
// TEMA · a mesma paleta do sistema web, aplicada ao aplicativo
// ---------------------------------------------------------------------------
// Os dois programas são o mesmo sistema, e precisam parecer. Quem usa o
// aplicativo no erval de manhã abre a web no escritório à tarde — se as duas
// telas tiverem cores e formatos diferentes, elas viram dois produtos.
//
// O QUE MUDOU EM RELAÇÃO AO TEMA ANTERIOR, e por quê:
//
// 1. A PALETA DEIXOU DE SER DERIVADA. Antes era ColorScheme.fromSeed a partir
//    do verde da marca, e o Flutter inventava o resto. O algoritmo do Material
//    é bom, mas ele não conhece o index.css da web — os verdes saíam parecidos
//    e nenhum era o mesmo. Agora os valores são os literais do web, copiados
//    da tabela abaixo, e as duas telas usam a MESMA tinta.
//
// 2. O RAIO CAIU DE 12 PARA 3. Era o sinal visual mais forte de que eram dois
//    produtos: cantos macios de aplicativo de consumo contra cantos quase
//    retos de sistema de operação. Três pixels não é minimalismo — é o que a
//    web usa, e o que faz uma tabela de pesagem parecer um instrumento.
//
// 3. A BARRA SUPERIOR CLAREOU, pelo mesmo motivo que o menu da web clareou: a
//    marca é verde-escura sobre transparente, e sobre fundo escuro o M some.
//    Ver o comentário em web/src/index.css — os números de contraste estão lá.
//
// O QUE NÃO VEIO DA WEB: a tipografia. A web usa IBM Plex Sans, escolhida
// pelos algarismos de largura fixa. Trazê-la para cá custaria empacotar quatro
// arquivos de fonte ou uma dependência inteira, para uma diferença que ninguém
// nota num celular — e a fonte do sistema é o que o usuário já lê o dia todo
// no aparelho dele. Ficou a do sistema, de propósito.
//
// Alvos de toque grandes (48dp) não são preciosismo: quem usa este aplicativo
// está em pé, no meio de um erval, possivelmente de luva.

import 'package:flutter/material.dart';

/// As cores do sistema, com os mesmos nomes e valores de web/src/index.css.
///
/// Estão numa classe, e não soltas, para que uma tela nunca precise escrever
/// `Colors.red.shade700` de novo: o vermelho do Material não é o vermelho
/// deste sistema, e a diferença aparece lado a lado.
abstract final class Cores {
  // Verdes da identidade
  static const mate900 = Color(0xFF0E2418);
  static const mate800 = Color(0xFF16351F);
  static const mate700 = Color(0xFF1B4D33); // ação primária e item ativo
  static const mate500 = Color(0xFF2E7D50);
  static const mate300 = Color(0xFF73A987);
  static const mate100 = Color(0xFFE4EEE8);

  // A moldura: barra superior e navegação
  static const barra = Color(0xFFE7EFE9);
  static const barraBorda = Color(0xFFCBDCD1);
  static const barraTinta = Color(0xFF16351F);
  static const barraTenue = Color(0xFF4C6354);

  // Neutros
  static const tinta = Color(0xFF1F2422);
  static const cinza600 = Color(0xFF5A6360);
  static const cinza400 = Color(0xFF8B938F);
  static const borda = Color(0xFFDFE3E1);
  static const cabecalho = Color(0xFFF2F4F2);
  static const fundo = Color(0xFFF5F6F5);

  // Situações. Uma cor por estado, como na web — e nenhuma delas é do
  // Material: o âmbar aqui é o mesmo âmbar de lá.
  static const alerta = Color(0xFFB4740E);
  static const alertaFundo = Color(0xFFFDF6E3);
  static const perigo = Color(0xFFA33028);
  static const perigoFundo = Color(0xFFF9E7E5);
}

/// Três pixels. O mesmo `rounded-[3px]` de toda a web.
const double raio = 3;
const BorderRadius raioPadrao = BorderRadius.all(Radius.circular(raio));

/// Mantido pelo nome antigo porque telas ainda o importam.
const Color verdeMatech = Cores.mate700;

ThemeData temaMatech() {
  final esquema = ColorScheme.fromSeed(
    seedColor: Cores.mate700,
    // fromSeed continua sendo usado para os cantos que o Material preenche
    // sozinho — mas os papéis que aparecem na tela são fixados aqui, para não
    // ficarem à mercê do algoritmo.
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

    // A BARRA SUPERIOR clara, com a borda que devolve a separação que o fundo
    // escuro dava de graça — a mesma solução do menu da web.
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
        // Sem canto redondo. Botão de pílula é linguagem de aplicativo de
        // consumo; este é um instrumento de trabalho, igual ao da web.
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

    // A NAVEGAÇÃO DE BAIXO segue a moldura, e o item ativo é a única coisa de
    // alto contraste — mesma decisão do menu da web, pelo mesmo motivo: sobre
    // fundo claro, realce discreto se confunde com o toque.
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

/// A marca, do arquivo — a mesma imagem do sistema web.
///
/// Antes era um `Icons.eco_outlined` branco num quadrado verde: um ícone
/// genérico do Material, que não é a marca de nada. Agora é o símbolo de
/// verdade, e é o mesmo arquivo que a web serve.
class MarcaMatech extends StatelessWidget {
  final double tamanho;
  const MarcaMatech({super.key, this.tamanho = 72});

  @override
  Widget build(BuildContext context) => Image.asset(
    'assets/marca/matech-marca.png',
    width: tamanho,
    height: tamanho,
    // Sem placa atrás: as telas em que ela aparece têm fundo claro, que é
    // exatamente para isso que o fundo do sistema clareou.
  );
}
