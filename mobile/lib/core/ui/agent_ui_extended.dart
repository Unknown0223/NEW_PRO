import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../clients/agent_outlet_filters_provider.dart';
import '../l10n/app_strings_ru.dart';
import '../format/money_display.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';
import 'agent_template_form.dart';
import 'agent_ui.dart';

import '../api/api_exceptions.dart';

/// Pul/son maydonlari uchun minglik guruhlash (3 xonadan bo'shliq bilan).
/// Masalan: `1000000` → `1 000 000`. O'qishga oson bo'lishi uchun.
class ThousandsTextInputFormatter extends TextInputFormatter {
  const ThousandsTextInputFormatter();

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final digits = newValue.text.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.isEmpty) return const TextEditingValue(text: '');
    final buf = StringBuffer();
    final len = digits.length;
    for (var i = 0; i < len; i++) {
      if (i != 0 && (len - i) % 3 == 0) buf.write(' ');
      buf.write(digits[i]);
    }
    final formatted = buf.toString();
    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }
}

/// `"1 000 000"` / `"1000000"` kabi matndan `double` ajratib oladi.
double parseGroupedNumber(String? text) {
  if (text == null) return 0;
  final digits = text.replaceAll(RegExp(r'[^0-9]'), '');
  if (digits.isEmpty) return 0;
  return double.tryParse(digits) ?? 0;
}

/// Qidiruv sarlavhasi (shablon SearchScreen).
class AgentSearchHeader extends StatelessWidget implements PreferredSizeWidget {
  final TextEditingController controller;
  final VoidCallback onBack;
  final String hint;

  const AgentSearchHeader({
    super.key,
    required this.controller,
    required this.onBack,
    this.hint = 'Qidiruv...',
  });

  @override
  Size get preferredSize => const Size.fromHeight(79);

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(18)),
        boxShadow: [BoxShadow(color: AppColors.topBarShadow, blurRadius: 8, offset: Offset(0, 2))],
      ),
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
      child: SafeArea(
        bottom: false,
        child: Row(
          children: [
            AgentIconButton(icon: Icons.arrow_back, onPressed: onBack),
            Expanded(
              child: Container(
                margin: const EdgeInsets.only(left: 8),
                child: TextField(
                  controller: controller,
                  autofocus: true,
                  style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w500, color: AppColors.textPrimary),
                  decoration: InputDecoration(
                    hintText: hint,
                    border: InputBorder.none,
                    isDense: true,
                    prefixIcon: Container(
                      width: 2,
                      margin: const EdgeInsets.only(left: 4, right: 8),
                      color: AppColors.info,
                    ),
                    prefixIconConstraints: const BoxConstraints(minWidth: 2, maxWidth: 2, minHeight: 24),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class AgentDayTabs extends ConsumerStatefulWidget {
  final ValueChanged<int>? onChanged;
  final double topPadding;

  const AgentDayTabs({super.key, this.onChanged, this.topPadding = 12});

  @override
  ConsumerState<AgentDayTabs> createState() => _AgentDayTabsState();
}

class _AgentDayTabsState extends ConsumerState<AgentDayTabs> {
  final List<GlobalKey> _chipKeys = List.generate(S.weekDays.length, (_) => GlobalKey());
  int _lastSelected = -1;

  void _selectDay(int index) {
    ref.read(outletWeekdayTabProvider.notifier).state = index;
    widget.onChanged?.call(index);
    _scrollChipIntoView(index);
  }

  void _scrollChipIntoView(int index) {
    final ctx = _chipKeys[index].currentContext;
    if (ctx == null) return;
    Scrollable.ensureVisible(
      ctx,
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeOutCubic,
      alignment: 0.45,
    );
  }

  @override
  Widget build(BuildContext context) {
    final selected = ref.watch(outletWeekdayTabProvider);
    const days = S.weekDays;

    if (_lastSelected != selected) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _scrollChipIntoView(selected);
        _lastSelected = selected;
      });
    }

    return Padding(
      padding: EdgeInsets.fromLTRB(12, widget.topPadding, 12, 12),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        clipBehavior: Clip.none,
        child: Row(
          children: List.generate(days.length, (i) {
            final active = i == selected;
            final isAll = i == 0;
            return Padding(
              key: _chipKeys[i],
              padding: EdgeInsets.only(right: i < days.length - 1 ? 8 : 0),
              child: Material(
                color: active ? AppColors.primaryDark : AppColors.surfaceVariant,
                borderRadius: BorderRadius.circular(99),
                child: InkWell(
                  onTap: () => _selectDay(i),
                  borderRadius: BorderRadius.circular(99),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 220),
                    curve: Curves.easeOutCubic,
                    constraints: BoxConstraints(
                      minWidth: isAll ? 52 : 44,
                      minHeight: 44,
                    ),
                    padding: EdgeInsets.symmetric(horizontal: isAll ? 12 : 0),
                    alignment: Alignment.center,
                    child: AnimatedDefaultTextStyle(
                      duration: const Duration(milliseconds: 220),
                      style: TextStyle(
                        fontSize: isAll ? 13 : 14,
                        fontWeight: FontWeight.w800,
                        color: active ? Colors.white : AppColors.textSecondary,
                      ),
                      child: Text(days[i]),
                    ),
                  ),
                ),
              ),
            );
          }),
        ),
      ),
    );
  }
}

/// Kun tab o'zgarganda kontent yon tomonga suriladi (keyingi kun — o'ngdan, oldingi — chapdan).
class AgentDayTabSlideView extends ConsumerStatefulWidget {
  final Widget child;

  const AgentDayTabSlideView({super.key, required this.child});

  @override
  ConsumerState<AgentDayTabSlideView> createState() => _AgentDayTabSlideViewState();
}

class _AgentDayTabSlideViewState extends ConsumerState<AgentDayTabSlideView> {
  int _fromTab = 0;
  bool _initialized = false;
  /// Chapdan o'ngga (indeks oshsa) — yangi o'ngdan, eski chapga chiqadi.
  bool _slideForward = true;

  @override
  Widget build(BuildContext context) {
    final tab = ref.watch(effectiveWeekdayTabProvider);
    if (!_initialized) {
      _fromTab = tab;
      _initialized = true;
    } else if (tab != _fromTab) {
      _slideForward = tab > _fromTab;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _fromTab != tab) {
          setState(() => _fromTab = tab);
        }
      });
    }

    final incomingKey = ValueKey<int>(tab);

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 480),
      switchInCurve: Curves.easeInOutCubic,
      switchOutCurve: Curves.easeInOutCubic,
      layoutBuilder: (current, previous) {
        return Stack(
          fit: StackFit.expand,
          children: [
            ...previous,
            if (current != null) current,
          ],
        );
      },
      transitionBuilder: (child, animation) {
        final isIncoming = child.key == incomingKey;
        final curved = CurvedAnimation(
          parent: animation,
          curve: isIncoming ? Curves.easeOutCubic : Curves.easeInCubic,
        );

        if (isIncoming) {
          // Chap → o'ng: yangi ro'yxat o'ngdan siljib kiradi.
          final begin = _slideForward ? const Offset(1, 0) : const Offset(-1, 0);
          return ClipRect(
            child: SlideTransition(
              position: Tween<Offset>(begin: begin, end: Offset.zero).animate(curved),
              child: child,
            ),
          );
        }

        // Eski ro'yxat teskari tomonga chiqadi (o'ng → chap: eski chapga ketadi).
        final exitToward = _slideForward ? const Offset(-1, 0) : const Offset(1, 0);
        return ClipRect(
          child: SlideTransition(
            position: Tween<Offset>(begin: exitToward, end: Offset.zero).animate(curved),
            child: child,
          ),
        );
      },
      child: KeyedSubtree(
        key: incomingKey,
        child: widget.child,
      ),
    );
  }
}

