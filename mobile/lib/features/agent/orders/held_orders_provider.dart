import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exceptions.dart';
import '../../../core/api/orders_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/database/app_database.dart';
import '../../../core/sync/sync_data_refresh.dart';
import '../../auth/auth_provider.dart';
import 'held_order_model.dart';
import 'held_order_repository.dart';
import 'order_create_models.dart';
import 'orders_providers.dart';

final heldOrderRepositoryProvider = Provider((ref) => HeldOrderRepository());

final heldOrderTickProvider = StreamProvider<int>((ref) {
  return Stream.periodic(const Duration(seconds: 1), (i) => i);
});

final heldOrdersProvider = FutureProvider<List<HeldOrder>>((ref) async {
  ref.watch(heldOrderTickProvider);
  return ref.read(heldOrderRepositoryProvider).listPending();
});

final heldOrderCountProvider = FutureProvider<int>((ref) async {
  ref.watch(heldOrderTickProvider);
  return ref.read(heldOrderRepositoryProvider).pendingCount();
});

/// Ilova ochilganda va yangi hold qo‘shilganda taymerlarni boshqaradi.
final heldOrderSchedulerProvider = Provider<HeldOrderScheduler>((ref) {
  final scheduler = HeldOrderScheduler(ref);
  scheduler.bootstrap();
  ref.onDispose(scheduler.dispose);
  return scheduler;
});

class HeldOrderScheduler {
  HeldOrderScheduler(this._ref);
  final Ref _ref;
  final _timers = <int, Timer>{};
  bool _bootstrapped = false;

  Future<void> bootstrap() async {
    if (_bootstrapped) return;
    _bootstrapped = true;
    final repo = _ref.read(heldOrderRepositoryProvider);
    final pending = await repo.listPending();
    final now = DateTime.now();
    for (final order in pending) {
      _schedule(order, now);
    }
  }

  void schedule(HeldOrder order) {
    _schedule(order, DateTime.now());
    _ref.invalidate(heldOrdersProvider);
    _ref.invalidate(heldOrderCountProvider);
  }

  void cancelTimer(int heldOrderId) {
    _timers.remove(heldOrderId)?.cancel();
  }

  void _schedule(HeldOrder order, DateTime now) {
    cancelTimer(order.id);
    final wait = order.submitAt.difference(now);
    if (wait.inMilliseconds <= 0) {
      unawaited(_submit(order.id));
      return;
    }
    _timers[order.id] = Timer(wait, () => _submit(order.id));
  }

