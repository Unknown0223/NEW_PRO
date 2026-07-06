import 'mobile_config.dart';
import 'mobile_config_policy.dart';
import 'route_config_policy.dart';

enum AgentActionBlockKind {
  mandatorySync,
  lowBattery,
  readdCooldown,
  movementBlocked,
}

class AgentActionBlock {
  final AgentActionBlockKind kind;
  final String message;

  const AgentActionBlock({required this.kind, required this.message});
}

AgentActionBlock? checkMandatorySyncBlock({
  required SyncConfig sync,
  required int syncCountToday,
}) {
  if (!needsMandatorySync(sync, syncCountToday)) return null;
  final need = sync.mandatorySyncCount;
  return AgentActionBlock(
    kind: AgentActionBlockKind.mandatorySync,
    message: 'Выполните обязательную синхронизацию ($syncCountToday из $need)',
  );
}

AgentActionBlock? checkBatteryBlock({
  required GpsConfig gps,
  required int? batteryLevelPct,
}) {
  final min = gps.minBatteryPct;
  if (min == null || min <= 0 || batteryLevelPct == null) return null;
  if (batteryLevelPct >= min) return null;
  return AgentActionBlock(
    kind: AgentActionBlockKind.lowBattery,
    message: 'Низкий заряд батареи ($batteryLevelPct%, минимум $min%)',
  );
}

AgentActionBlock? checkReaddCooldownBlock({
  required RouteConfig route,
  required int clientId,
  required Map<int, DateTime> lastActivityByClient,
}) {
  if (!isClientInReaddCooldown(
    clientId: clientId,
    readdCooldownDays: route.readdCooldownDays,
    lastActivityByClient: lastActivityByClient,
  )) {
    return null;
  }
  return AgentActionBlock(
    kind: AgentActionBlockKind.readdCooldown,
    message: readdCooldownBlockMessage(route.readdCooldownDays),
  );
}

AgentActionBlock? checkVanSellingMovementBlock({
  required VanSellingConfig? vanSelling,
  required double? speedMetersPerSecond,
}) {
  if (vanSelling == null || vanSelling.allowOrderWhileMoving) return null;
  final speed = speedMetersPerSecond ?? 0;
  if (speed < 0.8) return null;
  return const AgentActionBlock(
    kind: AgentActionBlockKind.movementBlocked,
    message: 'Заказ во время движения запрещён настройками',
  );
}
