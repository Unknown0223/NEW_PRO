import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/format/money_display.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../auth/auth_provider.dart';
import '../shared/supervisor_api_parse.dart';
import '../shared/supervisor_ui.dart';
import '../supervisor_providers.dart';

/// CACTUS «Главная» — KPI + kategoriyalar (mavjud API).
class SupervisorHomePage extends ConsumerStatefulWidget {
  const SupervisorHomePage({super.key});

  @override
  ConsumerState<SupervisorHomePage> createState() => _SupervisorHomePageState();
}

class _SupervisorHomePageState extends ConsumerState<SupervisorHomePage> with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  String _fmtMoney(dynamic v) {
    final s = v?.toString().replaceAll(' ', '').replaceAll(',', '.') ?? '0';
    final n = double.tryParse(s) ?? 0;
    final f = NumberFormat('#,###');
    return f.format(n.round()).replaceAll(',', ' ');
  }

  String _fmtPct(num? v) {
    final n = (v ?? 0).toDouble();
    if (n == n.roundToDouble()) return '${n.round()} %';
    return '${n.toStringAsFixed(1)} %';
  }

  @override
  Widget build(BuildContext context) {
    final accent = AppColors.supervisorAccent;
    final kpiAsync = ref.watch(supervisorSummaryProvider);
    final productsAsync = ref.watch(supervisorProductsProvider);
    final teamKpiAsync = ref.watch(supervisorTeamKpiProvider);
    final dateLabel = DateFormat('dd.MM.yyyy').format(DateTime.now());

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: supervisorAppBar(
        context,
        title: 'Главная',
        actions: [
          IconButton(
            icon: const Icon(Icons.insights_outlined),
            tooltip: 'KPI',
            onPressed: () => context.push('/sv-kpi'),
          ),
          IconButton(
            icon: const Icon(Icons.filter_list_rounded),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Период: сегодня (${DateFormat('dd.MM.yyyy').format(DateTime.now())})')),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.sync),
            onPressed: () async {
              final ok = (await ref.read(authStateProvider.notifier).resync()).ok;
              ref.invalidate(supervisorSummaryProvider);
              ref.invalidate(supervisorProductsProvider);
              ref.invalidate(supervisorTeamKpiProvider);
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(ok ? 'Синхронизировано' : 'Ошибка синхронизации')),
                );
              }
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        color: accent,
        onRefresh: () async {
          ref.invalidate(supervisorSummaryProvider);
          ref.invalidate(supervisorProductsProvider);
          ref.invalidate(supervisorTeamKpiProvider);
          await ref.read(supervisorSummaryProvider.future);
        },
        child: kpiAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(
            padding: const EdgeInsets.all(24),
            children: [
              Text('Не удалось загрузить сводку', style: AppTypography.titleMedium),
              const SizedBox(height: 8),
              Text('$e', style: AppTypography.caption),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => ref.invalidate(supervisorSummaryProvider),
                child: const Text('Повторить'),
              ),
            ],
          ),
          data: (raw) {
            final k = parseSupervisorKpi(raw);
            final visitPct = (k['visit_pct'] as num?)?.toDouble() ?? 0;
            final planned = (k['planned_visits'] as num?)?.toInt() ?? 0;
            final visited = (k['visited_total'] as num?)?.toInt() ?? 0;
            final success = (k['visits_with_orders'] as num?)?.toInt() ??
                (k['successful_visits'] as num?)?.toInt() ??
                0;
            final photoPct = planned > 0
                ? (((k['photo_reports'] as num?)?.toInt() ?? 0) / planned * 100)
                : ((k['photo_report_pct'] as num?)?.toDouble() ?? 0);
            final gpsPct = planned > 0
                ? (((k['gps_visits'] as num?)?.toInt() ?? 0) / planned * 100)
                : ((k['gps_visit_pct'] as num?)?.toDouble() ?? 0);
            final successPct = visited > 0 ? (success / visited * 100) : 0.0;
            final salesSum = k['total_sales_sum'] ?? k['sales_sum'] ?? 0;
            final categories = _extractCategories(k, productsAsync);
            final visitPctSafe = visitPct.isFinite ? visitPct : 0.0;
            final successPctSafe = successPct.isFinite ? successPct : 0.0;
            final photoPctSafe = photoPct.isFinite ? photoPct : 0.0;
            final gpsPctSafe = gpsPct.isFinite ? gpsPct : 0.0;

            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
              children: [
                SvCard(
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: accent.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(Icons.payments_outlined, color: accent),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Expanded(
                                  child: Text('Сумма заявок', style: AppTypography.caption),
                                ),
                                Text(dateLabel, style: AppTypography.caption.copyWith(color: AppColors.textMuted)),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${_fmtMoney(salesSum)} сум',
                              style: AppTypography.headlineSmall.copyWith(
                                color: accent,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                teamKpiAsync.when(
                  loading: () => const SizedBox.shrink(),
                  error: (_, __) => const SizedBox.shrink(),
                  data: (team) {
                    final tPct = team.todayPct?.round() ??
                        (team.todayPlan > 0 ? ((team.todaySales / team.todayPlan) * 100).round() : 0);
                    final mPct = team.monthPct?.round() ??
                        (team.monthPlan > 0 ? ((team.monthFact / team.monthPlan) * 100).round() : 0);
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: SvCard(
                        onTap: () => context.push('/sv-kpi'),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    'KPI план · ${team.agentCount} агент(ов)',
                                    style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w700),
                                  ),
                                ),
                                Text('$tPct%', style: TextStyle(fontWeight: FontWeight.w900, color: accent)),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Сегодня: ${formatMoneySpaced(team.todaySales)} / ${formatMoneySpaced(team.todayPlan)}',
                              style: AppTypography.caption,
                            ),
                            Text(
                              'Месяц: ${formatMoneySpaced(team.monthFact)} / ${formatMoneySpaced(team.monthPlan)} · $mPct%',
                              style: AppTypography.caption,
                            ),
                            const SizedBox(height: 8),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(6),
                              child: LinearProgressIndicator(
                                value: (tPct / 100).clamp(0.0, 1.0),
                                minHeight: 7,
                                backgroundColor: accent.withValues(alpha: 0.12),
                                valueColor: AlwaysStoppedAnimation(accent),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
                SvCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Категории по заявкам', style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 10),
                      if (categories.isEmpty)
                        Text(
                          'За выбранный день продаж по категориям нет',
                          style: AppTypography.caption.copyWith(color: AppColors.textMuted),
                        )
                      else
                        ...categories.take(6).map((c) => _CategoryBar(name: c.$1, pct: c.$2, accent: accent)),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(child: _KpiCircle(value: _fmtPct(visitPctSafe), label: 'Посещения (по визитам)', color: AppColors.warning)),
                    const SizedBox(width: 8),
                    Expanded(child: _KpiCircle(value: _fmtPct(successPctSafe), label: 'Успешные визиты', color: accent)),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(child: _KpiCircle(value: _fmtPct(photoPctSafe), label: 'Фото отчеты', color: const Color(0xFFF97316))),
                    const SizedBox(width: 8),
                    Expanded(child: _KpiCircle(value: _fmtPct(gpsPctSafe), label: 'Посещения (по GPS)', color: AppColors.info)),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  'План: $visited / $planned · с заказами: $success',
                  style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                ),
                const SizedBox(height: 12),
                TabBar(
                  controller: _tabs,
                  labelColor: accent,
                  unselectedLabelColor: AppColors.textSecondary,
                  indicatorColor: accent,
                  labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                  tabs: const [
                    Tab(text: 'По категориям'),
                    Tab(text: 'Продажа ТП'),
                    Tab(text: 'Визиты'),
                  ],
                ),
                SizedBox(
                  height: 260,
                  child: TabBarView(
                    controller: _tabs,
                    children: [
                      _CategoryTable(categories: categories, money: _fmtMoney),
                      _SalesSoonOrData(raw: k, fmt: _fmtMoney),
                      _VisitsMiniStats(planned: planned, visited: visited, success: success),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  List<(String, double, String)> _extractCategories(
    Map<String, dynamic> k,
    AsyncValue<Map<String, dynamic>> products,
  ) {
    final fromKpi = k['categories'] ?? k['sales_by_category'] ?? k['category_breakdown'];
    if (fromKpi is List && fromKpi.isNotEmpty) {
      final out = <(String, double, String)>[];
      for (final e in fromKpi) {
        if (e is! Map) continue;
        final name = e['name']?.toString() ?? e['category']?.toString() ?? e['dimension']?.toString() ?? '—';
        final pct = (e['share_pct'] as num?)?.toDouble() ??
            (e['pct'] as num?)?.toDouble() ??
            (e['percent'] as num?)?.toDouble() ??
            (e['share'] as num?)?.toDouble() ??
            0;
        final revenue = e['revenue']?.toString() ?? e['sum']?.toString() ?? '0';
        out.add((name, pct, revenue));
      }
      return out;
    }
    return products.maybeWhen(
      data: (raw) => parseSupervisorCategoryShares(raw),
      orElse: () => <(String, double, String)>[],
    );
  }
}

class _CategoryBar extends StatelessWidget {
  final String name;
  final double pct;
  final Color accent;
  const _CategoryBar({required this.name, required this.pct, required this.accent});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(child: Text(name, style: AppTypography.caption.copyWith(fontWeight: FontWeight.w600))),
              Text('${pct.toStringAsFixed(1)} %', style: AppTypography.caption),
            ],
          ),
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: (pct / 100).clamp(0.0, 1.0),
              minHeight: 6,
              backgroundColor: AppColors.border,
              valueColor: AlwaysStoppedAnimation(accent),
            ),
          ),
        ],
      ),
    );
  }
}