class AgentProgressGauge extends StatelessWidget {
  final double percent;
  const AgentProgressGauge({super.key, required this.percent});

  @override
  Widget build(BuildContext context) {
    final p = percent.clamp(0.0, 1.0);
    return SizedBox(
      height: 140,
      width: double.infinity,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CustomPaint(
            size: const Size(240, 120),
            painter: _GaugePainter(percent: p),
          ),
          Positioned(
            bottom: 8,
            child: Column(
              children: [
                Text(
                  S.performance,
                  style: AppTypography.labelLarge.copyWith(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textMenu,
                  ),
                ),
                Text(
                  '${(p * 100).round()}%',
                  style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _GaugePainter extends CustomPainter {
  final double percent;
  _GaugePainter({required this.percent});

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromLTWH(0, 0, size.width, size.height * 2);
    const start = 3.14159;
    const sweep = 3.14159;
    final bg = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 18
      ..strokeCap = StrokeCap.round;
    final track = Paint()
      ..color = const Color(0xFFF9FBFD)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 18
      ..strokeCap = StrokeCap.round;
    final fg = Paint()
      ..color = AppColors.primary
      ..style = PaintingStyle.stroke
      ..strokeWidth = 18
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(rect, start, sweep, false, bg);
    canvas.drawArc(rect, start, sweep, false, track);
    if (percent > 0) canvas.drawArc(rect, start, sweep * percent, false, fg);
  }

  @override
  bool shouldRepaint(covariant _GaugePainter old) => old.percent != percent;
}

class AgentVisitMetric extends StatelessWidget {
  final bool positive;
  final String title;
  final String main;
  final String routeValue;
  final String outsideValue;
  final String? routeLabel;
  final String? outsideLabel;
  final String? extraLabel;
  final String? extraValue;
  /// Asosiy `main` bilan bir xil — «По маршруту» / «Ост. по марш.» yashirish.
  final bool showOnRouteSubRow;
  /// «Вне маршрута» / «Ост. вне марш.» yashirish.
  final bool showOutsideSubRow;

  const AgentVisitMetric({
    super.key,
    required this.positive,
    required this.title,
    required this.main,
    this.routeValue = '0',
    this.outsideValue = '0',
    this.routeLabel,
    this.outsideLabel,
    this.extraLabel,
    this.extraValue,
    this.showOnRouteSubRow = true,
    this.showOutsideSubRow = false,
  });

  @override
  Widget build(BuildContext context) {
    final color = positive ? AppColors.success : AppColors.error;
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                child: Icon(
                  positive ? Icons.check : Icons.location_on,
                  size: 18,
                  color: Colors.white,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textMenu,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      main,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: positive ? AppColors.success : AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.75),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Column(
              children: [
                if (showOnRouteSubRow) ...[
                  _subRow(routeLabel ?? S.byRoute, routeValue),
                  const SizedBox(height: 4),
                ],
                if (showOutsideSubRow) _subRow(outsideLabel ?? S.offRoute, outsideValue),
                if (extraLabel != null && extraValue != null) ...[
                  const SizedBox(height: 4),
                  _subRow(extraLabel!, extraValue!),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  static Widget _subRow(String label, String value) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              label,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 13,
                height: 1.25,
                fontWeight: FontWeight.w600,
                color: AppColors.textMenu,
              ),
            ),
          ),
          const SizedBox(width: 4),
          Text(
            value,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
        ],
      );
}

class AgentMiniSummary extends StatelessWidget {
  final String title;
  final String value;
  const AgentMiniSummary({super.key, required this.title, required this.value});

  @override
  Widget build(BuildContext context) {
    return AgentSurfaceCard(
      padding: const EdgeInsets.all(12),
      child: SizedBox(
        height: 100,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 15,
                height: 1.25,
                fontWeight: FontWeight.w600,
                color: AppColors.textMenu,
              ),
            ),
            const Spacer(),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                value,
                maxLines: 1,
                style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class AgentStatusChip extends StatelessWidget {
  final String label;
  final Color bg;
  final Color fg;
  const AgentStatusChip({super.key, required this.label, required this.bg, required this.fg});

  factory AgentStatusChip.confirmed(String label) =>
      AgentStatusChip(label: label, bg: const Color(0xFFDBEAFE), fg: const Color(0xFF2563EB));
  factory AgentStatusChip.delivered(String label) =>
      AgentStatusChip(label: label, bg: const Color(0xFFDCFCE7), fg: AppColors.success);
  factory AgentStatusChip.returned(String label) =>
      AgentStatusChip(label: label, bg: const Color(0xFFFEE2E2), fg: AppColors.error);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: fg)),
    );
  }
}

class AgentOrderLineRow {
  final String name;
  final String qty;
  final String price;
  final bool isBonus;

  const AgentOrderLineRow({
    required this.name,
    required this.qty,
    required this.price,
    this.isBonus = false,
  });
}

class AgentOrderCard extends StatelessWidget {
  final String title;
  final String? statusLabel;
  final AgentStatusChip? statusChip;
  final String client;
  final String date;
  final String bonus;
  final String volume;
  final String count;
  final String amount;
  final String? discount;
  final String? debt;
  final bool showDebtHeader;
  final bool expanded;
  final List<AgentOrderLineRow> detailLines;
  final List<AgentOrderLineRow> bonusLines;
  final VoidCallback? onTap;

  const AgentOrderCard({
    super.key,
    required this.title,
    this.statusLabel,
    this.statusChip,
    required this.client,
    required this.date,
    this.bonus = '0',
    required this.volume,
    required this.count,
    required this.amount,
    this.discount,
    this.debt,
    this.showDebtHeader = false,
    this.expanded = false,
    this.detailLines = const [],
    this.bonusLines = const [],
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final hasDetails = detailLines.isNotEmpty || bonusLines.isNotEmpty;
    final compactDebt = showDebtHeader;
    final hasExpandedMeta = !compactDebt &&
        (volume != '—' ||
            count != '0' ||
            amount.isNotEmpty ||
            (discount != null && discount!.isNotEmpty) ||
            bonus != '0' ||
            (debt != null && debt!.isNotEmpty));
    final hasDebtExtras = compactDebt &&
        expanded &&
        ((discount != null && discount!.isNotEmpty) || bonus != '0');

    return AgentSurfaceCard(
      padding: EdgeInsets.all(expanded && !compactDebt ? 12 : (compactDebt ? 10 : 12)),
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (compactDebt) _compactDebtHeader() else _defaultHeader(),
            AnimatedSize(
              duration: const Duration(milliseconds: 280),
              curve: Curves.easeInOut,
              alignment: Alignment.topCenter,
              child: expanded
                  ? Padding(
                      padding: EdgeInsets.only(top: compactDebt ? 8 : 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (hasExpandedMeta) ...[
                            Container(
                              decoration: BoxDecoration(
                                color: AppColors.surfaceReport,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: IntrinsicHeight(
                                child: Row(
                                  children: [
                                    Expanded(child: _statCell('Объем', volume)),
                                    const VerticalDivider(width: 1, color: AppColors.borderLight),
                                    Expanded(child: _statCell('Количество', count)),
                                    const VerticalDivider(width: 1, color: AppColors.borderLight),
                                    Expanded(child: _statCell('Сумма', amount, highlight: true)),
                                  ],
                                ),
                              ),
                            ),
                            if (discount != null && discount!.isNotEmpty) ...[
                              const SizedBox(height: 8),
                              _row('Скидка:', discount!, compact: true),
                            ],
                            if (bonus != '0' && bonusLines.isEmpty) ...[
                              const SizedBox(height: 4),
                              _row('Бонус:', bonus, compact: true),
                            ],
                            if (debt != null && debt!.isNotEmpty) ...[
                              const SizedBox(height: 4),
                              _row('Долг:', debt!, compact: true, valueColor: AppColors.error),
                            ],
                          ],
                          if (hasDebtExtras) ...[
                            if (discount != null && discount!.isNotEmpty)
                              _row('Скидка:', discount!, compact: true),
                            if (bonus != '0' && bonusLines.isEmpty) ...[
                              if (discount != null && discount!.isNotEmpty) const SizedBox(height: 4),
                              _row('Бонус:', bonus, compact: true),
                            ],
                          ],
                          if (hasDetails) ...[
                            if (hasExpandedMeta || hasDebtExtras) const SizedBox(height: 8),
                            _unifiedOrderLinesTable(
                              saleLines: detailLines,
                              bonusLines: bonusLines,
                              saleFooterQty: detailLines.isNotEmpty
                                  ? (count != '—' ? count : _sumLineQty(detailLines))
                                  : null,
                              saleFooterAmount: detailLines.isNotEmpty &&
                                      amount.isNotEmpty &&
                                      amount != '—'
                                  ? amount
                                  : null,
                              bonusFooterQty:
                                  bonusLines.isNotEmpty ? _sumLineQty(bonusLines) : null,
                              bonusFooterAmount:
                                  bonusLines.isNotEmpty && bonus != '0' ? bonus : null,
                            ),
                          ],
                        ],
                      ),
                    )
                  : const SizedBox(width: double.infinity),
            ),
          ],
        ),
      ),
    );
  }

  Widget _compactDebtHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
              ),
            ),
            AnimatedRotation(
              turns: expanded ? 0.5 : 0,
              duration: const Duration(milliseconds: 200),
              child: const Icon(Icons.expand_more, color: AppColors.textSecondary, size: 20),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(child: _row('Клиент:', client, compact: true)),
            if (statusChip != null) ...[
              const SizedBox(width: 8),
              statusChip!,
            ],
          ],
        ),
        const SizedBox(height: 4),
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(child: _row('Дата:', date, compact: true)),
            if (debt != null && debt!.isNotEmpty)
              Text(
                debt!,
                textAlign: TextAlign.right,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: AppColors.error,
                ),
              ),
          ],
        ),
      ],
    );
  }

  Widget _defaultHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
              ),
            ),
            if (statusChip != null) ...[
              const SizedBox(width: 6),
              Flexible(child: statusChip!),
            ],
            const SizedBox(width: 4),
            AnimatedRotation(
              turns: expanded ? 0.5 : 0,
              duration: const Duration(milliseconds: 200),
              child: const Icon(Icons.expand_more, color: AppColors.textSecondary, size: 20),
            ),
          ],
        ),
        const SizedBox(height: 8),
        _row('Клиент:', client, compact: true),
        const SizedBox(height: 4),
        _row('Дата:', date, compact: true),
      ],
    );
  }

  static String _sumLineQty(List<AgentOrderLineRow> lines) {
    var n = 0.0;
    for (final l in lines) {
      n += double.tryParse(l.qty.replaceAll(',', '.')) ?? 0;
    }
    if (n == n.roundToDouble()) return n.round().toString();
    return n.toStringAsFixed(1);
  }

  Widget _unifiedOrderLinesTable({
    required List<AgentOrderLineRow> saleLines,
    required List<AgentOrderLineRow> bonusLines,
    String? saleFooterQty,
    String? saleFooterAmount,
    String? bonusFooterQty,
    String? bonusFooterAmount,
  }) {
    final hasSale = saleLines.isNotEmpty;
    final hasBonus = bonusLines.isNotEmpty;
    final hasBoth = hasSale && hasBonus;
    final showSaleFooter = hasSale &&
        ((saleFooterQty != null && saleFooterQty.isNotEmpty) ||
            (saleFooterAmount != null &&
                saleFooterAmount.isNotEmpty &&
                saleFooterAmount != '0'));
    final showBonusFooter = hasBonus &&
        ((bonusFooterQty != null && bonusFooterQty.isNotEmpty) ||
            (bonusFooterAmount != null &&
                bonusFooterAmount.isNotEmpty &&
                bonusFooterAmount != '0'));

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: AppColors.surfaceReport,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: const BoxDecoration(
              color: Color(0xFFE7EEF5),
              borderRadius: BorderRadius.vertical(top: Radius.circular(10)),
            ),
            child: const Row(
              children: [
                Expanded(
                  flex: 2,
                  child: Text(
                    'Товар',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
                Expanded(
                  child: Text(
                    'Цена',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
                Expanded(
                  child: Text(
                    'Кол-во',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (hasBoth) _sectionDividerRow('Продажа', color: AppColors.textSecondary),
          ...saleLines.map((line) => _orderLineRow(line, isBonus: false)),
          if (hasBoth) _sectionDividerRow('Бонус', color: AppColors.success),
          ...bonusLines.map((line) => _orderLineRow(line, isBonus: true)),
          if (showSaleFooter || showBonusFooter)
            Container(
              decoration: const BoxDecoration(
                color: Color(0xFFDCE8F2),
                borderRadius: BorderRadius.vertical(bottom: Radius.circular(10)),
                border: Border(top: BorderSide(color: Colors.white)),
              ),
              child: Column(
                children: [
                  if (showSaleFooter)
                    _footerRow(
                      label: hasBoth ? 'Итого продажа' : 'Итого',
                      amount: saleFooterAmount,
                      qty: saleFooterQty,
                      isBonus: false,
                      showTopBorder: false,
                    ),
                  if (showBonusFooter)
                    _footerRow(
                      label: hasBoth ? 'Итого бонус' : 'Итого',
                      amount: bonusFooterAmount,
                      qty: bonusFooterQty,
                      isBonus: true,
                      showTopBorder: showSaleFooter,
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _sectionDividerRow(String label, {required Color color}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color == AppColors.success ? const Color(0xFFE8F8EE) : const Color(0xFFF1F5F9),
        border: const Border(top: BorderSide(color: Colors.white)),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: color),
      ),
    );
  }

  Widget _orderLineRow(AgentOrderLineRow line, {required bool isBonus}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: isBonus ? const Color(0xFFF4FBF6) : null,
        border: const Border(top: BorderSide(color: Colors.white)),
      ),
      child: Row(
        children: [
          if (isBonus)
            Container(
              width: 3,
              height: 28,
              margin: const EdgeInsets.only(right: 8),
              decoration: BoxDecoration(
                color: AppColors.success,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          Expanded(
            flex: 2,
            child: Text(
              line.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: isBonus ? AppColors.success : AppColors.textPrimary,
              ),
            ),
          ),
          Expanded(
            child: Text(
              line.price,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w800,
                color: isBonus ? AppColors.success : AppColors.textPrimary,
              ),
            ),
          ),
          Expanded(
            child: Text(
              line.qty,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w800,
                color: isBonus ? AppColors.success : AppColors.primary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _footerRow({
    required String label,
    String? amount,
    String? qty,
    required bool isBonus,
    required bool showTopBorder,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        border: showTopBorder ? const Border(top: BorderSide(color: Colors.white)) : null,
      ),
      child: Row(
        children: [
          Expanded(
            flex: 2,
            child: Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w800,
                color: isBonus ? AppColors.success : AppColors.textPrimary,
              ),
            ),
          ),
          Expanded(
            child: Text(
              amount ?? '—',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w800,
                color: isBonus ? AppColors.success : AppColors.primary,
              ),
            ),
          ),
          Expanded(
            child: Text(
              qty ?? '—',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w800,
                color: isBonus ? AppColors.success : AppColors.primary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _row(String l, String v, {bool compact = false, Color? valueColor}) => Row(
        children: [
          Text(l, style: TextStyle(fontSize: compact ? 13 : 14, color: AppColors.textSecondary, fontWeight: FontWeight.w600)),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              v,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: valueColor ?? AppColors.textPrimary),
            ),
          ),
        ],
      );

  Widget _statCell(String l, String v, {bool highlight = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 7, horizontal: 4),
        child: Column(
          children: [
            Text(l, style: AppTypography.caption.copyWith(fontWeight: FontWeight.w600, color: AppColors.textMuted, fontSize: 11)),
            const SizedBox(height: 2),
            Text(
              v,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: highlight ? AppColors.primary : AppColors.textPrimary,
              ),
            ),
          ],
        ),
      );
}

class AgentDebtorCard extends StatelessWidget {
  final String name;
  final String balance;
  final double? balanceAmount;
  final String? overdue;
  final String? legacyDebt;
  final String? currentDebt;
  final bool debtCollectionOnly;
  final VoidCallback? onTap;

  const AgentDebtorCard({
    super.key,
    required this.name,
    required this.balance,
    this.balanceAmount,
    this.overdue,
    this.legacyDebt,
    this.currentDebt,
    this.debtCollectionOnly = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final showSplit = (legacyDebt != null && legacyDebt!.isNotEmpty) ||
        (currentDebt != null && currentDebt!.isNotEmpty);
    return AgentSurfaceCard(
      padding: const EdgeInsets.all(16),
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(12)),
              child: const Icon(Icons.storefront_outlined, color: AppColors.textSecondary),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  Text.rich(
                    TextSpan(
                      text: 'Баланс: ',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                      children: [
                        TextSpan(
                          text: balance,
                          style: TextStyle(
                            color: colorForClientBalance(balanceAmount ?? 0),
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (debtCollectionOnly) ...[
                    const SizedBox(height: 4),
                    Text(
                      'Только сбор долга',
                      style: AppTypography.caption.copyWith(color: AppColors.warning, fontWeight: FontWeight.w700),
                    ),
                  ],
                  if (showSplit) ...[
                    const SizedBox(height: 6),
                    if (legacyDebt != null && legacyDebt!.isNotEmpty)
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Долг старого агента:', style: AppTypography.caption.copyWith(fontWeight: FontWeight.w600)),
                          Text(legacyDebt!, style: AppTypography.caption.copyWith(fontWeight: FontWeight.w800)),
                        ],
                      ),
                    if (currentDebt != null && currentDebt!.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Долг текущего агента:', style: AppTypography.caption.copyWith(fontWeight: FontWeight.w600)),
                          Text(currentDebt!, style: AppTypography.caption.copyWith(fontWeight: FontWeight.w800)),
                        ],
                      ),
                    ],
                  ],
                  if (overdue != null && overdue!.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Просрочка:', style: AppTypography.caption.copyWith(fontWeight: FontWeight.w600)),
                        Text(overdue!, style: AppTypography.caption.copyWith(color: AppColors.error, fontWeight: FontWeight.w800)),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class AgentBalanceBanner extends StatelessWidget {
  final String label;
  final String value;
  const AgentBalanceBanner({super.key, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return AgentSurfaceCard(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      margin: const EdgeInsets.only(bottom: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: AppTypography.bodyMedium.copyWith(fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
          Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.error)),
        ],
      ),
    );
  }
}

bool _isStockCountOut(String count) {
  final normalized = count.replaceAll('\u00a0', ' ').replaceAll(' ', '');
  return double.tryParse(normalized.replaceAll(',', '.')) == null;
}

class AgentExpandableStockGroup extends StatelessWidget {
  final String title;
  final bool expanded;
  final VoidCallback onToggle;
  final List<({String name, String? price, String count})> items;

  const AgentExpandableStockGroup({
    super.key,
    required this.title,
    required this.expanded,
    required this.onToggle,
    this.items = const [],
  });

  @override
  Widget build(BuildContext context) {
    return AgentSurfaceCard(
      padding: EdgeInsets.zero,
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        children: [
          InkWell(
            onTap: onToggle,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            child: SizedBox(
              height: 58,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    Expanded(child: Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800))),
                    AnimatedRotation(
                      turns: expanded ? 0.5 : 0,
                      duration: const Duration(milliseconds: 200),
                      child: const Icon(Icons.expand_more, color: AppColors.textSecondary, size: 22),
                    ),
                  ],
                ),
              ),
            ),
          ),
          if (expanded)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              child: items.isEmpty
                  ? Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(color: AppColors.surfaceReport, borderRadius: BorderRadius.circular(10)),
                      child: const Text('Bo\'sh', textAlign: TextAlign.center, style: TextStyle(color: AppColors.textMuted, fontWeight: FontWeight.w600)),
                    )
                  : Container(
                      decoration: BoxDecoration(color: AppColors.surfaceReport, borderRadius: BorderRadius.circular(10)),
                      child: Column(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            decoration: const BoxDecoration(color: Color(0xFFE7EEF5), borderRadius: BorderRadius.vertical(top: Radius.circular(10))),
                            child: const Row(
                              children: [
                                Expanded(
                                  flex: 5,
                                  child: Text('Товар', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textSecondary)),
                                ),
                                Expanded(
                                  flex: 4,
                                  child: Text('Цена', textAlign: TextAlign.right, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textSecondary)),
                                ),
                                SizedBox(
                                  width: 64,
                                  child: Text('Кол-во', textAlign: TextAlign.right, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textSecondary)),
                                ),
                              ],
                            ),
                          ),
                          ...items.asMap().entries.map((e) {
                            final it = e.value;
                            return Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                              decoration: BoxDecoration(
                                border: e.key > 0 ? const Border(top: BorderSide(color: Colors.white)) : null,
                              ),
                              child: Row(
                                children: [
                                  Expanded(
                                    flex: 5,
                                    child: Text(
                                      it.name,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                                    ),
                                  ),
                                  Expanded(
                                    flex: 4,
                                    child: Text(
                                      it.price ?? '—',
                                      textAlign: TextAlign.right,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w700,
                                        color: it.price != null ? AppColors.textPrimary : AppColors.textMuted,
                                      ),
                                    ),
                                  ),
                                  SizedBox(
                                    width: 64,
                                    child: Text(
                                      it.count,
                                      textAlign: TextAlign.right,
                                      style: TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w800,
                                        color: _isStockCountOut(it.count)
                                            ? AppColors.error
                                            : AppColors.primary,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }),
                        ],
                      ),
                    ),
            ),
        ],
      ),
    );
  }
}

/// Bo'sh ro'yxat — vizitlar sahifasidagi kabi markazda ikonka + matn.
class AgentEmptyState extends StatelessWidget {
  final String message;
  final Widget? action;
  final EdgeInsetsGeometry padding;

  const AgentEmptyState({
    super.key,
    required this.message,
    this.action,
    this.padding = const EdgeInsets.all(24),
  });

  /// Scaffold body yoki `Expanded` ichida to'liq balandlikda markazlashtirish.
  static Widget fill({
    required String message,
    Widget? action,
    EdgeInsetsGeometry padding = const EdgeInsets.all(24),
  }) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: constraints.maxHeight),
            child: Center(
              child: AgentEmptyState(message: message, action: action, padding: padding),
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          AgentEmptyArt(message: message),
          if (action != null) ...[
            const SizedBox(height: 20),
            ConstrainedBox(
              constraints: const BoxConstraints(minWidth: 200, maxWidth: 280),
              child: action!,
            ),
          ],
        ],
      ),
    );
  }
}

class AgentEmptyArt extends StatelessWidget {
  final String message;
  const AgentEmptyArt({super.key, this.message = S.empty});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.center,
          children: [
            Container(width: 150, height: 110, decoration: BoxDecoration(color: const Color(0xFFEEF3F7), borderRadius: BorderRadius.circular(12))),
            Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(18),
                boxShadow: const [BoxShadow(color: Color(0x4DCBD5E1), blurRadius: 16)],
              ),
              child: Center(
                child: Container(
                  width: 74,
                  height: 92,
                  decoration: BoxDecoration(color: const Color(0xFFEEF3F7), borderRadius: BorderRadius.circular(14)),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(4, (i) => Padding(
                          padding: EdgeInsets.only(top: i == 0 ? 0 : 6),
                          child: Container(
                            width: i == 3 ? 34 : 48,
                            height: 6,
                            decoration: BoxDecoration(color: AppColors.textDisabled, borderRadius: BorderRadius.circular(3)),
                          ),
                        ),),
                  ),
                ),
              ),
            ),
            Positioned(
              right: -8,
              bottom: -8,
              child: Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: const Color(0xFFCFD8E0),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 4),
                ),
                child: const Icon(Icons.close, color: Colors.white, size: 20),
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),
        Text(message, style: AppTypography.bodyMedium.copyWith(fontWeight: FontWeight.w700, color: AppColors.textSecondary)),
      ],
    );
  }
}

