import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/clients/agent_client_balance.dart';
import '../../../core/clients/agent_outlet_filters_provider.dart';
import '../../../core/clients/client_outlet_filters.dart';
import '../../../core/format/money_display.dart';
import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/map/agent_yandex_map.dart';
import '../../../core/map/route_map_stop.dart';
import '../../../core/prefs/agent_local_prefs_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../auth/auth_provider.dart';
import '../route/agent_route_provider.dart';
import '../route/agent_route_start_provider.dart';
import '../route/route_planning_provider.dart';
import '../shell/agent_app_bar.dart';

/// «Торговые точки» — Yandex xarita, kun filtri, marshrut chizig‘i, ro‘yxat.
class AgentMapPage extends ConsumerStatefulWidget {
  const AgentMapPage({super.key});

  @override
  ConsumerState<AgentMapPage> createState() => _AgentMapPageState();
}

class _AgentMapPageState extends ConsumerState<AgentMapPage> {
  final _mapKey = GlobalKey<AgentYandexMapState>();
  bool _listOpen = false;
  Map<String, dynamic>? _selectedClient;

  @override
  Widget build(BuildContext context) {
    final clientsAsync = ref.watch(filteredClientsProvider);
    final visitedAsync = ref.watch(visitedTodayClientIdsProvider);
    final routeAsync = ref.watch(todayRouteProvider);
    final plannedRouteAsync = ref.watch(plannedDailyRouteProvider);
    final calendarMode = ref.watch(agentLocalPrefsProvider).valueOrNull?.calendarMode ?? true;
    final weekdayTab = ref.watch(effectiveWeekdayTabProvider);
    final visitedIds = visitedAsync.valueOrNull ?? {};
    final routeStartAsync = ref.watch(agentRouteStartProvider);
    final routeStart = routeStartAsync.valueOrNull;
    final onWeekdayPlan = weekdayTab > 0;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AgentAppBar(
        title: S.mapPointsTitle,
        showBack: true,
        actions: [
          AgentIconButton(icon: Icons.filter_list, onPressed: () => AgentFilterSheet.show(context)),
        ],
      ),
      body: clientsAsync.when(
        data: (clients) {
          final onMap = clients.where(clientHasMapCoords).toList();
          final offMap = clients.where((c) => !clientHasMapCoords(c)).toList();
          final visitedOnMap = onMap.where((c) => visitedIds.contains(c['id'])).length;

          final routeData = routeAsync.valueOrNull;
          final localFallback = routeData?['_localFallback'] == true;
          final routeDateLabel = _formatRouteDateLabel(routeData?['_routeDate'] ?? routeData?['route_date']);
          final plannedRoute = plannedRouteAsync.valueOrNull ?? [];
          final routeLine = onWeekdayPlan ? plannedRoute : <RouteMapStop>[];
          final waitingGps = onWeekdayPlan &&
              routeLine.isEmpty &&
              routeStartAsync.isLoading &&
              onMap.isNotEmpty;

          final stops = <RouteMapStop>[];
          if (onWeekdayPlan) {
            stops.addAll(routeLine);
          } else {
            for (final c in onMap) {
              final id = (c['id'] as num?)?.toInt();
              stops.add(RouteMapStop.fromClient(
                c,
                visited: id != null && visitedIds.contains(id),
              ),);
            }
          }
          final mapStops = capMapDisplayStops(stops);
          final mapStopsTruncated = !onWeekdayPlan && mapStops.length < stops.length;

          return Column(
            children: [
              if (calendarMode) const AgentDayTabs(),
              if (mapStopsTruncated)
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                  child: Text(
                    'Xaritada ${mapStops.length} / ${stops.length} ta nuqta (tezlik uchun cheklangan)',
                    style: AppTypography.caption.copyWith(color: AppColors.info),
                  ),
                ),
              if (onWeekdayPlan && waitingGps)
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                  child: Text(
                    'Определяем вашу геолокацию — маршрут будет построен от ближайшей точки',
                    style: AppTypography.caption.copyWith(color: AppColors.info),
                  ),
                )
              else if (onWeekdayPlan && routeLine.isEmpty && routeStart == null && onMap.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                  child: Text(
                    'Включите GPS — маршрут строится от вашего местоположения',
                    style: AppTypography.caption.copyWith(color: AppColors.warning),
                  ),
                )
              else if (onWeekdayPlan && routeLine.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                  child: Text(
                    localFallback
                        ? (routeDateLabel != null
                            ? 'Маршрут ($routeDateLabel): ${routeLine.length} точек от вашей геолокации'
                            : 'Маршрут: ${routeLine.length} точек от вашей геолокации')
                        : 'Маршрут: ${routeLine.length} точек (оптимальный порядок)',
                    style: AppTypography.caption.copyWith(color: AppColors.success),
                  ),
                )
              else if (onWeekdayPlan && localFallback)
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                  child: Text(
                    routeDateLabel != null
                        ? 'Маршрут ($routeDateLabel) не запланирован — нет доступных точек'
                        : 'Нет доступных точек для маршрута (лимит или пауза после визита)',
                    style: AppTypography.caption.copyWith(color: AppColors.warning),
                  ),
                ),
              Expanded(
                child: AgentDayTabSlideView(
                  child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    if (stops.isEmpty && !waitingGps)
                      Center(child: AgentEmptyState(message: onWeekdayPlan ? 'Нет точек в маршруте на этот день' : S.emptyMapPoints))
                    else if (waitingGps)
                      const Center(child: CircularProgressIndicator(color: AppColors.primary))
                    else
                      AgentYandexMap(
                        key: _mapKey,
                        stops: mapStops,
                        routeLine: routeLine.length > 1 ? routeLine : null,
                        routeStart: routeStart,
                        drawRoutePolyline: routeLine.length > 1,
                        onStopTap: (stop) {
                          if (stop.clientId == null) return;
                          Map<String, dynamic>? client;
                          for (final c in onMap) {
                            if (c['id'] == stop.clientId) {
                              client = c;
                              break;
                            }
                          }
                          if (client != null) setState(() => _selectedClient = client);
                        },
                      ),
                    Positioned(
                      right: 12,
                      top: 12,
                      child: _MapControl(
                        icon: Icons.info_outline,
                        onTap: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Yandex Maps — savdo nuqtalari')),
                          );
                        },
                      ),
                    ),
                    Positioned(
                      right: 12,
                      bottom: 63,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          _MapControl(icon: Icons.add, onTap: () => _mapKey.currentState?.zoomIn()),
                          const SizedBox(height: 4),
                          _MapControl(icon: Icons.remove, onTap: () => _mapKey.currentState?.zoomOut()),
                        ],
                      ),
                    ),
                    Positioned(
                      right: 12,
                      bottom: 12,
                      child: _MapControl(
                        icon: Icons.my_location,
                        filled: true,
                        onTap: () => _mapKey.currentState?.goToUserLocation(),
                      ),
                    ),
                    Positioned(
                      left: 12,
                      bottom: 12,
                      child: _MapControl(
                        icon: _listOpen ? Icons.map : Icons.list,
                        filled: true,
                        onTap: () => setState(() {
                          _listOpen = !_listOpen;
                          if (_listOpen) _selectedClient = null;
                        }),
                      ),
                    ),
                    if (_selectedClient != null && !_listOpen)
                      Positioned(
                        left: 0,
                        right: 0,
                        bottom: 0,
                        child: _OutletDetailBar(
                          client: _selectedClient!,
                          onClose: () => setState(() => _selectedClient = null),
                          onDetails: () {
                            final id = _selectedClient!['id'];
                            if (id != null) context.push('/clients/$id');
                          },
                          onRoute: () {
                            final stop = RouteMapStop.fromClient(_selectedClient!);
                            if (stop.hasCoords) _mapKey.currentState?.focusStop(stop);
                          },
                        ),
                      ),
                    if (_listOpen)
                      Positioned(
                        left: 0,
                        right: 0,
                        bottom: 0,
                        child: _OutletListSheet(
                          onMap: onMap,
                          offMap: offMap,
                          visitedIds: visitedIds,
                          onSelect: (c) {
                            setState(() {
                              _selectedClient = c;
                              _listOpen = false;
                            });
                            final stop = RouteMapStop.fromClient(c);
                            if (stop.hasCoords) _mapKey.currentState?.focusStop(stop);
                          },
                          onClose: () => setState(() => _listOpen = false),
                        ),
                      ),
                  ],
                ),
                ),
              ),
              _MapStatsBar(
                visited: visitedOnMap,
                totalOnMap: onWeekdayPlan ? routeLine.length : onMap.length,
                hidden: offMap.length,
                totalAll: clients.length,
                onHiddenTap: offMap.isEmpty
                    ? null
                    : () => setState(() {
                          _listOpen = true;
                          _selectedClient = null;
                        }),
                onVisitedTap: () => setState(() {
                  _listOpen = true;
                  _selectedClient = null;
                }),
              ),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
        error: (e, _) => AgentErrorPanel(
          error: e,
          onRetry: () {
            ref.invalidate(filteredClientsProvider);
            ref.invalidate(visitedTodayClientIdsProvider);
            ref.invalidate(plannedDailyRouteProvider);
            ref.invalidate(agentRouteStartProvider);
          },
          onLogin: () {
            ref.read(authStateProvider.notifier).sessionExpired();
            context.go('/login');
          },
        ),
      ),
    );
  }

  String? _formatRouteDateLabel(dynamic raw) {
    if (raw == null) return null;
    final s = raw.toString();
    if (s.length < 10) return null;
    final parts = s.substring(0, 10).split('-');
    if (parts.length != 3) return null;
    return '${parts[2]}.${parts[1]}.${parts[0]}';
  }

}

