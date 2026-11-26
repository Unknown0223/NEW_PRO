import 'package:flutter/material.dart';

import '../../core/config/app_product.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/tezyuk_colors.dart';
import '../expeditor/shared/tezyuk_expeditor_chrome.dart';

/// Stitch `tabel_va_otmetka` / design_system — attendance hub chrome.
Color attendanceBrandPrimary() =>
    isTezyukProduct ? TezyukColors.primary : AppColors.primary;

Color attendanceBrandPrimaryContainer() =>
    isTezyukProduct ? TezyukColors.primaryContainer : AppColors.primaryDark;

Color attendancePageBg() =>
    isTezyukProduct ? TezyukColors.background : AppColors.background;

Color attendanceCardBg() =>
    isTezyukProduct ? TezyukColors.surfaceBright : AppColors.surface;

Color attendanceOutline() =>
    isTezyukProduct ? TezyukColors.outlineVariant : AppColors.border;

Color attendanceOnSurface() =>
    isTezyukProduct ? TezyukColors.onSurface : AppColors.textTitle;

Color attendanceOnSurfaceVariant() =>
    isTezyukProduct ? TezyukColors.onSurfaceVariant : AppColors.textSecondary;

String attendanceHubTitle() =>
    expeditorLabel('Табель и Посещаемость', 'Tabel va otmetka');

/// Compact Stitch header: bordered back, title + subtitle, optional badge.
class StitchAttendanceAppBar extends StatelessWidget
    implements PreferredSizeWidget {
  const StitchAttendanceAppBar({
    super.key,
    required this.title,
    this.subtitle,
    this.showBack = true,
    this.badgeLabel,
    this.bottom,
  });

  final String title;
  final String? subtitle;
  final bool showBack;
  final String? badgeLabel;
  final PreferredSizeWidget? bottom;

  @override
  Size get preferredSize {
    final base = subtitle != null ? 64.0 : 56.0;
    final extra = bottom?.preferredSize.height ?? 0;
    return Size.fromHeight(base + extra);
  }

  @override
  Widget build(BuildContext context) {
    return AppBar(
      elevation: 0,
      scrolledUnderElevation: 0,
      backgroundColor: attendancePageBg(),
      foregroundColor: attendanceOnSurface(),
      automaticallyImplyLeading: false,
      titleSpacing: 16,
      toolbarHeight: subtitle != null ? 64 : 56,
      title: Row(
        children: [
          if (showBack) ...[
            _BackChip(onTap: () => Navigator.of(context).maybePop()),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    letterSpacing: -0.1,
                    color: attendanceOnSurface(),
                    height: 1.25,
                  ),
                ),
                if (subtitle != null)
                  Text(
                    subtitle!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      letterSpacing: 0.3,
                      color: attendanceOnSurfaceVariant(),
                      height: 1.3,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
              ],
            ),
          ),
          if (badgeLabel != null) ...[
            const SizedBox(width: 8),
            _StatusBadge(label: badgeLabel!),
          ],
        ],
      ),
      bottom: bottom,
      shape: Border(
        bottom: BorderSide(color: attendanceOutline(), width: 1),
      ),
    );
  }
}

class _BackChip extends StatelessWidget {
  const _BackChip({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: attendanceCardBg(),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          width: 44,
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: attendanceOutline()),
          ),
          child: Icon(Icons.arrow_back, size: 22, color: attendanceOnSurface()),
        ),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final ok = isTezyukProduct
        ? TezyukColors.successContainer
        : AppColors.successSoft;
    final ink = isTezyukProduct
        ? TezyukColors.onSuccessContainer
        : AppColors.primaryDark;
    final dot =
        isTezyukProduct ? TezyukColors.success : AppColors.success;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: ok,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: dot, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: ink,
            ),
          ),
        ],
      ),
    );
  }
}

