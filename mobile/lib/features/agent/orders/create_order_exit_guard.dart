import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Create-order ekrani ochiq va savatda o‘zgarish bo‘lsa — boshqa route ga
/// (`context.go`, drawer «Главная») o‘tishdan oldin chernovik so‘rovini chaqirish.
typedef CreateOrderLeaveConfirm = Future<bool> Function();

class CreateOrderExitGuard {
  final CreateOrderLeaveConfirm confirmLeave;

  const CreateOrderExitGuard(this.confirmLeave);
}

final createOrderExitGuardProvider =
    StateProvider<CreateOrderExitGuard?>((ref) => null);

/// Chernovik so‘rovi faqat «Добавить заказ» route da.
bool isAgentCreateOrderRoute(String location) {
  final path = location.split('?').first;
  return path == '/orders/create' || path.startsWith('/orders/create/');
}

void clearCreateOrderExitGuard(ProviderContainer container) {
  if (container.read(createOrderExitGuardProvider) == null) return;
  container.read(createOrderExitGuardProvider.notifier).state = null;
}

/// Drawer / boshqa `go` chaqiriqlari uchun: ruxsat bo‘lsa true.
Future<bool> confirmLeaveCreateOrderIfNeeded(WidgetRef ref) async {
  String? loc;
  try {
    loc = GoRouterState.of(ref.context).uri.path;
  } catch (_) {}
  return confirmLeaveCreateOrderIfNeededFromContainer(
    ProviderScope.containerOf(ref.context, listen: false),
    currentLocation: loc,
  );
}

/// Widget `context` o‘chganidan keyin ham ishlaydi (drawer `pop` dan keyin).
/// [currentLocation] create-order bo‘lmasa, eski/qolib ketgan guard e’tiborsiz.
Future<bool> confirmLeaveCreateOrderIfNeededFromContainer(
  ProviderContainer container, {
  String? currentLocation,
}) async {
  if (currentLocation != null && !isAgentCreateOrderRoute(currentLocation)) {
    clearCreateOrderExitGuard(container);
    return true;
  }
  final guard = container.read(createOrderExitGuardProvider);
  if (guard == null) return true;
  return guard.confirmLeave();
}

/// Drawer yopilgach uning `context`i unmount bo‘ladi — `go` ni oldindan
/// olingan router orqali chaqirish kerak, aks holda tanlangan bo‘limga o‘tmaydi.
///
/// Vizit / Главная / KPI va boshqa sahifalarda chernovik dialogi chiqmasin:
/// guard faqat `/orders/create` da.
Future<bool> leaveCreateOrderThenGo({
  required ProviderContainer container,
  required void Function(String path) go,
  required String path,
  required String currentLocation,
  void Function(String path)? onSameLocation,
}) async {
  if (path.isEmpty) return false;
  final canLeave = await confirmLeaveCreateOrderIfNeededFromContainer(
    container,
    currentLocation: currentLocation,
  );
  if (!canLeave) return false;
  if (currentLocation == path) {
    onSameLocation?.call(path);
  }
  go(path);
  return true;
}