  Future<void> _submit(int heldOrderId) async {
    cancelTimer(heldOrderId);
    final repo = _ref.read(heldOrderRepositoryProvider);
    final order = await repo.getById(heldOrderId);
    if (order == null || !order.isPending) return;

    final slug = _ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return;

    try {
      final row = await _ref.read(ordersApiProvider).createOrder(
            slug,
            clientId: order.clientId,
            warehouseId: order.warehouseId,
            items: order.items,
            priceType: order.priceType,
            applyBonus: order.applyBonus,
            applyDiscount: order.applyDiscount,
            giftOverrides: order.giftOverrides,
            giftLines: order.giftLines,
            comment: order.comment.isEmpty ? null : order.comment,
            isConsignment: order.isConsignment,
            consignmentDueDate: order.consignmentDueDate,
            shipmentDate: order.shipmentDate,
          );
      final orderId = parseOrderInt(row['id']);
      if (orderId != null) {
        await AppDatabase().upsertOrders([
          {
            'id': orderId,
            'number': row['number']?.toString() ?? '$orderId',
            'client_id': order.clientId,
            'status': row['status']?.toString() ?? 'new',
            'created_at': row['created_at']?.toString() ?? DateTime.now().toIso8601String(),
            'total': parseOrderNum(row['total_sum'] ?? row['total']),
          },
        ]);
      }
      await repo.markSubmitted(heldOrderId);
      _ref.invalidate(heldOrdersProvider);
      _ref.invalidate(heldOrderCountProvider);
      _ref.invalidate(ordersListProvider);
      invalidateSyncedData(_ref.invalidate);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _ref.read(authStateProvider.notifier).resync();
      });
    } on ApiException catch (_) {
      // Keyingi urinish — submit_at ni 30s ga suramiz
      final retryAt = DateTime.now().add(const Duration(seconds: 30));
      await repo.update(HeldOrder(
        id: order.id,
        clientId: order.clientId,
        clientName: order.clientName,
        warehouseId: order.warehouseId,
        priceType: order.priceType,
        comment: order.comment,
        items: order.items,
        applyBonus: order.applyBonus,
        applyDiscount: order.applyDiscount,
        giftOverrides: order.giftOverrides,
        giftLines: order.giftLines,
        isConsignment: order.isConsignment,
        consignmentDueDate: order.consignmentDueDate,
        shipmentDate: order.shipmentDate,
        estimatedTotal: order.estimatedTotal,
        itemCount: order.itemCount,
        createdAt: order.createdAt,
        submitAt: retryAt,
      ));
      _schedule(await repo.getById(heldOrderId) ?? order, DateTime.now());
      _ref.invalidate(heldOrdersProvider);
    } catch (_) {
      final retryAt = DateTime.now().add(const Duration(seconds: 30));
      await AppDatabase().updateHeldOrder(heldOrderId, {'submit_at': retryAt.toIso8601String()});
      final refreshed = await repo.getById(heldOrderId);
      if (refreshed != null) _schedule(refreshed, DateTime.now());
      _ref.invalidate(heldOrdersProvider);
    }
  }

  Future<void> cancelHeldOrder(int heldOrderId) async {
    cancelTimer(heldOrderId);
    await _ref.read(heldOrderRepositoryProvider).cancel(heldOrderId);
    _ref.invalidate(heldOrdersProvider);
    _ref.invalidate(heldOrderCountProvider);
  }

  void dispose() {
    for (final t in _timers.values) {
      t.cancel();
    }
    _timers.clear();
  }
}

Future<HeldOrder> saveHeldOrder({
  required WidgetRef ref,
  required int clientId,
  required String clientName,
  required int warehouseId,
  required String priceType,
  required String comment,
  required List<OrderLineInput> items,
  required bool applyBonus,
  required bool applyDiscount,
  List<BonusGiftOverrideInput> giftOverrides = const [],
  List<BonusGiftLineInput> giftLines = const [],
  bool isConsignment = false,
  String? consignmentDueDate,
  String? shipmentDate,
  double estimatedTotal = 0,
  int delayMinutes = 5,
  int? existingId,
}) async {
  final repo = ref.read(heldOrderRepositoryProvider);
  final now = DateTime.now();
  final submitAt = now.add(Duration(minutes: delayMinutes));
  final itemCount = items.fold<double>(0, (s, i) => s + i.qty).round();

  HeldOrder order;
  if (existingId != null) {
    order = HeldOrder(
      id: existingId,
      clientId: clientId,
      clientName: clientName,
      warehouseId: warehouseId,
      priceType: priceType,
      comment: comment,
      items: items,
      applyBonus: applyBonus,
      applyDiscount: applyDiscount,
      giftOverrides: giftOverrides,
      giftLines: giftLines,
      isConsignment: isConsignment,
      consignmentDueDate: consignmentDueDate,
      shipmentDate: shipmentDate,
      estimatedTotal: estimatedTotal,
      itemCount: itemCount,
      createdAt: now,
      submitAt: submitAt,
    );
    await repo.update(order);
  } else {
    final id = await repo.insert(HeldOrder(
      id: 0,
      clientId: clientId,
      clientName: clientName,
      warehouseId: warehouseId,
      priceType: priceType,
      comment: comment,
      items: items,
      applyBonus: applyBonus,
      applyDiscount: applyDiscount,
      giftOverrides: giftOverrides,
      giftLines: giftLines,
      isConsignment: isConsignment,
      consignmentDueDate: consignmentDueDate,
      shipmentDate: shipmentDate,
      estimatedTotal: estimatedTotal,
      itemCount: itemCount,
      createdAt: now,
      submitAt: submitAt,
    ));
    order = (await repo.getById(id))!;
  }

  ref.read(heldOrderSchedulerProvider).schedule(order);
  ref.invalidate(heldOrdersProvider);
  ref.invalidate(heldOrderCountProvider);
  return order;
}
