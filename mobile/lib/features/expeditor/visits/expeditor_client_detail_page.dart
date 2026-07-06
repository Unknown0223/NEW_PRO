import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_exceptions.dart';
import '../../../core/api/expeditor_api.dart';
import '../../../core/api/field_api.dart';
import '../../../core/api/mobile_api.dart';
import '../../../core/auth/biometric_service.dart';
import '../../../core/auth/session.dart';
import '../../../core/gps/gps_tracker.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/utils/external_actions.dart';
import '../../../core/format/money_display.dart';
import '../../agent/orders/order_create_models.dart' show formatMoneySpaced;
import '../config/expeditor_config_enforcement.dart';
import '../expeditor_providers.dart';
import '../expeditor_status_labels.dart';
import '../payments/expeditor_payment_sheet.dart';
import 'expeditor_photo_flow.dart';
import 'expeditor_photo_section.dart';

/// Ekspeditor mijoz kartasi (Маршруты → mijoz) + vizit sessiyasi.
class ExpeditorClientDetailPage extends ConsumerStatefulWidget {
  final int clientId;
  final Map<String, dynamic>? data;

  const ExpeditorClientDetailPage(
      {super.key, required this.clientId, this.data,});

  @override
  ConsumerState<ExpeditorClientDetailPage> createState() =>
      _ExpeditorClientDetailPageState();
}

