import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/api/mobile_api.dart';
import '../../../core/orders/order_status_labels.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/time/work_region_time.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../shell/agent_app_bar.dart';
import 'order_create_models.dart' show formatMoneyUz;
import 'orders_providers.dart';

/// Shablon Screen 33 — «Заказ #…» detal (faqat ko‘rish + takrorlash).
class AgentOrderDetailPage extends ConsumerWidget {
  final int orderId;

  const AgentOrderDetailPage({super.key, required this.orderId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detailAsync = ref.watch(orderHistoryDetailProvider(orderId));
    final debtsAsync = ref.watch(orderDebtsByOrdersProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AgentAppBar(
        title: detailAsync.maybeWhen(
          data: (o) => _orderTitle(o),
          orElse: () => 'Заказ #$orderId',
        ),
        showBack: true,
        actions: [
          AgentIconButton(
            icon: Icons.more_vert,
            onPressed: () {},
          ),
        ],
      ),
      body: detailAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
        error: (e, _) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            AgentErrorPanel(
              error: e,
              onRetry: () => ref.invalidate(orderHistoryDetailProvider(orderId)),
            ),
          ],
        ),
        data: (order) {
          final debtRow = debtsAsync.valueOrNull?.data.where((d) => d.orderId == order.id).firstOrNull;
          final debtRemainder = debtRow?.remainder;
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(orderHistoryDetailProvider(orderId));
              ref.invalidate(orderDebtsByOrdersProvider);
            },
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 32),
              children: [
                _StatusHero(
                  order: order,
                  debtRemainder: debtRemainder,
                  onRepeat: () => _repeatOrder(context, order),
                ),
                const SizedBox(height: 12),
                _PromoPair(order: order),
                const SizedBox(height: 12),
                _CompositionCard(order: order),
                const SizedBox(height: 12),
                _ViewOnlyStatus(order: order),
              ],
            ),
          );
        },
      ),
    );
  }

  void _repeatOrder(BuildContext context, AgentOrderHistoryRow order) {
    final cid = order.clientId;
    if (cid != null && cid > 0) {
      context.push('/orders/create?client_id=$cid');
    } else {
      context.push('/orders/create');
    }
  }
}

String _orderTitle(AgentOrderHistoryRow o) {
  final n = o.number?.trim();
  final num = (n != null && n.isNotEmpty) ? n : '${o.id}';
  return 'Заказ #$num';
}

String _formatQty(double v) {
  if (v == v.roundToDouble()) return v.round().toString();
  return v.toStringAsFixed(1);
}

String _metaLine(AgentOrderHistoryRow o) {
  final wr = o.createdAt != null ? toWorkRegionFromIso(o.createdAt!) : null;
  if (wr == null) return o.createdAt ?? '—';
  return DateFormat('dd.MM.yyyy · HH:mm').format(wr);
}

/// Dizayn: «Принят оператором» va h.k.
String _agentStatusHeroLabel(AgentOrderHistoryRow o) {
  final s = o.status.trim().toLowerCase();
  if (s == 'confirmed') return 'Принят оператором';
  return orderStatusLabel(o.status, orderType: o.orderType);
}

String _chipShortLabel(AgentOrderHistoryRow o) {
  final s = o.status.trim().toLowerCase();
  if (s == 'confirmed') return 'Принят';
  return orderStatusLabel(o.status, orderType: o.orderType);
}

String _bonusSubtitle(AgentOrderHistoryRow o) {
  final bonusItems = o.items.where((it) => it.isBonus).toList();
  if (bonusItems.isEmpty) {
    if (o.bonusQty > 0) return '+${_formatQty(o.bonusQty)} · активны';
    return 'нет бонусов';
  }
  final first = bonusItems.first;
  final name = first.productName.isNotEmpty ? first.productName : 'бонус';
  final short = name.length > 18 ? '${name.substring(0, 16)}…' : name;
  final q = _formatQty(first.qty);
  final extra = bonusItems.length > 1 ? ' +${bonusItems.length - 1}' : '';
  return '+$q $short$extra · активны';
}

