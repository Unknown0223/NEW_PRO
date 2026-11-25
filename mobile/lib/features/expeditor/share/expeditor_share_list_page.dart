import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/expeditor_share_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../shell/expeditor_drawer.dart';
import 'share_models.dart';

class ExpeditorShareListPage extends ConsumerStatefulWidget {
  const ExpeditorShareListPage({super.key});

  @override
  ConsumerState<ExpeditorShareListPage> createState() =>
      _ExpeditorShareListPageState();
}

class _ExpeditorShareListPageState
    extends ConsumerState<ExpeditorShareListPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  String? _error;
  List<ShareRequestSummary> _inbox = const [];
  List<ShareRequestSummary> _outbox = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(expeditorShareApiProvider);
      final inbox = await api.list(slug, box: 'inbox');
      final outbox = await api.list(slug, box: 'outbox');
      if (!mounted) return;
      setState(() {
        _inbox = inbox.map(ShareRequestSummary.fromJson).toList();
        _outbox = outbox.map(ShareRequestSummary.fromJson).toList();
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = '$e';
        _loading = false;
      });
    }
  }

  Widget _list(List<ShareRequestSummary> rows) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(child: Text(_error!));
    }
    if (rows.isEmpty) {
      return AgentEmptyState.fill(message: 'Ulashish so\'rovi yo\'q');
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        itemCount: rows.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (ctx, i) {
          final r = rows[i];
          return ListTile(
            title: Text('#${r.id} · ${shareStatusLabel(r.status)}'),
            subtitle: Text('${r.orderCount} zakaz'),
            onTap: () => context.push('/exp-share/${r.id}'),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      drawer: const ExpeditorDrawer(),
      appBar: AppBar(
        title: const Text('Ulashish'),
        bottom: TabBar(
          controller: _tabs,
          tabs: const [
            Tab(text: 'Kiruvchi'),
            Tab(text: 'Chiquvchi'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () => context.push('/exp-share/create'),
          ),
        ],
      ),
      body: TabBarView(
        controller: _tabs,
        children: [_list(_inbox), _list(_outbox)],
      ),
    );
  }
}
