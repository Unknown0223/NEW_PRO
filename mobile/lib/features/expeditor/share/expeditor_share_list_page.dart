import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/expeditor_share_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../shared/tezyuk_expeditor_chrome.dart';
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

  Widget _list(List<ShareRequestSummary> rows, {required bool inbox}) {
    final accent = expeditorChromeAccent();
    if (_loading) {
      return Center(child: CircularProgressIndicator(color: accent));
    }
    if (_error != null) {
      return Center(child: Text(_error!));
    }
    if (rows.isEmpty) {
      return AgentEmptyState.fill(message: 'Ulashish so\'rovi yo\'q');
    }
    return RefreshIndicator(
      color: accent,
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(12),
        itemCount: rows.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (ctx, i) {
          final r = rows[i];
          return Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () => context.push('/exp-share/${r.id}'),
              borderRadius: BorderRadius.circular(14),
              child: Ink(
                decoration: expeditorListCardDecoration(),
                child: ListTile(
                  title: Text(
                    '${r.counterpartLabel(inbox: inbox)} · ${shareStatusLabel(r.status)}',
                  ),
                  subtitle: Text('${r.orderCount} buyurtma'),
                  trailing: Icon(Icons.chevron_right, color: accent),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final accent = expeditorChromeAccent();
    return Scaffold(
      backgroundColor: expeditorPageBackground(),
      drawer: const ExpeditorDrawer(),
      appBar: AppBar(
        title: Text(expeditorLabel('Передачи', 'Ulashish')),
        bottom: TabBar(
          controller: _tabs,
          indicatorColor: accent,
          labelColor: accent,
          tabs: [
            Tab(text: expeditorLabel('Входящие', 'Kiruvchi')),
            Tab(text: expeditorLabel('Исходящие', 'Chiquvchi')),
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
        children: [
          _list(_inbox, inbox: true),
          _list(_outbox, inbox: false),
        ],
      ),
    );
  }
}
