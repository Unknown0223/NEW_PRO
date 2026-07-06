import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/session.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../auth/auth_provider.dart';
import '../shared/supervisor_api_parse.dart';
import '../supervisor_providers.dart';

class SupervisorHomePage extends ConsumerWidget {
  const SupervisorHomePage({super.key});
  @override Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final kpi = ref.watch(supervisorSummaryProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Bosh'), actions: [
        IconButton(
          icon: const Icon(Icons.sync),
          onPressed: () async {
            final ok = (await ref.read(authStateProvider.notifier).resync()).ok;
            ref.invalidate(supervisorSummaryProvider);
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text(ok ? 'Sinxronlandi' : 'Xato')),
              );
            }
          },
        ),
        IconButton(
          icon: const Icon(Icons.logout),
          onPressed: () async => ref.read(authStateProvider.notifier).logout(),
        ),
      ],),
      body: SingleChildScrollView(padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Card(child: Padding(padding: const EdgeInsets.all(16),
            child: Row(children: [
              CircleAvatar(backgroundColor: AppColors.supervisorAccent.withValues(alpha: 0.1),
                child: Text(session.user?.name.isNotEmpty == true ? session.user!.name[0].toUpperCase() : 'S',
                  style: const TextStyle(color: AppColors.supervisorAccent, fontWeight: FontWeight.w700),),),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(session.user?.name ?? 'Supervayzer', style: AppTypography.headlineSmall),
              ],),),
            ],),),),
          const SizedBox(height: 16),
          kpi.when(data: (raw) {
            final k = parseSupervisorKpi(raw);
            final visitPct = (k['visit_pct'] as num?)?.toDouble() ?? 0;
            final planned = k['planned_visits'] ?? 0;
            final visited = k['visited_total'] ?? 0;
            final orders = k['visits_with_orders'] ?? k['successful_visits'] ?? 0;
            final salesSum = k['total_sales_sum']?.toString() ?? '0';
            return Column(children: [
              Row(children: [
                Expanded(child: _KpiCard('Vizitlar', '${visitPct.round()}%', AppColors.supervisorAccent, visitPct / 100)),
                const SizedBox(width: 10),
                Expanded(child: _KpiCard('Bajarilgan', '$visited/$planned', AppColors.success, planned > 0 ? visited / planned : 0)),
              ],),
              const SizedBox(height: 10),
              Row(children: [
                Expanded(child: _StatMini('Buyurtmali vizit', '$orders', AppColors.primary)),
                const SizedBox(width: 10),
                Expanded(child: _StatMini('Savdo', salesSum, AppColors.info)),
              ],),
            ],);
          }, loading: () => const Center(child: CircularProgressIndicator()), error: (_, __) => const SizedBox.shrink(),),
          const SizedBox(height: 20),
          const Text('Tezkor amallar', style: AppTypography.titleMedium),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: Card(child: InkWell(borderRadius: BorderRadius.circular(12),
              onTap: () => context.go('/sv-visits'),
              child: const Padding(padding: EdgeInsets.all(12),
                child: Column(children: [Icon(Icons.visibility, color: AppColors.supervisorAccent), SizedBox(height: 4), Text('Vizitlar', style: AppTypography.caption)]),),),),),
            Expanded(child: Card(child: InkWell(borderRadius: BorderRadius.circular(12),
              onTap: () => context.go('/agents'),
              child: const Padding(padding: EdgeInsets.all(12),
                child: Column(children: [Icon(Icons.people, color: AppColors.supervisorAccent), SizedBox(height: 4), Text('Agentlar', style: AppTypography.caption)]),),),),),
            Expanded(child: Card(child: InkWell(borderRadius: BorderRadius.circular(12),
              onTap: () => context.go('/dashboard'),
              child: const Padding(padding: EdgeInsets.all(12),
                child: Column(children: [Icon(Icons.dashboard, color: AppColors.supervisorAccent), SizedBox(height: 4), Text('Dashboard', style: AppTypography.caption)]),),),),),
          ],),
        ],),),
    );
  }
}

class _KpiCard extends StatelessWidget {
  final String title, value; final Color color; final double progress;
  const _KpiCard(this.title, this.value, this.color, this.progress);
  @override Widget build(BuildContext context) => Expanded(child: Card(child: Padding(padding: const EdgeInsets.all(14),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [const Spacer(), Text(value, style: AppTypography.headlineMedium.copyWith(color: color))]),
      const SizedBox(height: 6), Text(title, style: AppTypography.caption),
      const SizedBox(height: 6), ClipRRect(borderRadius: BorderRadius.circular(3),
        child: LinearProgressIndicator(value: progress.clamp(0.0, 1.0), backgroundColor: AppColors.border,
          valueColor: AlwaysStoppedAnimation(color), minHeight: 4,),),
    ],),),),);
}

class _StatMini extends StatelessWidget {
  final String title, value; final Color color;
  const _StatMini(this.title, this.value, this.color);
  @override Widget build(BuildContext context) => Expanded(child: Card(child: Padding(padding: const EdgeInsets.all(10),
    child: Column(children: [
      Text(value, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
      Text(title, style: const TextStyle(fontSize: 10, color: AppColors.textMuted)),
    ],),),),);
}
