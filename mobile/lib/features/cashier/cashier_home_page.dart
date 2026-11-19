import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/session.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import 'bank_transfer_inbox_providers.dart';

/// Kassir home — Bank Transfer Inbox kirish nuqtasi.
class CashierHomePage extends ConsumerWidget {
  const CashierHomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(sessionProvider).user;
    final countsAsync = ref.watch(btiCountsProvider);
    final name = (user?.name ?? '').trim();
    const accent = AppColors.cashierAccent;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Касса'),
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.textTitle,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.person_outline),
            onPressed: () => context.go('/profile'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        children: [
          Text(
            name.isEmpty ? 'Кассир' : name,
            style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 4),
          Text(
            'Банковские переводы — назначение клиента',
            style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
          ),
          const SizedBox(height: 16),
          Material(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: () => context.go('/bank-transfers'),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: accent.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.account_balance_outlined, color: accent),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Перечисления (банк)',
                            style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 4),
                          countsAsync.when(
                            data: (c) {
                              final open = (c['unmatched'] ?? 0) +
                                  (c['ambiguous'] ?? 0) +
                                  (c['pending'] ?? 0);
                              return Text(
                                open > 0 ? 'Открытых: $open' : 'Нет открытых записей',
                                style: AppTypography.caption.copyWith(color: AppColors.textMuted),
                              );
                            },
                            loading: () => Text(
                              'Загрузка…',
                              style: AppTypography.caption.copyWith(color: AppColors.textMuted),
                            ),
                            error: (_, __) => Text(
                              'Открыть inbox',
                              style: AppTypography.caption.copyWith(color: AppColors.textMuted),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right, color: AppColors.textMuted),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Назначение и подтверждение pending-оплаты — в карточке перевода. '
            'Импорт CSV/Excel — только в веб-панели.',
            style: AppTypography.caption.copyWith(color: AppColors.textMuted),
          ),
        ],
      ),
    );
  }
}
