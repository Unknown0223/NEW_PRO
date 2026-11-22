import 'package:flutter/material.dart';

import '../../routing/app_router.dart';

/// MaterialApp.builder ichidagi contextda Navigator yo‘q — dialoglar uchun root.
BuildContext? resolveRootNavigatorContext(BuildContext? context) {
  final fromKey = rootNavigatorKey.currentContext;
  if (fromKey != null && fromKey.mounted) return fromKey;
  if (context != null && context.mounted) {
    try {
      Navigator.of(context, rootNavigator: true);
      return context;
    } catch (_) {
      return null;
    }
  }
  return null;
}
