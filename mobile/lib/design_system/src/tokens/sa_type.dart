import 'package:flutter/material.dart';

/// Tipografiya tokenlari: Display sarlavhalar, Text UI matnlar uchun.
/// Font fayllari yo‘q bo‘lsa Material default (platform) ishlatiladi.
class SaType {
  const SaType._();

  static const String? displayFamily = null;
  static const String? textFamily = null;
  static const String? monoFamily = null;

  static const TextStyle display = TextStyle(
    fontSize: 30,
    height: 1.06,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.5,
  );

  static const TextStyle title = TextStyle(
    fontSize: 17,
    height: 1.2,
    fontWeight: FontWeight.w700,
  );

  static const TextStyle body = TextStyle(
    fontSize: 13.5,
    height: 1.45,
    fontWeight: FontWeight.w400,
  );

  static const TextStyle caption = TextStyle(
    fontSize: 10.5,
    height: 1.3,
    fontWeight: FontWeight.w600,
  );

  static const TextStyle mono = TextStyle(
    fontSize: 10,
    height: 1.3,
    fontWeight: FontWeight.w500,
    fontFeatures: [FontFeature.tabularFigures()],
  );
}
