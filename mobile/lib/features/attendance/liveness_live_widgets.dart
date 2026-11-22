import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import 'liveness_challenge.dart';

class LivenessStepRail extends StatelessWidget {
  const LivenessStepRail({super.key, required this.challenge, required this.pulse});
  final LivenessChallenge challenge;
  final Animation<double> pulse;

  @override
  Widget build(BuildContext context) {
    final total = challenge.steps.length;
    final done = challenge.phase == LivenessPhase.done ? total : challenge.index.clamp(0, total);
    final active = challenge.phase == LivenessPhase.turn || challenge.phase == LivenessPhase.back
        ? challenge.index
        : -1;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1D24),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFF2A2F3A)),
      ),
      child: Row(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Движения', style: TextStyle(color: Colors.white54, fontSize: 11.5)),
              Text(
                '$done / $total',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 17),
              ),
            ],
          ),
          const Spacer(),
          for (var i = 0; i < total; i++)
            Padding(
              padding: const EdgeInsets.only(left: 4),
              child: LivenessStepDot(
                icon: challenge.steps[i].icon,
                done: i < done,
                active: i == active,
                pulse: pulse,
              ),
            ),
        ],
      ),
    );
  }
}

class LivenessStepDot extends StatelessWidget {
  const LivenessStepDot({
    super.key,
    required this.icon,
    required this.done,
    required this.active,
    required this.pulse,
  });
  final IconData icon;
  final bool done;
  final bool active;
  final Animation<double> pulse;

  @override
  Widget build(BuildContext context) {
    final child = Container(
      width: 30,
      height: 30,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: done
            ? AppColors.primary
            : active
                ? AppColors.primarySoft
                : const Color(0xFF101218),
        border: Border.all(
          color: done || active ? AppColors.primary : const Color(0xFF3A4050),
          width: active ? 2 : 1,
        ),
      ),
      child: Icon(
        done ? Icons.check_rounded : icon,
        size: 16,
        color: done ? Colors.white : AppColors.primary,
      ),
    );
    if (!active) return child;
    return AnimatedBuilder(
      animation: pulse,
      builder: (_, c) => Transform.scale(
        scale: 1 + 0.12 * math.sin(pulse.value * 2 * math.pi),
        child: c,
      ),
      child: child,
    );
  }
}

class LivenessInstructionCard extends StatelessWidget {
  const LivenessInstructionCard({
    super.key,
    required this.title,
    required this.hint,
    required this.icon,
    required this.color,
    this.timeLeft,
  });
  final String title;
  final String hint;
  final IconData icon;
  final Color color;
  final double? timeLeft;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1D24),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.45)),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 52,
            height: 52,
            child: Stack(
              alignment: Alignment.center,
              children: [
                if (timeLeft != null)
                  SizedBox.expand(
                    child: CircularProgressIndicator(
                      value: timeLeft,
                      strokeWidth: 4,
                      color: timeLeft! < 0.3 ? AppColors.error : color,
                      backgroundColor: const Color(0xFF2A2F3A),
                    ),
                  ),
                AnimatedContainer(
                  duration: const Duration(milliseconds: 250),
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.14),
                    shape: BoxShape.circle,
                  ),
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 250),
                    transitionBuilder: (child, a) => ScaleTransition(scale: a, child: child),
                    child: Icon(icon, key: ValueKey(icon), color: color, size: 24),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 250),
              child: Column(
                key: ValueKey(title),
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      color: color == AppColors.error ? AppColors.error : Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 17,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(hint, style: const TextStyle(color: Colors.white70, fontSize: 13)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class LivenessErrorPane extends StatelessWidget {
  const LivenessErrorPane({super.key, required this.text, required this.onRetry});
  final String text;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(text, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white)),
          const SizedBox(height: 16),
          FilledButton(onPressed: onRetry, child: const Text('Повторить')),
        ],
      ),
    );
  }
}
