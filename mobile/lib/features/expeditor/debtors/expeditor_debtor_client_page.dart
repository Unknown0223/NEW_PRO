import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/api/api_exceptions.dart';
import '../../../core/api/field_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/gps/gps_tracker.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/time/work_region_time.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../../core/utils/external_actions.dart';
import '../../../core/format/money_display.dart';
import '../../agent/orders/order_create_models.dart' show formatMoneySpaced;
import '../expeditor_providers.dart';
import '../shared/balance_by_agent_sheet.dart';

/// Должники → mijoz kartasi: sarlavha (manzil/mo'ljal/balans) +
/// «Оплата» / «Возвращенные заказы» tablari + 3-nuqta «Действия клиента» +
/// inline vizit sessiyasi («Начать визит» → timer + Возврат/Оплата).
class ExpeditorDebtorClientPage extends ConsumerStatefulWidget {
  final int clientId;
  final Map<String, dynamic>? seed;

  const ExpeditorDebtorClientPage({
    super.key,
    required this.clientId,
    this.seed,
  });

  @override
  ConsumerState<ExpeditorDebtorClientPage> createState() =>
      _ExpeditorDebtorClientPageState();
}

class _ExpeditorDebtorClientPageState
    extends ConsumerState<ExpeditorDebtorClientPage> {
  bool _starting = false;
  bool _visitStarted = false;
  final Stopwatch _sw = Stopwatch();
  Timer? _timer;
  Duration _elapsed = Duration.zero;

  Map<String, dynamic> get _seed => widget.seed ?? const {};

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final detail = ref.watch(expeditorClientDetailProvider(widget.clientId));

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          title: const Text('Клиент'),
          actions: [
            IconButton(
              icon: const Icon(Icons.more_vert),
              onPressed: () => _showActionsSheet(detail.valueOrNull),
            ),
          ],
        ),
        body: detail.when(
          loading: () => const Center(
              child:
                  CircularProgressIndicator(color: AppColors.expeditorAccent),),
          error: (e, _) => RefreshIndicator(
            color: AppColors.expeditorAccent,
            onRefresh: () async =>
                ref.invalidate(expeditorClientDetailProvider(widget.clientId)),
            child: ListView(
              children: [
                SizedBox(
                  height: MediaQuery.sizeOf(context).height * 0.6,
                  child: Center(child: Text('Ошибка: $e')),
                ),
              ],
            ),
          ),
          data: (d) {
            final client =
                Map<String, dynamic>.from((d['client'] as Map?) ?? const {});
            final payments = (d['payments'] as List?) ?? const [];
            final returns = (d['returns'] as List?) ?? const [];

            return Column(
              children: [
                _header(client),
                const Material(
                  color: AppColors.surface,
                  child: TabBar(
                    labelColor: AppColors.expeditorAccent,
                    unselectedLabelColor: AppColors.textSecondary,
                    indicatorColor: AppColors.expeditorAccent,
                    tabs: [
                      Tab(text: 'Оплата'),
                      Tab(text: 'Возвращенные заказы'),
                    ],
                  ),
                ),
                Expanded(
                  child: TabBarView(
                    children: [
                      _PaymentsTab(
                        payments: payments,
                        onRefresh: () async => ref.invalidate(
                            expeditorClientDetailProvider(widget.clientId),),
                      ),
                      _ReturnsTab(
                        returns: returns,
                        onRefresh: () async => ref.invalidate(
                            expeditorClientDetailProvider(widget.clientId),),
                      ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
        bottomNavigationBar: _bottomBar(detail.valueOrNull),
      ),
    );
  }

  // ----- Header -----------------------------------------------------------

  Widget _header(Map<String, dynamic> client) {
    final name =
        client['name']?.toString() ?? _seed['name']?.toString() ?? 'Клиент';
    final legal = client['legal_name']?.toString();
    final code = client['client_code']?.toString();
    final address = client['address']?.toString() ??
        client['full_address']?.toString() ??
        _seed['address']?.toString();
    final landmark = client['landmark']?.toString();
    final balance = (client['balance'] as num?)?.toDouble() ??
        (client['total_balance'] as num?)?.toDouble() ??
        (_seed['balance'] as num?)?.toDouble() ??
        0;

    return Padding(
      padding: const EdgeInsets.all(12),
      child: AgentSurfaceCard(
        padding: EdgeInsets.zero,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 46,
                        height: 46,
                        decoration: BoxDecoration(
                          color: AppColors.surfaceVariant,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.storefront_outlined,
                            color: AppColors.textSecondary,),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(name,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,),),
                            if (legal != null && legal.isNotEmpty) ...[
                              const SizedBox(height: 2),
                              Text(legal,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: AppTypography.caption
                                      .copyWith(color: AppColors.textMuted),),
                            ],
                            if (code != null && code.isNotEmpty) ...[
                              const SizedBox(height: 2),
                              Text(code,
                                  style: AppTypography.caption
                                      .copyWith(color: AppColors.textMuted),),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (address != null && address.isNotEmpty)
                    _infoRow('Адрес:', address),
                  if (landmark != null && landmark.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    _infoRow('Ориентир:', landmark),
                  ],
                  const SizedBox(height: 6),
                  _balanceRow(client, balance),
                ],
              ),
            ),
            const Divider(height: 1, color: AppColors.borderLight),
            IntrinsicHeight(
              child: Row(
                children: [
                  Expanded(
                    child: _action(
                        Icons.phone_outlined, 'Вызов', () => _call(client),),
                  ),
                  const VerticalDivider(
                      width: 1, color: AppColors.borderLight,),
                  Expanded(
                    child: _action(Icons.location_on_outlined, 'Локация',
                        () => _openLocation(client),),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 84,
          child: Text(label,
              style: AppTypography.bodyMedium
                  .copyWith(color: AppColors.textMuted),),
        ),
        Expanded(
          child: Text(value,
              textAlign: TextAlign.right,
              style: const TextStyle(fontWeight: FontWeight.w700),),
        ),
      ],
    );
  }

  Widget _balanceRow(Map<String, dynamic> client, double balance) {
    final isDebt = balance < -0.01;
    return InkWell(
      borderRadius: BorderRadius.circular(8),
      onTap: () => showBalanceByAgentSheet(
        context,
        clientId: widget.clientId,
        fallbackTotal: balance,
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          children: [
            SizedBox(
              width: 110,
              child: Text('Общий баланс:',
                  style: AppTypography.bodyMedium
                      .copyWith(color: AppColors.textMuted),),
            ),
            Expanded(
              child: Text(
                "${formatMoneySpaced(balance)} So'm",
                textAlign: TextAlign.right,
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  color: colorForClientBalance(balance),
                ),
              ),
            ),
            const SizedBox(width: 4),
            const Icon(Icons.keyboard_arrow_down,
                size: 18, color: AppColors.textMuted,),
          ],
        ),
      ),
    );
  }

  // ----- «Действия клиента» sheet ----------------------------------------

  void _showActionsSheet(Map<String, dynamic>? detail) {
    final client =
        Map<String, dynamic>.from((detail?['client'] as Map?) ?? const {});
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(8, 8, 8, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const AgentSheetHandle(),
              const SizedBox(height: 6),
              Stack(
                alignment: Alignment.center,
                children: [
                  const Text('Действия клиента',
                      style: TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w800,),),
                  Align(
                    alignment: Alignment.centerRight,
                    child: IconButton(
                      icon: const Icon(Icons.close, color: AppColors.textMuted),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              _actionTile(ctx, Icons.open_in_new, 'Открыть местоположение в ...',
                  () => _openLocation(client),),
              _actionTile(ctx, Icons.pie_chart_outline, 'Акт сверки',
                  () => context.push('/exp-client-ledger/${widget.clientId}'),),
              _actionTile(ctx, Icons.history, 'История заказов',
                  () => context.push('/exp-client-orders/${widget.clientId}'),),
            ],
          ),
        ),
      ),
    );
  }

  Widget _actionTile(
      BuildContext sheetCtx, IconData icon, String label, VoidCallback onTap,) {
    return ListTile(
      leading: Icon(icon, color: AppColors.expeditorAccent),
      title: Text(label, style: AppTypography.bodyMedium),
      onTap: () {
        Navigator.pop(sheetCtx);
        onTap();
      },
    );
  }

  // ----- Actions ----------------------------------------------------------

  Future<void> _call(Map<String, dynamic> client) async {
    final phone = client['phone']?.toString() ?? _seed['phone']?.toString();
    if (!hasDialablePhone(phone)) {
      _toast('Номер телефона не указан');
      return;
    }
    final ok = await launchPhoneCall(phone!);
    if (!ok) _toast('Не удалось позвонить');
  }

  void _openLocation(Map<String, dynamic> client) {
    final lat = (client['latitude'] as num?)?.toDouble();
    final lng = (client['longitude'] as num?)?.toDouble();
    final name = client['name']?.toString() ?? _seed['name']?.toString() ?? '';
    if (lat != null && lng != null && lat != 0 && lng != 0) {
      context.push('/exp-client-map', extra: {
        'name': name,
        'lat': lat,
        'lng': lng,
      },);
      return;
    }
    _toast('Координаты клиента не указаны');
  }

  // ----- Vizit sessiyasi --------------------------------------------------

  Widget _bottomBar(Map<String, dynamic>? detail) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        boxShadow: [
          BoxShadow(
              color: Color(0x0F0F172A), blurRadius: 12, offset: Offset(0, -2),),
        ],
      ),
      child: SafeArea(
        top: false,
        child: _visitStarted ? _sessionControls() : _startButton(detail),
      ),
    );
  }

  Widget _startButton(Map<String, dynamic>? detail) => SizedBox(
        width: double.infinity,
        height: 52,
        child: ElevatedButton(
          onPressed: _starting ? null : () => _startVisit(detail),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.expeditorAccent,
            foregroundColor: Colors.white,
            elevation: 0,
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            textStyle:
                const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
          ),
          child: Text(_starting ? 'Начинаем…' : 'Начать визит'),
        ),
      );

  Widget _sessionControls() => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              _squareBtn(
                icon: Icons.close,
                color: AppColors.textSecondary,
                bg: AppColors.surfaceVariant,
                onTap: _confirmCancel,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Container(
                  height: 48,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceVariant,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text.rich(TextSpan(
                    text: 'Время сеанса: ',
                    style: AppTypography.bodyMedium
                        .copyWith(color: AppColors.textSecondary),
                    children: [
                      TextSpan(
                        text: _fmtDur(_elapsed),
                        style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            color: AppColors.textHeadline,),
                      ),
                    ],
                  ),),
                ),
              ),
              const SizedBox(width: 10),
              SizedBox(
                height: 48,
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.error,
                    padding: const EdgeInsets.symmetric(horizontal: 18),
                  ),
                  onPressed: _confirmFinish,
                  child: const Text('Завершить',
                      style: TextStyle(fontWeight: FontWeight.w700),),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 52,
                  child: OutlinedButton(
                    onPressed: () => context.push('/exp-return-by-order'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.error,
                      side: const BorderSide(color: AppColors.error),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),),
                    ),
                    child: const Text('Возврат',
                        style: TextStyle(fontWeight: FontWeight.w700),),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: SizedBox(
                  height: 52,
                  child: ElevatedButton(
                    onPressed: () => context.push('/payments'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.expeditorAccent,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),),
                    ),
                    child: const Text('Оплата',
                        style: TextStyle(fontWeight: FontWeight.w700),),
                  ),
                ),
              ),
            ],
          ),
        ],
      );

  Future<void> _startVisit(Map<String, dynamic>? detail) async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return;
    final client =
        Map<String, dynamic>.from((detail?['client'] as Map?) ?? const {});
    setState(() => _starting = true);

    double? lat = (client['latitude'] as num?)?.toDouble();
    double? lng = (client['longitude'] as num?)?.toDouble();
    try {
      final pos =
          await ref.read(gpsTrackerProvider.notifier).getQuickPosition();
      if (pos != null) {
        lat = pos.latitude;
        lng = pos.longitude;
      }
    } catch (_) {}

    try {
      await ref.read(fieldApiProvider).createVisit(
            slug,
            clientId: widget.clientId,
            latitude: lat,
            longitude: lng,
          );
      if (!mounted) return;
      _toast('Визит начат', color: AppColors.success);
      _beginSession();
    } on ApiException catch (e) {
      if (mounted) _toast('Ошибка: ${e.message}', color: AppColors.error);
    } catch (e) {
      if (mounted) _toast('Ошибка: $e', color: AppColors.error);
    } finally {
      if (mounted) setState(() => _starting = false);
    }
  }

  void _beginSession() {
    _sw
      ..reset()
      ..start();
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() => _elapsed = _sw.elapsed);
    });
    setState(() {
      _visitStarted = true;
      _elapsed = Duration.zero;
    });
  }

  Future<void> _confirmFinish() async {
    final ok = await _confirmDialog(
      title: 'Завершить визит?',
      message:
          'После завершения визита вы не сможете внести изменения. Завершить?',
      confirmText: 'Завершить',
      confirmColor: AppColors.error,
    );
    if (ok != true) return;
    _timer?.cancel();
    _sw.stop();
    if (!mounted) return;
    _toast('Визит завершён', color: AppColors.success);
    setState(() => _visitStarted = false);
  }

  Future<void> _confirmCancel() async {
    final ok = await _confirmDialog(
      title: 'Внимание!',
      message: 'Если вы отмените визит, связанные действия будут удалены.',
      confirmText: 'Отменить визит',
      confirmColor: AppColors.expeditorAccent,
    );
    if (ok != true) return;
    _timer?.cancel();
    _sw.stop();
    if (!mounted) return;
    _toast('Визит отменён');
    setState(() => _visitStarted = false);
  }

  Future<bool?> _confirmDialog({
    required String title,
    required String message,
    required String confirmText,
    required Color confirmColor,
  }) {
    return showDialog<bool>(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: AppColors.surface,
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(title,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      fontSize: 18, fontWeight: FontWeight.w800,),),
              const SizedBox(height: 8),
              Text(message,
                  textAlign: TextAlign.center,
                  style: AppTypography.bodyMedium
                      .copyWith(color: AppColors.textSecondary),),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: confirmColor,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  onPressed: () => Navigator.pop(ctx, true),
                  child: Text(confirmText,
                      style: const TextStyle(fontWeight: FontWeight.w700),),
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: FilledButton.tonal(
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.background,
                    foregroundColor: AppColors.textSecondary,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  onPressed: () => Navigator.pop(ctx, false),
                  child: const Text('Закрыть',
                      style: TextStyle(fontWeight: FontWeight.w700),),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _fmtDur(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    final h = d.inHours;
    return h > 0 ? '${h.toString().padLeft(2, '0')}:$m:$s' : '$m:$s';
  }

  void _toast(String msg, {Color color = AppColors.warning}) {
    if (!mounted) return;
    showAgentToast(context, msg, accentColor: color);
  }

  Widget _squareBtn({
    required IconData icon,
    required Color color,
    required Color bg,
    required VoidCallback onTap,
  }) =>
      Material(
        color: bg,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(10),
          child: SizedBox(
              width: 48, height: 48, child: Icon(icon, color: color),),
        ),
      );

  Widget _action(IconData icon, String label, VoidCallback onTap) => InkWell(
        onTap: onTap,
        child: SizedBox(
          height: 50,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 20, color: AppColors.textSecondary),
              const SizedBox(width: 8),
              Text(label,
                  style: AppTypography.bodyMedium.copyWith(
                      fontWeight: FontWeight.w600,
                      color: AppColors.textSecondary,),),
            ],
          ),
        ),
      );
}

