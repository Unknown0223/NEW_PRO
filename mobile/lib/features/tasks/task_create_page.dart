import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/supervisor_api.dart';
import '../../core/api/tasks_api.dart';
import '../../core/auth/session.dart';
import '../../core/theme/app_colors.dart';
import 'tasks_providers.dart';

/// Supervayzer: o'z agentiga topshiriq berish.
class TaskCreatePage extends ConsumerStatefulWidget {
  const TaskCreatePage({super.key});

  @override
  ConsumerState<TaskCreatePage> createState() => _TaskCreatePageState();
}

class _TaskCreatePageState extends ConsumerState<TaskCreatePage> {
  final _title = TextEditingController();
  final _description = TextEditingController();
  String? _typeId;
  int? _assigneeId;
  String _priority = 'normal';
  DateTime? _dueAt;
  ({int id, String name})? _client;
  bool _saving = false;

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _pickDue() async {
    final now = DateTime.now();
    final d = await showDatePicker(
      context: context,
      initialDate: _dueAt ?? now,
      firstDate: now.subtract(const Duration(days: 1)),
      lastDate: now.add(const Duration(days: 365)),
    );
    if (d == null || !mounted) return;
    final t = await showTimePicker(context: context, initialTime: const TimeOfDay(hour: 18, minute: 0));
    if (!mounted) return;
    setState(() => _dueAt = DateTime(d.year, d.month, d.day, t?.hour ?? 18, t?.minute ?? 0));
  }

  Future<void> _pickClient() async {
    final picked = await showDialog<({int id, String name})>(context: context, builder: (_) => const _ClientSearchDialog());
    if (picked != null) setState(() => _client = picked);
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final slug = ref.read(sessionProvider).tenantSlug ?? '';
      await ref.read(tasksApiProvider).create(
            slug,
            title: _title.text.trim(),
            assigneeId: _assigneeId!,
            description: _description.text,
            typeRef: _typeId,
            priority: _priority,
            dueAt: _dueAt,
            clientId: _client?.id,
          );
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: AppColors.error));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final metaAsync = ref.watch(taskMetaProvider);
    final canSave = !_saving && _title.text.trim().isNotEmpty && _assigneeId != null;
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Новая задача')),
      body: metaAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e', style: const TextStyle(color: AppColors.error))),
        data: (meta) {
          if (meta.assignees.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text('К вам не привязан ни один агент — назначить задачу некому.', textAlign: TextAlign.center),
              ),
            );
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (meta.types.isNotEmpty) ...[
                DropdownButtonFormField<String?>(
                  initialValue: _typeId,
                  decoration: const InputDecoration(labelText: 'Тип задачи', border: OutlineInputBorder()),
                  items: [
                    const DropdownMenuItem(value: null, child: Text('— без типа —')),
                    for (final t in meta.types) DropdownMenuItem(value: t.id, child: Text(t.name)),
                  ],
                  onChanged: (v) => setState(() {
                    _typeId = v;
                    final name = meta.types.where((t) => t.id == v).firstOrNull?.name;
                    if (name != null && _title.text.trim().isEmpty) _title.text = name;
                  }),
                ),
                const SizedBox(height: 12),
              ],
              TextField(
                controller: _title,
                maxLength: 500,
                onChanged: (_) => setState(() {}),
                decoration: const InputDecoration(labelText: 'Что сделать *', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 4),
              TextField(
                controller: _description,
                maxLines: 3,
                maxLength: 4000,
                decoration: const InputDecoration(labelText: 'Подробности', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 4),
              DropdownButtonFormField<int>(
                initialValue: _assigneeId,
                decoration: const InputDecoration(labelText: 'Исполнитель *', border: OutlineInputBorder()),
                items: [for (final a in meta.assignees) DropdownMenuItem(value: a.id, child: Text(a.name))],
                onChanged: (v) => setState(() => _assigneeId = v),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _priority,
                decoration: const InputDecoration(labelText: 'Приоритет', border: OutlineInputBorder()),
                items: [
                  for (final p in const ['low', 'normal', 'high']) DropdownMenuItem(value: p, child: Text(taskPriorityLabel(p))),
                ],
                onChanged: (v) => setState(() => _priority = v ?? 'normal'),
              ),
              const SizedBox(height: 12),
              ListTile(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(4),
                  side: const BorderSide(color: AppColors.border),
                ),
                leading: const Icon(Icons.event),
                title: Text(_dueAt == null ? 'Срок не указан' : 'До ${fmtTaskDate(_dueAt)}'),
                trailing: _dueAt == null
                    ? const Icon(Icons.chevron_right)
                    : IconButton(icon: const Icon(Icons.clear), onPressed: () => setState(() => _dueAt = null)),
                onTap: _pickDue,
              ),
              const SizedBox(height: 12),
              ListTile(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(4),
                  side: const BorderSide(color: AppColors.border),
                ),
                leading: const Icon(Icons.storefront_outlined),
                title: Text(_client?.name ?? 'Клиент (необязательно)'),
                trailing: _client == null
                    ? const Icon(Icons.chevron_right)
                    : IconButton(icon: const Icon(Icons.clear), onPressed: () => setState(() => _client = null)),
                onTap: _pickClient,
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: canSave ? _save : null,
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                  backgroundColor: AppColors.supervisorAccent,
                ),
                child: Text(_saving ? 'Сохранение…' : 'Назначить задачу'),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _ClientSearchDialog extends ConsumerStatefulWidget {
  const _ClientSearchDialog();

  @override
  ConsumerState<_ClientSearchDialog> createState() => _ClientSearchDialogState();
}

class _ClientSearchDialogState extends ConsumerState<_ClientSearchDialog> {
  Timer? _debounce;
  List<Map<String, dynamic>> _rows = const [];
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _search('');
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _search(String q) async {
    setState(() => _loading = true);
    try {
      final slug = ref.read(sessionProvider).tenantSlug ?? '';
      final rows = await ref.read(supervisorApiProvider).listClients(slug, q: q, limit: 50);
      if (mounted) setState(() => _rows = rows);
    } catch (_) {
      if (mounted) setState(() => _rows = const []);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Клиент'),
      contentPadding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      content: SizedBox(
        width: double.maxFinite,
        height: 420,
        child: Column(
          children: [
            TextField(
              autofocus: true,
              decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Название, телефон…'),
              onChanged: (v) {
                _debounce?.cancel();
                _debounce = Timer(const Duration(milliseconds: 350), () => _search(v));
              },
            ),
            const SizedBox(height: 8),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _rows.isEmpty
                      ? const Center(child: Text('Ничего не найдено'))
                      : ListView.builder(
                          itemCount: _rows.length,
                          itemBuilder: (context, i) {
                            final r = _rows[i];
                            final id = (r['id'] as num?)?.toInt();
                            final name = r['name']?.toString() ?? '';
                            return ListTile(
                              dense: true,
                              title: Text(name),
                              subtitle: (r['address']?.toString() ?? '').isNotEmpty ? Text(r['address'].toString()) : null,
                              onTap: id == null ? null : () => Navigator.pop(context, (id: id, name: name)),
                            );
                          },
                        ),
            ),
          ],
        ),
      ),
      actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Закрыть'))],
    );
  }
}
