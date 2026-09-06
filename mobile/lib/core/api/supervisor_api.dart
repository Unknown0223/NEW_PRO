import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_exceptions.dart';
import 'dio_client.dart';
import 'mobile_api.dart' show AgentKpiResult;

class SupervisorApi {
  final Dio _dio;
  SupervisorApi(this._dio);

  Future<Map<String, dynamic>> getSummary(String slug) async {
    try {
      final r = await _dio.get('/api/$slug/mobile/supervisor/summary');
      return r.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<Map<String, dynamic>> getVisits(String slug, {int page = 1, int limit = 50, String? date}) async {
    try {
      final qp = <String, dynamic>{'page': page, 'limit': limit};
      if (date != null && date.isNotEmpty) qp['date'] = date;
      final r = await _dio.get(
        '/api/$slug/mobile/supervisor/visits',
        queryParameters: qp,
      );
      return r.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<Map<String, dynamic>> getProducts(String slug) async {
    try {
      final r = await _dio.get('/api/$slug/mobile/supervisor/products');
      return r.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<List<AgentLocationPin>> getAgentLocations(String slug) async {
    try {
      final r = await _dio.get('/api/$slug/mobile/supervisor/agent-locations');
      final list = r.data['data'] as List? ?? [];
      return list
          .map((e) => AgentLocationPin.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<List<SupervisorLinkedAgent>> getLinkedAgents(String slug) async {
    try {
      final r = await _dio.get('/api/$slug/mobile/supervisor/agents');
      final list = r.data['data'] as List? ?? [];
      return list
          .map((e) => SupervisorLinkedAgent.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<SupervisorTeamKpi> getTeamKpi(String slug, {String? month}) async {
    try {
      final r = await _dio.get(
        '/api/$slug/mobile/supervisor/team-kpi',
        queryParameters: {
          if (month != null && month.isNotEmpty) 'month': month,
        },
      );
      return SupervisorTeamKpi.fromJson(r.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<AgentKpiResult> getAgentKpi(
    String slug, {
    required int agentId,
    String? month,
  }) async {
    try {
      final r = await _dio.get(
        '/api/$slug/mobile/supervisor/agent-kpi',
        queryParameters: {
          'agent_id': agentId,
          if (month != null && month.isNotEmpty) 'month': month,
        },
      );
      return AgentKpiResult.fromJson(r.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<List<Map<String, dynamic>>> listClients(String slug, {String? q, int limit = 200}) async {
    try {
      final r = await _dio.get(
        '/api/$slug/mobile/supervisor/clients',
        queryParameters: {
          if (q != null && q.trim().isNotEmpty) 'q': q.trim(),
          'limit': limit,
        },
      );
      final list = r.data['data'] as List? ?? [];
      return list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<Map<String, dynamic>> getClient(String slug, int clientId) async {
    try {
      final r = await _dio.get('/api/$slug/mobile/supervisor/clients/$clientId');
      return Map<String, dynamic>.from(r.data as Map);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<Map<String, dynamic>> patchClient(
    String slug,
    int clientId,
    Map<String, dynamic> body,
  ) async {
    try {
      final r = await _dio.patch('/api/$slug/mobile/supervisor/clients/$clientId', data: body);
      return Map<String, dynamic>.from(r.data as Map);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<({List<Map<String, dynamic>> data, int unread})> listNotifications(
    String slug, {
    bool unreadOnly = false,
    int limit = 40,
  }) async {
    try {
      final r = await _dio.get(
        '/api/$slug/notifications',
        queryParameters: {
          if (unreadOnly) 'unread_only': 'true',
          'limit': limit,
        },
      );
      final map = r.data as Map;
      final list = (map['data'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
      final unread = (map['unread_count'] as num?)?.toInt() ?? 0;
      return (data: list, unread: unread);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<void> markNotificationRead(String slug, int id) async {
    try {
      await _dio.patch('/api/$slug/notifications/$id/read');
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  ApiException _map(DioException e) {
    if (e.type == DioExceptionType.connectionError || e.type == DioExceptionType.connectionTimeout) {
      return const NetworkException();
    }
    return mapDioException(e);
  }
}

final supervisorApiProvider = Provider<SupervisorApi>((ref) => SupervisorApi(ref.read(dioProvider)));

class AgentLocationPin {
  final int agentId;
  final String? agentName;
  final double? latitude;
  final double? longitude;
  final String? recordedAt;

  AgentLocationPin({
    required this.agentId,
    this.agentName,
    this.latitude,
    this.longitude,
    this.recordedAt,
  });

  factory AgentLocationPin.fromJson(Map<String, dynamic> j) => AgentLocationPin(
    agentId: j['agent_id'] as int? ?? j['user_id'] as int? ?? 0,
    agentName: j['agent_name']?.toString() ?? j['name']?.toString() ?? '',
    latitude: (j['latitude'] as num?)?.toDouble(),
    longitude: (j['longitude'] as num?)?.toDouble(),
    recordedAt: j['recorded_at']?.toString() ?? j['created_at']?.toString(),
  );
}

class SupervisorLinkedAgent {
  final int id;
  final String name;
  final String? code;
  final String login;

  const SupervisorLinkedAgent({
    required this.id,
    required this.name,
    this.code,
    required this.login,
  });

  factory SupervisorLinkedAgent.fromJson(Map<String, dynamic> j) => SupervisorLinkedAgent(
        id: j['id'] as int? ?? 0,
        name: j['name']?.toString() ?? 'Агент',
        code: j['code']?.toString(),
        login: j['login']?.toString() ?? '',
      );

  String get label {
    final c = code?.trim();
    if (c != null && c.isNotEmpty) return '$name · $c';
    return name;
  }
}

class SupervisorTeamKpi {
  final String month;
  final String today;
  final int agentCount;
  final double todaySales;
  final double todayPlan;
  final double? todayPct;
  final double todayRemaining;
  final int todayVisits;
  final int todayOrders;
  final double monthPlan;
  final double monthFact;
  final double? monthPct;
  final double monthRemaining;
  final bool hasPlans;
  final double todayPlanSum;
  final double carryForward;
  final int workingDaysTotal;
  final int remainingWorkingDays;
  final List<SupervisorTeamDay> days;
  final List<SupervisorTeamWeekDay> week;
  final List<SupervisorAgentShare> todayShare;
  final List<SupervisorAgentShare> monthShare;
  final List<SupervisorAgentKpiRow> agents;

  const SupervisorTeamKpi({
    required this.month,
    required this.today,
    required this.agentCount,
    required this.todaySales,
    required this.todayPlan,
    this.todayPct,
    required this.todayRemaining,
    required this.todayVisits,
    required this.todayOrders,
    required this.monthPlan,
    required this.monthFact,
    this.monthPct,
    required this.monthRemaining,
    required this.hasPlans,
    required this.todayPlanSum,
    required this.carryForward,
    required this.workingDaysTotal,
    required this.remainingWorkingDays,
    required this.days,
    required this.week,
    required this.todayShare,
    required this.monthShare,
    required this.agents,
  });

  factory SupervisorTeamKpi.empty() => const SupervisorTeamKpi(
        month: '',
        today: '',
        agentCount: 0,
        todaySales: 0,
        todayPlan: 0,
        todayRemaining: 0,
        todayVisits: 0,
        todayOrders: 0,
        monthPlan: 0,
        monthFact: 0,
        monthRemaining: 0,
        hasPlans: false,
        todayPlanSum: 0,
        carryForward: 0,
        workingDaysTotal: 0,
        remainingWorkingDays: 0,
        days: [],
        week: [],
        todayShare: [],
        monthShare: [],
        agents: [],
      );

  factory SupervisorTeamKpi.fromJson(Map<String, dynamic> j) {
    final period = j['period'] is Map ? Map<String, dynamic>.from(j['period'] as Map) : <String, dynamic>{};
    final team = j['team'] is Map ? Map<String, dynamic>.from(j['team'] as Map) : <String, dynamic>{};
    final today = team['today'] is Map ? Map<String, dynamic>.from(team['today'] as Map) : <String, dynamic>{};
    final month = team['month'] is Map ? Map<String, dynamic>.from(team['month'] as Map) : <String, dynamic>{};
    final route = team['daily_route'] is Map ? Map<String, dynamic>.from(team['daily_route'] as Map) : <String, dynamic>{};
    final dist = team['distribution'] is Map ? Map<String, dynamic>.from(team['distribution'] as Map) : <String, dynamic>{};
    final days = (route['days'] as List? ?? [])
        .whereType<Map>()
        .map((e) => SupervisorTeamDay.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    final week = (team['week'] as List? ?? [])
        .whereType<Map>()
        .map((e) => SupervisorTeamWeekDay.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    final todayShare = (dist['today'] as List? ?? [])
        .whereType<Map>()
        .map((e) => SupervisorAgentShare.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    final monthShare = (dist['month'] as List? ?? [])
        .whereType<Map>()
        .map((e) => SupervisorAgentShare.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    final agents = (j['agents'] as List? ?? [])
        .whereType<Map>()
        .map((e) => SupervisorAgentKpiRow.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    return SupervisorTeamKpi(
      month: period['month']?.toString() ?? '',
      today: period['today']?.toString() ?? '',
      agentCount: team['agent_count'] as int? ?? agents.length,
      todaySales: (today['sales_sum'] as num?)?.toDouble() ?? 0,
      todayPlan: (today['plan_day_sum'] as num?)?.toDouble() ?? 0,
      todayPct: (today['execution_pct'] as num?)?.toDouble(),
      todayRemaining: (today['remaining_sum'] as num?)?.toDouble() ?? 0,
      todayVisits: today['visits'] as int? ?? 0,
      todayOrders: today['orders_count'] as int? ?? 0,
      monthPlan: (month['plan_sum'] as num?)?.toDouble() ?? 0,
      monthFact: (month['fact_sum'] as num?)?.toDouble() ?? 0,
      monthPct: (month['execution_pct'] as num?)?.toDouble(),
      monthRemaining: (month['remaining_sum'] as num?)?.toDouble() ?? 0,
      hasPlans: month['has_plans'] == true,
      todayPlanSum: (route['today_plan_sum'] as num?)?.toDouble() ?? 0,
      carryForward: (route['carry_forward_sum'] as num?)?.toDouble() ?? 0,
      workingDaysTotal: route['working_days_total'] as int? ?? 0,
      remainingWorkingDays: route['remaining_working_days'] as int? ?? 0,
      days: days,
      week: week,
      todayShare: todayShare,
      monthShare: monthShare,
      agents: agents,
    );
  }
}

class SupervisorTeamWeekDay {
  final String date;
  final int weekday;
  final double salesSum;
  final double planSum;
  final double? executionPct;

  const SupervisorTeamWeekDay({
    required this.date,
    required this.weekday,
    required this.salesSum,
    required this.planSum,
    this.executionPct,
  });

  factory SupervisorTeamWeekDay.fromJson(Map<String, dynamic> j) => SupervisorTeamWeekDay(
        date: j['date']?.toString() ?? '',
        weekday: (j['weekday'] as num?)?.toInt() ?? 1,
        salesSum: (j['sales_sum'] as num?)?.toDouble() ?? 0,
        planSum: (j['plan_sum'] as num?)?.toDouble() ?? 0,
        executionPct: (j['execution_pct'] as num?)?.toDouble(),
      );
}

class SupervisorAgentShare {
  final int id;
  final String name;
  final String? code;
  final double salesSum;
  final double planSum;
  final double? executionPct;
  final double sharePct;

  const SupervisorAgentShare({
    required this.id,
    required this.name,
    this.code,
    required this.salesSum,
    required this.planSum,
    this.executionPct,
    required this.sharePct,
  });

  factory SupervisorAgentShare.fromJson(Map<String, dynamic> j) => SupervisorAgentShare(
        id: j['id'] as int? ?? 0,
        name: j['name']?.toString() ?? 'Агент',
        code: j['code']?.toString(),
        salesSum: (j['sales_sum'] as num?)?.toDouble() ?? 0,
        planSum: (j['plan_sum'] as num?)?.toDouble() ?? 0,
        executionPct: (j['execution_pct'] as num?)?.toDouble(),
        sharePct: (j['share_pct'] as num?)?.toDouble() ?? 0,
      );
}

class SupervisorTeamDay {
  final String date;
  final bool isWorkingDay;
  final bool isToday;
  final bool isFuture;
  final double planSum;
  final double factSum;
  final double? executionPct;
  final double remainingSum;
  final String status;

  const SupervisorTeamDay({
    required this.date,
    required this.isWorkingDay,
    required this.isToday,
    required this.isFuture,
    required this.planSum,
    required this.factSum,
    this.executionPct,
    required this.remainingSum,
    this.status = '',
  });

  factory SupervisorTeamDay.fromJson(Map<String, dynamic> j) => SupervisorTeamDay(
        date: j['date']?.toString() ?? '',
        isWorkingDay: j['is_working_day'] == true,
        isToday: j['is_today'] == true,
        isFuture: j['is_future'] == true,
        planSum: (j['plan_sum'] as num?)?.toDouble() ?? 0,
        factSum: (j['fact_sum'] as num?)?.toDouble() ?? 0,
        executionPct: (j['execution_pct'] as num?)?.toDouble(),
        remainingSum: (j['remaining_sum'] as num?)?.toDouble() ?? 0,
        status: j['status']?.toString() ?? '',
      );
}

class SupervisorAgentKpiRow {
  final int id;
  final String name;
  final String? code;
  final AgentKpiResult kpi;

  const SupervisorAgentKpiRow({
    required this.id,
    required this.name,
    this.code,
    required this.kpi,
  });

  factory SupervisorAgentKpiRow.fromJson(Map<String, dynamic> j) => SupervisorAgentKpiRow(
        id: j['id'] as int? ?? 0,
        name: j['name']?.toString() ?? 'Агент',
        code: j['code']?.toString(),
        kpi: AgentKpiResult.fromJson(
          j['kpi'] is Map ? Map<String, dynamic>.from(j['kpi'] as Map) : <String, dynamic>{},
        ),
      );
}
