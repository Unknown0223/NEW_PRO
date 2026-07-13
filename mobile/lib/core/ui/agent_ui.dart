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

  const AgentTopBar({
    super.key,
    required this.title,
    this.onMenu,
    this.onBack,
    this.actions = const [],
    this.belowTitle,
    this.titleTrailing,
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
                  AgentIconButton(icon: Icons.menu, onPressed: onMenu),
                Expanded(
                  child: Row(
                    children: [
                      Flexible(
                        child: Text(
                          title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.headlineLarge.copyWith(
                            fontSize: 20,
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

/// Pastki navigatsiya — markazda menyu tugmasi (shablon BottomNav).
class AgentBottomNav extends StatelessWidget {
  final int selectedIndex;
  final ValueChanged<int> onTab;
  final VoidCallback onMenuCenter;

  const AgentBottomNav({
    super.key,
    required this.selectedIndex,
    required this.onTab,
    required this.onMenuCenter,
  });

  static const _tabs = [
    (Icons.home_outlined, Icons.home, S.navHome),
    (Icons.location_on_outlined, Icons.location_on, S.navVisits),
    (Icons.pie_chart_outline, Icons.pie_chart, S.navReports),
    (Icons.storefront_outlined, Icons.storefront, S.navPoints),
  ];

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 83,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.topCenter,
        children: [
          Container(
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
            padding: const EdgeInsets.only(top: 8),
            child: Row(
              children: [
                _tab(0),
                _tab(1),
                const Expanded(child: SizedBox()),
                _tab(2),
                _tab(3),
              ],
            ),
          ),
          Positioned(
            top: -25,
            child: Material(
              elevation: 8,
              shadowColor: AppColors.primary.withValues(alpha: 0.25),
              shape: const CircleBorder(side: BorderSide(color: Colors.white, width: 5)),
              color: AppColors.primary,
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: onMenuCenter,
                child: const SizedBox(
                  width: 72,
                  height: 72,
                  child: Center(child: _AgentGridIcon(size: 36, color: Colors.white)),
                ),
              ),
            ),
          ),
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
              color: selected ? AppColors.primary : AppColors.textSecondary,
            ),
            const SizedBox(height: 2),
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                icons.$3,
                maxLines: 1,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: selected ? AppColors.primary : AppColors.textSecondary,
                ),
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

  const AgentPrimaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.height = 39,
    this.color,
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
          foregroundColor: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
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

  const AgentMenuTile({
    super.key,
    required this.icon,
    required this.label,
    this.onTap,
    this.badge,
    this.showDivider = true,
  });

  @override
  Widget build(BuildContext context) {
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
                    child: Icon(icon, size: 20, color: AppColors.textSecondary),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textMenu,
                      ),
                    ),
                  ),
                  if (badge != null)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDCFCE7),
                        borderRadius: BorderRadius.circular(5),
                      ),
                      child: Text(
                        badge!,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppColors.success,
                        ),
                      ),
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

/// Agent roli badge (gradient).
class AgentRoleBadge extends StatelessWidget {
  final String label;
  const AgentRoleBadge({super.key, this.label = 'Agent'});

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.primaryGradientStart, AppColors.primaryGradientEnd],
        ),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        child: Text(
          label,
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white),
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

/// Toast — ekran **tepasida** (pastki tugmalarni yopmaydi).
void showAgentToast(
  BuildContext context,
  String message, {
  VoidCallback? onDismiss,
  Color accentColor = AppColors.warning,
}) {
  final messenger = ScaffoldMessenger.of(context);
  final top = MediaQuery.paddingOf(context).top;
  messenger.hideCurrentSnackBar();
  messenger.showSnackBar(
    SnackBar(
      elevation: 0,
      backgroundColor: Colors.transparent,
      padding: EdgeInsets.fromLTRB(12, top + 8, 12, 0),
      behavior: SnackBarBehavior.floating,
      dismissDirection: DismissDirection.up,
      duration: const Duration(seconds: 4),
      content: Container(
        decoration: BoxDecoration(
          color: AppColors.toastDark,
          borderRadius: BorderRadius.circular(10),
          boxShadow: const [BoxShadow(color: Color(0x66000000), blurRadius: 16)],
        ),
        child: Row(
          children: [
            Container(width: 4, height: 48, color: accentColor),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                child: Text(
                  message,
                  style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w600),
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
