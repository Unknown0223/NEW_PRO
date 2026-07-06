import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/session.dart';
import '../../../core/config/mobile_config.dart';
import '../../../core/config/mobile_config_policy.dart';
import '../../../core/database/app_database.dart';
import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/sync/sync_data_refresh.dart';
import '../../auth/auth_provider.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../shell/agent_app_bar.dart';
import '../../../core/clients/agent_outlet_filters_provider.dart';
import '../../../core/clients/client_outlet_filters.dart';
import '../../../core/format/money_display.dart';
import 'clients_list_provider.dart';
import '../orders/order_draft_provider.dart';
import '../orders/order_draft_ui.dart';
import 'create_client_sheet.dart';

export 'clients_list_provider.dart';

/// Eski to'liq katalog (sinxron qilinmagan) — ogohlantirish ko'rsatish.
final agentStaleClientCatalogProvider = FutureProvider<bool>((ref) async {
  ref.watch(clientsListProvider);
  if (await AppDatabase().isAgentClientsSynced()) return false;
  final n = await AppDatabase().clientCount();
  return n > 50;
});

class AgentClientsPage extends ConsumerStatefulWidget {
  final bool openCreateOnLoad;

  const AgentClientsPage({super.key, this.openCreateOnLoad = false});

  @override
  ConsumerState<AgentClientsPage> createState() => _AgentClientsPageState();
}

class _AgentClientsPageState extends ConsumerState<AgentClientsPage> {
  final _searchCtrl = TextEditingController();
  final _searchFocus = FocusNode();
  List<Map<String, dynamic>> _searchResults = [];
  bool _searching = false;
  bool _syncing = false;
  bool _initialSyncDone = false;
  String _query = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _maybeLoadClients();
      if (widget.openCreateOnLoad) _openCreateIfAllowed();
    });
  }

  Future<void> _openCreateIfAllowed() async {
    final canCreate = ref.read(sessionProvider).mobileConfig?.client.canCreate ?? false;
    if (!canCreate || !mounted) return;
    final ok = await showCreateClientSheet(context);
    if (ok == true && mounted) {
      ref.invalidate(clientsListProvider);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Savdo nuqtasi yaratildi'), backgroundColor: AppColors.success),
      );
    }
  }

  Future<void> _maybeLoadClients() async {
    if (_initialSyncDone) return;
    _initialSyncDone = true;
    final cached = await AppDatabase().getAllClients();
    if (cached.isNotEmpty || !mounted) return;
    await _syncClients(silent: true);
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _searchFocus.dispose();
    super.dispose();
  }

  Future<void> _runSearch(String q) async {
    final trimmed = q.trim();
    if (trimmed == _query && (_searching || trimmed.isEmpty)) return;
    _query = trimmed;
    if (trimmed.isEmpty) {
      if (mounted) {
        setState(() {
        _searchResults = [];
        _searching = false;
      });
      }
      return;
    }
    final cfg = ref.read(sessionProvider).mobileConfig?.client;
    final includePending = (cfg?.canCreate ?? false) || (cfg?.requireNewClientApproval ?? false);
    setState(() => _searching = true);
    final results = await AppDatabase().searchClients(trimmed, activeOnly: !includePending);
    if (mounted) {
      setState(() {
        _searchResults = results;
        _searching = false;
      });
    }
  }

  Future<void> _syncClients({bool silent = false}) async {
    final policy = evaluateSyncPolicy(
      ref.read(sessionProvider).mobileConfig?.sync ?? const SyncConfig(),
    );
    if (!policy.allowed) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(policy.denialMessage ?? 'Sinxronizatsiya mumkin emas'),
            backgroundColor: AppColors.warning,
          ),
        );
      }
      return;
    }
    setState(() => _syncing = true);
    final result = await ref.read(authStateProvider.notifier).resync(full: true);
    final ok = result.ok;
    ref.invalidate(clientsListProvider);
    ref.invalidate(filteredClientsProvider);
    ref.invalidate(agentStaleClientCatalogProvider);
    if (ok) invalidateSyncedData(ref.invalidate);
    if (mounted) {
      setState(() => _syncing = false);
      if (_searchCtrl.text.trim().isNotEmpty) {
        await _runSearch(_searchCtrl.text);
      }
      final err = result.error ?? '';
      final msg = ok
          ? 'Mijozlar yangilandi (${result.clients} ta)'
          : (err.contains('401') ||
                  err.contains('Sessiya') ||
                  err.contains('Invalid or expired') ||
                  err.contains('tugadi')
              ? 'Sessiya tugadi — qayta kiring'
              : (err.isNotEmpty ? err : 'Sinxronizatsiya xato'));
      if (!silent || !ok) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(msg),
            backgroundColor: ok ? AppColors.success : AppColors.error,
            duration: Duration(seconds: ok ? 2 : 4),
          ),
        );
      }
      if (!ok &&
          mounted &&
          (err.contains('401') ||
              err.contains('Sessiya') ||
              err.contains('Invalid or expired') ||
              err.contains('tugadi'))) {
        ref.read(authStateProvider.notifier).sessionExpired();
        context.go('/login');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final canCreate = session.mobileConfig?.client.canCreate ?? false;
    final clientsAsync = ref.watch(filteredClientsProvider);
    final totalAll = ref.watch(clientsListProvider).valueOrNull?.length;
    final staleCatalog = ref.watch(agentStaleClientCatalogProvider).valueOrNull ?? false;
    final total = clientsAsync.valueOrNull?.length;
    final weekdayTab = ref.watch(effectiveWeekdayTabProvider);
    final inSearch = _searchCtrl.text.trim().isNotEmpty;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AgentAppBar(
        title: 'Тор. точки (${total ?? totalAll ?? '…'})',
        actions: [
          AgentIconButton(icon: Icons.search, onPressed: () => context.push('/search?from=/clients')),
          AgentIconButton(icon: Icons.map_outlined, onPressed: () => context.push('/map')),
          _syncing
              ? const Padding(
                  padding: EdgeInsets.all(8),
                  child: SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                  ),
                )
              : AgentIconButton(icon: Icons.sync, onPressed: _syncClients),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (!inSearch) const AgentDayTabs(),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
            child: _LinkedClientsBanner(
              count: total,
              loading: clientsAsync.isLoading,
              agentName: session.user?.name,
            ),
          ),
          if (staleCatalog)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Material(
                color: AppColors.warning.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
                child: Padding(
                  padding: const EdgeInsets.all(10),
                  child: Text(
                    'Eski katalog ($total ta). Yuqoridagi sinxron tugmasini bosing — faqat bog\'langan mijozlar qoladi.',
                    style: AppTypography.caption.copyWith(color: AppColors.warning),
                  ),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
            child: TextField(
              controller: _searchCtrl,
              focusNode: _searchFocus,
              onChanged: _runSearch,
              decoration: InputDecoration(
                hintText: 'Nom, kod, telefon...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: inSearch
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchCtrl.clear();
                          _runSearch('');
                        },
                      )
                    : null,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: inSearch
                ? (_searching
                    ? const Center(child: CircularProgressIndicator())
                    : _buildList(
                        _searchResults,
                        emptyHint: S.emptySearch,
                        allCount: totalAll ?? 0,
                        weekdayTab: weekdayTab,
                      ))
                : AgentDayTabSlideView(
                    child: clientsAsync.when(
                      data: (clients) => _buildList(
                        clients,
                        allCount: totalAll ?? 0,
                        weekdayTab: weekdayTab,
                      ),
                      loading: () => const Center(child: CircularProgressIndicator()),
                      error: (e, _) => AgentErrorPanel(
                        error: e,
                        onRetry: _syncClients,
                        onLogin: () {
                          ref.read(authStateProvider.notifier).sessionExpired();
                          context.go('/login');
                        },
                      ),
                    ),
                  ),
          ),
        ],
      ),
      floatingActionButton: canCreate
          ? FloatingActionButton.extended(
              heroTag: 'agent_clients_create_fab',
              onPressed: () => context.push('/clients/new'),
              icon: const Icon(Icons.person_add_outlined),
              label: const Text('Yangi mijoz'),
            )
          : null,
    );
  }

  String _emptyListMessage({
    String? emptyHint,
    required int allCount,
    required int weekdayTab,
  }) {
    if (emptyHint != null) return emptyHint;
    if (allCount > 0 && weekdayTab > 0) return S.emptyOutletsForDay;
    return S.emptyClients;
  }

  Widget _buildList(
    List<Map<String, dynamic>> clients, {
    String? emptyHint,
    int allCount = 0,
    int weekdayTab = 0,
  }) {
    if (clients.isEmpty) {
      return AgentEmptyState.fill(
        message: _emptyListMessage(
          emptyHint: emptyHint,
          allCount: allCount,
          weekdayTab: weekdayTab,
        ),
        action: SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: _syncing ? null : _syncClients,
            icon: _syncing
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.sync),
            label: const Text('Синхронизация'),
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () async {
        await _syncClients();
        ref.invalidate(filteredClientsProvider);
      },
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(12, 4, 12, 100),
        itemCount: clients.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (ctx, i) => _ClientListTile(
          client: clients[i],
          onTap: () {
            final id = clients[i]['id'];
            if (id is! int && id is! num) return;
            context.push('/clients/${(id as num).toInt()}');
          },
        ),
      ),
    );
  }
}

