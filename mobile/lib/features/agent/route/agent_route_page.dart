import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/clients/agent_outlet_filters_provider.dart';
import '../../../core/map/route_map_stop.dart';
import '../../../core/prefs/agent_local_prefs_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/time/work_region_time.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../../design_system/design_system.dart';
import '../../auth/auth_provider.dart';
import '../home/home_visit_metrics_provider.dart';
import '../shell/agent_app_bar.dart';
import '../shell/agent_drawer.dart';
import 'agent_route_provider.dart';
import 'agent_route_start_provider.dart';
import 'route_planning_provider.dart';

/// Shablon `ExtraScreens.RoutePlanScreen` — progress + timeline + xarita CTA.
class AgentRoutePage extends ConsumerStatefulWidget {
  const AgentRoutePage({super.key});

  @override
  ConsumerState<AgentRoutePage> createState() => _AgentRoutePageState();
}

class _AgentRoutePageState extends ConsumerState<AgentRoutePage> {
  final _scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  Widget build(BuildContext context) {
    final routeAsync = ref.watch(todayRouteProvider);
    final calendarMode =
        ref.watch(agentLocalPrefsProvider).valueOrNull?.calendarMode ?? true;
    final dateLine = DateFormat('dd.MM.yyyy').format(workRegionNow());

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: AppColors.background,
      drawer: const AgentDrawer(),
      appBar: AgentAppBar(
        title: 'Kunlik reja',
        showBack: true,
        drawerScaffoldKey: _scaffoldKey,
        belowTitle: Text(
          dateLine,
          style: AppTypography.caption.copyWith(
            color: AppColors.textMuted,
            fontWeight: FontWeight.w600,
          ),
        ),
        actions: [
          SaPressable(
            pressedScale: 0.9,
            borderRadius: BorderRadius.circular(10),
            onTap: () => context.push('/map'),
            child: Container(
              width: 34,
              height: 34,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.border),
              ),
              child: const Icon(Icons.map_outlined, size: 16),
            ),
          ),
          const SizedBox(width: 4),
          AgentIconButton(
            icon: Icons.refresh,
            onPressed: () {
              ref.invalidate(todayRouteProvider);
              ref.invalidate(filteredClientsProvider);
              ref.invalidate(plannedDailyRouteProvider);
              ref.invalidate(agentRouteStartProvider);
            },
          ),
        ],
      ),
      body: routeAsync.when(
        data: (route) => _RoutePlanBody(
          localFallback: route?['_localFallback'] == true,
          showDayTabs: calendarMode,
        ),
        loading: () =>
            const Center(child: CircularProgressIndicator(color: AppColors.primary)),
        error: (e, _) => AgentErrorPanel(
          error: e,
          onRetry: () {
            ref.invalidate(todayRouteProvider);
            ref.invalidate(plannedDailyRouteProvider);
          },
          onLogin: () {
            ref.read(authStateProvider.notifier).sessionExpired();
            context.go('/login');
          },
        ),
      ),
    );
  }
}

class _RoutePlanBody extends ConsumerWidget {
  final bool localFallback;
  final bool showDayTabs;

