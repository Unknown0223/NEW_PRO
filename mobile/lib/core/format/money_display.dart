import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_typography.dart';

/// Pul summasini parse qilish (client balance va boshqa maydonlar).
double parseMoneyAmount(dynamic raw) {
  if (raw is num) return raw.toDouble();
  return double.tryParse(raw?.toString().replaceAll(',', '.') ?? '') ?? 0;
}

/// 1 620 000 — minglik guruhlar (bo‘shliq bilan). Manfiy: −1 620 000
String formatMoneySpaced(double v) {
  if (v.isNaN || v.isInfinite) return '0';
  final negative = v < 0;
  var n = v.abs().round();
  if (n < 1000) return negative ? '−$n' : '$n';
  final parts = <String>[];
  while (n >= 1000) {
    parts.insert(0, (n % 1000).toString().padLeft(3, '0'));
    n ~/= 1000;
  }
  parts.insert(0, n.toString());
  final s = parts.join(' ');
  return negative ? '−$s' : s;
}

String formatMoneyUz(double v, {String currency = 'UZS'}) =>
    '${formatMoneySpaced(v)} $currency';

/// Mijoz balansi: manfiy = qarz (−), musbat = haqdor.
String formatClientBalanceAmount(double balance, {String currency = 'UZS'}) {
  if (balance.abs() < 0.0001) return '0 $currency';
  return formatMoneyUz(balance, currency: currency);
}

String formatClientBalanceFromMap(
  Map<String, dynamic> client, {
  String currency = 'UZS',
}) =>
    formatClientBalanceAmount(parseMoneyAmount(client['balance']), currency: currency);

/// Qarz summasi (musbat qiymat → − belgisi bilan).
String formatDebtMoney(double v, {String currency = 'UZS'}) {
  if (v <= 0) return formatMoneyUz(0, currency: currency);
  return '−${formatMoneySpaced(v)} $currency';
}

/// Mijoz balansi rangi: qarz — qizil, haqdor/0 — standart matn rangi.
Color colorForClientBalance(double balance) {
  if (balance < -0.0001) return AppColors.error;
  return AppColors.textPrimary;
}

bool isClientDebtBalance(double balance) => balance < -0.0001;

bool isClientCreditorBalance(double balance) => balance > 0.0001;

/// Balans summasi — format + rang (ro‘yxatlar, kartalar).
class ClientBalanceText extends StatelessWidget {
  final double amount;
  final String currency;
  final TextStyle? style;
  final FontWeight fontWeight;

  const ClientBalanceText({
    super.key,
    required this.amount,
    this.currency = 'UZS',
    this.style,
    this.fontWeight = FontWeight.w800,
  });

  @override
  Widget build(BuildContext context) {
    return Text(
      formatClientBalanceAmount(amount, currency: currency),
      style: (style ?? AppTypography.bodyMedium).copyWith(
        color: colorForClientBalance(amount),
        fontWeight: fontWeight,
      ),
    );
  }
}
