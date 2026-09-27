import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Same navy/gold palette as public-web/assets/css/theme.css — kept as an explicit ColorScheme
/// below (not ColorScheme.fromSeed) because the seeded generator derives its own tonal surfaces/
/// containers from one seed color, which is exactly what made this look like "a generic Material
/// app" instead of Waradly: matching hex values in, but a different color-generation system
/// under the hood drifted the actual rendered surfaces away from them.
const navy900 = Color(0xFF0E1826);
const navy700 = Color(0xFF152337);
const navy400 = Color(0xFF3D5A80);
const navy100 = Color(0xFFDDE4ED);
const navy50 = Color(0xFFF1F4F8);
const gold500 = Color(0xFFC8964F);
const gold400 = Color(0xFFD9AB5F);
const bgColor = Color(0xFFF6F5F2);

final _baseTextTheme = GoogleFonts.outfitTextTheme();

final waradlyTheme = ThemeData(
  useMaterial3: true,
  scaffoldBackgroundColor: bgColor,
  splashFactory: InkRipple.splashFactory,
  visualDensity: VisualDensity.standard,
  fontFamily: GoogleFonts.outfit().fontFamily,
  textTheme: _baseTextTheme.apply(bodyColor: navy900, displayColor: navy900),
  colorScheme: const ColorScheme.light(
    primary: navy900,
    onPrimary: Colors.white,
    secondary: gold500,
    onSecondary: Colors.white,
    surface: Colors.white,
    onSurface: navy900,
    surfaceContainerHighest: navy50,
    outline: navy100,
    error: Color(0xFFB3261E),
  ),

  // Material 3 tints app bars/cards/nav bars with the primary color as you scroll/by default —
  // the single biggest "generic Android" tell. Turning it off everywhere keeps surfaces the
  // plain white/navy the web design actually uses.
  appBarTheme: const AppBarTheme(
    backgroundColor: navy900,
    foregroundColor: Colors.white,
    elevation: 0,
    surfaceTintColor: Colors.transparent,
    centerTitle: false,
    titleTextStyle: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w600, fontFamily: 'Outfit'),
  ),

  elevatedButtonTheme: ElevatedButtonThemeData(
    style: ElevatedButton.styleFrom(
      backgroundColor: navy900,
      foregroundColor: Colors.white,
      elevation: 0,
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      textStyle: const TextStyle(fontWeight: FontWeight.w500, fontFamily: 'Outfit'),
    ),
  ),
  outlinedButtonTheme: OutlinedButtonThemeData(
    style: OutlinedButton.styleFrom(
      foregroundColor: navy900,
      side: const BorderSide(color: navy100),
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      textStyle: const TextStyle(fontWeight: FontWeight.w500, fontFamily: 'Outfit'),
    ),
  ),
  textButtonTheme: TextButtonThemeData(style: TextButton.styleFrom(foregroundColor: navy900)),

  inputDecorationTheme: InputDecorationTheme(
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: navy100)),
    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: navy100)),
    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: gold400, width: 1.5)),
    filled: true,
    fillColor: Colors.white,
    labelStyle: const TextStyle(color: navy400),
  ),

  cardTheme: CardThemeData(
    elevation: 0,
    surfaceTintColor: Colors.transparent,
    color: Colors.white,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: navy50)),
    margin: const EdgeInsets.only(bottom: 12),
  ),

  navigationBarTheme: NavigationBarThemeData(
    backgroundColor: navy900,
    surfaceTintColor: Colors.transparent,
    elevation: 0,
    indicatorColor: gold500.withValues(alpha: 0.25),
    labelTextStyle: WidgetStateProperty.resolveWith(
      (states) => TextStyle(fontSize: 11, fontFamily: 'Outfit', color: states.contains(WidgetState.selected) ? Colors.white : navy100),
    ),
    iconTheme: WidgetStateProperty.resolveWith(
      (states) => IconThemeData(color: states.contains(WidgetState.selected) ? gold400 : navy100),
    ),
  ),

  switchTheme: SwitchThemeData(
    thumbColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? gold500 : navy100),
    trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? gold500.withValues(alpha: 0.4) : navy50),
  ),

  dialogTheme: DialogThemeData(surfaceTintColor: Colors.transparent, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
);
