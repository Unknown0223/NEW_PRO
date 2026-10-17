import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/tasks_api.dart';
import '../../core/auth/session.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import 'task_complete_sheet.dart';
import 'tasks_providers.dart';

Uint8List? decodeDataUrl(String src) {
  final i = src.indexOf(',');
  final b64 = src.startsWith('data:') && i > 0 ? src.substring(i + 1) : src;
  try {
    return base64Decode(b64);
  } catch (_) {
    return null;
  }
}

class TaskDetailPage extends ConsumerStatefulWidget {
  final int taskId;
  const TaskDetailPage({super.key, required this.taskId});

  @override
  ConsumerState<TaskDetailPage> createState() => _TaskDetailPageState();
}

class _TaskDetailPageState extends ConsumerState<TaskDetailPage> {
  bool _busy = false;

  Future<void> _run(Future<TaskItem> Function(String slug) action, String okText) async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    setState(() => _busy = true);
    try {
      await action(slug);
      invalidateTasks(ref);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(okText)));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: AppColors.error));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancel(TaskItem t) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Отменить задачу?'),
        content: Text('«${t.title}»'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Нет')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Да, отменить')),
        ],
      ),
    );
    if (ok != true) return;
    await _run((slug) => ref.read(tasksApiProvider).cancel(slug, t.id), 'Задача отменена');
  }

  Future<void> _complete(TaskItem t) async {
    final done = await showTaskCompleteSheet(context, t);
    if (done == true) {
      invalidateTasks(ref);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Задача выполнена')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(taskDetailProvider(widget.taskId));
    final me = ref.watch(sessionProvider).user;
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: Text('Задача №${widget.taskId}')),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text('$e', style: const TextStyle(color: AppColors.error), textAlign: TextAlign.center),
          ),
        ),
        data: (t) {
          final mine = t.assignee?.id == me?.id;
          final creator = t.createdBy?.id == me?.id;
          return ListView(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 120),
            children: [
              Row(
                children: [
                  Expanded(child: Text(t.title, style: AppTypography.headlineSmall)),
                  TaskStatusPill(task: t),
                ],
              ),
              if ((t.description ?? '').trim().isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(t.description!.trim(), style: AppTypography.bodyMedium),
              ],
              const SizedBox(height: 14),
              _InfoCard(
                rows: [
                  if (t.typeName != null) ('Тип', t.typeName!),
                  ('Приоритет', taskPriorityLabel(t.priority)),
                  ('Срок', t.dueAt == null ? 'Без срока' : fmtTaskDate(t.dueAt)),
                  if (t.assignee != null) ('Исполнитель', '${t.assignee!.name} · ${taskRoleLabel(t.assignee!.role)}'),
                  if (t.createdBy != null) ('Поставил', t.createdBy!.name),
                  ('Создана', fmtTaskDate(t.createdAt)),
                  if (t.completedAt != null) ('Выполнена', fmtTaskDate(t.completedAt)),
                ],
              ),
              if (t.clientName != null) ...[
                const SizedBox(height: 10),
                Material(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(14),
                  child: ListTile(
                    leading: const Icon(Icons.storefront_outlined, color: AppColors.primary),
                    title: Text(t.clientName!, style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: (t.clientAddress ?? '').isNotEmpty ? Text(t.clientAddress!) : null,
                    trailing: me?.role == 'agent' && t.clientId != null ? const Icon(Icons.chevron_right) : null,
                    onTap: me?.role == 'agent' && t.clientId != null ? () => context.push('/clients/${t.clientId}') : null,
                  ),
                ),
              ],
              if (t.status == 'done') ...[
                const SizedBox(height: 14),
                Text('Результат', style: AppTypography.labelLarge.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 6),
                Text(
                  (t.resultComment ?? '').trim().isEmpty ? 'Без комментария' : t.resultComment!.trim(),
                  style: AppTypography.bodyMedium,
                ),
                if (t.resultPhotos.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final src in t.resultPhotos)
                        if (decodeDataUrl(src) case final bytes?)
                          ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: Image.memory(bytes, width: 150, height: 150, fit: BoxFit.cover),
                          ),
                    ],
                  ),
                ],
              ],
              const SizedBox(height: 20),
              if (mine && t.status == 'open')
                FilledButton.icon(
                  onPressed: _busy ? null : () => _run((s) => ref.read(tasksApiProvider).start(s, t.id), 'Задача в работе'),
                  icon: const Icon(Icons.play_arrow),
                  label: const Text('Начать'),
                  style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48), backgroundColor: AppColors.info),
                ),
              if (mine && t.isOpen) ...[
                const SizedBox(height: 10),
                FilledButton.icon(
                  onPressed: _busy ? null : () => _complete(t),
                  icon: const Icon(Icons.check_circle_outline),
                  label: const Text('Выполнить'),
                  style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48), backgroundColor: AppColors.success),
                ),
              ],
              if (creator && !mine && t.isOpen) ...[
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: _busy ? null : () => _cancel(t),
                  icon: const Icon(Icons.close, color: AppColors.error),
                  label: const Text('Отменить задачу', style: TextStyle(color: AppColors.error)),
                  style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final List<(String, String)> rows;
  const _InfoCard({required this.rows});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          for (final r in rows)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(width: 110, child: Text(r.$1, style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary))),
                  Expanded(child: Text(r.$2, style: AppTypography.bodySmall.copyWith(fontWeight: FontWeight.w600))),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
