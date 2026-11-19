import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/auth/session.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../agent/orders/order_create_models.dart' show formatMoneySpaced;
import '../config/expeditor_config_enforcement.dart';
import '../expeditor_providers.dart';
import '../payments/expeditor_notifications.dart';
import '../shell/expeditor_drawer.dart';
import 'expeditor_home_sheets.dart';
import 'expeditor_sync_sheet.dart';

/// «Синхронизация» — agentnikidek ikki variantli sheet (Полная / Обычная).
Future<void> _openSync(BuildContext context, WidgetRef ref) async {
  final full = await ExpeditorSyncSheet.show(context);
  if (full == null || !context.mounted) return;
  context.push('/exp-manual-sync?full=${full ? 1 : 0}');
}

class ExpeditorHomePage extends ConsumerWidget {
  const ExpeditorHomePage({super.key});

  String _fmtSync(String? iso) {
    if (iso == null || iso.isEmpty) return '—';
    final dt = DateTime.tryParse(iso);
    if (dt == null) return iso;
    return DateFormat('dd.MM, HH:mm').format(dt.toLocal());
  }

  String _fmtMoney(num v) => '${formatMoneySpaced(v.toDouble())} so\'m';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mobileConfig =
        ref.watch(sessionProvider.select((s) => s.mobileConfig));
    final policy = ExpeditorConfigPolicy.fromMobileConfig(mobileConfig);
    final dash = ref.watch(expeditorDashboardProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      drawer: const ExpeditorDrawer(),
      appBar: AppBar(
        title: const Text('Главная'),
        actions: const [ExpeditorNotificationsBell()],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(expeditorDashboardProvider);
          await ref.read(expeditorDashboardProvider.future);
        },
        child: dash.when(
          // Qayta yuklanish (reload) paytida eski ma'lumot ko'rinib tursin —
          // spinnerga sakrab miltillamasin.
          skipLoadingOnReload: true,
          data: (d) {
            final daily =
                Map<String, dynamic>.from(d['daily_report'] as Map? ?? {});
            final perf = (daily['performance_pct'] as num?)?.toDouble() ?? 0;
            final visited = daily['visited'] as int? ?? 0;
            final total = daily['visit_total'] as int? ?? 0;
            final remaining = daily['remaining'] as int? ?? 0;
            final rows = (d['shipment_report'] as List?)?.cast<Map>() ?? [];
            final payments =
                Map<String, dynamic>.from(d['payments'] as Map? ?? {});
            final pendingCount = payments['pending_count'] as int? ??
                payments['synced_count'] as int? ??
                0;
            final pendingSum = (payments['pending_sum'] as num?) ??
                payments['synced_sum'] as num? ??
                0;
            final paymentsSummary = pendingCount == 0
                ? 'Tasdiqlanishni kutayotgan to\'lovlar yo\'q'
                : 'Tasdiqlanishni kutmoqda: $pendingCount — ${_fmtMoney(pendingSum)}';

            return ListView(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 130),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Дневной отчёт на сегодня',
                            style: AppTypography.titleMedium,),
                        const SizedBox(height: 12),
                        Center(
                          child: SizedBox(
                            width: 132,
                            height: 132,
                            child: Stack(
                              alignment: Alignment.center,
                              children: [
                                SizedBox(
                                  width: 132,
                                  height: 132,
                                  child: CircularProgressIndicator(
                                    value: (perf / 100).clamp(0.0, 1.0),
                                    strokeWidth: 12,
                                    color: AppColors.expeditorAccent,
                                    backgroundColor: AppColors.expeditorAccent
                                        .withValues(alpha: 0.15),
                                  ),
                                ),
                                Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text('${perf.toInt()}%',
                                        style: AppTypography.headlineMedium,),
                                    const Text('УСПЕВАЕМОСТЬ',
                                        style: TextStyle(
                                            fontSize: 9,
                                            color: AppColors.textMuted,),),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                                child: _MiniStat(
                                    'Посещено',
                                    '$visited / $total',
                                    Icons.check_circle,
                                    AppColors.success,),),
                            const SizedBox(width: 8),
                            Expanded(
                                child: _MiniStat(
                                    'Осталось',
                                    '$remaining / $total',
                                    Icons.location_on,
                                    AppColors.error,),),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(
                            'Последняя синхр-ция: ${_fmtSync(d['last_sync_at']?.toString())}',
                            style: AppTypography.caption,),
                        const SizedBox(height: 8),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: () => _openSync(context, ref),
                            style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.expeditorAccent,),
                            child: const Text('Синхронизация'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Оплаты',
                            style: TextStyle(fontWeight: FontWeight.w700),),
                        const SizedBox(height: 6),
                        Text(
                          paymentsSummary,
                          style: AppTypography.bodySmall,
                        ),
                        const SizedBox(height: 10),
                        if (policy.paymentsEnabled)
                          SizedBox(
                            width: double.infinity,
                            child: OutlinedButton(
                              onPressed: () =>
                                  showExpeditorPaymentsSheet(context),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: AppColors.expeditorAccent,
                                side: const BorderSide(color: AppColors.border),
                                padding:
                                    const EdgeInsets.symmetric(vertical: 12),
                              ),
                              child: const Text('Информация оплаты'),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Отчет по отгрузкам',
                            style: AppTypography.titleMedium,),
                        const SizedBox(height: 8),
                        _ReportTable(
                            rows: rows
                                .map((e) => Map<String, dynamic>.from(e))
                                .toList(),),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton(
                                onPressed: () =>
                                    showExpeditorDeliveryByClientsSheet(
                                        context,),
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: AppColors.textPrimary,
                                  side:
                                      const BorderSide(color: AppColors.border),
                                  padding:
                                      const EdgeInsets.symmetric(vertical: 10),
                                ),
                                child: const Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text('По клиентам'),
                                    SizedBox(width: 4),
                                    Icon(Icons.chevron_right, size: 18),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: OutlinedButton(
                                onPressed: () =>
                                    showExpeditorDeliveryByProductsSheet(
                                        context,),
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: AppColors.textPrimary,
                                  side:
                                      const BorderSide(color: AppColors.border),
                                  padding:
                                      const EdgeInsets.symmetric(vertical: 10),
                                ),
                                child: const Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text('По продуктам'),
                                    SizedBox(width: 4),
                                    Icon(Icons.chevron_right, size: 18),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text('Ошибка: $e')),
        ),
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  const _MiniStat(this.label, this.value, this.icon, this.color);

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 18),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: const TextStyle(fontSize: 10)),
                  Text(value,
                      style: const TextStyle(fontWeight: FontWeight.w700),),
                ],
              ),
            ),
          ],
        ),
      );
}

