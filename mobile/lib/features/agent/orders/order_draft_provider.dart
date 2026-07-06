import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/database/app_database.dart';
import 'order_draft_model.dart';

final orderDraftsProvider = FutureProvider<Map<int, OrderDraft>>((ref) async {
  final rows = await AppDatabase().getActiveOrderDraftRows();
  final out = <int, OrderDraft>{};
  for (final row in rows) {
    final draft = OrderDraft.fromDbRow(row);
    if (draft != null && !draft.isExpired) {
      out[draft.clientId] = draft;
    }
  }
  return out;
});

final orderDraftForClientProvider = FutureProvider.family<OrderDraft?, int>((ref, clientId) async {
  final row = await AppDatabase().getOrderDraftRowForClient(clientId);
  if (row == null) return null;
  final draft = OrderDraft.fromDbRow(row);
  if (draft == null || draft.isExpired) return null;
  return draft;
});

class OrderDraftRepository {
  const OrderDraftRepository();

  Future<OrderDraft?> loadForClient(int clientId) async {
    final row = await AppDatabase().getOrderDraftRowForClient(clientId);
    if (row == null) return null;
    final draft = OrderDraft.fromDbRow(row);
    if (draft == null || draft.isExpired) return null;
    return draft;
  }

  Future<void> save(OrderDraft draft) async {
    await AppDatabase().upsertOrderDraft(draft.toDbRow());
  }

  Future<void> delete(int clientId) async {
    await AppDatabase().deleteOrderDraft(clientId);
  }
}

final orderDraftRepositoryProvider = Provider((_) => const OrderDraftRepository());

void invalidateOrderDrafts(void Function(ProviderOrFamily provider) invalidate) {
  invalidate(orderDraftsProvider);
}
