import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:salesdoc_mobile/features/agent/orders/create_order_exit_guard.dart';
import 'package:salesdoc_mobile/features/agent/shell/agent_menu_config.dart';

void main() {
  testWidgets('GoRouter: visits/home/kpi/orders switch despite stale draft guard',
      (tester) async {
    final router = GoRouter(
      initialLocation: '/visits',
      routes: [
        for (final p in agentShellTabPaths)
          GoRoute(
            path: p,
            builder: (_, __) => Scaffold(body: Text('page:$p')),
          ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();

    final ctx = tester.element(find.byType(MaterialApp));
    final container = ProviderScope.containerOf(ctx);
    container.read(createOrderExitGuardProvider.notifier).state =
        CreateOrderExitGuard(() async => false);

    for (final from in agentShellTabPaths) {
      for (final to in agentShellTabPaths) {
        router.go(from);
        await tester.pumpAndSettle();
        container.read(createOrderExitGuardProvider.notifier).state =
            CreateOrderExitGuard(() async => false);
        final ok = await leaveCreateOrderThenGo(
          container: container,
          go: router.go,
          path: to,
          currentLocation: from,
        );
        expect(ok, isTrue, reason: '$from → $to');
        await tester.pumpAndSettle();
        expect(
          router.routeInformationProvider.value.uri.path,
          to,
          reason: '$from → $to',
        );
        expect(find.text('page:$to'), findsOneWidget, reason: '$from → $to');
      }
    }
  });
}
