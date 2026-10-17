import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/tasks_api.dart';
import '../../core/auth/session.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import 'tasks_providers.dart';

/// Topshiriqlar ro'yxati — agent / ekspeditor / supervayzer (supervayzer: «Мне» va «Команда»).
class TasksPage extends ConsumerStatefulWidget {
  const TasksPage({super.key});

  @override
  ConsumerState<TasksPage> createState() => _TasksPageState();
}

class _TasksPageState extends ConsumerState<TasksPage> {
  String _scope = 'mine';
  String _status = 'active';

  @override
  Widget build(BuildContext context) {
    final role = ref.watch(sessionProvider).user?.role ?? 'agent';
    final isSv = role == 'supervisor';
    final key = (scope: isSv ? _scope : 'mine', status: _status);
    final async = ref.watch(tasksListProvider(key));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        leading: context.canPop()
            ? null
            : IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.go('/home')),
        title: const Text('Задачи'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: () => invalidateTasks(ref)),
        ],
      ),
      floatingActionButton: isSv
          ? FloatingActionButton.extended(
              backgroundColor: AppColors.supervisorAccent,
              foregroundColor: Colors.white,
              onPressed: () async {
                final created = await context.push<bool>('/tasks/new');
                if (created == true) invalidateTasks(ref);
              },
              icon: const Icon(Icons.add),
              label: const Text('Новая задача'),
            )
          : null,
      body: Column(
        children: [
          if (isSv)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
              child: SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'mine', label: Text('Мне'), icon: Icon(Icons.person_outline)),
                  ButtonSegment(value: 'team', label: Text('Команда'), icon: Icon(Icons.groups_outlined)),
                ],
                selected: {_scope},
                onSelectionChanged: (s) => setState(() => _scope = s.first),
              ),
            ),
          SizedBox(
            height: 52,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 4),
              children: [
                for (final f in const [
                  ('active', 'Активные'),
                  ('overdue', 'Просроченные'),
                  ('done', 'Выполненные'),
                  ('cancelled', 'Отменённые'),
                ])
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(f.$2),
                      selected: _status == f.$1,
                      onSelected: (_) => setState(() => _status = f.$1),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(tasksListProvider(key));
                await ref.read(tasksListProvider(key).future);
              },
              child: async.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => ListView(
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text('$e', style: const TextStyle(color: AppColors.error), textAlign: TextAlign.center),
                    ),
                  ],
                ),
                data: (list) {
                  if (list.isEmpty) {
                    return ListView(
                      children: const [
                        Padding(
                          padding: EdgeInsets.only(top: 80),
                          child: Center(child: Text('Задач нет', style: AppTypography.bodyMedium)),
                        ),
                      ],
                    );
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.fromLTRB(12, 4, 12, 100),
                    itemCount: list.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, i) => _TaskCard(
                      task: list[i],
                      showAssignee: isSv && _scope == 'team',
                      onTap: () async {
                        await context.push('/tasks/${list[i].id}');
                        invalidateTasks(ref);
                      },
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TaskCard extends StatelessWidget {
  final TaskItem task;
  final bool showAssignee;
  final VoidCallback onTap;
  const _TaskCard({required this.task, required this.showAssignee, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final typeColor = parseHexColor(task.typeColor) ?? AppColors.primary;
    final sub = <String>[
      if (task.typeName != null) task.typeName!,
      if (task.clientName != null) task.clientName!,
      if (showAssignee && task.assignee != null) task.assignee!.name,
    ].join(' · ');
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border(left: BorderSide(color: typeColor, width: 4)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  if (task.priority == 'high')
                    const Padding(
                      padding: EdgeInsets.only(right: 6),
                      child: Icon(Icons.priority_high, color: AppColors.error, size: 18),
                    ),
                  Expanded(
                    child: Text(task.title, style: AppTypography.labelLarge.copyWith(fontWeight: FontWeight.w800)),
                  ),
                  TaskStatusPill(task: task),
                ],
              ),
              if (sub.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(sub, style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary)),
              ],
              const SizedBox(height: 6),
              Row(
                children: [
                  Icon(Icons.schedule, size: 14, color: task.overdue ? AppColors.error : AppColors.textMuted),
                  const SizedBox(width: 4),
                  Text(
                    task.dueAt == null ? 'Без срока' : 'до ${fmtTaskDate(task.dueAt)}',
                    style: AppTypography.caption.copyWith(
                      color: task.overdue ? AppColors.error : AppColors.textMuted,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const Spacer(),
                  if (task.resultPhotoCount > 0) ...[
                    const Icon(Icons.photo_camera_outlined, size: 14, color: AppColors.textMuted),
                    const SizedBox(width: 2),
                    Text('${task.resultPhotoCount}', style: AppTypography.caption),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
