import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../clients/agent_outlet_filters_provider.dart';
import '../config/tenant_references.dart';
import '../format/money_display.dart';
import '../gps/gps_tracker.dart';
import '../l10n/app_strings_ru.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';
import 'agent_ui.dart';

/// Shablon Screen 7: hafta kunlari (Все + Пн–Вс).
class AgentVisitsWeekTabs extends ConsumerWidget {
  const AgentVisitsWeekTabs({super.key});

  static const _dayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected = ref.watch(outletWeekdayTabProvider);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          _dayChip(
            label: S.dayAll,
            weekday: 0,
            selected: selected,
            onTap: () => ref.read(outletWeekdayTabProvider.notifier).state = 0,
            isAll: true,
          ),
          ...List.generate(_dayLabels.length, (i) {
            final weekday = i + 1;
            return _dayChip(
              label: _dayLabels[i],
              weekday: weekday,
              selected: selected,
              onTap: () => ref.read(outletWeekdayTabProvider.notifier).state = weekday,
            );
          }),
        ],
      ),
    );
  }

  Widget _dayChip({
    required String label,
    required int weekday,
    required int selected,
    required VoidCallback onTap,
    bool isAll = false,
  }) {
    final active = selected == weekday;
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          margin: EdgeInsets.only(right: weekday < 7 ? 7 : 0),
          padding: EdgeInsets.symmetric(vertical: 9, horizontal: isAll ? 4 : 0),
          decoration: BoxDecoration(
            color: active ? AppColors.primary : Colors.white,
            borderRadius: BorderRadius.circular(11),
            border: Border.all(color: active ? AppColors.primary : const Color(0xFFE4ECF2)),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTypography.bodySmall.copyWith(
              fontSize: isAll ? 11.5 : 12,
              fontWeight: FontWeight.w700,
              color: active ? Colors.white : AppColors.textMuted,
            ),
          ),
        ),
      ),
    );
  }
}

/// Shablon Screen 7: yashil GPS banner.
class AgentVisitGpsBanner extends ConsumerWidget {
  const AgentVisitGpsBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final gps = ref.watch(gpsTrackerProvider);
    final active = gps.status == GpsStatus.tracking;
    final accuracy = gps.lastPosition?.accuracy;
    final accuracyLabel = accuracy != null ? '${accuracy.round()}м' : '12м';

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        height: 38,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: AppColors.successSoft,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(
              Icons.location_on_rounded,
              size: 16,
              color: active ? const Color(0xFF157F3A) : AppColors.textMuted,
            ),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                active
                    ? '${S.gpsActive} · ${S.gpsAccuracy} $accuracyLabel'
                    : S.gpsStarting,
                style: AppTypography.bodySmall.copyWith(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: const Color(0xFF157F3A),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Shablon outlet kartochkasi (vizitlar ro‘yxati).
class AgentVisitOutletCard extends StatelessWidget {
  final String name;
  final String code;
  final String grade;
  final double? balanceAmount;
  final bool hasDraft;
  final bool visited;
  final VoidCallback? onTap;

  const AgentVisitOutletCard({
    super.key,
    required this.name,
    required this.code,
    required this.grade,
    this.balanceAmount,
    this.hasDraft = false,
    this.visited = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(16),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(13),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5FF),
                          borderRadius: BorderRadius.circular(7),
                        ),
                        child: Text(
                          grade,
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF3449A8),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(code, style: AppTypography.captionSmall),
                      if (hasDraft) ...[
                        const SizedBox(width: 8),
                        _pill(S.draftBadge, const Color(0xFFEFF6FF), const Color(0xFF1D4ED8)),
                      ],
                      if (visited) ...[
                        const SizedBox(width: 8),
                        _pill(S.visitedBadge, AppColors.successSoft, const Color(0xFF157F3A)),
                      ],
                      const Spacer(),
                      Icon(Icons.chevron_right_rounded, color: AppColors.textMuted.withValues(alpha: 0.5), size: 20),
                    ],
                  ),
                  const SizedBox(height: 7),
                  Text(
                    name,
                    style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700, height: 1.2),
                  ),
                  if (balanceAmount != null) ...[
                    const SizedBox(height: 6),
                    ClientBalanceText(amount: balanceAmount!),
                  ],
                ],
              ),
            ),
            if (visited)
              Container(
                height: 3,
                color: AppColors.success,
              ),
          ],
        ),
      ),
    );
  }

  Widget _pill(String label, Color bg, Color fg) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(22)),
      child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: fg)),
    );
  }
}

