import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../agent/orders/order_create_models.dart' show formatMoneySpaced;
import '../expeditor_providers.dart';

/// «Незавершённые заказы» — avvalgi kunlarda boshlangan, lekin hali tugallanmagan
/// (delivered/returned bo'lmagan) eski zakazlar. Dastavchik ularni shu yerdan ochib
/// yakunlaydi; yakunlash tizimda real (joriy) kun bilan yoziladi.
class ExpeditorUnfinishedPage extends ConsumerWidget {
  const ExpeditorUnfinishedPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orders = ref.watch(expeditorVisitsProvider('unfinished'));
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Незавершённые заказы')),
      body: orders.when(
        loading: () => const Center(
            child: CircularProgressIndicator(color: AppColors.expeditorAccent),),
        error: (e, _) => Center(child: Text('Ошибка: $e')),
        data: (rows) {
          if (rows.isEmpty) {
            return RefreshIndicator(
              color: AppColors.expeditorAccent,
              onRefresh: () async =>
                  ref.invalidate(expeditorVisitsProvider('unfinished')),
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  SizedBox(
                    height: MediaQuery.sizeOf(context).height * 0.6,
                    child: AgentEmptyState.fill(
                        message: 'Незавершённых заказов нет',),
                  ),
                ],
              ),
            );
          }
          return RefreshIndicator(
            color: AppColors.expeditorAccent,
            onRefresh: () async =>
                ref.invalidate(expeditorVisitsProvider('unfinished')),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
              itemCount: rows.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) => _UnfinishedCard(
                row: rows[i],
                onTap: () => _open(context, rows[i]),
              ),
            ),
          );
        },
      ),
    );
  }

  void _open(BuildContext context, Map<String, dynamic> row) {
    final clientId = row['client_id'] as int?;
    if (clientId == null) return;
    // readOnly=false — dastavchik yakunlay olsin (status real kun bilan yoziladi).
    context.push('/exp-client/$clientId', extra: {...row});
  }
}

class _UnfinishedCard extends StatelessWidget {
  final Map<String, dynamic> row;
  final VoidCallback onTap;

  const _UnfinishedCard({required this.row, required this.onTap});

  static (String, Color) _statusInfo(String status) {
    switch (status) {
      case 'picking':
        return ('Сборка', AppColors.warning);
      case 'delivering':
        return ('В пути', AppColors.expeditorAccent);
      default:
        return ('Не завершён', AppColors.textMuted);
    }
  }

  @override
  Widget build(BuildContext context) {
    final name = row['client_name']?.toString() ?? '—';
    final orderNum = row['order_number']?.toString();
    final subtitle = row['address']?.toString() ??
        (orderNum != null ? '№ $orderNum' : '');
    final orderSum = (row['total_sum'] as num?)?.toDouble() ?? 0;
    final (label, color) = _statusInfo(row['status']?.toString() ?? '');

    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceVariant,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.storefront_outlined,
                        color: AppColors.textSecondary, size: 22,),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                                color: AppColors.textHeadline,),),
                        if (subtitle.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(subtitle,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTypography.caption
                                  .copyWith(color: AppColors.textMuted),),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 5,),
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.schedule, size: 14, color: color),
                        const SizedBox(width: 6),
                        Text(label,
                            style: TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w700,
                                color: color,),),
                      ],
                    ),
                  ),
                  Text("${formatMoneySpaced(orderSum)} So'm",
                      style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: AppColors.expeditorAccent,),),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
