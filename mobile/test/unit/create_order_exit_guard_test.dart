import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/features/agent/orders/create_order_exit_guard.dart';
import 'package:salesdoc_mobile/features/agent/shell/agent_menu_config.dart';

void main() {
  late ProviderContainer container;

  setUp(() {
    container = ProviderContainer();
  });

  tearDown(() {
    container.dispose();
  });

  group('isAgentCreateOrderRoute', () {
    test('matches create-order paths only', () {
      expect(isAgentCreateOrderRoute('/orders/create'), isTrue);
      expect(isAgentCreateOrderRoute('/orders/create?client_id=1'), isTrue);
      expect(isAgentCreateOrderRoute('/visits'), isFalse);
      expect(isAgentCreateOrderRoute('/home'), isFalse);
      expect(isAgentCreateOrderRoute('/orders'), isFalse);
      expect(isAgentCreateOrderRoute('/kpi'), isFalse);
    });
  });

  group('leaveCreateOrderThenGo', () {
    test('navigates when no exit guard is registered', () async {
      var went = '';
      final ok = await leaveCreateOrderThenGo(
        container: container,
        go: (p) => went = p,
        path: '/home',
        currentLocation: '/orders/create',
      );
      expect(ok, isTrue);
      expect(went, '/home');
    });

    test('navigates after leave is confirmed (save or discard)', () async {
      var went = '';
      container.read(createOrderExitGuardProvider.notifier).state =
          CreateOrderExitGuard(() async => true);
      final ok = await leaveCreateOrderThenGo(
        container: container,
        go: (p) => went = p,
        path: '/kpi',
        currentLocation: '/orders/create',
      );
      expect(ok, isTrue);
      expect(went, '/kpi');
    });

    test('does not navigate when leave is cancelled on create-order', () async {
      var went = '';
      container.read(createOrderExitGuardProvider.notifier).state =
          CreateOrderExitGuard(() async => false);
      final ok = await leaveCreateOrderThenGo(
        container: container,
        go: (p) => went = p,
        path: '/clients',
        currentLocation: '/orders/create',
      );
      expect(ok, isFalse);
      expect(went, isEmpty);
    });

    test('full matrix: every page can reach every other page', () async {
      final pages = agentNavigationPages;
      for (final from in pages) {
        for (final to in pages) {
          var went = '';
          var guardCalls = 0;
          container.read(createOrderExitGuardProvider.notifier).state =
              CreateOrderExitGuard(() async {
            guardCalls++;
            return from == '/orders/create';
          });
          final ok = await leaveCreateOrderThenGo(
            container: container,
            go: (p) => went = p,
            path: to,
            currentLocation: from,
          );
          if (from == '/orders/create') {
            expect(ok, isTrue, reason: 'create-order confirmed $from → $to');
            expect(guardCalls, 1, reason: 'guard must run on $from → $to');
          } else {
            expect(ok, isTrue, reason: '$from → $to');
            expect(guardCalls, 0, reason: 'stale guard must not run on $from → $to');
          }
          expect(went, to, reason: '$from → $to');
        }
      }
    });

    test('does not navigate when path is empty', () async {
      var went = '';
      final ok = await leaveCreateOrderThenGo(
        container: container,
        go: (p) => went = p,
        path: '',
        currentLocation: '/orders/create',
      );
      expect(ok, isFalse);
      expect(went, isEmpty);
    });

    test('notifies same-location reselect after confirmed leave', () async {
      var went = '';
      var reselected = '';
      container.read(createOrderExitGuardProvider.notifier).state =
          CreateOrderExitGuard(() async => true);
      await leaveCreateOrderThenGo(
        container: container,
        go: (p) => went = p,
        path: '/warehouse-stock',
        currentLocation: '/warehouse-stock',
        onSameLocation: (p) => reselected = p,
      );
      expect(went, '/warehouse-stock');
      expect(reselected, '/warehouse-stock');
    });
  });
}
