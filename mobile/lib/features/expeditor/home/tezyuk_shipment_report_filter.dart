import 'expeditor_home_model.dart';

/// Umumiy yuklar hisoboti: faqat summa yoki miqdori noldan farq qiladigan qatorlar.
List<HomeShipmentLine> filterVisibleShipmentLines(List<HomeShipmentLine> lines) {
  return lines.where((line) => line.sum != 0 || line.qty != 0).toList();
}
