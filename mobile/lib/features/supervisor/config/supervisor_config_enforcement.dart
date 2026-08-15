import '../../../core/config/mobile_config.dart';

class SupervisorConfigPolicy {
  final SupervisionConfig? supervision;
  final MiscConfig? misc;

  const SupervisorConfigPolicy({this.supervision, this.misc});

  bool get hasAnyChecklist =>
      supervision?.checkReceiptFaces == true ||
      supervision?.checkMerchandising == true ||
      supervision?.checkDefaultPrice == true ||
      supervision?.checkMotivation == true ||
      supervision?.checkStock == true ||
      supervision?.checkSales == true;

  List<String> enabledChecklistLabels() {
    final s = supervision;
    if (s == null) return [];
    final out = <String>[];
    if (s.checkReceiptFaces) out.add('Chek yuzlari');
    if (s.checkMerchandising) out.add('Merchandising');
    if (s.checkDefaultPrice) out.add('Narx tekshiruv');
    if (s.checkMotivation) out.add('Motivatsiya');
    if (s.checkStock) out.add('Ombor');
    if (s.checkSales) out.add('Sotuvlar');
    return out;
  }
}