class _MapControl extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;
  final bool filled;

  const _MapControl({required this.icon, this.onTap, this.filled = false});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: filled ? AppColors.primary : AppColors.surface,
      borderRadius: BorderRadius.circular(10),
      elevation: 2,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: SizedBox(
          width: 43,
          height: 43,
          child: Icon(icon, color: filled ? Colors.white : AppColors.textSecondary),
        ),
      ),
    );
  }
}

class _MapStatsBar extends StatelessWidget {
  final int visited;
  final int totalOnMap;
  final int hidden;
  final int totalAll;
  final VoidCallback? onVisitedTap;
  final VoidCallback? onHiddenTap;

  const _MapStatsBar({
    required this.visited,
    required this.totalOnMap,
    required this.hidden,
    required this.totalAll,
    this.onVisitedTap,
    this.onHiddenTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
      elevation: 8,
      color: AppColors.surface,
      child: SafeArea(
        top: false,
        child: IntrinsicHeight(
          child: Row(
            children: [
              Expanded(
                child: InkWell(
                  onTap: onVisitedTap,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(S.visited, style: AppTypography.caption.copyWith(color: AppColors.textMuted)),
                        const SizedBox(height: 8),
                        Text(
                          '$visited / $totalOnMap',
                          style: AppTypography.headlineMedium.copyWith(fontWeight: FontWeight.w800),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              Container(width: 1, color: AppColors.background),
              Expanded(
                child: InkWell(
                  onTap: onHiddenTap,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                S.notShownOnMap,
                                style: AppTypography.caption.copyWith(color: AppColors.textMuted),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                '$hidden / $totalAll',
                                style: AppTypography.headlineMedium.copyWith(fontWeight: FontWeight.w800),
                              ),
                            ],
                          ),
                        ),
                        const Icon(Icons.chevron_right, color: AppColors.textMuted),
                      ],
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

class _OutletDetailBar extends ConsumerWidget {
  final Map<String, dynamic> client;
  final VoidCallback onClose;
  final VoidCallback onDetails;
  final VoidCallback onRoute;

  const _OutletDetailBar({
    required this.client,
    required this.onClose,
    required this.onDetails,
    required this.onRoute,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final name = client['legal_name']?.toString().trim();
    final title = (name != null && name.isNotEmpty) ? name : client['name']?.toString() ?? '—';
    final subtitle = client['name']?.toString() ?? '';
    final clientId = (client['id'] as num?)?.toInt();
    final agentBalances = ref.watch(clientAgentLedgerBalancesProvider).valueOrNull;
    final balanceAmount = clientAgentLedgerBalance(agentBalances, clientId);

    return Material(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
      color: AppColors.surface,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Text('Подробно', style: AppTypography.headlineMedium.copyWith(fontWeight: FontWeight.w800)),
                const Spacer(),
                IconButton(icon: const Icon(Icons.close, size: 20), onPressed: onClose),
              ],
            ),
            AgentSurfaceCard(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  const Icon(Icons.storefront_outlined, size: 40, color: AppColors.textMuted),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title, maxLines: 1, overflow: TextOverflow.ellipsis,
                            style: AppTypography.bodyMedium.copyWith(fontWeight: FontWeight.w800),),
                        if (subtitle.isNotEmpty && subtitle != title)
                          Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis,
                              style: AppTypography.caption.copyWith(color: AppColors.textMuted),),
                        const SizedBox(height: 4),
                        if (balanceAmount != null)
                          Text(
                            formatClientBalanceAmount(balanceAmount),
                            style: AppTypography.caption.copyWith(
                              color: colorForClientBalance(balanceAmount),
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: AgentSecondaryButton(label: 'Подробно', onPressed: onDetails),
                ),
                const SizedBox(width: 8),
                _ActionIcon(icon: Icons.alt_route, onTap: onRoute),
                const SizedBox(width: 8),
                _ActionIcon(
                  icon: Icons.phone,
                  onTap: () {
                    final phone = client['phone']?.toString();
                    if (phone == null || phone.isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Telefon raqami yo\'q')),
                      );
                      return;
                    }
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(phone)));
                  },
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionIcon extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _ActionIcon({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.primary,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: SizedBox(width: 48, height: 48, child: Icon(icon, color: Colors.white)),
      ),
    );
  }
}

class _OutletListSheet extends StatefulWidget {
  final List<Map<String, dynamic>> onMap;
  final List<Map<String, dynamic>> offMap;
  final Set<int> visitedIds;
  final ValueChanged<Map<String, dynamic>> onSelect;
  final VoidCallback onClose;

  const _OutletListSheet({
    required this.onMap,
    required this.offMap,
    required this.visitedIds,
    required this.onSelect,
    required this.onClose,
  });

  @override
  State<_OutletListSheet> createState() => _OutletListSheetState();
}

class _OutletListSheetState extends State<_OutletListSheet> {
  final _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> _filter(List<Map<String, dynamic>> list) {
    final q = _searchCtrl.text.trim().toLowerCase();
    if (q.isEmpty) return list;
    return list.where((c) {
      final name = c['name']?.toString().toLowerCase() ?? '';
      final legal = c['legal_name']?.toString().toLowerCase() ?? '';
      return name.contains(q) || legal.contains(q);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    final onMap = _filter(widget.onMap);
    final offMap = _filter(widget.offMap);
    return Container(
      height: MediaQuery.sizeOf(context).height * 0.55,
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      child: Column(
        children: [
          const AgentSheetHandle(),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: TextField(
              controller: _searchCtrl,
              decoration: InputDecoration(
                hintText: 'Поиск',
                prefixIcon: const Icon(Icons.search),
                filled: true,
                fillColor: AppColors.surfaceMuted,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
              ),
              onChanged: (_) => setState(() {}),
            ),
          ),
          Expanded(
            child: ListView(
              padding: EdgeInsets.fromLTRB(12, 8, 12, 12 + bottom),
              children: [
                if (onMap.isNotEmpty) ...[
                  Text(S.shownOnMap, style: AppTypography.caption.copyWith(color: AppColors.textMuted)),
                  const SizedBox(height: 8),
                  ...onMap.map((c) => _OutletTile(
                        client: c,
                        visited: widget.visitedIds.contains(c['id']),
                        onTap: () => widget.onSelect(c),
                      ),),
                ],
                if (offMap.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text(S.notShownOnMap, style: AppTypography.caption.copyWith(color: AppColors.textMuted)),
                  const SizedBox(height: 8),
                  ...offMap.map((c) => _OutletTile(
                        client: c,
                        visited: widget.visitedIds.contains(c['id']),
                        onTap: () => widget.onSelect(c),
                      ),),
                ],
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(12, 0, 12, 8 + bottom),
            child: AgentSecondaryButton(label: 'Закрыть', onPressed: widget.onClose),
          ),
        ],
      ),
    );
  }
}

class _OutletTile extends ConsumerWidget {
  final Map<String, dynamic> client;
  final bool visited;
  final VoidCallback onTap;

  const _OutletTile({required this.client, required this.visited, required this.onTap});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final name = client['legal_name']?.toString().trim();
    final title = (name != null && name.isNotEmpty) ? name : client['name']?.toString() ?? '—';
    final subtitle = client['name']?.toString() ?? '';
    final cat = client['category']?.toString().trim();
    final clientId = (client['id'] as num?)?.toInt();
    final agentBalances = ref.watch(clientAgentLedgerBalancesProvider).valueOrNull;
    final balanceAmount = clientAgentLedgerBalance(agentBalances, clientId);
    final balance = balanceAmount != null ? formatClientBalanceAmount(balanceAmount) : '';
    final hasDebt = balanceAmount != null && isClientDebtBalance(balanceAmount);

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Icon(Icons.storefront_outlined, color: visited ? AppColors.success : AppColors.textMuted),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, maxLines: 1, overflow: TextOverflow.ellipsis,
                          style: AppTypography.bodyMedium.copyWith(fontWeight: FontWeight.w700),),
                      if (subtitle.isNotEmpty)
                        Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis,
                            style: AppTypography.caption.copyWith(color: AppColors.textMuted),),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          if (cat != null && cat.isNotEmpty)
                            Text(cat, style: AppTypography.caption.copyWith(fontWeight: FontWeight.w800)),
                          const Spacer(),
                          Text(
                            balanceAmount == null
                                ? ''
                                : (hasDebt
                                    ? balance
                                    : (balanceAmount.abs() < 0.0001 ? 'Без долгов' : balance)),
                            style: AppTypography.caption.copyWith(
                              color: balanceAmount == null
                                  ? AppColors.textMuted
                                  : (hasDebt
                                      ? AppColors.error
                                      : (balanceAmount.abs() < 0.0001
                                          ? AppColors.textMuted
                                          : AppColors.textPrimary)),
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
