import '../../../core/database/app_database.dart';
import 'held_order_model.dart';

class HeldOrderRepository {
  final AppDatabase _db;
  HeldOrderRepository([AppDatabase? db]) : _db = db ?? AppDatabase();

  Future<List<HeldOrder>> listPending() async {
    final rows = await _db.getPendingHeldOrders();
    return rows.map(HeldOrder.fromMap).toList();
  }

  Future<HeldOrder?> getById(int id) async {
    final row = await _db.getHeldOrderById(id);
    if (row == null) return null;
    return HeldOrder.fromMap(row);
  }

  Future<int> insert(HeldOrder order) async {
    return _db.insertHeldOrder(order.toInsertMap());
  }

  Future<void> update(HeldOrder order) async {
    await _db.updateHeldOrder(order.id, order.toInsertMap());
  }

  Future<void> cancel(int id) async {
    await _db.markHeldOrderStatus(id, 'cancelled');
    await _db.deleteHeldOrder(id);
  }

  Future<void> markSubmitted(int id) async {
    await _db.deleteHeldOrder(id);
  }

  Future<int> pendingCount() => _db.pendingHeldOrderCount();
}