class _LinkedClientsBanner extends StatelessWidget {
  final int? count;
  final bool loading;
  final String? agentName;

  const _LinkedClientsBanner({this.count, this.loading = false, this.agentName});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          const Icon(Icons.link, size: 20, color: AppColors.primary),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'На экране',
                  style: AppTypography.bodyMedium.copyWith(
                    fontWeight: FontWeight.w600,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  loading
                      ? 'Загрузка…'
                      : count != null
                          ? '${agentName ?? 'Агент'} · $count'
                          : 'С учётом фильтра дня',
                  style: AppTypography.caption.copyWith(color: AppColors.textMuted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ClientListTile extends ConsumerWidget {
  final Map<String, dynamic> client;
  final VoidCallback onTap;

  const _ClientListTile({required this.client, required this.onTap});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final name = client['name']?.toString() ?? '';
    final code = client['client_code']?.toString().trim() ?? '';
    final phone = client['phone']?.toString() ?? '';
    final category = client['category']?.toString() ?? '';
    final isPending = client['is_active'] == 0 || client['is_active'] == false;
    final clientId = (client['id'] as num?)?.toInt();
    final showBalance = ref.watch(sessionProvider).mobileConfig?.client.showBalance ?? true;
    final debt = showBalance ? formatClientBalance(client) : '';
    final n = parseMoneyAmount(client['balance']);
    final debtColor = showBalance ? colorForClientBalance(n) : AppColors.textPrimary;

    final drafts = ref.watch(orderDraftsProvider).valueOrNull;
    final draft = clientId != null && drafts != null ? drafts[clientId] : null;

    return AgentOutletCard(
      name: name,
      subtitle: code.isNotEmpty ? code : (phone.isNotEmpty ? phone : '—'),
      grade: isPending ? 'Tasdiq' : (category.isNotEmpty ? category : null),
      trailing: debt,
      headerTrailing: draft != null
          ? OrderDraftHeaderBadge(
              draft: draft,
              onExpired: () => ref.invalidate(orderDraftsProvider),
            )
          : null,
      trailingColor: debtColor,
      onTap: onTap,
    );
  }
}