class AgentClientHeaderCard extends StatelessWidget {
  final String name;
  final String balance;
  final double? balanceAmount;
  final VoidCallback? onCall;
  final VoidCallback? onLocation;
  final Widget? nameTrailing;

  const AgentClientHeaderCard({
    super.key,
    required this.name,
    required this.balance,
    this.balanceAmount,
    this.onCall,
    this.onLocation,
    this.nameTrailing,
  });

  @override
  Widget build(BuildContext context) {
    return AgentSurfaceCard(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(12)),
                  child: const Icon(Icons.storefront_outlined, color: AppColors.textMuted),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(name, maxLines: 2, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                          ),
                          if (nameTrailing != null) nameTrailing!,
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text.rich(TextSpan(
                        text: 'Общий баланс: ',
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textMuted),
                        children: [
                          TextSpan(
                            text: balance,
                            style: TextStyle(
                              color: colorForClientBalance(balanceAmount ?? 0),
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.borderLight),
          IntrinsicHeight(
            child: Row(
              children: [
                Expanded(child: _action(Icons.phone_outlined, 'Звонок', onCall)),
                const VerticalDivider(width: 1, color: AppColors.borderLight),
                Expanded(child: _action(Icons.location_on_outlined, 'Локация', onLocation)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _action(IconData icon, String label, VoidCallback? onTap) => InkWell(
        onTap: onTap,
        child: SizedBox(
          height: 48,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 20, color: AppColors.textSecondary),
              const SizedBox(width: 8),
              Text(label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
            ],
          ),
        ),
      );
}

class AgentBottomActionBar extends StatelessWidget {
  final List<Widget> children;
  const AgentBottomActionBar({super.key, required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        boxShadow: [BoxShadow(color: Color(0x0F0F172A), blurRadius: 12, offset: Offset(0, -2))],
      ),
      child: SafeArea(top: false, child: Row(children: children)),
    );
  }
}

class AgentQuantityStepper extends StatelessWidget {
  final int value;
  final ValueChanged<int> onChanged;
  final bool disabled;

  const AgentQuantityStepper({super.key, required this.value, required this.onChanged, this.disabled = false});

  @override
  Widget build(BuildContext context) {
    return AgentEditableQuantityStepper(
      value: value.toDouble(),
      onChanged: (v) => onChanged(v.round()),
      max: 999999,
      disabled: disabled,
    );
  }
}

/// Miqdor: +/- tugmalari va markaziy qiymatga bosib klaviatura orqali kiritish.
class AgentEditableQuantityStepper extends StatefulWidget {
  final double value;
  final ValueChanged<double> onChanged;
  final double min;
  final double max;
  final double step;
  final bool disabled;

  const AgentEditableQuantityStepper({
    super.key,
    required this.value,
    required this.onChanged,
    this.min = 0,
    this.max = double.infinity,
    this.step = 1,
    this.disabled = false,
  });

  @override
  State<AgentEditableQuantityStepper> createState() => _AgentEditableQuantityStepperState();
}

class _AgentEditableQuantityStepperState extends State<AgentEditableQuantityStepper> {
  late final TextEditingController _controller;
  late final FocusNode _focusNode;
  bool _editing = false;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: _format(widget.value));
    _focusNode = FocusNode();
    _focusNode.addListener(() {
      if (!_focusNode.hasFocus && _editing) {
        _commitInput();
      }
    });
  }

  @override
  void didUpdateWidget(covariant AgentEditableQuantityStepper oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!_focusNode.hasFocus && oldWidget.value != widget.value) {
      _controller.text = _format(widget.value);
    }
  }

  @override
  void dispose() {
    _focusNode.dispose();
    _controller.dispose();
    super.dispose();
  }

  String _format(double v) {
    if (v == v.roundToDouble()) return v.round().toString();
    return v.toStringAsFixed(1);
  }

  double _clamp(double v) => v.clamp(widget.min, widget.max);

  void _apply(double next) {
    final v = _clamp(next);
    widget.onChanged(v);
    if (!_focusNode.hasFocus) {
      _controller.text = _format(v);
    }
  }

  void _step(double delta) {
    if (widget.disabled) return;
    _apply(widget.value + delta);
  }

  void _startEditing() {
    if (widget.disabled) return;
    setState(() => _editing = true);
    _controller.text = _format(widget.value);
    _controller.selection = TextSelection(baseOffset: 0, extentOffset: _controller.text.length);
    _focusNode.requestFocus();
  }

  /// Klaviatura yozish paytida ham parent (jami/savat) yangilanadi.
  void _publishDraft({required bool finalize}) {
    final raw = _controller.text.trim().replaceAll(',', '.');
    if (raw.isEmpty) {
      widget.onChanged(widget.min);
      if (finalize) {
        setState(() => _editing = false);
        _controller.text = _format(widget.min);
      }
      return;
    }
    final parsed = double.tryParse(raw);
    if (parsed == null) {
      if (finalize) {
        setState(() => _editing = false);
        _controller.text = _format(widget.value);
      }
      return;
    }
    final v = _clamp(parsed);
    widget.onChanged(v);
    if (finalize) {
      setState(() => _editing = false);
      _controller.text = _format(v);
    } else if (v != parsed) {
      // Yozish paytida ham chegaradan (min/max) oshib ketsa — darhol qaytarib
      // ko'rsatamiz (masalan zakazdagi maksimal miqdordan oshmasin).
      final t = _format(v);
      _controller.value = TextEditingValue(
        text: t,
        selection: TextSelection.collapsed(offset: t.length),
      );
    }
  }

  void _commitInput() => _publishDraft(finalize: true);

  @override
  Widget build(BuildContext context) {
    final canDecrease = !widget.disabled && widget.value > widget.min;
    final canIncrease = !widget.disabled && widget.value + widget.step <= widget.max;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _roundBtn(Icons.remove, canDecrease ? () => _step(-widget.step) : null),
        GestureDetector(
          onTap: _startEditing,
          child: SizedBox(
            width: 56,
            child: _editing
                ? TextField(
                    controller: _controller,
                    focusNode: _focusNode,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                    decoration: const InputDecoration(
                      isDense: true,
                      contentPadding: EdgeInsets.symmetric(vertical: 6),
                      border: OutlineInputBorder(),
                    ),
                    onChanged: (_) => _publishDraft(finalize: false),
                    onSubmitted: (_) => _commitInput(),
                  )
                : Text(
                    _format(widget.value),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: widget.value > 0 ? AppColors.textPrimary : AppColors.textMuted,
                    ),
                  ),
          ),
        ),
        _roundBtn(Icons.add, canIncrease ? () => _step(widget.step) : null),
      ],
    );
  }

  Widget _roundBtn(IconData icon, VoidCallback? onTap) => Material(
        color: AppColors.surfaceVariant,
        borderRadius: BorderRadius.circular(8),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(8),
          child: SizedBox(
            width: 42,
            height: 36,
            child: Icon(icon, color: onTap == null ? AppColors.textMuted.withValues(alpha: 0.4) : AppColors.textSecondary),
          ),
        ),
      );
}

