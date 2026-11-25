import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/theme/tezyuk_colors.dart';
import 'package:salesdoc_mobile/core/theme/tezyuk_theme.dart';

void main() {
  test('TezyukColors primary and background match design system', () {
    expect(TezyukColors.primary, const Color(0xFF0A6B3D));
    expect(TezyukColors.background, const Color(0xFFEDF3F7));
  });

  test('buildTezyukTheme uses primary seed', () {
    final theme = buildTezyukTheme();
    expect(theme.colorScheme.primary, TezyukColors.primary);
    expect(theme.scaffoldBackgroundColor, TezyukColors.background);
  });
}
