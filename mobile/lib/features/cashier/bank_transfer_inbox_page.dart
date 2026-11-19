import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_exceptions.dart';
import '../../../core/auth/session.dart';
import '../../../core/format/money_display.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import 'bank_transfer_inbox_providers.dart';

/// Inbox ro‘yxati — tablar: unmatched / ambiguous / pending / …
class BankTransferInboxPage extends ConsumerWidget {
  const BankTransferInboxPage({super.key});

  String _errMsg(Object e) => e is ApiException ? e.message : '$e';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final perms = ref.watch(sessionProvider).permissions;
    final tab = ref.watch(btiSelectedTabProvider);
    final channel = ref.watch(btiSelectedChannelProvider);
    final counts = ref.watch(btiCountsProvider).valueOrNull ?? {};
    final listAsync = ref.watch(btiListProvider(tab));
    const accent = AppColors.cashierAccent;

    if (!perms.canViewBankTransfers) {
      return Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          title: const Text('Перечисления (банк)'),
          backgroundColor: AppColors.surface,
          foregroundColor: AppColors.textTitle,
          elevation: 0,
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.lock_outline, size: 48, color: AppColors.textMuted),
                const SizedBox(height: 12),
                Text(
                  'Нет доступа',
                  style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                Text(
                  'Нужно право cash.perechisleniya.view. Обратитесь к администратору.',
                  textAlign: TextAlign.center,
                  style: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Перечисления (банк)'),
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.textTitle,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.invalidate(btiCountsProvider);
              ref.invalidate(btiListProvider(tab));
            },
          ),
        ],
      ),
      body: Column(
        children: [
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
              children: [
                for (final c in btiChannels)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(c.label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                      selected: channel == c.key,
                      selectedColor: accent.withValues(alpha: 0.22),
                      onSelected: (_) {
                        ref.read(btiSelectedChannelProvider.notifier).state = c.key;
                        ref.read(btiSelectedTabProvider.notifier).state =
                            c.key == 'manual' ? 'pending' : 'unmatched';
                      },
                    ),
                  ),
              ],
            ),
          ),
          SizedBox(
            height: 48,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              children: [
                for (final t in btiTabs)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(
                        '${t.label}${counts[t.key] != null ? ' (${counts[t.key]})' : ''}',
                        style: const TextStyle(fontSize: 12),
                      ),
                      selected: tab == t.key,
                      selectedColor: accent.withValues(alpha: 0.18),
                      onSelected: (_) {
                        ref.read(btiSelectedTabProvider.notifier).state = t.key;
                      },
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: listAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) {
                final msg = _errMsg(e);
                final forbidden = e is ForbiddenException ||
                    (e is ApiException && e.statusCode == 403);
                return Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          forbidden ? Icons.lock_outline : Icons.error_outline,
                          size: 48,
                          color: forbidden ? AppColors.textMuted : AppColors.error,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          forbidden
                              ? 'Нет права cash.perechisleniya.view'
                              : msg,
                          textAlign: TextAlign.center,
                          style: AppTypography.bodyMedium,
                        ),
                        const SizedBox(height: 16),
                        OutlinedButton(
                          onPressed: () {
                            ref.invalidate(btiCountsProvider);
                            ref.invalidate(btiListProvider(tab));
                          },
                          child: const Text('Повторить'),
                        ),
                      ],
                    ),
                  ),
                );
              },
              data: (result) {
                if (result.items.isEmpty) {
                  String? tabLabel;
                  for (final t in btiTabs) {
                    if (t.key == tab) {
                      tabLabel = t.label;
                      break;
                    }
                  }
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(32),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.inbox_outlined,
                            size: 48,
                            color: AppColors.textMuted,
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'Нет записей',
                            style: AppTypography.titleMedium
                                .copyWith(fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            tabLabel != null
                                ? 'В разделе «$tabLabel» пока пусто.\nИмпорт CSV — в веб-панели.'
                                : 'Список пуст. Импорт CSV — в веб-панели.',
                            textAlign: TextAlign.center,
                            style: AppTypography.bodyMedium
                                .copyWith(color: AppColors.textMuted),
                          ),
                        ],
                      ),
                    ),
                  );
                }
                return RefreshIndicator(
                  onRefresh: () async {
                    ref.invalidate(btiCountsProvider);
                    ref.invalidate(btiListProvider(tab));
                    await ref.read(btiListProvider(tab).future);
                  },
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(12, 4, 12, 24),
                    itemCount: result.items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (ctx, i) {
                      final row = result.items[i];
                      final id = (row['id'] as num?)?.toInt() ?? 0;
                      final amount = (row['amount'] as num?)?.toDouble() ?? 0;
                      final currency = row['currency']?.toString() ?? 'UZS';
                      final payer = row['payer_name']?.toString().trim();
                      final inn = row['payer_inn']?.toString().trim();
                      final status = row['status']?.toString();
                      final channelBadge = btiChannelBadge(row);
                      final client = row['assigned_client'];
                      String? clientName;
                      if (client is Map) {
                        clientName = client['name']?.toString();
                      }
                      return Material(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(12),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(12),
                          onTap: id > 0
                              ? () => context.push('/bank-transfers/$id')
                              : null,
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        '${formatMoneySpaced(amount)} $currency',
                                        style: AppTypography.titleMedium
                                            .copyWith(fontWeight: FontWeight.w800),
                                      ),
                                    ),
                                    Text(
                                      btiStatusLabel(status),
                                      style: AppTypography.caption.copyWith(color: accent),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: btiChannelKey(row) == 'manual'
                                        ? const Color(0xFFFFF7ED)
                                        : const Color(0xFFF0F9FF),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    channelBadge,
                                    style: AppTypography.caption.copyWith(
                                      fontWeight: FontWeight.w700,
                                      color: btiChannelKey(row) == 'manual'
                                          ? const Color(0xFF9A3412)
                                          : const Color(0xFF075985),
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  payer?.isNotEmpty == true ? payer! : 'Плательщик не указан',
                                  style: AppTypography.bodyMedium,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                if (inn != null && inn.isNotEmpty) ...[
                                  const SizedBox(height: 2),
                                  Text(
                                    'ИНН: $inn',
                                    style: AppTypography.caption
                                        .copyWith(color: AppColors.textMuted),
                                  ),
                                ],
                                if (clientName != null && clientName.isNotEmpty) ...[
                                  const SizedBox(height: 4),
                                  Text(
                                    'Клиент: $clientName',
                                    style: AppTypography.caption
                                        .copyWith(color: AppColors.textSecondary),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