class AgentFilterSheet extends ConsumerStatefulWidget {
  const AgentFilterSheet({super.key});

  static const _categoryOptions = ['B', 'A', 'C'];
  static const _visitStatusOptions = [S.dayAll, S.visitStatusVisited, S.visitStatusNotVisited];

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const AgentFilterSheet(),
    );
  }

  @override
  ConsumerState<AgentFilterSheet> createState() => _AgentFilterSheetState();
}

class _AgentFilterSheetState extends ConsumerState<AgentFilterSheet> {
  String? _category;
  String? _visitStatus = S.dayAll;
  bool? _debtsOnly;
  bool _hydrated = false;

  @override
  Widget build(BuildContext context) {
    if (!_hydrated) {
      _category = ref.read(outletCategoryFilterProvider);
      _visitStatus = ref.read(outletVisitStatusFilterProvider) ?? S.dayAll;
      _debtsOnly = ref.read(outletDebtsOnlyProvider);
      _hydrated = true;
    }
    final bottom = MediaQuery.paddingOf(context).bottom;

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      padding: EdgeInsets.fromLTRB(12, 8, 12, 16 + bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const AgentSheetHandle(),
          Stack(
            alignment: Alignment.center,
            children: [
              Text(S.filter, style: AppTypography.headlineMedium.copyWith(fontWeight: FontWeight.w800)),
              Align(
                alignment: Alignment.centerRight,
                child: Material(
                  color: AppColors.surfaceVariant,
                  shape: const CircleBorder(),
                  child: InkWell(
                    customBorder: const CircleBorder(),
                    onTap: () => Navigator.pop(context),
                    child: const SizedBox(width: 28, height: 28, child: Icon(Icons.close, size: 18)),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          AgentOutlineSelect(
            label: 'Категория',
            value: _category,
            options: AgentFilterSheet._categoryOptions,
            padding: const EdgeInsets.only(bottom: 16),
            onChanged: (v) => setState(() => _category = v),
          ),
          AgentOutlineSelect(
            label: S.visitPresenceFilter,
            value: _visitStatus,
            options: AgentFilterSheet._visitStatusOptions,
            padding: const EdgeInsets.only(bottom: 12),
            onChanged: (v) => setState(() => _visitStatus = v),
          ),
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text(S.clientsWithDebts, style: AppTypography.bodyMedium),
            value: _debtsOnly ?? false,
            activeColor: AppColors.primary,
            onChanged: (v) => setState(() => _debtsOnly = v ?? false),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: AgentSecondaryButton(label: 'Закрыть', onPressed: () => Navigator.pop(context))),
              const SizedBox(width: 12),
              Expanded(
                child: AgentPrimaryButton(
                  label: 'Применить',
                  height: 52,
                  onPressed: () {
                    ref.read(outletCategoryFilterProvider.notifier).state = _category;
                    ref.read(outletVisitStatusFilterProvider.notifier).state = _visitStatus;
                    ref.read(outletDebtsOnlyProvider.notifier).state = _debtsOnly ?? false;
                    ref.invalidate(filteredClientsProvider);
                    ref.invalidate(visitedTodayClientIdsProvider);
                    Navigator.pop(context);
                  },
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Agent sahifa — fon + pastki padding (nav bar uchun).
class AgentPageBody extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  const AgentPageBody({super.key, required this.child, this.padding});

  @override
  Widget build(BuildContext context) {
    final content = padding != null ? Padding(padding: padding!, child: child) : child;
    return ColoredBox(
      color: AppColors.background,
      child: content,
    );
  }
}

/// API xatosi — foydalanuvchiga tushunarli (401 va boshqalar).
class AgentErrorPanel extends StatelessWidget {
  final Object error;
  final VoidCallback? onRetry;
  final VoidCallback? onLogin;

  const AgentErrorPanel({
    super.key,
    required this.error,
    this.onRetry,
    this.onLogin,
  });

  bool get _is401 {
    final s = error.toString();
    return s.contains('401') || s.contains('Sessiya') || s.contains('Unauthorized');
  }

  String get _message {
    if (error is ApiException) return (error as ApiException).message;
    final s = error.toString();
    if (_is401) return 'Sessiya tugadi. Qayta kiring.';
    if (s.contains('SocketException') || s.contains('NetworkException')) {
      return 'Internet yoki server bilan bog\'lanib bo\'lmadi';
    }
    return 'Ma\'lumot yuklanmadi';
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              _is401 ? Icons.lock_outline : Icons.cloud_off_outlined,
              size: 56,
              color: AppColors.textMuted,
            ),
            const SizedBox(height: 16),
            Text(
              _message,
              textAlign: TextAlign.center,
              style: AppTypography.bodyMedium.copyWith(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 20),
            if (_is401 && onLogin != null)
              AgentPrimaryButton(label: 'Qayta kirish', height: 44, onPressed: onLogin)
            else if (onRetry != null)
              AgentPrimaryButton(label: 'Qayta urinish', height: 44, onPressed: onRetry),
          ],
        ),
      ),
    );
  }
}

/// Mijoz kartasi sarlavhasi (shablon ClientScreen).
class AgentClientDetailHeader extends StatelessWidget {
  final String name;
  final String balance;
  final double? balanceAmount;
  final String? phone;
  final VoidCallback? onCall;
  final VoidCallback? onRoute;

  const AgentClientDetailHeader({
    super.key,
    required this.name,
    required this.balance,
    this.balanceAmount,
    this.phone,
    this.onCall,
    this.onRoute,
  });

  @override
  Widget build(BuildContext context) {
    return AgentSurfaceCard(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(12)),
                  child: const Icon(Icons.storefront_outlined, color: AppColors.textMuted, size: 26),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, maxLines: 2, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 4),
                      Text.rich(
                        TextSpan(
                          text: 'Umumiy balans: ',
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textMuted),
                          children: [
                            TextSpan(
                              text: balance,
                              style: TextStyle(
                                color: colorForClientBalance(balanceAmount ?? 0),
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (phone != null && phone!.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            const Icon(Icons.phone_outlined, size: 16, color: AppColors.primary),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(phone!, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.borderLight),
          IntrinsicHeight(
            child: Row(
              children: [
                Expanded(child: _act(Icons.phone_outlined, 'Qo\'ng\'iroq', onCall)),
                const VerticalDivider(width: 1, color: AppColors.borderLight),
                Expanded(child: _act(Icons.location_on_outlined, 'Lokatsiya', onRoute)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _act(IconData icon, String label, VoidCallback? onTap) => InkWell(
        onTap: onTap,
        child: SizedBox(
          height: 52,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 22, color: AppColors.primary),
              const SizedBox(width: 8),
              Text(label, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.primary)),
            ],
          ),
        ),
      );
}

class AgentRouteInfoBox extends StatelessWidget {
  final String clientName;
  final String owner;

  const AgentRouteInfoBox({super.key, required this.clientName, this.owner = ''});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: AppColors.surfaceMuted, borderRadius: BorderRadius.circular(10)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.location_on_outlined, size: 16, color: AppColors.primary),
              const SizedBox(width: 8),
              Expanded(
                child: Text.rich(
                  TextSpan(
                    text: 'Marshrut: ',
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.primary),
                    children: [
                      TextSpan(
                        text: '$clientName${owner.isNotEmpty ? ' — $owner' : ''}',
                        style: const TextStyle(color: AppColors.textSecondary, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.schedule, size: 16, color: AppColors.textMuted),
              SizedBox(width: 8),
              Expanded(child: Text('Marshrut chizilgan — mijozga biriktirilgan', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary))),
            ],
          ),
        ],
      ),
    );
  }
}

/// Mijoz / buyurtma amallari (shablon «Действия заказа»).
Future<void> showAgentClientActionsSheet(
  BuildContext context, {
  required VoidCallback onPhotoReport,
  VoidCallback? onRefusal,
  VoidCallback? onCreateOrder,
  VoidCallback? onEdit,
  VoidCallback? onSupervisionChecklist,
  bool photoReportEnabled = true,
  bool refusalEnabled = true,
  bool createOrderEnabled = true,
  bool editEnabled = false,
  bool supervisionEnabled = false,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) {
      Widget actionTile({
        required IconData icon,
        required String title,
        required VoidCallback? onTap,
        bool enabled = true,
        String? soonBadge,
      }) {
        final color = enabled ? AppColors.primary : AppColors.textMuted;
        return ListTile(
          enabled: enabled,
          leading: Icon(icon, color: color),
          title: Text(title, style: TextStyle(fontWeight: FontWeight.w600, color: enabled ? null : AppColors.textMuted)),
          trailing: soonBadge != null
              ? Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE8F8F3),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(soonBadge, style: const TextStyle(color: Color(0xFF1AA39B), fontWeight: FontWeight.w700, fontSize: 12)),
                )
              : null,
          onTap: enabled && onTap != null
              ? () {
                  Navigator.pop(ctx);
                  onTap();
                }
              : null,
        );
      }

      return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const AgentSheetHandle(),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 12, 0),
              child: Row(
                children: [
                  const Expanded(
                    child: Text('Действия заказа', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                  ),
                  IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
                ],
              ),
            ),
            actionTile(icon: Icons.photo_camera_outlined, title: 'Фото отчёт', onTap: onPhotoReport, enabled: photoReportEnabled),
            if (refusalEnabled && onRefusal != null)
              actionTile(icon: Icons.close, title: 'Отказ', onTap: onRefusal),
            if (createOrderEnabled && onCreateOrder != null)
              actionTile(icon: Icons.add_shopping_cart_outlined, title: 'Добавить заказ', onTap: onCreateOrder),
            if (editEnabled && onEdit != null)
              actionTile(icon: Icons.edit_outlined, title: 'Редактировать', onTap: onEdit),
            if (supervisionEnabled && onSupervisionChecklist != null)
              actionTile(icon: Icons.checklist_outlined, title: 'Audit checklist', onTap: onSupervisionChecklist),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    },
  );
}

/// Buyurtmalar xulosasi (shablon #18).
class AgentOrdersHeroCard extends StatelessWidget {
  final String totalSum;
  final int totalCount;
  final int inProgressCount;
  final String debtLabel;

