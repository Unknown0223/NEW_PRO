import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/session.dart';
import '../../../core/database/app_database.dart';
import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../../core/ui/agent_visit_ui.dart';
import '../clients/agent_clients_outlet_list.dart';
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

/// Vizitlar (shablon Screen 7).
class AgentVisitsPage extends ConsumerWidget {
  const AgentVisitsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final config = ref.watch(sessionProvider).mobileConfig;
    final visitsEnabled = config?.misc.visitStartEndEnabled ?? true;
    final activeVisits = ref.watch(visitsTodayProvider).valueOrNull?.where((v) => v.status == 'in_progress').toList() ?? [];

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AgentAppBar(
        title: S.visits,
        actions: [
          AgentIconButton(icon: Icons.search, onPressed: () => context.push('/search?from=/visits')),
          Stack(
            clipBehavior: Clip.none,
            children: [
              AgentIconButton(icon: Icons.filter_list, onPressed: () => AgentFilterSheet.show(context)),
              Positioned(
                top: 10,
                right: 10,
                child: Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(color: AppColors.error, shape: BoxShape.circle),
                ),
              ),
            ],
          ),
          AgentIconButton(icon: Icons.map_outlined, onPressed: () => context.go('/map')),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
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
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
              child: _ActiveVisitPill(
                visit: activeVisits.first,
                onTap: () {
                  final id = activeVisits.first.clientId;
                  if (id != null) context.push('/visits/active/$id');
                },
              ),
            ),
          if (config?.gps.trackingEnabled == true) ...[
            const SizedBox(height: 10),
            const AgentVisitGpsBanner(),
          ],
          const SizedBox(height: 12),
          const AgentVisitsWeekTabs(),
          const SizedBox(height: 12),
          Expanded(
            child: visitsEnabled
                ? const AgentClientsOutletList(visitsMode: true)
                : const SizedBox.shrink(),
          ),
        ],
      ),
      floatingActionButton: visitsEnabled
          ? GestureDetector(
              onTap: () => context.push('/visits/start'),
              child: Container(
                width: 58,
                height: 58,
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                  boxShadow: AppColors.fabShadow,
                ),
                child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 28),
              ),
            )
          : null,
    );
  }
}

class _ActiveVisitPill extends StatelessWidget {
  final VisitRecord visit;
  final VoidCallback onTap;

  const _ActiveVisitPill({required this.visit, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.primarySoft,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.play_arrow_rounded, color: Color(0xFF036762), size: 16),
            const SizedBox(width: 4),
            Flexible(
              child: Text(
                visit.clientName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.bodySmall.copyWith(
                  color: const Color(0xFF036762),
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
