import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/session.dart';
import '../../../core/errors/error_reporter.dart';
import '../../../core/format/money_display.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';
import 'held_order_model.dart';
import 'held_order_timing.dart';
import 'held_orders_provider.dart';

/// Post-visit auto-sync timer (design screen 30).
///
/// [autoGoHomeAfter] > 0 bo‘lsa — shu soniyadan keyin avtomatik asosiy sahifa
/// (`goHome`). Tugma bosilsa — darhol.
Future<HeldOrderSyncAction?> showHeldOrderSyncSheet(
  BuildContext context, {
  required HeldOrder order,
  int? delayMinutes,
  int autoGoHomeAfter = 0,
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
      autoGoHomeAfter: autoGoHomeAfter,
    ),
  );
}

enum HeldOrderSyncAction { edit, sent, dismissed, goHome }

class HeldOrderSyncSheet extends ConsumerStatefulWidget {
  final int orderId;
  final int delayMinutes;
  /// 0 = avto yo‘q; >0 = N soniyadan keyin [HeldOrderSyncAction.goHome].
  final int autoGoHomeAfter;

  const HeldOrderSyncSheet({
    super.key,
    required this.orderId,
    required this.delayMinutes,
    this.autoGoHomeAfter = 0,
  });

  @override
  ConsumerState<HeldOrderSyncSheet> createState() => _HeldOrderSyncSheetState();
}

class _HeldOrderSyncSheetState extends ConsumerState<HeldOrderSyncSheet> {
  bool _didClose = false;
  bool _postponing = false;
  bool _sending = false;
  HeldOrder? _lastOrder;
  Timer? _homeTimer;
  int _homeSecondsLeft = 0;

  @override
  void initState() {
    super.initState();
    final n = widget.autoGoHomeAfter;
    if (n > 0) {
      _homeSecondsLeft = n;
      _homeTimer = Timer.periodic(const Duration(seconds: 1), (t) {
        if (!mounted || _didClose) {
          t.cancel();
          return;
        }
        if (_homeSecondsLeft <= 1) {
          t.cancel();
          _closeSheet(HeldOrderSyncAction.goHome);
          return;
        }
        setState(() => _homeSecondsLeft -= 1);
      });
    }
  }

  @override
  void dispose() {
    _homeTimer?.cancel();
    super.dispose();
  }

  /// Faqat modal bottom sheet route ni yopadi — go_router sahifasiga tegmaydi.
  void _closeSheet(HeldOrderSyncAction action) {
    if (_didClose || !mounted) return;
    final route = ModalRoute.of(context);
    if (route is! ModalBottomSheetRoute) return;
    _didClose = true;
    _homeTimer?.cancel();
    Navigator.pop(context, action);
  }

  int get _effectiveDelayMinutes {
    final fromSession =
        ref.read(sessionProvider).mobileConfig?.sync.postOrderDelayMinutes;
    return clampPostOrderDelayMinutes(fromSession ?? widget.delayMinutes);
  }

  Future<void> _postpone() async {
    if (_postponing || _sending || _didClose) return;
    setState(() => _postponing = true);
    try {
      final delay = _effectiveDelayMinutes;
      final updated = await ref
          .read(heldOrderSchedulerProvider)
          .postponeSync(widget.orderId, delayMinutes: delay);
      if (!mounted || updated == null) return;
      setState(() => _lastOrder = updated);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              delay <= 0
                  ? 'Синхронизация отложена на 1 мин'
                  : 'Синхронизация отложена ещё на $delay мин',
            ),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _postponing = false);
    }
  }

  Future<void> _submitNow() async {
    if (_sending || _postponing || _didClose) return;
    setState(() => _sending = true);
    try {
      await ref.read(heldOrderSchedulerProvider).submitNow(widget.orderId);
      if (!mounted) return;
      _closeSheet(HeldOrderSyncAction.sent);
    } catch (e, st) {
      ErrorReporter.instance?.reportCaught(
        e,
        stack: st,
        module: ErrorModules.heldOrders,
        code: 'HeldOrderSubmitNowFailed',
        message: 'Отложенный заказ: «Отправить сейчас» не удалось',
        path: '/mobile/orders/held',
        payload: {'held_order_id': widget.orderId},
      );
      if (!mounted) return;
      setState(() => _sending = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Не удалось отправить заказ'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(heldOrderTickProvider);

    // Timer tugaganda zakaz navbatdan chiqsa — sheet ni yopish.
    // «Отправить сейчас» vizit bo‘limida.
    ref.listen<AsyncValue<List<HeldOrder>>>(heldOrdersProvider, (prev, next) {
      if (_didClose) return;
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
    final progress = (leftMs / totalMs).clamp(0.0, 1.0);
    final delayMin = _effectiveDelayMinutes;
    final delayLabel = delayMin <= 0 ? '1 мин' : '$delayMin мин';
    final postponeLabel = _postponing
        ? 'Откладываем…'
        : (delayMin <= 0
            ? 'Отложить ещё 1 мин'
            : 'Отложить ещё $delayMin мин');

    final homeLabel = _homeSecondsLeft > 0
        ? 'На главную ($_homeSecondsLeft)'
        : 'На главную';

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
                      'Окно редактирования открыто',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Если в товарах, бонусе или скидке есть ошибка, '
                      'исправьте её в течение ${delayMin <= 0 ? 1 : delayMin} мин. '
                      'Отправить сразу — «Отправить сейчас».',
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
                    'Если в течение $countdown не внести изменения, заказ будет '
                    'автоматически синхронизирован и отправлен на сервер. '
                    'Он также отображается в списке ожидающих заказов и в уведомлениях.',
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
            label: _sending ? 'Отправка…' : 'Отправить сейчас',
            height: 48,
            onPressed: (_sending || _postponing) ? null : _submitNow,
          ),
          const SizedBox(height: 8),
          AgentSecondaryButton(
            label: 'Редактировать',
            onPressed: (_sending || _postponing)
                ? null
                : () => _closeSheet(HeldOrderSyncAction.edit),
          ),
          const SizedBox(height: 8),
          AgentSecondaryButton(
            label: postponeLabel,
            onPressed: (_postponing || _sending) ? null : _postpone,
          ),
          const SizedBox(height: 8),
          AgentSecondaryButton(
            label: homeLabel,
            onPressed: _sending
                ? null
                : () => _closeSheet(HeldOrderSyncAction.goHome),
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
                'осталось',
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
