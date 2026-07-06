import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../../../core/agent/outlet_radius.dart';
import '../../../core/api/api_exceptions.dart';
import '../../../core/api/field_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/clients/agent_outlet_filters_provider.dart';
import '../../../core/config/tenant_references.dart';
import '../../../core/config/tenant_refs_provider.dart';
import '../../../core/database/app_database.dart';
import '../../../core/gps/gps_tracker.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../../core/ui/agent_visit_header.dart';
import '../clients/agent_clients_outlet_list.dart';
import '../clients/client_photo_report_flow.dart';
import '../../../core/config/mobile_config.dart';
import '../../../core/config/mobile_order_guards.dart';
import '../config/agent_config_enforcement.dart';
import '../clients/client_qr_sheet.dart';
import 'visit_supervision_sheet.dart';
import '../home/home_visit_metrics_provider.dart';
import '../shell/agent_app_bar.dart';

class VisitRecord {
  final int? id;
  final int? clientId;
  final String clientName;
  final double? latitude, longitude;
  final String? startTime, endTime, notes;
  final List<String> photoPaths;
  final String? refusalReasonRef;
  final String status;
  const VisitRecord({
    this.id,
    this.clientId,
    required this.clientName,
    this.latitude,
    this.longitude,
    this.startTime,
    this.endTime,
    this.notes,
    this.photoPaths = const [],
    this.refusalReasonRef,
    this.status = 'pending',
  });
  VisitRecord copyWith({
    int? id,
    int? clientId,
    String? clientName,
    double? latitude,
    double? longitude,
    String? startTime,
    String? endTime,
    String? notes,
    List<String>? photoPaths,
    String? refusalReasonRef,
    String? status,
  }) =>
      VisitRecord(
        id: id ?? this.id,
        clientId: clientId ?? this.clientId,
        clientName: clientName ?? this.clientName,
        latitude: latitude ?? this.latitude,
        longitude: longitude ?? this.longitude,
        startTime: startTime ?? this.startTime,
        endTime: endTime ?? this.endTime,
        notes: notes ?? this.notes,
        photoPaths: photoPaths ?? this.photoPaths,
        refusalReasonRef: refusalReasonRef ?? this.refusalReasonRef,
        status: status ?? this.status,
      );
}

VisitRecord visitFromRow(Map<String, dynamic> r) {
  List<String> photos = const [];
  final raw = r['photo_paths'];
  if (raw is String && raw.isNotEmpty) {
    try {
      photos = (jsonDecode(raw) as List).map((e) => e.toString()).toList();
    } catch (_) {}
  }
  return VisitRecord(
    id: r['id'] as int?,
    clientId: r['client_id'] as int?,
    clientName: r['client_name'] as String? ?? '—',
    latitude: (r['latitude'] as num?)?.toDouble(),
    longitude: (r['longitude'] as num?)?.toDouble(),
    startTime: r['start_time'] as String?,
    endTime: r['end_time'] as String?,
    notes: r['notes'] as String?,
    photoPaths: photos,
    refusalReasonRef: r['refusal_reason_ref'] as String?,
    status: r['status'] as String? ?? 'pending',
  );
}

Map<String, dynamic> visitToRow(VisitRecord v) => {
      'client_id': v.clientId,
      'client_name': v.clientName,
      'latitude': v.latitude,
      'longitude': v.longitude,
      'start_time': v.startTime,
      'end_time': v.endTime,
      'notes': v.notes,
      'photo_paths': jsonEncode(v.photoPaths),
      'refusal_reason_ref': v.refusalReasonRef,
      'status': v.status,
    };

final visitsTodayProvider = FutureProvider<List<VisitRecord>>((ref) async {
  final rows = await AppDatabase().getVisitsForDay();
  return rows.map(visitFromRow).toList();
});

