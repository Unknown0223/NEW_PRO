import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/dio_client.dart';
import '../../../core/auth/session.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../../design_system/design_system.dart';
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
  int _activeTierIndex = 0;

  static const _ladderTiers = <Map<String, dynamic>>[
    {'qty': 3, 'reward': '3%', 'increment': '3%'},
    {'qty': 5, 'reward': '5%', 'increment': '5%'},
    {'qty': 8, 'reward': '8%', 'increment': '8%'},
  ];

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
      var activeIdx = 0;
      if (data is Map) {
        total = (data['total'] as num?)?.toDouble() ??
            (data['total_sum'] as num?)?.toDouble() ??
            0;
        activeIdx = (data['active_tier_index'] as num?)?.toInt() ??
            (data['tier_index'] as num?)?.toInt() ??
            0;
        final raw = data['items'] ?? data['bonuses'] ?? data['rows'];
        if (raw is List) {
          for (final item in raw) {
            if (item is! Map) continue;
            final m = Map<String, dynamic>.from(item);
            list.add(
              _BonusRow(
                title: (m['title'] ?? m['name'] ?? m['rule_name'] ?? 'Бонус')
                    .toString(),
                subtitle: (m['subtitle'] ?? m['period'] ?? m['note'] ?? '')
                    .toString(),
                amount: (m['amount'] as num?)?.toDouble() ??
                    (m['sum'] as num?)?.toDouble() ??
                    0,
                tier: (m['tier'] ?? m['percent'] ?? m['pct'])?.toString(),
              ),
            );
          }
        }
      }
      if (!mounted) return;
      setState(() {
        _rows = list;
        _total = total > 0
            ? total
            : list.fold<double>(0, (s, e) => s + e.amount);
        _activeTierIndex = activeIdx.clamp(0, _ladderTiers.length - 1);
        _loading = false;
      });
    } catch (_) {
      // API yo‘q bo‘lsa — UI shablon + lokal tushuntirish.
      if (!mounted) return;
      setState(() {
        _loading = false;
        _activeTierIndex = 0;
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

  int get _ladderQty {
    final t = _ladderTiers[_activeTierIndex.clamp(0, _ladderTiers.length - 1)];
    return (t['qty'] as int?) ?? 3;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const AgentAppBar(title: 'Мои бонусы', showBack: true),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 140),
          children: [
            SaEnter(
              preset: SaMotionPreset.rise,
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      AppColors.bonusBg2,
                      AppColors.bonusBg,
                    ],
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: AppColors.bonusAccent.withValues(alpha: 0.35),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Начислено',
                      style: AppTypography.caption.copyWith(
                        color: AppColors.bonusInk,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    if (_loading)
                      Text(
                        '…',
                        style: AppTypography.headlineLarge.copyWith(
                          color: AppColors.bonusInk,
                          fontWeight: FontWeight.w800,
                        ),
                      )
                    else
                      SaCountUp(
                        value: _total,
                        format: (v) => '${v.toStringAsFixed(0)} сум',
                        style: AppTypography.headlineLarge.copyWith(
                          color: AppColors.bonusInk,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    const SizedBox(height: 8),
                    Text(
                      'Текущая зина: ${_ladderTiers[_activeTierIndex]['reward']}',
                      style: AppTypography.bodySmall.copyWith(
                        color: AppColors.bonusInk,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            SaEnter(
              delay: SaStaggerDelay.of(1),
              child: AgentTierStrip(
                kind: 'bonus',
                currentQty: _ladderQty,
                tiers: _ladderTiers,
                subtitle: 'Зина 3% → 5% → 8% (как в заказе)',
                earnedBonusQty: _activeTierIndex + 1,
                maxBonusQty: _ladderTiers.length,
              ),
            ),
            const SizedBox(height: 12),
            SaEnter(
              delay: SaStaggerDelay.of(2),
              child: _LadderSteps(
                tiers: _ladderTiers,
                activeIndex: _activeTierIndex,
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              SaEnter(
                delay: SaStaggerDelay.of(3),
                child: Text(
                  _error!,
                  style: AppTypography.bodySmall.copyWith(
                    color: AppColors.textSecondary,
                  ),
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
              ...[
                for (var i = 0; i < _rows.length; i++)
                  SaEnter(
                    delay: SaStaggerDelay.of(3 + i),
                    preset: SaMotionPreset.rise,
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: SaCard(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 4,
                        ),
                        child: ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: CircleAvatar(
                            backgroundColor: i <= _activeTierIndex
                                ? AppColors.bonusBg2
                                : AppColors.surfaceMuted,
                            child: Text(
                              _rows[i].tier ?? '%',
                              style: TextStyle(
                                color: i <= _activeTierIndex
                                    ? AppColors.bonusInk
                                    : AppColors.textMuted,
                                fontWeight: FontWeight.w800,
                                fontSize: 12,
                              ),
                            ),
                          ),
                          title: Text(
                            _rows[i].title,
                            style: AppTypography.bodyMedium.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          subtitle: _rows[i].subtitle.isEmpty
                              ? null
                              : Text(_rows[i].subtitle),
                          trailing: Text(
                            _rows[i].amount > 0
                                ? _rows[i].amount.toStringAsFixed(0)
                                : '—',
                            style: AppTypography.labelLarge.copyWith(
                              color: AppColors.agentAccent,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
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

class _LadderSteps extends StatelessWidget {
  final List<Map<String, dynamic>> tiers;
  final int activeIndex;

  const _LadderSteps({required this.tiers, required this.activeIndex});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (var i = 0; i < tiers.length; i++) ...[
          if (i > 0)
            Expanded(
              child: Container(
                height: 3,
                margin: const EdgeInsets.symmetric(horizontal: 4),
                decoration: BoxDecoration(
                  color: i <= activeIndex
                      ? AppColors.bonusAccent
                      : const Color(0xFFE5EDF3),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
          SaPopIn(
            delay: SaStaggerDelay.of(i),
            child: Container(
              width: 52,
              padding: const EdgeInsets.symmetric(vertical: 8),
              decoration: BoxDecoration(
                color: i <= activeIndex
                    ? AppColors.bonusBg2
                    : AppColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: i <= activeIndex
                      ? AppColors.bonusAccent
                      : AppColors.border,
                  width: i == activeIndex ? 2 : 1,
                ),
              ),
              alignment: Alignment.center,
              child: Text(
                tiers[i]['reward']?.toString() ?? '',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 13,
                  color: i <= activeIndex
                      ? AppColors.bonusInk
                      : AppColors.textMuted,
                ),
              ),
            ),
          ),
        ],
      ],
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
