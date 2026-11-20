import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';

/// RoleWelcome.tsx timeline (kirish → asosiy sahifa).
const Duration roleWelcomeRevealHold = Duration(milliseconds: 1150);
const Duration roleWelcomeFirstStepHold = Duration(milliseconds: 1300);
const Duration roleWelcomeStepHold = Duration(milliseconds: 430);
const Duration roleWelcomeDoneHold = Duration(milliseconds: 800);
const Duration roleWelcomeLeaveHold = Duration(milliseconds: 900);
const Duration roleWelcomeHelloDelay = Duration(milliseconds: 1250);
const Duration roleWelcomeNameBaseDelay = Duration(milliseconds: 1320);
const Duration roleWelcomeNameLetterStep = Duration(milliseconds: 45);
const Duration roleWelcomeWordmarkDelay = Duration(milliseconds: 1650);
const Duration roleWelcomeTaglineDelay = Duration(milliseconds: 1780);

class RoleWelcomeMeta {
  final String word;
  final String tagline;
  final String roleLabel;
  const RoleWelcomeMeta({
    required this.word,
    required this.tagline,
    required this.roleLabel,
  });
}

RoleWelcomeMeta roleWelcomeMeta(String? role) {
  switch (role) {
    case 'expeditor':
      return const RoleWelcomeMeta(
        word: 'Dastavka',
        tagline: 'Yetkazing, to‘lovni oling va yoping — bir necha bosishda.',
        roleLabel: 'Ekspeditor',
      );
    case 'supervisor':
      return const RoleWelcomeMeta(
        word: 'Nazorat',
        tagline: 'Jamoa, GPS va KPI — real vaqtda, bitta ekranda.',
        roleLabel: 'Supervayzer',
      );
    case 'cashier':
    case 'operator':
      return const RoleWelcomeMeta(
        word: 'Kassa',
        tagline: 'O‘tkazmalarni solishtiring va tasdiqlang — xatosiz.',
        roleLabel: 'Kassir',
      );
    default:
      return const RoleWelcomeMeta(
        word: 'Agent',
        tagline: 'Marshrut, vizit va buyurtma — bir necha bosishda.',
        roleLabel: 'Agent',
      );
  }
}

Color roleWelcomeAccent(String? role) {
  switch (role) {
    case 'expeditor':
      return AppColors.expeditorAccent;
    case 'supervisor':
      return AppColors.supervisorAccent;
    case 'cashier':
    case 'operator':
      return AppColors.cashierAccent;
    default:
      return AppColors.agentAccent;
  }
}

String roleWelcomeFirstName(String? fullName) {
  final raw = (fullName ?? '').trim();
  if (raw.isEmpty) return 'Do‘st';
  return raw.split(RegExp(r'\s+')).first;
}
