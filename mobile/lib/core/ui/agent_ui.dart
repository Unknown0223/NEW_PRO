import 'package:flutter/material.dart';

import '../l10n/app_strings_ru.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';

/// Agent 2.0 shablon UI — umumiy komponentlar.

/// Shablon TopBar: 79px, oq fon, pastki radius 18.
class AgentTopBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final VoidCallback? onMenu;
  final VoidCallback? onBack;
  final List<Widget> actions;
  final Widget? belowTitle;
  /// Sarlavha o‘ngida (rasmdagi qizil joy — sinхрон taymer).
  final Widget? titleTrailing;
  final int? menuBadge;

  const AgentTopBar({
    super.key,
    required this.title,
    this.onMenu,
    this.onBack,
    this.actions = const [],
    this.belowTitle,
    this.titleTrailing,
    this.menuBadge,
  });

  @override
  Size get preferredSize => Size.fromHeight(belowTitle != null ? 118 : 79);

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(18)),
        boxShadow: [
          BoxShadow(color: AppColors.topBarShadow, blurRadius: 8, offset: Offset(0, 2)),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
      child: SafeArea(
        bottom: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                if (onBack != null)
                  AgentIconButton(icon: Icons.arrow_back, onPressed: onBack)
                else if (onMenu != null)
                  _menuIcon(onMenu!),
                if (onBack != null || onMenu != null) const SizedBox(width: 10),
                Expanded(
                  child: Row(
                    children: [
                      Flexible(
                        child: Text(
                          title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.headlineLarge.copyWith(
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.4,
                            color: AppColors.textTitle,
                          ),
                        ),
                      ),
                      if (titleTrailing != null) ...[
                        const SizedBox(width: 8),
                        titleTrailing!,
                      ],
                    ],
                  ),
                ),
                ...actions,
              ],
            ),
            if (belowTitle != null) ...[
              const SizedBox(height: 8),
              belowTitle!,
            ],
          ],
        ),
      ),
    );
  }

  Widget _menuIcon(VoidCallback onPressed) {
    return Padding(
      padding: const EdgeInsets.only(right: 2),
      child: AgentHamburger(onTap: onPressed, badge: menuBadge),
    );
  }
}

/// Katalog Hamburger — 36×36, pastki chiziq qisqaroq.
class AgentHamburger extends StatelessWidget {
  final int? badge;
  final VoidCallback? onTap;

