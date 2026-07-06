import 'package:battery_plus/battery_plus.dart';

final _battery = Battery();

/// Joriy batareya foizi (0–100) yoki o‘lchanmasa `null`.
Future<int?> readBatteryLevelPercent() async {
  try {
    final level = await _battery.batteryLevel;
    if (level < 0 || level > 100) return null;
    return level;
  } catch (_) {
    return null;
  }
}
