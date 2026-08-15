import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';

import '../../../core/agent/outlet_radius.dart';
import '../../../core/api/api_exceptions.dart';
import '../../../core/api/field_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/clients/client_outlet_filters.dart';
import '../../../core/database/app_database.dart';
import '../../../core/gps/gps_tracker.dart';
import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/time/work_region_time.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../../core/ui/agent_visit_ui.dart';
import '../config/agent_config_enforcement.dart';
import '../route/agent_route_provider.dart';
import '../visits/visit_stats_helper.dart';
import '../shell/agent_app_bar.dart';
import 'agent_visits_page.dart';

class StartVisitScreen extends ConsumerStatefulWidget {
  const StartVisitScreen({super.key});

  @override
  ConsumerState<StartVisitScreen> createState() => _StartVisitScreenState();
}

class _StartVisitScreenState extends ConsumerState<StartVisitScreen> {
  List<Map<String, dynamic>> _clients = [];
  bool _loading = true;
  Position? _pos;

  @override
  void initState() {
    super.initState();
    _load();
  }

  /// Faqat bugungi kunga belgilangan (marshrut / visit_weekdays) nuqtalar.
  Future<List<Map<String, dynamic>>> _clientsForTodayVisit() async {
    final all = await AppDatabase().getAllClients();
    final byId = <int, Map<String, dynamic>>{
      for (final c in all)
        if (c['id'] is num) (c['id'] as num).toInt(): c,
    };

    Map<String, dynamic>? route;
    try {
      route = await ref.read(realTodayRouteProvider.future);
    } catch (_) {
      route = null;
    }

    final stops = (route?['stops'] as List?) ?? const [];
    if (stops.isNotEmpty) {
      final out = <Map<String, dynamic>>[];
      final seen = <int>{};
      for (final raw in stops) {
        if (raw is! Map) continue;
        final cid = (raw['client_id'] as num?)?.toInt();
        if (cid == null || cid < 1 || seen.contains(cid)) continue;
        seen.add(cid);
        final local = byId[cid];
        if (local != null) {
          out.add(local);
          continue;
        }
        out.add({
          'id': cid,
          'name': raw['client_name']?.toString() ?? 'Mijoz #$cid',
          'client_code': raw['client_code'],
          'latitude': raw['latitude'],
          'longitude': raw['longitude'],
        });
      }
      return out;
    }

    // Server marshruti bo‘sh — lokal tashrif kunlari bo‘yicha.
    final routeDate = serverTodayKey();
    final weekday = serverTodayWeekday();
    return all
        .where((c) => clientPlannedForVisitDay(c, weekday, routeDate))
        .toList();
  }

  Future<void> _load() async {
    final list = await _clientsForTodayVisit();
    final tracker = ref.read(gpsTrackerProvider.notifier);
    final p = await tracker.getCurrentPosition();
    if (p != null && list.isNotEmpty) {
      list.sort((a, b) {
        final da = _distanceMFor(a, p);
        final db = _distanceMFor(b, p);
        if (da == null && db == null) return 0;
        if (da == null) return 1;
        if (db == null) return -1;
        return da.compareTo(db);
      });
    }
    if (mounted) {
      setState(() {
        _clients = list;
        _pos = p;
        _loading = false;
      });
    }
  }

  double? _distanceMFor(Map<String, dynamic> client, Position pos) {
    if (client['latitude'] == null || client['longitude'] == null) return null;
    return Geolocator.distanceBetween(
      pos.latitude,
      pos.longitude,
      (client['latitude'] as num).toDouble(),
      (client['longitude'] as num).toDouble(),
    );
  }

  double? _distanceM(Map<String, dynamic> client) {
    if (_pos == null) return null;
    return _distanceMFor(client, _pos!);
  }

  Future<void> _startVisit(Map<String, dynamic> client) async {
    final id = client['id'];
    if (id is! int && id is! num) return;
    final clientId = (id as num).toInt();
    final name = client['name']?.toString() ?? 'Mijoz';
    final slug = ref.read(sessionProvider).tenantSlug ?? '';

    final block = await evaluateAgentOrderGuards(ref, clientId: clientId);
    if (block != null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(block.message), backgroundColor: AppColors.warning),
        );
      }
      return;
    }

    final visit = VisitRecord(
      clientId: clientId,
      clientName: name,
      startTime: DateTime.now().toIso8601String(),
      status: 'in_progress',
      latitude: _pos?.latitude ?? (client['latitude'] as num?)?.toDouble(),
      longitude: _pos?.longitude ?? (client['longitude'] as num?)?.toDouble(),
    );

    await AppDatabase().insertVisit(visitToRow(visit));
    if (slug.isNotEmpty) {
      try {
        await ref.read(fieldApiProvider).createVisit(
              slug,
              clientId: clientId,
              latitude: visit.latitude,
              longitude: visit.longitude,
            );
      } on ApiException catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Vizit xato: ${e.message}'), backgroundColor: AppColors.error),
          );
        }
      } catch (_) {}
    }

    refreshVisitStatsProviders(ref.invalidate);
    if (!mounted) return;
    context.go('/visits/active/$clientId');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const AgentAppBar(title: S.startVisit, showBack: true),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _clients.isEmpty
              ? AgentEmptyState.fill(message: S.noVisitsPlannedToday)
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: _clients.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) {
                    final c = _clients[i];
                    final code = c['client_code']?.toString().trim() ?? '—';
                    final dist = formatVisitDistance(_distanceM(c));
                    return StartVisitClientTile(
                      name: c['name']?.toString() ?? '—',
                      code: code,
                      distanceLabel: dist.isEmpty ? null : dist,
                      onTap: () async {
                        final cfg = ref.read(sessionProvider).mobileConfig;
                        if (cfg != null) {
                          final ok = await ensureWithinOutletRadius(
                            context: context,
                            config: cfg,
                            clientLat: (c['latitude'] as num?)?.toDouble(),
                            clientLng: (c['longitude'] as num?)?.toDouble(),
                          );
                          if (!ok || !context.mounted) return;
                        }
                        await _startVisit(c);
                      },
                    );
                  },
                ),
    );
  }
}
