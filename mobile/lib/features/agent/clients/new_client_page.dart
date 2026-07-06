import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../../core/api/api_exceptions.dart';
import '../../../core/api/dio_client.dart' show ensureAuthTokens, accessTokenProvider;
import '../../../core/api/mobile_api.dart';
import '../../../core/auth/app_lock.dart';
import '../../../core/auth/session.dart';
import '../../auth/auth_provider.dart';
import '../../../core/camera/photo_service.dart';
import '../../../core/config/client_field_policy.dart';
import '../../../core/config/mobile_config.dart';
import '../../../core/config/agent_cities.dart';
import '../../../core/database/app_database.dart';
import '../../../core/gps/gps_tracker.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/ui/agent_template_form.dart';
import '../../../core/clients/agent_outlet_filters_provider.dart';
import 'agent_clients_page.dart';
import 'clients_list_provider.dart';
import '../shell/agent_app_bar.dart';
import 'client_dynamic_form.dart';

/// Shablon NewClientScreen — 100% UI (develop-flutter-mobile-frontend).
class NewClientPage extends ConsumerStatefulWidget {
  const NewClientPage({super.key});

  @override
  ConsumerState<NewClientPage> createState() => _NewClientPageState();
}

class _NewClientPageState extends ConsumerState<NewClientPage> {
  final _controllers = <String, TextEditingController>{};
  bool _saving = false;
  String? _error;
  String? _zone;
  String? _region;
  String? _city;
  double? _latitude;
  double? _longitude;
  String? _photoPath;
  bool _photoUploading = false;
  bool _gpsLoading = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _ensureAgentCitiesLoaded());
  }

  Future<void> _ensureAgentCitiesLoaded() async {
    if (!mounted) return;
    if (ref.read(agentCitiesProvider).isNotEmpty) return;
    try {
      await ref.read(authStateProvider.notifier).refreshMobileConfig();
    } catch (_) {}
  }

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  ClientConfig get _cfg => ref.read(sessionProvider).mobileConfig?.client ?? const ClientConfig();

  TextEditingController _c(String key) => _controllers.putIfAbsent(key, () => TextEditingController());

  /// Pastdagi «Сохранить» tugmasini to‘sib qo‘ymaslik uchun floating snackbar.
  void _showFormSnack(String message, {Color? backgroundColor}) {
    if (!mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: backgroundColor,
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.fromLTRB(12, 0, 12, 76),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  Future<void> _captureGps() async {
    if (_gpsLoading || !showCoordinatesField(_cfg)) return;
    setState(() => _gpsLoading = true);
    try {
      final pos = await ref.read(gpsTrackerProvider.notifier).getCurrentPosition();
      if (!mounted) return;
      if (pos == null) {
        _showFormSnack('GPS ruxsati yo‘q yoki joylashuv o‘chirilgan', backgroundColor: AppColors.error);
        return;
      }
      setState(() {
        _latitude = pos.latitude;
        _longitude = pos.longitude;
      });
      // Koordinatalar formada ko‘rinadi — pastdagi tugmani to‘sadigan snackbar kerak emas.
    } finally {
      if (mounted) setState(() => _gpsLoading = false);
    }
  }

  Future<void> _capturePhoto() async {
    if (_photoUploading || !_cfg.showPhotos) return;
    final cam = await Permission.camera.request();
    if (!cam.isGranted) {
      if (mounted) {
        _showFormSnack('Kamera ruxsati kerak', backgroundColor: AppColors.error);
      }
      return;
    }
    final photo = await withAppLockSuppressed(
      ref,
      () => ref.read(photoServiceProvider).takeClientPhoto(),
    );
    if (!mounted || photo == null) return;
    setState(() => _photoPath = photo.filePath);
  }

  Future<String?> _photoBase64Payload() async {
    final path = _photoPath;
    if (path == null || path.isEmpty) return null;
    return encodeClientPhotoBase64(
      path,
      config: ref.read(sessionProvider).mobileConfig?.photo,
    );
  }

  Future<void> _uploadPhotoIfNeeded(String slug, int clientId) async {
    final b64 = await _photoBase64Payload();
    if (b64 == null) return;
    setState(() => _photoUploading = true);
    try {
      await ref.read(mobileApiProvider).postClientPhotoReport(slug, clientId, imageBase64: b64);
    } finally {
      if (mounted) setState(() => _photoUploading = false);
    }
  }

  bool get _territoryVisible => isClientFieldVisible(_cfg, 'territory');

  String? _validateForSave() {
    if (_territoryVisible) {
      final agentCities = ref.read(agentCitiesProvider);
      if (agentCities.isNotEmpty && (_city == null || _city!.trim().isEmpty)) {
        return 'Выберите город';
      }
    }
    return ClientDynamicFormFields.validate(_cfg, _controllers);
  }

  Future<void> _save() async {
    final validation = _validateForSave();
    if (validation != null) {
      setState(() => _error = validation);
      return;
    }

    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return;

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      await ensureAuthTokens(ref);
      if (ref.read(accessTokenProvider) == null) {
        setState(() => _error = 'Требуется вход');
        return;
      }

      double? lat = _latitude;
      double? lon = _longitude;
      final coordsVisible = isClientFieldVisible(_cfg, 'coordinates');
      if (coordsVisible && showCoordinatesField(_cfg) && (lat == null || lon == null)) {
        final pos = await ref.read(gpsTrackerProvider.notifier).getCurrentPosition();
        if (pos != null) {
          lat = pos.latitude;
          lon = pos.longitude;
        }
      }

      final body = ClientDynamicFormFields.toApiBody(
        _cfg,
        _controllers,
        latitude: coordsVisible ? lat : null,
        longitude: coordsVisible ? lon : null,
      );
      final visitWeekdays = ClientDynamicFormFields.visitWeekdaysFromControllers(_cfg, _controllers);
      if (visitWeekdays.isNotEmpty) {
        body['visit_weekdays'] = visitWeekdays;
      }
      final values = <String, String>{
        for (final k in clientFormFieldKeys(_cfg))
          if (k != 'coordinates') k: _controllers[k]?.text.trim() ?? '',
      };
      final name = resolveClientCreateName(_cfg, values);
      body.remove('name');
      final phoneRaw = body.remove('phone') ?? _c('phone').text.trim();
      final phone = normalizePhoneWithPrefix(_cfg, phoneRaw.toString());

      final row = await ref.read(mobileApiProvider).createClient(slug, {
        'name': name,
        'phone': phone,
        if (_territoryVisible && _zone != null && _zone!.trim().isNotEmpty) 'zone': _zone!.trim(),
        if (_territoryVisible && _region != null && _region!.trim().isNotEmpty) 'region': _region!.trim(),
        if (_territoryVisible && _city != null && _city!.trim().isNotEmpty) 'city': _city!.trim(),
        ...body,
      });

      final clientId = (row['id'] as num?)?.toInt();
      if (clientId != null && _photoPath != null && _cfg.showPhotos) {
        try {
          await _uploadPhotoIfNeeded(slug, clientId);
        } catch (_) {
          if (mounted) {
            _showFormSnack('Klient saqlandi, lekin foto yuklanmadi', backgroundColor: AppColors.warning);
          }
        }
      }
      await AppDatabase().upsertClients([
        {
          'id': row['id'],
          'name': row['name'] ?? name,
          'phone': row['phone'] ?? phone,
          'address': row['address'] ?? _c('address').text.trim(),
          'legal_name': row['legal_name'],
          'client_code': row['client_code'],
          'category': row['category'],
          'region': row['region'] ?? _region,
          if ((_zone ?? row['zone']) != null) 'zone': row['zone'] ?? _zone,
          if ((_city ?? row['city']) != null) 'city': row['city'] ?? _city,
          'is_active': row['is_active'] == false ? 0 : 1,
          'latitude': row['latitude'] ?? lat,
          'longitude': row['longitude'] ?? lon,
          if (visitWeekdays.isNotEmpty) 'visit_weekdays': jsonEncode(visitWeekdays),
        },
      ]);

      ref.invalidate(clientsListProvider);
      ref.invalidate(filteredClientsProvider);

      if (!mounted) return;

      final pending = _cfg.requireNewClientApproval || row['is_active'] == false;
      if (pending) {
        _showFormSnack(
          'Savdo nuqtasi yaratildi. Operator tasdiqlashi kutilishi mumkin.',
          backgroundColor: AppColors.info,
        );
        context.go('/clients');
        return;
      }

      final createOrder = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Клиент добавлен'),
          content: const Text('Yangi savdo nuqtasi uchun buyurtma yaratilsinmi?'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Позже')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Создать заказ')),
          ],
        ),
      );

      if (!mounted) return;
      if (createOrder == true && clientId != null) {
        context.go('/orders/create?client_id=$clientId');
      } else {
        context.go('/clients');
      }
    } on UnauthorizedException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _applyCitySelection(AgentCityOption? picked) {
    setState(() {
      _city = picked?.value;
      _zone = picked?.zone;
      _region = picked?.region;
    });
  }

  Widget _citySelect() {
    final agentCities = ref.watch(agentCitiesProvider);
    final seen = <String>{};
    final unique = agentCities.where((c) => seen.add(c.value)).toList();
    final options = unique.map((c) => c.value).toList();
    final labels = {for (final c in unique) c.value: c.label};
    var value = _city;
    if (value != null && !options.contains(value)) {
      final byLabel = unique.where((c) => c.label == value).toList();
      value = byLabel.length == 1 ? byLabel.first.value : null;
    }
    return AgentOutlineSelect(
      label: 'Город',
      value: value,
      options: options,
      optionLabels: labels,
      onChanged: agentCities.isEmpty
          ? null
          : (stored) {
              if (stored == null) {
                _applyCitySelection(null);
                return;
              }
              final picked = unique.where((c) => c.value == stored).toList();
              _applyCitySelection(picked.isNotEmpty ? picked.first : null);
            },
    );
  }

  @override
  Widget build(BuildContext context) {
    final cfg = ref.watch(sessionProvider).mobileConfig?.client ?? const ClientConfig();
    final territoryVisible = isClientFieldVisible(cfg, 'territory');
    final agentCities = ref.watch(agentCitiesProvider);
    final showCityPicker = territoryVisible && agentCities.isNotEmpty;
    final showGpsCapture = showCoordinatesField(cfg);
    final showPhotoCapture = cfg.showPhotos;
    final showLocationSection = showGpsCapture || showPhotoCapture;

    final canCreate = cfg.canCreate;
    if (!canCreate) {
      return const Scaffold(
        appBar: AgentAppBar(title: 'Новая торговая точка', showBack: true),
        body: Center(child: Text('Создание новой точки запрещено настройками.')),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const AgentAppBar(title: 'Новая торговая точка', showBack: true),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
              children: [
                AgentTemplateSection(
                  title: 'Данные клиента',
                  subtitle: 'Поля отображаются по настройкам конфигурации.',
                  children: [
                    ClientDynamicFormFields(
                      config: cfg,
                      controllers: _controllers,
                      showGpsHint: showCoordinatesField(cfg),
                      hiddenFieldKeys: showCityPicker ? const {'territory'} : const {},
                    ),
                    if (showCityPicker) ...[
                      const SizedBox(height: 8),
                      _citySelect(),
                    ],
                  ],
                ),
                if (showLocationSection)
                  AgentTemplateSection(
                    title: 'Локация',
                    subtitle: showGpsCapture ? 'GPS orqali nuqtani biriktiring.' : null,
                    children: [
                      if (showGpsCapture || showPhotoCapture)
                        Row(
                          children: [
                            if (showGpsCapture)
                              Expanded(
                                child: AgentTemplateActionButton(
                                  icon: Icons.gps_fixed,
                                  label: _gpsLoading ? 'GPS…' : 'GPS',
                                  onPressed: _gpsLoading ? null : _captureGps,
                                ),
                              ),
                            if (showGpsCapture && showPhotoCapture) const SizedBox(width: 12),
                            if (showPhotoCapture)
                              Expanded(
                                child: AgentTemplateActionButton(
                                  icon: Icons.photo_camera_outlined,
                                  label: 'Фото',
                                  onPressed: _photoUploading ? null : _capturePhoto,
                                ),
                              ),
                          ],
                        ),
                      if (showPhotoCapture && _photoPath != null) ...[
                        const SizedBox(height: 12),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.file(
                            File(_photoPath!),
                            height: 120,
                            width: double.infinity,
                            fit: BoxFit.cover,
                          ),
                        ),
                      ],
                      if (showGpsCapture && _latitude != null && _longitude != null) ...[
                        const SizedBox(height: 12),
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            'Координаты: ${_latitude!.toStringAsFixed(5)}, ${_longitude!.toStringAsFixed(5)}',
                            style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                          ),
                        ),
                      ],
                    ],
                  ),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4, bottom: 8),
                    child: Text(_error!, style: const TextStyle(color: AppColors.error, fontWeight: FontWeight.w600)),
                  ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.surface,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.06),
                  blurRadius: 12,
                  offset: const Offset(0, -1),
                ),
              ],
            ),
            child: SafeArea(
              top: false,
              child: FilledButton(
                onPressed: (_saving || _photoUploading) ? null : _save,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 52),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: _saving
                    ? const SizedBox(
                        height: 22,
                        width: 22,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Сохранить клиента', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
