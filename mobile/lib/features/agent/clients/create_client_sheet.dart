import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exceptions.dart';
import '../../../core/api/dio_client.dart' show ensureAuthTokens, accessTokenProvider;
import '../../../core/api/mobile_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/config/client_field_policy.dart';
import '../../../core/config/mobile_config.dart';
import '../../../core/database/app_database.dart';
import '../../../core/gps/gps_tracker.dart';
import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/time/work_region_time.dart';
import '../../../core/clients/agent_outlet_filters_provider.dart';
import '../../../core/clients/client_outlet_filters.dart';
import '../../../core/clients/client_local_uniques.dart';
import '../route/agent_route_provider.dart';
import '../route/route_planning_provider.dart';
import 'clients_list_provider.dart';
import 'client_dynamic_form.dart';

Future<CreateClientSheetResult?> showCreateClientSheet(BuildContext context) {
  return showModalBottomSheet<CreateClientSheetResult>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) => const _CreateClientSheet(),
  );
}

class CreateClientSheetResult {
  final int? clientId;
  final bool createOrder;
  const CreateClientSheetResult({this.clientId, this.createOrder = false});
}

class _CreateClientSheet extends ConsumerStatefulWidget {
  const _CreateClientSheet();

  @override
  ConsumerState<_CreateClientSheet> createState() => _CreateClientSheetState();
}

class _CreateClientSheetState extends ConsumerState<_CreateClientSheet> {
  final _controllers = <String, TextEditingController>{};
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  ClientConfig get _clientCfg =>
      ref.read(sessionProvider).mobileConfig?.client ?? const ClientConfig();

  Future<void> _save() async {
    final validation = ClientDynamicFormFields.validate(_clientCfg, _controllers);
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
        if (mounted) {
          setState(() => _error = 'Kirish talab qilinadi. Chiqib qayta login qiling.');
        }
        return;
      }

      double? lat;
      double? lon;
      if (showCoordinatesField(_clientCfg)) {
        final attached = await ref.read(gpsTrackerProvider.notifier).attachCurrentPosition();
        if (attached.position != null) {
          lat = attached.position!.latitude;
          lon = attached.position!.longitude;
        } else if (isClientFieldRequired(_clientCfg, 'coordinates')) {
          if (mounted) setState(() => _error = attached.message);
          return;
        }
      }

      final body = ClientDynamicFormFields.toApiBody(
        _clientCfg,
        _controllers,
        latitude: lat,
        longitude: lon,
      );
      final name = (body.remove('name') ?? _controllers['name']?.text.trim() ?? '').toString();
      var phoneRaw = (body.remove('phone') ?? _controllers['phone']?.text.trim() ?? '').toString();
      if (phoneRaw.isEmpty && _controllers['phone'] != null) {
        phoneRaw = _controllers['phone']!.text.trim();
      }
      final phone = normalizePhoneWithPrefix(_clientCfg, phoneRaw);

      if (name.length < 3) {
        if (mounted) setState(() => _error = 'Nom kamida 3 belgi');
        return;
      }
      if (phone.replaceAll(RegExp(r'\D'), '').length < 9) {
        if (mounted) setState(() => _error = 'Telefon: 9 raqam kiriting');
        return;
      }

      final visitWeekdays = ClientDynamicFormFields.visitWeekdaysFromControllers(_clientCfg, _controllers);
      final localDup = findLocalClientDuplicateMessage(
        await AppDatabase().getAllClients(activeOnly: false),
        name: name,
        phone: phone,
        inn: body['inn']?.toString(),
        clientPinfl: body['client_pinfl']?.toString(),
        clientCode: body['client_code']?.toString(),
        region: body['region']?.toString(),
      );
      if (localDup != null) {
        if (mounted) setState(() => _error = localDup);
        return;
      }
      final row = await ref.read(mobileApiProvider).createClient(slug, {
        'name': name,
        'phone': phone,
        ...body,
        if (visitWeekdays.isNotEmpty) 'visit_weekdays': visitWeekdays,
      });

      final isActive = row['is_active'];
        await AppDatabase().upsertClients([
        {
          'id': row['id'],
          'name': row['name'] ?? name,
          'phone': row['phone'] ?? phone,
          'address': row['address'] ?? _controllers['address']?.text.trim(),
          'client_code': row['client_code'],
          'category': row['category'],
          'is_active': isActive == false ? 0 : 1,
          'latitude': row['latitude'] ?? lat,
          'longitude': row['longitude'] ?? lon,
          if (visitWeekdays.isNotEmpty) 'visit_weekdays': jsonEncode(visitWeekdays),
        },
      ]);

      ref.invalidate(clientsListProvider);
      ref.invalidate(todayRouteProvider);
      ref.invalidate(plannedDailyRouteProvider);
      ref.invalidate(realTodayRouteProvider);
      ref.read(outletCategoryFilterProvider.notifier).state = null;
      ref.read(outletVisitStatusFilterProvider.notifier).state = S.dayAll;
      ref.read(outletDebtsOnlyProvider.notifier).state = false;
      final todayWd = serverTodayWeekday();
      ref.read(outletWeekdayTabProvider.notifier).state =
          weekdayTabAfterCreatedClient(visitWeekdays, todayWd);

      if (!mounted) return;
      final pending = isActive == false;
      if (pending) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Savdo nuqtasi yaratildi. Operator tasdiqlashi kutilishi mumkin.'),
            backgroundColor: AppColors.info,
          ),
        );
        Navigator.pop(context, CreateClientSheetResult(clientId: (row['id'] as num?)?.toInt()));
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
      Navigator.pop(
        context,
        CreateClientSheetResult(
          clientId: (row['id'] as num?)?.toInt(),
          createOrder: createOrder == true,
        ),
      );
    } on UnauthorizedException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Yangi savdo nuqtasi', style: AppTypography.headlineSmall),
            const SizedBox(height: 16),
            ClientDynamicFormFields(
              config: _clientCfg,
              controllers: _controllers,
              showGpsHint: showCoordinatesField(_clientCfg) || isClientFieldVisible(_clientCfg, 'coordinates'),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!, style: const TextStyle(color: AppColors.error)),
            ],
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _saving ? null : _save,
              child: _saving
                  ? const SizedBox(
                      height: 22,
                      width: 22,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Saqlash'),
            ),
          ],
        ),
      ),
    );
  }
}