/// Vizitlar (shablon VisitsScreen — DayTabs + OutletList).
class AgentVisitsPage extends ConsumerWidget {
  const AgentVisitsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final config = ref.watch(sessionProvider).mobileConfig;
    final visitsEnabled = config?.misc.visitStartEndEnabled ?? true;
    final gpsState = ref.watch(gpsTrackerProvider);
    final activeVisits = ref.watch(visitsTodayProvider).valueOrNull?.where((v) => v.status == 'in_progress').toList() ?? [];

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AgentAppBar(
        title: S.visits,
        actions: [
          AgentIconButton(icon: Icons.search, onPressed: () => context.push('/search?from=/visits')),
          AgentIconButton(icon: Icons.filter_list, onPressed: () => AgentFilterSheet.show(context)),
          AgentIconButton(icon: Icons.map_outlined, onPressed: () => context.go('/map')),
        ],
      ),
      body: Column(
        children: [
          if (!visitsEnabled)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Text(
                S.visitsDisabled,
                style: AppTypography.caption.copyWith(color: AppColors.textMuted),
              ),
            ),
          if (activeVisits.isNotEmpty)
            SizedBox(
              height: 88,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                itemCount: activeVisits.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, i) => _ActiveVisitChip(visit: activeVisits[i]),
              ),
            ),
          AgentVisitHeader(
            showGps: config?.gps.trackingEnabled == true,
            gpsStatus: gpsState.status,
          ),
          Expanded(
            child: visitsEnabled
                ? const AgentClientsOutletList(visitsMode: true)
                : const SizedBox.shrink(),
          ),
        ],
      ),
      floatingActionButton: visitsEnabled
          ? FloatingActionButton(
              backgroundColor: AppColors.primary,
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const StartVisitScreen()),
              ),
              child: const Icon(Icons.play_arrow, color: Colors.white),
            )
          : null,
    );
  }
}

class _ActiveVisitChip extends ConsumerWidget {
  final VisitRecord visit;
  const _ActiveVisitChip({required this.visit});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: () => _showVisitActions(context, ref),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            children: [
              const Icon(Icons.play_circle_fill, color: AppColors.primary, size: 20),
              const SizedBox(width: 8),
              Text(visit.clientName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
            ],
          ),
        ),
      ),
    );
  }

  void _showVisitActions(BuildContext context, WidgetRef ref) {
    final clientId = visit.clientId;
    if (clientId == null) return;

    Future<void> addPhotoReport() async {
      final slug = ref.read(sessionProvider).tenantSlug ?? '';
      if (slug.isEmpty) return;
      final category = await pickPhotoReportCategory(context, ref);
      if (category == null || !context.mounted) return;
      final row = await captureAndUploadPhotoReport(
        context: context,
        ref: ref,
        slug: slug,
        clientId: clientId,
        category: category,
      );
      if (row != null && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Фотоотчет сохранён'), backgroundColor: AppColors.success),
        );
      }
    }

    showAgentClientActionsSheet(
      context,
      onPhotoReport: addPhotoReport,
      onRefusal: () => _pickRefusalAndSend(context, ref),
      onCreateOrder: () => context.push('/orders/create?client_id=$clientId'),
      createOrderEnabled: ref.read(sessionProvider).permissions.canCreateOrders,
      qrEnabled: _qrEnabledForVisit(ref),
      onQrBind: () => _openQrSheet(context, ref, clientId: clientId, clientName: visit.clientName),
      supervisionEnabled: _supervisionEnabled(ref),
      onSupervisionChecklist: () => _openSupervisionSheet(context, ref),
    );
  }

  bool _qrEnabledForVisit(WidgetRef ref) {
    final misc = ref.read(sessionProvider).mobileConfig?.misc ?? const MiscConfig();
    return misc.qrAttachVisitPage || misc.qrChangeVisitPage;
  }

  bool _supervisionEnabled(WidgetRef ref) {
    return supervisionChecklistEnabled(ref.read(sessionProvider).mobileConfig?.supervision);
  }

  Future<void> _openQrSheet(
    BuildContext context,
    WidgetRef ref, {
    required int clientId,
    required String clientName,
  }) async {
    final misc = ref.read(sessionProvider).mobileConfig?.misc ?? const MiscConfig();
    final ok = await ClientQrSheet.show(
      context,
      clientId: clientId,
      clientName: clientName,
      allowChange: misc.qrChangeVisitPage,
    );
    if (ok == true && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('QR saqlandi'), backgroundColor: AppColors.success),
      );
    }
  }

  Future<void> _openSupervisionSheet(BuildContext context, WidgetRef ref) async {
    final supervision = ref.read(sessionProvider).mobileConfig?.supervision;
    if (supervision == null || !supervisionChecklistEnabled(supervision)) return;
    final result = await VisitSupervisionSheet.show(context, supervision);
    if (result != null && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Checklist saqlandi'), backgroundColor: AppColors.success),
      );
    }
  }

  Future<void> _persistVisit(WidgetRef ref, VisitRecord updated) async {
    if (updated.id != null) {
      await AppDatabase().updateVisit(updated.id!, visitToRow(updated));
    }
    ref.invalidate(visitsTodayProvider);
    ref.invalidate(visitedTodayClientIdsProvider);
    ref.invalidate(homeVisitMetricsProvider);
  }

  Future<void> _completeVisit(BuildContext context, WidgetRef ref, {required bool refused, String? reasonRef}) async {
    final updated = visit.copyWith(
      status: refused ? 'refused' : 'completed',
      endTime: DateTime.now().toIso8601String(),
      refusalReasonRef: reasonRef,
    );
    await _persistVisit(ref, updated);
  }

  Future<void> _pickRefusalAndSend(BuildContext context, WidgetRef ref) async {
    final reasons = ref.read(refusalReasonsProvider);
    final picked = await showDialog<RefEntry>(
      context: context,
      builder: (ctx) => SimpleDialog(
        title: const Text(S.refuseReason),
        children: reasons
            .map((e) => SimpleDialogOption(
                  onPressed: () => Navigator.pop(ctx, e),
                  child: Text(e.name),
                ),)
            .toList(),
      ),
    );
    if (picked == null || !context.mounted) return;

    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isNotEmpty && visit.clientId != null) {
      try {
        await ref.read(fieldApiProvider).createVisit(
          slug,
          clientId: visit.clientId,
          latitude: visit.latitude,
          longitude: visit.longitude,
          notes: 'Rad: ${picked.name}',
          refusalReasonRef: picked.id,
        );
      } on ApiException catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Rad saqlanmadi: ${e.message}'), backgroundColor: AppColors.error),
          );
        }
      } catch (_) {}
    }
    await _completeVisit(context, ref, refused: true, reasonRef: picked.id);
  }
}

