import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../agent/sync/full_sync_view.dart';
import 'auth_enter.dart';
import 'role_welcome_meta.dart';
import 'template_auth_entrance.dart';

class RoleWelcomeHeader extends StatelessWidget {
  final String roleLabel;
  final Color accent;
  const RoleWelcomeHeader({
    super.key,
    required this.roleLabel,
    required this.accent,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: Row(
        children: [
          const AuthBrandMark(size: 22, draw: false),
          const SizedBox(width: 6),
          const AuthBrandWordmark(size: 13),
          const Spacer(),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(color: accent, shape: BoxShape.circle),
                ),
                const SizedBox(width: 5),
                Text(
                  roleLabel,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: accent,
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

class RoleWelcomeGreeting extends StatelessWidget {
  final String firstName;
  final String word;
  final String tagline;
  final Color accent;
  const RoleWelcomeGreeting({
    super.key,
    required this.firstName,
    required this.word,
    required this.tagline,
    required this.accent,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        children: [
          AuthEnter(
            delay: roleWelcomeHelloDelay,
            child: Text(
              'Xush kelibsiz,',
              style: AppTypography.captionSmall.copyWith(
                color: AppColors.textMuted,
                fontSize: 12,
              ),
            ),
          ),
          const SizedBox(height: 4),
          RoleWelcomeIntroName(name: firstName),
          const SizedBox(height: 8),
          AuthEnter(
            delay: roleWelcomeWordmarkDelay,
            child: Text.rich(
              TextSpan(
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  height: 1,
                ),
                children: [
                  const TextSpan(
                    text: 'SalesArena · ',
                    style: TextStyle(color: Color(0xFF14223F)),
                  ),
                  TextSpan(
                    text: word,
                    style: TextStyle(
                      color: Color.lerp(accent, const Color(0xFF14223F), 0.35),
                    ),
                  ),
                ],
              ),
            ),
          ),
          AuthEnter(
            delay: roleWelcomeTaglineDelay,
            child: Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                tagline,
                textAlign: TextAlign.center,
                style: AppTypography.captionSmall.copyWith(
                  color: AppColors.textMuted,
                  height: 1.35,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class RoleWelcomeCoverBrand extends StatelessWidget {
  final String roleLabel;
  const RoleWelcomeCoverBrand({super.key, required this.roleLabel});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const AuthBrandMark(size: 84, bare: true, draw: true),
          const SizedBox(height: 8),
          const AuthBrandWordmark(size: 24, onBrand: true),
          const SizedBox(height: 10),
          Text(
            '$roleLabel ish joyi ochilmoqda…',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: Colors.white.withValues(alpha: 0.85),
            ),
          ),
        ],
      ),
    );
  }
}

class RoleWelcomeIntroName extends StatelessWidget {
  final String name;
  const RoleWelcomeIntroName({super.key, required this.name});

  @override
  Widget build(BuildContext context) {
    final chars = name.characters.toList();
    return Text.rich(
      TextSpan(
        children: [
          for (var i = 0; i < chars.length; i++)
            WidgetSpan(
              alignment: PlaceholderAlignment.baseline,
              baseline: TextBaseline.alphabetic,
              child: AuthEnter(
                delay: roleWelcomeNameBaseDelay +
                    roleWelcomeNameLetterStep * i,
                child: Text(
                  chars[i],
                  style: const TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w800,
                    height: 1,
                    letterSpacing: -0.8,
                    color: Color(0xFF14223F),
                  ),
                ),
              ),
            ),
        ],
      ),
      textAlign: TextAlign.center,
    );
  }
}

class RoleWelcomeChecklist extends StatelessWidget {
  final List<FullSyncItemState> items;
  final int step;
  final Color accent;
  final bool revealed;
  final bool done;

  const RoleWelcomeChecklist({
    super.key,
    required this.items,
    required this.step,
    required this.accent,
    required this.revealed,
    required this.done,
  });

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();
    final half = (MediaQuery.sizeOf(context).width - 56) / 2;
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (var i = 0; i < items.length; i++)
          SizedBox(
            width: half,
            child: Row(
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  width: 14,
                  height: 14,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: i < step ? accent : const Color(0xFFEEF1F5),
                    shape: BoxShape.circle,
                    boxShadow: i == step && revealed && !done
                        ? [
                            BoxShadow(
                              color: accent.withValues(alpha: 0.28),
                              spreadRadius: 2.5,
                            ),
                          ]
                        : null,
                  ),
                  child: i < step
                      ? const Icon(Icons.check, size: 9, color: Colors.white)
                      : null,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    items[i].label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: i <= step
                          ? AppColors.textTitle
                          : AppColors.textMuted,
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
