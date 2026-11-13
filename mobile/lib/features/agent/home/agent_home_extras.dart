import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/mobile_api.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/time/work_region_time.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../design_system/design_system.dart';

const _iris = Color(0xFF5548F0);
const _weekdaysUz = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
const _monthsUz = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
];

String homeDashboardDateLine() {
  final now = workRegionNow();
  final wd = _weekdaysUz[now.weekday - 1];
  return '$wd, ${now.day}-${_monthsUz[now.month - 1]} · Toshkent';
}

/// Shablon F — bugungi vazifalar (lokal holat, API yo‘q).
class HomeTasksCard extends StatefulWidget {
  const HomeTasksCard({super.key});

  @override
  State<HomeTasksCard> createState() => _HomeTasksCardState();
}

class _HomeTasksCardState extends State<HomeTasksCard> {
  static const _tasks = [
    (id: 1, text: 'Navruz Shop — foto hisobotni qayta yuklash', due: 'Bugun 16:00', urgent: true),
    (id: 2, text: 'Lalaku Savdo qarzi bo‘yicha qo‘ng‘iroq', due: 'Bugun 18:00', urgent: false),
    (id: 3, text: 'Oylik KPI o‘zini baholash', due: 'Keyingi hafta', urgent: false),
  ];

  final _done = <int>{};

  void _toggle(int id) {
    setState(() {
      final was = _done.remove(id);
      if (!was) _done.add(id);
      if (!context.mounted) return;
      showAgentToast(
        context,
        was ? 'Vazifa qayta ochildi' : 'Vazifa bajarildi',
        accentColor: was ? AppColors.warning : AppColors.success,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final open = _tasks.length - _done.length;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Bugungi vazifalar',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
                ),
              ),
              SaPressable(
                onTap: () => context.push('/tasks'),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '$open ochiq',
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: _iris,
                      ),
                    ),
                    const Icon(Icons.chevron_right, size: 14, color: _iris),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          for (final t in _tasks) ...[
            SaPressable(
              onTap: () => _toggle(t.id),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 18,
                      height: 18,
                      margin: const EdgeInsets.only(top: 1),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: _done.contains(t.id) ? _iris : AppColors.border,
                          width: 2,
                        ),
                        color: _done.contains(t.id) ? _iris : Colors.transparent,
                      ),
                      child: _done.contains(t.id)
                          ? const Icon(Icons.check, size: 11, color: Colors.white)
                          : null,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            t.text,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              decoration:
                                  _done.contains(t.id) ? TextDecoration.lineThrough : null,
                              color: _done.contains(t.id)
                                  ? AppColors.textMuted
                                  : AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Row(
                            children: [
                              Icon(
                                Icons.schedule_rounded,
                                size: 10,
                                color: t.urgent && !_done.contains(t.id)
                                    ? const Color(0xFFE0574B)
                                    : AppColors.textMuted,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                t.due,
                                style: TextStyle(
                                  fontSize: 9,
                                  color: t.urgent && !_done.contains(t.id)
                                      ? const Color(0xFFE0574B)
                                      : AppColors.textMuted,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Shablon G — top mahsulotlar (vizual; API keyingi bosqichda).
class HomeTopProductsCard extends StatelessWidget {
  const HomeTopProductsCard({super.key});

  static const _demo = [
    (name: 'Coca-Cola 1.5L', pct: 1.0, sumM: '1.78', up: true),
    (name: 'Lay\'s Classic 80g', pct: 0.52, sumM: '0.91', up: true),
    (name: 'Nescafé Gold 100g', pct: 0.57, sumM: '1.01', up: false),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Row(
            children: [
              Icon(Icons.emoji_events_outlined, size: 14, color: Color(0xFFE0A023)),
              SizedBox(width: 6),
              Expanded(
                child: Text(
                  'Top mahsulotlar',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
                ),
              ),
              Text(
                'demo',
                style: TextStyle(
                  fontSize: 9,
                  color: AppColors.textMuted,
                  fontFamily: 'monospace',
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          for (var i = 0; i < _demo.length; i++) ...[
            Row(
              children: [
                Container(
                  width: 22,
                  height: 22,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: i == 0 ? _iris.withValues(alpha: 0.14) : AppColors.surfaceMuted,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    '${i + 1}',
                    style: TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w800,
                      color: i == 0 ? _iris : AppColors.textMuted,
                      fontFamily: 'monospace',
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _demo[i].name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 3),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(99),
                        child: LinearProgressIndicator(
                          value: _demo[i].pct,
                          minHeight: 3,
                          backgroundColor: AppColors.surfaceMuted,
                          color: _iris,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '${_demo[i].sumM}m',
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        fontFamily: 'monospace',
                      ),
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          _demo[i].up ? Icons.north_east : Icons.south_east,
                          size: 9,
                          color: _demo[i].up ? const Color(0xFF22B573) : const Color(0xFFE0574B),
                        ),
                        Text(
                          _demo[i].up ? '12%' : '4%',
                          style: TextStyle(
                            fontSize: 8,
                            fontWeight: FontWeight.w700,
                            fontFamily: 'monospace',
                            color: _demo[i].up ? const Color(0xFF22B573) : const Color(0xFFE0574B),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
            if (i < _demo.length - 1) const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

/// Shablon H — davomat + ombor ogohlantirishi.
class HomeAttendanceStockRow extends StatelessWidget {
  final int lowSkuCount;

  const HomeAttendanceStockRow({super.key, this.lowSkuCount = 0});

  @override
  Widget build(BuildContext context) {
    final now = TimeOfDay.now();
  final clock =
      '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
    final skuLabel = lowSkuCount > 0 ? '$lowSkuCount SKU' : '—';
    return Row(
      children: [
        Expanded(
          child: SaPressable(
            onTap: () => context.push('/tabel'),
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.calendar_month_outlined, size: 14, color: Color(0xFF22B573)),
                  const SizedBox(height: 6),
                  const Text(
                    'Davomat · bugun',
                    style: TextStyle(fontSize: 9, color: AppColors.textMuted),
                  ),
                  Text(
                    clock,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, fontFamily: 'monospace'),
                  ),
                  const Text(
                    'tabel',
                    style: TextStyle(fontSize: 9, color: AppColors.textMuted),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: SaPressable(
            onTap: () => context.push('/warehouse-stock'),
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF8E8),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFEFD9A4)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.warning_amber_rounded, size: 14, color: Color(0xFFC98A0B)),
                  const SizedBox(height: 6),
                  const Text(
                    'Ombor ogohlantirishi',
                    style: TextStyle(fontSize: 9, color: Color(0xFF8A6300)),
                  ),
                  Text(
                    skuLabel,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      fontFamily: 'monospace',
                      color: Color(0xFF7A5600),
                    ),
                  ),
                  const Text(
                    'kam qoldi',
                    style: TextStyle(fontSize: 9, color: Color(0xFFA6822A)),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Qarzdorlar xulosasi — `debtorsProvider` dan.
({double total, int clients, double d0, double d8, double d30}) summarizeDebts(
  List<DebtorClient> debtors,
  double Function(DebtorClient) balanceOf,
) {
  var total = 0.0;
  var n = 0;
  for (final c in debtors) {
    final b = balanceOf(c);
    if (b > 0) {
      total += b;
      n++;
    }
  }
  return (total: total, clients: n, d0: 0.0, d8: total, d30: 0.0);
}
