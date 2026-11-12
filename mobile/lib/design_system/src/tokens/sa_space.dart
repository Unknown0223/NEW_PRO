import 'package:flutter/widgets.dart';

/// Masofa va radius tokenlari — 4px lik baza katak.
class SaSpace {
  const SaSpace._();

  static const double xxs = 2;
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
}

class SaRadius {
  const SaRadius._();

  /// Kichik chip, badge
  static const double chip = 8;

  /// Tugma, input
  static const double control = 12;

  /// Karta, ro'yxat elementi
  static const double card = 16;

  /// Pastki varaq, dialog
  static const double sheet = 20;

  /// Telefon ramkasi, katta panel
  static const double panel = 28;
}

/// Ro‘yxat padding — avval pastki nav uchun, endi shablonda nav yo‘q.
class SaShellInsets {
  const SaShellInsets._();

  static EdgeInsets listWithShellNav({
    double horizontal = SaSpace.md,
    double top = SaSpace.md,
    double bottom = SaSpace.xxl,
  }) {
    return EdgeInsets.fromLTRB(horizontal, top, horizontal, bottom);
  }
}
