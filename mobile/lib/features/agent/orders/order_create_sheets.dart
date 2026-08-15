
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/config/mobile_config.dart';
import '../../../core/config/order_config_policy.dart';
import '../../../core/config/consignment_due_date.dart';
import '../../../core/api/orders_api.dart';
import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../clients/client_photo_report_flow.dart';
import 'bonus_stock_utils.dart';
import 'order_create_models.dart';

/// 1-qadam: ombor, narx turi, izoh (referens «Добавить заказ» pastki varaq).
class OrderSetupSheet extends StatefulWidget {
  final List<Map<String, dynamic>> warehouses;
  final List<String> priceTypes;
  final int? initialWarehouseId;
  final String initialPriceType;
  final String initialComment;
  final bool showDiscountField;
  final bool showConsignmentField;
  final String? consignmentPaymentDueRule;
  final bool initialIsConsignment;
  final String initialConsignmentDueDate;
  final String? clientCreditLimitHint;
  final OrderClientFinance? clientFinance;
  final double cartTotal;
  final bool consignmentCheckboxEnabled;
  final bool photoRequired;
  final int? defaultWarehouseId;
  final bool initialHasUnlinkedPhoto;
  final bool showShipmentDateField;
  final String initialShipmentDate;
  final Future<bool> Function()? onAddPhoto;

  const OrderSetupSheet({
    super.key,
    required this.warehouses,
    required this.priceTypes,
    this.initialWarehouseId,
    this.initialPriceType = 'default',
    this.initialComment = '',
    this.showDiscountField = false,
    this.showConsignmentField = false,
    this.consignmentPaymentDueRule,
    this.initialIsConsignment = false,
    this.initialConsignmentDueDate = '',
    this.clientCreditLimitHint,
    this.clientFinance,
    this.cartTotal = 0,
    this.consignmentCheckboxEnabled = false,
    this.photoRequired = false,
    this.defaultWarehouseId,
    this.initialHasUnlinkedPhoto = true,
    this.showShipmentDateField = false,
    this.initialShipmentDate = '',
    this.onAddPhoto,
  });

  static Future<OrderSetupResult?> show(
    BuildContext context, {
    required List<Map<String, dynamic>> warehouses,
    required List<String> priceTypes,
    int? initialWarehouseId,
    String initialPriceType = 'default',
    String initialComment = '',
    bool showDiscountField = false,
    bool showConsignmentField = false,
    String? consignmentPaymentDueRule,
    bool initialIsConsignment = false,
    String initialConsignmentDueDate = '',
    String? clientCreditLimitHint,
    OrderClientFinance? clientFinance,
    double cartTotal = 0,
    bool consignmentCheckboxEnabled = false,
    bool photoRequired = false,
    int? defaultWarehouseId,
    bool initialHasUnlinkedPhoto = true,
    bool showShipmentDateField = false,
    String initialShipmentDate = '',
    Future<bool> Function()? onAddPhoto,
  }) {
    return showModalBottomSheet<OrderSetupResult>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => OrderSetupSheet(
        warehouses: warehouses,
        priceTypes: priceTypes,
        initialWarehouseId: initialWarehouseId,
        initialPriceType: initialPriceType,
        initialComment: initialComment,
        showDiscountField: showDiscountField,
        showConsignmentField: showConsignmentField,
        consignmentPaymentDueRule: consignmentPaymentDueRule,
        initialIsConsignment: initialIsConsignment,
        initialConsignmentDueDate: initialConsignmentDueDate,
        clientCreditLimitHint: clientCreditLimitHint,
        clientFinance: clientFinance,
        cartTotal: cartTotal,
        consignmentCheckboxEnabled: consignmentCheckboxEnabled,
        photoRequired: photoRequired,
        defaultWarehouseId: defaultWarehouseId,
        initialHasUnlinkedPhoto: initialHasUnlinkedPhoto,
        showShipmentDateField: showShipmentDateField,
        initialShipmentDate: initialShipmentDate,
        onAddPhoto: onAddPhoto,
      ),
    );
  }

  @override
  State<OrderSetupSheet> createState() => _OrderSetupSheetState();
}

class OrderSetupResult {
  final int warehouseId;
  final String priceType;
  final String comment;
  final bool isConsignment;
  final String? consignmentDueDate;
  final String? shipmentDate;
  const OrderSetupResult({
    required this.warehouseId,
    required this.priceType,
    this.comment = '',
    this.isConsignment = false,
    this.consignmentDueDate,
    this.shipmentDate,
  });
}

class _OrderSetupSheetState extends State<OrderSetupSheet> {
  late int? _warehouseId;
  late String _priceType;
  late bool _isConsignment;
  late String _consignmentDueDate;
  late String _shipmentDate;
  late bool _hasUnlinkedPhoto;
  late final TextEditingController _commentCtrl;
  late final TextEditingController _discountCtrl;

  @override
  void initState() {
    super.initState();
    _hasUnlinkedPhoto = widget.initialHasUnlinkedPhoto;
    _warehouseId = widget.initialWarehouseId ??
        widget.defaultWarehouseId ??
        (widget.warehouses.isNotEmpty
            ? (widget.warehouses.first['id'] as num?)?.toInt()
            : null);
    _priceType = widget.priceTypes.contains(widget.initialPriceType)
        ? widget.initialPriceType
        : (widget.priceTypes.isNotEmpty ? widget.priceTypes.first : 'default');
    _commentCtrl = TextEditingController(text: widget.initialComment);
    _discountCtrl = TextEditingController();
    _isConsignment = widget.initialIsConsignment;
    final finance = widget.clientFinance;
    if (finance != null && !finance.consignmentToggleEnabled) {
      _isConsignment = false;
    }
    _consignmentDueDate = widget.initialConsignmentDueDate.trim().isNotEmpty
        ? widget.initialConsignmentDueDate.trim()
        : defaultConsignmentDueDate(widget.consignmentPaymentDueRule);
    _shipmentDate = widget.initialShipmentDate.trim();
  }