String? _discountPctLabel(AgentOrderHistoryRow o) {
  if (o.discountSum <= 0) return null;
  final base = o.totalSum + o.discountSum;
  if (base <= 0) return null;
  final pct = (o.discountSum / base * 100);
  if (pct >= 10) return '−${pct.round()}%';
  final t = pct.toStringAsFixed(1);
  return '−${t.endsWith('.0') ? pct.round() : t}%';
}

String _discountSubtitle(AgentOrderHistoryRow o) {
  if (o.discountSum <= 0) return 'нет скидки';
  final pct = _discountPctLabel(o);
  final sum = formatMoneyUz(o.discountSum);
  if (pct != null) return '$pct · $sum сум';
  return '−$sum сум';
}

class _StatusHero extends StatelessWidget {
  final AgentOrderHistoryRow order;
  final double? debtRemainder;
  final VoidCallback onRepeat;

  const _StatusHero({
    required this.order,
    required this.debtRemainder,
    required this.onRepeat,
  });

  @override
  Widget build(BuildContext context) {
    final hero = _agentStatusHeroLabel(order);
    final hasDebt = debtRemainder != null && debtRemainder! > 0;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFEAFBEF), Colors.white],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFBBF7D0), width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'АГЕНТСКИЙ СТАТУС',
                      style: AppTypography.captionSmall.copyWith(
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.4,
                        color: AppColors.success,
                        fontSize: 11,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        const Icon(Icons.check_circle, color: Color(0xFF157F3A), size: 22),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            hero,
                            style: AppTypography.headlineMedium.copyWith(
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                              color: const Color(0xFF157F3A),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _metaLine(order),
                      style: AppTypography.captionSmall.copyWith(
                        color: AppColors.textMuted,
                        fontSize: 11.5,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              OutlinedButton(
                onPressed: onRepeat,
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.primary,
                  side: const BorderSide(color: AppColors.primary, width: 1.5),
                  backgroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 0),
                  minimumSize: const Size(0, 34),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: const Text(
                  'Повторить',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFBBF7D0)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'СУММА ЗАКАЗА',
                        style: AppTypography.captionSmall.copyWith(
                          fontWeight: FontWeight.w800,
                          color: AppColors.textMuted,
                          fontSize: 10.5,
                        ),
                      ),
                      Text(
                        '${formatMoneyUz(order.totalSum)} сум',
                        style: AppTypography.headlineMedium.copyWith(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF2F2),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFFECACA)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'ҚАРЗДОРЛИК',
                        style: AppTypography.captionSmall.copyWith(
                          fontWeight: FontWeight.w800,
                          color: AppColors.textMuted,
                          fontSize: 10.5,
                        ),
                      ),
                      Text(
                        hasDebt
                            ? '−${formatMoneyUz(debtRemainder!)}'
                            : '0',
                        style: AppTypography.headlineMedium.copyWith(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                          color: hasDebt ? AppColors.error : AppColors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PromoPair extends StatelessWidget {
  final AgentOrderHistoryRow order;
  const _PromoPair({required this.order});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _PromoTile(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [AppColors.bonusBg, Colors.white],
            ),
            border: AppColors.bonusAccent,
            iconBg: AppColors.bonusBg2,
            icon: Icons.card_giftcard_rounded,
            iconColor: AppColors.bonusInk,
            title: 'Бонусы',
            titleColor: AppColors.bonusInk,
            subtitle: _bonusSubtitle(order),
            shadow: const Color(0x24CA8A04),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _PromoTile(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [AppColors.discBg, Colors.white],
            ),
            border: AppColors.discAccent,
            iconBg: AppColors.discBg2,
            icon: Icons.sell_outlined,
            iconColor: AppColors.discInk,
            title: 'Скидка',
            titleColor: AppColors.discInk,
            subtitle: _discountSubtitle(order),
            shadow: const Color(0x1FEA580C),
          ),
        ),
      ],
    );
  }
}

class _PromoTile extends StatelessWidget {
  final Gradient gradient;
  final Color border;
  final Color iconBg;
  final IconData icon;
  final Color iconColor;
  final String title;
  final Color titleColor;
  final String subtitle;
  final Color shadow;

