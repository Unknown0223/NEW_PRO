import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/mobile_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/config/mobile_config.dart';
import '../../../core/config/mobile_config_policy.dart';
import '../../../core/config/sync_policy_provider.dart';
import '../../../core/database/app_database.dart';
import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/time/work_region_time.dart';
import '../../../core/ui/agent_ui.dart';
import '../../auth/auth_provider.dart';
import '../sync/sync_bottom_sheet.dart';
import '../visits/visit_stats_helper.dart';
import '../../../core/sync/sync_data_refresh.dart';
import 'agent_dashboard_provider.dart';
import 'agent_home_dashboard.dart';
import 'home_visit_metrics_provider.dart';
import 'last_created_order_banner.dart';
import 'sync_count_provider.dart';

final homeStatsProvider = FutureProvider<Map<String, int>>((ref) async {
  final db = AppDatabase();
  final counts = await Future.wait([
    db.clientCount(),
    db.productCount(),
    db.orderCount(),
    db.pendingCount(),
    db.pendingPhotoReportCount(),
    db.getPhotosSyncedToday(),
    db.failedPhotoReportCount(),
  ]);
  return {
    'clients': counts[0],
    'products': counts[1],
    'orders': counts[2],
    'pending': counts[3],
    'pending_photos': counts[4],
    'synced_photos': counts[5],
    'failed_photos': counts[6],
  };
});

class AgentHomePage extends ConsumerStatefulWidget {
  const AgentHomePage({super.key});

  @override
  ConsumerState<AgentHomePage> createState() => _AgentHomePageState();
}