/// Segmented-style tab bar (Stitch list/calendar switcher language).
TabBar attendanceStitchTabBar({required List<Tab> tabs}) {
  return TabBar(
    isScrollable: true,
    tabAlignment: TabAlignment.start,
    labelColor: attendanceBrandPrimary(),
    unselectedLabelColor: attendanceOnSurfaceVariant(),
    indicatorColor: attendanceBrandPrimary(),
    indicatorWeight: 2.5,
    labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
    unselectedLabelStyle:
        const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
    tabs: tabs,
  );
}

/// Primary hero — Stitch «Bugungi ish vaqti» card adapted to punch flow.
class AttendanceShiftHero extends StatelessWidget {
  const AttendanceShiftHero({
    super.key,
    required this.shiftName,
    required this.shiftStart,
    required this.shiftEnd,
    required this.marksToday,
    required this.nextIsIn,
    required this.inTimeLabel,
    required this.outTimeLabel,
  });

  final String shiftName;
  final String shiftStart;
  final String shiftEnd;
  final int marksToday;
  final bool nextIsIn;
  final String inTimeLabel;
  final String outTimeLabel;

  @override
  Widget build(BuildContext context) {
    final nextLabel = nextIsIn
        ? expeditorLabel('ПРИХОД', 'KELISH')
        : expeditorLabel('УХОД', 'KETISH');
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: attendanceBrandPrimary(),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: attendanceBrandPrimary().withValues(alpha: 0.22),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            expeditorLabel('Смена', 'Smena'),
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: Colors.white.withValues(alpha: 0.8),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            shiftName.isNotEmpty ? shiftName : '$shiftStart–$shiftEnd',
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.25,
              color: Colors.white,
              height: 1.2,
            ),
          ),
          Text(
            '$shiftStart – $shiftEnd',
            style: TextStyle(
              fontSize: 13,
              color: Colors.white.withValues(alpha: 0.85),
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
          const SizedBox(height: 14),
          Container(height: 1, color: Colors.white.withValues(alpha: 0.2)),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _HeroStat(
                  value: inTimeLabel,
                  label: expeditorLabel('Приход', 'Keldi'),
                ),
              ),
              Expanded(
                child: _HeroStat(
                  value: outTimeLabel,
                  label: expeditorLabel('Уход', 'Ketdi'),
                ),
              ),
              Expanded(
                child: _HeroStat(
                  value: '$marksToday',
                  label: expeditorLabel('Отметок', 'Belgilar'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            expeditorLabel(
              'Следующее: $nextLabel',
              'Keyingi: $nextLabel',
            ),
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: Colors.white.withValues(alpha: 0.9),
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroStat extends StatelessWidget {
  const _HeroStat({required this.value, required this.label});

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: Colors.white,
            fontFeatures: [FontFeature.tabularFigures()],
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w500,
            color: Colors.white.withValues(alpha: 0.8),
          ),
        ),
      ],
    );
  }
}

/// White bordered section card (Stitch surface-container-lowest).
class AttendanceSectionCard extends StatelessWidget {
  const AttendanceSectionCard({
    super.key,
    required this.child,
    this.title,
    this.subtitle,
    this.badge,
  });

  final Widget child;
  final String? title;
  final String? subtitle;
  final String? badge;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: attendanceCardBg(),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: attendanceOutline()),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (title != null) ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title!,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: attendanceOnSurface(),
                        ),
                      ),
                      if (subtitle != null)
                        Text(
                          subtitle!,
                          style: TextStyle(
                            fontSize: 12,
                            color: attendanceOnSurfaceVariant(),
                          ),
                        ),
                    ],
                  ),
                ),
                if (badge != null)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: isTezyukProduct
                          ? TezyukColors.primaryContainer
                          : AppColors.primarySoft,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      badge!,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: isTezyukProduct
                            ? TezyukColors.onBackground
                            : AppColors.primaryDark,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
          ],
          child,
        ],
      ),
    );
  }
}

