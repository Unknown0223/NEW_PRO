import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/dio_client.dart';
import '../../../core/auth/session.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../shell/agent_app_bar.dart';

/// Shablon `bonuses` — Mening bonuslarim / zinapoya.
class AgentBonusesPage extends ConsumerStatefulWidget {
  const AgentBonusesPage({super.key});

  @override
  ConsumerState<AgentBonusesPage> createState() => _AgentBonusesPageState();
}

class _AgentBonusesPageState extends ConsumerState<AgentBonusesPage> {
  bool _loading = true;
  String? _error;
  List<_BonusRow> _rows = const [];
  double _total = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dio = ref.read(dioProvider);
      final slug = ref.read(sessionProvider).tenantSlug ?? '';
      final res = await dio.get('/api/$slug/mobile/agent-bonuses');
      final data = res.data;
      final list = <_BonusRow>[];
      double total = 0;
      if (data is Map) {
        total = (data['total'] as num?)?.toDouble() ??
            (data['total_sum'] as num?)?.toDouble() ??
            0;
        final raw = data['items'] ?? data['bonuses'] ?? data['rows'];
        if (raw is List) {
          for (final item in raw) {
            if (item is! Map) continue;
            final m = Map<String, dynamic>.from(item);
            list.add(_BonusRow(
              title: (m['title'] ?? m['name'] ?? m['rule_name'] ?? 'Бонус')
                  .toString(),
              subtitle: (m['subtitle'] ?? m['period'] ?? m['note'] ?? '')
                  .toString(),
              amount: (m['amount'] as num?)?.toDouble() ??
                  (m['sum'] as num?)?.toDouble() ??
                  0,
              tier: (m['tier'] ?? m['percent'] ?? m['pct'])?.toString(),
            ));
          }
        }
      }
      if (!mounted) return;
      setState(() {
        _rows = list;
        _total = total > 0
            ? total
            : list.fold<double>(0, (s, e) => s + e.amount);
        _loading = false;
      });
    } catch (_) {
      // API yo‘q bo‘lsa — UI shablon + lokal tushuntirish.
      if (!mounted) return;
      setState(() {
        _loading = false;
        _rows = const [
          _BonusRow(
            title: 'Зина 3%',
            subtitle: 'Базовый уровень стратегии',
            amount: 0,
            tier: '3%',
          ),
          _BonusRow(
            title: 'Зина 5%',
            subtitle: 'Средний объём заказа',
            amount: 0,
            tier: '5%',
          ),
          _BonusRow(
            title: 'Зина 8%',
            subtitle: 'Максимальная скидка/бонус',
            amount: 0,
            tier: '8%',
          ),
        ];
        _error =
            'История бонусов появится после синхронизации. В заказе бонус уже работает.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const AgentAppBar(title: 'Мои бонусы', showBack: true),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [
                    AppColors.bonusBg2,
                    AppColors.bonusBg,
                  ],
                ),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.bonusAccent.withValues(alpha: 0.35)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Начислено',
                    style: AppTypography.caption.copyWith(
                      color: AppColors.bonusInk,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _loading
                        ? '…'
                        : '${_total.toStringAsFixed(0)} сум',
                    style: AppTypography.headlineLarge.copyWith(
                      color: AppColors.bonusInk,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Зина 3% / 5% / 8% — как в заказе (bonus ladder)',
                    style: AppTypography.bodySmall.copyWith(
                      color: AppColors.bonusInk,
                    ),
                  ),
                ],
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                style: AppTypography.bodySmall.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
            ],
            const SizedBox(height: 16),
            if (_loading)
              const Padding(
                padding: EdgeInsets.all(32),
                child: Center(child: CircularProgressIndicator()),
              )
            else
              ..._rows.map(
                (r) => Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: const BorderSide(color: AppColors.border),
                  ),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: AppColors.bonusBg2,
                      child: Text(
                        r.tier ?? '%',
                        style: const TextStyle(
                          color: AppColors.bonusInk,
                          fontWeight: FontWeight.w800,
                          fontSize: 12,
                        ),
                      ),
                    ),
                    title: Text(
                      r.title,
                      style: AppTypography.bodyMedium.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    subtitle: r.subtitle.isEmpty ? null : Text(r.subtitle),
                    trailing: Text(
                      r.amount > 0
                          ? '${r.amount.toStringAsFixed(0)}'
                          : '—',
                      style: AppTypography.labelLarge.copyWith(
                        color: AppColors.agentAccent,
                      ),
                    ),
                  ),
                ),
              ),
            const SizedBox(height: 8),
            Text(
              'Бонус и скидка применяются при создании заказа.',
              style: AppTypography.caption.copyWith(color: AppColors.textMuted),
            ),
          ],
        ),
      ),
    );
  }
}

class _BonusRow {
  final String title;
  final String subtitle;
  final double amount;
  final String? tier;

  const _BonusRow({
    required this.title,
    required this.subtitle,
    required this.amount,
    this.tier,
  });
}
