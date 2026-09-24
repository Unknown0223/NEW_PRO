import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_exceptions.dart';
import '../../../core/api/supervisor_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/config/client_field_policy.dart';
import '../../../core/config/mobile_config.dart';
import '../../../core/config/tenant_refs_provider.dart';
import '../../../core/gps/gps_tracker.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../agent/clients/client_dynamic_form.dart';
import '../../auth/auth_provider.dart';
import '../config/supervisor_config_enforcement.dart';
import '../shared/supervisor_ui.dart';

class SupervisorClientEditPage extends ConsumerStatefulWidget {
  final int clientId;
  const SupervisorClientEditPage({super.key, required this.clientId});

  @override
  ConsumerState<SupervisorClientEditPage> createState() => _SupervisorClientEditPageState();
}

class _SupervisorClientEditPageState extends ConsumerState<SupervisorClientEditPage> {
  final _controllers = <String, TextEditingController>{};
  Map<String, dynamic>? _client;
  bool _loading = true;
  bool _saving = false;
  bool _gpsLoading = false;
  String? _error;
  String? _zone;
  String? _region;
  String? _city;
  double? _latitude;
  double? _longitude;

  ClientConfig get _cfg =>
      ref.read(sessionProvider).mobileConfig?.client ?? const ClientConfig();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) {
      setState(() {
        _loading = false;
        _error = 'Нет tenant';
      });
      return;
    }
    try {
      if (ref.read(agentCitiesProvider).isEmpty) {
        try {
          await ref.read(authStateProvider.notifier).refreshMobileConfig();
        } catch (_) {}
      }
      final row = await ref.read(supervisorApiProvider).getClient(slug, widget.clientId);
      if (!mounted) return;
      for (final c in _controllers.values) {
        c.dispose();
      }
      _controllers.clear();
      ClientDynamicFormFields.populateFromClient(row, _controllers);
      setState(() {
        _client = row;
        _city = row['city']?.toString();
        _zone = row['zone']?.toString();
        _region = row['region']?.toString();
        final lat = row['latitude'];
        final lon = row['longitude'];
        _latitude = lat is num ? lat.toDouble() : null;
        _longitude = lon is num ? lon.toDouble() : null;
        _loading = false;
        _error = null;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = e.toString();
        });
      }
    }
  }

  bool get _territoryVisible => isClientFieldVisible(_cfg, 'territory');
  bool get _useCityPicker => _territoryVisible;
  Set<String> get _hiddenFormKeys => _useCityPicker ? const {'territory'} : const {};

  Future<void> _captureGps() async {
    if (_gpsLoading || !showCoordinatesField(_cfg)) return;
    setState(() => _gpsLoading = true);
    try {
      final attached = await ref.read(gpsTrackerProvider.notifier).attachCurrentPosition();
      if (!mounted) return;
      if (!attached.ok || attached.position == null) {
        setState(() => _error = attached.message);
        return;
      }
      setState(() {
        _latitude = attached.position!.latitude;
        _longitude = attached.position!.longitude;
        _error = null;
      });
    } finally {
      if (mounted) setState(() => _gpsLoading = false);
    }
  }

  Future<void> _save() async {
    final policy = SupervisorConfigPolicy(ref.read(sessionProvider).mobileConfig);
    if (!policy.canEditClient) {
      setState(() => _error = 'Редактирование запрещено конфигурацией');
      return;
    }
    if (_useCityPicker && (_city == null || _city!.trim().isEmpty)) {
      setState(() => _error = 'Выберите город');
      return;
    }
    final validation = ClientDynamicFormFields.validate(
      _cfg,
      _controllers,
      hiddenFieldKeys: _hiddenFormKeys,
    );
    if (validation != null) {
      setState(() => _error = validation);
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      double? lat = _latitude;
      double? lon = _longitude;
      if (showCoordinatesField(_cfg) && (lat == null || lon == null) && policy.canChangeClientLocation) {
        final attached = await ref.read(gpsTrackerProvider.notifier).attachCurrentPosition();
        if (attached.position != null) {
          lat = attached.position!.latitude;
          lon = attached.position!.longitude;
        }
      }

      final body = ClientDynamicFormFields.toApiBody(
        _cfg,
        _controllers,
        latitude: showCoordinatesField(_cfg) && policy.canChangeClientLocation ? lat : null,
        longitude: showCoordinatesField(_cfg) && policy.canChangeClientLocation ? lon : null,
      );
      if (isClientFieldVisible(_cfg, 'visit_day')) {
        body['visit_weekdays'] =
            ClientDynamicFormFields.visitWeekdaysFromControllers(_cfg, _controllers);
      }
      if (_territoryVisible) {
        if (_zone != null && _zone!.trim().isNotEmpty) body['zone'] = _zone!.trim();
        if (_region != null && _region!.trim().isNotEmpty) body['region'] = _region!.trim();
        if (_city != null && _city!.trim().isNotEmpty) body['city'] = _city!.trim();
      }

      final slug = ref.read(sessionProvider).tenantSlug ?? '';
      await ref.read(supervisorApiProvider).patchClient(slug, widget.clientId, body);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Клиент сохранён. При смене координат другие SVR получат уведомление.'),
          backgroundColor: AppColors.success,
        ),
      );
      context.pop(true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    const accent = AppColors.supervisorAccent;
    final policy = SupervisorConfigPolicy(ref.watch(sessionProvider).mobileConfig);
    final agentCities = ref.watch(effectiveAgentCitiesProvider);
    final showCityPicker = _territoryVisible;
    final showGps = showCoordinatesField(_cfg) && policy.canChangeClientLocation;
    final title = _client?['name']?.toString() ?? 'Клиент';

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: supervisorAppBar(context, title: title),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _client == null
              ? Center(child: Text(_error ?? 'Не найден', style: const TextStyle(color: AppColors.error)))
              : Column(
                  children: [
                    Expanded(
                      child: ListView(
                        padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                        children: [
                          if ((_client?['linked_agent_names'] as List?)?.isNotEmpty == true)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: Text(
                                'Агенты: ${(_client!['linked_agent_names'] as List).join(', ')}',
                                style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                              ),
                            ),
                          ClientDynamicFormFields(
                            config: _cfg,
                            controllers: _controllers,
                            showGpsHint: showGps,
                            hiddenFieldKeys: showCityPicker ? const {'territory'} : const <String>{},
                          ),
                          if (showCityPicker) ...[
                            const SizedBox(height: 8),
                            DropdownButtonFormField<String>(
                              initialValue: () {
                                final opts = agentCities.map((c) => c.value).toSet();
                                final v = _city;
                                if (v != null && opts.contains(v)) return v;
                                return null;
                              }(),
                              decoration: const InputDecoration(
                                labelText: 'Город *',
                                border: OutlineInputBorder(),
                              ),
                              items: [
                                for (final c in agentCities)
                                  DropdownMenuItem(value: c.value, child: Text(c.label)),
                              ],
                              onChanged: policy.canEditClient
                                  ? (v) {
                                      final picked = agentCities.where((c) => c.value == v).toList();
                                      setState(() {
                                        _city = picked.isNotEmpty ? picked.first.value : null;
                                        _zone = picked.isNotEmpty ? picked.first.zone : null;
                                        _region = picked.isNotEmpty ? picked.first.region : null;
                                      });
                                    }
                                  : null,
                            ),
                          ],
                          if (showGps) ...[
                            const SizedBox(height: 8),
                            OutlinedButton.icon(
                              onPressed: _gpsLoading || !policy.canEditClient ? null : _captureGps,
                              icon: _gpsLoading
                                  ? const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(strokeWidth: 2),
                                    )
                                  : const Icon(Icons.gps_fixed),
                              label: Text(_gpsLoading ? 'GPS…' : 'Обновить GPS'),
                            ),
                            if (_latitude != null && _longitude != null)
                              Padding(
                                padding: const EdgeInsets.only(top: 8),
                                child: Text(
                                  'Координаты: ${_latitude!.toStringAsFixed(5)}, ${_longitude!.toStringAsFixed(5)}',
                                  style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                                ),
                              ),
                            const Padding(
                              padding: EdgeInsets.only(top: 6),
                              child: Text(
                                'Смена координат уведомит других супервайзеров этого клиента.',
                                style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                              ),
                            ),
                          ],
                          if (_error != null) ...[
                            const SizedBox(height: 8),
                            Text(_error!, style: const TextStyle(color: AppColors.error)),
                          ],
                        ],
                      ),
                    ),
                    if (policy.canEditClient)
                      SafeArea(
                        top: false,
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                          child: SizedBox(
                            width: double.infinity,
                            height: 52,
                            child: FilledButton(
                              style: FilledButton.styleFrom(backgroundColor: accent),
                              onPressed: _saving ? null : _save,
                              child: _saving
                                  ? const SizedBox(
                                      width: 22,
                                      height: 22,
                                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                    )
                                  : const Text('Сохранить'),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
    );
  }
}
