import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/cover_api.dart';
import '../../core/api/supervisor_api.dart';
import '../../core/auth/session.dart';
import '../../core/face/face_verification_flow.dart';
import 'cover_models.dart';

/// Agent/SVR cover ro‘yxati + so‘rov (SalesDoc MVP).
class CoverHomePage extends ConsumerStatefulWidget {
  const CoverHomePage({super.key});

  @override
  ConsumerState<CoverHomePage> createState() => _CoverHomePageState();
}

class _CoverHomePageState extends ConsumerState<CoverHomePage> {
  bool _busy = false;
  String? _error;
  List<Map<String, dynamic>> _rows = [];
  Map<String, dynamic>? _active;

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
      final api = ref.read(coverApiProvider);
      final list = await api.list(slug);
      final active = await api.active(slug);
      if (!mounted) return;
      setState(() {
        _rows = list;
        _active = active;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _createForLinked() async {
    final session = ref.read(sessionProvider);
    final slug = session.tenantSlug ?? '';
    final me = session.user;
    if (me == null || slug.isEmpty) return;
    final role = me.role;
    // So‘rovchi ham Face ID (ikkala tomon).
    final faceOk = await FaceVerificationFlow.ensure(
      context,
      ref,
      verifyContext: 'cover_accept',
      title: 'Cover so‘rovi — yuz tasdiqi',
    );
    if (!faceOk) {
      if (!mounted) return;
      setState(() => _error = 'Yuz tasdiqlanmadi');
      return;
    }
    if (!mounted) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final api = ref.read(coverApiProvider);
      Map<String, dynamic>? created;
      if (role == 'agent') {
        // SVR serverda users.supervisor_user_id dan olinadi.
        created = await api.create(slug);
      } else if (role == 'supervisor') {
        if (!mounted) return;
        final agentId = await _pickLinkedAgent();
        if (agentId == null) return;
        created = await api.create(slug, agentUserId: agentId);
      }
      final id = (created?['id'] as num?)?.toInt();
      if (id != null) {
        await api.markFace(slug, id, faceOk: true);
      }
      await _reload();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Picker: faqat nom (kod labelga qo‘shilmaydi).
  Future<int?> _pickLinkedAgent() async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    List<SupervisorLinkedAgent> agents;
    try {
      agents = await ref.read(supervisorApiProvider).getLinkedAgents(slug);
    } catch (e) {
      if (!mounted) return null;
      setState(() => _error = '$e');
      return null;
    }
    if (!mounted) return null;
    if (agents.isEmpty) {
      setState(() => _error = 'Biriktirilgan agent yo‘q');
      return null;
    }
    return showDialog<int>(
      context: context,
      builder: (ctx) => SimpleDialog(
        title: const Text('Agentni tanlang'),
        children: [
          for (final a in agents)
            SimpleDialogOption(
              onPressed: () => Navigator.pop(ctx, a.id),
              child: Text(a.name.trim().isEmpty ? '—' : a.name),
            ),
        ],
      ),
    );
  }

  Future<void> _faceAndAccept(int id) async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    // Mavjud SalesDoc Face ID (selfie + server match); yangi SDK yo‘q.
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
      await api.markFace(slug, id, faceOk: true);
      await api.accept(slug, id);
      await _reload();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _end(int id) async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    setState(() => _busy = true);
    try {
      await ref.read(coverApiProvider).end(slug, id);
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
    return Scaffold(
      appBar: AppBar(
        title: const Text('O‘rinbosar (cover)'),
        actions: [
          IconButton(
            onPressed: _busy ? null : _reload,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _busy ? null : _createForLinked,
        label: const Text('So‘rov'),
        icon: const Icon(Icons.add),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(_error!, style: const TextStyle(color: Colors.red)),
            ),
          if (coverIsActive(_active))
            Card(
              color: Colors.orange.shade50,
              child: ListTile(
                title: const Text('Faol cover'),
                subtitle: Text(coverPairSubtitle(_active)),
                trailing: TextButton(
                  onPressed: () {
                    final id = (_active!['id'] as num?)?.toInt();
                    if (id != null) _end(id);
                  },
                  child: const Text('Tugatish'),
                ),
              ),
            ),
          if (_busy && _rows.isEmpty)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: CircularProgressIndicator()),
            ),
          ..._rows.map((r) {
            final id = (r['id'] as num?)?.toInt() ?? 0;
            final st = r['status']?.toString() ?? '';
            final requestedBy = (r['requested_by_user_id'] as num?)?.toInt();
            return ListTile(
              title: Text(coverStatusLabel(st)),
              subtitle: Text(coverPairSubtitle(r)),
              trailing: st == 'kutilmoqda'
                  ? TextButton(
                      onPressed: me?.id == requestedBy
                          ? null
                          : () => _faceAndAccept(id),
                      child: const Text('Qabul'),
                    )
                  : st == 'faol'
                      ? TextButton(
                          onPressed: () => _end(id),
                          child: const Text('Tugatish'),
                        )
                      : null,
              onTap: () => context.push('/cover/$id'),
            );
          }),
        ],
      ),
    );
  }
}