  Future<void> _pickShipmentDate() async {
    final parts = _shipmentDate.split('-');
    var initial = DateTime.now();
    if (parts.length == 3) {
      final y = int.tryParse(parts[0]);
      final m = int.tryParse(parts[1]);
      final d = int.tryParse(parts[2]);
      if (y != null && m != null && d != null) {
        initial = DateTime(y, m, d);
      }
    }
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 365 * 3)),
    );
    if (picked != null) {
      setState(() => _shipmentDate = _isoDate(picked));
    }
  }

  Future<void> _pickConsignmentDueDate() async {
    final parts = _consignmentDueDate.split('-');
    var initial = DateTime.now();
    if (parts.length == 3) {
      final y = int.tryParse(parts[0]);
      final m = int.tryParse(parts[1]);
      final d = int.tryParse(parts[2]);
      if (y != null && m != null && d != null) {
        initial = DateTime(y, m, d);
      }
    }
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 365 * 3)),
    );
    if (picked != null) {
      setState(() => _consignmentDueDate = _isoDate(picked));
    }
  }

  String _isoDate(DateTime d) {
    final y = d.year;
    final m = d.month.toString().padLeft(2, '0');
    final day = d.day.toString().padLeft(2, '0');
    return '$y-$m-$day';
  }

  void _onConsignmentChanged(bool? v) {
    final on = v == true;
    setState(() {
      _isConsignment = on;
      if (on && _consignmentDueDate.trim().isEmpty) {
        _consignmentDueDate = defaultConsignmentDueDate(widget.consignmentPaymentDueRule);
      }
    });
  }

  @override
  void dispose() {
    _commentCtrl.dispose();
    _discountCtrl.dispose();
    super.dispose();
  }

  String _buildComment() {
    final base = _commentCtrl.text.trim();
    if (!widget.showDiscountField) return base;
    final d = _discountCtrl.text.trim();
    if (d.isEmpty) return base;
    final tag = '[chegirma:$d%]';
    if (base.isEmpty) return tag;
    return '$tag $base';
  }

  Widget _buildLimitsPanel() {
    if (widget.showConsignmentField) return const SizedBox.shrink();
    final f = widget.clientFinance ?? const OrderClientFinance();
    final cart = widget.cartTotal;
    final rem = f.creditRemainingAfterOrder(cart);
    final limitLabel = f.creditLimit > 0
        ? formatOrderMoney(f.creditLimit)
        : (widget.clientCreditLimitHint?.trim().isNotEmpty == true
            ? widget.clientCreditLimitHint!.trim()
            : formatOrderMoney(0));
    final debtReason = f.regularOrderBlockReason();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _limitsBox(
          '${S.creditLimit}: $limitLabel',
          '${S.limitRemaining}: ${formatOrderMoney(rem)}',
        ),
        if (debtReason != null) ...[
          const SizedBox(height: 8),
          Text(
            debtReason,
            style: AppTypography.caption.copyWith(
              color: AppColors.error,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ],
    );
  }

  bool get _consignmentUiEnabled {
    final f = widget.clientFinance ?? const OrderClientFinance();
    return widget.consignmentCheckboxEnabled && f.consignmentToggleEnabled;
  }

  Widget _buildRegularDebtBanner() {
    if (_isConsignment) return const SizedBox.shrink();
    final reason =
        (widget.clientFinance ?? const OrderClientFinance()).regularOrderBlockReason();
    if (reason == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Text(
        reason,
        style: AppTypography.caption.copyWith(
          color: AppColors.error,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  double? get _consignmentRemainingValue {
    final f = widget.clientFinance ?? const OrderClientFinance();
    if (_isConsignment && widget.cartTotal > 0) {
      return f.consignmentRemainingAfterOrder(widget.cartTotal);
    }
    return f.consignmentAvailable;
  }

  bool get _consignmentLimitExceeded {
    if (!_isConsignment) return false;
    return (widget.clientFinance ?? const OrderClientFinance())
        .consignmentLimitExceededBy(widget.cartTotal);
  }

  String? _consignmentRemainingLabel() {
    final f = widget.clientFinance ?? const OrderClientFinance();
    final lim = f.consignmentLimitAmount;
    if (lim == null) return null;
    final rem = _consignmentRemainingValue;
    if (rem == null) return '${S.limitRemaining}: ${formatMoneyUz(lim)}';
    return '${S.limitRemaining}: ${formatMoneyUz(rem)}';
  }

  /// «Консигнация» + qolgan limit + switch (referens pastki varaq).
  Widget _buildConsignmentRow() {
    if (!widget.showConsignmentField) return const SizedBox.shrink();
    final f = widget.clientFinance ?? const OrderClientFinance();
    final clientBlock = f.consignmentBlockReason();
    final enabled = _consignmentUiEnabled;
    final remainingLabel = _consignmentRemainingLabel();
    final exceeded = _consignmentLimitExceeded;
    final disabledHint = !f.agentConsignmentEnabled
        ? S.consignmentNotAvailable
        : (clientBlock ?? S.consignmentNotAvailable);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              flex: 2,
              child: Text(
                S.orderConsignment,
                style: AppTypography.bodySmall.copyWith(
                  fontWeight: FontWeight.w600,
                  color: enabled ? AppColors.textPrimary : AppColors.textMuted,
                ),
              ),
            ),
            if (remainingLabel != null)
              Expanded(
                flex: 3,
                child: Text(
                  remainingLabel,
                  textAlign: TextAlign.end,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.bodySmall.copyWith(
                    fontWeight: FontWeight.w700,
                    color: exceeded
                        ? AppColors.error
                        : (enabled ? AppColors.agentAccent : AppColors.textMuted),
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ),
            Switch.adaptive(
              value: enabled ? _isConsignment : false,
              activeColor: AppColors.primary,
              onChanged: enabled ? _onConsignmentChanged : null,
            ),
          ],
        ),
        if (!enabled)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              disabledHint,
              style: AppTypography.caption.copyWith(
                color: AppColors.error,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        if (exceeded)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              S.consignmentLimitExceeded,
              style: AppTypography.caption.copyWith(
                color: AppColors.error,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
      ],
    );
  }

  Widget _limitsBox(String line1, String? line2) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade300),
        borderRadius: BorderRadius.circular(8),
        color: Colors.grey.shade50,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(line1, style: AppTypography.bodySmall),
          if (line2 != null) ...[
            const SizedBox(height: 4),
            Text(
              line2,
              style: AppTypography.bodyMedium.copyWith(
                fontWeight: FontWeight.w600,
                color: AppColors.agentAccent,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _fieldLabel(String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 5),
      child: Text(
        label,
        style: AppTypography.captionSmall.copyWith(
          color: AppColors.textMuted,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  Widget _dropdownBox({required Widget child}) {
    return InputDecorator(
      decoration: InputDecoration(
        filled: true,
        fillColor: const Color(0xFFF7FAFC),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFE6ECF1)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFE6ECF1)),
        ),
      ),
      child: child,
    );
  }

  int? get _safeWarehouseId {
    final ids = widget.warehouses
        .map((w) => (w['id'] as num?)?.toInt())
        .whereType<int>()
        .toSet();
    if (_warehouseId != null && ids.contains(_warehouseId)) return _warehouseId;
    return ids.isEmpty ? null : ids.first;
  }

  String get _safePriceType {
    if (widget.priceTypes.contains(_priceType)) return _priceType;
    return widget.priceTypes.isNotEmpty ? widget.priceTypes.first : 'default';
  }

  bool get _canContinue =>
      _safeWarehouseId != null &&
      !(widget.photoRequired && !_hasUnlinkedPhoto) &&
      !(widget.showShipmentDateField && _shipmentDate.trim().isEmpty) &&
      !_consignmentLimitExceeded;

  void _submit() {
    final wh = _safeWarehouseId;
    if (wh == null || !_canContinue) return;
    final finance = widget.clientFinance;
    if (finance != null) {
      final gate = _isConsignment
          ? finance.consignmentBlockReason()
          : finance.regularOrderBlockReason();
      if (gate != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              !_isConsignment && finance.consignmentToggleEnabled
                  ? '$gate\nВключите «Консигнация», если она разрешена для клиента.'
                  : gate,
            ),
            backgroundColor: AppColors.error,
          ),
        );
        return;
      }
    }
    Navigator.pop(
      context,
      OrderSetupResult(
        warehouseId: wh,
        priceType: _safePriceType,
        comment: _buildComment(),
        isConsignment: _isConsignment && _consignmentUiEnabled,
        consignmentDueDate:
            _isConsignment && _consignmentUiEnabled ? _consignmentDueDate : null,
        shipmentDate: _shipmentDate.trim().isEmpty ? null : _shipmentDate.trim(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final limitsPanel = _buildLimitsPanel();
    final mq = MediaQuery.of(context);
    final bottom = mq.viewInsets.bottom;
    final maxHeight = (mq.size.height * 0.88 - bottom).clamp(280.0, mq.size.height * 0.88);

    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: maxHeight),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 12, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 44,
                      height: 5,
                      decoration: BoxDecoration(
                        color: const Color(0xFFD6DFE6),
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      const Expanded(
                        child: Text(
                          S.orderSetup,
                          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close_rounded),
                        onPressed: () => Navigator.pop(context),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (widget.warehouses.isNotEmpty) ...[
                      _fieldLabel(S.orderWarehouse),
                      _dropdownBox(
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<int>(
                            isExpanded: true,
                            value: _safeWarehouseId,
                            items: widget.warehouses
                                .map((w) {
                                  final id = (w['id'] as num?)?.toInt();
                                  if (id == null) return null;
                                  final name = w['name']?.toString() ?? 'Склад';
                                  return DropdownMenuItem<int>(
                                    value: id,
                                    child: Text(
                                      name,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  );
                                })
                                .whereType<DropdownMenuItem<int>>()
                                .toList(),
                            onChanged: (v) => setState(() => _warehouseId = v),
                          ),
                        ),
                      ),
                      const SizedBox(height: 13),
                    ],
                    if (widget.priceTypes.isNotEmpty) ...[
                      _fieldLabel(S.orderPriceType),
                      _dropdownBox(
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            isExpanded: true,
                            value: _safePriceType,
                            items: widget.priceTypes
                                .map(
                                  (t) => DropdownMenuItem<String>(
                                    value: t,
                                    child: Text(t, maxLines: 1, overflow: TextOverflow.ellipsis),
                                  ),
                                )
                                .toList(),
                            onChanged: (v) {
                              if (v != null) setState(() => _priceType = v);
                            },
                          ),
                        ),
                      ),
                      const SizedBox(height: 13),
                    ],
                    if (widget.showDiscountField) ...[
                      _fieldLabel(S.orderDiscount),
                      TextField(
                        controller: _discountCtrl,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: const InputDecoration(hintText: '0'),
                      ),
                      const SizedBox(height: 13),
                    ],
                    if (!widget.showConsignmentField) ...[
                      limitsPanel,
                      const SizedBox(height: 13),
                    ],
                    _fieldLabel(S.orderComment),
                    TextField(
                      controller: _commentCtrl,
                      maxLines: 2,
                      decoration: const InputDecoration(hintText: S.orderCommentHint),
                    ),
                    if (widget.showConsignmentField) ...[
                      const SizedBox(height: 13),
                      _buildConsignmentRow(),
                      const SizedBox(height: 8),
                      _buildRegularDebtBanner(),
                    ],
                    if (widget.showShipmentDateField) ...[
                      const SizedBox(height: 13),
                      _fieldLabel(S.orderShipmentDate),
                      InkWell(
                        onTap: _pickShipmentDate,
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF7FAFC),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFFE6ECF1)),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  _shipmentDate.isEmpty
                                      ? 'Не указана'
                                      : formatConsignmentDueDateRu(_shipmentDate),
                                  style: AppTypography.bodySmall,
                                ),
                              ),
                              const Icon(Icons.keyboard_arrow_down_rounded, color: AppColors.textMuted, size: 18),
                            ],
                          ),
                        ),
                      ),
                    ],
                    if (_isConsignment && _consignmentUiEnabled) ...[
                      const SizedBox(height: 13),
                      _fieldLabel(S.orderConsignmentDue),
                      InkWell(
                        onTap: _pickConsignmentDueDate,
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF7FAFC),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFFE6ECF1)),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  formatConsignmentDueDateRu(_consignmentDueDate),
                                  style: AppTypography.bodySmall,
                                ),
                              ),
                              const Icon(Icons.calendar_today_outlined, size: 18, color: AppColors.textMuted),
                            ],
                          ),
                        ),
                      ),
                    ],
                    if (widget.photoRequired && !_hasUnlinkedPhoto) ...[
                      const SizedBox(height: 16),
                      MandatoryPhotoBanner(
                        onAdd: () async {
                          final ok = await widget.onAddPhoto?.call() ?? false;
                          if (mounted) setState(() => _hasUnlinkedPhoto = ok);
                        },
                      ),
                    ],
                  ],
                ),
              ),
            ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
                child: SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: AppColors.primary.withValues(alpha: 0.4),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    onPressed: _canContinue ? _submit : null,
                    child: const Text(
                      S.continueArrow,
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

enum BonusMode { auto, none }

enum DiscountMode { auto, none, manual }

class OrderBonusDiscountResult {
  final BonusMode bonusMode;
  final DiscountMode discountMode;
  final bool applyBonus;
  final bool applyDiscount;
  final List<BonusGiftOverrideInput> giftOverrides;
  final List<BonusGiftLineInput> giftLines;
  final String bonusShortageComment;
  final String discountShortageComment;
  const OrderBonusDiscountResult({
    required this.bonusMode,
    required this.discountMode,
    required this.applyBonus,
    required this.applyDiscount,
    this.giftOverrides = const [],
    this.giftLines = const [],
    this.bonusShortageComment = '',
    this.discountShortageComment = '',
  });
}

/// Bonus + skidka tanlash (referens «Добавить бонус и скидку»).
class OrderBonusDiscountSheet extends StatefulWidget {
  final String slug;
  final int clientId;
  final int warehouseId;
  final String priceType;
  final List<OrderLineInput> items;
  final OrdersApi ordersApi;
  final OrdersConfig ordersConfig;
  final BonusMode initialBonusMode;
  final DiscountMode initialDiscountMode;

  const OrderBonusDiscountSheet({
    super.key,
    required this.slug,
    required this.clientId,
    required this.warehouseId,
    required this.priceType,
    required this.items,
    required this.ordersApi,
    this.ordersConfig = const OrdersConfig(),
    this.initialBonusMode = BonusMode.auto,
    this.initialDiscountMode = DiscountMode.auto,
  });

  static Future<OrderBonusDiscountResult?> show(
    BuildContext context, {
    required String slug,
    required int clientId,
    required int warehouseId,
    required String priceType,
    required List<OrderLineInput> items,
    required OrdersApi ordersApi,
    OrdersConfig ordersConfig = const OrdersConfig(),
    BonusMode initialBonusMode = BonusMode.auto,
    DiscountMode initialDiscountMode = DiscountMode.auto,
  }) {
    return showModalBottomSheet<OrderBonusDiscountResult>(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      isDismissible: true,
      enableDrag: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => OrderBonusDiscountSheet(
        slug: slug,
        clientId: clientId,
        warehouseId: warehouseId,
        priceType: priceType,
        items: items,
        ordersApi: ordersApi,
        ordersConfig: ordersConfig,
        initialBonusMode: initialBonusMode,
        initialDiscountMode: initialDiscountMode,
      ),
    );
  }

  @override
  State<OrderBonusDiscountSheet> createState() => _OrderBonusDiscountSheetState();
}

class _OrderBonusDiscountSheetState extends State<OrderBonusDiscountSheet> {
  late BonusMode _bonusMode;
  late DiscountMode _discountMode;
  int _activeSection = 0; // 0 = bonus, 1 = discount
  bool _slideForward = true;
  int? _selectedBonusRuleId;
  int? _selectedDiscountRuleId;
  final Map<int, Map<int, int>> _giftQtyByRule = {};
  final Map<int, int> _giftProductByRule = {};
  final Map<int, Set<int>> _manualGiftByRule = {};
  final Set<int> _expandedBonusRuleIds = {};
  final Set<int> _expandedDiscountRuleIds = {};
  OrderBonusPreview _preview = OrderBonusPreview.empty();
  bool _loadingPreview = true;
  String? _previewError;

  OrderBonusPreview get preview => _preview;

  bool _bonusModeAllowed(BonusMode mode) {
    final key = mode == BonusMode.auto ? 'auto' : 'none';
    return isBonusModeKeyAllowed(widget.ordersConfig, key);
  }

  bool get _canUseBoth {
    if (_bonusMode == BonusMode.none || _discountMode == DiscountMode.none) return true;
    // Manual bonus olib tashlangan — stack cheklovi faqat auto+auto / auto+manual skidka uchun.
    return preview.bonusStackMode != 'first_only';
  }

  bool get _bonusSectionDisabled =>
      !_canUseBoth && _discountMode == DiscountMode.manual && _selectedDiscountRuleId != null;

  bool get _discountSectionDisabled => false;

  @override
  void initState() {
    super.initState();
    _bonusMode = widget.initialBonusMode;
    if (!_bonusModeAllowed(_bonusMode)) {
      final fallback = defaultBonusModeKey(widget.ordersConfig);
      _bonusMode = fallback == 'none' ? BonusMode.none : BonusMode.auto;
    }
    _discountMode = widget.initialDiscountMode;
    _loadPreview();
  }

  Future<void> _loadPreview() async {
    try {
      final raw = await widget.ordersApi.previewBonus(
        widget.slug,
        clientId: widget.clientId,
        warehouseId: widget.warehouseId,
        items: widget.items,
        priceType: widget.priceType,
      );
      if (!mounted) return;
      final parsed = OrderBonusPreview.fromJson(raw);
      final normalized = _normalizePreview(parsed);
      setState(() {
        _preview = OrderBonusPreview(
          bonusStackMode: normalized.bonusStackMode,
          eligibleBonuses: _dedupeEligibleBonuses(normalized.eligibleBonuses),
          eligibleDiscounts: normalized.eligibleDiscounts,
          linkedPairs: normalized.linkedPairs,
          autoApplyRuleIds: normalized.autoApplyRuleIds,
          autoApplyGifts: normalized.autoApplyGifts,
          autoDiscountRuleId: normalized.autoDiscountRuleId,
          autoDiscountPct: normalized.autoDiscountPct,
          discountSum: normalized.discountSum,
          expectedDiscountSum: normalized.expectedDiscountSum,
          discountCashDeskAvailable: normalized.discountCashDeskAvailable,
        );
        _loadingPreview = false;
        _previewError = null;
        _applyPreviewDefaults();
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadingPreview = false;
        _previewError = S.bonusPreviewFailed;
      });
    }
  }

  void _applyPreviewDefaults() {
    for (final rule in _preview.eligibleBonuses) {
      _initGiftDefaults(rule);
    }
    if (_bonusTabRules().isNotEmpty) {
      OrderBonusPreviewRule? focus;
      if (_preview.autoApplyRuleIds.isNotEmpty) {
        for (final r in _bonusTabRules()) {
          if (_preview.autoApplyRuleIds.contains(r.ruleId)) {
            focus = r;
            break;
          }
        }
      }
      final first = focus ?? _bonusTabRules().first;
      _selectedBonusRuleId = first.ruleId;
    }
    _applyComputedBonusQty();
    if (_bonusMode == BonusMode.auto) {
      _applyAutoBonusSelections();
    }
    _collapseAllRuleCards();
    final linkedDiscounts = _applicableDiscounts();
    if (linkedDiscounts.isNotEmpty) {
      final autoId = _preview.autoDiscountRuleId;
      if (autoId != null && linkedDiscounts.any((d) => d.ruleId == autoId)) {
        _selectedDiscountRuleId = autoId;
      } else {
        _selectedDiscountRuleId = linkedDiscounts.first.ruleId;
      }
    } else {
      _selectedDiscountRuleId = null;
    }
  }

  void _applyAssortmentAutoGifts(OrderBonusPreviewRule rule, Map<int, int> m) {
    final orderQty = _orderQtyByProduct();
    var assigned = false;
    for (final g in _assortmentGiftProducts(rule)) {
      final earned = _assortmentBonusForGift(rule, g, orderQty);
      if (earned <= 0) continue;
      m[g.productId] = earned;
      _giftProductByRule[rule.ruleId] = g.productId;
      assigned = true;
    }
    if (assigned) return;
    final earned = rule.bonusQty.round();
    if (earned <= 0 || rule.giftProducts.length != 1) return;
    final pid = rule.defaultGiftProductId ?? rule.giftProducts.first.productId;
    m[pid] = earned;
    _giftProductByRule[rule.ruleId] = pid;
  }

  /// Assortiment: server `gift_products` + zakazdagi sotib olingan miqdor.
  List<GiftProductPreview> _assortmentGiftProducts(OrderBonusPreviewRule rule) {
    final byId = <int, GiftProductPreview>{
      for (final g in rule.giftProducts) g.productId: g,
    };
    for (final item in widget.items) {
      final prev = byId[item.productId];
      if (prev == null) continue;
      if (prev.purchasedQty <= 0) {
        byId[item.productId] = GiftProductPreview(
          productId: prev.productId,
          name: prev.name,
          categoryName: prev.categoryName,
          stockAvailable: prev.stockAvailable,
          purchasedQty: item.qty.toDouble(),
          bonusQty: prev.bonusQty,
        );
      }
    }
    for (final pid in rule.triggerProductIds) {
      if (byId.containsKey(pid)) continue;
      OrderLineInput? line;
      for (final i in widget.items) {
        if (i.productId == pid) {
          line = i;
          break;
        }
      }
      if (line == null) continue;
      byId[pid] = GiftProductPreview(
        productId: pid,
        name: '#$pid',
        stockAvailable: 0,
        purchasedQty: line.qty.toDouble(),
      );
    }
    return byId.values.toList();
  }

  int? _inferStepQty(OrderBonusPreviewRule rule) {
    if (rule.stepQty != null && rule.stepQty! > 0) return rule.stepQty;
    final m = RegExp(r'(\d+)\+(\d+)').firstMatch(rule.name);
    if (m == null) return null;
    return int.tryParse(m.group(1) ?? '');
  }

  int _inferBonusStepQty(OrderBonusPreviewRule rule) {
    if (rule.bonusStepQty != null && rule.bonusStepQty! > 0) return rule.bonusStepQty!;
    final m = RegExp(r'(\d+)\+(\d+)').firstMatch(rule.name);
    if (m == null) return 1;
    return int.tryParse(m.group(2) ?? '') ?? 1;
  }

  Map<int, int> _orderQtyByProduct() {
    final out = <int, int>{};
    for (final item in widget.items) {
      out[item.productId] = (out[item.productId] ?? 0) + item.qty.round();
    }
    return out;
  }

  int _assortmentBonusForGift(
    OrderBonusPreviewRule rule,
    GiftProductPreview g,
    Map<int, int> orderQty,
  ) {
    final fromServer = g.bonusQty.round();
    if (fromServer > 0) return fromServer;
    final step = _inferStepQty(rule);
    if (step == null || step <= 0) return 0;
    final ordered = orderQty[g.productId] ?? g.purchasedQty.round();
    if (ordered <= 0) return 0;
    final per = _inferBonusStepQty(rule);
    return (ordered ~/ step) * per;
  }

  /// Har SKU uchun server yoki assortiment rejimi (5+1: har mahsulot alohida).
  bool _hasPerSkuBonusPlan(OrderBonusPreviewRule rule) =>
      rule.isAssortmentAuto ||
      (rule.isLockedAutoGift && rule.giftProducts.length > 1) ||
      rule.giftProducts.any((g) => g.bonusQty > 0);

  List<OrderBonusPreviewRule> _bonusTabRules() =>
      _preview.eligibleBonuses.where((r) => r.type != 'sum').toList();

  /// Foizli / min-sum skidka — server `eligible_discounts` ro‘yxati.
  List<OrderDiscountPreviewRule> _applicableDiscounts() => _preview.eligibleDiscounts;

  bool _canApplyLinkedDiscount() {
    if (_bonusMode == BonusMode.none || _discountMode == DiscountMode.none) return false;
    final linked = _applicableDiscounts();
    if (linked.isEmpty) return false;
    if (_discountMode == DiscountMode.auto) {
      final autoId = _preview.autoDiscountRuleId;
      return autoId != null && linked.any((d) => d.ruleId == autoId);
    }
    return _selectedDiscountRuleId != null &&
        linked.any((d) => d.ruleId == _selectedDiscountRuleId);
  }

  void _collapseAllRuleCards() {
    _expandedBonusRuleIds.clear();
    _expandedDiscountRuleIds.clear();
  }

  /// Ko‘p SKU: ombor qoldig‘i bo‘yicha bonuslarni avtomatik taqsimlash.
  void _distributeBonusByStock(OrderBonusPreviewRule rule, Map<int, int> m, int earned) {
    _manualGiftByRule.remove(rule.ruleId);
    for (final k in m.keys.toList()) {
      m[k] = 0;
    }
    if (earned <= 0 || rule.giftProducts.isEmpty) return;

    final sorted = [...rule.giftProducts]
      ..sort(
        (a, b) => bonusStockAvailable(b.stockAvailable).compareTo(bonusStockAvailable(a.stockAvailable)),
      );

    var remaining = earned;
    for (final g in sorted) {
      if (remaining <= 0) break;
      final take = capGiftQtyByStock(stockAvailable: g.stockAvailable, requested: remaining);
      if (take <= 0) continue;
      m[g.productId] = take;
      remaining -= take;
      _giftProductByRule[rule.ruleId] = g.productId;
    }
    if (remaining > 0) {
      final fallback = sorted.first;
      m[fallback.productId] = (m[fallback.productId] ?? 0) + remaining;
      _giftProductByRule[rule.ruleId] = fallback.productId;
    }
  }

  void _applyComputedBonusQty() {
    for (final rule in _preview.eligibleBonuses) {
      final earned = _earnedBonusQty(rule);
      if (earned <= 0) continue;
      final m = _qtyMapForRule(rule.ruleId);
      for (final k in m.keys.toList()) {
        m[k] = 0;
      }
      if (_supportsMultiGiftPick(rule)) {
        _distributeBonusByStock(rule, m, earned);
        continue;
      }
      if (_hasPerSkuBonusPlan(rule)) {
        _applyAssortmentAutoGifts(rule, m);
        continue;
      }
      if (rule.allowGiftSwap) {
        final pid = _giftProductByRule[rule.ruleId] ??
            rule.defaultGiftProductId ??
            (rule.giftProducts.isNotEmpty ? rule.giftProducts.first.productId : null);
        if (pid != null) {
          m[pid] = earned;
          _giftProductByRule[rule.ruleId] = pid;
        }
        continue;
      }
      if (rule.bonusQty > 0) {
        final pid = rule.defaultGiftProductId ??
            (rule.giftProducts.isNotEmpty ? rule.giftProducts.first.productId : null);
        if (pid != null) {
          m[pid] = earned;
          _giftProductByRule[rule.ruleId] = pid;
        }
        continue;
      }
      var remaining = earned;
      for (final g in _preview.autoApplyGifts) {
        if (remaining <= 0) break;
        if (!rule.giftProducts.any((p) => p.productId == g.productId)) continue;
        final take = g.qty.clamp(0, remaining);
        if (take <= 0) continue;
        m[g.productId] = take;
        _giftProductByRule[rule.ruleId] = g.productId;
        remaining -= take;
      }
      if (remaining > 0) {
        final pid = rule.defaultGiftProductId ??
            (rule.giftProducts.isNotEmpty ? rule.giftProducts.first.productId : null);
        if (pid != null) {
          m[pid] = remaining;
          _giftProductByRule[rule.ruleId] = pid;
        }
      }
    }
  }

  void _applyAutoBonusSelections() {
    _applyComputedBonusQty();
    for (final rule in _preview.eligibleBonuses) {
      if (!_preview.autoApplyRuleIds.contains(rule.ruleId)) continue;
      final earned = _earnedBonusQty(rule);
      if (earned <= 0) continue;
      final m = _qtyMapForRule(rule.ruleId);
      for (final k in m.keys.toList()) {
        m[k] = 0;
      }

      if (rule.isAssortmentAuto || _hasPerSkuBonusPlan(rule)) {
        _applyAssortmentAutoGifts(rule, m);
        continue;
      }
      if (_supportsMultiGiftPick(rule)) {
        _distributeBonusByStock(rule, m, earned);
        continue;
      }

      var remaining = earned;
      for (final g in _preview.autoApplyGifts) {
        if (remaining <= 0) break;
        if (!rule.giftProducts.any((p) => p.productId == g.productId)) continue;
        final take = g.qty.clamp(0, remaining);
        if (take <= 0) continue;
        m[g.productId] = take;
        _giftProductByRule[rule.ruleId] = g.productId;
        remaining -= take;
      }
      if (remaining > 0) {
        final pid = rule.defaultGiftProductId ??
            (rule.giftProducts.isNotEmpty ? rule.giftProducts.first.productId : null);
        if (pid != null) {
          m[pid] = remaining;
          _giftProductByRule[rule.ruleId] = pid;
        }
      }
    }
  }

  Map<int, int> _qtyMapForRule(int ruleId) =>
      _giftQtyByRule.putIfAbsent(ruleId, () => <int, int>{});

  int _giftQtyFor(OrderBonusPreviewRule rule, int productId) =>
      _qtyMapForRule(rule.ruleId)[productId] ?? 0;

  int _giftStockShortage(OrderBonusPreviewRule rule, GiftProductPreview g) =>
      bonusStockShortage(
        stockAvailable: g.stockAvailable,
        giftQty: _giftQtyFor(rule, g.productId),
      );

  bool _ruleHasStockShortage(OrderBonusPreviewRule rule) => hasAnyBonusStockShortage(
        lines: [
          for (final g in rule.giftProducts)
            (stockAvailable: g.stockAvailable, giftQty: _giftQtyFor(rule, g.productId)),
        ],
      );

  bool _discountRuleHasWarning(OrderDiscountPreviewRule d) {
    if (_discountMode == DiscountMode.none) return false;
    if (!_preview.discountCashDeskAvailable) return true;

    final applies = _discountMode == DiscountMode.auto
        ? _preview.autoDiscountRuleId == d.ruleId
        : _selectedDiscountRuleId == d.ruleId;
    if (_discountMode == DiscountMode.manual && !applies) return false;

    if (!_canApplyLinkedDiscount()) return true;
    if ((_preview.discountSum ?? 0) <= 0) return true;
    return false;
  }

  String _discountWarningMessage(OrderDiscountPreviewRule d) {
    if (!_preview.discountCashDeskAvailable) return S.discountCashDeskMissing;
    if (!_canApplyLinkedDiscount()) return S.discountLinkBonusRequired;
    return S.discountNotApplied;
  }

  bool get _discountSectionHasWarning {
    if (_discountMode == DiscountMode.none) return false;
    final discounts = _applicableDiscounts();
    if (discounts.isEmpty) return false;
    if (!_preview.discountCashDeskAvailable) return true;
    if (_discountMode == DiscountMode.auto && _preview.autoDiscountRuleId == null) return true;
    return discounts.any(_discountRuleHasWarning);
  }

  Widget _warningIcon() => const _BonusStockWarningIcon();

  Widget _giftStockSubtitle(OrderBonusPreviewRule rule, GiftProductPreview g, {int? maxQty}) {
    final avail = bonusStockAvailable(g.stockAvailable).round();
    final shortage = _giftStockShortage(rule, g);
    final parts = <String>['${S.bonusStockAvailable}: $avail'];
    if (maxQty != null) {
      parts.add('${S.bonusQtyShort}: $maxQty');
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          parts.join(' · '),
          style: AppTypography.bodySmall.copyWith(
            color: shortage > 0 ? AppColors.error : Colors.grey.shade600,
          ),
        ),
        if (shortage > 0)
          Text(
            '${S.bonusStockShortage}: $shortage',
            style: AppTypography.bodySmall.copyWith(
              color: AppColors.error,
              fontWeight: FontWeight.w600,
            ),
          ),
      ],
    );
  }

  void _initGiftDefaults(OrderBonusPreviewRule rule) {
    final defaultPid = rule.defaultGiftProductId ??
        (rule.giftProducts.isNotEmpty ? rule.giftProducts.first.productId : null);
    if (defaultPid != null) {
      _giftProductByRule[rule.ruleId] ??= defaultPid;
    }
    final m = _qtyMapForRule(rule.ruleId);
    for (final g in rule.giftProducts) {
      m[g.productId] ??= 0;
    }
  }

  OrderBonusPreview _normalizePreview(OrderBonusPreview parsed) {
    var bonuses = parsed.eligibleBonuses;
    final giftQty = parsed.autoApplyGifts.fold<int>(0, (s, g) => s + g.qty);
    if (giftQty <= 0) return parsed;

    GiftProductPreview giftFromAuto(AutoApplyBonusGift g) {
      for (final rule in bonuses) {
        for (final p in rule.giftProducts) {
          if (p.productId == g.productId) return p;
        }
      }
      return GiftProductPreview(
        productId: g.productId,
        name: '#${g.productId}',
        stockAvailable: 0,
        purchasedQty: 0,
        bonusQty: 0,
      );
    }

    if (bonuses.isEmpty) {
      final ruleId = parsed.autoApplyRuleIds.isNotEmpty ? parsed.autoApplyRuleIds.first : 0;
      bonuses = [
        OrderBonusPreviewRule(
          ruleId: ruleId,
          name: 'Bonus',
          type: 'qty',
          bonusQty: giftQty.toDouble(),
          maxBonusQty: giftQty.toDouble(),
          giftSelectionKind: 'assortment_auto',
          giftProducts: parsed.autoApplyGifts.map(giftFromAuto).toList(),
        ),
      ];
      return OrderBonusPreview(
        bonusStackMode: parsed.bonusStackMode,
        eligibleBonuses: bonuses,
        eligibleDiscounts: parsed.eligibleDiscounts,
        linkedPairs: parsed.linkedPairs,
        autoApplyRuleIds: parsed.autoApplyRuleIds,
        autoApplyGifts: parsed.autoApplyGifts,
        autoDiscountRuleId: parsed.autoDiscountRuleId,
        autoDiscountPct: parsed.autoDiscountPct,
        discountSum: parsed.discountSum,
        expectedDiscountSum: parsed.expectedDiscountSum,
        discountCashDeskAvailable: parsed.discountCashDeskAvailable,
      );
    }

    bonuses = bonuses.map((rule) {
      if (rule.bonusQty > 0) return rule;
      if (parsed.autoApplyRuleIds.isNotEmpty && !parsed.autoApplyRuleIds.contains(rule.ruleId)) {
        return rule;
      }
      final gifts = rule.giftProducts.isNotEmpty
          ? rule.giftProducts
          : parsed.autoApplyGifts.map(giftFromAuto).toList();
      final ruleGiftQty = gifts.fold<int>(0, (s, g) => s + g.bonusQty.round());
      final effectiveGiftQty = ruleGiftQty > 0 ? ruleGiftQty : giftQty;
      return OrderBonusPreviewRule(
        ruleId: rule.ruleId,
        name: rule.name,
        type: rule.type,
        bonusQty: effectiveGiftQty.toDouble(),
        maxBonusQty: effectiveGiftQty.toDouble(),
        defaultGiftProductId: rule.defaultGiftProductId ?? gifts.firstOrNull?.productId,
        giftSelectionKind: rule.giftSelectionKind == 'fixed' ? 'assortment_auto' : rule.giftSelectionKind,
        allowGiftSwap: rule.allowGiftSwap,
        giftProducts: gifts,
      );
    }).toList();

    return OrderBonusPreview(
      bonusStackMode: parsed.bonusStackMode,
      eligibleBonuses: bonuses,
      eligibleDiscounts: parsed.eligibleDiscounts,
      linkedPairs: parsed.linkedPairs,
      autoApplyRuleIds: parsed.autoApplyRuleIds,
      autoApplyGifts: parsed.autoApplyGifts,
      autoDiscountRuleId: parsed.autoDiscountRuleId,
      autoDiscountPct: parsed.autoDiscountPct,
      discountSum: parsed.discountSum,
      expectedDiscountSum: parsed.expectedDiscountSum,
      discountCashDeskAvailable: parsed.discountCashDeskAvailable,
    );
  }

  List<OrderBonusPreviewRule> _dedupeEligibleBonuses(List<OrderBonusPreviewRule> rules) {
    final byId = <int, OrderBonusPreviewRule>{};
    for (final r in rules) {
      final prev = byId[r.ruleId];
      if (prev == null) {
        byId[r.ruleId] = r;
        continue;
      }
      final gifts = <int, GiftProductPreview>{};
      for (final g in prev.giftProducts) {
        gifts[g.productId] = g;
      }
      for (final g in r.giftProducts) {
        final prevG = gifts[g.productId];
        if (prevG == null) {
          gifts[g.productId] = g;
          continue;
        }
        gifts[g.productId] = GiftProductPreview(
          productId: g.productId,
          name: g.name,
          categoryName: g.categoryName,
          stockAvailable: g.stockAvailable,
          purchasedQty: g.purchasedQty > prevG.purchasedQty ? g.purchasedQty : prevG.purchasedQty,
          bonusQty: prevG.bonusQty + g.bonusQty,
        );
      }
      final prevMax = prev.maxBonusQty ?? prev.bonusQty;
      final rowMax = r.maxBonusQty ?? r.bonusQty;
      byId[r.ruleId] = OrderBonusPreviewRule(
        ruleId: r.ruleId,
        name: r.name,
        type: r.type,
        bonusQty: prev.bonusQty + r.bonusQty,
        maxBonusQty: prevMax + rowMax,
        defaultGiftProductId: prev.defaultGiftProductId ?? r.defaultGiftProductId,
        giftSelectionKind: r.giftSelectionKind,
        allowGiftSwap: r.allowGiftSwap,
        stepQty: r.stepQty ?? prev.stepQty,
        bonusStepQty: r.bonusStepQty ?? prev.bonusStepQty,
        triggerProductIds: r.triggerProductIds.isNotEmpty ? r.triggerProductIds : prev.triggerProductIds,
        giftProducts: gifts.values.toList(),
      );
    }
    return byId.values.toList();
  }

  Map<String, List<GiftProductPreview>> _groupGiftProducts(OrderBonusPreviewRule rule) {
    final grouped = <String, List<GiftProductPreview>>{};
    for (final g in rule.giftProducts) {
      final cat = g.categoryName?.trim();
      final key = (cat != null && cat.isNotEmpty) ? cat : S.noCategory;
      grouped.putIfAbsent(key, () => []).add(g);
    }
    return grouped;
  }

  void _switchSection(int section) {
    if (section == _activeSection) return;
    setState(() {
      _slideForward = section > _activeSection;
      _activeSection = section;
    });
  }

  void _onBonusModeChanged(BonusMode? v) {
    if (v == null) return;
    setState(() {
      _bonusMode = v;
      if (v == BonusMode.auto) {
        _applyAutoBonusSelections();
        final ids = _preview.autoApplyRuleIds;
        if (ids.isNotEmpty) {
          _selectedBonusRuleId = ids.first;
        }
      } else if (v == BonusMode.none) {
        for (final rule in _preview.eligibleBonuses) {
          final m = _giftQtyByRule[rule.ruleId];
          if (m != null) {
            for (final k in m.keys.toList()) {
              m[k] = 0;
            }
          }
        }
        _selectedBonusRuleId = null;
      }
      if (_discountMode == DiscountMode.manual && !_canUseBoth) {
        _discountMode = DiscountMode.auto;
        _selectedDiscountRuleId = null;
      }
    });
  }

  void _onDiscountModeChanged(DiscountMode? v) {
    if (v == null || _discountSectionDisabled) return;
    setState(() {
      _discountMode = v;
      if (v != DiscountMode.manual) _selectedDiscountRuleId = null;
      if (v == DiscountMode.manual && !_canUseBoth) {
        _bonusMode = BonusMode.auto;
        _selectedBonusRuleId = null;
      }
    });
  }

  /// Zakaz bo‘yicha hisoblangan bonus dona (6+1 assortiment: har SKU alohida, jami yig‘indi).
  int _earnedBonusQty(OrderBonusPreviewRule rule) {
    if (_hasPerSkuBonusPlan(rule)) {
      final orderQty = _orderQtyByProduct();
      var fromGifts = 0;
      for (final g in _assortmentGiftProducts(rule)) {
        fromGifts += _assortmentBonusForGift(rule, g, orderQty);
      }
      if (fromGifts > 0) {
        final cap = rule.maxBonusQty?.round();
        if (cap != null && cap > 0) return cap < fromGifts ? cap : fromGifts;
        return fromGifts;
      }
    }
    var earned = rule.bonusQty.round();
    if (earned <= 0 &&
        _preview.autoApplyRuleIds.contains(rule.ruleId) &&
        _preview.autoApplyGifts.isNotEmpty) {
      earned = _preview.autoApplyGifts.fold(0, (s, g) => s + g.qty);
    }
    if (earned <= 0) return 0;
    final cap = rule.maxBonusQty?.round();
    if (cap != null && cap > 0) return cap < earned ? cap : earned;
    return earned;
  }

  int _maxGiftQty(OrderBonusPreviewRule rule) => _earnedBonusQty(rule);

  int _selectedGiftTotal(OrderBonusPreviewRule rule) {
    var total = 0;
    for (final g in rule.giftProducts) {
      total += _giftQtyFor(rule, g.productId);
    }
    return total;
  }

  List<BonusGiftOverrideInput> _buildGiftOverrides() {
    if (_bonusMode == BonusMode.none) return const [];
    final lineRuleIds = _buildGiftLines().map((l) => l.bonusRuleId).toSet();
    final out = <BonusGiftOverrideInput>[];
    for (final rule in preview.eligibleBonuses) {
      if (lineRuleIds.contains(rule.ruleId)) continue;
      if (_bonusMode == BonusMode.auto && !_preview.autoApplyRuleIds.contains(rule.ruleId)) {
        continue;
      }
      // Faqat swap ruxsat etilgan qoidalarda override yuboriladi.
      // assortment_auto / category_stock / fixed — server o‘zi hisoblaydi;
      // aks holda bo‘sh allowed ro‘yxat bilan BadBonusGiftOverride chiqadi.
      if (!rule.allowGiftSwap || rule.isLockedAutoGift) continue;
      if (_supportsMultiGiftPick(rule)) continue;
      var bestPid = _giftProductByRule[rule.ruleId];
      var bestQty = bestPid != null ? _giftQtyFor(rule, bestPid) : 0;
      for (final g in rule.giftProducts) {
        final q = _giftQtyFor(rule, g.productId);
        if (q > bestQty) {
          bestQty = q;
          bestPid = g.productId;
        }
      }
      if (bestPid != null && bestPid > 0 && bestQty > 0) {
        out.add(BonusGiftOverrideInput(bonusRuleId: rule.ruleId, bonusProductId: bestPid));
      }
    }
    return out;
  }

  List<BonusGiftLineInput> _buildGiftLines() {
    if (_bonusMode == BonusMode.none) return const [];
    final out = <BonusGiftLineInput>[];
    for (final rule in preview.eligibleBonuses) {
      if (_bonusMode == BonusMode.auto && !_preview.autoApplyRuleIds.contains(rule.ruleId)) {
        continue;
      }
      if (!_supportsMultiGiftPick(rule)) continue;
      for (final g in rule.giftProducts) {
        final q = _giftQtyFor(rule, g.productId);
        if (q > 0) {
          out.add(BonusGiftLineInput(bonusRuleId: rule.ruleId, productId: g.productId, qty: q));
        }
      }
    }
    return out;
  }

  OrderBonusDiscountResult _buildResult() {
    final applyBonus = _bonusMode != BonusMode.none;
    final applyDiscount = _discountMode != DiscountMode.none;
    return OrderBonusDiscountResult(
      bonusMode: _bonusMode,
      discountMode: _discountMode,
      applyBonus: applyBonus,
      applyDiscount: applyDiscount,
      giftOverrides: _buildGiftOverrides(),
      giftLines: _buildGiftLines(),
      bonusShortageComment: _buildBonusShortageComment(),
      discountShortageComment: _buildDiscountShortageComment(),
    );
  }

  String _buildDiscountShortageComment() {
    if (_discountMode == DiscountMode.none) return '';
    final discounts = _applicableDiscounts();
    if (discounts.isEmpty) return '';

    final applied =
        _preview.discountCashDeskAvailable &&
        _canApplyLinkedDiscount() &&
        (_preview.discountSum ?? 0) > 0;
    if (applied) return '';

    OrderDiscountPreviewRule? activeRule;
    if (_discountMode == DiscountMode.auto) {
      final autoId = _preview.autoDiscountRuleId;
      if (autoId != null) {
        for (final d in discounts) {
          if (d.ruleId == autoId) {
            activeRule = d;
            break;
          }
        }
      }
      activeRule ??= discounts.isNotEmpty ? discounts.first : null;
    } else {
      final sel = _selectedDiscountRuleId;
      if (sel != null) {
        for (final d in discounts) {
          if (d.ruleId == sel) {
            activeRule = d;
            break;
          }
        }
      }
      activeRule ??= discounts.isNotEmpty ? discounts.first : null;
    }

    final pct = activeRule?.discountPct ?? _preview.autoDiscountPct;
    final expectedSum = (_preview.expectedDiscountSum ?? _preview.discountSum ?? 0).toDouble();

    String reasonKey;
    if (!_preview.discountCashDeskAvailable) {
      reasonKey = 'cash_desk_missing';
    } else if (!_canApplyLinkedDiscount()) {
      reasonKey = 'bonus_required';
    } else {
      reasonKey = 'not_applied';
    }

    return buildDiscountShortageComment(
      reasonKey: reasonKey,
      discountPct: pct,
      expectedSum: expectedSum,
    );
  }

  String _buildBonusShortageComment() {
    if (_bonusMode == BonusMode.none) return '';
    final lines = <({String productName, int shortage})>[];
    for (final rule in _preview.eligibleBonuses) {
      for (final g in rule.giftProducts) {
        final shortage = _giftStockShortage(rule, g);
        if (shortage > 0) {
          lines.add((productName: g.name, shortage: shortage));
        }
      }
    }
    return buildBonusShortageComment(lines: lines);
  }

  Widget _sectionTab({
    required int index,
    required String label,
    required bool disabled,
    bool showWarning = false,
  }) {
    final selected = _activeSection == index;
    final isBonus = index == 0;
    final accent = isBonus ? AppColors.bonusAccent : AppColors.discAccent;
    final ink = isBonus ? AppColors.bonusInk : AppColors.discInk;
    final bg = isBonus ? AppColors.bonusBg : AppColors.discBg;
    final border = isBonus ? AppColors.bonusBg2 : AppColors.discBg2;
    return Expanded(
      child: InkWell(
        onTap: disabled ? null : () => _switchSection(index),
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
          decoration: BoxDecoration(
            color: selected ? bg : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: selected ? accent : border),
          ),
          alignment: Alignment.center,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(isBonus ? '🎁' : '🏷', style: const TextStyle(fontSize: 13)),
              const SizedBox(width: 5),
              Flexible(
                child: Text(
                  label,
                  style: AppTypography.bodyMedium.copyWith(
                    color: disabled
                        ? Colors.grey
                        : (selected ? ink : AppColors.textSecondary),
                    fontWeight: selected ? FontWeight.w800 : FontWeight.w500,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (showWarning) ...[
                const SizedBox(width: 4),
                const SizedBox(
                  width: 18,
                  height: 18,
                  child: CustomPaint(painter: _BonusStockWarningIconPainter()),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  int _totalOrderQty() => widget.items.fold<int>(0, (s, i) => s + i.qty.round());

  int _ruleTriggerQty(OrderBonusPreviewRule rule) {
    final orderQty = _orderQtyByProduct();
    if (rule.triggerProductIds.isEmpty) return _totalOrderQty();
    var sum = 0;
    for (final pid in rule.triggerProductIds) {
      sum += orderQty[pid] ?? 0;
    }
    return sum;
  }

  List<Map<String, dynamic>> _bonusTiersForRule(OrderBonusPreviewRule rule) {
    final step = rule.stepQty ?? _inferStepQty(rule);
    final perStep = rule.bonusStepQty ?? _inferBonusStepQty(rule);
    if (step != null && step > 0 && perStep > 0) {
      final maxBonus = (rule.maxBonusQty ?? rule.bonusQty).round();
      final cap = maxBonus > 0 ? maxBonus : perStep * 3;
      final tiers = <Map<String, dynamic>>[];
      var qty = step;
      var bonus = perStep;
      var prevBonus = 0;
      while (bonus <= cap && tiers.length < 5) {
        tiers.add({
          'qty': qty,
          'reward': '+${bonus}шт',
          'increment': '+${bonus - prevBonus}шт',
        });
        prevBonus = bonus;
        qty += step;
        bonus += perStep;
      }
      if (tiers.isNotEmpty) return tiers;
    }
    final earned = rule.bonusQty.round();
    if (earned > 0) {
      return [
        {
          'qty': step ?? 1,
          'reward': '+${earned}шт',
          'increment': '+${earned}шт',
        },
      ];
    }
    return const [];
  }

  /// Pog‘ona chizig‘i uchun trigger mahsulotlar yig‘indisi.
  int _bonusProgressQty(OrderBonusPreviewRule rule) => _ruleTriggerQty(rule);

  /// Assortiment (5+1) uchun eng yaqin keyingi pog‘ona.
  String? _bonusNextHint(OrderBonusPreviewRule rule) {
    final step = rule.stepQty ?? _inferStepQty(rule);
    if (step == null || step <= 0) return null;
    final perStep = rule.bonusStepQty ?? _inferBonusStepQty(rule);
    if (!_hasPerSkuBonusPlan(rule)) return null;

    final orderQty = _orderQtyByProduct();
    final maxBonus = rule.maxBonusQty?.round();
    var bestRemaining = 999999;
    var bestIncrement = perStep;
    var found = false;

    for (final g in _assortmentGiftProducts(rule)) {
      final ordered = orderQty[g.productId] ?? g.purchasedQty.round();
      if (ordered <= 0) continue;
      final currentBonus = ordered ~/ step;
      if (maxBonus != null && maxBonus > 0 && currentBonus >= maxBonus) continue;
      final nextThreshold = (currentBonus + 1) * step;
      final remaining = nextThreshold - ordered;
      if (remaining > 0 && remaining < bestRemaining) {
        bestRemaining = remaining;
        bestIncrement = perStep;
        found = true;
      }
    }
    if (!found) return null;
    return 'ещё $bestRemaining шт → +$bestIncrement шт';
  }

  /// Faqat qty > 0 bo‘lgan sovg‘alar, productId bo‘yicha yagona.
  List<({GiftProductPreview g, int qty})> _activeGiftLines(OrderBonusPreviewRule rule) {
    final orderQty = _orderQtyByProduct();
    final byId = <int, ({GiftProductPreview g, int qty})>{};
    final gifts = _hasPerSkuBonusPlan(rule) ? _assortmentGiftProducts(rule) : rule.giftProducts;
    for (final g in gifts) {
      var qty = _giftQtyFor(rule, g.productId);
      if (qty <= 0 && _hasPerSkuBonusPlan(rule)) {
        qty = _assortmentBonusForGift(rule, g, orderQty);
      }
      if (qty <= 0) continue;
      final prev = byId[g.productId];
      byId[g.productId] = prev == null ? (g: g, qty: qty) : (g: g, qty: prev.qty + qty);
    }
    return byId.values.toList();
  }

  int _discountTierBaseQty() {
    for (final b in _bonusTabRules()) {
      final step = b.stepQty;
      if (step != null && step > 0) return step;
    }
    return 12;
  }

  List<Map<String, dynamic>> _discountTiers() {
    final discounts = [..._applicableDiscounts()];
    discounts.sort((a, b) => (a.discountPct ?? 0).compareTo(b.discountPct ?? 0));
    if (discounts.isEmpty) return const [];
    final base = _discountTierBaseQty();
    return discounts.asMap().entries.map((e) {
      final d = e.value;
      final pct = d.discountPct?.toStringAsFixed(0) ?? '0';
      return {'qty': base * (e.key + 1), 'reward': '-$pct%'};
    }).toList();
  }

  Widget _compactModeRadio<T>({
    required T value,
    required T? groupValue,
    required String label,
    required ValueChanged<T?>? onChanged,
  }) {
    return InkWell(
      onTap: onChanged == null ? null : () => onChanged(value),
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Radio<T>(
              value: value,
              groupValue: groupValue,
              onChanged: onChanged,
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
              visualDensity: VisualDensity.compact,
            ),
            Expanded(
              child: Text(
                label,
                style: AppTypography.bodySmall,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _horizontalModeRadios<T>({
    required List<({T value, String label})> options,
    required T? groupValue,
    required ValueChanged<T?>? onChanged,
  }) {
    if (options.isEmpty) return const SizedBox.shrink();
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < options.length; i++) ...[
          if (i > 0) const SizedBox(width: 4),
          Expanded(
            child: _compactModeRadio<T>(
              value: options[i].value,
              groupValue: groupValue,
              label: options[i].label,
              onChanged: onChanged,
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildBonusSection() {
    final modeOptions = <({BonusMode value, String label})>[];
    if (_bonusModeAllowed(BonusMode.auto)) {
      modeOptions.add((value: BonusMode.auto, label: S.bonusAuto));
    }
    if (_bonusModeAllowed(BonusMode.none)) {
      modeOptions.add((value: BonusMode.none, label: S.bonusNone));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _horizontalModeRadios<BonusMode>(
          options: modeOptions,
          groupValue: _bonusMode,
          onChanged: _bonusSectionDisabled ? null : _onBonusModeChanged,
        ),
        if (_bonusMode == BonusMode.auto) ...[
          const SizedBox(height: 8),
          if (preview.eligibleBonuses.isEmpty)
            const AgentEmptyState(message: S.emptyBonuses)
          else if (_bonusTabRules().isNotEmpty)
            for (final rule in _bonusTabRules()) _bonusRuleBlock(
                  rule,
                  expandedRuleIds: _expandedBonusRuleIds,
                  onToggleExpanded: _toggleBonusRuleExpanded,
                  sectionDisabled: _bonusSectionDisabled,
                ),
        ],
      ],
    );
  }

  /// Faqat backend `allow_gift_swap=true` deb belgilagan holatlarda (2+ qat'iy
  /// belgilangan `bonus_product_ids`) mijoz/agent sovg'a mahsulotini tanlashi
  /// yoki miqdorlarni mahsulotlar orasida ko'chirishi mumkin. `assortment_auto`
  /// (har trigger-mahsulot o'zining sovg'asiga qulflangan) va `category_stock`
  /// (ombor qoldig'i bo'yicha avtomatik) holatlarida bu HAR DOIM `false` —
  /// hatto bir nechta sovg'a mahsuloti ro'yxatda ko'rinsa ham, ular
  /// o'zgartirib bo'lmaydigan (locked) qatorlar sifatida ko'rsatiladi.
  bool _supportsMultiGiftPick(OrderBonusPreviewRule rule) {
    if (rule.giftProducts.length <= 1) return false;
    return rule.allowGiftSwap;
  }

  bool _ruleExpanded(int ruleId, Set<int> expandedRuleIds) => expandedRuleIds.contains(ruleId);

  void _toggleBonusRuleExpanded(int ruleId) {
    setState(() {
      if (_expandedBonusRuleIds.contains(ruleId)) {
        _expandedBonusRuleIds.remove(ruleId);
      } else {
        _expandedBonusRuleIds
          ..clear()
          ..add(ruleId);
      }
    });
  }

  bool _canIncreaseGiftQty(OrderBonusPreviewRule rule, int productId) {
    final m = _qtyMapForRule(rule.ruleId);
    final maxQty = _maxGiftQty(rule);
    final qty = m[productId] ?? 0;
    final otherTotal = rule.giftProducts
        .where((g) => g.productId != productId)
        .fold<int>(0, (s, g) => s + (m[g.productId] ?? 0));
    if (qty + otherTotal < maxQty) return true;
    return otherTotal > 0;
  }

  void _setGiftQty(OrderBonusPreviewRule rule, int productId, int qty) {
    final maxQty = _maxGiftQty(rule);
    final m = _qtyMapForRule(rule.ruleId);
    final manual = _manualGiftByRule.putIfAbsent(rule.ruleId, () => <int>{});
    final oldQty = m[productId] ?? 0;
    final targetQty = resolveGiftQtyWithRedistribution(
      qtyByProduct: m,
      productId: productId,
      requestedQty: qty,
      maxTotal: maxQty,
      manualProductIds: manual,
    );
    setState(() {
      m[productId] = targetQty;
      if (targetQty != oldQty) {
        manual.add(productId);
      }
      if (targetQty > 0) {
        _giftProductByRule[rule.ruleId] = productId;
      }
    });
  }

  Widget _compactGiftLine(OrderBonusPreviewRule rule, GiftProductPreview g, int qty) {
    final shortage = _giftStockShortage(rule, g);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Expanded(
            child: Text(
              g.name,
              style: AppTypography.bodySmall.copyWith(
                fontWeight: FontWeight.w600,
                fontSize: 13.5,
                height: 1.25,
                color: shortage > 0 ? AppColors.error : AppColors.bonusInk,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            '×$qty',
            style: TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w800,
              height: 1.25,
              color: shortage > 0 ? AppColors.error : AppColors.bonusAccent,
            ),
          ),
        ],
      ),
    );
  }

  /// Yig‘ilgan va ochilgan / surilish holatida bir xil padding / qatorlar.
  Widget _bonusGiftLinesReadOnly(OrderBonusPreviewRule rule) {
    final lines = _activeGiftLines(rule);
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(color: AppColors.bonusBg2.withValues(alpha: 0.85)),
        ),
      ),
      padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (lines.isEmpty)
            Text(
              S.emptyBonuses,
              style: AppTypography.caption.copyWith(color: Colors.grey.shade600),
            )
          else
            for (final line in lines) _compactGiftLine(rule, line.g, line.qty),
          if (_ruleHasStockShortage(rule)) ...[
            const SizedBox(height: 2),
            Align(alignment: Alignment.centerRight, child: _warningIcon()),
          ],
        ],
      ),
    );
  }

  Widget _bonusRuleBlock(
    OrderBonusPreviewRule rule, {
    required Set<int> expandedRuleIds,
    required void Function(int ruleId) onToggleExpanded,
    required bool sectionDisabled,
  }) {
    final maxQty = _maxGiftQty(rule);
    final selectedTotal = _selectedGiftTotal(rule);
    final grouped = _groupGiftProducts(rule);
    final expanded = _ruleExpanded(rule.ruleId, expandedRuleIds);
    final multiPick = _supportsMultiGiftPick(rule);
    final activeLines = _activeGiftLines(rule);
    final showGiftDetails = activeLines.isNotEmpty || multiPick;
    // Oddiy/locked: doimo bir xil read-only qator (chevron yo‘q).
    // multiPick: yopiqda shu qatorlar, ochiqda qty tahrirlash.
    final canToggle = multiPick && showGiftDetails;
    final showReadOnlyLines = showGiftDetails && (!multiPick || !expanded);
    final showEditors = canToggle && expanded && maxQty > 0;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: AppColors.bonusBg.withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.bonusBg2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: canToggle ? () => onToggleExpanded(rule.ruleId) : null,
            child: AgentTierStrip(
              kind: 'bonus',
              currentQty: _bonusProgressQty(rule),
              tiers: _bonusTiersForRule(rule),
              subtitle: rule.name,
              earnedBonusQty: selectedTotal > 0 ? selectedTotal : _earnedBonusQty(rule),
              maxBonusQty: maxQty > 0 ? maxQty : null,
              nextHintOverride: _bonusNextHint(rule),
              embedded: true,
              compact: true,
              trailing: canToggle
                  ? Icon(
                      expanded ? Icons.expand_less : Icons.expand_more,
                      size: 22,
                      color: AppColors.bonusInk,
                    )
                  : null,
            ),
          ),
          AnimatedSize(
            duration: const Duration(milliseconds: 280),
            curve: Curves.easeOutCubic,
            alignment: Alignment.topCenter,
            child: showReadOnlyLines
                ? _bonusGiftLinesReadOnly(rule)
                : (showEditors
                    ? Padding(
                        padding: const EdgeInsets.fromLTRB(10, 0, 10, 10),
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxHeight: 140),
                          child: rule.giftProducts.isEmpty
                              ? Text(
                                  S.emptyBonuses,
                                  style: AppTypography.caption.copyWith(color: Colors.grey.shade600),
                                )
                              : ListView(
                                  shrinkWrap: true,
                                  padding: EdgeInsets.zero,
                                  children: [
                                    Text(
                                      S.bonusDistributeHint,
                                      style: AppTypography.caption.copyWith(
                                        color: AppColors.textMuted,
                                        fontSize: 10.5,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    for (final entry in grouped.entries) ...[
                                      if (grouped.length > 1)
                                        Padding(
                                          padding: const EdgeInsets.only(top: 2, bottom: 2),
                                          child: Text(
                                            entry.key,
                                            style: AppTypography.caption.copyWith(
                                              fontWeight: FontWeight.w700,
                                              color: AppColors.bonusInk,
                                            ),
                                          ),
                                        ),
                                      for (final g in entry.value)
                                        _giftProductQtyRow(
                                          rule,
                                          g,
                                          maxQty,
                                          sectionDisabled: sectionDisabled,
                                          compact: true,
                                        ),
                                      if (selectedTotal < maxQty)
                                        Padding(
                                          padding: const EdgeInsets.only(top: 2),
                                          child: Text(
                                            '${S.bonusEarnedHint}: ${maxQty - selectedTotal} ${S.bonusQtyShort.toLowerCase()}',
                                            style: AppTypography.caption.copyWith(
                                              color: AppColors.warning,
                                              fontSize: 10.5,
                                            ),
                                          ),
                                        ),
                                    ],
                                  ],
                                ),
                        ),
                      )
                    : const SizedBox.shrink()),
          ),
        ],
      ),
    );
  }

  Widget _giftProductQtyRow(
    OrderBonusPreviewRule rule,
    GiftProductPreview g,
    int maxQty, {
    required bool sectionDisabled,
    bool compact = false,
  }) {
    final qty = _giftQtyFor(rule, g.productId);
    final shortage = _giftStockShortage(rule, g);
    final canEdit = !sectionDisabled;
    final canIncrease = !sectionDisabled && _canIncreaseGiftQty(rule, g.productId);
    if (compact) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Row(
          children: [
            Expanded(
              child: Text(
                g.name,
                style: AppTypography.caption.copyWith(
                  fontWeight: FontWeight.w600,
                  color: shortage > 0 ? AppColors.error : AppColors.bonusInk,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            IconButton(
              visualDensity: VisualDensity.compact,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
              onPressed: !canEdit || qty <= 0 ? null : () => _setGiftQty(rule, g.productId, qty - 1),
              icon: const Icon(Icons.remove_circle_outline, size: 20),
            ),
            _GiftQtyField(
              qty: qty,
              enabled: canEdit,
              onCommit: (v) => _setGiftQty(rule, g.productId, v),
            ),
            IconButton(
              visualDensity: VisualDensity.compact,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
              onPressed: !canEdit || !canIncrease ? null : () => _setGiftQty(rule, g.productId, qty + 1),
              icon: const Icon(Icons.add_circle_outline, size: 20, color: AppColors.agentAccent),
            ),
          ],
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: shortage > 0 ? AppColors.error.withValues(alpha: 0.04) : Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: shortage > 0 ? AppColors.error.withValues(alpha: 0.35) : Colors.grey.shade200,
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(g.name, style: AppTypography.bodyMedium.copyWith(fontWeight: FontWeight.w500)),
                  const SizedBox(height: 4),
                  _giftStockSubtitle(rule, g),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  visualDensity: VisualDensity.compact,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                  onPressed: !canEdit || qty <= 0 ? null : () => _setGiftQty(rule, g.productId, qty - 1),
                  icon: const Icon(Icons.remove_circle_outline, size: 22),
                ),
                _GiftQtyField(
                  qty: qty,
                  enabled: canEdit,
                  onCommit: (v) => _setGiftQty(rule, g.productId, v),
                ),
                IconButton(
                  visualDensity: VisualDensity.compact,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                  onPressed: !canEdit || !canIncrease ? null : () => _setGiftQty(rule, g.productId, qty + 1),
                  icon: const Icon(Icons.add_circle_outline, size: 22, color: AppColors.agentAccent),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _giftProductReadOnlyRow(OrderBonusPreviewRule rule, GiftProductPreview g) {
    final orderQty = _orderQtyByProduct();
    var qty = _giftQtyFor(rule, g.productId);
    if (qty <= 0 && _hasPerSkuBonusPlan(rule)) {
      qty = _assortmentBonusForGift(rule, g, orderQty);
    }
    if (qty <= 0) return const SizedBox.shrink();
    final shortage = _giftStockShortage(rule, g);
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: shortage > 0 ? AppColors.error.withValues(alpha: 0.04) : Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: shortage > 0 ? AppColors.error.withValues(alpha: 0.35) : Colors.grey.shade200,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(g.name, style: AppTypography.bodyMedium.copyWith(fontWeight: FontWeight.w500)),
                const SizedBox(height: 4),
                _giftStockSubtitle(rule, g),
              ],
            ),
          ),
          Text(
            '× $qty',
            style: AppTypography.headlineSmall.copyWith(
              color: shortage > 0 ? AppColors.error : AppColors.agentAccent,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _discountPercentBlock(OrderDiscountPreviewRule d) {
    final pct = d.discountPct?.toStringAsFixed(0) ?? '0';
    final selected = _selectedDiscountRuleId == d.ruleId;
    final autoApplied =
        _discountMode == DiscountMode.auto && _preview.autoDiscountRuleId == d.ruleId;
    final warn = _discountRuleHasWarning(d);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: warn
              ? AppColors.error.withValues(alpha: 0.45)
              : selected || autoApplied
                  ? AppColors.discAccent
                  : AppColors.discBg2,
          width: selected || autoApplied || warn ? 1.5 : 1,
        ),
        color: warn ? AppColors.error.withValues(alpha: 0.04) : AppColors.discBg,
      ),
      child: InkWell(
        onTap: _discountSectionDisabled
            ? null
            : () => setState(() {
                  _selectedDiscountRuleId = d.ruleId;
                  _discountMode = DiscountMode.manual;
                }),
        borderRadius: BorderRadius.circular(11),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('🏷', style: TextStyle(fontSize: 16)),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      d.name,
                      style: AppTypography.bodyMedium.copyWith(
                        fontWeight: FontWeight.w700,
                        color: AppColors.discInk,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '-$pct%',
                      style: AppTypography.headlineSmall.copyWith(
                        color: warn ? AppColors.error : AppColors.discAccent,
                        fontWeight: FontWeight.w800,
                        fontSize: 20,
                      ),
                    ),
                    if (warn) ...[
                      const SizedBox(height: 4),
                      Text(
                        _discountWarningMessage(d),
                        style: AppTypography.caption.copyWith(color: AppColors.error),
                      ),
                    ],
                  ],
                ),
              ),
              if (warn)
                _warningIcon()
              else if (_discountMode == DiscountMode.manual)
                Radio<int>(
                  value: d.ruleId,
                  groupValue: _selectedDiscountRuleId,
                  activeColor: AppColors.discAccent,
                  onChanged: _discountSectionDisabled
                      ? null
                      : (v) => setState(() {
                            _selectedDiscountRuleId = v;
                            _discountMode = DiscountMode.manual;
                          }),
                )
              else if (autoApplied)
                const Icon(Icons.check_circle, color: AppColors.discAccent, size: 22),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDiscountSection() {
    final applicableDiscounts = _applicableDiscounts();
    final modeOptions = <({DiscountMode value, String label})>[
      (value: DiscountMode.auto, label: S.discountAuto),
      (value: DiscountMode.none, label: S.discountNone),
    ];
    if (applicableDiscounts.isNotEmpty) {
      modeOptions.add((value: DiscountMode.manual, label: S.discountManual));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _horizontalModeRadios<DiscountMode>(
          options: modeOptions,
          groupValue: _discountMode,
          onChanged: _discountSectionDisabled ? null : _onDiscountModeChanged,
        ),
        if (_discountMode == DiscountMode.manual || _discountMode == DiscountMode.auto) ...[
          const SizedBox(height: 8),
          if (applicableDiscounts.isEmpty)
            const AgentEmptyState(message: S.emptyDiscounts)
          else ...[
            AgentTierStrip(
              kind: 'discount',
              currentQty: _totalOrderQty(),
              tiers: _discountTiers(),
            ),
            const SizedBox(height: 6),
            for (final d in applicableDiscounts) _discountPercentBlock(d),
          ],
        ],
      ],
    );
  }

  Widget _buildSlidingContent() {
    final child = _activeSection == 0 ? _buildBonusSection() : _buildDiscountSection();
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 340),
      switchInCurve: Curves.easeOutCubic,
      switchOutCurve: Curves.easeInCubic,
      layoutBuilder: (currentChild, previousChildren) {
        return Stack(
          alignment: Alignment.topCenter,
          clipBehavior: Clip.none,
          children: <Widget>[
            ...previousChildren,
            if (currentChild != null) currentChild,
          ],
        );
      },
      transitionBuilder: (child, animation) {
        final curved = CurvedAnimation(parent: animation, curve: Curves.easeOutCubic);
        final begin = _slideForward ? const Offset(0.18, 0) : const Offset(-0.18, 0);
        return FadeTransition(
          opacity: curved,
          child: SlideTransition(
            position: Tween<Offset>(begin: begin, end: Offset.zero).animate(curved),
            child: child,
          ),
        );
      },
      child: KeyedSubtree(
        key: ValueKey<int>(_activeSection),
        child: child,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    final sheetHeight = (mq.size.height * 0.88).clamp(360.0, mq.size.height * 0.92);
    final hint = _canUseBoth ? S.linkedBonusDiscountHint : S.exclusiveBonusDiscountHint;

    return Padding(
      padding: EdgeInsets.only(bottom: mq.viewInsets.bottom),
      child: SizedBox(
        height: sheetHeight,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 8, bottom: 4),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 12, 0),
              child: Row(
                children: [
                  const Expanded(
                    child: Text(S.bonusDiscountAddTitle, style: AppTypography.headlineSmall),
                  ),
                  IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
              child: Row(
                children: [
                  _sectionTab(index: 0, label: S.bonusSection, disabled: _bonusSectionDisabled),
                  const SizedBox(width: 8),
                  _sectionTab(index: 1, label: S.discountSection, disabled: _discountSectionDisabled, showWarning: _discountSectionHasWarning),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
              child: Text(hint, style: AppTypography.bodySmall.copyWith(color: Colors.grey.shade700)),
            ),
            if (_previewError != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      _previewError!,
                      style: AppTypography.bodySmall.copyWith(color: AppColors.warning),
                    ),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(
                        onPressed: _loadingPreview
                            ? null
                            : () {
                                setState(() {
                                  _loadingPreview = true;
                                  _previewError = null;
                                });
                                _loadPreview();
                              },
                        icon: const Icon(Icons.refresh, size: 18),
                        label: const Text('Повторить'),
                      ),
                    ),
                  ],
                ),
              ),
            Expanded(
              child: _loadingPreview
                  ? const Center(child: CircularProgressIndicator(color: AppColors.agentAccent))
                  : SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
                      child: _buildSlidingContent(),
                    ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text(S.close),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.agentAccent,
                        foregroundColor: Colors.white,
                      ),
                      onPressed: _loadingPreview ? null : () => Navigator.pop(context, _buildResult()),
                      child: const Text(S.finish),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class AutoApplyBonusGift {
  final int productId;
  final int qty;

  const AutoApplyBonusGift({required this.productId, required this.qty});

  factory AutoApplyBonusGift.fromJson(Map<String, dynamic> j) => AutoApplyBonusGift(
        productId: (j['product_id'] as num?)?.toInt() ?? 0,
        qty: (j['qty'] as num?)?.toInt() ?? 0,
      );
}

class OrderBonusPreview {
  final String bonusStackMode;
  final List<OrderBonusPreviewRule> eligibleBonuses;
  final List<OrderDiscountPreviewRule> eligibleDiscounts;
  final List<LinkedBonusDiscountPair> linkedPairs;
  final List<int> autoApplyRuleIds;
  final List<AutoApplyBonusGift> autoApplyGifts;
  final int? autoDiscountRuleId;
  final double? autoDiscountPct;
  final double? discountSum;
  final double? expectedDiscountSum;
  final bool discountCashDeskAvailable;

  const OrderBonusPreview({
    required this.bonusStackMode,
    required this.eligibleBonuses,
    required this.eligibleDiscounts,
    required this.linkedPairs,
    this.autoApplyRuleIds = const [],
    this.autoApplyGifts = const [],
    this.autoDiscountRuleId,
    this.autoDiscountPct,
    this.discountSum,
    this.expectedDiscountSum,
    this.discountCashDeskAvailable = true,
  });

  factory OrderBonusPreview.fromJson(Map<String, dynamic> j) {
    List<T> mapList<T>(dynamic v, T Function(Map<String, dynamic>) fn) {
      if (v is! List) return [];
      return v
          .whereType<Map>()
          .map((e) => fn(Map<String, dynamic>.from(e)))
          .toList();
    }

    final stack = j['bonus_stack'];
    final mode = stack is Map ? stack['mode']?.toString() ?? 'all' : 'all';

    final auto = j['auto_apply'];
    final ruleIds = <int>[];
    final gifts = <AutoApplyBonusGift>[];
    int? autoDiscountRuleId;
    double? discountSum;
    double? autoDiscountPct;
    double? expectedDiscountSum;
    if (auto is Map) {
      final ids = auto['bonus_rule_ids'];
      if (ids is List) {
        for (final id in ids) {
          if (id is num && id.toInt() > 0) ruleIds.add(id.toInt());
        }
      }
      final gl = auto['bonus_gifts'];
      if (gl is List) {
        for (final g in gl) {
          if (g is Map) gifts.add(AutoApplyBonusGift.fromJson(Map<String, dynamic>.from(g)));
        }
      }
      final dr = auto['discount_rule_id'];
      if (dr is num && dr.toInt() > 0) autoDiscountRuleId = dr.toInt();
      final ds = auto['discount_sum'];
      if (ds is num) {
        discountSum = ds.toDouble();
      } else if (ds != null) {
        discountSum = double.tryParse(ds.toString());
      }
      final dp = auto['discount_pct'];
      if (dp is num) {
        autoDiscountPct = dp.toDouble();
      } else if (dp != null) {
        autoDiscountPct = double.tryParse(dp.toString());
      }
      final eds = auto['expected_discount_sum'];
      if (eds is num) {
        expectedDiscountSum = eds.toDouble();
      } else if (eds != null) {
        expectedDiscountSum = double.tryParse(eds.toString());
      }
    }

    final cashDeskRaw = j['discount_cash_desk_available'];
    final discountCashDeskAvailable = cashDeskRaw != false;

    return OrderBonusPreview(
      bonusStackMode: mode,
      eligibleBonuses: mapList(j['eligible_bonuses'], OrderBonusPreviewRule.fromJson),
      eligibleDiscounts: mapList(j['eligible_discounts'], OrderDiscountPreviewRule.fromJson),
      linkedPairs: _parseLinkedPairs(j),
      autoApplyRuleIds: ruleIds,
      autoApplyGifts: gifts,
      autoDiscountRuleId: autoDiscountRuleId,
      autoDiscountPct: autoDiscountPct,
      discountSum: discountSum,
      expectedDiscountSum: expectedDiscountSum,
      discountCashDeskAvailable: discountCashDeskAvailable,
    );
  }

  static List<LinkedBonusDiscountPair> _parseLinkedPairs(Map<String, dynamic> j) {
    final out = <LinkedBonusDiscountPair>[];
    final seen = <String>{};
    void addPair(int bonusId, int discountId) {
      if (bonusId <= 0 || discountId <= 0) return;
      final key = '$bonusId:$discountId';
      if (seen.contains(key)) return;
      seen.add(key);
      out.add(LinkedBonusDiscountPair(bonusRuleId: bonusId, discountRuleId: discountId));
    }

    for (final source in [j['linked_pairs'], j['links']]) {
      if (source is! List) continue;
      for (final item in source) {
        if (item is! Map) continue;
        final m = Map<String, dynamic>.from(item);
        addPair(
          (m['bonus_rule_id'] as num?)?.toInt() ?? 0,
          (m['discount_rule_id'] as num?)?.toInt() ?? 0,
        );
      }
    }
    return out;
  }

  factory OrderBonusPreview.empty() => const OrderBonusPreview(
        bonusStackMode: 'all',
        eligibleBonuses: [],
        eligibleDiscounts: [],
        linkedPairs: [],
        autoApplyRuleIds: [],
        autoApplyGifts: [],
      );
}

class OrderBonusPreviewRule {
  final int ruleId;
  final String name;
  final String type;
  final double bonusQty;
  final double? maxBonusQty;
  final int? defaultGiftProductId;
  final String giftSelectionKind;
  final bool allowGiftSwap;
  final int? stepQty;
  final int? bonusStepQty;
  final List<int> triggerProductIds;
  final List<GiftProductPreview> giftProducts;

  OrderBonusPreviewRule({
    required this.ruleId,
    required this.name,
    required this.type,
    required this.bonusQty,
    this.maxBonusQty,
    this.defaultGiftProductId,
    this.giftSelectionKind = 'fixed',
    this.allowGiftSwap = false,
    this.stepQty,
    this.bonusStepQty,
    this.triggerProductIds = const [],
    required this.giftProducts,
  });

  bool get isAssortmentAuto => giftSelectionKind == 'assortment_auto';

  /// `category_stock`: aniq sovg'a SKU tanlanmagan, faqat kategoriya doirasi —
  /// sovg'a ombordagi eng katta qoldiqli mahsulotdan avtomatik beriladi.
  bool get isCategoryStockAuto => giftSelectionKind == 'category_stock';

  /// Ikkala holatda ham tanlov to'liq avtomatik va o'zgartirib bo'lmaydi
  /// (backend `allow_gift_swap=false`).
  bool get isLockedAutoGift => isAssortmentAuto || isCategoryStockAuto;

  factory OrderBonusPreviewRule.fromJson(Map<String, dynamic> j) {
    double parseDouble(dynamic v) {
      if (v is num) return v.toDouble();
      return double.tryParse(v?.toString() ?? '') ?? 0;
    }

    return OrderBonusPreviewRule(
      ruleId: (j['rule_id'] as num?)?.toInt() ?? 0,
      name: j['name']?.toString() ?? '',
      type: j['type']?.toString() ?? 'qty',
      bonusQty: parseDouble(j['bonus_qty']),
      maxBonusQty: j['max_bonus_qty'] == null ? null : parseDouble(j['max_bonus_qty']),
      defaultGiftProductId: (j['default_gift_product_id'] as num?)?.toInt(),
      giftSelectionKind: j['gift_selection_kind']?.toString() ?? 'fixed',
      allowGiftSwap: j['allow_gift_swap'] == true,
      stepQty: (j['step_qty'] as num?)?.toInt(),
      bonusStepQty: (j['bonus_step_qty'] as num?)?.toInt(),
      triggerProductIds: (j['trigger_product_ids'] is List)
          ? (j['trigger_product_ids'] as List)
              .map((e) => (e as num?)?.toInt() ?? 0)
              .where((id) => id > 0)
              .toList()
          : const [],
      giftProducts: (j['gift_products'] is List)
          ? (j['gift_products'] as List)
              .whereType<Map>()
              .map((e) => GiftProductPreview.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : [],
    );
  }
}

class GiftProductPreview {
  final int productId;
  final String name;
  final String? categoryName;
  final double stockAvailable;
  final double purchasedQty;
  final double bonusQty;

  GiftProductPreview({
    required this.productId,
    required this.name,
    this.categoryName,
    required this.stockAvailable,
    this.purchasedQty = 0,
    this.bonusQty = 0,
  });

  factory GiftProductPreview.fromJson(Map<String, dynamic> j) {
    double parseDouble(dynamic v) {
      if (v is num) return v.toDouble();
      return double.tryParse(v?.toString() ?? '') ?? 0;
    }

    return GiftProductPreview(
      productId: (j['product_id'] as num?)?.toInt() ?? 0,
      name: j['name']?.toString() ?? '',
      categoryName: j['category_name']?.toString(),
      stockAvailable: parseDouble(j['stock_available']),
      purchasedQty: parseDouble(j['purchased_qty']),
      bonusQty: parseDouble(j['bonus_qty']),
    );
  }
}

class OrderDiscountPreviewRule {
  final int ruleId;
  final String name;
  final double? discountPct;

  OrderDiscountPreviewRule({
    required this.ruleId,
    required this.name,
    this.discountPct,
  });

  factory OrderDiscountPreviewRule.fromJson(Map<String, dynamic> j) {
    final pct = j['discount_pct'];
    return OrderDiscountPreviewRule(
      ruleId: (j['rule_id'] as num?)?.toInt() ?? 0,
      name: j['name']?.toString() ?? '',
      discountPct: pct is num ? pct.toDouble() : double.tryParse(pct?.toString() ?? ''),
    );
  }
}

class LinkedBonusDiscountPair {
  final int bonusRuleId;
  final int discountRuleId;

  LinkedBonusDiscountPair({required this.bonusRuleId, required this.discountRuleId});

  factory LinkedBonusDiscountPair.fromJson(Map<String, dynamic> j) => LinkedBonusDiscountPair(
        bonusRuleId: (j['bonus_rule_id'] as num?)?.toInt() ?? 0,
        discountRuleId: (j['discount_rule_id'] as num?)?.toInt() ?? 0,
      );
}

class _GiftQtyField extends StatefulWidget {
  final int qty;
  final bool enabled;
  final ValueChanged<int> onCommit;

  const _GiftQtyField({
    required this.qty,
    required this.enabled,
    required this.onCommit,
  });

  @override
  State<_GiftQtyField> createState() => _GiftQtyFieldState();
}

class _GiftQtyFieldState extends State<_GiftQtyField> {
  late final TextEditingController _controller;
  final _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: '${widget.qty}');
    _focusNode.addListener(_onFocusChanged);
  }

  @override
  void didUpdateWidget(covariant _GiftQtyField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.qty != oldWidget.qty && !_focusNode.hasFocus) {
      _controller.text = '${widget.qty}';
    }
  }

  void _onFocusChanged() {
    if (!_focusNode.hasFocus) _commit();
  }

  void _commit() {
    if (!widget.enabled) return;
    final parsed = int.tryParse(_controller.text.trim()) ?? 0;
    final value = parsed.clamp(0, 99999);
    if (_controller.text != '$value') {
      _controller.text = '$value';
    }
    widget.onCommit(value);
  }

  @override
  void dispose() {
    _focusNode.removeListener(_onFocusChanged);
    _focusNode.dispose();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 52,
      height: 36,
      child: TextField(
        controller: _controller,
        focusNode: _focusNode,
        enabled: widget.enabled,
        keyboardType: TextInputType.number,
        textAlign: TextAlign.center,
        style: AppTypography.bodyMedium.copyWith(fontWeight: FontWeight.w700),
        inputFormatters: [
          FilteringTextInputFormatter.digitsOnly,
          LengthLimitingTextInputFormatter(5),
        ],
        decoration: InputDecoration(
          isDense: true,
          contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: BorderSide(color: Colors.grey.shade300),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: AppColors.agentAccent, width: 1.5),
          ),
          disabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: BorderSide(color: Colors.grey.shade200),
          ),
        ),
        onSubmitted: (_) => _commit(),
      ),
    );
  }
}