  const AgentHamburger({super.key, this.badge, this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFFF1F5F9),
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: SizedBox(
          width: 36,
          height: 36,
          child: Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.center,
            children: [
              CustomPaint(
                size: const Size(18, 14),
                painter: _AgentHamburgerPainter(),
              ),
              if (badge != null && badge! > 0)
                Positioned(
                  top: -3,
                  right: -3,
                  child: Container(
                    constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    decoration: BoxDecoration(
                      color: AppColors.error,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      badge! > 99 ? '99+' : '$badge',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        height: 1,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AgentHamburgerPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = AppColors.textPrimary;
    const r = Radius.circular(1);
    canvas.drawRRect(
      RRect.fromRectAndRadius(Rect.fromLTWH(0, 0, size.width, 2), r),
      paint,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(Rect.fromLTWH(0, 6, size.width, 2), r),
      paint,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(Rect.fromLTWH(0, 12, size.width * 0.66, 2), r),
      paint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class AgentIconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onPressed;
  final bool showDot;

  const AgentIconButton({
    super.key,
    required this.icon,
    this.onPressed,
    this.showDot = false,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Material(
          color: AppColors.surfaceVariant,
          borderRadius: BorderRadius.circular(10),
          child: InkWell(
            onTap: onPressed,
            borderRadius: BorderRadius.circular(10),
            child: SizedBox(
              width: 39,
              height: 39,
              child: Icon(icon, size: 22, color: AppColors.textSecondary),
            ),
          ),
        ),
        if (showDot)
          Positioned(
            right: 2,
            top: 2,
            child: Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(
                color: AppColors.error,
                shape: BoxShape.circle,
              ),
            ),
          ),
      ],
    );
  }
}

/// Pastki navigatsiya — 5 tab (KPI markazda, boshqa tablar bilan bir qatorda).
class AgentBottomNav extends StatelessWidget {
  final int selectedIndex;
  final ValueChanged<int> onTab;

  const AgentBottomNav({
    super.key,
    required this.selectedIndex,
    required this.onTab,
  });

  static const _tabs = [
    (Icons.home_outlined, Icons.home, S.navHome),
    (Icons.location_on_outlined, Icons.location_on, S.navVisits),
    (Icons.adjust_outlined, Icons.adjust, S.navKpi),
    (Icons.bar_chart_outlined, Icons.bar_chart, S.navReports),
    (Icons.storefront_outlined, Icons.storefront, S.navPoints),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 74,
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        boxShadow: [
          BoxShadow(
            color: Color(0x140F172A),
            blurRadius: 10,
            offset: Offset(0, -2),
          ),
        ],
      ),
      padding: const EdgeInsets.only(top: 8, bottom: 6),
      child: Row(
        children: [
          for (var i = 0; i < _tabs.length; i++) _tab(i),
        ],
      ),
    );
  }

  Widget _tab(int index) {
    final selected = selectedIndex == index;
    final icons = _tabs[index];
    return Expanded(
      child: InkWell(
        onTap: () => onTab(index),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              selected ? icons.$2 : icons.$1,
              size: 24,
              color: selected ? AppColors.primary : AppColors.textMenu,
            ),
            const SizedBox(height: 3),
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                icons.$3,
                maxLines: 1,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: selected ? AppColors.primary : AppColors.textMenu,
                ),
              ),
            ),
            if (selected)
              Container(
                margin: const EdgeInsets.only(top: 3),
                width: 4,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Shablondagi `Icon name="grid"` (3 kvadrat + 4 nuqta).
class _AgentGridIcon extends StatelessWidget {
  final double size;
  final Color color;
  const _AgentGridIcon({required this.size, required this.color});

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: Size.square(size),
      painter: _AgentGridIconPainter(color: color),
    );
  }
}

class _AgentGridIconPainter extends CustomPainter {
  final Color color;
  const _AgentGridIconPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = size.width * 0.085
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    // Based on 24x24 grid.
    double s(double v) => v * (size.width / 24.0);

    final r = Radius.circular(s(1));
    final rects = [
      RRect.fromRectAndRadius(Rect.fromLTWH(s(4), s(4), s(6), s(6)), r),
      RRect.fromRectAndRadius(Rect.fromLTWH(s(14), s(4), s(6), s(6)), r),
      RRect.fromRectAndRadius(Rect.fromLTWH(s(4), s(14), s(6), s(6)), r),
    ];
    for (final rr in rects) {
      canvas.drawRRect(rr, stroke);
    }

    final fill = Paint()..color = color;
    for (final c in [
      Offset(s(15), s(15)),
      Offset(s(20), s(15)),
      Offset(s(15), s(20)),
      Offset(s(20), s(20)),
    ]) {
      canvas.drawCircle(c, s(1.2), fill);
    }
  }

  @override
  bool shouldRepaint(covariant _AgentGridIconPainter oldDelegate) => oldDelegate.color != color;
}

/// Oq kartochka (radius 16).
class AgentSurfaceCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;

  const AgentSurfaceCard({
    super.key,
    required this.child,
    this.padding,
    this.margin,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: margin,
      padding: padding ?? const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
      ),
      child: child,
    );
  }
}

class AgentPrimaryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final double height;
  final Color? color;
  final double borderRadius;

  const AgentPrimaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.height = 39,
    this.color,
    this.borderRadius = 10,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: height,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: color ?? AppColors.primary,
          disabledBackgroundColor: const Color(0xFFCBD5E1),
          disabledForegroundColor: Colors.white,
          foregroundColor: Colors.white,
          elevation: onPressed == null ? 0 : 4,
          shadowColor: onPressed == null ? Colors.transparent : AppColors.primary.withValues(alpha: 0.25),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(borderRadius)),
          textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, letterSpacing: 0.2),
        ),
        child: Text(label),
      ),
    );
  }
}

class AgentSecondaryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;

  const AgentSecondaryButton({super.key, required this.label, this.onPressed});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: TextButton(
        onPressed: onPressed,
        style: TextButton.styleFrom(
          backgroundColor: AppColors.surfaceVariant,
          foregroundColor: AppColors.textSecondary,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
        child: Text(label),
      ),
    );
  }
}

/// Mijoz / savdo nuqtasi kartochkasi (OutletCard).
class AgentOutletCard extends StatelessWidget {
  final String name;
  final String subtitle;
  final String trailing;
  final String? grade;
  final Color? trailingColor;
  final Widget? trailingWidget;
  final Widget? headerTrailing;
  final VoidCallback? onTap;

  const AgentOutletCard({
    super.key,
    required this.name,
    required this.subtitle,
    required this.trailing,
    this.grade,
    this.trailingColor,
    this.trailingWidget,
    this.headerTrailing,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 43,
                    height: 43,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceVariant,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.storefront_outlined, color: AppColors.textSecondary),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textHeadline,
                            letterSpacing: -0.2,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          subtitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.bodyMedium.copyWith(
                            fontSize: 15,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (headerTrailing != null) ...[
                    const SizedBox(width: 8),
                    headerTrailing!,
                  ],
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      grade ?? '',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.bodyMedium.copyWith(
                        fontSize: 15,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  if (trailingWidget != null)
                    trailingWidget!
                  else
                    Flexible(
                      child: Text(
                        trailing,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.end,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: trailingColor ?? AppColors.textPrimary,
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Ogohlantirish banneri (shablon Screen 11).
class AgentWarningBanner extends StatelessWidget {
  final String message;
  final VoidCallback? onTap;

  const AgentWarningBanner({super.key, required this.message, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        decoration: BoxDecoration(
          color: AppColors.warningSoft,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFFED7AA)),
        ),
        child: Row(
          children: [
            const Icon(Icons.warning_amber_rounded, color: Color(0xFF9A4D00), size: 18),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                message,
                style: AppTypography.bodySmall.copyWith(
                  color: const Color(0xFF9A4D00),
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Bottom sheet tutqichi.
class AgentSheetHandle extends StatelessWidget {
  const AgentSheetHandle({super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 48,
        height: 4,
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: AppColors.textDisabled,
          borderRadius: BorderRadius.circular(99),
        ),
      ),
    );
  }
}

/// Menyu ro‘yxati elementi (drawer).
class AgentMenuTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final String? badge;
  final bool showDivider;
  final bool destructive;
  final Color? iconColor;
  final bool loading;

  const AgentMenuTile({
    super.key,
    required this.icon,
    required this.label,
    this.onTap,
    this.badge,
    this.showDivider = true,
    this.destructive = false,
    this.iconColor,
    this.loading = false,
  });

  @override
  Widget build(BuildContext context) {
    final labelStyle = TextStyle(
      fontSize: 15,
      fontWeight: FontWeight.w600,
      color: destructive ? AppColors.error : AppColors.textMenu,
    );

    return Column(
      children: [
        if (showDivider) const Divider(height: 1, color: AppColors.divider),
        InkWell(
          onTap: onTap,
          child: SizedBox(
            height: 52,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceVariant,
                      borderRadius: BorderRadius.circular(9),
                    ),
                    child: Icon(icon, size: 20, color: iconColor ?? AppColors.textSecondary),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      label,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: labelStyle,
                    ),
                  ),
                  if (badge != null)
                    Container(
                      margin: const EdgeInsets.only(left: 6),
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF7ED),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: const Color(0xFFFED7AA)),
                      ),
                      child: Text(
                        badge!,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF9A4D00),
                        ),
                      ),
                    )
                  else if (loading)
                    const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  else
                    Icon(
                      Icons.chevron_right_rounded,
                      color: AppColors.textMuted.withValues(alpha: 0.55),
                      size: 20,
                    ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Agent roli badge (shablon teal).
class AgentRoleBadge extends StatelessWidget {
  final String label;
  const AgentRoleBadge({super.key, this.label = 'Agent'});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.primarySoft,
        borderRadius: BorderRadius.circular(22),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w800,
          color: Color(0xFF066E69),
          height: 1.2,
        ),
      ),
    );
  }
}

/// Kunlik hisobot statistikasi (2x2 grid).
class AgentReportStatGrid extends StatelessWidget {
  final List<({String label, String value})> items;

  const AgentReportStatGrid({super.key, required this.items});

  @override
  Widget build(BuildContext context) {
    return AgentSurfaceCard(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          for (var i = 0; i < items.length; i += 2) ...[
            if (i > 0) const Divider(height: 1, color: AppColors.borderLight),
            IntrinsicHeight(
              child: Row(
                children: [
                  Expanded(child: _cell(items[i].label, items[i].value)),
                  const VerticalDivider(width: 1, color: AppColors.borderLight),
                  if (i + 1 < items.length)
                    Expanded(child: _cell(items[i + 1].label, items[i + 1].value)),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _cell(String label, String value) {
    return Padding(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: AppTypography.caption.copyWith(color: AppColors.textSecondary)),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
          ),
        ],
      ),
    );
  }
}

/// Login / onboarding — shablon label + input (Screen 1).
class AgentAuthTextField extends StatelessWidget {
  final TextEditingController? controller;
  final String label;
  final String? hint;
  final bool obscureText;
  final bool enabled;
  final Widget? suffix;
  final ValueChanged<String>? onSubmitted;
  final TextInputType? keyboardType;

  const AgentAuthTextField({
    super.key,
    this.controller,
    required this.label,
    this.hint,
    this.obscureText = false,
    this.enabled = true,
    this.suffix,
    this.onSubmitted,
    this.keyboardType,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: AppTypography.captionSmall.copyWith(color: AppColors.textMuted),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          enabled: enabled,
          obscureText: obscureText,
          keyboardType: keyboardType,
          onSubmitted: onSubmitted,
          style: AppTypography.bodyMedium.copyWith(
            fontSize: 15,
            fontWeight: FontWeight.w500,
            color: AppColors.textTitle,
          ),
          decoration: InputDecoration(
            hintText: hint,
            suffixIcon: suffix,
            filled: true,
            fillColor: const Color(0xFFF7FAFC),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(13),
              borderSide: const BorderSide(color: Color(0xFFD8E3EA), width: 1.5),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(13),
              borderSide: const BorderSide(color: Color(0xFFD8E3EA), width: 1.5),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(13),
              borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
            ),
            hintStyle: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted),
          ),
        ),
      ],
    );
  }
}

