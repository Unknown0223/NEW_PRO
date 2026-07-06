import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/clients/client_outlet_filters.dart';
import '../../../core/config/client_field_constraints.dart';
import '../../../core/config/client_field_policy.dart';
import '../../../core/config/mobile_config.dart';
import '../../../core/config/tenant_refs_provider.dart';

const kVisitDayRuOptions = [
  'ПН, СР, ПТ',
  'ПН',
  'ВТ',
  'СР',
  'ЧТ',
  'ПТ',
  'СБ',
  'ВС',
];

/// Agent mijoz yaratish/tahrirlash — config maydonlari + format validatsiya.
class ClientDynamicFormFields extends ConsumerWidget {
  final ClientConfig config;
  final Map<String, TextEditingController> controllers;
  final bool showGpsHint;
  final Set<String> hiddenFieldKeys;

  const ClientDynamicFormFields({
    super.key,
    required this.config,
    required this.controllers,
    this.showGpsHint = false,
    this.hiddenFieldKeys = const {},
  });

  TextEditingController _ctrl(String key) =>
      controllers.putIfAbsent(key, () => TextEditingController());

  List<TextInputFormatter> _formatters(String key) {
    final c = constraintForField(key);
    switch (c.kind) {
      case ClientFieldKind.digits:
      case ClientFieldKind.phoneLocal:
        return [
          FilteringTextInputFormatter.digitsOnly,
          LengthLimitingTextInputFormatter(c.maxLen),
        ];
      case ClientFieldKind.date:
        return [
          FilteringTextInputFormatter.allow(RegExp(r'[0-9\-]')),
          LengthLimitingTextInputFormatter(10),
        ];
      default:
        return [LengthLimitingTextInputFormatter(c.maxLen)];
    }
  }

  InputDecoration _decoration(String key) {
    final c = constraintForField(key);
    return InputDecoration(
      labelText: clientFieldLabel(key),
      suffixText: isClientFieldRequired(config, key) || key == 'name' || key == 'phone' ? '*' : null,
      prefixText: key == 'phone' && config.phonePrefix.isNotEmpty ? '${config.phonePrefix} ' : null,
      helperText: c.hint,
      helperMaxLines: 2,
    );
  }

  TextInputType _keyboard(String key) {
    final c = constraintForField(key);
    switch (c.kind) {
      case ClientFieldKind.digits:
      case ClientFieldKind.phoneLocal:
        return TextInputType.number;
      case ClientFieldKind.multiline:
        return TextInputType.multiline;
      case ClientFieldKind.date:
        return TextInputType.datetime;
      default:
        return TextInputType.text;
    }
  }

  List<String>? _options(WidgetRef ref, String key) {
    final refs = ref.watch(sessionTenantRefsProvider);
    switch (key) {
      case 'category':
        return refs.clientCategories.isNotEmpty ? refs.clientCategories : null;
      case 'client_type':
        return refs.clientTypeCodes.isNotEmpty ? refs.clientTypeCodes : null;
      case 'sales_channel':
        return refs.salesChannels.isNotEmpty ? refs.salesChannels : null;
      case 'territory':
        return refs.regions.isNotEmpty ? refs.regions : null;
      default:
        return null;
    }
  }

