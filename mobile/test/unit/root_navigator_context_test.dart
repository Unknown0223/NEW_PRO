import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/navigation/root_navigator_context.dart';
import 'package:salesdoc_mobile/routing/app_router.dart';

void main() {
  testWidgets('resolveRootNavigatorContext prefers rootNavigatorKey', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        navigatorKey: rootNavigatorKey,
        home: const Scaffold(body: Text('home')),
      ),
    );
    await tester.pump();

    final resolved = resolveRootNavigatorContext(null);
    expect(resolved, isNotNull);
    expect(Navigator.of(resolved!, rootNavigator: true), isA<NavigatorState>());
  });
}
