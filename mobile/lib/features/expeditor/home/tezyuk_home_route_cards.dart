import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/tezyuk_colors.dart';
import '../../agent/orders/order_create_models.dart' show formatMoneySpaced;
import 'expeditor_home_model.dart';

String _money(num v) => '${formatMoneySpaced(v.toDouble())} so\'m';

class TezyukNextStopCard extends StatelessWidget {
  final HomeNextStop stop;
  const TezyukNextStopCard({super.key, required this.stop});

  Future<void> _openMaps() async {
    final raw = stop.mapsUrl;
    if (raw == null || raw.isEmpty) return;
    final uri = Uri.tryParse(raw);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<void> _call() async {
    final p = stop.phone?.replaceAll(RegExp(r'[^\d+]'), '');
    if (p == null || p.isEmpty) return;
    await launchUrl(Uri(scheme: 'tel', path: p));
  }

  @override
  Widget build(BuildContext context) {
    final seq = stop.seq;
    final dist = stop.distanceKm;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: TezyukColors.surfaceBright,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: TezyukColors.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: TezyukColors.secondaryContainer,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            seq == null
                                ? 'Keyingi manzil'
                                : 'Keyingi manzil • #$seq',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: TezyukColors.primary,
                            ),
                          ),
                        ),
                        if (dist != null) ...[
                          const SizedBox(width: 8),
                          Text(
                            '${dist.toStringAsFixed(1)} km',
                            style: const TextStyle(
                              fontSize: 12,
                              fontFamily: 'monospace',
                              color: TezyukColors.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      stop.clientName,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: TezyukColors.surfaceContainerLow,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.storefront,
                  color: TezyukColors.primary,
                  size: 22,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: TezyukColors.surfaceContainerLow,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Buyurtma summasi',
                        style: TextStyle(
                          fontSize: 11,
                          color: TezyukColors.onSurfaceVariant,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        stop.orderSum == null ? '—' : _money(stop.orderSum!),
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Yuk hajmi',
                        style: TextStyle(
                          fontSize: 11,
                          color: TezyukColors.onSurfaceVariant,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        stop.itemCount == null
                            ? '—'
                            : '${stop.itemCount} ta mahsulot',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: stop.mapsUrl == null ? null : _openMaps,
                  icon: const Icon(Icons.navigation, size: 20),
                  label: const Text('Yo\'nalishni ochish'),
                ),
              ),
              const SizedBox(width: 8),
              OutlinedButton(
                onPressed: stop.phone == null ? null : _call,
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(44, 44),
                  padding: EdgeInsets.zero,
                ),
                child: const Icon(Icons.call, size: 22),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class TezyukPaymentsCard extends StatelessWidget {
  final HomePaymentsPending pending;
  final VoidCallback onOpen;
  const TezyukPaymentsCard({
    super.key,
    required this.pending,
    required this.onOpen,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: TezyukColors.surfaceBright,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: TezyukColors.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.account_balance_wallet,
                color: TezyukColors.warning,
                size: 22,
              ),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'To\'lovlar',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
              ),
              if (pending.count > 0)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: TezyukColors.warningContainer,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    '${pending.count} ta kutilmoqda',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: TezyukColors.onWarningContainer,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            pending.count == 0
                ? 'Tasdiqlanishni kutayotgan to\'lovlar yo\'q'
                : 'Kassir tasdig\'ini kutmoqda: ${_money(pending.sum)}',
            style: const TextStyle(
              fontSize: 14,
              color: TezyukColors.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: onOpen,
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('To\'lovlarni ko\'rish'),
                  SizedBox(width: 4),
                  Icon(Icons.chevron_right, size: 18),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
