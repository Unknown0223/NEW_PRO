import 'package:flutter/material.dart';

import '../../../core/api/mobile_api.dart';
import '../../../core/format/money_display.dart';
import '../../../core/theme/app_colors.dart';
import '../tabel/tabel_format.dart';

/// Plan turi (`primary_metric`) bo‘yicha bitta icon:
/// summa → payments, AKB → storefront, hajm → inventory, zakaz → bag, son → tag.
IconData kpiMetricIcon(String metric) {
  switch (metric.trim().toLowerCase()) {
    case 'acb':
      return Icons.storefront_rounded;
    case 'volume':
      return Icons.inventory_2_rounded;
    case 'order_count':
      return Icons.shopping_bag_rounded;
    case 'count':
      return Icons.sell_rounded;
    case 'cost':
    default:
      return Icons.payments_rounded;
  }
}

/// Bir nechta plan kartochkalari — bir xil tip icon, ranglar index bo‘yicha farq qiladi.
Color kpiMetricIconTone(String metric, int index) {
  const byMetric = <String, List<Color>>{
    'cost': [
      AppColors.primary,
      Color(0xFF0EA5E9),
      Color(0xFFF59E0B),
      Color(0xFF14B8A6),
      Color(0xFF8B5CF6),
      Color(0xFFEC4899),
    ],
    'acb': [
      Color(0xFF0EA5E9),
      Color(0xFF6366F1),
      Color(0xFF06B6D4),
      AppColors.primary,
      Color(0xFF8B5CF6),
      Color(0xFF3B82F6),
    ],
    'volume': [
      Color(0xFFF59E0B),
      Color(0xFFEA580C),
      Color(0xFFD97706),
      AppColors.warning,
      Color(0xFFCA8A04),
      Color(0xFFB45309),
    ],
    'order_count': [
      AppColors.success,
      Color(0xFF10B981),
      Color(0xFF059669),
      Color(0xFF14B8A6),
      Color(0xFF0D9488),
      Color(0xFF047857),
    ],
    'count': [
      Color(0xFF8B5CF6),
      Color(0xFFA855F7),
      Color(0xFF7C3AED),
      Color(0xFFEC4899),
      Color(0xFFD946EF),
      Color(0xFF6366F1),
    ],
  };
  final key = metric.trim().toLowerCase();
  final tones = byMetric[key] ?? byMetric['cost']!;
  return tones[index % tones.length];
}

/// Eski API: nom bo‘yicha (fallback). Yangi UI — [kpiMetricIcon].
IconData kpiGroupIcon(String name, {String? metric}) {
  if (metric != null && metric.trim().isNotEmpty) {
    return kpiMetricIcon(metric);
  }
  final n = name.toLowerCase().trim();
  if (n.contains('клиент') || n.contains('client') || n.contains('acb') || n.contains('акб')) {
    return Icons.storefront_rounded;
  }
  if (n.contains('визит') || n.contains('visit') || n.contains('маршрут')) {
    return Icons.route_rounded;
  }
  if (n.contains('заказ') || n.contains('order')) {
    return Icons.shopping_bag_rounded;
  }
  if (n.contains('объем') || n.contains('volume') || n.contains('qty') || n.contains('кол')) {
    return Icons.inventory_2_rounded;
  }
  if (n.contains('савдо') || n.contains('продаж') || n.contains('sales') || n.contains('сумм')) {
    return Icons.payments_rounded;
  }
  return Icons.payments_rounded;
}

Color kpiGroupIconTone(String name, int index, {String? metric}) {
  if (metric != null && metric.trim().isNotEmpty) {
    return kpiMetricIconTone(metric, index);
  }
  return kpiMetricIconTone('cost', index);
}

/// Asosiy metrika qiymatini qisqa matnga.
String kpiMetricLabel(String metric) {
  switch (metric) {
    case 'count':
      return 'кол-во';
    case 'volume':
      return 'объём';
    case 'acb':
      return 'АКБ';
    case 'order_count':
      return 'заказы';
    default:
      return 'сумма';
  }
}

