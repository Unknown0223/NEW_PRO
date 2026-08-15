import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';

import '../../../core/agent/outlet_radius.dart';
import '../../../core/api/api_exceptions.dart';
import '../../../core/api/field_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/clients/agent_outlet_filters_provider.dart';
import '../../../core/database/app_database.dart';
import '../../../core/gps/gps_tracker.dart';
import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../../core/ui/agent_visit_ui.dart';
import '../config/agent_config_enforcement.dart';
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

  Future<void> _load() async {
    final list = await AppDatabase().getAllClients();
    final tracker = ref.read(gpsTrackerProvider.notifier);
    final p = await tracker.getCurrentPosition();
    if (mounted) {
      setState(() {
        _clients = list;
        _pos = p;
        _loading = false;
      });
    }
  }

  double? _distanceM(Map<String, dynamic> client) {
    if (_pos == null || client['latitude'] == null || client['longitude'] == null) return null;
    return Geolocator.distanceBetween(
      _pos!.latitude,
      _pos!.longitude,
      (client['latitude'] as num).toDouble(),
      (client['longitude'] as num).toDouble(),
    );
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
              ? AgentEmptyState.fill(message: S.emptyStartVisitClients)
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
