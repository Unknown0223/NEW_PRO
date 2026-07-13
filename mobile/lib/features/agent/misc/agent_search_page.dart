import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/database/app_database.dart';
import '../../../core/clients/client_outlet_filters.dart';
import '../../../core/format/money_display.dart';
import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';

/// Поиск клиентов (shablon SearchScreen).
class AgentSearchPage extends ConsumerStatefulWidget {
  const AgentSearchPage({super.key});

  @override
  ConsumerState<AgentSearchPage> createState() => _AgentSearchPageState();
}

class _AgentSearchPageState extends ConsumerState<AgentSearchPage> {
  final _ctrl = TextEditingController();
  List<Map<String, dynamic>> _all = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
    _ctrl.addListener(() => setState(() {}));
  }

  Future<void> _load() async {
    final rows = await AppDatabase().getAllClients();
    if (mounted) {
      setState(() {
        _all = rows;
        _loading = false;
      });
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  String get _backTo => GoRouterState.of(context).uri.queryParameters['from'] ?? '/clients';

  List<Map<String, dynamic>> get _filtered {
    final q = _ctrl.text.trim().toLowerCase();
    if (q.isEmpty) return _all;
    return _all.where((c) {
      final name = '${c['name'] ?? ''}'.toLowerCase();
      final owner = '${c['owner_name'] ?? c['contact_name'] ?? ''}'.toLowerCase();
      return name.contains(q) || owner.contains(q);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          Material(
            color: Colors.white,
            borderRadius: const BorderRadius.vertical(bottom: Radius.circular(18)),
            elevation: 1,
            child: SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
                child: Row(
                  children: [
                    AgentIconButton(
                      icon: Icons.arrow_back,
                      onPressed: () => context.go(_backTo),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: _ctrl,
                        autofocus: true,
                        decoration: const InputDecoration(
                          hintText: 'Поиск ...',
                          border: InputBorder.none,
                          isDense: true,
                          contentPadding: EdgeInsets.symmetric(vertical: 8),
                        ),
                        style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w500),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                : _filtered.isEmpty
                    ? const Center(child: AgentEmptyState(message: S.emptySearch))
                    : ListView.builder(
                        padding: const EdgeInsets.fromLTRB(12, 12, 12, 80),
                        itemCount: _filtered.length,
                        itemBuilder: (_, i) {
                          final c = _filtered[i];
                          final id = c['id'];
                          final balance = parseMoneyAmount(c['balance']);
                          final debtColor = colorForClientBalance(balance);
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: AgentOutletCard(
                              name: '${c['name'] ?? '—'}',
                              subtitle: '${c['owner_name'] ?? c['contact_name'] ?? c['client_code'] ?? ''}',
                              grade: '${c['grade'] ?? 'B'}',
                              trailing: formatClientBalanceAmount(balance),
                              trailingColor: debtColor,
                              onTap: id != null
                                  ? () => context.push('/clients/$id')
                                  : null,
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }

}
