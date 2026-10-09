import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Asosiy sahifada yangi yaratilgan zakaz raqamini ko‘rsatish.
class LastCreatedOrderBanner {
  final String number;
  final int? orderId;
  final String? clientName;

  const LastCreatedOrderBanner({
    required this.number,
    this.orderId,
    this.clientName,
  });
}

final lastCreatedOrderBannerProvider =
    StateProvider<LastCreatedOrderBanner?>((ref) => null);