class _ExpeditorClientDetailPageState
    extends ConsumerState<ExpeditorClientDetailPage> {
  bool _starting = false;
  bool _busy = false;
  bool _visitStarted = false;
  int _photoRefreshTick = 0;
  DateTime? _sessionStart;
  Duration _elapsed = Duration.zero;
  Timer? _timer;

  Map<String, dynamic> get _d => widget.data ?? const {};

  String get _name =>
      _d['client_name']?.toString() ?? _d['name']?.toString() ?? 'Клиент';
  double get _balance =>
      (_d['balance'] as num?)?.toDouble() ??
      (_d['total_balance'] as num?)?.toDouble() ??
      0;
  String? get _phone => _d['phone']?.toString();
  double? get _lat => (_d['latitude'] as num?)?.toDouble();
  double? get _lng => (_d['longitude'] as num?)?.toDouble();
  int? get _orderId => _d['order_id'] as int?;
  double get _orderSum => (_d['total_sum'] as num?)?.toDouble() ?? 0;
  bool get _readOnly => _d['readonly'] == true;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _call() async {
    if (!hasDialablePhone(_phone)) {
      _toast('Номер телефона не указан');
      return;
    }
    final ok = await launchPhoneCall(_phone!);
    if (!ok) _toast('Не удалось позвонить');
  }

  Future<void> _location() async {
    final lat = _lat;
    final lng = _lng;
    if (lat != null && lng != null && lat != 0 && lng != 0) {
      context.push('/exp-client-map', extra: {
        'name': _name,
        'lat': lat,
        'lng': lng,
      },);
      return;
    }
    _toast('Координаты клиента не указаны');
  }

  /// Konfiguratsiya talab qilsa — vizit boshlashdan oldin bugungi fotohisobot
  /// majburiy. Bo'lmasa foto olishni taklif qiladi.
  Future<bool> _ensurePhotoBeforeVisit() async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return true;
    try {
      final photos = await ref
          .read(mobileApiProvider)
          .getClientPhotoReports(slug, widget.clientId);
      final now = DateTime.now();
      final hasToday = photos.any((p) {
        final dt = DateTime.tryParse(p.createdAt)?.toLocal();
        return dt != null &&
            dt.year == now.year &&
            dt.month == now.month &&
            dt.day == now.day;
      });
      if (hasToday) return true;
    } catch (_) {}
    final ok = await _confirmDialog(
      icon: Icons.photo_camera_outlined,
      iconColor: AppColors.expeditorAccent,
      title: 'Нужен фотоотчёт',
      message:
          'Перед началом визита необходимо добавить фотоотчёт. Сделать фото сейчас?',
      confirmText: 'Сделать фото',
      confirmColor: AppColors.expeditorAccent,
    );
    if (ok != true) return false;
    final res = await captureAndUploadExpeditorPhoto(
      context: context,
      ref: ref,
      slug: slug,
      clientId: widget.clientId,
    );
    if (res == null) return false;
    if (mounted) setState(() => _photoRefreshTick++);
    return true;
  }

  Future<void> _startVisit() async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return;

    final policy = ExpeditorConfigPolicy.fromMobileConfig(
        ref.read(sessionProvider).mobileConfig,);
    if (policy.requirePhotoReportBeforeVisit) {
      final ok = await _ensurePhotoBeforeVisit();
      if (!ok || !mounted) return;
    }

    setState(() => _starting = true);
    double? lat = _lat;
    double? lng = _lng;
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
      _toast('Визит начат: $_name', color: AppColors.success);
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
    _sessionStart = DateTime.now();
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted || _sessionStart == null) return;
      setState(() => _elapsed = DateTime.now().difference(_sessionStart!));
    });
    setState(() {
      _visitStarted = true;
      _elapsed = Duration.zero;
    });
  }

  Future<void> _confirmFinish() async {
    final ok = await _confirmDialog(
      icon: Icons.priority_high_rounded,
      iconColor: AppColors.error,
      title: 'Завершить визит?',
      message:
          'После завершения визита вы не сможете внести изменения. Вы уверены, что хотите завершить визит?',
      confirmText: 'Завершить',
      confirmColor: AppColors.error,
    );
    if (ok != true) return;
    _timer?.cancel();
    if (!mounted) return;
    _toast('Визит завершён', color: AppColors.success);
    context.pop();
  }

  Future<void> _confirmCancel() async {
    final ok = await _confirmDialog(
      icon: Icons.priority_high_rounded,
      iconColor: AppColors.expeditorAccent,
      title: 'Внимание!',
      message:
          'Если вы отмените визит, все связанные с ним действия будут удалены.',
      confirmText: 'Отменить визит',
      confirmColor: AppColors.expeditorAccent,
    );
    if (ok != true) return;
    _timer?.cancel();
    if (!mounted) return;
    _toast('Визит отменён');
    context.pop();
  }

  Future<bool?> _confirmDialog({
    required IconData icon,
    required Color iconColor,
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
          padding: const EdgeInsets.fromLTRB(20, 28, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(color: iconColor, shape: BoxShape.circle),
                child: Icon(icon, color: Colors.white, size: 30),
              ),
              const SizedBox(height: 16),
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

  Future<void> _addPayment() async {
    final orderId = _orderId;
    if (orderId == null) {
      _toast('Нет заказа для оплаты');
      return;
    }
    final added = await showExpeditorPaymentSheet(context, orderId: orderId);
    if (added == true && mounted) {
      ref.invalidate(expeditorPaymentContextProvider(orderId));
      ref.invalidate(expeditorOrderDetailProvider(orderId));
      _toast('Оплата отправлена. Ожидает подтверждения кассой',
          color: AppColors.success,);
    }
  }

  void _toast(String msg, {Color color = AppColors.warning}) {
    if (!mounted) return;
    showAgentToast(context, msg, accentColor: color);
  }

  String _fmtDur(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    final h = d.inHours;
    return h > 0 ? '${h.toString().padLeft(2, '0')}:$m:$s' : '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(_readOnly ? 'Завершённый визит' : 'Клиент'),
        actions: [
          PopupMenuButton<String>(
            onSelected: (v) {
              if (v == 'location') _location();
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'location', child: Text('Локация')),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: AgentSurfaceCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.all(14),
                    child: Row(
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
                              Text(_name,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w800,),),
                              const SizedBox(height: 4),
                              Text.rich(TextSpan(
                                text: 'Общий баланс: ',
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.textMuted,
                                ),
                                children: [
                                  TextSpan(
                                    text: formatMoneySpaced(_balance),
                                    style: TextStyle(
                                      color: colorForClientBalance(_balance),
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ],
                              ),),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 1, color: AppColors.borderLight),
                  IntrinsicHeight(
                    child: Row(
                      children: [
                        Expanded(
                            child:
                                _action(Icons.phone_outlined, 'Вызов', _call),),
                        const VerticalDivider(
                            width: 1, color: AppColors.borderLight,),
                        Expanded(
                            child: _action(Icons.location_on_outlined,
                                'Локация', _location,),),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          Expanded(child: _ordersBody()),
        ],
      ),
      bottomNavigationBar: _readOnly ? null : _bottomBar(),
    );
  }

  Widget _ordersBody() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
      children: [
        ExpeditorPhotoSection(
            key: ValueKey(_photoRefreshTick), clientId: widget.clientId,),
        const SizedBox(height: 16),
        const Text('Заказы',
            style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: AppColors.expeditorAccent,),),
        const SizedBox(height: 6),
        Container(height: 2, width: 64, color: AppColors.expeditorAccent),
        const SizedBox(height: 10),
        if (_orderId == null)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 24),
            child: Center(
              child: Text('Пока здесь пусто',
                  style: AppTypography.bodyMedium
                      .copyWith(color: AppColors.textMuted),),
            ),
          )
        else ...[
          Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Общая сумма',
                  style: AppTypography.bodyMedium
                      .copyWith(color: AppColors.textSecondary),),
              Text("${formatMoneySpaced(_orderSum)} So'm",
                  style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: AppColors.expeditorAccent,),),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Container(
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
                        text: _d['order_number']?.toString() ??
                            _orderId.toString(),
                        style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            color: AppColors.textHeadline,),
                      ),
                    ],
                  ),),
                ],
              ),
              const SizedBox(height: 10),
              _orderRow('Тип заказа:', 'Заказ'),
              const SizedBox(height: 6),
              _orderRow(
                  'Сумма:', "${formatMoneySpaced(_orderSum)} So'm",
                  valueColor: AppColors.expeditorAccent,),
            ],
          ),
        ),
        if (!_readOnly) ...[
          const SizedBox(height: 10),
          _statusActions(),
        ],
        ],
      ],
    );
  }

  /// Buyurtma holatini o'zgartirish amallari (Доставлено / Возврат / С полки).
  Widget _statusActions() {
    final orderId = _orderId;
    if (orderId == null) return const SizedBox.shrink();
    final detail = ref.watch(expeditorOrderDetailProvider(orderId));
    return detail.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 18),
        child: Center(
            child: CircularProgressIndicator(color: AppColors.expeditorAccent),),
      ),
      error: (_, __) => const SizedBox.shrink(),
      data: (o) {
        final status = o['status']?.toString() ?? '';
        final next = ((o['allowed_next_statuses'] as List?) ?? const [])
            .map((e) => e.toString())
            .where((s) =>
                s != 'picking' &&
                s != 'confirmed' &&
                s != 'new' &&
                // «Отмена» — faqat ombor/zav.sklad uchun (skladdan chiqmaganini
                // bildiradi). Dastavchik buni qila olmaydi.
                s != 'cancelled',)
            .toList();
        final policy = ExpeditorConfigPolicy.fromMobileConfig(
            ref.read(sessionProvider).mobileConfig,);
        final showShelfReturn =
            status == 'delivered' && policy.allowReturnFromShelf;

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
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Статус заказа',
                      style: AppTypography.bodyMedium
                          .copyWith(color: AppColors.textSecondary),),
                  _statusBadge(status),
                ],
              ),
              if (next.isEmpty && !showShelfReturn) ...[
                const SizedBox(height: 10),
                Text('Нет доступных действий',
                    style: AppTypography.caption
                        .copyWith(color: AppColors.textMuted),),
              ] else ...[
                if (!_visitStarted) ...[
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      const Icon(Icons.lock_outline,
                          size: 16, color: AppColors.textMuted,),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text('Сначала начните визит',
                            style: AppTypography.caption
                                .copyWith(color: AppColors.textMuted),),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (final s in next) ...[
                      SizedBox(width: double.infinity, child: _statusButton(s)),
                      const SizedBox(height: 8),
                    ],
                    if (showShelfReturn)
                      SizedBox(width: double.infinity, child: _shelfReturnButton(orderId)),
                  ],
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  Widget _statusBadge(String status) {
    Color c;
    switch (status) {
      case 'delivered':
        c = AppColors.success;
        break;
      case 'returned':
      case 'cancelled':
        c = AppColors.error;
        break;
      default:
        c = AppColors.expeditorAccent;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(expeditorStatusLabel(status),
          style:
              TextStyle(color: c, fontWeight: FontWeight.w700, fontSize: 12),),
    );
  }

  Widget _statusButton(String status) {
    late final Color color;
    late final String label;
    switch (status) {
      case 'delivered':
        color = AppColors.success;
        label = 'Доставлено';
        break;
      case 'returned':
        color = AppColors.error;
        label = 'Возврат';
        break;
      case 'delivering':
        color = AppColors.expeditorAccent;
        label = 'Отгрузить';
        break;
      case 'cancelled':
        color = AppColors.textSecondary;
        label = 'Отменить';
        break;
      default:
        color = AppColors.textSecondary;
        label = expeditorStatusLabel(status);
    }
    return SizedBox(
      height: 42,
      child: ElevatedButton(
        onPressed: (_busy || !_visitStarted)
            ? null
            : () => _confirmAndSetStatus(status, label),
        style: ElevatedButton.styleFrom(
          backgroundColor: color,
          foregroundColor: Colors.white,
          disabledBackgroundColor: AppColors.surfaceVariant,
          disabledForegroundColor: AppColors.textMuted,
          elevation: 0,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          padding: const EdgeInsets.symmetric(horizontal: 18),
        ),
        child:
            Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
      ),
    );
  }

  Widget _shelfReturnButton(int orderId) {
    return SizedBox(
      height: 42,
      child: OutlinedButton.icon(
        onPressed: (_busy || !_visitStarted)
            ? null
            : () => context.push('/exp-return-by-order/$orderId'),
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.expeditorAccent,
          disabledForegroundColor: AppColors.textMuted,
          side: BorderSide(
              color: _visitStarted
                  ? AppColors.expeditorAccent
                  : AppColors.borderLight,),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          padding: const EdgeInsets.symmetric(horizontal: 14),
        ),
        icon: const Icon(Icons.assignment_return_outlined, size: 18),
        label: const Text('Возврат с полки',
            style: TextStyle(fontWeight: FontWeight.w700),),
      ),
    );
  }

  Future<void> _confirmAndSetStatus(String status, String label) async {
    // Vazvrat — sabab tanlash oynasi (konfiguratsiyaga ko'ra majburiy/ixtiyoriy).
    if (status == 'returned') {
      await _handleReturn(label);
      return;
    }
    final ok = await _confirmDialog(
      icon: Icons.help_outline,
      iconColor: status == 'cancelled'
          ? AppColors.error
          : AppColors.expeditorAccent,
      title: '$label?',
      message: 'Изменить статус заказа на «$label»?',
      confirmText: label,
      confirmColor: status == 'cancelled'
          ? AppColors.error
          : AppColors.expeditorAccent,
    );
    if (ok == true) await _setOrderStatus(status, label);
  }

  Future<void> _handleReturn(String label) async {
    final policy = ExpeditorConfigPolicy.fromMobileConfig(
        ref.read(sessionProvider).mobileConfig,);
    final reason = await _returnReasonSheet(required: policy.returnReasonRequired);
    // null — bekor qilindi.
    if (reason == null) return;
    await _setOrderStatus('returned', label, reason: reason.isEmpty ? null : reason);
  }

  Future<String?> _returnReasonSheet({required bool required}) {
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (_) => _ReturnReasonSheet(required: required),
    );
  }

  Future<void> _setOrderStatus(String status, String label, {String? reason}) async {
    final orderId = _orderId;
    if (orderId == null) return;
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return;

    if (status == 'delivered') {
      final policy = ExpeditorConfigPolicy.fromMobileConfig(
          ref.read(sessionProvider).mobileConfig,);
      if (policy.fingerprintRequired) {
        final bio = ref.read(biometricServiceProvider);
        if (!await bio.isAvailable()) {
          _toast('Отпечаток недоступен — отключите в настройках администратора',
              color: AppColors.error,);
          return;
        }
        final ok = await bio.authenticate(reason: 'Подтвердите доставку');
        if (!ok) return;
      }
    }

    setState(() => _busy = true);
    try {
      await ref
          .read(expeditorApiProvider)
          .patchOrderStatus(slug, orderId, status, reason: reason);
      ref.invalidate(expeditorOrderDetailProvider(orderId));
      ref.invalidate(deliveriesProvider(null));
      ref.invalidate(expeditorVisitsProvider('active'));
      ref.invalidate(expeditorVisitsProvider('completed'));
      ref.invalidate(expeditorDashboardProvider);
      if (mounted) _toast('Статус: $label', color: AppColors.success);
    } on ApiException catch (e) {
      if (mounted) _toast('Ошибка: ${e.message}', color: AppColors.error);
    } catch (e) {
      if (mounted) _toast('Ошибка: $e', color: AppColors.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _orderRow(String label, String value, {Color? valueColor}) => Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: AppTypography.bodyMedium
                  .copyWith(color: AppColors.textMuted),),
          Text(value,
              style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: valueColor ?? AppColors.textHeadline,),),
        ],
      );

  Widget _bottomBar() {
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
        child: _visitStarted ? _sessionControls() : _startButton(),
      ),
    );
  }

  Widget _startButton() => SizedBox(
        width: double.infinity,
        height: 52,
        child: ElevatedButton(
          onPressed: _starting ? null : _startVisit,
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.expeditorAccent,
            foregroundColor: Colors.white,
            elevation: 0,
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),),
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
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton.icon(
              onPressed: _addPayment,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.expeditorAccent,
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),),
                textStyle:
                    const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
              ),
              icon: const Icon(Icons.add),
              label: const Text('Добавить оплату'),
            ),
          ),
        ],
      );

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