class _ReportTable extends StatelessWidget {
  final List<Map<String, dynamic>> rows;
  const _ReportTable({required this.rows});

  Color _color(String type) {
    switch (type) {
      case 'delivered':
        return AppColors.success;
      case 'return':
      case 'shelf_return':
        return AppColors.error;
      case 'exchange_return':
        return AppColors.warning;
      default:
        return AppColors.textPrimary;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Table(
      columnWidths: const {
        0: FlexColumnWidth(2),
        1: FlexColumnWidth(1),
        2: FlexColumnWidth(1.2),
      },
      children: [
        const TableRow(
          children: [
            Padding(
                padding: EdgeInsets.symmetric(vertical: 4),
                child: Text('Тип',
                    style:
                        TextStyle(fontWeight: FontWeight.w600, fontSize: 11),),),
            Padding(
                padding: EdgeInsets.symmetric(vertical: 4),
                child: Text('Кол-во',
                    style:
                        TextStyle(fontWeight: FontWeight.w600, fontSize: 11),),),
            Padding(
                padding: EdgeInsets.symmetric(vertical: 4),
                child: Text('Сумма',
                    style:
                        TextStyle(fontWeight: FontWeight.w600, fontSize: 11),),),
          ],
        ),
        ...rows.map((r) {
          final type = r['type']?.toString() ?? '';
          final c = _color(type);
          return TableRow(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Text(r['label']?.toString() ?? type,
                    style: TextStyle(fontSize: 11, color: c),),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Text('${r['qty'] ?? 0}',
                    style: TextStyle(fontSize: 11, color: c),),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Text(
                    formatMoneySpaced(((r['sum'] as num?) ?? 0).toDouble()),
                    style: TextStyle(fontSize: 11, color: c),),
              ),
            ],
          );
        }),
      ],
    );
  }
}