/// Ombor yetishmovchiligi — sariq uchburchak, ichida to‘q undov (fon shaklsiz).
class _BonusStockWarningIcon extends StatelessWidget {
  const _BonusStockWarningIcon();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.only(right: 4, top: 2),
      child: SizedBox(
        width: 22,
        height: 22,
        child: CustomPaint(
          painter: _BonusStockWarningIconPainter(),
        ),
      ),
    );
  }
}

class _BonusStockWarningIconPainter extends CustomPainter {
  const _BonusStockWarningIconPainter();
  static const _yellowTop = Color(0xFFFFE566);
  static const _yellowBottom = Color(0xFFF5A623);
  static const _markColor = Color(0xFF3D4F5F);

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final cx = w / 2;

    final triangle = Path()
      ..moveTo(cx, h * 0.1)
      ..lineTo(w * 0.9, h * 0.86)
      ..quadraticBezierTo(w * 0.92, h * 0.94, w * 0.84, h * 0.94)
      ..lineTo(w * 0.16, h * 0.94)
      ..quadraticBezierTo(w * 0.08, h * 0.94, w * 0.1, h * 0.86)
      ..close();

    final fill = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [_yellowTop, _yellowBottom],
      ).createShader(Rect.fromLTWH(0, 0, w, h))
      ..style = PaintingStyle.fill;
    canvas.drawPath(triangle, fill);

    final mark = Paint()
      ..color = _markColor
      ..style = PaintingStyle.fill;

    final barW = w * 0.14;
    final barH = h * 0.3;
    final barTop = h * 0.36;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(
          center: Offset(cx, barTop + barH / 2),
          width: barW,
          height: barH,
        ),
        Radius.circular(barW / 2),
      ),
      mark,
    );

    final dotR = barW * 0.55;
    canvas.drawCircle(Offset(cx, h * 0.76), dotR, mark);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Eski nom — migratsiya uchun alias.
typedef OrderBonusResult = OrderBonusDiscountResult;
typedef OrderBonusSheet = OrderBonusDiscountSheet;