/// «Причина возврата» — qaytarish sababini tanlash oynasi.
/// `required` bo'lsa — sabab kiritmasdan tasdiqlab bo'lmaydi.
class _ReturnReasonSheet extends StatefulWidget {
  final bool required;
  const _ReturnReasonSheet({required this.required});

  @override
  State<_ReturnReasonSheet> createState() => _ReturnReasonSheetState();
}

class _ReturnReasonSheetState extends State<_ReturnReasonSheet> {
  static const _presets = <String>[
    'Клиент отказался',
    'Брак / повреждение товара',
    'Неверный товар',
    'Истёк срок годности',
    'Нет денег у клиента',
  ];

  String? _selected;
  final _customCtrl = TextEditingController();

  @override
  void dispose() {
    _customCtrl.dispose();
    super.dispose();
  }

  String get _effectiveReason {
    if (_selected == '__other__') return _customCtrl.text.trim();
    return _selected ?? '';
  }

  bool get _canConfirm {
    if (!widget.required) return true;
    return _effectiveReason.isNotEmpty;
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding:
          EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const AgentSheetHandle(),
              const SizedBox(height: 6),
              Stack(
                alignment: Alignment.center,
                children: [
                  const Text('Причина возврата',
                      style:
                          TextStyle(fontSize: 16, fontWeight: FontWeight.w800),),
                  Align(
                    alignment: Alignment.centerRight,
                    child: IconButton(
                      icon: const Icon(Icons.close, color: AppColors.textMuted),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                widget.required
                    ? 'Выберите причину возврата заказа (обязательно).'
                    : 'Выберите причину возврата заказа (необязательно).',
                style: AppTypography.caption.copyWith(color: AppColors.textMuted),
              ),
              const SizedBox(height: 8),
              Flexible(
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      for (final r in _presets)
                        RadioListTile<String>(
                          value: r,
                          groupValue: _selected,
                          onChanged: (v) => setState(() => _selected = v),
                          activeColor: AppColors.error,
                          contentPadding: EdgeInsets.zero,
                          dense: true,
                          title: Text(r),
                        ),
                      RadioListTile<String>(
                        value: '__other__',
                        groupValue: _selected,
                        onChanged: (v) => setState(() => _selected = v),
                        activeColor: AppColors.error,
                        contentPadding: EdgeInsets.zero,
                        dense: true,
                        title: const Text('Другое'),
                      ),
                      if (_selected == '__other__')
                        Padding(
                          padding: const EdgeInsets.only(top: 4, bottom: 4),
                          child: TextField(
                            controller: _customCtrl,
                            autofocus: true,
                            maxLines: 2,
                            onChanged: (_) => setState(() {}),
                            decoration: InputDecoration(
                              hintText: 'Укажите причину',
                              border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(10),
                                borderSide: const BorderSide(
                                    color: AppColors.error, width: 1.5,),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: FilledButton.tonal(
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.surfaceVariant,
                        foregroundColor: AppColors.textSecondary,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Отмена',
                          style: TextStyle(fontWeight: FontWeight.w700),),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.error,
                        disabledBackgroundColor: AppColors.surfaceVariant,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      onPressed: _canConfirm
                          ? () => Navigator.pop(context, _effectiveReason)
                          : null,
                      child: const Text('Оформить возврат',
                          style: TextStyle(fontWeight: FontWeight.w700),),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
