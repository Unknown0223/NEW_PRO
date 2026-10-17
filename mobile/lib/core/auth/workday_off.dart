import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/auth_provider.dart';
import '../api/dio_client.dart';
import 'session.dart';

/// Web «Рабочие дни»: belgilanmagan kunda backend `403 WORKDAY_OFF` qaytaradi.
class WorkdayOffInfo {
  final String? message;
  final String? roleLabel;
  final String? reasonLabel;
  final String? comment;
  final String? today;
  final DateTime? nextWorkStart;

  const WorkdayOffInfo({
    this.message,
    this.roleLabel,
    this.reasonLabel,
    this.comment,
    this.today,
    this.nextWorkStart,
  });

  static WorkdayOffInfo? fromStatusJson(dynamic raw) {
    if (raw is! Map) return null;
    if (raw['allowed'] != false) return null;
    final start = raw['next_work_start']?.toString();
    return WorkdayOffInfo(
      message: raw['message']?.toString(),
      roleLabel: raw['role_label']?.toString(),
      reasonLabel: raw['reason_label']?.toString(),
      comment: raw['comment']?.toString(),
      today: raw['today']?.toString(),
      nextWorkStart: start == null || start.isEmpty ? null : DateTime.tryParse(start)?.toUtc(),
    );
  }
}

bool isWorkdayOffResponse(int? statusCode, dynamic data) {
  if (statusCode != 403) return false;
  if (data is! Map) return false;
  return data['error']?.toString() == 'WORKDAY_OFF';
}

WorkdayOffInfo workdayOffFromErrorBody(dynamic data) {
  final parsed = data is Map ? WorkdayOffInfo.fromStatusJson(data['workday']) : null;
  return parsed ??
      WorkdayOffInfo(message: data is Map ? data['message']?.toString() : null);
}

final workdayOffProvider = StateProvider<WorkdayOffInfo?>((ref) => null);

String _two(int v) => v.toString().padLeft(2, '0');

String formatWorkdayCountdown(Duration d) {
  final s = d.isNegative ? 0 : d.inSeconds;
  final days = s ~/ 86400;
  final hh = _two((s % 86400) ~/ 3600);
  final mm = _two((s % 3600) ~/ 60);
  final ss = _two(s % 60);
  return days > 0 ? '$days д $hh:$mm:$ss' : '$hh:$mm:$ss';
}

const _weekdaysRu = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
const _monthsRu = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

/// Asia/Tashkent (UTC+5) bo‘yicha: «понедельник, 28 сентября, 00:00».
String formatWorkStartTashkent(DateTime utc) {
  final t = utc.toUtc().add(const Duration(hours: 5));
  return '${_weekdaysRu[t.weekday - 1]}, ${t.day} ${_monthsRu[t.month - 1]}, ${_two(t.hour)}:${_two(t.minute)}';
}

/// Dam olish kunida butun ilova ustidan bloklovchi ekran (faqat ma’lumot va «Выйти»).
class WorkdayOffGuard extends ConsumerStatefulWidget {
  final Widget child;

  const WorkdayOffGuard({super.key, required this.child});

  @override
  ConsumerState<WorkdayOffGuard> createState() => _WorkdayOffGuardState();
}

class _WorkdayOffGuardState extends ConsumerState<WorkdayOffGuard> with WidgetsBindingObserver {
  Timer? _pollTimer;
  Timer? _tickTimer;
  bool _checking = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _pollTimer = Timer.periodic(const Duration(minutes: 1), (_) => _check());
    _tickTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      final info = ref.read(workdayOffProvider);
      if (info == null || !mounted) return;
      setState(() {});
      final start = info.nextWorkStart;
      if (start != null && !DateTime.now().toUtc().isBefore(start)) _check();
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _check());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _tickTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _check();
  }

  Future<void> _check() async {
    if (!mounted || _checking) return;
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty || !ref.read(isLoggedInProvider)) {
      if (ref.read(workdayOffProvider) != null && !ref.read(isLoggedInProvider)) {
        ref.read(workdayOffProvider.notifier).state = null;
      }
      return;
    }
    _checking = true;
    try {
      final r = await ref.read(dioProvider).get('/api/$slug/me/workday-status');
      final data = r.data is Map ? (r.data as Map)['data'] : null;
      if (!mounted) return;
      ref.read(workdayOffProvider.notifier).state = WorkdayOffInfo.fromStatusJson(data);
    } catch (_) {
      // Oflayn / tarmoq — oldingi holat saqlanadi.
    } finally {
      _checking = false;
    }
  }

  Future<void> _logout() async {
    ref.read(workdayOffProvider.notifier).state = null;
    await ref.read(authStateProvider.notifier).logout();
  }

  @override
  Widget build(BuildContext context) {
    final info = ref.watch(workdayOffProvider);
    final loggedIn = ref.watch(isLoggedInProvider);
    if (info == null || !loggedIn) return widget.child;
    return Stack(
      children: [
        widget.child,
        Positioned.fill(child: _DayOffScreen(info: info, onRefresh: _check, onLogout: _logout)),
      ],
    );
  }
}

class _DayOffScreen extends StatelessWidget {
  final WorkdayOffInfo info;
  final Future<void> Function() onRefresh;
  final Future<void> Function() onLogout;

  const _DayOffScreen({required this.info, required this.onRefresh, required this.onLogout});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final start = info.nextWorkStart;
    final left = start?.difference(DateTime.now().toUtc());
    return PopScope(
      canPop: false,
      child: Material(
        color: theme.colorScheme.surface,
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircleAvatar(
                    radius: 36,
                    backgroundColor: Colors.amber.withValues(alpha: 0.18),
                    child: const Icon(Icons.event_busy, size: 36, color: Colors.amber),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Сегодня нерабочий день',
                    style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'По настройкам системы («Рабочие дни») сегодня для роли '
                    '«${info.roleLabel ?? '—'}» выходной'
                    '${info.reasonLabel != null ? ' (${info.reasonLabel!.toLowerCase()})' : ''}. '
                    'Пользоваться приложением в нерабочий день нельзя.',
                    style: theme.textTheme.bodyMedium,
                    textAlign: TextAlign.center,
                  ),
                  if (info.comment != null && info.comment!.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(info.comment!, style: theme.textTheme.bodySmall, textAlign: TextAlign.center),
                  ],
                  const SizedBox(height: 24),
                  if (start != null) ...[
                    Text('Рабочий день начнётся', style: theme.textTheme.labelMedium),
                    const SizedBox(height: 4),
                    Text(
                      formatWorkStartTashkent(start),
                      style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    Text('Осталось', style: theme.textTheme.labelMedium),
                    Text(
                      formatWorkdayCountdown(left ?? Duration.zero),
                      style: theme.textTheme.displaySmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                    ),
                  ] else
                    Text(
                      'Ближайший рабочий день не найден. Обратитесь к администратору.',
                      style: theme.textTheme.bodySmall,
                      textAlign: TextAlign.center,
                    ),
                  const SizedBox(height: 28),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      OutlinedButton.icon(
                        onPressed: () => onRefresh(),
                        icon: const Icon(Icons.refresh),
                        label: const Text('Проверить'),
                      ),
                      const SizedBox(width: 12),
                      FilledButton.tonalIcon(
                        onPressed: () => onLogout(),
                        icon: const Icon(Icons.logout),
                        label: const Text('Выйти'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
