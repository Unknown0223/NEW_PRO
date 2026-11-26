class ShareRequestSummary {
  final int id;
  final String status;
  final int senderUserId;
  final int receiverUserId;
  final int orderCount;
  final String senderName;
  final String receiverName;

  const ShareRequestSummary({
    required this.id,
    required this.status,
    required this.senderUserId,
    required this.receiverUserId,
    required this.orderCount,
    this.senderName = '',
    this.receiverName = '',
  });

  factory ShareRequestSummary.fromJson(Map<String, dynamic> j) {
    final orders = j['orders'];
    final count = orders is List ? orders.length : (j['order_count'] as num?)?.toInt() ?? 0;
    return ShareRequestSummary(
      id: (j['id'] as num).toInt(),
      status: (j['status'] ?? '').toString(),
      senderUserId: (j['sender_user_id'] as num?)?.toInt() ?? 0,
      receiverUserId: (j['receiver_user_id'] as num?)?.toInt() ?? 0,
      orderCount: count,
      senderName: (j['sender_name'] ?? '').toString().trim(),
      receiverName: (j['receiver_name'] ?? '').toString().trim(),
    );
  }

  /// Ro‘yxat yorlig‘i — faqat nom (id qo‘shilmaydi).
  String counterpartLabel({required bool inbox}) {
    final name = inbox ? senderName : receiverName;
    return name.isEmpty ? '—' : name;
  }
}

String shareStatusLabel(String status) {
  switch (status) {
    case 'kutilmoqda':
      return 'Kutilmoqda';
    case 'korildi':
      return 'Ko\'rildi';
    case 'qisman_qabul':
      return 'Qisman qabul';
    case 'qabul_qilindi':
      return 'Qabul qilindi';
    case 'yuk_kutilmoqda':
      return 'Yuk/foto kutilmoqda';
    case 'faol':
      return 'Faol';
    case 'rad':
      return 'Rad';
    case 'bekor':
      return 'Bekor';
    case 'qaytarish_kutilmoqda':
      return 'Qaytarish kutilmoqda';
    case 'qaytarildi':
      return 'Qaytarildi';
    case 'tugallandi':
      return 'Tugallandi';
    default:
      return status;
  }
}
