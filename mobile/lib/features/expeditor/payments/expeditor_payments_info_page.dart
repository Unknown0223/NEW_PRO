import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../agent/orders/order_create_models.dart' show formatMoneyUz;
import '../expeditor_status_labels.dart';
import '../expeditor_providers.dart';

class ExpeditorPaymentsInfoPage extends ConsumerStatefulWidget {
  const ExpeditorPaymentsInfoPage({super.key});

  @override
  ConsumerState<ExpeditorPaymentsInfoPage> createState() => _ExpeditorPaymentsInfoPageState();
}

class _ExpeditorPaymentsInfoPageState extends ConsumerState<ExpeditorPaymentsInfoPage> with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 2, vsync: this);

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final groupBy = _tabs.index == 0 ? 'list' : 'clients';
    final data = ref.watch(expeditorPaymentsSummaryProvider(groupBy));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Оплаты'),
        bottom: TabBar(
          controller: _tabs,
          onTap: (_) => setState(() {}),
          labelColor: AppColors.expeditorAccent,
          unselectedLabelColor: AppColors.textSecondary,
          indicatorColor: AppColors.expeditorAccent,
          tabs: const [
            Tab(text: 'Список оплат'),
            Tab(text: 'По клиентам'),
          ],
        ),
      ),
      body: data.when(
        data: (payload) {
          final rows = (payload['data'] as List?) ?? [];
          if (rows.isEmpty) {
            return Center(child: AgentEmptyState.fill(message: 'Пока здесь пусто'));
          }
          if (groupBy == 'list') {
            return ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: rows.length,
              itemBuilder: (_, i) {
                final p = Map<String, dynamic>.from(rows[i] as Map);
                final wf = p['workflow_status']?.toString() ?? 'confirmed';
                final paid = p['paid_at']?.toString() ?? p['received_at']?.toString();
                final dt = paid != null ? DateTime.tryParse(paid) : null;
                final isPending = expeditorPaymentIsPending(wf);
                return Card(
                  margin: const EdgeInsets.only(bottom: 6),
                  child: ListTile(
                    title: Text('${p['client_name'] ?? ''} — #${p['order_number'] ?? ''}'),
                    subtitle: Text(
                      [
                        if (dt != null) DateFormat('dd.MM.yyyy HH:mm').format(dt.toLocal()),
                        expeditorPaymentWorkflowLabel(wf),
                      ].where((s) => s.isNotEmpty).join(' · '),
                    ),
                    trailing: Text(
                      formatMoneyUz((p['amount'] as num?)?.toDouble() ?? 0),
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: isPending ? AppColors.warning : AppColors.success,
                      ),
                    ),
                  ),
                );
              },
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: rows.length,
            itemBuilder: (_, i) {
              final c = Map<String, dynamic>.from(rows[i] as Map);
              return Card(
                margin: const EdgeInsets.only(bottom: 6),
                child: ListTile(
                  title: Text(c['client_name']?.toString() ?? '—'),
                  trailing: Text(
                    formatMoneyUz((c['total'] as num?)?.toDouble() ?? 0),
                    style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.success),
                  ),
                  subtitle: Text('Платежей: ${(c['payments'] as List?)?.length ?? 0}'),
                ),
              );
            },
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Ошибка: $e')),
      ),
    );
  }
}
