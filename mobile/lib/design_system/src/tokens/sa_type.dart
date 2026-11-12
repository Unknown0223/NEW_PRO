import 'package:flutter/material.dart';

/// Tipografiya tokenlari: Display sarlavhalar, Text UI matnlar uchun.
class SaType {
  const SaType._();

  static const String displayFamily = 'Sora';
  static const String textFamily = 'Inter';
  static const String monoFamily = 'JetBrains Mono';

  static const TextStyle display = TextStyle(
    fontFamily: displayFamily,
    fontSize: 30,
    height: 1.06,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.5,
  );

  static const TextStyle title = TextStyle(
    fontFamily: displayFamily,
    fontSize: 17,
    height: 1.2,
    fontWeight: FontWeight.w700,
  );

  static const TextStyle body = TextStyle(
    fontFamily: textFamily,
    fontSize: 13.5,
    height: 1.45,
    fontWeight: FontWeight.w400,
  );

  static const TextStyle caption = TextStyle(
    fontFamily: textFamily,
    fontSize: 10.5,
    height: 1.3,
    fontWeight: FontWeight.w600,
  );

  static const TextStyle mono = TextStyle(
    fontFamily: monoFamily,
    fontSize: 10,
    height: 1.3,
    fontWeight: FontWeight.w500,
  );
}