// ===========================================================================
// «Оплата» — to'lov tarixi tab
// ===========================================================================
class _PaymentsTab extends StatelessWidget {
  final List<dynamic> payments;
  final Future<void> Function() onRefresh;

  const _PaymentsTab({required this.payments, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    if (payments.isEmpty) {
      return RefreshIndicator(
        color: AppColors.expeditorAccent,
        onRefresh: onRefresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            SizedBox(
              height: MediaQuery.sizeOf(context).height * 0.45,
              child: AgentEmptyState.fill(message: 'Пока здесь пусто'),
            ),
          ],
        ),
      );
    }
    // Bitta vizit (seans) ichidagi to'lovlarni bitta kartochkaga guruhlaymiz.
    // `visit_group` — backend tomonda vizit (AgentVisit) bo'yicha hisoblanadi.
    final groups = <String, List<Map<String, dynamic>>>{};
    final order = <String>[];
    for (final raw in payments) {
      final p = Map<String, dynamic>.from(raw as Map);
      final key = p['visit_group']?.toString() ?? 'p${p['id']}';
      if (!groups.containsKey(key)) {
        groups[key] = [];
        order.add(key);
      }
      groups[key]!.add(p);
    }

    return RefreshIndicator(
      color: AppColors.expeditorAccent,
      onRefresh: onRefresh,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
        itemCount: order.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (_, i) => _PaymentGroupCard(groups[order[i]]!),
      ),
    );
  }
}