/// Shablon onboarding kartochkasi (border + shadow).
class AgentOnboardingCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;

  const AgentOnboardingCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE9EFF4)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: child,
    );
  }
}

/// Bootstrap sinxronizatsiya halqasi (Screen 3).
class SyncProgressRing extends StatelessWidget {
  final double progress;
  final int current;
  final int total;

  const SyncProgressRing({
    super.key,
    required this.progress,
    required this.current,
    required this.total,
  });

  @override
  Widget build(BuildContext context) {
    final pct = (progress.clamp(0.0, 1.0) * 100).round();
    return SizedBox(
      width: 148,
      height: 148,
      child: Stack(
        alignment: Alignment.center,
        children: [
          const SizedBox(
            width: 148,
            height: 148,
            child: CircularProgressIndicator(
              value: 1,
              strokeWidth: 10,
              backgroundColor: Color(0xFFDDE7EE),
              valueColor: AlwaysStoppedAnimation(Colors.transparent),
            ),
          ),
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: progress.clamp(0.0, 1.0)),
            duration: const Duration(milliseconds: 800),
            curve: Curves.easeOutCubic,
            builder: (context, value, _) {
              return SizedBox(
                width: 148,
                height: 148,
                child: CircularProgressIndicator(
                  value: value,
                  strokeWidth: 10,
                  strokeCap: StrokeCap.round,
                  backgroundColor: Colors.transparent,
                  valueColor: const AlwaysStoppedAnimation(AppColors.primary),
                ),
              );
            },
          ),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '$pct%',
                style: AppTypography.headlineMedium.copyWith(
                  fontSize: 30,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textTitle,
                ),
              ),
              Text(
                '$current / $total',
                style: AppTypography.captionSmall.copyWith(color: AppColors.textMuted),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Shablon floating label input.
class AgentFloatingInput extends StatelessWidget {
  final TextEditingController? controller;
  final String label;
  final String? hint;
  final bool obscureText;
  final bool enabled;
  final Widget? suffix;
  final ValueChanged<String>? onSubmitted;
  final TextInputType? keyboardType;

  const AgentFloatingInput({
    super.key,
    this.controller,
    required this.label,
    this.hint,
    this.obscureText = false,
    this.enabled = true,
    this.suffix,
    this.onSubmitted,
    this.keyboardType,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      enabled: enabled,
      obscureText: obscureText,
      keyboardType: keyboardType,
      onSubmitted: onSubmitted,
      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        floatingLabelBehavior: FloatingLabelBehavior.auto,
        suffixIcon: suffix,
        filled: true,
        fillColor: AppColors.surface,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.borderLight),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.primary, width: 2),
        ),
        labelStyle: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted),
      ),
    );
  }
}

