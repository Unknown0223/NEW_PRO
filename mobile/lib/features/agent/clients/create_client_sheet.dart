import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../../../core/api/api_exceptions.dart';
import '../../../core/api/dio_client.dart' show ensureAuthTokens, accessTokenProvider;
import '../../../core/api/mobile_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/config/client_field_policy.dart';
import '../../../core/config/mobile_config.dart';
import '../../../core/database/app_database.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import 'client_dynamic_form.dart';

Future<bool?> showCreateClientSheet(BuildContext context) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) => const _CreateClientSheet(),
  );
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

      Position? pos;
      if (showCoordinatesField(_clientCfg)) {
        try {
          pos = await Geolocator.getCurrentPosition();
        } catch (_) {}
      }

      final body = ClientDynamicFormFields.toApiBody(
        _clientCfg,
        _controllers,
        latitude: pos?.latitude,
        longitude: pos?.longitude,
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
          'latitude': row['latitude'],
          'longitude': row['longitude'],
        },
      ]);

      if (mounted) {
        if (_clientCfg.requireNewClientApproval || isActive == false) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Savdo nuqtasi yaratildi. Operator tasdiqlashi kutilishi mumkin.'),
              backgroundColor: AppColors.info,
            ),
          );
        }
        Navigator.pop(context, true);
      }
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
