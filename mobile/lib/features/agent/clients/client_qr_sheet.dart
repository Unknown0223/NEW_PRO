import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/client_qr_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/theme/app_colors.dart';

/// QR biriktirish / ajratish — kod qo'lda kiritiladi (kamera ixtiyoriy keyingi faza).
class ClientQrSheet extends ConsumerStatefulWidget {
  final int clientId;
  final String clientName;
  final bool allowChange;

  const ClientQrSheet({
    super.key,
    required this.clientId,
    required this.clientName,
    this.allowChange = false,
  });

  static Future<bool?> show(
    BuildContext context, {
    required int clientId,
    required String clientName,
    bool allowChange = false,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.background,
      builder: (_) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
        child: ClientQrSheet(clientId: clientId, clientName: clientName, allowChange: allowChange),
      ),
    );
  }

  @override
  ConsumerState<ClientQrSheet> createState() => _ClientQrSheetState();
}

class _ClientQrSheetState extends ConsumerState<ClientQrSheet> {
  final _codeCtrl = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _codeCtrl.dispose();
    super.dispose();
  }

  Future<void> _bind() async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    final code = _codeCtrl.text.trim();
    if (slug.isEmpty || code.isEmpty) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(clientQrApiProvider).bind(slug, qrCode: code, clientId: widget.clientId);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _unbind() async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    final code = _codeCtrl.text.trim();
    if (slug.isEmpty || code.isEmpty) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(clientQrApiProvider).unbind(slug, qrCode: code);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('QR — ${widget.clientName}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
          const SizedBox(height: 12),
          TextField(
            controller: _codeCtrl,
            decoration: const InputDecoration(labelText: 'QR kod', border: OutlineInputBorder()),
            textInputAction: TextInputAction.done,
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: const TextStyle(color: AppColors.error, fontSize: 12)),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _busy ? null : _bind,
            child: _busy ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Biriktirish'),
          ),
          if (widget.allowChange) ...[
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: _busy ? null : _unbind,
              child: const Text('Ajratish'),
            ),
          ],
        ],
      ),
    );
  }
}
