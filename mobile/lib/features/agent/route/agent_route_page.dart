import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/clients/agent_outlet_filters_provider.dart';
import '../../../core/prefs/agent_local_prefs_provider.dart';
import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/map/agent_yandex_map.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../auth/auth_provider.dart';
import '../shell/agent_app_bar.dart';
import '../shell/agent_drawer.dart';
import 'agent_route_provider.dart';
import 'agent_route_start_provider.dart';
import 'route_planning_provider.dart';

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
    final calendarMode = ref.watch(agentLocalPrefsProvider).valueOrNull?.calendarMode ?? true;

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: AppColors.background,
      drawer: const AgentDrawer(),
      appBar: AgentAppBar(
        title: 'Savdo nuqtalari',
        showBack: true,
        drawerScaffoldKey: _scaffoldKey,
        actions: [
          AgentIconButton(
            icon: Icons.refresh,
            onPressed: () {
              ref.invalidate(todayRouteProvider);
              ref.invalidate(filteredClientsProvider);
              ref.invalidate(plannedDailyRouteProvider);
              ref.invalidate(agentRouteStartProvider);
            },
          ),
          AgentIconButton(icon: Icons.filter_list, onPressed: () => AgentFilterSheet.show(context)),
        ],
      ),
      body: routeAsync.when(
        data: (route) => _RouteMapBody(
          localFallback: route?['_localFallback'] == true,
          showDayTabs: calendarMode,
        ),
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
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

class _RouteMapBody extends ConsumerStatefulWidget {
  final bool localFallback;
  final bool showDayTabs;

  const _RouteMapBody({
    this.localFallback = false,
    this.showDayTabs = true,
  });

  @override
  ConsumerState<_RouteMapBody> createState() => _RouteMapBodyState();
}

class _RouteMapBodyState extends ConsumerState<_RouteMapBody> {
  final _mapKey = GlobalKey<AgentYandexMapState>();

  @override
  Widget build(BuildContext context) {
    final weekdayTab = ref.watch(effectiveWeekdayTabProvider);
    final routeStartAsync = ref.watch(agentRouteStartProvider);
    final routeStart = routeStartAsync.valueOrNull;
    final plannedAsync = ref.watch(plannedDailyRouteProvider);
    final parsed = plannedAsync.valueOrNull ?? [];
    final waitingGps = weekdayTab > 0 && parsed.isEmpty && routeStartAsync.isLoading;

    return Column(
      children: [
        if (widget.showDayTabs) const AgentDayTabs(),
        if (waitingGps)
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
            child: Text(
              'Определяем геолокацию — маршрут от ближайшей точки',
              style: AppTypography.caption.copyWith(color: AppColors.info),
            ),
          )
        else if (parsed.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
            child: Text(
              'Маршрут: ${parsed.length} точек',
              style: AppTypography.caption.copyWith(color: AppColors.success),
            ),
          )
        else if (widget.localFallback && weekdayTab > 0)
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
            child: Text(
              'Нет точек в маршруте на этот день',
              style: AppTypography.caption.copyWith(color: AppColors.warning),
            ),
          ),
        Expanded(
          child: AgentDayTabSlideView(
            child: Stack(
              children: [
                if (waitingGps)
                  const Center(child: CircularProgressIndicator(color: AppColors.primary))
                else if (parsed.isEmpty)
                  const Center(child: AgentEmptyState(message: S.emptyRoutePoints))
                else
                  AgentYandexMap(
                    key: _mapKey,
                    stops: parsed,
                    routeLine: parsed.length > 1 ? parsed : null,
                    routeStart: routeStart,
                    drawRoutePolyline: parsed.length > 1,
                    onStopTap: (stop) {
                      if (stop.clientId != null) context.push('/clients/${stop.clientId}');
                    },
                  ),
                Positioned(
                  right: 12,
                  top: 12,
                  child: _MapFab(
                    icon: Icons.my_location,
                    onTap: () => _mapKey.currentState?.goToUserLocation(),
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

class _MapFab extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;

  const _MapFab({required this.icon, this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(10),
      elevation: 2,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: SizedBox(
          width: 44,
          height: 44,
          child: Icon(icon, color: AppColors.primary),
        ),
      ),
    );
  }
}
