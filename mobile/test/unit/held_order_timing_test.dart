import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/config/mobile_config.dart';
import 'package:salesdoc_mobile/features/agent/orders/held_order_model.dart';
import 'package:salesdoc_mobile/features/agent/orders/held_order_timing.dart';
import 'package:salesdoc_mobile/features/agent/orders/order_draft_model.dart';

void main() {
  group('clampPostOrderDelayMinutes (web → mobile)', () {
    test('0 and negative → 0 (сразу)', () {
      expect(clampPostOrderDelayMinutes(0), 0);
      expect(clampPostOrderDelayMinutes(-3), 0);
    });

    test('1…59 preserved', () {
      expect(clampPostOrderDelayMinutes(1), 1);
      expect(clampPostOrderDelayMinutes(5), 5);
      expect(clampPostOrderDelayMinutes(15), 15);
      expect(clampPostOrderDelayMinutes(59), 59);
    });

    test('>59 clamped to 59', () {
      expect(clampPostOrderDelayMinutes(60), 59);
      expect(clampPostOrderDelayMinutes(120), 59);
    });
  });

  group('SyncConfig.postOrderDelayMinutes from web JSON', () {
    test('parses and clamps like agent-configurations-dialog', () {
      expect(
        SyncConfig.fromJson({'post_order_delay_minutes': 10}).postOrderDelayMinutes,
        10,
      );
      expect(
        SyncConfig.fromJson({'post_order_delay_minutes': 0}).postOrderDelayMinutes,
        0,
      );
      expect(
        SyncConfig.fromJson({'post_order_delay_minutes': 99}).postOrderDelayMinutes,
        59,
      );
      expect(SyncConfig.fromJson({}).postOrderDelayMinutes, 0);
    });
  });

  group('computeHeldSubmitAt', () {
    test('delay 0 → submitAt == createdAt', () {
      final t = DateTime(2026, 8, 30, 12, 0);
      expect(computeHeldSubmitAt(createdAt: t, delayMinutes: 0), t);
    });

    test('delay 15 → +15 minutes', () {
      final t = DateTime(2026, 8, 30, 12, 0);
      expect(
        computeHeldSubmitAt(createdAt: t, delayMinutes: 15),
        DateTime(2026, 8, 30, 12, 15),
      );
    });
  });

  group('postponeHeldSubmitAt (ilovada kechiktirish)', () {
    test('extends from current submitAt by web delay', () {
      final submitAt = DateTime(2026, 8, 30, 12, 10);
      expect(
        postponeHeldSubmitAt(from: submitAt, delayMinutes: 10),
        DateTime(2026, 8, 30, 12, 20),
      );
    });

    test('delay 0 still gives +1 min so agent can postpone', () {
      final from = DateTime(2026, 8, 30, 12, 0);
      expect(
        postponeHeldSubmitAt(from: from, delayMinutes: 0),
        DateTime(2026, 8, 30, 12, 1),
      );
    });

    test('clamps huge delay to 59', () {
      final from = DateTime(2026, 8, 30, 12, 0);
      expect(
        postponeHeldSubmitAt(from: from, delayMinutes: 100),
        DateTime(2026, 8, 30, 12, 59),
      );
    });
  });

  group('refreshHeldEditWindow', () {
    test('re-edit resets window from now', () {
      final now = DateTime(2026, 8, 30, 14, 0);
      final w = refreshHeldEditWindow(now: now, delayMinutes: 5);
      expect(w.createdAt, now);
      expect(w.submitAt, DateTime(2026, 8, 30, 14, 5));
    });
  });

  group('HeldOrder.remaining', () {
    test('counts down to submitAt', () {
      final order = HeldOrder(
        id: 1,
        clientId: 1,
        clientName: 'Test',
        warehouseId: 1,
        priceType: 'retail',
        comment: '',
        items: const [],
        applyBonus: false,
        applyDiscount: false,
        createdAt: DateTime(2026, 8, 30, 12, 0),
        submitAt: DateTime(2026, 8, 30, 12, 5),
      );
      expect(
        order.remaining(DateTime(2026, 8, 30, 12, 2)),
        const Duration(minutes: 3),
      );
      expect(
        order.remaining(DateTime(2026, 8, 30, 12, 10)),
        Duration.zero,
      );
    });
  });

  group('OrderDraft TTL + round-trip', () {
    test('TTL is 1 day; fromDbRow derives expires from savedAt', () {
      final saved = DateTime(2026, 8, 30, 10, 0);
      final draft = OrderDraft(
        clientId: 42,
        warehouseId: 7,
        warehouseName: 'Склад',
        priceType: 'opt',
        comment: 'note',
        quantities: {11: 2, 22: 0.5},
        totalQty: 2.5,
        totalSum: 1000,
        totalVolume: 1.2,
        savedAt: saved,
        expiresAt: saved.add(OrderDraft.ttl),
      );
      expect(OrderDraft.ttl, const Duration(days: 1));

      final row = draft.toDbRow();
      // Legacy short expires_at must be ignored.
      row['expires_at'] = saved.add(const Duration(hours: 1)).toIso8601String();

      final back = OrderDraft.fromDbRow(row)!;
      expect(back.clientId, 42);
      expect(back.warehouseId, 7);
      expect(back.warehouseName, 'Склад');
      expect(back.priceType, 'opt');
      expect(back.comment, 'note');
      expect(back.quantities, {11: 2.0, 22: 0.5});
      expect(back.totalQty, 2.5);
      expect(back.totalSum, 1000);
      expect(back.expiresAt, saved.add(OrderDraft.ttl));
      expect(back.hasItems, isTrue);
      expect(back.isExpired, isFalse);
    });

    test('empty quantities → hasItems false', () {
      final now = DateTime(2026, 8, 30);
      final d = OrderDraft(
        clientId: 1,
        warehouseId: 1,
        priceType: 'x',
        quantities: const {},
        totalQty: 0,
        totalSum: 0,
        savedAt: now,
        expiresAt: now.add(OrderDraft.ttl),
      );
      expect(d.hasItems, isFalse);
    });
  });
}