/// Bitta vizit ichidagi to'lovlar — usul (способ оплаты) bo'yicha
/// jamlangan holda bitta kartochkada (ustma-ust + umumiy summa).
class _PaymentGroupCard extends StatelessWidget {
  final List<Map<String, dynamic>> items;
  const _PaymentGroupCard(this.items);

  @override
  Widget build(BuildContext context) {
    if (items.length == 1) {
      return _PaymentCard(items.first);
    }

    final date = _formatDate(items.first['paid_at']?.toString());
    final agent = items
        .map((p) => p['agent_name']?.toString())
        .firstWhere((s) => s != null && s.isNotEmpty, orElse: () => null);

    // Usul bo'yicha summalar (kiritilish tartibini saqlaymiz).
    final byMethod = <String, double>{};
    final methodOrder = <String>[];
    for (final p in items) {
      final m = _PaymentCard._methodLabel(p['payment_type']?.toString());
      final amt = (p['amount'] as num?)?.toDouble() ?? 0;
      if (!byMethod.containsKey(m)) {
        byMethod[m] = 0;
        methodOrder.add(m);
      }
      byMethod[m] = byMethod[m]! + amt;
    }
    final total = byMethod.values.fold<double>(0, (s, v) => s + v);

    final statuses = items
        .map((p) => p['workflow_status']?.toString() ?? 'confirmed')
        .toSet();
    final uniform = statuses.length == 1;
    final (statusLabel, statusColor) =
        _PaymentCard._statusInfo(uniform ? statuses.first : 'confirmed');

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (date != null)
                Text(date,
                    style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        color: AppColors.textHeadline,),),
              const Spacer(),
              if (uniform)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(statusLabel,
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: statusColor,),),
                ),
            ],
          ),
          if (agent != null && agent.isNotEmpty) ...[
            const SizedBox(height: 10),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Агент: ',
                    style: AppTypography.bodyMedium
                        .copyWith(color: AppColors.textMuted),),
                Expanded(
                  child: Text(agent,
                      textAlign: TextAlign.right,
                      style: const TextStyle(fontWeight: FontWeight.w600),),
                ),
              ],
            ),
          ],
          const SizedBox(height: 10),
          for (final m in methodOrder) ...[
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                children: [
                  Text('$m: ',
                      style: AppTypography.bodyMedium
                          .copyWith(color: AppColors.textMuted),),
                  Expanded(
                    child: Text('${formatMoneySpaced(byMethod[m]!)} UZS',
                        textAlign: TextAlign.right,
                        style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            color: AppColors.textHeadline,),),
                  ),
                ],
              ),
            ),
          ],
          const Divider(height: 12, color: AppColors.borderLight),
          Row(
            children: [
              const Text('Итого',
                  style: TextStyle(
                      fontWeight: FontWeight.w800,
                      color: AppColors.textHeadline,),),
              Expanded(
                child: Text('${formatMoneySpaced(total)} UZS',
                    textAlign: TextAlign.right,
                    style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        color: AppColors.expeditorAccent,),),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PaymentCard extends StatelessWidget {
  final Map<String, dynamic> p;
  const _PaymentCard(this.p);

  static String _methodLabel(String? type) {
    switch ((type ?? '').trim().toLowerCase()) {
      case 'cash':
        return 'Naqd';
      case 'card':
        return 'Карта';
      case 'terminal':
        return 'Terminal';
      case 'transfer':
      case 'bank':
        return 'Pereches';
      default:
        return (type == null || type.isEmpty) ? 'Naqd' : type;
    }
  }

  static (String, Color) _statusInfo(String status) {
    switch (status.trim().toLowerCase()) {
      case 'confirmed':
        return ('Подтвержденные', AppColors.success);
      case 'pending_confirmation':
        return ('На подтверждении', AppColors.warning);
      case 'rejected':
        return ('Отклонено', AppColors.error);
      case 'deleted':
        return ('Отменено', AppColors.textMuted);
      default:
        return ('Подтвержденные', AppColors.success);
    }
  }

  @override
  Widget build(BuildContext context) {
    final amount = (p['amount'] as num?)?.toDouble() ?? 0;
    final method = _methodLabel(p['payment_type']?.toString());
    final (statusLabel, statusColor) =
        _statusInfo(p['workflow_status']?.toString() ?? 'confirmed');
    final agent = p['agent_name']?.toString();
    final dateRaw = p['paid_at']?.toString();
    final date = _formatDate(dateRaw);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (date != null)
                Text(date,
                    style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        color: AppColors.textHeadline,),),
              const Spacer(),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(statusLabel,
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: statusColor,),),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (agent != null && agent.isNotEmpty)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Агент: ',
                    style: AppTypography.bodyMedium
                        .copyWith(color: AppColors.textMuted),),
                Expanded(
                  child: Text(agent,
                      textAlign: TextAlign.right,
                      style: const TextStyle(fontWeight: FontWeight.w600),),
                ),
              ],
            ),
          const SizedBox(height: 6),
          Row(
            children: [
              Text('$method: ',
                  style: AppTypography.bodyMedium
                      .copyWith(color: AppColors.textMuted),),
              Expanded(
                child: Text('${formatMoneySpaced(amount)} UZS',
                    textAlign: TextAlign.right,
                    style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        color: AppColors.textHeadline,),),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ===========================================================================
// «Возвращенные заказы» tab
// ===========================================================================
class _ReturnsTab extends StatelessWidget {
  final List<dynamic> returns;
  final Future<void> Function() onRefresh;

  const _ReturnsTab({required this.returns, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    if (returns.isEmpty) {
      return RefreshIndicator(
        color: AppColors.expeditorAccent,
        onRefresh: onRefresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            SizedBox(
              height: MediaQuery.sizeOf(context).height * 0.45,
              child: AgentEmptyState.fill(message: 'Пока здесь пусто'),
            ),
          ],
        ),
      );
    }
    return RefreshIndicator(
      color: AppColors.expeditorAccent,
      onRefresh: onRefresh,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
        itemCount: returns.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (_, i) =>
            _ReturnCard(Map<String, dynamic>.from(returns[i] as Map)),
      ),
    );
  }
}

