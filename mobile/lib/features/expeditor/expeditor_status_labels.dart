/// Ekspeditor buyurtma holati — foydalanuvchiga ko'rinadigan matn.
String expeditorStatusLabel(String status) {
  switch (status.trim().toLowerCase()) {
    case 'new':
      return 'Новый';
    case 'confirmed':
      return 'Подтверждён';
    case 'picking':
      return 'Сборка';
    case 'delivering':
      return 'Доставляется';
    case 'delivered':
      return 'Доставлен';
    case 'returned':
      return 'Возвращён';
    case 'cancelled':
      return 'Отменён';
    default:
      return status;
  }
}

String expeditorReturnReasonLabel(String code) {
  switch (code) {
    case 'defective':
      return 'Бракованный товар';
    case 'wrong':
      return 'Неверный товар';
    case 'excess':
      return 'Излишек';
    case 'other':
      return 'Другое';
    default:
      return code;
  }
}

/// To'lov arizasi holati (web tasdiqlashdan oldin/ keyin).
String expeditorPaymentWorkflowLabel(String status) {
  switch (status.trim().toLowerCase()) {
    case 'pending_confirmation':
      return 'На подтверждении';
    case 'confirmed':
      return 'Подтверждено';
    case 'rejected':
      return 'Отклонено';
    case 'deleted':
      return 'Отменено';
    default:
      return status;
  }
}

bool expeditorPaymentIsPending(String status) =>
    status.trim().toLowerCase() == 'pending_confirmation';
