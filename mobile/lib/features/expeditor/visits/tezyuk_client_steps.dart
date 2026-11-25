import 'package:flutter/material.dart';

import '../../../core/theme/tezyuk_colors.dart';

/// Stitch mijoz kartasi — 1.Vizit  2.Foto  3.Status/To'lov
class TezyukClientSteps extends StatelessWidget {
  final int activeIndex;

  const TezyukClientSteps({super.key, required this.activeIndex});

  static const _labels = ['Vizit', 'Foto', 'Status/To\'lov'];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 0, 8, 10),
      child: Row(
        children: [
          for (var i = 0; i < _labels.length; i++)
            Expanded(
              child: _StepDot(
                index: i + 1,
                label: _labels[i],
                active: i == activeIndex,
                done: i < activeIndex,
              ),
            ),
        ],
      ),
    );
  }
}

class _StepDot extends StatelessWidget {
  final int index;
  final String label;
  final bool active;
  final bool done;

  const _StepDot({
    required this.index,
    required this.label,
    required this.active,
    required this.done,
  });

  @override
  Widget build(BuildContext context) {
    final accent = active || done;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 28,
          height: 28,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: active
                ? TezyukColors.primary
                : TezyukColors.surfaceBright,
            shape: BoxShape.circle,
            border: Border.all(
              color: accent
                  ? TezyukColors.primary
                  : TezyukColors.surfaceContainerHigh,
            ),
          ),
          child: done && !active
              ? const Icon(Icons.check, size: 15, color: TezyukColors.primary)
              : Text(
                  '$index',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: active
                        ? TezyukColors.onPrimary
                        : TezyukColors.onSurfaceVariant,
                  ),
                ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          textAlign: TextAlign.center,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 10,
            fontWeight: active ? FontWeight.w700 : FontWeight.w500,
            color: active
                ? TezyukColors.primary
                : TezyukColors.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}