  const _PromoTile({
    required this.gradient,
    required this.border,
    required this.iconBg,
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.titleColor,
    required this.subtitle,
    required this.shadow,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: gradient,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: border, width: 1.5),
        boxShadow: [BoxShadow(color: shadow, blurRadius: 24, offset: const Offset(0, 8))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: iconColor, size: 22),
          ),
          const SizedBox(height: 8),
          Text(
            title,
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: titleColor),
          ),
          const SizedBox(height: 2),
          Text(
            subtitle,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: titleColor),
          ),
        ],
      ),
    );
  }
}

class _CompositionCard extends StatelessWidget {
  final AgentOrderHistoryRow order;
  const _CompositionCard({required this.order});

  @override
  Widget build(BuildContext context) {
    final sale = order.items.where((it) => !it.isBonus).toList();
    final bonus = order.items.where((it) => it.isBonus).toList();
    final posCount = sale.length;
    final pcs = order.qty;

    return AgentSurfaceCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Состав заказа',
                  style: AppTypography.headlineSmall.copyWith(fontSize: 13.5),
                ),
              ),
              Text(
                '$posCount позиции · ${_formatQty(pcs)} шт',
                style: AppTypography.captionSmall.copyWith(color: AppColors.textMuted, fontSize: 11),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (sale.isEmpty && bonus.isEmpty)
            Text(
              'Нет позиций',
              style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
            )
          else ...[
            ...sale.map(
              (it) => Padding(
                padding: const EdgeInsets.only(bottom: 7),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        '${it.productName.isNotEmpty ? it.productName : '—'} ×${_formatQty(it.qty)}',
                        style: AppTypography.bodySmall.copyWith(fontSize: 12.5),
                      ),
                    ),
                    Text(
                      formatMoneyUz(it.total),
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5),
                    ),
                  ],
                ),
              ),
            ),
            if (bonus.isNotEmpty) ...[
              const Divider(height: 16, color: Color(0xFFEEF2F6)),
              ...bonus.map((it) {
                final name = it.productName.isNotEmpty ? it.productName : 'бонус';
                return Padding(
                  padding: const EdgeInsets.only(bottom: 7),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          '🎁 Бонус: +${_formatQty(it.qty)} $name',
                          style: const TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                            color: AppColors.bonusInk,
                          ),
                        ),
                      ),
                      const Text(
                        '0',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 12.5,
                          color: AppColors.bonusInk,
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ],
            if (order.discountSum > 0) ...[
              Padding(
                padding: const EdgeInsets.only(bottom: 7),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        '🏷 Скидка ${_discountPctLabel(order) ?? ''}'.trim(),
                        style: const TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: AppColors.discInk,
                        ),
                      ),
                    ),
                    Text(
                      '−${formatMoneyUz(order.discountSum)}',
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 12.5,
                        color: AppColors.discInk,
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const Divider(height: 16, color: Color(0xFFEEF2F6)),
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Итого',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                  ),
                ),
                Text(
                  '${formatMoneyUz(order.totalSum)} сум',
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _ViewOnlyStatus extends StatelessWidget {
  final AgentOrderHistoryRow order;
  const _ViewOnlyStatus({required this.order});

  @override
  Widget build(BuildContext context) {
    final chip = orderStatusChip(order.status, orderType: order.orderType);
    final short = _chipShortLabel(order);

    return AgentSurfaceCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Статус только для просмотра',
            style: AppTypography.headlineSmall.copyWith(fontSize: 13.5),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(11),
            decoration: BoxDecoration(
              color: const Color(0xFFF7FAFC),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE5EDF3)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _agentStatusHeroLabel(order),
                        style: AppTypography.bodySmall.copyWith(
                          fontWeight: FontWeight.w800,
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'агент статусни ўзгартирмайди',
                        style: AppTypography.captionSmall.copyWith(
                          color: AppColors.textMuted,
                          fontSize: 11.5,
                        ),
                      ),
                    ],
                  ),
                ),
                AgentStatusChip(label: short, bg: chip.bg, fg: chip.fg),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
