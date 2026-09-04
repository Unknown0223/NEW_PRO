import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Create-order ekrani ochiq va savatda o‘zgarish bo‘lsa — boshqa route ga
/// (`context.go`, drawer «Главная») o‘tishdan oldin chernovik so‘rovini chaqirish.
typedef CreateOrderLeaveConfirm = Future<bool> Function();

class CreateOrderExitGuard {
  final CreateOrderLeaveConfirm confirmLeave;

  const CreateOrderExitGuard(this.confirmLeave);
}

final createOrderExitGuardProvider =
    StateProvider<CreateOrderExitGuard?>((ref) => null);

/// Drawer / boshqa `go` chaqiriqlari uchun: ruxsat bo‘lsa true.
Future<bool> confirmLeaveCreateOrderIfNeeded(WidgetRef ref) async {
  final guard = ref.read(createOrderExitGuardProvider);
  if (guard == null) return true;
  return guard.confirmLeave();
}
