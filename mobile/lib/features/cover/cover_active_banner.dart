import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/cover_api.dart';
import '../../core/auth/session.dart';
import '../../core/config/app_product.dart';
import 'cover_models.dart';

/// Faol cover banner — faqat SalesDoc agent/SVR.
class CoverActiveBanner extends ConsumerStatefulWidget {
  const CoverActiveBanner({super.key});

  @override
  ConsumerState<CoverActiveBanner> createState() => _CoverActiveBannerState();
}

class _CoverActiveBannerState extends ConsumerState<CoverActiveBanner> {
  Map<String, dynamic>? _active;
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    if (isTezyukProduct) return;
    final session = ref.read(sessionProvider);
    final role = session.user?.role;
    if (role != 'agent' && role != 'supervisor') return;
    final slug = session.tenantSlug ?? '';
    if (slug.isEmpty) return;
    try {
      final row = await ref.read(coverApiProvider).active(slug);
      if (!mounted) return;
      setState(() {
        _active = row;
        _loaded = true;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loaded = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (isTezyukProduct || !_loaded || !coverIsActive(_active)) {
      return const SizedBox.shrink();
    }
    return Card(
      color: Colors.orange.shade50,
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: const Icon(Icons.swap_horiz, color: Colors.orange),
        title: const Text('Faol o‘rinbosar (cover)'),
        subtitle: Text(coverPairSubtitle(_active)),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => context.push('/cover'),
      ),
    );
  }
}
