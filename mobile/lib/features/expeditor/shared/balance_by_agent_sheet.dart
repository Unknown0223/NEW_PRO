import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';
import '../../agent/orders/order_create_models.dart' show formatMoneySpaced;
import '../expeditor_providers.dart';

/// «Баланс по агенту» sheetni ochadi (Визиты va Должники uchun umumiy).
Future<void> showBalanceByAgentSheet(
  BuildContext context, {
  required int? clientId,
  required double fallbackTotal,
}) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
    ),
    builder: (_) => BalanceByAgentSheet(
      clientId: clientId,
      fallbackTotal: fallbackTotal,
    ),
  );
}

/// «Баланс по агенту» — agent (owner) va to'lov usuli bo'yicha kengayadigan sheet.
class BalanceByAgentSheet extends ConsumerStatefulWidget {
  final int? clientId;
  final double fallbackTotal;

  const BalanceByAgentSheet({
    super.key,
    required this.clientId,
    required this.fallbackTotal,
  });

  @override
  ConsumerState<BalanceByAgentSheet> createState() =>
      _BalanceByAgentSheetState();
}

class _BalanceByAgentSheetState extends ConsumerState<BalanceByAgentSheet> {
  final _expanded = <int>{};

  Color _balColor(double v) =>
      v < -0.01 ? AppColors.error : AppColors.success;

  @override
  Widget build(BuildContext context) {
    final detail = widget.clientId == null
        ? null
        : ref.watch(expeditorClientBalanceDetailProvider(widget.clientId!));

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const AgentSheetHandle(),
            const SizedBox(height: 6),
            Stack(
              alignment: Alignment.center,
              children: [
                const Text('Баланс по агенту',
                    style:
                        TextStyle(fontSize: 16, fontWeight: FontWeight.w800),),
                Align(
                  alignment: Alignment.centerRight,
                  child: IconButton(
                    icon: const Icon(Icons.close, color: AppColors.textMuted),
                    onPressed: () => Navigator.pop(context),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (detail == null)
              _totalBox(widget.fallbackTotal)
            else
              detail.when(
                data: (d) => _content(d),
                loading: () => const Padding(
                  padding: EdgeInsets.symmetric(vertical: 32),
                  child: Center(
                      child: CircularProgressIndicator(
                          color: AppColors.expeditorAccent,),),
                ),
                error: (_, __) => _totalBox(widget.fallbackTotal),
              ),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: FilledButton.tonal(
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.surfaceVariant,
                  foregroundColor: AppColors.textSecondary,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                onPressed: () => Navigator.pop(context),
                child: const Text('Закрыть',
                    style: TextStyle(fontWeight: FontWeight.w700),),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _totalBox(double total) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.background,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Общий баланс',
                style:
                    TextStyle(fontSize: 14, color: AppColors.textSecondary),),
            Text(
              '${formatMoneySpaced(total)} UZS',
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: _balColor(total),),
            ),
          ],
        ),
      );

  Widget _content(Map<String, dynamic> d) {
    final total = (d['total_balance'] as num?)?.toDouble() ?? 0;
    final owners = (d['owners'] as List?) ?? const [];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _totalBox(total),
        const SizedBox(height: 12),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Row(
            children: [
              Expanded(
                child: Text('Агенты',
                    style: AppTypography.caption
                        .copyWith(color: AppColors.textMuted),),
              ),
              Text('Сумма',
                  style: AppTypography.caption
                      .copyWith(color: AppColors.textMuted),),
            ],
          ),
        ),
        const SizedBox(height: 6),
        if (owners.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 18),
            child: Text('Нет данных по агентам',
                textAlign: TextAlign.center,
                style: AppTypography.caption
                    .copyWith(color: AppColors.textMuted),),
          )
        else
          ConstrainedBox(
            constraints: BoxConstraints(
                maxHeight: MediaQuery.sizeOf(context).height * 0.45,),
            child: SingleChildScrollView(
              child: Column(
                children: [
                  for (var i = 0; i < owners.length; i++)
                    _ownerTile(
                        i, Map<String, dynamic>.from(owners[i] as Map),),
                ],
              ),
            ),
          ),
      ],
    );
  }

  Widget _ownerTile(int index, Map<String, dynamic> o) {
    final owner = Map<String, dynamic>.from(o['owner'] as Map? ?? {});
    final name = owner['name']?.toString() ?? '—';
    final bal = (o['total_balance'] as num?)?.toDouble() ?? 0;
    final methods = (o['payment_methods'] as List?) ?? const [];
    final open = _expanded.contains(index);
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(10),
            onTap: methods.isEmpty
                ? null
                : () => setState(() {
                      if (open) {
                        _expanded.remove(index);
                      } else {
                        _expanded.add(index);
                      }
                    }),
            child: Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              child: Row(
                children: [
                  Icon(
                    methods.isEmpty
                        ? Icons.remove
                        : (open
                            ? Icons.keyboard_arrow_up
                            : Icons.keyboard_arrow_down),
                    size: 18,
                    color: AppColors.expeditorAccent,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(name,
                        style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: AppColors.expeditorAccent,),),
                  ),
                  const SizedBox(width: 8),
                  Text('${formatMoneySpaced(bal)} UZS',
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: _balColor(bal),),),
                ],
              ),
            ),
          ),
          if (open)
            ...methods.map((m) {
              final mm = Map<String, dynamic>.from(m as Map);
              final mName = mm['name']?.toString() ?? '—';
              final mBal = (mm['balance'] as num?)?.toDouble() ?? 0;
              return Padding(
                padding: const EdgeInsets.fromLTRB(38, 0, 12, 10),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(mName,
                          style: AppTypography.caption
                              .copyWith(color: AppColors.textSecondary),),
                    ),
                    Text("${formatMoneySpaced(mBal)} So'm",
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: _balColor(mBal),),),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}
