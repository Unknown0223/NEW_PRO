import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/api/expeditor_api.dart';
import '../../../core/auth/biometric_service.dart';
import '../../../core/auth/session.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../expeditor_status_labels.dart';
import '../config/expeditor_config_enforcement.dart';
import '../expeditor_providers.dart';

class ExpeditorDeliveryDetailPage extends ConsumerStatefulWidget {
  final int orderId;
  const ExpeditorDeliveryDetailPage({super.key, required this.orderId});

  @override
  ConsumerState<ExpeditorDeliveryDetailPage> createState() => _ExpeditorDeliveryDetailPageState();
}

class _ExpeditorDeliveryDetailPageState extends ConsumerState<ExpeditorDeliveryDetailPage> {
  bool _busy = false;

  Future<bool> _confirmDeliveredIfNeeded(ExpeditorConfigPolicy policy) async {
    if (!policy.fingerprintRequired) return true;
    final bio = ref.read(biometricServiceProvider);
    if (!await bio.isAvailable()) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Barmoq izi mavjud emas — admin sozlamasini o\'chiring')),
        );
      }
      return false;
    }
    return bio.authenticate(reason: 'Yetkazishni tasdiqlang');
  }

  Future<void> _setStatus(String status, ExpeditorConfigPolicy policy) async {
    if (status == 'delivered') {
      final ok = await _confirmDeliveredIfNeeded(policy);
      if (!ok) return;
    }
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return;
    setState(() => _busy = true);
    try {
      await ref.read(expeditorApiProvider).patchOrderStatus(slug, widget.orderId, status);
      ref.invalidate(expeditorOrderDetailProvider(widget.orderId));
      ref.invalidate(deliveriesProvider(null));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Holat: $status')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: AppColors.error));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openMap(Map<String, dynamic> client) async {
    final lat = (client['latitude'] as num?)?.toDouble();
    final lng = (client['longitude'] as num?)?.toDouble();
    if (lat == null || lng == null) return;
    final uri = Uri.parse('https://yandex.ru/maps/?pt=$lng,$lat&z=16&l=map');
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<void> _updateClientLocation(int clientId) async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return;
    setState(() => _busy = true);
    try {
      final perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        await Geolocator.requestPermission();
      }
      final pos = await Geolocator.getCurrentPosition();
      await ref.read(expeditorApiProvider).patchClientLocation(
            slug,
            clientId,
            latitude: pos.latitude,
            longitude: pos.longitude,
          );
      ref.invalidate(expeditorOrderDetailProvider(widget.orderId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Koordinata yangilandi'), backgroundColor: AppColors.success),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: AppColors.error));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final policy = ExpeditorConfigPolicy.fromMobileConfig(session.mobileConfig);
    final detail = ref.watch(expeditorOrderDetailProvider(widget.orderId));

    return Scaffold(
      appBar: AppBar(title: Text('Buyurtma #${detail.valueOrNull?['number'] ?? widget.orderId}')),
      body: detail.when(
        data: (o) {
          final client = Map<String, dynamic>.from(o['client'] as Map? ?? {});
          final clientId = client['id'] as int? ?? 0;
          final items = (o['items'] as List?)?.cast<Map>() ?? [];
          final nextStatuses = (o['allowed_next_statuses'] as List?)?.map((e) => e.toString()).toList() ?? [];
          final status = o['status']?.toString() ?? '';
          final payments = (o['payments'] as List?) ?? [];
          var paidConfirmed = 0.0;
          var paidPending = 0.0;
          final pendingPayments = <Map<String, dynamic>>[];
          for (final p in payments) {
            final m = Map<String, dynamic>.from(p as Map);
            final amount = (m['amount'] as num?)?.toDouble() ?? 0;
            final wf = m['workflow_status']?.toString() ?? 'confirmed';
            if (expeditorPaymentIsPending(wf)) {
              paidPending += amount;
              pendingPayments.add(m);
            } else if (wf != 'rejected') {
              paidConfirmed += amount;
            }
          }
          final total = (o['total_sum'] as num?)?.toDouble() ?? 0;
          final hasDebt = total > paidConfirmed + paidPending + 0.01;
          final canPay = policy.canSubmitPayment(fromDebtor: hasDebt, orderStatus: status);

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text('Holat: ${expeditorStatusLabel(status)}', style: AppTypography.titleMedium),
              const SizedBox(height: 8),
              Text('Mijoz: ${client['name'] ?? '-'}', style: AppTypography.bodyLarge),
              if (client['phone'] != null) Text('Tel: ${client['phone']}', style: AppTypography.bodyMedium),
              if (client['address'] != null || client['city'] != null)
                Text(
                  [client['address'], client['city'], client['zone']].whereType<String>().where((s) => s.isNotEmpty).join(', '),
                  style: AppTypography.bodySmall,
                ),
              const SizedBox(height: 8),
              Text('Summa: ${o['total_sum']} ${policy.currencySymbol}', style: AppTypography.bodyLarge),
              if (paidConfirmed > 0)
                Text('Tasdiqlangan to\'lov: $paidConfirmed ${policy.currencySymbol}', style: AppTypography.bodySmall),
              if (paidPending > 0)
                Text(
                  'Tasdiqlanishni kutmoqda: $paidPending ${policy.currencySymbol}',
                  style: AppTypography.bodySmall.copyWith(color: AppColors.warning),
                ),
              if (pendingPayments.isNotEmpty) ...[
                const SizedBox(height: 8),
                ...pendingPayments.map(
                  (p) => ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.hourglass_top, color: AppColors.warning, size: 20),
                    title: Text('${p['amount']} ${policy.currencySymbol}'),
                    subtitle: Text(expeditorPaymentWorkflowLabel(p['workflow_status']?.toString() ?? '')),
                  ),
                ),
              ],
              const SizedBox(height: 16),
              if (client['latitude'] != null && client['longitude'] != null)
                OutlinedButton.icon(
                  onPressed: _busy ? null : () => _openMap(client),
                  icon: const Icon(Icons.map_outlined),
                  label: const Text('Xaritada ochish'),
                ),
              if (policy.canChangeClientLocation && clientId > 0)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: OutlinedButton.icon(
                    onPressed: _busy ? null : () => _updateClientLocation(clientId),
                    icon: const Icon(Icons.my_location),
                    label: const Text('Koordinatani yangilash'),
                  ),
                ),
              const SizedBox(height: 16),
              const Text('Mahsulotlar', style: AppTypography.titleMedium),
              ...items.map((it) {
                final m = Map<String, dynamic>.from(it);
                return ListTile(
                  dense: true,
                  title: Text(m['product_name']?.toString() ?? '-'),
                  subtitle: Text('${m['qty']} x ${m['price']}'),
                  trailing: Text(m['total']?.toString() ?? ''),
                );
              }),
              const Divider(height: 32),
              if (nextStatuses.isNotEmpty) ...[
                const Text('Holatni yangilash', style: AppTypography.titleMedium),
                if (policy.fingerprintRequired)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(
                      '«delivered» uchun barmoq izi talab qilinadi',
                      style: AppTypography.bodySmall.copyWith(color: AppColors.warning),
                    ),
                  ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: nextStatuses
                      .map(
                        (s) => ElevatedButton(
                          onPressed: _busy ? null : () => _setStatus(s, policy),
                          child: Text(expeditorStatusLabel(s)),
                        ),
                      )
                      .toList(),
                ),
              ],
              if (policy.paymentsEnabled && canPay && status == 'delivered')
                Padding(
                  padding: const EdgeInsets.only(top: 16),
                  child: OutlinedButton.icon(
                    onPressed: () => context.push('/payments?order_id=${widget.orderId}'),
                    icon: const Icon(Icons.payment),
                    label: const Text('To\'lov arizasi yuborish'),
                  ),
                ),
              if (policy.allowPartialReturn && status == 'delivered')
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: OutlinedButton.icon(
                    onPressed: () => context.push('/returns?order_id=${widget.orderId}'),
                    icon: const Icon(Icons.replay),
                    label: const Text('Qaytarish'),
                  ),
                ),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Xato: $e')),
      ),
    );
  }
}
