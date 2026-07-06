import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';
import 'order_create_models.dart';
import 'order_draft_model.dart';

/// Chiqishda chernovikni saqlash dialogi.
Future<bool?> showOrderDraftExitDialog(BuildContext context) {
  return showDialog<bool>(
    context: context,
    barrierDismissible: false,
    builder: (ctx) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      contentPadding: const EdgeInsets.fromLTRB(24, 28, 24, 8),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: const BoxDecoration(color: Color(0xFFFF9800), shape: BoxShape.circle),
            child: const Icon(Icons.priority_high, color: Colors.white, size: 32),
          ),
          const SizedBox(height: 16),
          Text(
            S.orderExitTitle,
            textAlign: TextAlign.center,
            style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Text(
            S.orderExitSubtitle,
            textAlign: TextAlign.center,
            style: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted),
          ),
        ],
      ),
      actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      actions: [
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFFF9800),
              minimumSize: const Size.fromHeight(48),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text(S.orderExitSave),
          ),
        ),
        const SizedBox(height: 8),
        SizedBox(
          width: double.infinity,
          child: TextButton(
            style: TextButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
              backgroundColor: const Color(0xFFF1F5F9),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text(S.orderExitDiscard, style: TextStyle(color: AppColors.textPrimary)),
          ),
        ),
      ],
    ),
  );
}

/// Mijoz sarlavhasi / ro‘yxat kartasi — o‘ng yuqori chernovik belgisi.
class OrderDraftHeaderBadge extends StatelessWidget {
  final OrderDraft draft;
  final VoidCallback? onExpired;

  const OrderDraftHeaderBadge({super.key, required this.draft, this.onExpired});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4),
      child: OrderDraftListBadge(draft: draft, onExpired: onExpired),
    );
  }
}

/// Ro'yxatda chernovik belgisi + taymer.
class OrderDraftListBadge extends StatefulWidget {
  final OrderDraft draft;
  final VoidCallback? onExpired;

  const OrderDraftListBadge({super.key, required this.draft, this.onExpired});

  @override
  State<OrderDraftListBadge> createState() => _OrderDraftListBadgeState();
}

class _OrderDraftListBadgeState extends State<OrderDraftListBadge> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      if (widget.draft.isExpired) {
        widget.onExpired?.call();
        _timer?.cancel();
        return;
      }
      setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final remaining = widget.draft.remaining;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.description_outlined, size: 20, color: Color(0xFFFF9800)),
        const SizedBox(height: 2),
        Text(
          formatDraftCountdown(remaining),
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: Color(0xFFFF9800),
            fontFeatures: [FontFeature.tabularFigures()],
          ),
        ),
      ],
    );
  }
}

/// Taymer matni — har soniyada yangilanadi.
class OrderDraftCountdownText extends StatefulWidget {
  final DateTime expiresAt;
  final TextStyle style;
  final VoidCallback? onExpired;

  const OrderDraftCountdownText({
    super.key,
    required this.expiresAt,
    required this.style,
    this.onExpired,
  });

  @override
  State<OrderDraftCountdownText> createState() => _OrderDraftCountdownTextState();
}

class _OrderDraftCountdownTextState extends State<OrderDraftCountdownText> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      final remaining = widget.expiresAt.difference(DateTime.now());
      if (remaining.isNegative) {
        widget.onExpired?.call();
        _timer?.cancel();
      }
      setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final remaining = widget.expiresAt.difference(DateTime.now());
    return Text(formatDraftCountdown(remaining), style: widget.style);
  }
}

/// Mijoz kartasidagi chernovik bloki.
class OrderDraftClientCard extends StatelessWidget {
  final OrderDraft draft;
  final VoidCallback? onTap;
  final VoidCallback? onOptions;

  const OrderDraftClientCard({
    super.key,
    required this.draft,
    this.onTap,
    this.onOptions,
  });

  @override
  Widget build(BuildContext context) {
    return AgentSurfaceCard(
      padding: EdgeInsets.zero,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.description_outlined, size: 20, color: Color(0xFFFF9800)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '${S.draft} в ${formatDraftSavedAt(draft.savedAt)}',
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                    ),
                  ),
                  OrderDraftCountdownText(
                    expiresAt: draft.expiresAt,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFFFF9800),
                    ),
                  ),
                  if (onOptions != null) ...[
                    const SizedBox(width: 4),
                    IconButton(
                      visualDensity: VisualDensity.compact,
                      icon: const Icon(Icons.more_horiz, color: AppColors.textSecondary),
                      onPressed: onOptions,
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 10),
              _row(S.orderPriceType, draft.priceType.isEmpty ? '—' : draft.priceType),
              _row('Бонус', '—'),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(child: _statBox('Объем', _fmtVol(draft.totalVolume))),
                  const SizedBox(width: 8),
                  Expanded(child: _statBox('Количество', draft.totalQty.round().toString())),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _statBox(
                      'Сумма',
                      formatOrderMoney(draft.totalSum),
                      valueColor: AppColors.agentAccent,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  static String _fmtVol(double v) {
    if (v <= 0) return '0';
    final s = v.toStringAsFixed(1).replaceAll('.', ',');
    return s;
  }

  Widget _row(String label, String value) => Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Row(
          children: [
            Text('$label: ', style: AppTypography.bodySmall.copyWith(color: AppColors.textMuted)),
            Expanded(
              child: Text(value, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
            ),
          ],
        ),
      );

  Widget _statBox(String label, String value, {Color? valueColor}) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: AppTypography.caption.copyWith(color: AppColors.textMuted)),
            const SizedBox(height: 4),
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: valueColor ?? AppColors.textPrimary,
              ),
            ),
          ],
        ),
      );
}