class AttendancePunchDirectionCard extends StatelessWidget {
  const AttendancePunchDirectionCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.color,
    required this.icon,
    required this.selected,
    required this.enabled,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final Color color;
  final IconData icon;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final bg = selected ? color : color.withValues(alpha: 0.1);
    final fg = selected ? Colors.white : color;
    return Opacity(
      opacity: enabled || selected ? 1 : 0.55,
      child: Material(
        color: bg,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: enabled ? onTap : null,
          child: Container(
            constraints: const BoxConstraints(minHeight: 120),
            padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: selected
                  ? null
                  : Border.all(color: color.withValues(alpha: 0.35)),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: 32, color: fg),
                const SizedBox(height: 8),
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.4,
                    color: fg,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 12,
                    color: selected
                        ? Colors.white.withValues(alpha: 0.78)
                        : color.withValues(alpha: 0.85),
                  ),
                ),
                if (selected) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      expeditorLabel('Сейчас', 'Hozir'),
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: Colors.white.withValues(alpha: 0.95),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class AttendanceLivenessChip extends StatelessWidget {
  const AttendanceLivenessChip({
    super.key,
    required this.label,
    required this.done,
  });

  final String label;
  final bool done;

  @override
  Widget build(BuildContext context) {
    final bg = done
        ? (isTezyukProduct
            ? TezyukColors.successContainer
            : AppColors.primarySoft)
        : (isTezyukProduct
            ? TezyukColors.surfaceContainerLow
            : AppColors.surfaceMuted);
    final fg = done
        ? (isTezyukProduct
            ? TezyukColors.onSuccessContainer
            : AppColors.primaryDark)
        : attendanceOnSurfaceVariant();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: done ? Colors.transparent : attendanceOutline(),
        ),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: fg,
        ),
      ),
    );
  }
}

ButtonStyle attendancePrimaryButtonStyle() {
  return FilledButton.styleFrom(
    backgroundColor: attendanceBrandPrimary(),
    foregroundColor: Colors.white,
    minimumSize: const Size.fromHeight(48),
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
  );
}

ButtonStyle attendanceSecondaryButtonStyle() {
  return OutlinedButton.styleFrom(
    foregroundColor: attendanceBrandPrimary(),
    minimumSize: const Size.fromHeight(48),
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    side: BorderSide(color: attendanceBrandPrimary()),
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
  );
}

InputDecoration attendanceFieldDecoration({required String label}) {
  return InputDecoration(
    labelText: label,
    filled: true,
    fillColor: attendanceCardBg(),
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide(color: attendanceOutline()),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide(color: attendanceOutline()),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide(color: attendanceBrandPrimary(), width: 1.5),
    ),
  );
}

/// First IN / OUT clock label from today's punches (HH:mm or —).
String attendancePunchClockLabel(
  List<Map<String, dynamic>> punches, {
  required String direction,
}) {
  final want = direction.toUpperCase();
  for (final p in punches) {
    final dir = (p['direction'] ?? p['dir'] ?? '').toString().toUpperCase();
    final role = (p['role_in_day'] ?? '').toString().toLowerCase();
    final match = dir == want ||
        (want == 'IN' && role == 'in') ||
        (want == 'OUT' && role == 'out');
    if (!match) continue;
    final raw = (p['punched_at'] ??
            p['created_at'] ??
            p['local_time'] ??
            p['time'] ??
            '')
        .toString();
    final parsed = DateTime.tryParse(raw);
    if (parsed != null) {
      final local = parsed.toLocal();
      final h = local.hour.toString().padLeft(2, '0');
      final m = local.minute.toString().padLeft(2, '0');
      return '$h:$m';
    }
    if (raw.length >= 5 && raw.contains(':')) {
      final slice = raw.length >= 16 ? raw.substring(11, 16) : raw.substring(0, 5);
      if (RegExp(r'^\d{2}:\d{2}$').hasMatch(slice)) return slice;
    }
  }
  return '—';
}
