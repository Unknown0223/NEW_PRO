import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_exceptions.dart';
import 'dio_client.dart';

const _taskErrors = <String, String>{
  'TaskClosed': 'Задача уже закрыта.',
  'NotFound': 'Задача не найдена.',
  'AssigneeNotFound': 'Исполнитель не найден или неактивен.',
  'ClientNotFound': 'Клиент не найден.',
  'ForbiddenScope': 'Этому сотруднику нельзя назначить задачу.',
  'ForbiddenRole': 'Создавать задачи может только супервайзер.',
};

class TaskPerson {
  final int id;
  final String name;
  final String role;
  const TaskPerson({required this.id, required this.name, required this.role});

  static TaskPerson? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    final id = (raw['id'] as num?)?.toInt();
    if (id == null) return null;
    return TaskPerson(id: id, name: raw['name']?.toString() ?? '', role: raw['role']?.toString() ?? '');
  }
}

class TaskItem {
  final int id;
  final String title;
  final String? description;
  final String status;
  final String priority;
  final DateTime? dueAt;
  final bool overdue;
  final DateTime? createdAt;
  final DateTime? completedAt;
  final String? typeName;
  final String? typeColor;
  final TaskPerson? assignee;
  final TaskPerson? createdBy;
  final int? clientId;
  final String? clientName;
  final String? clientAddress;
  final double? clientLat;
  final double? clientLng;
  final String? resultComment;
  final int resultPhotoCount;
  final List<String> resultPhotos;

  const TaskItem({
    required this.id,
    required this.title,
    required this.status,
    required this.priority,
    this.description,
    this.dueAt,
    this.overdue = false,
    this.createdAt,
    this.completedAt,
    this.typeName,
    this.typeColor,
    this.assignee,
    this.createdBy,
    this.clientId,
    this.clientName,
    this.clientAddress,
    this.clientLat,
    this.clientLng,
    this.resultComment,
    this.resultPhotoCount = 0,
    this.resultPhotos = const [],
  });

  bool get isOpen => status == 'open' || status == 'in_progress';

  factory TaskItem.fromJson(Map<String, dynamic> j) {
    DateTime? dt(dynamic v) => v == null ? null : DateTime.tryParse(v.toString())?.toLocal();
    final type = j['task_type'];
    final client = j['client'];
    final photos = j['result_photos'];
    return TaskItem(
      id: (j['id'] as num).toInt(),
      title: j['title']?.toString() ?? '',
      description: j['description']?.toString(),
      status: j['status']?.toString() ?? 'open',
      priority: j['priority']?.toString() ?? 'normal',
      dueAt: dt(j['due_at']),
      overdue: j['overdue'] == true,
      createdAt: dt(j['created_at']),
      completedAt: dt(j['completed_at']),
      typeName: type is Map ? type['name']?.toString() : null,
      typeColor: type is Map ? type['color']?.toString() : null,
      assignee: TaskPerson.fromJson(j['assignee']),
      createdBy: TaskPerson.fromJson(j['created_by']),
      clientId: client is Map ? (client['id'] as num?)?.toInt() : null,
      clientName: client is Map ? client['name']?.toString() : null,
      clientAddress: client is Map ? client['address']?.toString() : null,
      clientLat: client is Map ? (client['latitude'] as num?)?.toDouble() : null,
      clientLng: client is Map ? (client['longitude'] as num?)?.toDouble() : null,
      resultComment: j['result_comment']?.toString(),
      resultPhotoCount: (j['result_photo_count'] as num?)?.toInt() ?? 0,
      resultPhotos: photos is List ? photos.map((e) => e.toString()).toList() : const [],
    );
  }
}

class TaskMeta {
  final List<({String id, String name})> types;
  final List<TaskPerson> assignees;
  final bool canCreate;
  const TaskMeta({required this.types, required this.assignees, required this.canCreate});
}

/// Topshiriqlar — `/api/:slug/mobile/tasks`.
class TasksApi {
  final Dio _dio;
  TasksApi(this._dio);

  Future<List<TaskItem>> list(String slug, {String scope = 'mine', String? status}) async {
    try {
      final r = await _dio.get(
        '/api/$slug/mobile/tasks',
        queryParameters: {'scope': scope, 'limit': 200, if (status != null) 'status': status},
      );
      final data = r.data is Map ? (r.data as Map)['data'] : null;
      if (data is! List) return const [];
      return data.whereType<Map>().map((e) => TaskItem.fromJson(Map<String, dynamic>.from(e))).toList();
    } on DioException catch (e) {
      throw mapDioException(e, extraCodes: _taskErrors);
    }
  }

  Future<TaskMeta> meta(String slug) async {
    try {
      final r = await _dio.get('/api/$slug/mobile/tasks/meta');
      final d = r.data is Map ? (r.data as Map)['data'] : null;
      if (d is! Map) return const TaskMeta(types: [], assignees: [], canCreate: false);
      final types = <({String id, String name})>[];
      for (final t in (d['types'] as List? ?? const [])) {
        if (t is Map && t['id'] != null) types.add((id: t['id'].toString(), name: t['name']?.toString() ?? ''));
      }
      final assignees = <TaskPerson>[];
      for (final a in (d['assignees'] as List? ?? const [])) {
        final p = TaskPerson.fromJson(a);
        if (p != null) assignees.add(p);
      }
      return TaskMeta(types: types, assignees: assignees, canCreate: d['can_create'] == true);
    } on DioException catch (e) {
      throw mapDioException(e, extraCodes: _taskErrors);
    }
  }

  Future<TaskItem> detail(String slug, int id) => _single(() => _dio.get('/api/$slug/mobile/tasks/$id'));

  Future<TaskItem> create(
    String slug, {
    required String title,
    required int assigneeId,
    String? description,
    String? typeRef,
    String priority = 'normal',
    DateTime? dueAt,
    int? clientId,
  }) =>
      _single(
        () => _dio.post('/api/$slug/mobile/tasks', data: {
          'title': title,
          'assignee_user_id': assigneeId,
          if (description != null && description.trim().isNotEmpty) 'description': description.trim(),
          if (typeRef != null) 'task_type_ref': typeRef,
          'priority': priority,
          if (dueAt != null) 'due_at': dueAt.toUtc().toIso8601String(),
          if (clientId != null) 'client_id': clientId,
        },),
      );

  Future<TaskItem> start(String slug, int id) => _single(() => _dio.post('/api/$slug/mobile/tasks/$id/start', data: {}));

  Future<TaskItem> cancel(String slug, int id) => _single(() => _dio.post('/api/$slug/mobile/tasks/$id/cancel', data: {}));

  Future<TaskItem> complete(String slug, int id, {String? comment, List<String> photos = const []}) => _single(
        () => _dio.post(
          '/api/$slug/mobile/tasks/$id/complete',
          data: {
            if (comment != null && comment.trim().isNotEmpty) 'comment': comment.trim(),
            if (photos.isNotEmpty) 'photos': photos,
          },
          options: Options(sendTimeout: const Duration(minutes: 2), receiveTimeout: const Duration(minutes: 2)),
        ),
      );

  Future<TaskItem> _single(Future<Response<dynamic>> Function() call) async {
    try {
      final r = await call();
      final d = r.data is Map ? (r.data as Map)['data'] : null;
      if (d is! Map) throw const ApiException(message: 'Пустой ответ сервера');
      return TaskItem.fromJson(Map<String, dynamic>.from(d));
    } on DioException catch (e) {
      throw mapDioException(e, extraCodes: _taskErrors);
    }
  }
}

final tasksApiProvider = Provider<TasksApi>((ref) => TasksApi(ref.read(dioProvider)));