/// Chernovik ma'lumotlari — pastki sheet.
Future<void> showOrderDraftDataSheet(
  BuildContext context, {
  required OrderDraft draft,
  required List<Map<String, dynamic>> productNames,
  VoidCallback? onEdit,
  VoidCallback? onDelete,
}) {
  final grouped = <String, List<MapEntry<int, double>>>{};
  final byId = <int, Map<String, dynamic>>{};
  for (final p in productNames) {
    final id = (p['id'] as num?)?.toInt();
    if (id != null) byId[id] = p;
  }
  for (final e in draft.quantities.entries) {
    if (e.value <= 0) continue;
    final product = byId[e.key];
    String catName = S.noCategory;
    final cat = product?['category'];
    if (cat is Map) {
      final n = cat['name']?.toString().trim();
      if (n != null && n.isNotEmpty) catName = n;
    }
    grouped.putIfAbsent(catName, () => []).add(e);
  }

  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.4,
      maxChildSize: 0.92,
      builder: (_, scrollCtrl) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            const AgentSheetHandle(),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Данные заказа',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                    ),
                  ),
                  IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                controller: scrollCtrl,
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                children: [
                  const Text('Общие данные', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                  const SizedBox(height: 8),
                  _dataTile(S.orderPriceType, draft.priceType.isEmpty ? '—' : draft.priceType),
                  _dataTile(S.orderWarehouse, draft.warehouseName.isEmpty ? '—' : draft.warehouseName),
                  _dataTile('Бонус', '—'),
                  _dataTile('Дата создание', formatDraftSavedAt(draft.savedAt)),
                  const SizedBox(height: 16),
                  const Text('Заказанные товары', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                  const SizedBox(height: 8),
                  ...grouped.entries.map((g) => ExpansionTile(
                        tilePadding: EdgeInsets.zero,
                        title: Text(g.key, style: const TextStyle(fontWeight: FontWeight.w600)),
                        children: g.value.map((e) {
                          final product = byId[e.key];
                          final name = product?['name']?.toString() ?? '#${e.key}';
                          return ListTile(
                            dense: true,
                            title: Text(name),
                            trailing: Text('${e.value.toStringAsFixed(0)} ${S.unitPcs}'),
                          );
                        }).toList(),
                      ),),
                  const SizedBox(height: 8),
                  _dataTile('Общий объем', OrderDraftClientCard._fmtVol(draft.totalVolume)),
                  _dataTile('Общая сумма', '${draft.totalQty.round()}'),
                  _dataTile(S.total, formatOrderMoney(draft.totalSum)),
                ],
              ),
            ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text(S.close),
                      ),
                    ),
                    if (onEdit != null || onDelete != null) ...[
                      const SizedBox(width: 8),
                      PopupMenuButton<String>(
                        icon: const Icon(Icons.more_vert),
                        onSelected: (v) {
                          Navigator.pop(ctx);
                          if (v == 'edit') onEdit?.call();
                          if (v == 'delete') onDelete?.call();
                        },
                        itemBuilder: (_) => [
                          if (onEdit != null)
                            const PopupMenuItem(value: 'edit', child: Text('Редактировать')),
                          if (onDelete != null)
                            const PopupMenuItem(value: 'delete', child: Text('Отменить')),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

Widget _dataTile(String label, String value) => Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Expanded(child: Text(label, style: const TextStyle(color: AppColors.textMuted))),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );

/// Chernovik opsiyalari.
Future<String?> showOrderDraftOptionsSheet(BuildContext context) {
  return showModalBottomSheet<String>(
    context: context,
    backgroundColor: Colors.transparent,
    builder: (ctx) => Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const AgentSheetHandle(),
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Text('Опции', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            ),
            ListTile(
              leading: const Icon(Icons.edit_outlined),
              title: const Text('Редактировать'),
              onTap: () => Navigator.pop(ctx, 'edit'),
            ),
            ListTile(
              leading: const Icon(Icons.chat_bubble_outline),
              title: const Text('Комментарий'),
              onTap: () => Navigator.pop(ctx, 'comment'),
            ),
            ListTile(
              leading: const Icon(Icons.close, color: AppColors.error),
              title: const Text('Отменить', style: TextStyle(color: AppColors.error)),
              onTap: () => Navigator.pop(ctx, 'delete'),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    ),
  );
}

void showOrderDraftSavedToast(BuildContext context) {
  showAgentToast(context, S.orderDraftSaved, accentColor: AppColors.success);
}
