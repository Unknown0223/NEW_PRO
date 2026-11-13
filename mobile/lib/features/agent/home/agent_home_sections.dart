import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../design_system/design_system.dart';

const _iris = Color(0xFF5548F0);
const _irisEnd = Color(0xFF3B2BD9);

/// Oylik reja hero — shablon A.
class HomePlanHero extends StatelessWidget {
  final int pct;
  final double fact;
  final double plan;
  final int daysLeft;
  final double perDay;
  final String monthLabel;

  const HomePlanHero({
    super.key,
    required this.pct,
    required this.fact,
    required this.plan,
    required this.daysLeft,
    required this.perDay,
    required this.monthLabel,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF6A5BFF), _irisEnd],
        ),
        boxShadow: [
          BoxShadow(
            color: _iris.withValues(alpha: 0.35),
            blurRadius: 28,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.18),
                        borderRadius: BorderRadius.circular(99),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.flag_outlined, size: 11, color: Colors.white),
                          const SizedBox(width: 4),
                          Text(
                            monthLabel.toUpperCase(),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.8,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        SaCountUp(
                          value: pct,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 28,
                            fontWeight: FontWeight.w800,
                            height: 1,
                            letterSpacing: -1,
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.only(bottom: 2, left: 1),
                          child: Text(
                            '%',
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.7),
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${homeFmtMoney(fact)} / ${homeFmtMoney(plan)} so‘m',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.75),
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(
                width: 62,
                height: 62,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    SizedBox(
                      width: 62,
                      height: 62,
                      child: TweenAnimationBuilder<double>(
                        tween: Tween(begin: 0, end: (pct / 100).clamp(0.0, 1.0)),
                        duration: const Duration(milliseconds: 900),
                        curve: SaCurves.standard,
                        builder: (_, v, __) => CircularProgressIndicator(
                          value: v,
                          strokeWidth: 5,
                          backgroundColor: Colors.white.withValues(alpha: 0.22),
                          valueColor: const AlwaysStoppedAnimation(Colors.white),
                        ),
                      ),
                    ),
                    Text(
                      '$daysLeft kun',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.22),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                const Icon(Icons.local_fire_department_rounded, size: 14, color: Color(0xFFFFD27A)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text.rich(
                    TextSpan(
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.88),
                        fontSize: 10,
                        height: 1.25,
                      ),
                      children: [
                        const TextSpan(text: 'Kunlik maqsad '),
                        TextSpan(
                          text: homeFmtMoney(perDay),
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontFamily: 'monospace',
                          ),
                        ),
                        const TextSpan(text: ' so‘m · reja uchun'),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Tezkor kirish — shablon quick entry.
class HomeQuickGrid extends StatelessWidget {
  final int ordersCount;
  final int routeLeft;
  final int routePct;
  final String bonusLabel;

  const HomeQuickGrid({
    super.key,
    required this.ordersCount,
    required this.routeLeft,
    required this.routePct,
    required this.bonusLabel,
  });

  @override
  Widget build(BuildContext context) {
    final items = [
      ('Buyurtmalar', '$ordersCount ta', '/orders', Icons.receipt_long_outlined),
      ('Xarita', '$routeLeft vizit', '/map', Icons.map_outlined),
      ('Reja', '$routePct%', '/kpi/route', Icons.route_outlined),
      ('Bonuslar', bonusLabel, '/bonuses', Icons.card_giftcard_outlined),
    ];
    return Row(
      children: [
        for (var i = 0; i < items.length; i++) ...[
          if (i > 0) const SizedBox(width: 8),
          Expanded(
            child: SaPressable(
              onTap: () => context.push(items[i].$3),
              child: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(13),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(items[i].$4, size: 14, color: _iris),
                    const SizedBox(height: 6),
                    Text(
                      items[i].$1,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      items[i].$2,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                        color: _iris,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// Bugungi plitkalar — savdo / buyurtma / bonus.
class HomeTodayTiles extends StatelessWidget {
  final double sales;
  final int orders;
  final String bonusValue;
  final String salesDelta;
  final String ordersHint;
  final String bonusHint;

  const HomeTodayTiles({
    super.key,
    required this.sales,
    required this.orders,
    required this.bonusValue,
    this.salesDelta = '+0%',
    this.ordersHint = '0 draft',
    this.bonusHint = '0%',
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _tile(
            icon: Icons.payments_outlined,
            value: homeFmtShort(sales),
            unit: sales >= 1e6 ? 'mln' : (sales >= 1e3 ? 'ming' : ''),
            label: 'Bugungi savdo',
            badge: salesDelta,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _tile(
            icon: Icons.shopping_bag_outlined,
            value: '$orders',
            unit: 'dona',
            label: 'Buyurtma',
            badge: ordersHint,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _tile(
            icon: Icons.card_giftcard_outlined,
            value: bonusValue,
            unit: '',
            label: 'Bonus',
            badge: bonusHint,
          ),
        ),
      ],
    );
  }

  Widget _tile({
    required IconData icon,
    required String value,
    required String unit,
    required String label,
    required String badge,
  }) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 14, color: _iris),
          const SizedBox(height: 8),
          Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: value,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.3,
                    color: AppColors.textPrimary,
                  ),
                ),
                if (unit.isNotEmpty)
                  TextSpan(
                    text: ' $unit',
                    style: const TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textMuted,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 9,
              color: AppColors.textMuted,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(4),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.north_east, size: 9, color: _iris),
                const SizedBox(width: 2),
                Text(
                  badge,
                  style: const TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                    color: _iris,
                    fontFamily: 'monospace',
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

String homeFmtMoney(double v) {
  if (v <= 0) return '0';
  final s = v.round().toString();
  final buf = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    final fromEnd = s.length - i;
    buf.write(s[i]);
    if (fromEnd > 1 && fromEnd % 3 == 1) buf.write(' ');
  }
  return buf.toString();
}

String homeFmtShort(double v) {
  if (v >= 1e6) return (v / 1e6).toStringAsFixed(1);
  if (v >= 1e3) return (v / 1e3).toStringAsFixed(0);
  return v.toStringAsFixed(0);
}