class _KpiCircle extends StatelessWidget {
  final String value;
  final String label;
  final Color color;
  const _KpiCircle({required this.value, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return SvCard(
      child: Column(
        children: [
          Container(
            width: 56,
            height: 56,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: color, width: 3),
            ),
            child: Text(value, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: color)),
          ),
          const SizedBox(height: 8),
          Text(label, textAlign: TextAlign.center, style: AppTypography.caption.copyWith(fontSize: 11)),
        ],
      ),
    );
  }
}

class _CategoryTable extends StatelessWidget {
  final List<(String, double, String)> categories;
  final String Function(dynamic) money;
  const _CategoryTable({required this.categories, required this.money});

  @override
  Widget build(BuildContext context) {
    if (categories.isEmpty) {
      return Center(
        child: Text(
          'Нет данных по категориям за период',
          textAlign: TextAlign.center,
          style: AppTypography.caption.copyWith(color: AppColors.textMuted),
        ),
      );
    }
    return ListView(
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 8),
          child: Row(
            children: [
              Expanded(flex: 3, child: Text('Категория', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12))),
              Expanded(child: Text('Сумма', textAlign: TextAlign.end, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12))),
              Expanded(child: Text('Доля', textAlign: TextAlign.end, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12))),
            ],
          ),
        ),
        ...categories.map(
          (c) => Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(
              children: [
                Expanded(flex: 3, child: Text(c.$1, style: const TextStyle(fontSize: 13))),
                Expanded(
                  child: Text(
                    money(c.$3),
                    textAlign: TextAlign.end,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                ),
                Expanded(
                  child: Text(
                    '${c.$2.toStringAsFixed(1)} %',
                    textAlign: TextAlign.end,
                    style: const TextStyle(fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _SalesSoonOrData extends StatelessWidget {
  final Map<String, dynamic> raw;
  final String Function(dynamic) fmt;
  const _SalesSoonOrData({required this.raw, required this.fmt});

  @override
  Widget build(BuildContext context) {
    final byPay = raw['sales_by_payment_method'];
    final total = raw['total_sales_sum'] ?? raw['sales_sum'] ?? 0;
    if (byPay is! List || byPay.isEmpty) {
      return ListView(
        padding: const EdgeInsets.only(top: 12),
        children: [
          ListTile(
            dense: true,
            title: const Text('Сумма заявок (день)'),
            trailing: Text(fmt(total), style: const TextStyle(fontWeight: FontWeight.w700)),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Text(
              'Разбивка по способам оплаты появится при наличии оплат за день',
              style: AppTypography.caption.copyWith(color: AppColors.textMuted),
            ),
          ),
        ],
      );
    }
    return ListView(
      children: [
        for (final e in byPay)
          if (e is Map)
            ListTile(
              dense: true,
              title: Text(
                (e['method']?.toString().isNotEmpty == true)
                    ? e['method'].toString()
                    : (e['name']?.toString() ?? '—'),
              ),
              trailing: Text(fmt(e['sum'] ?? e['amount'] ?? 0), style: const TextStyle(fontWeight: FontWeight.w700)),
            ),
      ],
    );
  }
}

class _VisitsMiniStats extends StatelessWidget {
  final int planned, visited, success;
  const _VisitsMiniStats({required this.planned, required this.visited, required this.success});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.only(top: 12),
      children: [
        _row('Запланировано', '$planned'),
        _row('Посещено', '$visited'),
        _row('С заказами', '$success'),
        _row('Не посещал', '${(planned - visited).clamp(0, planned)}'),
      ],
    );
  }

  Widget _row(String a, String b) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          children: [
            Expanded(child: Text(a)),
            Text(b, style: const TextStyle(fontWeight: FontWeight.w700)),
          ],
        ),
      );
}
