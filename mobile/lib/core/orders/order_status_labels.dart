import 'package:flutter/material.dart';

import '../ui/agent_ui_extended.dart';

/// Web `ORDER_STATUS_LABELS` / `order-list-status-labels.ts` bilan mos.
const _orderStatusLabels = <String, String>{
  'new': 'Новый',
  'confirmed': 'Подтверждён',
  'picking': 'Комплектация',
  'delivering': 'Отгружен',
  'delivered': 'Доставлен',
  'returned': 'Возврат',
  'cancelled': 'Отменён',
};

const _returnStatusLabels = <String, String>{
  'new': 'Новый возврат',
  'confirmed': 'Подтвержден к возврату',
  'picking': 'Комплектация возврата',
  'delivering': 'Возврат отгружен',
  'delivered': 'Возврат доставлен',
  'returned': 'В процессе возврата',
  'cancelled': 'Возврат отменен',
};

const _returnOrderTypes = {'return', 'return_by_order', 'partial_return'};

class _OrderStatusStyle {
  final Color bg;
  final Color fg;
  const _OrderStatusStyle(this.bg, this.fg);
}

/// Web `orderListStatusStyle` ranglari.
const _statusStyles = <String, _OrderStatusStyle>{
  'new': _OrderStatusStyle(Color(0xFFBAE6FD), Color(0xFF0369A1)),
  'confirmed': _OrderStatusStyle(Color(0xFFFEF08A), Color(0xFF854D0E)),
  'picking': _OrderStatusStyle(Color(0xFFE0E7FF), Color(0xFF3730A3)),
  'delivering': _OrderStatusStyle(Color(0xFFFED7AA), Color(0xFF9A3412)),
  'delivered': _OrderStatusStyle(Color(0xFFBBF7D0), Color(0xFF166534)),
  'returned': _OrderStatusStyle(Color(0xFFF9A8D4), Color(0xFF9D174D)),
  'cancelled': _OrderStatusStyle(Color(0xFFE5E7EB), Color(0xFF4B5563)),
};

bool _isReturnOrderType(String orderType) => _returnOrderTypes.contains(orderType.trim().toLowerCase());

String orderStatusLabel(String status, {String orderType = 'order'}) {
  final s = status.trim().toLowerCase();
  final ot = orderType.trim().toLowerCase();
  if (ot == 'exchange') return 'Обмен';
  if (_isReturnOrderType(ot)) {
    return _returnStatusLabels[s] ?? _orderStatusLabels[s] ?? (status.isNotEmpty ? status : '—');
  }
  return _orderStatusLabels[s] ?? (status.isNotEmpty ? status : '—');
}

AgentStatusChip orderStatusChip(String status, {String orderType = 'order'}) {
  final s = status.trim().toLowerCase();
  final label = orderStatusLabel(status, orderType: orderType);
  final style = _statusStyles[s] ?? _statusStyles['new']!;
  return AgentStatusChip(label: label, bg: style.bg, fg: style.fg);
}
