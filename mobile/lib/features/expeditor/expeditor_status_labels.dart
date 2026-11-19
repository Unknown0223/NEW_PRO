/// Ekspeditor buyurtma holati — foydalanuvchiga ko'rinadigan matn.
String expeditorStatusLabel(String status) {
  switch (status.trim().toLowerCase()) {
    case 'new':
      return 'Yangi';
    case 'confirmed':
      return 'Tasdiqlangan';
    case 'picking':
      return 'Yig\'ilmoqda';
    case 'delivering':
      return 'Yetkazilmoqda';
    case 'delivered':
      return 'Yetkazildi';
    case 'returned':
      return 'Qaytarildi';
    case 'cancelled':
      return 'Bekor qilindi';
    default:
      return status;
  }
}

String expeditorReturnReasonLabel(String code) {
  switch (code) {
    case 'defective':
      return 'Nuqsonli mahsulot';
    case 'wrong':
      return 'Noto\'g\'ri mahsulot';
    case 'excess':
      return 'Ortiqcha';
    case 'other':
      return 'Boshqa';
    default:
      return code;
  }
}

/// To'lov arizasi holati (web tasdiqlashdan oldin/ keyin).
String expeditorPaymentWorkflowLabel(String status) {
  switch (status.trim().toLowerCase()) {
    case 'pending_confirmation':
      return 'Tasdiqlanmoqda';
    case 'confirmed':
      return 'Tasdiqlandi';
    case 'rejected':
      return 'Rad etildi';
    case 'deleted':
      return 'Bekor qilindi';
    default:
      return status;
  }
}

bool expeditorPaymentIsPending(String status) =>
    status.trim().toLowerCase() == 'pending_confirmation';
