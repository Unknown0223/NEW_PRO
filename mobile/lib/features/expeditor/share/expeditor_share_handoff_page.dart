import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/expeditor_share_api.dart';
import '../../../core/auth/session.dart';

class ExpeditorShareHandoffPage extends ConsumerStatefulWidget {
  final int requestId;
  const ExpeditorShareHandoffPage({super.key, required this.requestId});

  @override
  ConsumerState<ExpeditorShareHandoffPage> createState() =>
      _ExpeditorShareHandoffPageState();
}

class _ExpeditorShareHandoffPageState
    extends ConsumerState<ExpeditorShareHandoffPage> {
  final _photoCtrl = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _photoCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    final photo = _photoCtrl.text.trim();
    if (photo.isEmpty) {
      setState(() => _error = 'Foto kalit kerak');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      final pos = await Geolocator.getCurrentPosition();
      await ref.read(expeditorShareApiProvider).handoff(
            slug,
            widget.requestId,
            lat: pos.latitude,
            lng: pos.longitude,
            photoKey: photo,
          );
      if (!mounted) return;
      context.go('/exp-share/${widget.requestId}');
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
      appBar: AppBar(title: const Text('Yuk topshirish')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'GPS olinadi; ikkala tomon ~150 m ichida va foto majburiy.',
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _photoCtrl,
            decoration: const InputDecoration(
              labelText: 'Foto storage key',
            ),
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
