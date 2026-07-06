import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/api/expeditor_api.dart';
import '../../../core/auth/biometric_service.dart';
import '../../../core/auth/session.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../agent/shell/agent_app_bar.dart';
import '../config/expeditor_config_enforcement.dart';
import '../expeditor_providers.dart';

class ExpeditorInvoiceDetailPage extends ConsumerStatefulWidget {
  final String docId;
  const ExpeditorInvoiceDetailPage({super.key, required this.docId});

  @override
  ConsumerState<ExpeditorInvoiceDetailPage> createState() =>
      _ExpeditorInvoiceDetailPageState();
}

class _ExpeditorInvoiceDetailPageState
    extends ConsumerState<ExpeditorInvoiceDetailPage> {
  bool _busy = false;

  Future<void> _confirm(ExpeditorConfigPolicy policy) async {
    if (policy.fingerprintRequired) {
      final bio = ref.read(biometricServiceProvider);
      if (!await bio.isAvailable() ||
          !await bio.authenticate(reason: 'Подтвердите отгрузку')) {
        return;
      }
    }
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(expeditorApiProvider)
          .confirmShipmentDocument(slug, widget.docId);
      ref.invalidate(expeditorShipmentDetailProvider(widget.docId));
      ref.invalidate(expeditorShipmentDocsProvider('shipping'));
      ref.invalidate(expeditorDashboardProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Подтверждено')),);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('$e'), backgroundColor: AppColors.error),);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _fmtDateTime(String? raw) {
    if (raw == null || raw.isEmpty) return '—';
    final dt = DateTime.tryParse(raw);
    if (dt == null) return raw;
    return DateFormat('d MMM, HH:mm', 'ru').format(dt.toLocal());
  }

  String _fmtDate(String? raw) {
    if (raw == null || raw.isEmpty) return '—';
    if (raw.length >= 10 && raw.contains('-')) {
      final dt = DateTime.tryParse(
          raw.length == 10 ? '${raw}T00:00:00' : raw,);
      if (dt != null) return DateFormat('d MMM, yyyy', 'ru').format(dt);
    }
    final dt = DateTime.tryParse(raw);
    if (dt == null) return raw;
    return DateFormat('d MMM, HH:mm', 'ru').format(dt.toLocal());
  }

  @override
  Widget build(BuildContext context) {
    final policy = ExpeditorConfigPolicy.fromMobileConfig(
        ref.watch(sessionProvider).mobileConfig,);
    final detail = ref.watch(expeditorShipmentDetailProvider(widget.docId));
    final isReturnDoc =
        detail.valueOrNull?['doc_type']?.toString() == 'return';

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AgentAppBar(
        title: isReturnDoc
            ? 'О возвратной накладной'
            : 'О отгрузочной накладной',
        showBack: true,
      ),
      body: detail.when(
        data: (d) {
          final orders = (d['order_numbers'] as List?)?.cast<String>() ?? [];
          final products = (d['products'] as List?)?.cast<Map>() ?? [];
          final waiting = d['status'] == 'waiting_confirmation';
          final confirmedAt = d['confirmed_at']?.toString();
          final expeditorName = d['expeditor_name']?.toString();

          return Column(
            children: [
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(12),
                  children: [
                    _card(
                      child: Column(
                        children: [
                          _infoRow('№', d['id']?.toString() ?? '—'),
                          _divider(),
                          _infoRow('Статус',
                              d['expeditor_status']?.toString() ?? '',),
                          _divider(),
                          _infoRow('Склад',
                              d['warehouse_name']?.toString() ?? '—',),
                          _divider(),
                          _infoRow(
                              'Дата отправки', _fmtDate(d['ship_date']?.toString()),),
                          if (!waiting) ...[
                            _divider(),
                            _infoRow('Дата подтверждения',
                                _fmtDateTime(confirmedAt),),
                          ],
                          if (orders.isNotEmpty) ...[
                            _divider(),
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Заказы',
                                      style: AppTypography.bodyMedium.copyWith(
                                          color: AppColors.textMuted,),),
                                  const SizedBox(height: 8),
                                  Wrap(
                                    spacing: 6,
                                    runSpacing: 6,
                                    children: orders
                                        .map((n) => Container(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                      horizontal: 8,
                                                      vertical: 4,),
                                              decoration: BoxDecoration(
                                                color: AppColors.success
                                                    .withValues(alpha: 0.12),
                                                borderRadius:
                                                    BorderRadius.circular(6),
                                              ),
                                              child: Text(n,
                                                  style: const TextStyle(
                                                      fontSize: 12,
                                                      fontWeight:
                                                          FontWeight.w700,
                                                      color:
                                                          AppColors.success,),),
                                            ),)
                                        .toList(),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text('Подтверждения',
                        style: AppTypography.headlineSmall
                            .copyWith(fontWeight: FontWeight.w800),),
                    const SizedBox(height: 8),
                    _card(
                      child: Row(
                        children: [
                          Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: AppColors.expeditorAccent
                                  .withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.local_shipping,
                                color: AppColors.expeditorAccent, size: 22,),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  expeditorName == null ||
                                          expeditorName.isEmpty
                                      ? 'Экспедитор'
                                      : 'Экспедитор ($expeditorName)',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w700,),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  waiting
                                      ? 'Ожидание подтверждения'
                                      : 'Время подтверждения: ${_fmtDateTime(confirmedAt)}',
                                  style: AppTypography.caption
                                      .copyWith(color: AppColors.textMuted),
                                ),
                              ],
                            ),
                          ),
                          Icon(
                            waiting ? Icons.schedule : Icons.check_circle,
                            color: waiting
                                ? AppColors.warning
                                : AppColors.success,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text('Продукты',
                        style: AppTypography.headlineSmall
                            .copyWith(fontWeight: FontWeight.w800),),
                    const SizedBox(height: 8),
                    _card(
                      padding: EdgeInsets.zero,
                      child: Column(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 10,),
                            decoration: const BoxDecoration(
                              color: AppColors.background,
                              borderRadius: BorderRadius.vertical(
                                  top: Radius.circular(12),),
                            ),
                            child: const Row(
                              children: [
                                Expanded(
                                    flex: 5,
                                    child: Text('Имя',
                                        style: TextStyle(
                                            fontWeight: FontWeight.w700,
                                            color: AppColors.textMuted,
                                            fontSize: 12,),),),
                                Expanded(
                                    flex: 4,
                                    child: Text('Категория',
                                        style: TextStyle(
                                            fontWeight: FontWeight.w700,
                                            color: AppColors.textMuted,
                                            fontSize: 12,),),),
                                Expanded(
                                    flex: 2,
                                    child: Text('К-во',
                                        textAlign: TextAlign.right,
                                        style: TextStyle(
                                            fontWeight: FontWeight.w700,
                                            color: AppColors.textMuted,
                                            fontSize: 12,),),),
                              ],
                            ),
                          ),
                          for (var i = 0; i < products.length; i++)
                            _productRow(Map<String, dynamic>.from(products[i]),
                                i > 0,),
                          if (products.isEmpty)
                            const Padding(
                              padding: EdgeInsets.all(16),
                              child: Text('Нет продуктов',
                                  style:
                                      TextStyle(color: AppColors.textMuted),),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              if (waiting && d['doc_type'] == 'shipping')
                SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: ElevatedButton.icon(
                        onPressed: _busy ? null : () => _confirm(policy),
                        icon: const Icon(Icons.check),
                        label: Text(_busy ? '...' : 'Подтвердить'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.expeditorAccent,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          );
        },
        loading: () => const Center(
            child:
                CircularProgressIndicator(color: AppColors.expeditorAccent),),
        error: (e, _) => Center(child: Text('Ошибка: $e')),
      ),
    );
  }

  Widget _card({required Widget child, EdgeInsets? padding}) {
    return Container(
      width: double.infinity,
      padding: padding ?? const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
      ),
      child: child,
    );
  }

  Widget _divider() => const Divider(height: 1, color: AppColors.divider);

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          Text(label,
              style: AppTypography.bodyMedium
                  .copyWith(color: AppColors.textMuted),),
          const Spacer(),
          Flexible(
            child: Text(value,
                textAlign: TextAlign.right,
                style: const TextStyle(fontWeight: FontWeight.w700),),
          ),
        ],
      ),
    );
  }

  Widget _productRow(Map<String, dynamic> m, bool borderTop) {
    final qty = m['qty'];
    final qtyText = qty is num
        ? (qty == qty.truncate() ? qty.toInt().toString() : qty.toString())
        : (qty?.toString() ?? '0');
    return Column(
      children: [
        if (borderTop) _divider(),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              Expanded(
                flex: 5,
                child: Text(m['name']?.toString() ?? '',
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 13,),),
              ),
              Expanded(
                flex: 4,
                child: Text(m['category']?.toString() ?? '—',
                    style: AppTypography.caption
                        .copyWith(color: AppColors.textMuted),),
              ),
              Expanded(
                flex: 2,
                child: Text(qtyText,
                    textAlign: TextAlign.right,
                    style: const TextStyle(fontWeight: FontWeight.w800),),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