/// Modal bottom sheet (shablon sheet wrapper).
Future<T?> showAgentSheet<T>(BuildContext context, {required Widget child, double? height}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: height != null,
    backgroundColor: Colors.transparent,
    builder: (ctx) {
      final h = height ?? MediaQuery.sizeOf(ctx).height * 0.92;
      return Container(
        height: h,
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        ),
        child: Column(
          children: [
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: AgentSheetHandle(),
            ),
            Expanded(child: child),
          ],
        ),
      );
    },
  );
}

/// Toast — ekran **tepasida** (pastki tugmalar / Итого panelini yopmaydi).
void showAgentToast(
  BuildContext context,
  String message, {
  VoidCallback? onDismiss,
  Color accentColor = AppColors.warning,
}) {
  final messenger = ScaffoldMessenger.of(context);
  final mq = MediaQuery.of(context);
  final top = mq.padding.top;
  // Floating SnackBar default pastga yopishadi — margin bilan tepaga ko‘taramiz.
  final bottomMargin = (mq.size.height - top - 112).clamp(80.0, mq.size.height);
  messenger.hideCurrentSnackBar();
  messenger.showSnackBar(
    SnackBar(
      elevation: 0,
      backgroundColor: Colors.transparent,
      padding: EdgeInsets.zero,
      margin: EdgeInsets.fromLTRB(12, 0, 12, bottomMargin),
      behavior: SnackBarBehavior.floating,
      dismissDirection: DismissDirection.up,
      duration: const Duration(seconds: 5),
      content: Container(
        decoration: BoxDecoration(
          color: AppColors.toastDark,
          borderRadius: BorderRadius.circular(10),
          boxShadow: const [BoxShadow(color: Color(0x66000000), blurRadius: 16)],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 4,
              constraints: const BoxConstraints(minHeight: 48),
              decoration: BoxDecoration(
                color: accentColor,
                borderRadius: const BorderRadius.horizontal(left: Radius.circular(10)),
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                child: Text(
                  message,
                  style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600, height: 1.35),
                ),
              ),
            ),
            IconButton(
              icon: const Icon(Icons.close, color: Color(0xFFCBD5E1), size: 20),
              onPressed: () {
                messenger.hideCurrentSnackBar();
                onDismiss?.call();
              },
            ),
          ],
        ),
      ),
    ),
  );
}
