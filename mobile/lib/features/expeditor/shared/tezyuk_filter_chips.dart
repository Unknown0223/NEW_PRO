import 'package:flutter/material.dart';

import '../../../core/theme/tezyuk_colors.dart';

/// Gorizontal Stitch filtr chiplari (radius 12, primary tanlangan).
class TezyukFilterChips extends StatelessWidget {
  final List<String> labels;
  final int selectedIndex;
  final ValueChanged<int> onSelected;

  const TezyukFilterChips({
    super.key,
    required this.labels,
    required this.selectedIndex,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        itemCount: labels.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (ctx, i) {
          final sel = i == selectedIndex;
          return Material(
            color: sel ? TezyukColors.surfaceBright : TezyukColors.surfaceContainerLow,
            borderRadius: BorderRadius.circular(12),
            child: InkWell(
              onTap: () => onSelected(i),
              borderRadius: BorderRadius.circular(12),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: sel
                        ? TezyukColors.primary
                        : TezyukColors.surfaceContainerHigh,
                  ),
                ),
                child: Text(
                  labels[i],
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: sel
                        ? TezyukColors.primary
                        : TezyukColors.onSurfaceVariant,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}