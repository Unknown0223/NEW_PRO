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
import '../supervisor_providers.dart';

/// SVR — yangi savdo nuqtasi + jamoa agentini tanlash.
class SupervisorNewClientPage extends ConsumerStatefulWidget {
  const SupervisorNewClientPage({super.key});

  @override
  ConsumerState<SupervisorNewClientPage> createState() => _SupervisorNewClientPageState();
}

class _SupervisorNewClientPageState extends ConsumerState<SupervisorNewClientPage> {
  final _controllers = <String, TextEditingController>{};
  bool _saving = false;
  bool _gpsLoading = false;
  String? _error;
  String? _zone;
  String? _region;
  String? _city;
  double? _latitude;
  double? _longitude;
  SupervisorLinkedAgent? _selectedAgent;

  ClientConfig get _cfg =>
      ref.read(sessionProvider).mobileConfig?.client ?? const ClientConfig();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      if (ref.read(agentCitiesProvider).isEmpty) {
        try {
          await ref.read(authStateProvider.notifier).refreshMobileConfig();
        } catch (_) {}
      }
    });
  }

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  bool get _territoryVisible => isClientFieldVisible(_cfg, 'territory');
  bool get _useCityPicker => _territoryVisible;
  Set<String> get _hiddenFormKeys => _useCityPicker ? const {'territory'} : const {};

  Future<void> _pickAgent(List<SupervisorLinkedAgent> agents) async {
    if (agents.isEmpty) return;
    final picked = await showModalBottomSheet<SupervisorLinkedAgent>(
      context: context,
      showDragHandle: true,
      builder: (ctx) {
        return SafeArea(
          child: ListView(
            shrinkWrap: true,
            children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 8, 16, 8),
                child: Text(
                  'Выберите агента',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                ),
              ),
              for (final a in agents)
                ListTile(
                  leading: const Icon(Icons.person_outline),
                  title: Text(a.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text(
                    [
                      if (a.code != null && a.code!.trim().isNotEmpty) a.code!,
                      a.login,
                    ].join(' · '),
                  ),
                  selected: _selectedAgent?.id == a.id,
                  onTap: () => Navigator.pop(ctx, a),
                ),
            ],
          ),
        );
      },
    );
    if (picked != null && mounted) {
      setState(() => _selectedAgent = picked);
    }
  }

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
    if (!policy.canCreateClient) {
      setState(() => _error = 'Создание запрещено конфигурацией');
      return;
    }
    final agent = _selectedAgent;
    if (agent == null || agent.id <= 0) {
      setState(() => _error = 'Выберите агента из вашего списка');
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
      final showGps = showCoordinatesField(_cfg) && policy.canChangeClientLocation;
      if (showGps && (lat == null || lon == null)) {
        final attached = await ref.read(gpsTrackerProvider.notifier).attachCurrentPosition();
        if (attached.position != null) {
          lat = attached.position!.latitude;
          lon = attached.position!.longitude;
        }
      }

      final body = ClientDynamicFormFields.toApiBody(
        _cfg,
        _controllers,
        latitude: showGps ? lat : null,
        longitude: showGps ? lon : null,
      );
      final values = <String, String>{
        for (final k in clientFormFieldKeys(_cfg))
          if (k != 'coordinates') k: _controllers[k]?.text.trim() ?? '',
      };
      final name = resolveClientCreateName(_cfg, values);
      body.remove('name');
      final phoneRaw = body.remove('phone') ?? _controllers['phone']?.text.trim() ?? '';
      final phone = normalizePhoneWithPrefix(_cfg, phoneRaw.toString());

      if (isClientFieldVisible(_cfg, 'visit_day')) {
        final visitWeekdays =
            ClientDynamicFormFields.visitWeekdaysFromControllers(_cfg, _controllers);
        if (visitWeekdays.isNotEmpty) body['visit_weekdays'] = visitWeekdays;
      }
      if (_territoryVisible) {
        if (_zone != null && _zone!.trim().isNotEmpty) body['zone'] = _zone!.trim();
        if (_region != null && _region!.trim().isNotEmpty) body['region'] = _region!.trim();
        if (_city != null && _city!.trim().isNotEmpty) body['city'] = _city!.trim();
      }

      final slug = ref.read(sessionProvider).tenantSlug ?? '';
      final row = await ref.read(supervisorApiProvider).createClient(slug, {
        'agent_id': agent.id,
        'name': name,
        'phone': phone,
        ...body,
      });

      if (!mounted) return;
      final pending = row['is_active'] == false;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            pending
                ? 'ТТ создана и привязана к ${agent.name}. Ожидает подтверждения.'
                : 'ТТ создана и привязана к ${agent.name}',
          ),
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
    final agentsAsync = ref.watch(supervisorLinkedAgentsProvider);
    final agentCities = ref.watch(effectiveAgentCitiesProvider);
    final showCityPicker = _territoryVisible;
    final showGps = showCoordinatesField(_cfg) && policy.canChangeClientLocation;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: supervisorAppBar(context, title: 'Новая торговая точка'),
      body: !policy.canCreateClient
          ? const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'Создание ТТ отключено в конфигурации супервайзера',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.warning),
                ),
              ),
            )
          : Column(
              children: [
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                    children: [
                      agentsAsync.when(
                        loading: () => const LinearProgressIndicator(),
                        error: (e, _) => Text('$e', style: const TextStyle(color: AppColors.error)),
                        data: (agents) {
                          if (agents.isEmpty) {
                            return const Padding(
                              padding: EdgeInsets.only(bottom: 12),
                              child: Text(
                                'Нет привязанных агентов. Назначьте агентов супервайзеру в веб-панели.',
                                style: TextStyle(color: AppColors.warning),
                              ),
                            );
                          }
                          if (_selectedAgent == null && agents.length == 1) {
                            WidgetsBinding.instance.addPostFrameCallback((_) {
                              if (mounted && _selectedAgent == null) {
                                setState(() => _selectedAgent = agents.first);
                              }
                            });
                          }
                          final selected = _selectedAgent;
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: InkWell(
                              onTap: () => _pickAgent(agents),
                              borderRadius: BorderRadius.circular(12),
                              child: InputDecorator(
                                decoration: const InputDecoration(
                                  labelText: 'Агент *',
                                  border: OutlineInputBorder(),
                                  suffixIcon: Icon(Icons.arrow_drop_down),
                                ),
                                child: Text(
                                  selected == null
                                      ? 'Выберите агента (${agents.length})'
                                      : [
                                          selected.name,
                                          if (selected.code != null && selected.code!.trim().isNotEmpty)
                                            selected.code!,
                                        ].join(' · '),
                                  style: TextStyle(
                                    color: selected == null
                                        ? AppColors.textMuted
                                        : AppColors.textPrimary,
                                    fontWeight:
                                        selected == null ? FontWeight.w400 : FontWeight.w600,
                                  ),
                                ),
                              ),
                            ),
                          );
                        },
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
                          onChanged: (v) {
                            final picked = agentCities.where((c) => c.value == v).toList();
                            setState(() {
                              _city = picked.isNotEmpty ? picked.first.value : null;
                              _zone = picked.isNotEmpty ? picked.first.zone : null;
                              _region = picked.isNotEmpty ? picked.first.region : null;
                            });
                          },
                        ),
                      ],
                      if (showGps) ...[
                        const SizedBox(height: 8),
                        OutlinedButton.icon(
                          onPressed: _gpsLoading ? null : _captureGps,
                          icon: _gpsLoading
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Icon(Icons.gps_fixed),
                          label: Text(_gpsLoading ? 'GPS…' : 'Записать GPS'),
                        ),
                        if (_latitude != null && _longitude != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 8),
                            child: Text(
                              'Координаты: ${_latitude!.toStringAsFixed(5)}, ${_longitude!.toStringAsFixed(5)}',
                              style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                            ),
                          ),
                      ],
                      if (_error != null) ...[
                        const SizedBox(height: 8),
                        Text(_error!, style: const TextStyle(color: AppColors.error)),
                      ],
                      const SizedBox(height: 8),
                      Text(
                        'Клиент будет виден выбранному агенту и в вашей базе SVR.',
                        style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
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
                            : const Text('Создать'),
                      ),
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}
