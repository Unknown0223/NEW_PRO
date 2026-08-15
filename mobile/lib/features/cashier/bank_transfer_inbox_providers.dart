import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/bank_transfer_inbox_api.dart';
import '../../../core/auth/session.dart';

typedef BtiTab = String;
typedef BtiChannel = String;

const btiTabs = <({BtiTab key, String label})>[
  (key: 'unmatched', label: 'Без клиента'),
  (key: 'ambiguous', label: 'Спорные'),
  (key: 'pending', label: 'Ожидают'),
  (key: 'new', label: 'Новые'),
  (key: 'done', label: 'Готово'),
];

const btiChannels = <({BtiChannel key, String label})>[
  (key: 'manual', label: 'Вручную'),
  (key: 'bank_verified', label: 'Банк / 1С'),
];

final btiSelectedTabProvider = StateProvider<BtiTab>((ref) => 'unmatched');
final btiSelectedChannelProvider = StateProvider<BtiChannel>((ref) => 'bank_verified');

final btiCountsProvider = FutureProvider.autoDispose<Map<String, int>>((ref) async {
  final slug = ref.watch(sessionProvider).tenantSlug;
  final channel = ref.watch(btiSelectedChannelProvider);
  if (slug == null || slug.isEmpty) return {};
  return ref.read(bankTransferInboxApiProvider).getCounts(slug, channel: channel);
});

final btiListProvider =
    FutureProvider.autoDispose.family<({List<Map<String, dynamic>> items, int total}), BtiTab>(
  (ref, tab) async {
    final slug = ref.watch(sessionProvider).tenantSlug;
    final channel = ref.watch(btiSelectedChannelProvider);
    if (slug == null || slug.isEmpty) return (items: <Map<String, dynamic>>[], total: 0);
    return ref.read(bankTransferInboxApiProvider).list(slug, tab: tab, channel: channel);
  },
);

final btiDetailProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, int>((ref, id) async {
  final slug = ref.watch(sessionProvider).tenantSlug;
  if (slug == null || slug.isEmpty) return {};
  return ref.read(bankTransferInboxApiProvider).getDetail(slug, id);
});

String btiStatusLabel(String? status) {
  switch (status) {
    case 'unmatched':
      return 'Без клиента';
    case 'ambiguous':
      return 'Спорный';
    case 'matched':
      return 'Совпадение';
    case 'pending':
      return 'Ожидает подтверждения';
    case 'done':
      return 'Готово';
    case 'ignored':
      return 'Игнорирован';
    default:
      return status ?? '—';
  }
}

String btiChannelKey(Map<String, dynamic> row) {
  final ch = row['channel']?.toString();
  if (ch == 'manual' || ch == 'bank_verified') return ch!;
  return row['source']?.toString() == 'manual' ? 'manual' : 'bank_verified';
}

String btiChannelLabel(String? channel) {
  return channel == 'manual' ? 'Вручную' : 'Банк / 1С';
}

String btiChannelBadge(Map<String, dynamic> row) {
  return btiChannelLabel(btiChannelKey(row));
}