class _AgentHomePageState extends ConsumerState<AgentHomePage> {
  Timer? _syncPolicyPoll;
  /// Birinchi kadrlar bo‘shalsin — dashboard/metrics/API birdaniga ANR beradi.
  bool _heavyProvidersReady = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // Avval UI chizilsin; keyin og‘ir provayderlar + tarmoq.
      unawaited(
        Future<void>.delayed(const Duration(milliseconds: 1800), () {
          if (!mounted) return;
          setState(() => _heavyProvidersReady = true);
          refreshVisitStatsProviders(ref.invalidate);
        }),
      );
      unawaited(
        Future<void>.delayed(const Duration(seconds: 3), () async {
          if (!mounted) return;
          await _refreshSyncConfigOnOpen();
        }),
      );
      // Bootstrap tugagach darhol ikkinchi sync — kirishda osilib qoladi.
      // Faqat uzoqroq kutib, yumshoq tekshiruv.
      unawaited(
        Future<void>.delayed(const Duration(minutes: 2), () async {
          if (!mounted) return;
          await _fixStaleClientCatalog();
        }),
      );
    });
  }

  @override
  void dispose() {
    _syncPolicyPoll?.cancel();
    super.dispose();
  }

  Future<void> _refreshSyncConfigOnOpen() async {
    await ref.read(authStateProvider.notifier).refreshMobileConfig();
    if (!mounted) return;
    _ensureSyncPolicyPoll();
  }

  void _ensureSyncPolicyPoll() {
    final allowed = ref.read(syncPolicyProvider).allowed;
    if (allowed) {
      _syncPolicyPoll?.cancel();
      _syncPolicyPoll = null;
      return;
    }
    if (_syncPolicyPoll != null) return;
    _syncPolicyPoll = Timer.periodic(const Duration(seconds: 45), (_) async {
      if (!mounted) return;
      await ref.read(authStateProvider.notifier).refreshMobileConfig();
      if (!mounted) return;
      if (ref.read(syncPolicyProvider).allowed) {
        _syncPolicyPoll?.cancel();
        _syncPolicyPoll = null;
        setState(() {});
      }
    });
  }

  Future<void> _tryRefreshAndOpenSync() async {
    final policy =
        await ref.read(authStateProvider.notifier).refreshConfigAndEvaluateSyncPolicy();
    if (!mounted) return;
    if (policy.allowed) {
      if (!context.mounted) return;
      await SyncBottomSheet.show(context);
      return;
    }
    if (!context.mounted) return;
    showAgentToast(
      context,
      policy.denialMessage ?? syncWindowMessage(
        ref.read(sessionProvider).mobileConfig?.sync ?? const SyncConfig(),
      ),
      accentColor: AppColors.warning,
    );
  }

  Future<void> _fixStaleClientCatalog() async {
    if (ref.read(sessionProvider).user?.role != 'agent') return;
    final syncCfg = ref.read(sessionProvider).mobileConfig?.sync ?? const SyncConfig();
    if (!evaluateSyncPolicy(syncCfg).allowed) return;
    final db = AppDatabase();
    // Yangi bootstrap sync endigina bo‘lsa — katalogni yana tortmaslik.
    final lastSyncRaw = await db.getSyncMeta('last_sync_at');
    final lastSync = DateTime.tryParse(lastSyncRaw ?? '');
    if (lastSync != null &&
        DateTime.now().toUtc().difference(lastSync.toUtc()) <
            const Duration(minutes: 10)) {
      return;
    }
    if (!await db.needsFullClientCatalogResync()) return;

    // Bir kunda bir marta majburiy katalog — har home ochilishda to‘liq sync emas.
    const cooldownKey = 'client_catalog_force_attempt_at';
    final lastRaw = await db.getSyncMeta(cooldownKey);
    final lastAt = DateTime.tryParse(lastRaw ?? '');
    if (lastAt != null &&
        DateTime.now().toUtc().difference(lastAt.toUtc()) < const Duration(hours: 12)) {
      return;
    }
    await db.setSyncMeta(cooldownKey, DateTime.now().toUtc().toIso8601String());

    final r = await ref.read(authStateProvider.notifier).resync(
          full: false,
          forceClientCatalog: true,
        );
    if (mounted && r.ok) {
      invalidateSyncedData(ref.invalidate);
    }
  }

  String _formatSync(String? iso) => formatWorkRegionDateTime(iso);

  @override
  Widget build(BuildContext context) {
    ref.listen<SyncPolicyEvaluation>(syncPolicyProvider, (previous, next) {
      if (!next.allowed) {
        _ensureSyncPolicyPoll();
      } else {
        _syncPolicyPoll?.cancel();
        _syncPolicyPoll = null;
      }
    });

    final session = ref.watch(sessionProvider);
    final statsAsync = ref.watch(homeStatsProvider);
    final dashAsync = _heavyProvidersReady
        ? ref.watch(agentDashboardProvider)
        : const AsyncValue<AgentDashboardResult>.loading();
    final metricsAsync = _heavyProvidersReady
        ? ref.watch(homeVisitMetricsProvider)
        : const AsyncValue<HomeVisitMetrics>.loading();
    final createdBanner = ref.watch(lastCreatedOrderBannerProvider);
    final dash = dashAsync.valueOrNull;
    final metrics = metricsAsync.valueOrNull;
    final syncCfg = session.mobileConfig?.sync ?? const SyncConfig();
    final syncCountAsync = ref.watch(syncCountTodayProvider);
    final mustSync = syncCountAsync.maybeWhen(
      data: (n) => needsMandatorySync(syncCfg, n),
      orElse: () => false,
    );
    final syncPolicy = evaluateSyncPolicy(syncCfg);
    final syncAllowed = syncPolicy.allowed;

    // Shablon HomeDashboard: AppBar yo‘q — header dashboard ichida.
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
        onRefresh: () async {
          await ref.read(authStateProvider.notifier).refreshMobileConfig();
          final freshCfg = ref.read(sessionProvider).mobileConfig?.sync ?? const SyncConfig();
          final policy = evaluateSyncPolicy(freshCfg);
          if (!policy.allowed) {
            if (!context.mounted) return;
            showAgentToast(
                context,
                policy.denialMessage ?? syncWindowMessage(freshCfg),
                accentColor: AppColors.warning,
            );
            return;
          }
          final forceCatalog = await AppDatabase().needsFullClientCatalogResync();
          final r = await ref.read(authStateProvider.notifier).resync(
                full: false,
                forceClientCatalog: forceCatalog,
              );
          invalidateSyncedData(ref.invalidate);
          if (!context.mounted) return;
          if (!r.ok && r.error != null) {
            showAgentToast(context, r.error!, accentColor: AppColors.error);
          }
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (createdBanner != null)
                AgentSurfaceCard(
                  padding: const EdgeInsets.fromLTRB(12, 10, 8, 10),
                  margin: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    children: [
                      const Icon(Icons.check_circle, color: AppColors.success, size: 22),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              S.orderCreatedBanner(createdBanner.number),
                              style: AppTypography.bodySmall.copyWith(
                                fontWeight: FontWeight.w800,
                                color: AppColors.textTitle,
                              ),
                            ),
                            Text(
                              createdBanner.clientName?.trim().isNotEmpty == true
                                  ? createdBanner.clientName!
                                  : S.orderCreatedBannerHint,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTypography.caption.copyWith(color: AppColors.textMuted),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        tooltip: S.cancel,
                        onPressed: () {
                          ref.read(lastCreatedOrderBannerProvider.notifier).state = null;
                        },
                        icon: const Icon(Icons.close, size: 20, color: AppColors.textMuted),
                      ),
                    ],
                  ),
                ),
              if (mustSync)
                AgentSurfaceCard(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 8),
                  child: InkWell(
                    onTap: syncAllowed ? () => SyncBottomSheet.show(context) : null,
                    borderRadius: BorderRadius.circular(10),
                    child: Row(
                      children: [
                        const Icon(Icons.sync_problem, color: AppColors.warning),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            '${S.mandatorySync} ${syncCfg.mandatorySyncCount} (сегодня: ${syncCountAsync.valueOrNull ?? 0})',
                            style: AppTypography.bodySmall,
                          ),
                        ),
                        if (syncAllowed)
                          const Icon(Icons.chevron_right, color: AppColors.textMuted, size: 20),
                      ],
                    ),
                  ),
                ),
              if (!syncAllowed)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(
                    syncWindowMessage(syncCfg),
                    style: AppTypography.caption.copyWith(color: AppColors.warning),
                  ),
                ),
              AgentHomeDashboard(
                userName: () {
                  final n = (session.user?.name ?? '').trim();
                  return n.isEmpty ? 'Agent' : n;
                }(),
                dateLine: _formatSync(DateTime.now().toUtc().toIso8601String()),
                dash: dash,
                metrics: metrics,
                localClients: statsAsync.valueOrNull?['clients'] ?? 0,
                pendingPhotos: ref.watch(pendingPhotoCountProvider).valueOrNull ??
                    statsAsync.valueOrNull?['pending_photos'] ??
                    0,
                syncedPhotos: ref.watch(syncedPhotoCountTodayProvider).valueOrNull ??
                    statsAsync.valueOrNull?['synced_photos'] ??
                    0,
                lastSyncLabel: _formatSync(session.lastSyncAt),
                syncAllowed: syncAllowed,
                onSync: syncAllowed
                    ? () => SyncBottomSheet.show(context)
                    : () => unawaited(_tryRefreshAndOpenSync()),
                onOpenNotifications: () => context.push('/notifications'),
              ),
            ],
          ),
        ),
      ),
      ),
    );
  }
}

