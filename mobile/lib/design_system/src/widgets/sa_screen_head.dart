import 'package:flutter/material.dart';

import '../tokens/sa_colors.dart';
import '../tokens/sa_type.dart';
import 'sa_motion.dart';

/// Shablon `ScreenHead` — ixcham sahifa sarlavhasi (GlobalChrome ostida).
class SaScreenHead extends StatelessWidget {
  final String title;
  final String? subtitle;
  final Widget? belowTitle;
  final VoidCallback? onBack;
  final Widget? trailing;

  const SaScreenHead({
    super.key,
    required this.title,
    this.subtitle,
    this.belowTitle,
    this.onBack,
    this.trailing,
  });

  static double heightFor({String? subtitle, Widget? belowTitle}) {
    // Trailing action ~36–40px + padding — 46 yetarli emas (1px overflow).
    var h = 56.0;
    if (subtitle != null && subtitle.isNotEmpty) h += 14;
    if (belowTitle != null) h += 40;
    return h;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Color(0xFFE4E8EF))),
      ),
      padding: const EdgeInsets.fromLTRB(10, 6, 10, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (onBack != null) ...[
                SaPressable(
                  pressedScale: 0.9,
                  borderRadius: BorderRadius.circular(10),
                  onTap: onBack,
                  child: Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF3F5F8),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.chevron_left_rounded,
                      size: 22,
                      color: SaColors.inkLight,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: SaType.title.copyWith(
                        fontSize: 17,
                        letterSpacing: -0.4,
                        color: SaColors.inkLight,
                      ),
                    ),
                    if (subtitle != null && subtitle!.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: SaType.caption.copyWith(
                          fontSize: 9.5,
                          fontWeight: FontWeight.w500,
                          color: const Color(0xFF677386),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (trailing != null) ...[
                const SizedBox(width: 8),
                trailing!,
              ],
            ],
          ),
          if (belowTitle != null) ...[
            const SizedBox(height: 8),
            belowTitle!,
          ],
        ],
      ),
    );
  }
}
