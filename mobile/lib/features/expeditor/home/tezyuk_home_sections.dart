import 'package:flutter/material.dart';

import '../../../core/theme/tezyuk_colors.dart';
import '../../agent/orders/order_create_models.dart' show formatMoneySpaced;
import 'expeditor_home_model.dart';

class TezyukOtmetkaStrip extends StatelessWidget {
  final HomeOtmetkaChip chip;
  final VoidCallback onTap;
  const TezyukOtmetkaStrip({super.key, required this.chip, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: TezyukColors.surfaceBright,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: TezyukColors.outlineVariant),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: TezyukColors.successContainer,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.verified_user,
                  size: 20,
                  color: TezyukColors.onSuccessContainer,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      chip.label,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                    Text(
                      chip.subtitle ?? 'Tabelni ochish',
                      style: const TextStyle(
                        fontSize: 12,
                        color: TezyukColors.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: TezyukColors.primary),
            ],
          ),
        ),
      ),
    );
  }
}

class TezyukDailyPlanHero extends StatelessWidget {
  final HomeDailyPlan plan;
  const TezyukDailyPlanHero({super.key, required this.plan});

  @override
  Widget build(BuildContext context) {
    final pct = plan.pct.clamp(0, 100);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: TezyukColors.primary,
        borderRadius: BorderRadius.circular(16),
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
                      'Kunlik reja',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.8),
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(
                          '${pct.toInt()}%',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 30,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.5,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '${plan.visited} / ${plan.total} tashrif',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.9),
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.schedule, size: 16, color: Colors.white),
                    const SizedBox(width: 4),
                    Text(
                      '${plan.remaining} ta qoldi',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: (pct / 100).clamp(0.0, 1.0),
              minHeight: 10,
              backgroundColor: Colors.white.withValues(alpha: 0.25),
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}

class TezyukMetricTiles extends StatelessWidget {
  final double? collected;
  final int delivered;
  final int remaining;
  const TezyukMetricTiles({
    super.key,
    required this.collected,
    required this.delivered,
    required this.remaining,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: _Tile(
            title: 'Yig\'ilgan pul',
            icon: Icons.payments_outlined,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  collected == null ? '—' : formatMoneySpaced(collected!),
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                    color: TezyukColors.onSurface,
                  ),
                ),
                const Text(
                  'so\'m • naqd va karta',
                  style: TextStyle(
                    fontSize: 12,
                    color: TezyukColors.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _Tile(
            title: 'Buyurtmalar',
            icon: Icons.inventory_2_outlined,
            child: Column(
              children: [
                _OrderRow(
                  color: TezyukColors.success,
                  label: 'Yetib borgan',
                  value: '$delivered ta',
                ),
                const SizedBox(height: 4),
                _OrderRow(
                  color: TezyukColors.error,
                  label: 'Qolgan',
                  value: '$remaining ta',
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _OrderRow extends StatelessWidget {
  final Color color;
  final String label;
  final String value;
  const _OrderRow({
    required this.color,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Expanded(
          child: Text(label, style: TextStyle(fontSize: 12, color: color)),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: color,
          ),
        ),
      ],
    );
  }
}

class _Tile extends StatelessWidget {
  final String title;
  final IconData icon;
  final Widget child;
  const _Tile({required this.title, required this.icon, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: TezyukColors.surfaceBright,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: TezyukColors.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: TezyukColors.onSurfaceVariant,
                  ),
                ),
              ),
              Icon(icon, size: 18, color: TezyukColors.primary),
            ],
          ),
          const SizedBox(height: 8),
          child,
        ],
      ),
    );
  }
}