  const _RoutePlanBody({
    this.localFallback = false,
    this.showDayTabs = true,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final weekdayTab = ref.watch(effectiveWeekdayTabProvider);
    final routeStartAsync = ref.watch(agentRouteStartProvider);
    final plannedAsync = ref.watch(plannedDailyRouteProvider);
    final metrics = ref.watch(homeVisitMetricsProvider).valueOrNull;
    final parsed = plannedAsync.valueOrNull ?? [];
    final waitingGps =
        weekdayTab > 0 && parsed.isEmpty && routeStartAsync.isLoading;

    final done = metrics?.visited ?? parsed.where((s) => s.visited).length;
    final plan = (metrics?.total ?? 0) > 0 ? metrics!.total : parsed.length;
    final pct = plan > 0 ? ((done / plan) * 100).round() : 0;

    // Faol (birinchi tashrif qilinmagan) nuqta.
    final nowIdx = parsed.indexWhere((s) => !s.visited);

    return Column(
      children: [
        if (showDayTabs) const AgentDayTabs(),
        Expanded(
          child: AgentDayTabSlideView(
            child: waitingGps
                ? const Center(
                    child: CircularProgressIndicator(color: AppColors.primary),
                  )
                : parsed.isEmpty
                    ? Center(
                        child: AgentEmptyState(
                          message: localFallback && weekdayTab > 0
                              ? 'Bugun marshrutda nuqta yo\'q'
                              : 'Bu kun uchun marshrut nuqtalari yo\'q',
                        ),
                      )
                    : ListView(
                        padding: const EdgeInsets.fromLTRB(14, 8, 14, 28),
                        children: [
                          SaEnter(
                            preset: SaMotionPreset.rise,
                            child: _RouteProgressCard(
                              pct: pct,
                              done: done,
                              plan: plan,
                              stopCount: parsed.length,
                            ),
                          ),
                          const SizedBox(height: 14),
                          ...List.generate(parsed.length, (i) {
                            final s = parsed[i];
                            final st = s.visited
                                ? _StopKind.done
                                : (i == nowIdx
                                    ? _StopKind.now
                                    : _StopKind.next);
                            return SaEnter(
                              delay: SaStaggerDelay.of(1 + i),
                              preset: SaMotionPreset.rise,
                              child: _TimelineStop(
                                index: i + 1,
                                stop: s,
                                kind: st,
                                isLast: i == parsed.length - 1,
                                onTap: () {
                                  if (s.clientId != null) {
                                    context.push('/clients/${s.clientId}');
                                  }
                                },
                              ),
                            );
                          }),
                          const SizedBox(height: 12),
                          SaEnter(
                            delay: SaStaggerDelay.of(2 + parsed.length),
                            child: SaPressable(
                              pressedScale: 0.97,
                              onTap: () => context.push('/map'),
                              borderRadius: BorderRadius.circular(11),
                              child: Container(
                                width: double.infinity,
                                alignment: Alignment.center,
                                padding:
                                    const EdgeInsets.symmetric(vertical: 12),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(11),
                                  gradient: const LinearGradient(
                                    colors: [
                                      Color(0xFF6A5BFF),
                                      Color(0xFF5548F0),
                                    ],
                                  ),
                                ),
                                child: const Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(Icons.map_outlined,
                                        size: 16, color: Colors.white),
                                    SizedBox(width: 8),
                                    Text(
                                      'Xaritada ochish',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.w800,
                                        fontSize: 13,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 10),
                          SaEnter(
                            delay: SaStaggerDelay.of(3 + parsed.length),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 10,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.surface,
                                borderRadius: BorderRadius.circular(11),
                                border: Border.all(color: AppColors.border),
                              ),
                              child: Text(
                                'Marshrut KPI: reja $plan vizit · fakt $done · samaradorlik $pct%.',
                                style: AppTypography.caption.copyWith(
                                  color: AppColors.textMuted,
                                  fontSize: 11,
                                  height: 1.35,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
          ),
        ),
      ],
    );
  }
}

enum _StopKind { done, now, next }

class _RouteProgressCard extends StatelessWidget {
  final int pct;
  final int done;
  final int plan;
  final int stopCount;

  const _RouteProgressCard({
    required this.pct,
    required this.done,
    required this.plan,
    required this.stopCount,
  });

  @override
  Widget build(BuildContext context) {
    return AgentSurfaceCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Icon(Icons.track_changes, size: 14, color: AppColors.primary),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  'Marshrut bajarilishi',
                  style: AppTypography.bodySmall.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              Text(
                '$pct%',
                style: AppTypography.bodySmall.copyWith(
                  fontWeight: FontWeight.w800,
                  color: AppColors.primary,
                  fontFamily: 'monospace',
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: plan > 0 ? (done / plan).clamp(0.0, 1.0) : 0,
              minHeight: 5,
              backgroundColor: AppColors.borderLight,
              valueColor: const AlwaysStoppedAnimation(AppColors.primary),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            '$done/$plan vizit · $stopCount nuqta',
            style: AppTypography.caption.copyWith(
              color: AppColors.textMuted,
              fontSize: 10,
              fontFamily: 'monospace',
            ),
          ),
        ],
      ),
    );
  }
}

class _TimelineStop extends StatelessWidget {
  final int index;
  final RouteMapStop stop;
  final _StopKind kind;
  final bool isLast;
  final VoidCallback onTap;

  const _TimelineStop({
    required this.index,
    required this.stop,
    required this.kind,
    required this.isLast,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final accent = AppColors.primary;
    final dotColor = switch (kind) {
      _StopKind.done => const Color(0xFF22B573),
      _StopKind.now => accent,
      _StopKind.next => AppColors.surfaceVariant,
    };
    final info = switch (kind) {
      _StopKind.done => 'Tashrif qilindi',
      _StopKind.now => 'Joriy nuqta',
      _StopKind.next => 'Keyingi',
    };

    return SaPressable(
      pressedScale: 0.99,
      onTap: onTap,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 36,
              child: Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text(
                  '#$index',
                  textAlign: TextAlign.right,
                  style: TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: kind == _StopKind.now
                        ? accent
                        : AppColors.textMuted,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            SizedBox(
              width: 20,
              child: Column(
                children: [
                  const SizedBox(height: 8),
                  Container(
                    width: 17,
                    height: 17,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: dotColor,
                      shape: BoxShape.circle,
                      border: kind == _StopKind.next
                          ? Border.all(color: AppColors.border, width: 1.5)
                          : null,
                      boxShadow: kind == _StopKind.now
                          ? [
                              BoxShadow(
                                color: accent.withValues(alpha: 0.28),
                                blurRadius: 0,
                                spreadRadius: 3,
                              ),
                            ]
                          : null,
                    ),
                    child: kind == _StopKind.done
                        ? const Icon(Icons.check, size: 11, color: Colors.white)
                        : kind == _StopKind.now
                            ? Container(
                                width: 6,
                                height: 6,
                                decoration: const BoxDecoration(
                                  color: Colors.white,
                                  shape: BoxShape.circle,
                                ),
                              )
                            : Icon(Icons.flag_outlined,
                                size: 9, color: AppColors.textMuted),
                  ),
                  if (!isLast)
                    Expanded(
                      child: Container(
                        width: 1,
                        margin: const EdgeInsets.symmetric(vertical: 2),
                        color: AppColors.border,
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Container(
                margin: EdgeInsets.only(bottom: isLast ? 0 : 8),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: kind == _StopKind.now ? accent : AppColors.border,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      stop.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.bodySmall.copyWith(
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      info,
                      style: AppTypography.caption.copyWith(
                        fontSize: 11,
                        color: kind == _StopKind.now
                            ? accent
                            : AppColors.textMuted,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
