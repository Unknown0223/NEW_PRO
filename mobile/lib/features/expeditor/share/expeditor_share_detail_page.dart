import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/expeditor_share_api.dart';
import '../../../core/auth/session.dart';
import 'share_models.dart';

class ExpeditorShareDetailPage extends ConsumerStatefulWidget {
  final int requestId;
  const ExpeditorShareDetailPage({super.key, required this.requestId});

  @override
  ConsumerState<ExpeditorShareDetailPage> createState() =>
      _ExpeditorShareDetailPageState();
}

class _ExpeditorShareDetailPageState
    extends ConsumerState<ExpeditorShareDetailPage> {
  Map<String, dynamic>? _data;
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return;
    try {
      final row =
          await ref.read(expeditorShareApiProvider).get(slug, widget.requestId);
      if (!mounted) return;
      setState(() => _data = row);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = '$e');
    }
  }

  Future<void> _acceptAll() async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    final orders = (_data?['orders'] as List?) ?? [];
    final ids = orders
        .map((e) => (e as Map)['order_id'] as num?)
        .whereType<num>()
        .map((n) => n.toInt())
        .toList();
    setState(() => _busy = true);
    try {
      await ref
          .read(expeditorShareApiProvider)
          .accept(slug, widget.requestId, orderIds: ids);
      await _load();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = (_data?['status'] ?? '').toString();
    return Scaffold(
      appBar: AppBar(title: Text('Ulashish #${widget.requestId}')),
      body: _error != null
          ? Center(child: Text(_error!))
          : _data == null
              ? const Center(child: CircularProgressIndicator())
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Text(
                      shareStatusLabel(status),
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text('Zakazlar: ${(_data!['orders'] as List?)?.length ?? 0}'),
                    const SizedBox(height: 24),
                    if (status == 'korildi' || status == 'kutilmoqda')
                      FilledButton(
                        onPressed: _busy ? null : _acceptAll,
                        child: const Text('Hammasini qabul qilish'),
                      ),
                    if (status == 'yuk_kutilmoqda') ...[
                      const SizedBox(height: 8),
                      OutlinedButton(
                        onPressed: () =>
                            context.push('/exp-share/${widget.requestId}/handoff'),
                        child: const Text('Yuk / foto topshirish'),
                      ),
                    ],
                  ],
                ),
    );
  }
}
