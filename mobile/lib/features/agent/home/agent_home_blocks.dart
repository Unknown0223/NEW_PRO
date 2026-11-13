import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../design_system/design_system.dart';
import 'agent_home_sections.dart';

const _iris = Color(0xFF5548F0);

/// Savdo dinamikasi — shablon C (hafta/oy ustunlar).
class HomeSalesChart extends StatefulWidget {
  final List<({String d, int v})> week;
  final List<({String d, int v})> month;

  const HomeSalesChart({
    super.key,
    required this.week,
    required this.month,
  });

  @override
  State<HomeSalesChart> createState() => _HomeSalesChartState();
}

class _HomeSalesChartState extends State<HomeSalesChart> {
  int _range = 0;

  @override
  Widget build(BuildContext context) {
    final series = _range == 0 ? widget.week : widget.month;
    final peak = series.isEmpty ? 1 : series.map((s) => s.v).reduce((a, b) => a > b ? a : b);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Row(
            children: [
              const Icon(Icons.trending_up_rounded, size: 14, color: _iris),
              const SizedBox(width: 6),
              const Expanded(
                child: Text(
                  'Savdo dinamikasi',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
                ),
              ),
              Container(
                padding: const EdgeInsets.all(2),
                decoration: BoxDecoration(
                  color: AppColors.surfaceMuted,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    for (final e in [('Hafta', 0), ('Oy', 1)])
                      GestureDetector(
                        onTap: () => setState(() => _range = e.$2),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: _range == e.$2 ? AppColors.surface : Colors.transparent,
                            borderRadius: BorderRadius.circular(6),
                            boxShadow: _range == e.$2
                                ? [
                                    BoxShadow(
                                      color: Colors.black.withValues(alpha: 0.08),
                                      blurRadius: 3,
                                    ),
                                  ]
                                : null,
                          ),
                          child: Text(
                            e.$1,
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: _range == e.$2
                                  ? AppColors.textPrimary
                                  : AppColors.textMuted,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 78,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (var i = 0; i < series.length; i++) ...[
                  if (i > 0) const SizedBox(width: 6),
                  Expanded(
                    child: SaPressable(
                      onTap: () {
                        final est = (series[i].v * 18400).round();
                        showAgentToast(
                          context,
                          '${series[i].d}: ${homeFmtMoney(est.toDouble())} so‘m',
                          accentColor: _iris,
                        );
                      },
                      child: Column(
                        mainAxisSize: MainAxisSize.max,
                        children: [
                          Text(
                            '${series[i].v}',
                            style: TextStyle(
                              fontSize: 8,
                              fontWeight: FontWeight.w800,
                              height: 1,
                              fontFamily: 'monospace',
                              color: series[i].v == peak ? _iris : AppColors.textMuted,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Expanded(
                            child: LayoutBuilder(
                              builder: (context, c) {
                                final h = (c.maxHeight * (series[i].v / peak).clamp(0.12, 1.0))
                                    .clamp(4.0, c.maxHeight);
                                return Align(
                                  alignment: Alignment.bottomCenter,
                                  child: SaBarGrow(
                                    height: h,
                                    width: c.maxWidth,
                                    color: series[i].v == peak
                                        ? _iris
                                        : _iris.withValues(alpha: 0.35),
                                    delay: Duration(milliseconds: 55 * i),
                                  ),
                                );
                              },
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            series[i].d,
                            style: TextStyle(
                              fontSize: 8,
                              fontWeight: FontWeight.w600,
                              height: 1,
                              color: series[i].v == peak ? _iris : AppColors.textMuted,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Buyurtmalar oqimi — shablon D.
class HomePipeline extends StatelessWidget {
  final int draft;
  final int sent;
  final int confirmed;
  final int delivered;

  const HomePipeline({
    super.key,
    required this.draft,
    required this.sent,
    required this.confirmed,
    required this.delivered,
  });

  @override
  Widget build(BuildContext context) {
    final stages = [
      ('Qoralama', Icons.edit_note_outlined, const Color(0xFF8B93A7), '/draft', draft),
      ('Yuborilgan', Icons.send_outlined, const Color(0xFFE0A023), '/orders', sent),
      ('Tasdiq', Icons.check_circle_outline, const Color(0xFF3E9BFF), '/orders', confirmed),
      ('Yetkazildi', Icons.local_shipping_outlined, const Color(0xFF22B573), '/warehouse', delivered),
    ];
    final total = draft + sent + confirmed + delivered;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Buyurtmalar oqimi',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
                ),
              ),
              Text(
                '$total ta · bu hafta',
                style: const TextStyle(
                  fontSize: 10,
                  color: AppColors.textMuted,
                  fontFamily: 'monospace',
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              for (var i = 0; i < stages.length; i++) ...[
                if (i > 0) const SizedBox(width: 4),
                Expanded(
                  child: SaPressable(
                    onTap: () => context.push(stages[i].$4),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceMuted,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Column(
                        children: [
                          Icon(stages[i].$2, size: 14, color: stages[i].$3),
                          const SizedBox(height: 4),
                          Text(
                            '${stages[i].$5}',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          Text(
                            stages[i].$1,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 8,
                              color: AppColors.textMuted,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

/// Qarzdorlik — shablon E.
class HomeDebtCard extends StatelessWidget {
  final double total;
  final int clients;
  final double d0to7;
  final double d8to30;
  final double d30plus;

  const HomeDebtCard({
    super.key,
    required this.total,
    required this.clients,
    required this.d0to7,
    required this.d8to30,
    required this.d30plus,
  });

  @override
  Widget build(BuildContext context) {
    final rawSum = d0to7 + d8to30 + d30plus;
    final empty = rawSum <= 0 && total <= 0;
    final sum = empty ? 3.0 : rawSum.clamp(1.0, double.infinity);
    final f0 = empty ? 1 : ((d0to7 / sum) * 100).round().clamp(1, 100);
    final f1 = empty ? 1 : ((d8to30 / sum) * 100).round().clamp(1, 100);
    final f2 = empty ? 1 : ((d30plus / sum) * 100).round().clamp(1, 100);
    return SaPressable(
      onTap: () => context.push('/debtors'),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Expanded(
                  child: Row(
                    children: [
                      Icon(Icons.account_balance_wallet_outlined, size: 14, color: Color(0xFFE0574B)),
                      SizedBox(width: 6),
                      Text(
                        'Qarzdorlik',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE0574B).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(99),
                  ),
                  child: Text(
                    '$clients mijoz',
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFFE0574B),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: homeFmtMoney(total),
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFFE0574B),
                      letterSpacing: -0.4,
                    ),
                  ),
                  const TextSpan(
                    text: ' so‘m',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textMuted,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(99),
              child: SizedBox(
                height: 6,
                child: Row(
                  children: [
                    Expanded(
                      flex: f0,
                      child: ColoredBox(
                        color: empty ? AppColors.surfaceMuted : const Color(0xFF22B573),
                      ),
                    ),
                    Expanded(
                      flex: f1,
                      child: ColoredBox(
                        color: empty ? AppColors.surfaceMuted : const Color(0xFFE0A023),
                      ),
                    ),
                    Expanded(
                      flex: f2,
                      child: ColoredBox(
                        color: empty ? AppColors.surfaceMuted : const Color(0xFFE0574B),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 6),
            const Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('0–7', style: TextStyle(fontSize: 9, color: AppColors.textMuted, fontFamily: 'monospace')),
                Text('8–30', style: TextStyle(fontSize: 9, color: AppColors.textMuted, fontFamily: 'monospace')),
                Text('30+', style: TextStyle(fontSize: 9, color: Color(0xFFE0574B), fontFamily: 'monospace', fontWeight: FontWeight.w700)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Kompakt sync footer — shablon I.
class HomeSyncFooter extends StatelessWidget {
  final bool syncing;
  final bool syncAllowed;
  final String lastSyncLabel;
  final int pendingPhotos;
  final int syncedPhotos;
  final VoidCallback onSync;

  const HomeSyncFooter({
    super.key,
    required this.syncing,
    required this.syncAllowed,
    required this.lastSyncLabel,
    required this.pendingPhotos,
    required this.syncedPhotos,
    required this.onSync,
  });

  @override
  Widget build(BuildContext context) {
    final ok = !syncing && pendingPhotos == 0;
    return SaPressable(
      onTap: onSync,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(13),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: syncing
                    ? AppColors.primarySoft
                    : const Color(0xFF22B573).withValues(alpha: 0.12),
              ),
              child: Icon(
                syncing ? Icons.sync : Icons.local_shipping_outlined,
                size: 14,
                color: syncing ? _iris : const Color(0xFF22B573),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    syncing
                        ? 'Sinxronlanmoqda…'
                        : (ok
                            ? 'Barcha maʼlumot sinxron'
                            : (syncAllowed ? 'Sinxronlash kerak' : 'Tekshirish')),
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
                  ),
                  Text(
                    'oxirgi: $lastSyncLabel · $syncedPhotos foto · $pendingPhotos kutmoqda',
                    style: const TextStyle(
                      fontSize: 9,
                      color: AppColors.textMuted,
                      fontFamily: 'monospace',
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, size: 18, color: AppColors.textMuted),
          ],
        ),
      ),
    );
  }
}
