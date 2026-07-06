import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';

/// Menyu sarlavhasi: smart kod + F.I.O — «js001 — agent test».
String formatAgentMenuTitle({
  required String name,
  String? agentCode,
}) {
  final displayName = name.trim().isEmpty ? 'Агент' : name.trim();
  final code = agentCode?.trim();
  if (code != null && code.isNotEmpty) {
    return '$code — $displayName';
  }
  return displayName;
}

/// Menyu avatar — shablon bo‘sh profil doirasi.
class AgentMenuAvatar extends StatelessWidget {
  final double size;

  const AgentMenuAvatar({super.key, this.size = 80});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppColors.surfaceVariant,
        shape: BoxShape.circle,
        border: Border.all(color: AppColors.borderLight, width: 1.5),
      ),
      child: Icon(Icons.person_outline_rounded, size: size * 0.48, color: AppColors.textMuted),
    );
  }
}