  const AgentOrdersHeroCard({
    super.key,
    required this.totalSum,
    required this.totalCount,
    required this.inProgressCount,
    required this.debtLabel,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: const LinearGradient(
          colors: [Color(0xFF07958F), Color(0xFF055B57)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'МЕНИНГ ЗАКАЗЛАРИМ',
            style: AppTypography.caption.copyWith(
              color: Colors.white.withValues(alpha: 0.85),
              fontWeight: FontWeight.w800,
              letterSpacing: 0.6,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '$totalSum сум',
            style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: Colors.white),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: _stat('Жами', '$totalCount')),
              Expanded(child: _stat('В процессе', '$inProgressCount')),
              Expanded(child: _stat('Қарз', debtLabel)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _stat(String label, String value) {
    return Column(
      children: [
        Text(label, style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.75))),
        const SizedBox(height: 2),
        Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white)),
      ],
    );
  }
}

/// Kutilayotgan zakaz (taymer bilan).
class AgentHeldOrderCard extends StatelessWidget {
  final String clientName;
  final String countdown;
  final String sumLabel;
  final int itemCount;
  final VoidCallback? onTap;
  final VoidCallback? onCancel;

  const AgentHeldOrderCard({
    super.key,
    required this.clientName,
    required this.countdown,
    required this.sumLabel,
    required this.itemCount,
    this.onTap,
    this.onCancel,
  });