/// Shablon Screen 8: yaqin mijoz qatori.
class StartVisitClientTile extends StatelessWidget {
  final String name;
  final String code;
  final String? distanceLabel;
  final VoidCallback? onTap;

  const StartVisitClientTile({
    super.key,
    required this.name,
    required this.code,
    this.distanceLabel,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final dist = distanceLabel ?? '';
    final isNear = dist.contains('м') && !dist.contains('к');
    return AgentOnboardingCard(
      padding: const EdgeInsets.all(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    '$code · ${S.noOrderToday}',
                    style: AppTypography.captionSmall.copyWith(color: AppColors.textMuted),
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                if (dist.isNotEmpty)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                    decoration: BoxDecoration(
                      color: isNear ? AppColors.successSoft : AppColors.warningSoft,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      dist,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: isNear ? const Color(0xFF157F3A) : const Color(0xFF9A4D00),
                      ),
                    ),
                  ),
                const SizedBox(height: 4),
                Icon(Icons.chevron_right_rounded, color: AppColors.textMuted.withValues(alpha: 0.55), size: 20),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Shablon Screen 9: LIVE taymer.
class AgentLiveStopwatch extends StatefulWidget {
  final int startSeconds;
  final bool running;

  const AgentLiveStopwatch({
    super.key,
    this.startSeconds = 0,
    this.running = true,
  });

  @override
  State<AgentLiveStopwatch> createState() => _AgentLiveStopwatchState();
}

class _AgentLiveStopwatchState extends State<AgentLiveStopwatch> {
  late int _seconds;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _seconds = widget.startSeconds;
    if (widget.running) _start();
  }

  @override
  void didUpdateWidget(AgentLiveStopwatch oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.startSeconds != oldWidget.startSeconds) {
      _seconds = widget.startSeconds;
    }
  }

  void _start() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _seconds++);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  String get _timeStr {
    final h = (_seconds ~/ 3600).toString().padLeft(2, '0');
    final m = ((_seconds % 3600) ~/ 60).toString().padLeft(2, '0');
    final s = (_seconds % 60).toString().padLeft(2, '0');
    return '$h:$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.primary, Color(0xFF05726D)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.28),
            blurRadius: 30,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Row(
        children: [
          SizedBox(
            width: 44,
            height: 44,
            child: Stack(
              alignment: Alignment.center,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.18),
                    shape: BoxShape.circle,
                  ),
                ),
                Container(
                  width: 10,
                  height: 10,
                  decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  S.visitActiveLive,
                  style: AppTypography.captionSmall.copyWith(
                    color: Colors.white.withValues(alpha: 0.8),
                    letterSpacing: 0.8,
                  ),
                ),
                Text(
                  _timeStr,
                  style: const TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
          ),
          Column(
            children: [
              _SwatchButton(icon: Icons.pause_rounded),
              const SizedBox(height: 6),
              _SwatchButton(icon: Icons.replay_rounded),
            ],
          ),
        ],
      ),
    );
  }
}

class _SwatchButton extends StatelessWidget {
  final IconData icon;
  const _SwatchButton({required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 36,
      height: 36,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Icon(icon, color: Colors.white, size: 16),
    );
  }
}

/// Shablon Screen 9: pastki amallar paneli.
class AgentVisitActionsSheet extends StatelessWidget {
  final String clientName;
  final String subtitle;
  final VoidCallback? onPhotoReport;
  final VoidCallback? onCreateOrder;
  final VoidCallback? onRefusal;
  final VoidCallback? onSupervision;
  final VoidCallback? onComplete;
  final bool createOrderEnabled;
  final bool supervisionEnabled;

