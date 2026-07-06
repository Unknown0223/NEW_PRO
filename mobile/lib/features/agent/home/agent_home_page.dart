import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/mobile_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/config/mobile_config.dart';
import '../../../core/config/mobile_config_policy.dart';
import '../../../core/database/app_database.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/time/work_region_time.dart';
import '../../auth/auth_provider.dart';
import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../../core/config/sync_window_countdown.dart';
import '../shell/agent_app_bar.dart';
import '../sync/sync_bottom_sheet.dart';
import 'agent_dashboard_provider.dart';
import 'home_visit_metrics_provider.dart';
import 'sync_count_provider.dart';

String planDashboardLine(AgentDashboardResult dash, String? planVersion) {
  final base =
      'Reja: ${dash.planSum.toStringAsFixed(0)} · Buyurtma: ${dash.ordersSumToday.toStringAsFixed(0)}';
  final v = planVersion?.trim();
  if (v == null || v.isEmpty) return base;
  return '$base · v$v';
}

final homeStatsProvider = FutureProvider<Map<String, int>>((ref) async {
  final db = AppDatabase();
  return {
    'clients': await db.clientCount(),
    'products': await db.productCount(),
    'orders': await db.orderCount(),
    'pending': await db.pendingCount(),
  };
});

class AgentHomePage extends ConsumerStatefulWidget {
  const AgentHomePage({super.key});

  @override
  ConsumerState<AgentHomePage> createState() => _AgentHomePageState();
}

