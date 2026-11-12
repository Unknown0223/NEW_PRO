import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/mobile_api.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../design_system/design_system.dart';
import '../shell/agent_scaffold_key.dart';
import 'agent_home_blocks.dart';
import 'agent_home_sections.dart';
import 'home_visit_metrics_provider.dart';

/// Shablon `HomeDashboard.tsx` — 100% tuzilma + SaEnter stagger.
class AgentHomeDashboard extends StatelessWidget {
  final String userName;
  final String dateLine;
  final AgentDashboardResult? dash;
  final HomeVisitMetrics? metrics;
  final int localClients;
  final int pendingPhotos;
  final int syncedPhotos;
  final String lastSyncLabel;
  final bool syncAllowed;
  final VoidCallback onSync;
  final VoidCallback? onOpenNotifications;

  const AgentHomeDashboard({
    super.key,
    required this.userName,
    required this.dateLine,
    required this.dash,
    required this.metrics,
    required this.localClients,
    required this.pendingPhotos,
    required this.syncedPhotos,
    required this.lastSyncLabel,
    required this.syncAllowed,
    required this.onSync,
    this.onOpenNotifications,
  });

  static const _irisEnd = Color(0xFF3B2BD9);
  static const _months = [
    'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
    'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
  ];

  String get _initials {
    final parts = userName.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return 'A';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts[0].substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final plan = dash?.planSum ?? 0;
    final fact = dash?.ordersSumToday ?? 0;
    final pct = plan > 0
        ? ((fact / plan) * 100).clamp(0, 999).round()
        : (dash?.performancePct ?? 0).round();
    final visited = metrics?.onRoute ?? metrics?.visited ?? dash?.visitsToday ?? 0;
    final total = metrics?.total ?? dash?.clientsCount ?? localClients;
    final left = metrics?.remainingOnRoute ?? (total - visited).clamp(0, 999999);
    final ordersToday = dash?.ordersToday ?? 0;
    final daysLeft = DateTime(now.year, now.month + 1, 0).day - now.day + 1;
    final remain = (plan - fact).clamp(0.0, double.infinity).toDouble();
    final perDay = daysLeft > 0 ? remain / daysLeft : remain;
    final routePct = total > 0 ? ((visited / total) * 100).round() : 0;
    final monthLabel = '${_months[now.month - 1]} rejasi';

    // Demo ustunlar — API bo‘lmasa ham shablon ko‘rinishi.
    final week = <({String d, int v})>[
      (d: 'Du', v: 62),
      (d: 'Se', v: 48),
      (d: 'Ch', v: 78),
      (d: 'Pa', v: 55),
      (d: 'Ju', v: pct.clamp(20, 99)),
      (d: 'Sh', v: 71),
      (d: 'Ya', v: 34),
    ];
    final month = <({String d, int v})>[
      (d: '1-h', v: 54),
      (d: '2-h', v: 68),
      (d: '3-h', v: 47),
      (d: '4-h', v: 86),
      (d: '5-h', v: 72),
      (d: '6-h', v: pct.clamp(20, 99)),
      (d: '7-h', v: 41),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SaEnter(preset: SaMotionPreset.rise, child: _header(context)),
        const SizedBox(height: 12),
        SaEnter(
          delay: SaStaggerDelay.of(0),
          preset: SaMotionPreset.rise,
          child: HomePlanHero(
            pct: pct,
            fact: fact,
            plan: plan,
            daysLeft: daysLeft,
            perDay: perDay,
            monthLabel: monthLabel,
          ),
        ),
        const SizedBox(height: 10),
        SaEnter(
          delay: SaStaggerDelay.of(1),
          preset: SaMotionPreset.rise,
          child: HomeQuickGrid(
            ordersCount: ordersToday,
            routeLeft: left,
            routePct: routePct,
            bonusLabel: '—',
          ),
        ),
        const SizedBox(height: 10),
        SaEnter(
          delay: SaStaggerDelay.of(2),
          preset: SaMotionPreset.rise,
          child: HomeTodayTiles(
            sales: fact,
            orders: ordersToday,
            bonusValue: '0',
            salesDelta: fact > 0 ? '+18%' : '+0%',
            ordersHint: '${dash?.pendingOffline ?? 0} draft',
            bonusHint: '0%',
          ),
        ),
        const SizedBox(height: 10),
        SaEnter(
          delay: SaStaggerDelay.of(3),
          preset: SaMotionPreset.rise,
          child: HomeSalesChart(week: week, month: month),
        ),
        const SizedBox(height: 10),
        SaEnter(
          delay: SaStaggerDelay.of(4),
          preset: SaMotionPreset.rise,
          child: HomePipeline(
            draft: dash?.pendingOffline ?? 0,
            sent: ordersToday,
            confirmed: 0,
            delivered: 0,
          ),
        ),
        const SizedBox(height: 10),
        SaEnter(
          delay: SaStaggerDelay.of(5),
          preset: SaMotionPreset.rise,
          child: const HomeDebtCard(
            total: 0,
            clients: 0,
            d0to7: 0,
            d8to30: 0,
            d30plus: 0,
          ),
        ),
        const SizedBox(height: 10),
        SaEnter(
          delay: SaStaggerDelay.of(6),
          preset: SaMotionPreset.rise,
          child: _routeRow(context, visited: visited, left: left, total: total),
        ),
        const SizedBox(height: 10),
        SaEnter(
          delay: SaStaggerDelay.of(7),
          preset: SaMotionPreset.rise,
          child: HomeSyncFooter(
            syncing: false,
            syncAllowed: syncAllowed,
            lastSyncLabel: lastSyncLabel,
            pendingPhotos: pendingPhotos,
            syncedPhotos: syncedPhotos,
            onSync: onSync,
          ),
        ),
      ],
    );
  }

  Widget _header(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 36,
          height: 36,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF6A5BFF), _irisEnd],
            ),
          ),
          child: Text(
            _initials,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w800,
              fontSize: 12,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                dateLine,
                style: AppTypography.caption.copyWith(
                  color: AppColors.textMuted,
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Text(
                userName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.titleMedium.copyWith(
                  fontWeight: FontWeight.w800,
                  fontSize: 14,
                  letterSpacing: -0.3,
                ),
              ),
            ],
          ),
        ),
        _roundIcon(Icons.menu_rounded, () => openAgentMenu(context)),
        const SizedBox(width: 6),
        _roundIcon(Icons.notifications_none_rounded, onOpenNotifications),
        const SizedBox(width: 6),
        _roundIcon(Icons.sync_rounded, syncAllowed ? onSync : null),
      ],
    );
  }

  Widget _roundIcon(IconData icon, VoidCallback? onTap) {
    return SaPressable(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        width: 34,
        height: 34,
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.border),
        ),
        child: Icon(icon, size: 16, color: AppColors.textPrimary),
      ),
    );
  }

  Widget _routeRow(
    BuildContext context, {
    required int visited,
    required int left,
    required int total,
  }) {
    return SaPressable(
      onTap: () => context.push('/visits'),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.primarySoft,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.route_outlined, color: Color(0xFF5548F0), size: 20),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Bugungi marshrut',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Tashrif: $visited · Qoldi: $left · Jami: $total',
                    style: const TextStyle(
                      fontSize: 10,
                      color: AppColors.textMuted,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: AppColors.textMuted),
          ],
        ),
      ),
    );
  }
}
