import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/expeditor_share_api.dart';
import '../../../core/auth/session.dart';

class ExpeditorShareCreatePage extends ConsumerStatefulWidget {
  const ExpeditorShareCreatePage({super.key});

  @override
  ConsumerState<ExpeditorShareCreatePage> createState() =>
      _ExpeditorShareCreatePageState();
}

class _ExpeditorShareCreatePageState
    extends ConsumerState<ExpeditorShareCreatePage> {
  final _ordersCtrl = TextEditingController();
  final _receiverCtrl = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _ordersCtrl.dispose();
    _receiverCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    final orderIds = _ordersCtrl.text
        .split(RegExp(r'[\s,;]+'))
        .where((s) => s.isNotEmpty)
        .map(int.tryParse)
        .whereType<int>()
        .toList();
    final receiver = int.tryParse(_receiverCtrl.text.trim());
    if (orderIds.isEmpty || receiver == null) {
      setState(() => _error = 'Zakaz id va qabulchi kerak');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final row = await ref.read(expeditorShareApiProvider).create(
            slug,
            orderIds: orderIds,
            receiverUserId: receiver,
          );
      if (!mounted) return;
      final id = (row['id'] as num?)?.toInt();
      if (id != null) {
        context.go('/exp-share/$id');
      } else {
        context.pop();
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Yangi ulashish')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: _ordersCtrl,
            decoration: const InputDecoration(
              labelText: 'Zakaz id lar (vergul bilan)',
            ),
            keyboardType: TextInputType.text,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _receiverCtrl,
            decoration: const InputDecoration(labelText: 'Qabulchi user id'),
            keyboardType: TextInputType.number,
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _busy ? null : _submit,
            child: const Text('Yuborish'),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: Colors.red)),
          ],
        ],
      ),
    );
  }
}