class _AgentHomePageState extends ConsumerState<AgentHomePage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _fixStaleClientCatalog());
  }

  Future<void> _fixStaleClientCatalog() async {
    if (ref.read(sessionProvider).user?.role != 'agent') return;
    final syncCfg = ref.read(sessionProvider).mobileConfig?.sync ?? const SyncConfig();
    if (!evaluateSyncPolicy(syncCfg).allowed) return;
    final db = AppDatabase();
    if (await db.isAgentClientsSynced()) return;
    final n = await db.clientCount();
    if (n <= 50) return;
    final r = await ref.read(authStateProvider.notifier).resync(full: true);
    if (mounted && r.ok) {
      ref.invalidate(homeStatsProvider);
      ref.invalidate(syncCountTodayProvider);
    }
  }

  String _formatSync(String? iso) => formatWorkRegionDateTime(iso);

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final statsAsync = ref.watch(homeStatsProvider);
    final dashAsync = ref.watch(agentDashboardProvider);
    final metricsAsync = ref.watch(homeVisitMetricsProvider);
    final dash = dashAsync.valueOrNull;
    final metrics = metricsAsync.valueOrNull;
    final showPlan = session.mobileConfig?.outlet.showPlanInReports ?? false;
    final performance = (dashAsync.valueOrNull?.performancePct ?? 0) / 100.0;
    final syncCfg = session.mobileConfig?.sync ?? const SyncConfig();
    final syncCountAsync = ref.watch(syncCountTodayProvider);
    final mustSync = syncCountAsync.maybeWhen(
      data: (n) => needsMandatorySync(syncCfg, n),
      orElse: () => false,
    );
    final syncPolicy = evaluateSyncPolicy(syncCfg);
    final syncAllowed = syncPolicy.allowed;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AgentAppBar(
        title: S.home,
        titleTrailing: SyncWindowCountdownStrip(syncConfig: syncCfg, inline: true),
        actions: [
          AgentIconButton(
            icon: Icons.map_outlined,
            onPressed: () => context.go('/map'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          if (!evaluateSyncPolicy(syncCfg).allowed) {
            if (mounted) {
              showAgentToast(
                context,
                syncPolicy.denialMessage ?? syncWindowMessage(syncCfg),
                accentColor: AppColors.warning,
              );
            }
            return;
          }
          final r = await ref.read(authStateProvider.notifier).resync(full: false);
          ref.invalidate(homeStatsProvider);
          ref.invalidate(agentDashboardProvider);
          ref.invalidate(homeVisitMetricsProvider);
          ref.invalidate(syncCountTodayProvider);
          if (mounted && !r.ok && r.error != null) {
            showAgentToast(context, r.error!, accentColor: AppColors.error);
          }
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          // Pastki nav + markaziy tugma ustiga chiqib ketmasin (shablon).
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 140),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
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
              AgentSurfaceCard(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.pie_chart_outline, size: 24, color: AppColors.textPrimary),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            S.dailyReport,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTypography.headlineSmall.copyWith(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceMuted,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Column(
                        children: [
                          AgentProgressGauge(percent: performance),
                          if (showPlan && dash != null) ...[
                            const SizedBox(height: 8),
                            Text(
                              planDashboardLine(dash, session.mobileConfig?.outlet.planVersion),
                              style: AppTypography.caption.copyWith(color: AppColors.textMuted),
                              textAlign: TextAlign.center,
                            ),
                          ],
                          const SizedBox(height: 4),
                          Builder(
                            builder: (context) {
                              final visited = metrics?.visited ?? dash?.visitsToday ?? 0;
                              final total = metrics?.total ?? dash?.clientsCount ?? 0;
                              final left = (total - visited).clamp(0, 999999);
                              final offRoute = metrics?.offRoute ?? 0;
                              final leftOffRoute = metrics?.remainingOffRoute ?? 0;
                              final dormantOnWeekday = metrics?.dormantOnWeekday ?? 0;
                              final todayWd = serverTodayWeekday();
                              return IntrinsicHeight(
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  children: [
                                    Expanded(
                                      child: AgentVisitMetric(
                                        positive: true,
                                        title: S.visited,
                                        main: '$visited / $total',
                                        showOnRouteSubRow: false,
                                        outsideValue: '$offRoute',
                                        extraLabel: S.dormantNotVisitedToday(todayWd),
                                        extraValue: '$dormantOnWeekday',
                                      ),
                                    ),
                                    const SizedBox(width: 4),
                                    Expanded(
                                      child: AgentVisitMetric(
                                        positive: false,
                                        title: S.remaining,
                                        main: '$left / $total',
                                        showOnRouteSubRow: false,
                                        outsideValue: '$leftOffRoute',
                                        outsideLabel: S.remainingOffRoute,
                                        extraLabel: S.dormantNotVisitedMonth,
                                        extraValue: '${metrics?.dormantUnique ?? 0}',
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    statsAsync.when(
                        data: (s) => Column(
                          children: [
                            _infoRow(S.unsyncedPhotos, '0'),
                            _infoRow(S.lastSync, _formatSync(session.lastSyncAt)),
                            _infoRow('Клиенты (лок.)', '${s['clients'] ?? 0}'),
                          ],
                        ),
                        loading: () => const Padding(
                          padding: EdgeInsets.all(8),
                          child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                        ),
                        error: (_, __) => const SizedBox.shrink(),
                      ),
                    const SizedBox(height: 12),
                    AgentPrimaryButton(
                      label: S.sync,
                      onPressed: !syncAllowed ? null : () => SyncBottomSheet.show(context),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              statsAsync.when(
                data: (s) => Row(
                  children: [
                    Expanded(
                      child: AgentMiniSummary(
                        title: S.ordersSumToday,
                        value: _formatSum(dash?.ordersSumToday ?? 0),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: AgentMiniSummary(
                        title: S.productsVolumeToday,
                        value: '${s['products'] ?? 0}',
                      ),
                    ),
                  ],
                ),
                loading: () => const SizedBox(height: 72),
                error: (_, __) => const SizedBox.shrink(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatSum(double v) {
    if (v >= 1e6) return '${(v / 1e6).toStringAsFixed(1)}M';
    if (v >= 1e3) return '${(v / 1e3).toStringAsFixed(0)}K';
    return v.toStringAsFixed(0);
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
            ),
          ),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.end,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
            ),
          ),
        ],
      ),
    );
  }
}

