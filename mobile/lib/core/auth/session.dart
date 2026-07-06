import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../api/auth_api.dart';
import '../api/dio_client.dart';
import '../config/mobile_config.dart';
import '../config/permissions.dart';
import '../config/tenant_references.dart';
import '../config/agent_cities.dart';
import '../config/agent_limits.dart';

class SessionState {
  final AuthUser? user;
  final String? tenantSlug;
  final String? tenantName;
  final PermissionSet permissions;
  final MobileConfig? mobileConfig;
  final TenantReferences? tenantReferences;
  final AgentLimits agentLimits;
  final List<AgentCityOption> agentCities;
  final List<String> priceTypes;
  final String? lastSyncAt;
  final bool bootstrapped;

  const SessionState({
    this.user,
    this.tenantSlug,
    this.tenantName,
    this.permissions = PermissionSet.empty,
    this.mobileConfig,
    this.tenantReferences,
    this.agentLimits = const AgentLimits(),
    this.agentCities = const [],
    this.priceTypes = const ['default'],
    this.lastSyncAt,
    this.bootstrapped = false,
  });

  SessionState copyWith({
    AuthUser? user,
    String? tenantSlug,
    String? tenantName,
    PermissionSet? permissions,
    MobileConfig? mobileConfig,
    TenantReferences? tenantReferences,
    AgentLimits? agentLimits,
    List<AgentCityOption>? agentCities,
    List<String>? priceTypes,
    String? lastSyncAt,
    bool? bootstrapped,
  }) {
    return SessionState(
      user: user ?? this.user,
      tenantSlug: tenantSlug ?? this.tenantSlug,
      tenantName: tenantName ?? this.tenantName,
      permissions: permissions ?? this.permissions,
      mobileConfig: mobileConfig ?? this.mobileConfig,
      tenantReferences: tenantReferences ?? this.tenantReferences,
      agentLimits: agentLimits ?? this.agentLimits,
      agentCities: agentCities ?? this.agentCities,
      priceTypes: priceTypes ?? this.priceTypes,
      lastSyncAt: lastSyncAt ?? this.lastSyncAt,
      bootstrapped: bootstrapped ?? this.bootstrapped,
    );
  }

  bool get isLoggedIn => user != null;
}

class SessionManager extends StateNotifier<SessionState> {
  final FlutterSecureStorage _storage;

  SessionManager(this._storage) : super(const SessionState());

  Future<void> setUser(AuthUser user, {String? slug, String? tenantName}) async {
    await _storage.write(key: 'uid', value: user.id.toString());
    await _storage.write(key: 'urole', value: user.role);
    await _storage.write(key: 'uslug', value: slug ?? user.tenantSlug ?? '');
    if (tenantName != null && tenantName.isNotEmpty) {
      await _storage.write(key: 'utname', value: tenantName);
    }
    await _storage.write(key: 'uname', value: user.name);
    await _storage.write(key: 'ulogin', value: user.login);
    await _storage.write(key: 'uslot', value: user.workSlotCode ?? '');
    await _storage.write(key: 'ucode', value: user.code ?? '');
    state = state.copyWith(
      user: user,
      tenantSlug: slug ?? user.tenantSlug,
      tenantName: tenantName ?? user.tenantName ?? state.tenantName,
    );
  }

  Future<void> setTenantName(String name) async {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return;
    await _storage.write(key: 'utname', value: trimmed);
    state = state.copyWith(tenantName: trimmed);
  }

  Future<void> setPermissions(List<String> keys) async {
    await _storage.write(key: 'uperms', value: keys.join(','));
    state = state.copyWith(permissions: PermissionSet.fromList(keys));
  }

  Future<void> setMobileConfig(
    MobileConfig config, {
    Map<String, dynamic>? raw,
    List<String>? priceTypes,
    TenantReferences? tenantReferences,
    AgentLimits? agentLimits,
    List<AgentCityOption>? agentCities,
  }) async {
    final payload = raw ?? <String, dynamic>{'schema_version': config.schemaVersion};
    await _storage.write(key: 'umobilecfg', value: jsonEncode(payload));
    if (priceTypes != null) {
      await _storage.write(key: 'upricetypes', value: priceTypes.join(','));
    }
    if (tenantReferences != null) {
      await _storage.write(
        key: 'utenantsrefs',
        value: jsonEncode(tenantReferences.toJson()),
      );
    }
    if (agentLimits != null) {
      await _storage.write(key: 'uagentlimits', value: jsonEncode(agentLimits.toJson()));
    }
    if (agentCities != null) {
      await _storage.write(
        key: 'uagentcities',
        value: jsonEncode(agentCities.map((c) => c.toJson()).toList()),
      );
    }
    state = state.copyWith(
      mobileConfig: config,
      priceTypes: priceTypes ?? state.priceTypes,
      tenantReferences: tenantReferences ?? state.tenantReferences,
      agentLimits: agentLimits ?? state.agentLimits,
      agentCities: agentCities ?? state.agentCities,
    );
  }

