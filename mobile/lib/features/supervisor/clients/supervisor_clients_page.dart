import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/supervisor_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../config/supervisor_config_enforcement.dart';
import '../shared/supervisor_ui.dart';

final _svClientsProvider = FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>((ref, q) async {
  final slug = ref.watch(sessionProvider).tenantSlug ?? '';
  if (slug.isEmpty) return [];
  return ref.read(supervisorApiProvider).listClients(slug, q: q.isEmpty ? null : q);
});

/// SVR — faqat o‘z agentlariga biriktirilgan mijozlar bazasi.
class SupervisorClientsPage extends ConsumerStatefulWidget {
  const SupervisorClientsPage({super.key});

  @override
  ConsumerState<SupervisorClientsPage> createState() => _SupervisorClientsPageState();
}

class _SupervisorClientsPageState extends ConsumerState<SupervisorClientsPage> {
  final _search = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const accent = AppColors.supervisorAccent;
    final policy = SupervisorConfigPolicy(ref.watch(sessionProvider).mobileConfig);
    final async = ref.watch(_svClientsProvider(_query));

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: supervisorAppBar(
        context,
        title: 'База клиентов',
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () => context.push('/sv-notifications'),
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(_svClientsProvider(_query)),
          ),
        ],
      ),
      floatingActionButton: policy.canCreateClient
          ? FloatingActionButton.extended(
              backgroundColor: AppColors.supervisorAccent,
              onPressed: () async {
                final ok = await context.push('/sv-clients/new');
                if (mounted && ok == true) {
                  ref.invalidate(_svClientsProvider(_query));
                }
              },
              icon: const Icon(Icons.add),
              label: const Text('Новая ТТ'),
            )
          : null,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
            child: TextField(
              controller: _search,
              decoration: InputDecoration(
                hintText: 'Поиск: имя, телефон, INN…',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                isDense: true,
              ),
              onSubmitted: (v) => setState(() => _query = v.trim()),
              textInputAction: TextInputAction.search,
            ),
          ),
          if (!policy.canEditClient)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              child: Text(
                'Редактирование отключено в конфигурации супервайзера',
                style: TextStyle(color: AppColors.warning, fontSize: 12),
              ),
            ),
          Expanded(
            child: async.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('$e', style: const TextStyle(color: AppColors.error))),
              data: (rows) {
                if (rows.isEmpty) {
                  return const Center(
                    child: Text(
                      'Нет клиентов у ваших агентов',
                      style: AppTypography.bodyMedium,
                    ),
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
                  itemCount: rows.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, i) {
                    final c = rows[i];
                    final id = (c['id'] as num?)?.toInt();
                    final name = c['name']?.toString() ?? '—';
                    final phone = c['phone']?.toString() ?? '';
                    final agents = (c['linked_agent_names'] as List?)?.map((e) => e.toString()).join(', ') ?? '';
                    final city = c['city']?.toString() ?? c['region']?.toString() ?? '';
                    return SvCard(
                      padding: EdgeInsets.zero,
                      child: ListTile(
                        title: Text(name, style: const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: Text(
                          [
                            if (phone.isNotEmpty) phone,
                            if (city.isNotEmpty) city,
                            if (agents.isNotEmpty) 'Агент: $agents',
                          ].join(' · '),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        trailing: Icon(
                          policy.canEditClient ? Icons.edit_outlined : Icons.chevron_right,
                          color: accent,
                        ),
                        onTap: id == null
                            ? null
                            : () async {
                                await context.push('/sv-clients/$id');
                                if (mounted) ref.invalidate(_svClientsProvider(_query));
                              },
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
