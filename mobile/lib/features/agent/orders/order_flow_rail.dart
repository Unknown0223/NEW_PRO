import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';

/// Shablon `OrderFlow.tsx` — 5 bosqichli progress rail.
class OrderFlowRail extends StatelessWidget {
  /// 0…4 — Mijoz, Shartlar, Tovar, Bonus, Yuborish.
  final int activeIndex;

  const OrderFlowRail({super.key, required this.activeIndex});

  static const _labels = ['Mijoz', 'Shartlar', 'Tovar', 'Bonus', 'Yuborish'];
  static const _iris = Color(0xFF5548F0);

  @override
  Widget build(BuildContext context) {
    final idx = activeIndex.clamp(0, _labels.length - 1);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
      child: Row(
        children: [
          for (var i = 0; i < _labels.length; i++) ...[
            if (i > 0) const SizedBox(width: 4),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(99),
                    child: SizedBox(
                      height: 3,
                      child: ColoredBox(
                        color: AppColors.surfaceMuted,
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: FractionallySizedBox(
                            widthFactor: i < idx
                                ? 1
                                : i == idx
                                    ? 0.55
                                    : 0,
                            child: const ColoredBox(color: _iris),
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _labels[i],
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 8,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.2,
                      color: i <= idx ? _iris : AppColors.textMuted,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  static int railIndexFor({
    required bool pickingClient,
    required bool onProducts,
    required bool setupDone,
  }) {
    if (pickingClient) return 0;
    if (!setupDone) return 1;
    if (onProducts) return 2;
    return 2;
  }
}
