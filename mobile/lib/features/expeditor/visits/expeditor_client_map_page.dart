import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/gps/gps_tracker.dart';
import '../../../core/map/agent_yandex_map.dart';
import '../../../core/map/route_map_stop.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';

/// Ekspeditor — mijozgacha ilova ichida Yandex marshrut (GPS → mijoz nuqtasi).
class ExpeditorClientMapPage extends ConsumerStatefulWidget {
  final String clientName;
  final double latitude;
  final double longitude;

  const ExpeditorClientMapPage({
    super.key,
    required this.clientName,
    required this.latitude,
    required this.longitude,
  });

  @override
  ConsumerState<ExpeditorClientMapPage> createState() =>
      _ExpeditorClientMapPageState();
}

class _ExpeditorClientMapPageState
    extends ConsumerState<ExpeditorClientMapPage> {
  final _mapKey = GlobalKey<AgentYandexMapState>();

  RouteMapStop? _start;
  bool _locating = true;

  RouteMapStop get _clientStop => RouteMapStop(
        name: widget.clientName,
        latitude: widget.latitude,
        longitude: widget.longitude,
      );

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

  String _distanceLabel() {
    final start = _start;
    if (start == null) return '';
    final km = routeMapDistanceKm(
      start.latitude,
      start.longitude,
      widget.latitude,
      widget.longitude,
    );
    if (km < 1) return '≈ ${(km * 1000).round()} м';
    return '≈ ${km.toStringAsFixed(1)} км';
  }

  @override
  Widget build(BuildContext context) {
    final start = _start;
    final hasRoute = start != null;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(widget.clientName, overflow: TextOverflow.ellipsis),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
            child: Row(
              children: [
                Icon(
                  hasRoute ? Icons.directions : Icons.place_outlined,
                  size: 16,
                  color: AppColors.expeditorAccent,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    _locating
                        ? 'Определяем геолокацию…'
                        : hasRoute
                            ? 'Маршрут до клиента ${_distanceLabel()}'
                            : 'Геолокация недоступна — показана точка клиента',
                    style: AppTypography.bodySmall
                        .copyWith(color: AppColors.textMuted),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: Stack(
              children: [
                AgentYandexMap(
                  key: _mapKey,
                  stops: [_clientStop],
                  routeLine: hasRoute ? [_clientStop] : null,
                  routeStart: start,
                  drawRoutePolyline: hasRoute,
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
        ],
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
