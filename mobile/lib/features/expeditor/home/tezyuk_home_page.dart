import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/auth/session.dart';
import '../../../core/theme/tezyuk_colors.dart';
import '../config/expeditor_config_enforcement.dart';
import '../expeditor_providers.dart';
import '../payments/expeditor_notifications.dart';
import '../shell/expeditor_drawer.dart';
import '../sync/expeditor_sync_provider.dart';
import 'expeditor_home_model.dart';
import 'expeditor_home_sheets.dart';
import 'expeditor_sync_sheet.dart';
import 'tezyuk_home_report.dart';
import 'tezyuk_home_route_cards.dart';
import 'tezyuk_home_sections.dart';

Future<void> _openSync(BuildContext context, WidgetRef ref) async {
  final full = await ExpeditorSyncSheet.show(context);
  if (full == null || !context.mounted) return;
  final notifier = ref.read(expeditorSyncProvider.notifier);
  if (notifier.isRunning) return;
  unawaited(notifier.run(full: full));
}

/// Stitch `kuryer_bosh_ekrani` — TezYuk only.
class TezyukHomePage extends ConsumerWidget {
  const TezyukHomePage({super.key});

  String _clock(String? iso) {
    final dt = iso == null || iso.isEmpty
        ? DateTime.now()
        : (DateTime.tryParse(iso)?.toLocal() ?? DateTime.now());
    return DateFormat('HH:mm:ss').format(dt);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mobileConfig =
        ref.watch(sessionProvider.select((s) => s.mobileConfig));
    final policy = ExpeditorConfigPolicy.fromMobileConfig(mobileConfig);
    final dash = ref.watch(expeditorDashboardProvider);

    return Scaffold(
      backgroundColor: TezyukColors.background,
      drawer: const ExpeditorDrawer(),
      body: RefreshIndicator(
        color: TezyukColors.primary,
        onRefresh: () async {
          ref.invalidate(expeditorDashboardProvider);
          await ref.read(expeditorDashboardProvider.future);
        },
        child: dash.when(
          skipLoadingOnReload: true,
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              const SizedBox(height: 120),
              Center(child: Text('Xato: $e')),
            ],
          ),
          data: (d) {
            final daily =
                Map<String, dynamic>.from(d['daily_report'] as Map? ?? {});
            final plan = mapDailyPlan(daily);
            final payments =
                Map<String, dynamic>.from(d['payments'] as Map? ?? {});
            final pending = mapPaymentsPending(payments);
            final rows = (d['shipment_report'] as List?)?.cast<Map>() ?? [];
            final lines = mapShipmentLines(rows);
            final otmetka = mapHomeOtmetkaChip(
              d['attendance'] is Map
                  ? Map<String, dynamic>.from(d['attendance'] as Map)
                  : d['otmetka'] is Map
                      ? Map<String, dynamic>.from(d['otmetka'] as Map)
                      : null,
            );
            final nextStop = mapNextStop(
              d['next_stop'] is Map
                  ? Map<String, dynamic>.from(d['next_stop'] as Map)
                  : null,
            );
            final collected = mapCollectedMoney(d);
            final syncLabel = _clock(d['last_sync_at']?.toString());

            return CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverAppBar(
                  pinned: true,
                  backgroundColor: TezyukColors.background,
                  surfaceTintColor: Colors.transparent,
                  leading: Builder(
                    builder: (ctx) => IconButton(
                      onPressed: () => Scaffold.of(ctx).openDrawer(),
                      style: IconButton.styleFrom(
                        backgroundColor: TezyukColors.surfaceBright,
                        side: const BorderSide(
                          color: TezyukColors.outlineVariant,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      icon: const Icon(Icons.menu),
                    ),
                  ),
                  title: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Bosh sahifa'),
                      Row(
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              color: TezyukColors.success,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            syncLabel,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              fontFamily: 'monospace',
                              color: TezyukColors.primary,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  actions: [
                    IconButton(
                      tooltip: 'Sinxronlash',
                      onPressed: () => _openSync(context, ref),
                      style: IconButton.styleFrom(
                        backgroundColor: TezyukColors.primary,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      icon: const Icon(Icons.sync),
                    ),
                    const SizedBox(width: 4),
                    const ExpeditorNotificationsBell(),
                    const SizedBox(width: 8),
                  ],
                ),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 130),
                  sliver: SliverList(
                    delegate: SliverChildListDelegate([
                      if (otmetka != null) ...[
                        TezyukOtmetkaStrip(
                          chip: otmetka,
                          onTap: () => context.push('/tabel'),
                        ),
                        const SizedBox(height: 12),
                      ],
                      TezyukDailyPlanHero(plan: plan),
                      const SizedBox(height: 12),
                      TezyukMetricTiles(
                        collected: collected,
                        delivered: plan.visited,
                        remaining: plan.remaining,
                      ),
                      if (nextStop != null) ...[
                        const SizedBox(height: 12),
                        TezyukNextStopCard(stop: nextStop),
                      ],
                      if (policy.paymentsEnabled) ...[
                        const SizedBox(height: 12),
                        TezyukPaymentsCard(
                          pending: pending,
                          onOpen: () => showExpeditorPaymentsSheet(context),
                        ),
                      ],
                      const SizedBox(height: 12),
                      TezyukYuklarHisoboti(lines: lines),
                    ]),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
