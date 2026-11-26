import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/cover_api.dart';
import '../../core/auth/session.dart';
import '../../core/face/face_verification_flow.dart';
import 'cover_models.dart';

/// Bitta cover kartochkasi (qabul / tugatish).
class CoverDetailPage extends ConsumerStatefulWidget {
  final int coverId;
  const CoverDetailPage({super.key, required this.coverId});

  @override
  ConsumerState<CoverDetailPage> createState() => _CoverDetailPageState();
}

class _CoverDetailPageState extends ConsumerState<CoverDetailPage> {
  bool _busy = false;
  String? _error;
  Map<String, dynamic>? _row;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _reload());
  }

  Future<void> _reload() async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final list = await ref.read(coverApiProvider).list(slug);
      Map<String, dynamic>? found;
      for (final e in list) {
        if ((e['id'] as num?)?.toInt() == widget.coverId) {
          found = e;
          break;
        }
      }
      if (!mounted) return;
      setState(() => _row = found);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _faceAndAccept() async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    final faceOk = await FaceVerificationFlow.ensure(
      context,
      ref,
      verifyContext: 'cover_accept',
      title: 'Cover uchun yuz tasdiqi',
    );
    if (!faceOk) {
      if (!mounted) return;
      setState(() => _error = 'Yuz tasdiqlanmadi');
      return;
    }
    if (!mounted) return;
    setState(() => _busy = true);
    try {
      final api = ref.read(coverApiProvider);
      await api.markFace(slug, widget.coverId, faceOk: true);
      await api.accept(slug, widget.coverId);
      await _reload();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _end() async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    setState(() => _busy = true);
    try {
      await ref.read(coverApiProvider).end(slug, widget.coverId);
      await _reload();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = ref.watch(sessionProvider).user;
    final st = _row?['status']?.toString() ?? '';
    return Scaffold(
      appBar: AppBar(title: Text('Cover #${widget.coverId}')),
      body: _busy && _row == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (_error != null)
                  Text(_error!, style: const TextStyle(color: Colors.red)),
                if (_row == null && !_busy)
                  const Text('Cover topilmadi')
                else if (_row != null) ...[
                  ListTile(
                    title: Text(coverStatusLabel(st)),
                    subtitle: const Text('Holat'),
                  ),
                  ListTile(
                    title: const Text('Agent'),
                    subtitle: Text(coverPersonLabel(_row, 'agent_name')),
                  ),
                  ListTile(
                    title: const Text('SVR'),
                    subtitle: Text(coverPersonLabel(_row, 'svr_name')),
                  ),
                  const SizedBox(height: 12),
                  if (st == 'kutilmoqda' &&
                      me?.id != (_row!['requested_by_user_id'] as num?)?.toInt())
                    FilledButton(
                      onPressed: _busy ? null : _faceAndAccept,
                      child: const Text('Yuz tasdiq + qabul'),
                    ),
                  if (st == 'faol')
                    FilledButton(
                      onPressed: _busy ? null : _end,
                      child: const Text('Tugatish'),
                    ),
                ],
              ],
            ),
    );
  }
}