  const AgentVisitActionsSheet({
    super.key,
    required this.clientName,
    required this.subtitle,
    this.onPhotoReport,
    this.onCreateOrder,
    this.onRefusal,
    this.onSupervision,
    this.onComplete,
    this.createOrderEnabled = true,
    this.supervisionEnabled = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [BoxShadow(color: Color(0x240C2236), blurRadius: 40, offset: Offset(0, -16))],
        border: Border(top: BorderSide(color: Color(0xFFE4ECF2))),
      ),
      padding: const EdgeInsets.fromLTRB(18, 10, 18, 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Center(
            child: Container(
              width: 44,
              height: 5,
              decoration: BoxDecoration(
                color: const Color(0xFFD6DFE6),
                borderRadius: BorderRadius.circular(3),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(clientName, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          Text(subtitle, style: AppTypography.captionSmall.copyWith(color: AppColors.textMuted)),
          const SizedBox(height: 14),
          _action(Icons.camera_alt_rounded, S.photoReport, onPhotoReport, iconColor: Colors.blue),
          if (createOrderEnabled)
            _action(Icons.shopping_cart_rounded, S.createOrderAction, onCreateOrder, iconColor: AppColors.primary),
          _action(Icons.block_rounded, S.refusalAction, onRefusal, iconColor: AppColors.error),
          if (supervisionEnabled)
            _action(Icons.checklist_rounded, S.supervisionChecklist, onSupervision, iconColor: const Color(0xFF0D9488)),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton(
              onPressed: onComplete,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.error,
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: Text(S.visitComplete, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            S.visitEndHint,
            textAlign: TextAlign.center,
            style: AppTypography.captionSmall.copyWith(fontSize: 10, color: AppColors.textMuted),
          ),
        ],
      ),
    );
  }

  Widget _action(IconData icon, String label, VoidCallback? onTap, {Color? iconColor}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: Material(
        color: const Color(0xFFF7FAFC),
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            height: 56,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE8EEF2)),
            ),
            child: Row(
              children: [
                Icon(icon, color: iconColor ?? AppColors.primary, size: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                ),
                Icon(Icons.chevron_right_rounded, color: AppColors.textMuted.withValues(alpha: 0.55), size: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Shablon Screen 10: rad etish sababi (pastki modal).
Future<RefEntry?> showRefusalReasonSheet(
  BuildContext context,
  List<RefEntry> reasons,
) {
  return showModalBottomSheet<RefEntry>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => _RefusalReasonSheet(reasons: reasons),
  );
}

class _RefusalReasonSheet extends StatefulWidget {
  final List<RefEntry> reasons;

  const _RefusalReasonSheet({required this.reasons});

  @override
  State<_RefusalReasonSheet> createState() => _RefusalReasonSheetState();
}

class _RefusalReasonSheetState extends State<_RefusalReasonSheet> {
  RefEntry? _selected;

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.fromLTRB(18, 12, 18, 16 + bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 44,
              height: 5,
              decoration: BoxDecoration(
                color: const Color(0xFFD6DFE6),
                borderRadius: BorderRadius.circular(3),
              ),
            ),
          ),
          const SizedBox(height: 14),
          Text(S.refuseReason, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
          const SizedBox(height: 14),
          ...widget.reasons.map((r) {
            final active = _selected?.id == r.id;
            return Padding(
              padding: const EdgeInsets.only(bottom: 9),
              child: Material(
                color: active ? AppColors.primary.withValues(alpha: 0.06) : const Color(0xFFF7FAFC),
                borderRadius: BorderRadius.circular(13),
                child: InkWell(
                  onTap: () => setState(() => _selected = r),
                  borderRadius: BorderRadius.circular(13),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(13),
                      border: Border.all(
                        color: active ? AppColors.primary : const Color(0xFFE6ECF1),
                        width: active ? 1.5 : 1,
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          active ? Icons.radio_button_checked : Icons.radio_button_off,
                          size: 20,
                          color: active ? AppColors.primary : AppColors.textMuted,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(r.name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          }),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(0, 48),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: Text(S.cancel, style: const TextStyle(fontWeight: FontWeight.w700)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton(
                  onPressed: _selected == null ? null : () => Navigator.pop(context, _selected),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    minimumSize: const Size(0, 48),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: Text(S.save, style: const TextStyle(fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

String formatVisitDistance(double? meters) {
  if (meters == null) return '';
  if (meters < 1000) return '${meters.round()}м';
  return '${(meters / 1000).toStringAsFixed(1)} км';
}

int visitElapsedSeconds(String? startTimeIso) {
  if (startTimeIso == null || startTimeIso.isEmpty) return 0;
  final start = DateTime.tryParse(startTimeIso);
  if (start == null) return 0;
  return DateTime.now().difference(start).inSeconds.clamp(0, 999999);
}