  Widget _buildField(BuildContext context, WidgetRef ref, String key) {
    if (key == 'coordinates') {
      if (showGpsHint) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Text(
            'Koordinatalar saqlashda joriy GPS ishlatiladi',
            style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
          ),
        );
      }
      if (showCoordinatesHintOnly(config)) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Text(
            'Koordinatalar: konfiguratsiyada o‘zgartirish ruxsati yo‘q',
            style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
          ),
        );
      }
      return const SizedBox.shrink();
    }

    final options = _options(ref, key);
    if (options != null) {
      final current = _ctrl(key).text.trim();
      return Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: DropdownButtonFormField<String>(
          initialValue: current.isNotEmpty && options.contains(current) ? current : null,
          decoration: _decoration(key),
          items: options
              .map((o) => DropdownMenuItem(value: o, child: Text(o, overflow: TextOverflow.ellipsis)))
              .toList(),
          onChanged: (v) => _ctrl(key).text = v ?? '',
        ),
      );
    }

    if (key == 'visit_day') {
      final current = _ctrl(key).text.trim();
      final selected = current.isNotEmpty && kVisitDayRuOptions.contains(current)
          ? current
          : (current.isEmpty ? kVisitDayRuOptions.first : null);
      if (selected != null && _ctrl(key).text != selected) {
        _ctrl(key).text = selected;
      }
      return Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: DropdownButtonFormField<String>(
          initialValue: selected,
          decoration: _decoration(key),
          items: kVisitDayRuOptions
              .map((o) => DropdownMenuItem(value: o, child: Text(o)))
              .toList(),
          onChanged: (v) => _ctrl(key).text = v ?? '',
        ),
      );
    }

    final c = constraintForField(key);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: TextField(
        controller: _ctrl(key),
        decoration: _decoration(key),
        keyboardType: _keyboard(key),
        inputFormatters: _formatters(key),
        maxLines: c.kind == ClientFieldKind.multiline ? 2 : 1,
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final keys = clientFormFieldKeys(config).where((k) => !hiddenFieldKeys.contains(k)).toList();
    final children = keys.map((k) => _buildField(context, ref, k)).toList();

    if (children.isEmpty) {
      children.addAll([
        TextField(
          controller: _ctrl('name'),
          decoration: const InputDecoration(labelText: 'Nomi *'),
          inputFormatters: [LengthLimitingTextInputFormatter(255)],
        ),
        Padding(
          padding: const EdgeInsets.only(top: 8),
          child: TextField(
            controller: _ctrl('phone'),
            decoration: InputDecoration(
              labelText: 'Telefon *',
              prefixText: config.phonePrefix.isNotEmpty ? '${config.phonePrefix} ' : null,
              helperText: '9 raqam',
            ),
            keyboardType: TextInputType.number,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(9),
            ],
          ),
        ),
      ]);
    }

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children);
  }

  static String? validate(ClientConfig config, Map<String, TextEditingController> controllers) {
    var keys = clientFormFieldKeys(config);
    if (keys.isEmpty) {
      keys = ['name', 'phone'];
    }
    final values = <String, String>{};
    final required = <String, bool>{};
    for (final key in keys) {
      if (key == 'coordinates') continue;
      values[key] = controllers[key]?.text.trim() ?? '';
      required[key] = isClientFieldRequired(config, key);
    }
    return validateClientFormFields(keys, values, required);
  }

  static Map<String, dynamic> toApiBody(
    ClientConfig config,
    Map<String, TextEditingController> controllers, {
    double? latitude,
    double? longitude,
  }) {
    final body = <String, dynamic>{};
    for (final entry in clientFieldApiKey.entries) {
      final formKey = entry.key;
      if (!isClientFieldVisible(config, formKey)) continue;
      if (formKey == 'visit_day') continue;
      var raw = controllers[formKey]?.text.trim() ?? '';
      if (raw.isEmpty) continue;
      if (formKey == 'phone') {
        body[entry.value] = normalizePhoneWithPrefix(config, raw);
      } else {
        body[entry.value] = sanitizeClientFieldForApi(formKey, raw);
      }
    }
    if (isClientFieldVisible(config, 'coordinates')) {
      if (latitude != null) body['latitude'] = latitude;
      if (longitude != null) body['longitude'] = longitude;
    }
    return body;
  }

  static List<int> visitWeekdaysFromControllers(
    ClientConfig config,
    Map<String, TextEditingController> controllers,
  ) {
    if (!isClientFieldVisible(config, 'visit_day')) return const [];
    return parseVisitWeekdaysFromRuSelection(controllers['visit_day']?.text);
  }

  static void populateFromClient(Map<String, dynamic> client, Map<String, TextEditingController> controllers) {
    for (final entry in clientApiKeyToFormKey.entries) {
      final val = client[entry.key];
      if (val == null) continue;
      final text = val.toString().trim();
      if (text.isEmpty) continue;
      var formText = text;
      if (entry.value == 'phone') {
        formText = text.replaceAll(RegExp(r'\D'), '');
        const uz = '998';
        if (formText.startsWith(uz) && formText.length > uz.length) {
          formText = formText.substring(uz.length);
        }
      }
      if (entry.value == 'visit_day' && text.length >= 10) {
        formText = text.substring(0, 10);
      }
      controllers.putIfAbsent(entry.value, () => TextEditingController()).text = formText;
    }
    final wdRaw = client['visit_weekdays'];
    if (wdRaw != null) {
      List<int> days = const [];
      if (wdRaw is String && wdRaw.isNotEmpty) {
        try {
          days = (jsonDecode(wdRaw) as List).map((e) => (e as num).toInt()).toList();
        } catch (_) {}
      } else if (wdRaw is List) {
        days = wdRaw.map((e) => (e as num).toInt()).toList();
      }
      if (days.isNotEmpty) {
        const labels = {1: 'ПН', 2: 'ВТ', 3: 'СР', 4: 'ЧТ', 5: 'ПТ', 6: 'СБ', 7: 'ВС'};
        final label = days.map((d) => labels[d] ?? '').where((s) => s.isNotEmpty).join(', ');
        if (label.isNotEmpty) {
          controllers.putIfAbsent('visit_day', () => TextEditingController()).text = label;
        }
      }
    }
  }
}
