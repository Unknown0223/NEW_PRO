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

class RoleWelcomeBootItem {
  final String label;
  final String count;
  const RoleWelcomeBootItem(this.label, this.count);
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

/// Shablon BOOT_ITEMS — rol bo‘yicha 2 ustunli checklist.
List<RoleWelcomeBootItem> roleWelcomeBootItems(String? role) {
  switch (role) {
    case 'expeditor':
      return const [
        RoleWelcomeBootItem('Mashina profili', '01 A 777'),
        RoleWelcomeBootItem('Nakladnoylar', '12 ta'),
        RoleWelcomeBootItem('Yetkazish marshruti', '21 km'),
        RoleWelcomeBootItem('Qarz kitobi', '48 mijoz'),
        RoleWelcomeBootItem('Qaytarish turlari', '3 tur'),
        RoleWelcomeBootItem('Chek printeri', 'ulandi'),
      ];
    case 'supervisor':
      return const [
        RoleWelcomeBootItem('Hudud va jamoa', 'Sharq'),
        RoleWelcomeBootItem('Agentlar', '12 ta'),
        RoleWelcomeBootItem('GPS va geofence', '24 soat'),
        RoleWelcomeBootItem('Tasdiq kutmoqda', '8 vizit'),
        RoleWelcomeBootItem('Hudud KPI', '142 mln'),
        RoleWelcomeBootItem('Yangi mijozlar', '2 ta'),
      ];
    case 'cashier':
    case 'operator':
      return const [
        RoleWelcomeBootItem('Kassa sozlamalari', 'Markaz'),
        RoleWelcomeBootItem('Bank inbox', '24 ta'),
        RoleWelcomeBootItem('Buyurtmaga moslash', '22 / 24'),
        RoleWelcomeBootItem('Ekspeditor topshirig‘i', '6 / 6'),
        RoleWelcomeBootItem('Eksport shablonlari', 'Excel'),
        RoleWelcomeBootItem('Audit jurnali', 'OK'),
      ];
    default:
      return const [
        RoleWelcomeBootItem('Savdo nuqtalari', '342'),
        RoleWelcomeBootItem('Katalog va narxlar', '1 208'),
        RoleWelcomeBootItem('Ombor qoldiqlari', '3 ombor'),
        RoleWelcomeBootItem('Bonus va skidka', '6 qoida'),
        RoleWelcomeBootItem('Kunlik marshrut', '12 vizit'),
        RoleWelcomeBootItem('Tabel va KPI', 'iyul'),
      ];
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
