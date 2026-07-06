import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/session.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../supervisor_providers.dart';

class SupervisorDashboardPage extends ConsumerWidget {
  const SupervisorDashboardPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final supervision = session.mobileConfig?.supervision;

    return Scaffold(
      appBar: AppBar(title: const Text('Dashboard')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Daily summary
            const Text('Kunlik xulosa', style: AppTypography.headlineSmall),
            const SizedBox(height: 12),
            const _SummaryGrid(),
            const SizedBox(height: 20),

            // Sales chart placeholder
            const Text('Sotuvlar dinamikasi', style: AppTypography.titleMedium),
            const SizedBox(height: 8),
            Card(
              child: Container(
                height: 180,
                padding: const EdgeInsets.all(16),
                child: _BarChart(),
              ),
            ),
            const SizedBox(height: 20),

            // Checklist section
            const Text('Tekshiruv ro\'yxati', style: AppTypography.titleMedium),
            const SizedBox(height: 8),
            if (supervision != null) ...[
              _ChecklistItem('Chek yuzlari', supervision.checkReceiptFaces, Icons.receipt_long),
              _ChecklistItem('Merchandising', supervision.checkMerchandising, Icons.store),
              _ChecklistItem('Narx tekshiruv', supervision.checkDefaultPrice, Icons.price_check),
              _ChecklistItem('Motivatsiya', supervision.checkMotivation, Icons.star),
              _ChecklistItem('Ombor', supervision.checkStock, Icons.warehouse),
              _ChecklistItem('Sotuvlar', supervision.checkSales, Icons.trending_up),
            ] else
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: Text('Checklist sozlanmagan'),
                ),
              ),
            const SizedBox(height: 20),

            // Route agents — serverdan
            const Text('Agentlar holati', style: AppTypography.titleMedium),
            const SizedBox(height: 8),
            ref.watch(supervisorAgentLocationsProvider).when(
              data: (pins) {
                if (pins.isEmpty) {
                  return const Card(
                    child: Padding(
                      padding: EdgeInsets.all(16),
                      child: Text('Agentlar GPS ma\'lumoti yo\'q'),
                    ),
                  );
                }
                return Column(
                  children: pins.take(8).map((p) {
                    final name = p.agentName ?? 'Agent #${p.agentId}';
                    final status = p.latitude != null ? 'Yo\'lda' : 'Noma\'lum';
                    return _AgentStatusCard(
                      name: name,
                      status: status,
                      visits: 0,
                      orders: 0,
                    );
                  }).toList(),
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (_, __) => const SizedBox.shrink(),
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryGrid extends ConsumerWidget {
  const _SummaryGrid();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(supervisorSummaryProvider);
    return summary.when(
      data: (raw) {
        final kpi = Map<String, dynamic>.from(raw['kpi'] as Map? ?? raw);
        final visitPct = (kpi['visit_pct'] as num?)?.round() ?? 0;
        final planned = kpi['planned_visits'] ?? kpi['visited_total'] ?? 0;
        final orders = kpi['successful_visits'] ?? kpi['visits_with_orders'] ?? 0;
        return Row(
          children: [
            Expanded(child: _SummaryCard('Reja vizit', '$planned', Icons.location_on, AppColors.supervisorAccent)),
            const SizedBox(width: 8),
            Expanded(child: _SummaryCard('Bajarilish', '$visitPct%', Icons.check_circle, AppColors.success)),
            const SizedBox(width: 8),
            Expanded(child: _SummaryCard('Muvaffaqiyat', '$orders', Icons.shopping_bag, AppColors.info)),
          ],
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, __) => const SizedBox.shrink(),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  final String title, value;
  final IconData icon;
  final Color color;
  const _SummaryCard(this.title, this.value, this.icon, this.color);

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(height: 8),
            Text(value, style: AppTypography.headlineMedium.copyWith(color: color)),
            Text(title, style: AppTypography.caption),
          ],
        ),
      ),
    );
  }
}

class _BarChart extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(supervisorSummaryProvider);
    return summary.when(
      data: (raw) {
        final kpi = Map<String, dynamic>.from(raw['kpi'] as Map? ?? {});
        final methods = (kpi['sales_by_payment_method'] as List?)?.cast<Map>() ?? [];
        if (methods.isEmpty) {
          final total = double.tryParse(kpi['total_sales_sum']?.toString() ?? '') ?? 0;
          return Center(
            child: Text(
              total > 0 ? 'Jami savdo: $total' : 'Bugun savdo yo\'q',
              style: AppTypography.bodyMedium,
            ),
          );
        }
        final maxVal = methods.fold<double>(0, (m, row) {
          final v = double.tryParse(row['sum']?.toString() ?? '') ?? 0;
          return v > m ? v : m;
        });
        return Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: methods.take(6).map((row) {
            final m = Map<String, dynamic>.from(row);
            final val = double.tryParse(m['sum']?.toString() ?? '') ?? 0;
            final h = maxVal > 0 ? (val / maxVal) * 120 : 0.0;
            final label = m['method']?.toString() ?? '?';
            return Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Text(val.toStringAsFixed(0), style: const TextStyle(fontSize: 9, color: AppColors.textMuted)),
                    const SizedBox(height: 4),
                    Container(
                      height: h.clamp(8, 120),
                      decoration: BoxDecoration(
                        color: AppColors.supervisorAccent.withValues(alpha: 0.5),
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(label.length > 6 ? '${label.substring(0, 6)}…' : label, style: const TextStyle(fontSize: 9)),
                  ],
                ),
              ),
            );
          }).toList(),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, __) => const Center(child: Text('Ma\'lumot yuklanmadi')),
    );
  }
}

class _ChecklistItem extends StatelessWidget {
  final String label;
  final bool enabled;
  final IconData icon;
  const _ChecklistItem(this.label, this.enabled, this.icon);

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 2),
      child: ListTile(
        dense: true,
        leading: Icon(icon, size: 20, color: enabled ? AppColors.supervisorAccent : AppColors.textDisabled),
        title: Text(label, style: TextStyle(
          fontWeight: FontWeight.w500,
          color: enabled ? AppColors.textPrimary : AppColors.textDisabled,
        ),),
        trailing: enabled
            ? const Icon(Icons.check_circle, color: AppColors.success, size: 20)
            : const Icon(Icons.remove_circle_outline, color: AppColors.textDisabled, size: 20),
      ),
    );
  }
}

class _AgentStatusCard extends StatelessWidget {
  final String name, status;
  final int visits, orders;
  const _AgentStatusCard({required this.name, required this.status, required this.visits, required this.orders});

  @override
  Widget build(BuildContext context) {
    final statusColor = status == 'Yo\'lda' ? AppColors.info :
      status == 'Vizitda' ? AppColors.primary : AppColors.success;

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 3),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(children: [
          CircleAvatar(
            backgroundColor: statusColor.withValues(alpha: 0.1),
            child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?',
                  style: TextStyle(color: statusColor, fontWeight: FontWeight.w700),),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 2),
              Row(children: [
                Text('Vizit: $visits', style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                const SizedBox(width: 12),
                Text('Buyurtma: $orders', style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
              ],),
            ],),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(status, style: TextStyle(fontSize: 11, color: statusColor, fontWeight: FontWeight.w600)),
          ),
        ],),
      ),
    );
  }
}