  @override
  Widget build(BuildContext context) {
    return AgentSurfaceCard(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          Expanded(
            child: InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(12),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppColors.warningSoft,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.warning.withValues(alpha: 0.35)),
                    ),
                    alignment: Alignment.center,
                    child: const Icon(Icons.timer_outlined, color: AppColors.warning, size: 22),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Text('Ожидает синхр.', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.warning.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                countdown,
                                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.warning),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(clientName, style: AppTypography.bodySmall.copyWith(fontWeight: FontWeight.w700)),
                        Text(
                          '$itemCount поз. · $sumLabel · нажмите, чтобы изменить',
                          style: AppTypography.caption.copyWith(color: AppColors.textMuted),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.edit_outlined, color: AppColors.textMuted, size: 20),
                ],
              ),
            ),
          ),
          if (onCancel != null) ...[
            const SizedBox(width: 4),
            IconButton(
              tooltip: 'Отменить заказ',
              onPressed: onCancel,
              icon: const Icon(Icons.close, color: AppColors.error, size: 22),
            ),
          ],
        ],
      ),
    );
  }
}

/// Zakaz status pipeline (shablon #18).
class AgentOrderStatusPipeline extends StatelessWidget {
  final String statusLabel;

  const AgentOrderStatusPipeline({super.key, required this.statusLabel});

