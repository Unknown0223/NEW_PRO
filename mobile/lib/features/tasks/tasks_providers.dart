import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/tasks_api.dart';
import '../../core/auth/session.dart';
import '../../core/theme/app_colors.dart';

typedef TaskListKey = ({String scope, String status});

final tasksListProvider = FutureProvider.autoDispose.family<List<TaskItem>, TaskListKey>((ref, key) async {
  final slug = ref.watch(sessionProvider).tenantSlug ?? '';
  if (slug.isEmpty) return const [];
  return ref.read(tasksApiProvider).list(slug, scope: key.scope, status: key.status);
});

final taskDetailProvider = FutureProvider.autoDispose.family<TaskItem, int>((ref, id) async {
  final slug = ref.watch(sessionProvider).tenantSlug ?? '';
  return ref.read(tasksApiProvider).detail(slug, id);
});

final taskMetaProvider = FutureProvider.autoDispose<TaskMeta>((ref) async {
  final slug = ref.watch(sessionProvider).tenantSlug ?? '';
  if (slug.isEmpty) return const TaskMeta(types: [], assignees: [], canCreate: false);
  return ref.read(tasksApiProvider).meta(slug);
});

/// Faol topshiriqlar soni — menyu badge uchun.
final myActiveTasksCountProvider = FutureProvider.autoDispose<int>((ref) async {
  final list = await ref.watch(tasksListProvider((scope: 'mine', status: 'active')).future);
  return list.length;
});

void invalidateTasks(WidgetRef ref) {
  ref.invalidate(tasksListProvider);
  ref.invalidate(taskDetailProvider);
  ref.invalidate(myActiveTasksCountProvider);
}

String taskStatusLabel(TaskItem t) {
  if (t.overdue) return 'Просрочена';
  switch (t.status) {
    case 'open':
      return 'Новая';
    case 'in_progress':
      return 'В работе';
    case 'done':
      return 'Выполнена';
    case 'cancelled':
      return 'Отменена';
    default:
      return t.status;
  }
}

Color taskStatusColor(TaskItem t) {
  if (t.overdue) return AppColors.error;
  switch (t.status) {
    case 'in_progress':
      return AppColors.info;
    case 'done':
      return AppColors.success;
    case 'cancelled':
      return AppColors.textMuted;
    default:
      return AppColors.warning;
  }
}

String taskPriorityLabel(String p) => switch (p) { 'high' => 'Высокий', 'low' => 'Низкий', _ => 'Обычный' };

String taskRoleLabel(String role) =>
    switch (role) { 'agent' => 'Агент', 'expeditor' => 'Экспедитор', 'supervisor' => 'Супервайзер', _ => role };

String fmtTaskDate(DateTime? d) {
  if (d == null) return '—';
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(d.day)}.${two(d.month)}.${d.year} ${two(d.hour)}:${two(d.minute)}';
}

Color? parseHexColor(String? hex) {
  final s = hex?.replaceFirst('#', '').trim() ?? '';
  if (s.length != 6) return null;
  final v = int.tryParse(s, radix: 16);
  return v == null ? null : Color(0xFF000000 | v);
}

class TaskStatusPill extends StatelessWidget {
  final TaskItem task;
  const TaskStatusPill({super.key, required this.task});

  @override
  Widget build(BuildContext context) {
    final c = taskStatusColor(task);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: c.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
      child: Text(taskStatusLabel(task), style: TextStyle(color: c, fontSize: 11, fontWeight: FontWeight.w800)),
    );
  }
}