class _ReturnCard extends StatelessWidget {
  final Map<String, dynamic> o;
  const _ReturnCard(this.o);

  @override
  Widget build(BuildContext context) {
    final number = o['order_number']?.toString() ?? o['id']?.toString() ?? '—';
    final sum = (o['total_sum'] as num?)?.toDouble() ?? 0;
    final date = _formatDate(o['date']?.toString());

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text.rich(TextSpan(
                text: 'ID: ',
                style: AppTypography.bodyMedium
                    .copyWith(color: AppColors.textMuted),
                children: [
                  TextSpan(
                    text: number,
                    style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        color: AppColors.textHeadline,),
                  ),
                ],
              ),),
              const Spacer(),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.error.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text('Возврат',
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: AppColors.error,),),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Text('Сумма: ',
                  style: AppTypography.bodyMedium
                      .copyWith(color: AppColors.textMuted),),
              Expanded(
                child: Text("${formatMoneySpaced(sum)} So'm",
                    textAlign: TextAlign.right,
                    style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        color: AppColors.expeditorAccent,),),
              ),
            ],
          ),
          if (date != null) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                Text('Дата: ',
                    style: AppTypography.bodyMedium
                        .copyWith(color: AppColors.textMuted),),
                Expanded(
                  child: Text(date,
                      textAlign: TextAlign.right,
                      style: const TextStyle(fontWeight: FontWeight.w600),),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// ISO (UTC) sanasini ish-mintaqa vaqtiga (server +5) o'tkazib formatlash.
String? _formatDate(String? raw) {
  if (raw == null || raw.isEmpty) return null;
  final dt = DateTime.tryParse(raw);
  if (dt == null) return null;
  return DateFormat('dd.MM.yyyy HH:mm').format(workRegionNow(dt));
}