/// O‘qish uchun: pul/hajm — 3 xonali guruh (1 234 567); kichik sonlar oddiy.
String kpiFormatPrimary(double v, String metric) {
  if (metric == 'cost') return formatMoneySpaced(v);
  if (metric == 'volume') {
    if (v.abs() >= 1000) return formatMoneySpaced(v);
    return v == v.roundToDouble() ? v.toInt().toString() : v.toStringAsFixed(2);
  }
  if (metric == 'count' || metric == 'order_count' || metric == 'acb') {
    if (v.abs() >= 1000) return formatMoneySpaced(v);
    return v == v.roundToDouble() ? v.toInt().toString() : v.toStringAsFixed(1);
  }
  if (v == v.roundToDouble()) return formatMoneySpaced(v);
  return v.toStringAsFixed(1);
}

/// Kartochka tepasidagi ixcham ko‘rinish (25.8M) — joy tejash.
String kpiFormatCompact(double v, String metric) {
  if (metric == 'cost' || metric == 'volume') return tabelCompactSum(v);
  return kpiFormatPrimary(v, metric);
}

String kpiFactPlanLine(AgentKpiGroupRow g, {bool compact = false}) {
  final fmt = compact ? kpiFormatCompact : kpiFormatPrimary;
  final fact = fmt(g.fact.primaryValue(g.primaryMetric), g.primaryMetric);
  final plan = fmt(g.plan.primaryValue(g.primaryMetric), g.primaryMetric);
  return '$fact / $plan';
}

String kpiRemainingLine(AgentKpiGroupRow g) {
  final rem = g.remainingPrimary;
  if (rem == null || rem <= 0) return kpiMetricLabel(g.primaryMetric);
  final formatted = kpiFormatPrimary(rem, g.primaryMetric);
  return 'до плана: $formatted';
}

/// Agentga biriktirilgan + faol KPI guruh / reja (fakt 0 bo‘lsa ham ko‘rsatiladi).
bool kpiGroupIsActive(AgentKpiGroupRow g) {
  // Settings is_active=false — yashirish (bir xil nomli inactive+active turli id).
  if (g.isActive == false) return false;
  final planV = g.plan.primaryValue(g.primaryMetric);
  if (planV <= 0) return false;
  final status = g.planStatus.toLowerCase();
  if (status == 'cancelled' || status == 'draft' || status == 'rejected') {
    return false;
  }
  return true;
}

List<AgentKpiGroupRow> kpiVisibleGroups(List<AgentKpiGroupRow> groups) {
  final active = groups.where(kpiGroupIsActive).toList();
  // Bir xil guruh id dublikati — bitta qator (nom bo‘yicha emas).
  final byId = <int, AgentKpiGroupRow>{};
  for (final g in active) {
    final prev = byId[g.kpiGroupId];
    if (prev == null) {
      byId[g.kpiGroupId] = g;
      continue;
    }
    final prevFact = prev.fact.primaryValue(prev.primaryMetric);
    final nextFact = g.fact.primaryValue(g.primaryMetric);
    if (nextFact > prevFact) byId[g.kpiGroupId] = g;
  }
  return byId.values.toList();
}

int kpiPctInt(double? pct) => (pct ?? 0).round().clamp(0, 999);

String kpiAgentSubtitle(AgentKpiResult data, {String fallbackName = '', String fallbackCode = ''}) {
  final name = data.agentName.trim().isNotEmpty ? data.agentName.trim() : fallbackName.trim();
  final code = (data.agentCode ?? '').trim().isNotEmpty
      ? data.agentCode!.trim()
      : fallbackCode.trim();
  if (name.isEmpty && code.isEmpty) return 'сегодня и месяц';
  if (code.isEmpty) return '$name · сегодня и месяц';
  if (name.isEmpty) return '$code · сегодня и месяц';
  return '$code · сегодня и месяц';
}
