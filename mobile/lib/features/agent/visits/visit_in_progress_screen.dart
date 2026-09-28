import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_exceptions.dart';
import '../../../core/api/mobile_api.dart';
import '../../../core/api/field_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/clients/agent_client_balance.dart';
import '../../../core/clients/agent_outlet_filters_provider.dart';
import '../../../core/config/tenant_refs_provider.dart';
import '../../../core/config/mobile_order_guards.dart';
import '../../../core/database/app_database.dart';
import '../../../core/errors/error_reporter.dart';
import '../../../core/gps/gps_tracker.dart';
import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../../core/ui/agent_visit_ui.dart';
import '../../../core/ui/client_photo_thumb.dart';
import '../clients/client_photo_report_flow.dart';
import '../orders/held_order_model.dart';
import '../orders/held_orders_provider.dart';
import '../orders/order_draft_provider.dart';
import '../visits/visit_stats_helper.dart';
import '../shell/agent_app_bar.dart';
import 'agent_visits_page.dart';
import 'visit_supervision_sheet.dart';

class VisitInProgressScreen extends ConsumerStatefulWidget {
  final int clientId;

  const VisitInProgressScreen({super.key, required this.clientId});

  @override
  ConsumerState<VisitInProgressScreen> createState() => _VisitInProgressScreenState();
}

