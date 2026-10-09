import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';

import '../../../core/clients/client_outlet_filters.dart';
import '../../../core/database/app_database.dart';
import '../../../core/errors/error_reporter.dart';
import '../../../core/gps/gps_tracker.dart';
import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/time/work_region_time.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../../core/ui/agent_visit_ui.dart';
import '../../../core/ui/client_photo_thumb.dart';
import '../clients/clients_list_provider.dart';
import '../route/agent_route_provider.dart';
import '../shell/agent_app_bar.dart';
import 'visit_starter.dart';

class StartVisitScreen extends ConsumerStatefulWidget {
  const StartVisitScreen({super.key});

  @override
  ConsumerState<StartVisitScreen> createState() => _StartVisitScreenState();
}

class _StartVisitScreenState extends ConsumerState<StartVisitScreen> {
  List<Map<String, dynamic>> _clients = [];
  bool _loading = true;
  String? _loadError;
  Position? _pos;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<List<Map<String, dynamic>>> _allClientsCached() async {
    try {
      return await ref.read(clientsListProvider.future);
    } catch (_) {
      return AppDatabase().getAllClients();
    }
  }

  /// Lokal DB — darhol (tarmoq/GPS kutmasdan).
  Future<List<Map<String, dynamic>>> _clientsFromLocalPlan() async {
    final all = await _allClientsCached();
    final routeDate = serverTodayKey();
    final weekday = serverTodayWeekday();
    return all.where((c) => clientPlannedForVisitDay(c, weekday, routeDate)).toList();
  }

  /// Server marshruti (timeout bilan) — bo‘sh bo‘lsa lokal reja.
  Future<List<Map<String, dynamic>>> _clientsForTodayVisit() async {
    final all = await _allClientsCached();
    final byId = <int, Map<String, dynamic>>{
      for (final c in all)
        if (c['id'] is num) (c['id'] as num).toInt(): c,
    };

    Map<String, dynamic>? route;
    try {
      route = await ref
          .read(realTodayRouteProvider.future)
          .timeout(const Duration(seconds: 8));
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
          'name': raw['client_name']?.toString() ?? 'Клиент #$cid',
          'client_code': raw['client_code'],
          'latitude': raw['latitude'],
          'longitude': raw['longitude'],
        });
      }
      if (out.isNotEmpty) return out;
    }

    return _clientsFromLocalPlan();
  }

  void _sortByDistance(List<Map<String, dynamic>> list, Position p) {
    list.sort((a, b) {
      final da = _distanceMFor(a, p);
      final db = _distanceMFor(b, p);
      if (da == null && db == null) return 0;
      if (da == null) return 1;
      if (db == null) return -1;
      return da.compareTo(db);
    });
  }

  Future<void> _load() async {
    // 1) Lokal ro‘yxatni tez ko‘rsatish — spinner abadiy qolmasin.
    try {
      final local = await _clientsFromLocalPlan();
      if (mounted) {
        setState(() {
          _clients = local;
          _loading = false;
          _loadError = null;
        });
      }
    } catch (e, st) {
      ErrorReporter.instance?.reportCaught(
        e,
        stack: st,
        module: ErrorModules.visits,
        code: 'VisitListLocalFailed',
        message: 'Визит: локальный список клиентов не загрузился',
        path: '/mobile/visits/start',
      );
      if (mounted) {
        setState(() {
          _loading = false;
          _loadError = e.toString();
        });
      }
    }

    // 2) Server marshruti (qisqa timeout) — yangilash.
    try {
      final list = await _clientsForTodayVisit();
      if (!mounted) return;
      setState(() => _clients = list);
    } catch (_) {}

    // 3) GPS — tezkor, UI ni bloklamaydi.
    try {
      final p = await ref
          .read(gpsTrackerProvider.notifier)
          .getQuickPosition()
          .timeout(const Duration(seconds: 5), onTimeout: () => null);
      if (!mounted || p == null) return;
      final sorted = [..._clients];
      _sortByDistance(sorted, p);
      setState(() {
        _pos = p;
        _clients = sorted;
      });
    } catch (_) {}
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
    if (id is! num) return;
    final ok = await startAgentVisit(context, ref, client);
    if (!ok || !mounted) return;
    context.go('/visits/active/${id.toInt()}');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const AgentAppBar(title: S.startVisit, showBack: true),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _loadError != null && _clients.isEmpty
              ? AgentEmptyState.fill(
                  message: _loadError!,
                  action: AgentPrimaryButton(
                    label: S.retry,
                    onPressed: () {
                      setState(() {
                        _loading = true;
                        _loadError = null;
                      });
                      unawaited(_load());
                    },
                  ),
                )
              : _clients.isEmpty
                  ? AgentEmptyState.fill(
                      message: S.noVisitsPlannedToday,
                      action: AgentPrimaryButton(
                        label: S.home,
                        onPressed: () {
                          if (context.mounted) context.go('/home');
                        },
                      ),
                    )
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
                          photoUrl: firstClientPhotoUrl(c),
                          distanceLabel: dist.isEmpty ? null : dist,
                          onTap: () => _startVisit(c),
                        );
                      },
                    ),
    );
  }
}
