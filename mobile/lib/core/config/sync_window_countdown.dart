import 'dart:async';

import 'package:flutter/material.dart';

import '../l10n/app_strings_ru.dart';
import '../notifications/mobile_local_notification_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';
import 'mobile_config.dart';
import 'mobile_config_policy.dart';
import 'sync_countdown_colors.dart';
import '../time/server_clock.dart';
import '../time/work_region_time.dart';

int? _parseHmMinutes(String hm) {
  final p = hm.split(':');
  if (p.length < 2) return null;
  final h = int.tryParse(p[0]);
  final m = int.tryParse(p[1]);
  if (h == null || m == null || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

DateTime? _todayAtHm(String hm, DateTime nowLocal) {
  final mins = _parseHmMinutes(hm);
  if (mins == null) return null;
  return DateTime(nowLocal.year, nowLocal.month, nowLocal.day).add(Duration(minutes: mins));
}

/// Sinхron oynasi tugashiga qolgan vaqt (oyna ichida).
Duration? timeUntilSyncWindowEnd(SyncConfig sync, DateTime nowLocal) {
  sync = effectiveSyncConfig(sync);
  if (!isSyncAllowedNow(sync, nowLocal)) return null;

  final from = sync.allowedWindowFrom?.trim();
  final to = sync.allowedWindowTo?.trim();
  final fromM = from != null && from.isNotEmpty ? _parseHmMinutes(from) : null;
  final toM = to != null && to.isNotEmpty ? _parseHmMinutes(to) : null;

  if (toM != null) {
    final end = _syncWindowEndDateTime(
      nowLocal: nowLocal,
      toHm: to!,
      fromM: fromM,
      toM: toM,
    );
    if (end == null) return null;
    final diff = end.difference(nowLocal);
    return diff.isNegative ? Duration.zero : diff;
  }

  // Faqat `from` — kun oxirigacha (23:59:59).
  final endOfDay = DateTime(nowLocal.year, nowLocal.month, nowLocal.day, 23, 59, 59);
  final diff = endOfDay.difference(nowLocal);
  return diff.isNegative ? Duration.zero : diff;
}

DateTime? _syncWindowEndDateTime({
  required DateTime nowLocal,
  required String toHm,
  required int? fromM,
  required int toM,
}) {
  final endToday = _todayAtHm(toHm, nowLocal);
  if (endToday == null) return null;
  final nowM = syncWindowMinutesOfDay(nowLocal);

  if (fromM != null && fromM > toM) {
    if (nowM >= fromM) return endToday.add(const Duration(days: 1));
    return endToday;
  }

  if (!endToday.isAfter(nowLocal)) return null;
  return endToday;
}

/// Sinхрон oynasi boshlanishiga qolgan vaqt (oynadan oldin).
Duration? timeUntilSyncWindowStart(SyncConfig sync, DateTime nowLocal) {
  sync = effectiveSyncConfig(sync);
  if (isSyncAllowedNow(sync, nowLocal)) return null;

  final from = sync.allowedWindowFrom?.trim();
  final to = sync.allowedWindowTo?.trim();
  final fromM = from != null && from.isNotEmpty ? _parseHmMinutes(from) : null;
  final toM = to != null && to.isNotEmpty ? _parseHmMinutes(to) : null;
  final nowM = syncWindowMinutesOfDay(nowLocal);

  if (fromM == null && toM != null) {
    if (nowM <= toM) return null;
    final midnight = DateTime(nowLocal.year, nowLocal.month, nowLocal.day).add(const Duration(days: 1));
    final diff = midnight.difference(nowLocal);
    return diff.isNegative ? Duration.zero : diff;
  }

  if (fromM == null) return null;

  final start = _todayAtHm(from!, nowLocal);
  if (start == null) return null;

  var diff = start.difference(nowLocal);
  if (diff.isNegative || (toM != null && nowM > toM)) {
    diff = start.add(const Duration(days: 1)).difference(nowLocal);
  }
  return diff.isNegative ? Duration.zero : diff;
}

String formatCountdownHms(Duration d) {
  final t = d.inSeconds.clamp(0, 24 * 3600);
  final h = t ~/ 3600;
  final m = (t % 3600) ~/ 60;
  final s = t % 60;
  return '${h.toString().padLeft(2, '0')}:'
      '${m.toString().padLeft(2, '0')}:'
      '${s.toString().padLeft(2, '0')}';
}

/// Sinхron oynasi tugashiga qolgan teskari taymer (strip yoki AppBar inline).
String formatCountdownShort(Duration d) {
  final t = d.inSeconds.clamp(0, 24 * 3600);
  final h = t ~/ 3600;
  final m = (t % 3600) ~/ 60;
  final s = t % 60;
  if (h > 0) {
    return '$h:${m.toString().padLeft(2, '0')}';
  }
  return '$m:${s.toString().padLeft(2, '0')}';
}

class SyncWindowCountdownStrip extends StatefulWidget {
  final SyncConfig syncConfig;
  final bool inline;
  final bool designPill;

  const SyncWindowCountdownStrip({
    super.key,
    required this.syncConfig,
    this.inline = false,
    this.designPill = false,
  });

  @override
  State<SyncWindowCountdownStrip> createState() => _SyncWindowCountdownStripState();
}

class _SyncWindowCountdownStripState extends State<SyncWindowCountdownStrip> {
  late Duration _tick = Duration.zero;
  bool _show = false;
  bool _isWindowEnd = true;
  String _label = '';
  String _windowKey = '';
  Timer? _refreshTimer;
  bool _permissionAsked = false;

  @override
  void initState() {
    super.initState();
    _refresh();
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (_) => _refresh());
  }

  @override
  void didUpdateWidget(covariant SyncWindowCountdownStrip oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.syncConfig.allowedWindowFrom != widget.syncConfig.allowedWindowFrom ||
        oldWidget.syncConfig.allowedWindowTo != widget.syncConfig.allowedWindowTo) {
      _refresh();
    }
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  void _refresh() {
    // Server bilan vaqt langarlanmaguncha taymerni ko‘rsatmaymiz — qurilma
    // soatiga asoslangan chalg‘ituvchi/aldovchi hisobni oldini olamiz.
    if (!ServerClock.instance.hasAnchor) {
      _show = false;
      if (mounted) setState(() {});
      return;
    }
    final nowLocal = syncWindowClockNow();
    final end = timeUntilSyncWindowEnd(widget.syncConfig, nowLocal);
    final start = timeUntilSyncWindowStart(widget.syncConfig, nowLocal);
    if (end != null) {
      _tick = end;
      _label = S.syncWindowEndsIn;
      _isWindowEnd = true;
      _windowKey = widget.syncConfig.allowedWindowTo?.trim() ?? 'eod';
      _show = true;
      if (!_permissionAsked) {
        _permissionAsked = true;
        unawaited(MobileLocalNotificationService.instance.ensureNotificationPermission());
      }
    } else if (start != null) {
      _tick = start;
      _label = S.syncWindowStartsIn;
      _isWindowEnd = false;
      _windowKey = widget.syncConfig.allowedWindowFrom?.trim() ?? 'start';
      _show = true;
    } else {
      _show = false;
    }
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    if (!_show) return const SizedBox.shrink();
    return TickerMode(
      enabled: true,
      child: _CountdownTicker(
        key: ValueKey('$_label-${widget.syncConfig.allowedWindowTo}'),
        initial: _tick,
        label: _label,
        inline: widget.inline,
        designPill: widget.designPill,
        isWindowEnd: _isWindowEnd,
        windowKey: _windowKey,
        onExpired: _refresh,
      ),
    );
  }
}

class _CountdownTicker extends StatefulWidget {
  final Duration initial;
  final String label;
  final bool inline;
  final bool designPill;
  final bool isWindowEnd;
  final String windowKey;
  final VoidCallback onExpired;

  const _CountdownTicker({
    super.key,
    required this.initial,
    required this.label,
    this.inline = false,
    this.designPill = false,
    required this.isWindowEnd,
    required this.windowKey,
    required this.onExpired,
  });

  @override
  State<_CountdownTicker> createState() => _CountdownTickerState();
}

class _CountdownTickerState extends State<_CountdownTicker> {
  late Duration _left = widget.initial;

  @override
  void initState() {
    super.initState();
    Future<void>.delayed(const Duration(seconds: 1), _tick);
  }

  void _maybeFireTenMinAlert(int prevSec, int nextSec) {
    if (!widget.isWindowEnd) return;
    if (prevSec > 600 && nextSec <= 600) {
      unawaited(
        MobileLocalNotificationService.instance.onTenMinutesLeft(
          context: context,
          windowKey: widget.windowKey,
        ),
      );
    }
  }

  Future<void> _tick() async {
    if (!mounted) return;
    final prev = _left.inSeconds;
    final next = (prev - 1).clamp(0, 86400);
    _maybeFireTenMinAlert(prev, next);
    setState(() {
      _left = Duration(seconds: next);
    });
    if (next <= 0) {
      widget.onExpired();
      return;
    }
    await Future<void>.delayed(const Duration(seconds: 1));
    await _tick();
  }

  @override
  Widget build(BuildContext context) {
    final time = formatCountdownHms(_left);
    final shortTime = formatCountdownShort(_left);
    final color = syncCountdownUrgencyColor(_left, isWindowStart: !widget.isWindowEnd);
    final shortLabel = widget.isWindowEnd ? S.syncWindowEndsShort : S.syncWindowStartsShort;
    final tooltip = widget.isWindowEnd ? S.syncWindowTooltipEnds : S.syncWindowTooltipStarts;

    if (widget.inline && widget.designPill) {
      final prefix = widget.isWindowEnd ? S.syncIn : shortLabel;
      return Tooltip(
        message: '$tooltip\n${widget.label}: $time',
        waitDuration: const Duration(milliseconds: 400),
        child: Container(
          margin: const EdgeInsets.only(right: 4),
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 7),
          decoration: BoxDecoration(
            color: AppColors.primarySoft,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text(
            '$prefix $shortTime',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTypography.captionSmall.copyWith(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: AppColors.primary,
            ),
          ),
        ),
      );
    }

    if (widget.inline) {
      return Tooltip(
        message: '$tooltip\n${widget.label}: $time',
        waitDuration: const Duration(milliseconds: 400),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: color.withValues(alpha: 0.45)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.timer_outlined, size: 14, color: color),
              const SizedBox(width: 4),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    shortLabel,
                    style: AppTypography.caption.copyWith(
                      fontSize: 9,
                      height: 1,
                      fontWeight: FontWeight.w600,
                      color: color.withValues(alpha: 0.85),
                    ),
                  ),
                  Text(
                    time,
                    style: AppTypography.caption.copyWith(
                      fontSize: 12,
                      height: 1.1,
                      fontWeight: FontWeight.w800,
                      color: color,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      );
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.timer_outlined, size: 16, color: color),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              '${widget.label} $time',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.caption.copyWith(
                fontWeight: FontWeight.w700,
                color: color,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
