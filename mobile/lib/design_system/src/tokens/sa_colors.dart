import 'package:flutter/material.dart';

/// Rollarga bog'langan aksentlar — prototipdagi 4 rol bilan bir xil.
enum SaRole { agent, expeditor, supervisor, cashier }

/// Sales Arena rang tokenlari.
/// Hamma qiymat katalog (catalog.json) orqali ustidan yozilishi mumkin,
/// shuning uchun hech qachon to'g'ridan-to'g'ri hex ishlatmang.
class SaColors {
  const SaColors._();

  // Brend
  static const Color navy = Color(0xFF14223F);
  static const Color salesBlue = Color(0xFF1F66D1);
  static const Color brightSky = Color(0xFF6FA8FF);

  // Rol aksentlari — prototip design.ts accents
  static const Color agent = Color(0xFF5548F0); // Agent Iris
  static const Color expeditor = Color(0xFF4ADE80); // Ekspeditor Lime
  static const Color supervisor = Color(0xFF0369A1); // Supervayzer Sky
  static const Color cashier = Color(0xFFC026D3); // Kassir Fuchsia

  static Color roleAccent(SaRole role) {
    switch (role) {
      case SaRole.agent:
        return agent;
      case SaRole.expeditor:
        return expeditor;
      case SaRole.supervisor:
        return supervisor;
      case SaRole.cashier:
        return cashier;
    }
  }

  // Yorug' sirtlar
  static const Color surfaceLight = Color(0xFFF7F9FA);
  static const Color cardLight = Colors.white;
  static const Color inkLight = Color(0xFF14223F);

  // Qorong'u sirtlar
  static const Color surfaceDark = Color(0xFF0B1226);
  static const Color cardDark = Color(0xFF131B29);
  static const Color inkDark = Color(0xFFE9EEF7);
}