class _VisitInProgressScreenState extends ConsumerState<VisitInProgressScreen> {
  Map<String, dynamic>? _client;
  VisitRecord? _visit;
  bool _loading = true;
  bool _sendingHeld = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final client = await AppDatabase().getClientById(widget.clientId);
    final visits = await AppDatabase().getVisitsForDay();
    VisitRecord? active;
    for (final row in visits) {
      final v = visitFromRow(row);
      if (v.clientId == widget.clientId && v.status == 'in_progress') {
        active = v;
        break;
      }
    }
    if (mounted) {
      setState(() {
        _client = client;
        _visit = active;
        _loading = false;
      });
    }
  }

  Future<void> _persistVisit(VisitRecord updated) async {
    if (updated.id != null) {
      await AppDatabase().updateVisit(updated.id!, visitToRow(updated));
    }
    ref.invalidate(visitsTodayProvider);
    refreshVisitStatsProviders(ref.invalidate);
  }

  Future<void> _sendHeldOrderNow(int heldId) async {
    if (_sendingHeld) return;
    setState(() => _sendingHeld = true);
    try {
      await ref.read(heldOrderSchedulerProvider).submitNow(heldId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Заказ отправлен'), backgroundColor: AppColors.success),
      );
      await _load();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Не удалось отправить заказ'), backgroundColor: AppColors.error),
      );
    } finally {
      if (mounted) setState(() => _sendingHeld = false);
    }
  }

  Future<void> _completeVisit({required bool refused, String? reasonRef}) async {
    final visit = _visit;
    if (visit == null) return;

    // Tugashdan oldin kutilayotgan zakazlarni yuborish (ixtiyoriy — timer ham yuboradi).
    final held = (ref.read(heldOrdersProvider).valueOrNull ?? const [])
        .where((h) => h.clientId == widget.clientId)
        .toList();
    if (held.isNotEmpty && !refused) {
      final send = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Есть заказ в ожидании'),
          content: Text(
            held.length == 1
                ? 'Отправить заказ на сервер перед завершением визита?'
                : 'Отправить ${held.length} заказа на сервер перед завершением визита?',
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Позже')),
            TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Отправить')),
          ],
        ),
      );
      if (send == true) {
        for (final h in held) {
          try {
            await ref.read(heldOrderSchedulerProvider).submitNow(h.id);
          } catch (_) {}
        }
      }
      if (!mounted) return;
    }

    final updated = visit.copyWith(
      status: refused ? 'refused' : 'completed',
      endTime: DateTime.now().toIso8601String(),
      refusalReasonRef: reasonRef,
    );
    await _persistVisit(updated);
    if (!mounted) return;
    context.go('/visits');
  }

  Future<void> _addPhotoReport() async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return;
    final category = await pickPhotoReportCategory(context, ref);
    if (category == null || !mounted) return;
    final row = await captureAndUploadPhotoReport(
      context: context,
      ref: ref,
      slug: slug,
      clientId: widget.clientId,
      category: category,
    );
    if (row != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Фотоотчет сохранён'), backgroundColor: AppColors.success),
      );
    }
  }

  Future<void> _pickRefusal() async {
    // Foto otchot majburiy bo'lsa — avval foto talab qilinadi.
    final photoRequired = ref.read(sessionProvider).mobileConfig?.photo.requiredForOrder ?? false;
    if (photoRequired) {
      final slug = ref.read(sessionProvider).tenantSlug ?? '';
      if (slug.isNotEmpty && _visit?.clientId != null) {
        try {
          final photos = await ref.read(mobileApiProvider).getClientPhotoReports(slug, _visit!.clientId!);
          if (!hasPhotoReportToday(photos)) {
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Сначала добавьте фотоотчет перед отказом'),
                  backgroundColor: AppColors.warning,
                ),
              );
            }
            return;
          }
        } catch (_) {
          // Network xato — offline da davom etiladi.
        }
      }
    }

    final reasons = ref.read(refusalReasonsProvider);
    if (reasons.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Нет причин отказа — синхронизируйте справочник'),
            backgroundColor: AppColors.warning,
          ),
        );
      }
      return;
    }
    final picked = await showRefusalReasonSheet(context, reasons);
    if (picked == null || !mounted) return;

    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    final visit = _visit;
    if (slug.isNotEmpty && visit?.clientId != null) {
      try {
        await ref.read(fieldApiProvider).createVisit(
              slug,
              clientId: visit!.clientId,
              latitude: visit.latitude,
              longitude: visit.longitude,
              notes: 'Rad: ${picked.name}',
              refusalReasonRef: picked.id,
            );
      } on ApiException catch (e) {
        ErrorReporter.instance?.reportCaught(
          e,
          module: ErrorModules.visits,
          code: 'VisitRefuseFailed',
          message: 'Визит: отказ не сохранился на сервере',
          path: '/mobile/field/visits',
          payload: {'client_id': visit?.clientId, 'reason_ref': picked.id},
        );
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Отказ не сохранён: ${e.message}'), backgroundColor: AppColors.error),
          );
        }
      } catch (e, st) {
        ErrorReporter.instance?.reportCaught(
          e,
          stack: st,
          module: ErrorModules.visits,
          code: 'VisitRefuseUnexpected',
          message: 'Визит: неожиданная ошибка при отказе',
          path: '/mobile/field/visits',
          payload: {'client_id': visit?.clientId},
        );
      }
    }
    await _completeVisit(refused: true, reasonRef: picked.id);
  }

  bool get _supervisionEnabled {
    return supervisionChecklistEnabled(ref.read(sessionProvider).mobileConfig?.supervision);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: AppColors.background,
        body: Center(child: CircularProgressIndicator(color: AppColors.primary)),
      );
    }

    final client = _client;
    final visit = _visit;
    if (client == null || visit == null) {
      return Scaffold(
        backgroundColor: AppColors.background,
        appBar: const AgentAppBar(title: S.visitInProgressTitle, showBack: true),
        body: AgentEmptyState.fill(message: 'Активный визит не найден'),
      );
    }

    final name = client['name']?.toString() ?? visit.clientName;
    final code = client['client_code']?.toString().trim() ?? '';
    final category = client['category']?.toString().trim() ?? 'B';
    final showBalance = ref.watch(sessionProvider).mobileConfig?.client.showBalance ?? true;
    final agentBalances = ref.watch(clientAgentLedgerBalancesProvider).valueOrNull;
    final balanceAmount = showBalance
        ? clientAgentLedgerBalance(agentBalances, widget.clientId)
        : null;
    final drafts = ref.watch(orderDraftsProvider).valueOrNull;
    final hasDraft = drafts?[widget.clientId] != null;
    HeldOrder? heldOrder;
    for (final h in ref.watch(heldOrdersProvider).valueOrNull ?? const <HeldOrder>[]) {
      if (h.clientId == widget.clientId) {
        heldOrder = h;
        break;
      }
    }
    final held = heldOrder;
    // Faqat held countdown uchun — SQLite emas.
    if (held != null) ref.watch(heldOrderTickProvider);
    final gps = ref.watch(gpsTrackerProvider);
    final pos = gps.lastPosition;
    final gpsLine = pos != null
        ? 'GPS: ${pos.latitude.toStringAsFixed(3)}°N ${pos.longitude.toStringAsFixed(3)}°E · точн. ${pos.accuracy.round()}м'
        : S.gpsStarting;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AgentAppBar(
        title: S.visitInProgressTitle,
        showBack: true,
        belowTitle: Text(
          name,
          style: AppTypography.bodyMedium.copyWith(fontSize: 13, color: AppColors.textMuted),
        ),
      ),
      body: Stack(
        children: [
          ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 360),
            children: [
              AgentLiveStopwatch(startSeconds: visitElapsedSeconds(visit.startTime)),
              const SizedBox(height: 12),
              AgentVisitOutletCard(
                name: name,
                code: code.isEmpty ? '—' : code,
                grade: category.isEmpty ? 'B' : category,
                photoUrl: firstClientPhotoUrl(client),
                balanceAmount: balanceAmount,
                hasDraft: hasDraft,
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(color: AppColors.success, shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(gpsLine, style: AppTypography.captionSmall.copyWith(color: AppColors.textMuted)),
                  ),
                ],
              ),
            ],
          ),
          Align(
            alignment: Alignment.bottomCenter,
            child: AgentVisitActionsSheet(
              clientName: name,
              subtitle: [code, category.isNotEmpty ? 'Категория $category' : null].whereType<String>().where((s) => s.isNotEmpty).join(' · '),
              createOrderEnabled: ref.watch(sessionProvider).permissions.canCreateOrders,
              supervisionEnabled: _supervisionEnabled,
              onPhotoReport: _addPhotoReport,
              onCreateOrder: () {
                final clientExtra = Map<String, dynamic>.from(client);
                context.push(
                  '/orders/create?client_id=${widget.clientId}',
                  extra: clientExtra,
                );
              },
              onSendHeldOrder: held == null ? null : () => _sendHeldOrderNow(held.id),
              heldOrderHint: held == null
                  ? null
                  : 'Ожидает · ${formatHeldCountdown(held.remaining())}',
              sendHeldBusy: _sendingHeld,
              onRefusal: _pickRefusal,
              onSupervision: () async {
                final supervision = ref.read(sessionProvider).mobileConfig?.supervision;
                if (supervision == null || !supervisionChecklistEnabled(supervision)) return;
                final result = await VisitSupervisionSheet.show(context, supervision);
                if (result != null && mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Чек-лист сохранён'), backgroundColor: AppColors.success),
                  );
                }
              },
              onComplete: () => _completeVisit(refused: false),
            ),
          ),
        ],
      ),
    );
  }
}
