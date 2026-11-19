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

/// Agent ismi/kodidan avatar bosh harflari.
String agentMenuInitials({String? name, String? code}) {
  final n = (name ?? '').trim();
  if (n.isNotEmpty) {
    final parts = n.split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    if (n.length >= 2) return n.substring(0, 2).toUpperCase();
    return n[0].toUpperCase();
  }
  final c = (code ?? '').trim();
  if (c.length >= 2) return c.substring(0, 2).toUpperCase();
  if (c.isNotEmpty) return c[0].toUpperCase();
  return 'AG';
}

/// Menyu avatar — shablon teal doira + bosh harflar.
class AgentMenuAvatar extends StatelessWidget {
  final double size;
  final String? name;
  final String? code;

  const AgentMenuAvatar({super.key, this.size = 62, this.name, this.code});

  @override
  Widget build(BuildContext context) {
    final initials = agentMenuInitials(name: name, code: code);
    return Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(
        color: AppColors.primary,
        shape: BoxShape.circle,
      ),
      child: Center(
        child: Text(
          initials,
          style: TextStyle(
            color: Colors.white,
            fontSize: size * 0.32,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.5,
          ),
        ),
      ),
    );
  }
}
