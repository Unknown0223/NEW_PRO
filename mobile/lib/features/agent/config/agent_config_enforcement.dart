import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/session.dart';
import '../../../core/config/agent_action_guards.dart';
import '../../../core/config/mobile_config.dart';
import '../../../core/device/battery_level.dart';
import '../home/sync_count_provider.dart';

/// Majburiy sinxron talab qilinadimi.
final mustMandatorySyncProvider = FutureProvider<bool>((ref) async {
  final sync = ref.watch(sessionProvider).mobileConfig?.sync ?? const SyncConfig();
  final count = await ref.watch(syncCountTodayProvider.future);
  return checkMandatorySyncBlock(sync: sync, syncCountToday: count) != null;
});

Future<AgentActionBlock?> evaluateAgentOrderGuards(
  WidgetRef ref, {
  int? clientId,
}) async {
  final cfg = ref.read(sessionProvider).mobileConfig ?? const MobileConfig();
  final syncCount = await ref.read(syncCountTodayProvider.future);

  final syncBlock = checkMandatorySyncBlock(sync: cfg.sync, syncCountToday: syncCount);
  if (syncBlock != null) return syncBlock;

  final battery = await readBatteryLevelPercent();
  final batteryBlock = checkBatteryBlock(gps: cfg.gps, batteryLevelPct: battery);
  if (batteryBlock != null) return batteryBlock;

  // Marshrut cooldown (`route.readd_cooldown_days`) faqat avtomatik marshrut xaritasiga
  // taalluqli — buyurtma yaratish bloklanmaydi (sozlamalar → Маршрут).

  return null;
}
