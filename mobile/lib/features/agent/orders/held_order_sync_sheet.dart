import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format/money_display.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';
import 'held_order_model.dart';
import 'held_orders_provider.dart';

/// Post-visit auto-sync timer (design screen 30).
Future<HeldOrderSyncAction?> showHeldOrderSyncSheet(
  BuildContext context, {
  required HeldOrder order,
  int? delayMinutes,
}) {
  return showModalBottomSheet<HeldOrderSyncAction>(
    context: context,
    isScrollControlled: true,
    useRootNavigator: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => HeldOrderSyncSheet(
      orderId: order.id,
      delayMinutes: delayMinutes ??
          order.submitAt.difference(order.createdAt).inMinutes.clamp(1, 59),
    ),
  );
}

enum HeldOrderSyncAction { edit, sent, dismissed }

class HeldOrderSyncSheet extends ConsumerStatefulWidget {
  final int orderId;
  final int delayMinutes;

  const HeldOrderSyncSheet({
    super.key,
    required this.orderId,
    required this.delayMinutes,
  });

  @override
  ConsumerState<HeldOrderSyncSheet> createState() => _HeldOrderSyncSheetState();
}

class _HeldOrderSyncSheetState extends ConsumerState<HeldOrderSyncSheet> {
  bool _sending = false;
  bool _didClose = false;
  HeldOrder? _lastOrder;

  /// Faqat modal bottom sheet route ni yopadi — go_router sahifasiga tegmaydi.
  void _closeSheet(HeldOrderSyncAction action) {
    if (_didClose || !mounted) return;
    final route = ModalRoute.of(context);
    if (route is! ModalBottomSheetRoute) return;
    _didClose = true;
    Navigator.pop(context, action);
  }

  Future<void> _sendNow(HeldOrder order) async {
    if (_sending || _didClose) return;
    setState(() {
      _sending = true;
      _lastOrder = order;
    });
    try {
      await ref.read(heldOrderSchedulerProvider).submitNow(order.id);
      if (!mounted) return;
      _closeSheet(HeldOrderSyncAction.sent);
    } catch (_) {
      if (!mounted || _didClose) return;
      setState(() => _sending = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Не удалось отправить заказ')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(heldOrderTickProvider);

    // Timer tugaganda (yoki submitNow) zakaz navbatdan chiqsa — sheet ni yopish.
    // Build ichida pop qilmaymiz; listen orqali.
    ref.listen<AsyncValue<List<HeldOrder>>>(heldOrdersProvider, (prev, next) {
      if (_didClose || _sending) return;
      final list = next.valueOrNull;
      if (list == null) return;
      final stillThere = list.any((h) => h.id == widget.orderId);
      if (!stillThere) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _closeSheet(HeldOrderSyncAction.sent);
        });
      }
    });

    final async = ref.watch(heldOrdersProvider);
    final orders = async.valueOrNull ?? const <HeldOrder>[];
    HeldOrder? order;
    for (final h in orders) {
      if (h.id == widget.orderId) {
        order = h;
        break;
      }
    }
    order ??= _lastOrder;

    if (order == null) {
      return const SizedBox(
        height: 120,
        child: Center(child: CircularProgressIndicator()),
      );
    }
    final current = order;
    _lastOrder = current;

    final remaining = current.remaining();
    final countdown = formatHeldCountdown(remaining);
    final totalWindow = current.submitAt.difference(current.createdAt);
    final totalMs = totalWindow.inMilliseconds <= 0 ? 1 : totalWindow.inMilliseconds;
    final leftMs = remaining.inMilliseconds.clamp(0, totalMs);
    final progress = _sending ? 0.0 : (leftMs / totalMs).clamp(0.0, 1.0);
    final delayLabel = '${widget.delayMinutes} мин';

    final bottom = MediaQuery.paddingOf(context).bottom;

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.fromLTRB(16, 8, 16, 12 + bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const AgentSheetHandle(),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Expanded(
                child: Text(
                  'Заказ ожидает синхронизацию',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                    height: 1.25,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFEDD5),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  delayLabel,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFFC2410C),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '#${current.id} · ${current.clientName}',
            style: AppTypography.bodySmall.copyWith(color: AppColors.textMuted),
          ),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _CountdownRing(progress: progress, countdown: countdown),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Редактировка ойнаси очиқ',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Визит тугади. Агар товар, бонус ёки скидкада хато бўлса, '
                      '${widget.delayMinutes} дақиқа ичида тузатинг.',
                      style: AppTypography.caption.copyWith(
                        color: AppColors.textMuted,
                        height: 1.35,
                      ),
                    ),
                    const SizedBox(height: 10),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(99),
                      child: LinearProgressIndicator(
                        value: progress,
                        minHeight: 6,
                        backgroundColor: const Color(0xFFE5E7EB),
                        color: AppColors.warning,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFFFFBEB),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFFCD34D)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.info_outline, size: 20, color: Color(0xFFD97706)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Агар $countdown ичида ўзгартиш киритилмаса, заказ автоматик '
                    'синхрон қилиниб серверга юборилади.',
                    style: AppTypography.caption.copyWith(
                      color: const Color(0xFF92400E),
                      height: 1.35,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _MiniStatCard(
                  bg: AppColors.bonusBg,
                  border: AppColors.bonusBg2,
                  icon: '🎁',
                  label: current.bonusLabel,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _MiniStatCard(
                  bg: AppColors.discBg,
                  border: AppColors.discBg2,
                  icon: '🎟',
                  label: current.discountLabel,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _MiniStatCard(
                  bg: const Color(0xFFEEF2FF),
                  border: const Color(0xFFC7D2FE),
                  icon: null,
                  label: 'сумма ${formatHeldSumCompact(current.estimatedTotal)}',
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          AgentPrimaryButton(
            label: 'Редактировать',
            height: 48,
            onPressed: _sending
                ? null
                : () => _closeSheet(HeldOrderSyncAction.edit),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: OutlinedButton(
              onPressed: _sending ? null : () => _sendNow(current),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primary,
                side: const BorderSide(color: AppColors.primary, width: 1.5),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
              ),
              child: _sending
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.2,
                        color: AppColors.primary,
                      ),
                    )
                  : const Text('Отправить сейчас'),
            ),
          ),
        ],
      ),
    );
  }
}

class _CountdownRing extends StatelessWidget {
  final double progress;
  final String countdown;

  const _CountdownRing({required this.progress, required this.countdown});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 88,
      height: 88,
      child: Stack(
        alignment: Alignment.center,
        children: [
          SizedBox(
            width: 88,
            height: 88,
            child: CircularProgressIndicator(
              value: progress,
              strokeWidth: 7,
              backgroundColor: const Color(0xFFE5E7EB),
              color: AppColors.warning,
              strokeCap: StrokeCap.round,
            ),
          ),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                countdown,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: AppColors.warning,
                  height: 1,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                'қолди',
                style: AppTypography.caption.copyWith(
                  color: AppColors.textMuted,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MiniStatCard extends StatelessWidget {
  final Color bg;
  final Color border;
  final String? icon;
  final String label;

  const _MiniStatCard({
    required this.bg,
    required this.border,
    required this.icon,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: border),
      ),
      child: Column(
        children: [
          if (icon != null) ...[
            Text(icon!, style: const TextStyle(fontSize: 16)),
            const SizedBox(height: 4),
          ],
          Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}

String formatHeldSumCompact(double v) {
  if (v.isNaN || v.isInfinite) return '0';
  final n = v.abs().round();
  if (n >= 1000) {
    final k = (n / 1000).round();
    return '$kК';
  }
  return formatMoneySpaced(v);
}