// StartVisitScreen and rest of visit flow — keep from original file
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
              padding: const EdgeInsets.all(12),
              itemCount: _clients.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (_, i) {
                final c = _clients[i];
                double? distM;
                if (_pos != null && c['latitude'] != null && c['longitude'] != null) {
                  distM = Geolocator.distanceBetween(
                    _pos!.latitude,
                    _pos!.longitude,
                    (c['latitude'] as num).toDouble(),
                    (c['longitude'] as num).toDouble(),
                  );
                }
                return AgentOutletCard(
                  name: c['name']?.toString() ?? '—',
                  subtitle: distM != null ? '${(distM / 1000).toStringAsFixed(1)} km' : (c['address']?.toString() ?? '—'),
                  trailing: distM != null ? '${distM.round()} m' : '',
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
    var backendOk = false;
    if (slug.isNotEmpty) {
      try {
        final res = await ref.read(fieldApiProvider).createVisit(
          slug,
          clientId: clientId,
          latitude: visit.latitude,
          longitude: visit.longitude,
        );
        backendOk = res['id'] != null;
      } on ApiException catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Vizit xato: ${e.message}'), backgroundColor: AppColors.error),
          );
        }
      } catch (_) {}
    }

    ref.invalidate(visitsTodayProvider);
    ref.invalidate(visitedTodayClientIdsProvider);
    ref.invalidate(homeVisitMetricsProvider);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(backendOk ? 'Vizit boshlandi: $name' : 'Vizit mahalliy: $name'),
        backgroundColor: backendOk ? AppColors.success : AppColors.warning,
      ),
    );
    Navigator.pop(context);
    context.push('/clients/$clientId');
  }
}
