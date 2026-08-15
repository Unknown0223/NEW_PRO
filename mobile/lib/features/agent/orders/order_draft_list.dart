import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/database/app_database.dart';
import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import 'order_draft_model.dart';
import 'order_draft_provider.dart';
import 'order_draft_ui.dart';

Future<void> openOrderDraft(BuildContext context, WidgetRef ref, OrderDraftListEntry entry) async {
  final client = await AppDatabase().getClientById(entry.draft.clientId);
  if (!context.mounted) return;
  await context.push(
    '/orders/create?client_id=${entry.draft.clientId}',
    extra: client != null ? Map<String, dynamic>.from(client) : null,
  );
  ref.invalidate(orderDraftsProvider);
  ref.invalidate(orderDraftListProvider);
  ref.invalidate(orderDraftForClientProvider(entry.draft.clientId));
}

Future<void> deleteOrderDraftEntry(BuildContext context, WidgetRef ref, OrderDraft draft) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Отменить черновик'),
      content: const Text('Удалить сохранённый черновик заказа?'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Отмена')),
        FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Удалить')),
      ],
    ),
  );
  if (ok != true || !context.mounted) return;
  await ref.read(orderDraftRepositoryProvider).delete(draft.clientId);
  ref.invalidate(orderDraftsProvider);
  ref.invalidate(orderDraftListProvider);
  ref.invalidate(orderDraftForClientProvider(draft.clientId));
  if (context.mounted) {
    showAgentToast(context, 'Черновик удалён', accentColor: AppColors.success);
  }
}

Future<void> showOrderDraftOptions(
  BuildContext context,
  WidgetRef ref,
  OrderDraftListEntry entry,
) async {
  final action = await showOrderDraftOptionsSheet(context);
  if (!context.mounted || action == null) return;
  switch (action) {
    case 'edit':
      await openOrderDraft(context, ref, entry);
    case 'comment':
      if (context.mounted) {
        showAgentToast(context, 'Комментарий — при редактировании заказа', accentColor: AppColors.warning);
      }
    case 'delete':
      await deleteOrderDraftEntry(context, ref, entry.draft);
  }
}

class OrderDraftListSection extends ConsumerWidget {
  final EdgeInsetsGeometry padding;
  final bool shrinkWrap;
  final ScrollPhysics? physics;

  const OrderDraftListSection({
    super.key,
    this.padding = const EdgeInsets.fromLTRB(12, 0, 12, 0),
    this.shrinkWrap = false,
    this.physics,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final draftsAsync = ref.watch(orderDraftListProvider);
    return draftsAsync.when(
      data: (entries) {
        if (entries.isEmpty) return const SizedBox.shrink();
        return Padding(
          padding: padding,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  '${S.draft} (${entries.length})',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.textSecondary),
                ),
              ),
              ListView.separated(
                shrinkWrap: shrinkWrap,
                physics: physics ?? (shrinkWrap ? const NeverScrollableScrollPhysics() : null),
                itemCount: entries.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (context, index) {
                  final entry = entries[index];
                  return OrderDraftClientCard(
                    draft: entry.draft,
                    clientName: entry.clientName,
                    onTap: () => openOrderDraft(context, ref, entry),
                    onOptions: () => showOrderDraftOptions(context, ref, entry),
                  );
                },
              ),
            ],
          ),
        );
      },
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
    );
  }
}

class OrderDraftPageBody extends ConsumerWidget {
  const OrderDraftPageBody({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final draftsAsync = ref.watch(orderDraftListProvider);
    return draftsAsync.when(
      data: (entries) {
        if (entries.isEmpty) {
          return AgentEmptyState.fill(message: S.emptyDraft);
        }
        return RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async {
            ref.invalidate(orderDraftsProvider);
            ref.invalidate(orderDraftListProvider);
            await ref.read(orderDraftListProvider.future);
          },
          child: ListView.separated(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
            itemCount: entries.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, index) {
              final entry = entries[index];
              return OrderDraftClientCard(
                draft: entry.draft,
                clientName: entry.clientName,
                onTap: () => openOrderDraft(context, ref, entry),
                onOptions: () => showOrderDraftOptions(context, ref, entry),
              );
            },
          ),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
      error: (e, _) => Center(child: Text('Ошибка: $e', textAlign: TextAlign.center)),
    );
  }
}
