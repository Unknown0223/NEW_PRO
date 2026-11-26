import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/expeditor_share_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/config/app_product.dart';
import '../../../core/theme/tezyuk_colors.dart';
import '../shared/tezyuk_expeditor_chrome.dart';

class ExpeditorShareCreatePage extends ConsumerStatefulWidget {
  const ExpeditorShareCreatePage({super.key});

  @override
  ConsumerState<ExpeditorShareCreatePage> createState() =>
      _ExpeditorShareCreatePageState();
}

class _ExpeditorShareCreatePageState
    extends ConsumerState<ExpeditorShareCreatePage> {
  final _ordersCtrl = TextEditingController();
  bool _busy = false;
  String? _error;
  int? _receiverUserId;
  String _receiverName = '';
  List<Map<String, dynamic>> _recipients = const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadRecipients());
  }

  @override
  void dispose() {
    _ordersCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadRecipients() async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return;
    try {
      final rows = await ref.read(expeditorShareApiProvider).listRecipients(slug);
      if (!mounted) return;
      setState(() => _recipients = rows);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = '$e');
    }
  }

  Future<void> _pickReceiver() async {
    if (_recipients.isEmpty) {
      setState(() => _error = 'Qabulchi topilmadi');
      return;
    }
    final picked = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => SimpleDialog(
        title: Text(expeditorLabel('Получатель', 'Qabulchi')),
        children: [
          for (final r in _recipients)
            SimpleDialogOption(
              onPressed: () => Navigator.pop(ctx, r),
              child: Text(
                (r['name']?.toString().trim().isNotEmpty ?? false)
                    ? r['name'].toString()
                    : '—',
              ),
            ),
        ],
      ),
    );
    if (picked == null || !mounted) return;
    setState(() {
      _receiverUserId = (picked['user_id'] as num?)?.toInt();
      _receiverName = (picked['name']?.toString() ?? '').trim();
      _error = null;
    });
  }

  Future<void> _submit() async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    final orderIds = _ordersCtrl.text
        .split(RegExp(r'[\s,;]+'))
        .where((s) => s.isNotEmpty)
        .map(int.tryParse)
        .whereType<int>()
        .toList();
    final receiver = _receiverUserId;
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
      backgroundColor: expeditorPageBackground(),
      appBar: AppBar(
        title: Text(expeditorLabel('Новая передача', 'Yangi ulashish')),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: _ordersCtrl,
            decoration: InputDecoration(
              labelText: expeditorLabel(
                'ID заказов (через запятую)',
                'Zakaz id lar (vergul bilan)',
              ),
            ),
            keyboardType: TextInputType.text,
          ),
          const SizedBox(height: 12),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(expeditorLabel('Получатель', 'Qabulchi')),
            subtitle: Text(_receiverName.isEmpty ? '—' : _receiverName),
            trailing: const Icon(Icons.chevron_right),
            onTap: _busy ? null : _pickReceiver,
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _busy ? null : _submit,
            style: isTezyukProduct
                ? FilledButton.styleFrom(
                    backgroundColor: TezyukColors.primary,
                    foregroundColor: TezyukColors.onPrimary,
                  )
                : null,
            child: Text(expeditorLabel('Отправить', 'Yuborish')),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(
              _error!,
              style: TextStyle(
                color: isTezyukProduct ? TezyukColors.error : Colors.red,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
