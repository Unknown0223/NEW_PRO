import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/gps/gps_tracker.dart';
import '../../../core/map/agent_yandex_map.dart';
import '../../../core/map/route_map_stop.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../../core/utils/external_actions.dart';

/// Ekspeditor — vizit/marshrut nuqtalarini ilova ichida Yandex xaritada ko'rsatish.
class ExpeditorVisitsMapPage extends ConsumerStatefulWidget {
  final List<Map<String, dynamic>> rows;
  final String title;

  const ExpeditorVisitsMapPage({
    super.key,
    required this.rows,
    this.title = 'Маршрут на карте',
  });

  @override
  ConsumerState<ExpeditorVisitsMapPage> createState() =>
      _ExpeditorVisitsMapPageState();
}

class _ExpeditorVisitsMapPageState
    extends ConsumerState<ExpeditorVisitsMapPage> {
  final _mapKey = GlobalKey<AgentYandexMapState>();

  RouteMapStop? _start;
  bool _locating = true;

  late final List<RouteMapStop> _stops = _buildStops();
  late final Map<int, Map<String, dynamic>> _rowByClient = {
    for (final r in widget.rows)
      if ((r['client_id'] as num?) != null) (r['client_id'] as num).toInt(): r,
  };

  List<RouteMapStop> _buildStops() {
    final stops = <RouteMapStop>[];
    for (var i = 0; i < widget.rows.length; i++) {
      final r = widget.rows[i];
      final stop = RouteMapStop(
        clientId: (r['client_id'] as num?)?.toInt(),
        name: r['client_name']?.toString() ?? 'Клиент',
        latitude: (r['latitude'] as num?)?.toDouble() ?? 0,
        longitude: (r['longitude'] as num?)?.toDouble() ?? 0,
        orderIndex: (r['seq'] as num?)?.toInt() ?? i + 1,
      );
      if (stop.hasCoords) stops.add(stop);
    }
    return stops;
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _resolveStart());
  }

  Future<void> _resolveStart() async {
    try {
      final pos =
          await ref.read(gpsTrackerProvider.notifier).getCurrentPosition();
      if (!mounted) return;
      if (pos != null) {
        setState(() {
          _start = RouteMapStop(
            name: 'Вы здесь',
            latitude: pos.latitude,
            longitude: pos.longitude,
          );
        });
      }
    } catch (_) {
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  int get _visitedCount {
    const done = {'delivered', 'returned', 'completed', 'done'};
    return widget.rows
        .where((r) => done.contains(r['status']?.toString()))
        .length;
  }

  void _onStopTap(RouteMapStop stop) {
    final id = stop.clientId;
    final row = id != null ? _rowByClient[id] : null;
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (ctx) => _StopDetailSheet(
        stop: stop,
        row: row,
        onDetails: id == null
            ? null
            : () {
                Navigator.pop(ctx);
                context.push('/exp-client/$id', extra: row);
              },
        onRoute: () async {
          Navigator.pop(ctx);
          await launchClientLocation(
            latitude: stop.latitude,
            longitude: stop.longitude,
            label: stop.name,
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final start = _start;
    final hasRoute = _stops.length > 1;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(widget.title, overflow: TextOverflow.ellipsis),
      ),
      body: _stops.isEmpty
          ? AgentEmptyState.fill(message: 'Нет точек с координатами')
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: Stack(
                    children: [
                      AgentYandexMap(
                        key: _mapKey,
                        stops: _stops,
                        routeLine: hasRoute ? _stops : null,
                        routeStart: start,
                        drawRoutePolyline: hasRoute,
                        onStopTap: _onStopTap,
                      ),
                      Positioned(
                        right: 12,
                        top: 12,
                        child: _MapFab(
                          icon: Icons.my_location,
                          onTap: () => _mapKey.currentState?.goToUserLocation(),
                        ),
                      ),
                      if (_locating)
                        const Positioned(
                          left: 12,
                          top: 12,
                          child: _LocatingChip(),
                        ),
                    ],
                  ),
                ),
                _RouteStatsBar(
                  visited: _visitedCount,
                  total: widget.rows.length,
                  shown: _stops.length,
                ),
              ],
            ),
    );
  }
}

class _RouteStatsBar extends StatelessWidget {
  final int visited;
  final int total;
  final int shown;

  const _RouteStatsBar({
    required this.visited,
    required this.total,
    required this.shown,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.surface,
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 14),
      child: Row(
        children: [
          Expanded(
            child: _statBox('Посещено', '$visited/$total'),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _statBox('Показано на карте', '$shown/$total'),
          ),
        ],
      ),
    );
  }

  Widget _statBox(String label, String value) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.background,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                style: AppTypography.caption
                    .copyWith(color: AppColors.textMuted),),
            const SizedBox(height: 4),
            Text(value,
                style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: AppColors.expeditorAccent,),),
          ],
        ),
      );
}

class _LocatingChip extends StatelessWidget {
  const _LocatingChip();

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(20),
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(
                  strokeWidth: 2, color: AppColors.expeditorAccent,),
            ),
            const SizedBox(width: 8),
            Text('Геолокация…',
                style: AppTypography.caption
                    .copyWith(color: AppColors.textSecondary),),
          ],
        ),
      ),
    );
  }
}

class _StopDetailSheet extends StatelessWidget {
  final RouteMapStop stop;
  final Map<String, dynamic>? row;
  final VoidCallback? onDetails;
  final Future<void> Function() onRoute;

  const _StopDetailSheet({
    required this.stop,
    required this.row,
    required this.onDetails,
    required this.onRoute,
  });

  @override
  Widget build(BuildContext context) {
    final reason = row?['visit_reason']?.toString();
    final taskLabel = row?['task_label']?.toString();
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 2),
            const AgentSheetHandle(),
            const SizedBox(height: 10),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceVariant,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.storefront_outlined,
                      color: AppColors.textSecondary, size: 22,),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(stop.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: 15, fontWeight: FontWeight.w800,),),
                      const SizedBox(height: 2),
                      Text('Причина визита:${reason != null && reason.isNotEmpty ? ' $reason' : ''}',
                          style: AppTypography.caption
                              .copyWith(color: AppColors.textMuted),),
                      if (taskLabel != null && taskLabel.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 4,),
                          decoration: BoxDecoration(
                            color: AppColors.expeditorAccent
                                .withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(taskLabel,
                              style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.expeditorAccent,),),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.expeditorAccent,
                      side: const BorderSide(color: AppColors.expeditorAccent),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    onPressed: () => onRoute(),
                    icon: const Icon(Icons.directions, size: 18),
                    label: const Text('Маршрут'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.expeditorAccent,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    onPressed: onDetails,
                    child: const Text('Подробно',
                        style: TextStyle(fontWeight: FontWeight.w700),),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
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
          child: Icon(icon, color: AppColors.expeditorAccent),
        ),
      ),
    );
  }
}