  Future<void> setLastSyncAt(String v) async {
    await _storage.write(key: 'lastsync', value: v);
    state = state.copyWith(lastSyncAt: v, bootstrapped: true);
  }

  void markBootstrapped() {
    state = state.copyWith(bootstrapped: true);
  }

  Future<bool> restore() async {
    final uid = await _storage.read(key: 'uid');
    if (uid == null) return false;

    final role = await _storage.read(key: 'urole') ?? 'agent';
    final slug = await _storage.read(key: 'uslug') ?? '';
    final tenantName = await _storage.read(key: 'utname') ?? '';
    final name = await _storage.read(key: 'uname') ?? '';
    final login = await _storage.read(key: 'ulogin') ?? '';
    final slot = await _storage.read(key: 'uslot') ?? '';
    final code = await _storage.read(key: 'ucode') ?? '';
    final permsStr = await _storage.read(key: 'uperms') ?? '';
    final lastSync = await _storage.read(key: 'lastsync');
    final cfgStr = await _storage.read(key: 'umobilecfg');
    final refsStr = await _storage.read(key: 'utenantsrefs');
    final limitsStr = await _storage.read(key: 'uagentlimits');
    final citiesStr = await _storage.read(key: 'uagentcities');
    final ptStr = await _storage.read(key: 'upricetypes') ?? 'default';

    final perms = permsStr.isEmpty ? <String>[] : permsStr.split(',');
    MobileConfig? mobileConfig;
    TenantReferences? tenantReferences;
    AgentLimits agentLimits = const AgentLimits();
    List<AgentCityOption> agentCities = const [];
    if (cfgStr != null && cfgStr.isNotEmpty) {
      try {
        final decoded = jsonDecode(cfgStr);
        if (decoded is Map<String, dynamic>) {
          mobileConfig = MobileConfig.fromJson(decoded);
        }
      } catch (_) {}
    }
    if (refsStr != null && refsStr.isNotEmpty) {
      try {
        final decoded = jsonDecode(refsStr);
        if (decoded is Map<String, dynamic>) {
          tenantReferences = TenantReferences.fromJson(decoded);
        }
      } catch (_) {}
    }
    if (limitsStr != null && limitsStr.isNotEmpty) {
      try {
        final decoded = jsonDecode(limitsStr);
        if (decoded is Map<String, dynamic>) {
          agentLimits = AgentLimits.fromJson(decoded);
        }
      } catch (_) {}
    }
    if (citiesStr != null && citiesStr.isNotEmpty) {
      try {
        final decoded = jsonDecode(citiesStr);
        agentCities = parseAgentCities(decoded);
      } catch (_) {}
    }
    final priceTypes = ptStr.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList();

    state = SessionState(
      user: AuthUser(
        id: int.tryParse(uid) ?? 0,
        name: name,
        login: login,
        role: role,
        tenantId: 0,
        tenantSlug: slug,
        workSlotCode: slot.isEmpty ? null : slot,
        code: code.isEmpty ? null : code,
      ),
      tenantSlug: slug,
      tenantName: tenantName.isEmpty ? null : tenantName,
      permissions: PermissionSet.fromList(perms),
      mobileConfig: mobileConfig,
      tenantReferences: tenantReferences,
      agentLimits: agentLimits,
      agentCities: agentCities,
      priceTypes: priceTypes.isEmpty ? const ['default'] : priceTypes,
      lastSyncAt: lastSync,
      bootstrapped: lastSync != null,
    );
    return true;
  }

  Future<void> clear() async {
    state = const SessionState();
    await _storage.deleteAll();
  }
}

final sessionProvider =
    StateNotifierProvider<SessionManager, SessionState>((ref) {
  return SessionManager(ref.read(secureStorageProvider));
});

/// Joriy mobil konfiguratsiya (bootstrap dan keyin doim mavjud bo‘lishi kerak).
final mobileConfigProvider = Provider<MobileConfig>((ref) {
  return ref.watch(sessionProvider).mobileConfig ?? const MobileConfig();
});

final agentLimitsProvider = Provider<AgentLimits>((ref) {
  return ref.watch(sessionProvider).agentLimits;
});

final agentCitiesProvider = Provider<List<AgentCityOption>>((ref) {
  return ref.watch(sessionProvider).agentCities;
});
