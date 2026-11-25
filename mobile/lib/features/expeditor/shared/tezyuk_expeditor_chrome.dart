import 'package:flutter/material.dart';

import '../../../core/config/app_product.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/tezyuk_colors.dart';

/// Stitch card border (#E2E8F0) — katalogda `outlineVariant` sifatida.
const Color tezyukExpeditorCardBorder = TezyukColors.surfaceContainerHigh;

Color expeditorPageBackground() =>
    isTezyukProduct ? TezyukColors.background : AppColors.background;

Color expeditorChromeAccent() =>
    isTezyukProduct ? TezyukColors.primary : AppColors.expeditorAccent;

Color expeditorChromeSurface() =>
    isTezyukProduct ? TezyukColors.surfaceBright : AppColors.surface;

BoxDecoration expeditorListCardDecoration({double radius = 14}) {
  if (isTezyukProduct) {
    return BoxDecoration(
      color: TezyukColors.surfaceBright,
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(color: tezyukExpeditorCardBorder),
    );
  }
  return BoxDecoration(
    color: AppColors.surface,
    borderRadius: BorderRadius.circular(radius),
  );
}

String expeditorLabel(String ru, String uz) => isTezyukProduct ? uz : ru;