  @override
  Widget build(BuildContext context) {
    final s = statusLabel.toLowerCase();
    int active = 0;
    if (s.contains('достав') || s.contains('deliver')) {
      active = 3;
    } else if (s.contains('пути') || s.contains('transit') || s.contains('в пути')) {
      active = 2;
    } else if (s.contains('собран') || s.contains('collect')) {
      active = 1;
    } else {
      active = 0;
    }
    const colors = [Color(0xFF2563EB), Color(0xFF64748B), AppColors.warning, AppColors.success];
    return Row(
      children: List.generate(4, (i) {
        final on = i <= active;
        return Expanded(
          child: Container(
            margin: EdgeInsets.only(right: i < 3 ? 2 : 0),
            height: 3,
            decoration: BoxDecoration(
              color: on ? colors[i] : const Color(0xFFE5EDF3),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
        );
      }),
    );
  }
}

/// Bonus yoki skidka pog‘onasi (shablon #29 — sariq / shafq rang).
class AgentTierStrip extends StatelessWidget {
  final String kind; // 'bonus' | 'discount'
  final int currentQty;
  final List<Map<String, dynamic>> tiers; // [{qty: 5, reward: '+1шт'}, ...]
  final String? subtitle;
  /// Tanlangan / hisoblangan bonus dona (masalan 3/5).
  final int? earnedBonusQty;
  final int? maxBonusQty;
  /// Keyingi pog‘ona uchun maxsus matn (assortiment rejimida).
  final String? nextHintOverride;
  /// Ichki qismlarda tashqi margin yo‘q.
  final bool embedded;
  final bool compact;
  final Widget? trailing;

  const AgentTierStrip({
    super.key,
    required this.kind,
    required this.currentQty,
    required this.tiers,
    this.subtitle,
    this.earnedBonusQty,
    this.maxBonusQty,
    this.nextHintOverride,
    this.embedded = false,
    this.compact = false,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    if (tiers.isEmpty) return const SizedBox.shrink();

    final isBonus = kind == 'bonus';
    final bg = isBonus ? AppColors.bonusBg : AppColors.discBg;
    final bg2 = isBonus ? AppColors.bonusBg2 : AppColors.discBg2;
    final ink = isBonus ? AppColors.bonusInk : AppColors.discInk;
    final accent = isBonus ? AppColors.bonusAccent : AppColors.discAccent;
    final icon = isBonus ? '🎁' : '🏷';
    final label = isBonus ? 'БОНУС АКЦИЯ' : 'СКИДКА';

    final maxQty = tiers.last['qty'] as int;
    final next = tiers.cast<Map<String, dynamic>>().firstWhere(
          (t) => (t['qty'] as int) > currentQty,
          orElse: () => tiers.last,
        );
    final nextQty = next['qty'] as int;
    final hasNextTier = nextQty > currentQty;
    final pct = !hasNextTier
        ? 1.0
        : maxQty > 0
            ? (currentQty / maxQty).clamp(0.0, 1.0)
            : 0.0;
    final showTierLadder = !isBonus;
    final statusTopRight = isBonus && compact;

    final footerParts = <String>[];
    if (isBonus && earnedBonusQty != null && maxBonusQty != null && maxBonusQty! > 0) {
      footerParts.add('$earnedBonusQty/$maxBonusQty');
    }
    if (nextHintOverride != null && nextHintOverride!.trim().isNotEmpty) {
      footerParts.add(nextHintOverride!.trim());
    } else if (hasNextTier) {
      final remaining = nextQty - currentQty;
      final increment = next['increment'] as String? ?? next['reward'] as String;
      footerParts.add('ещё $remaining → $increment');
    } else if (isBonus && earnedBonusQty != null && earnedBonusQty! > 0 && !statusTopRight) {
      footerParts.add('получено +$earnedBonusQty шт');
    }
    final footer = footerParts.join(' · ');
    final statusPrimary = isBonus && earnedBonusQty != null && maxBonusQty != null && maxBonusQty! > 0
        ? '$earnedBonusQty/$maxBonusQty'
        : null;
    String? statusSecondary;
    if (nextHintOverride != null && nextHintOverride!.trim().isNotEmpty) {
      statusSecondary = nextHintOverride!.trim();
    } else if (hasNextTier) {
      final remaining = nextQty - currentQty;
      final increment = next['increment'] as String? ?? next['reward'] as String;
      statusSecondary = 'ещё $remaining → $increment';
    } else if (isBonus && earnedBonusQty != null && earnedBonusQty! > 0) {
      statusSecondary = '+$earnedBonusQty шт';
    }

    final hPad = compact ? 10.0 : 12.0;
    final vPad = compact ? 6.0 : 8.0;
    final bottomPad = compact ? (statusTopRight ? 4.0 : 7.0) : 10.0;

    return Container(
      margin: embedded ? EdgeInsets.zero : const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(embedded ? 0 : 12),
        border: embedded ? null : Border.all(color: bg2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(hPad, compact ? 7 : 9, hPad, statusTopRight ? 4 : 0),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(icon, style: TextStyle(fontSize: compact ? 13 : 14)),
                const SizedBox(width: 6),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        label,
                        style: TextStyle(
                          fontSize: compact ? 11 : 11.5,
                          fontWeight: FontWeight.w800,
                          color: ink,
                          letterSpacing: 0.04,
                        ),
                      ),
                      if (subtitle != null && subtitle!.trim().isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text(
                            subtitle!,
                            style: AppTypography.caption.copyWith(
                              color: ink,
                              fontWeight: FontWeight.w600,
                              fontSize: compact ? 12 : null,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                    ],
                  ),
                ),
                if (statusTopRight && statusPrimary != null)
                  Padding(
                    padding: const EdgeInsets.only(left: 6),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              'Бонус: $statusPrimary',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                color: accent,
                                height: 1.15,
                              ),
                              textAlign: TextAlign.right,
                            ),
                            if (statusSecondary != null)
                              Text(
                                statusSecondary,
                                style: TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w600,
                                  color: ink,
                                  height: 1.15,
                                ),
                                textAlign: TextAlign.right,
                              ),
                          ],
                        ),
                        if (trailing != null) ...[
                          const SizedBox(width: 2),
                          trailing!,
                        ],
                      ],
                    ),
                  )
                else if (trailing != null)
                  trailing!,
              ],
            ),
          ),
          if (!statusTopRight && subtitle != null && subtitle!.trim().isNotEmpty)
            Padding(
              padding: EdgeInsets.fromLTRB(hPad, 3, hPad, 0),
              child: Text(
                subtitle!,
                style: AppTypography.caption.copyWith(
                  color: ink,
                  fontWeight: FontWeight.w600,
                  fontSize: compact ? 11 : null,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          if ((footer.isNotEmpty && !statusTopRight) || showTierLadder)
            Padding(
              padding: EdgeInsets.fromLTRB(hPad, vPad, hPad, bottomPad),
              child: Column(
                children: [
                  if (showTierLadder) ...[
                    ClipRRect(
                      borderRadius: BorderRadius.circular(3),
                      child: LinearProgressIndicator(
                        value: pct,
                        backgroundColor: bg2,
                        valueColor: AlwaysStoppedAnimation<Color>(accent),
                        minHeight: compact ? 5 : 6,
                      ),
                    ),
                    SizedBox(height: compact ? 4 : 6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: tiers.map<Widget>((t) {
                        final qty = t['qty'] as int;
                        final reached = currentQty >= qty;
                        return Flexible(
                          child: Column(
                            children: [
                              Text(
                                '${qty}шт',
                                style: TextStyle(
                                  fontSize: compact ? 10 : 10.5,
                                  fontWeight: FontWeight.w700,
                                  color: ink.withValues(alpha: reached ? 1 : 0.55),
                                ),
                              ),
                              Text(
                                t['reward'] as String,
                                style: TextStyle(
                                  fontSize: compact ? 9.5 : 10,
                                  color: reached ? accent : ink.withValues(alpha: 0.75),
                                  fontWeight: reached ? FontWeight.w700 : FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                  if (footer.isNotEmpty && !statusTopRight)
                    Padding(
                      padding: EdgeInsets.only(top: showTierLadder ? (compact ? 4 : 6) : 0),
                      child: Text(
                        footer,
                        style: TextStyle(
                          fontSize: compact ? 10.5 : 11,
                          fontWeight: FontWeight.w600,
                          color: ink,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
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
