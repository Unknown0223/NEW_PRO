import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_exceptions.dart';
import '../../../core/api/expeditor_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../../agent/orders/order_create_models.dart' show formatMoneySpaced;
import '../expeditor_providers.dart';

/// Qaytarish usuli:
/// - [byProducts] — savdo va bonus dona alohida belgilanadi (qo'lda);
/// - [byOrder] — kategoriya bo'yicha akkordeon, har mahsulotga bitta umumiy
///   miqdor; savdo/bonus bo'linishini tizim avtomatik hisoblaydi;
/// - [fullOrder] — to'liq zakaz: barcha mahsulotlar avtomatik to'liq belgilanadi
///   (kiritish yo'q, faqat ko'rsatiladi va tasdiqlanadi).
enum _ReturnMethod { byProducts, byOrder, fullOrder }

/// «Возврат с полки по заказу» — bitta zakaz bo'yicha mahsulot qaytarish.
/// Agent zakaz UI'sining teskari ko'rinishi (oranj rang). Faqat zakaz ichidagi
/// mahsulotlar, ortiqcha kiritib bo'lmaydi; savdo va bonus alohida hisoblanadi.
class ExpeditorReturnByOrderPage extends ConsumerStatefulWidget {
  final int? initialOrderId;
  const ExpeditorReturnByOrderPage({super.key, this.initialOrderId});

  @override
  ConsumerState<ExpeditorReturnByOrderPage> createState() =>
      _ExpeditorReturnByOrderPageState();
}

class _ExpeditorReturnByOrderPageState
    extends ConsumerState<ExpeditorReturnByOrderPage> {
  int? _orderId;
  // «По продуктам» — savdo va bonus alohida kiritiladi.
  final Map<int, double> _paid = {};
  final Map<int, double> _bonus = {};
  // «По заказу» / «Полный заказ» — har mahsulotga bitta umumiy miqdor.
  final Map<int, double> _returnQty = {};
  // Peresort (almashtirish): manba mahsulot → bonus yo'naltiriladigan «aka-uka»
  // (interchangeable) mahsulot id'si.
  final Map<int, int> _swap = {};
  // Joriy zakaz tarkibidan peresort opsiyalari (product_id → variantlar).
  Map<int, List<Map<String, dynamic>>> _peresort = {};
  bool _peresortEnabled = false;
  final _noteCtrl = TextEditingController();
  String _reason = '';
  bool _submitting = false;
  _ReturnMethod _method = _ReturnMethod.byProducts;

  // Zakaz tanlash ro'yxati filtrlari (mijoz / davr / kategoriya / tovar).
  int? _fClient;
  int? _fCategory;
  int? _fProduct;
  DateTime? _fFrom;
  DateTime? _fTo;

  @override
  void initState() {
    super.initState();
    _orderId = widget.initialOrderId;
  }

  @override
  void dispose() {
    _noteCtrl.dispose();
    super.dispose();
  }

  void _toast(String msg, {Color color = AppColors.warning}) {
    if (!mounted) return;
    showAgentToast(context, msg, accentColor: color);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(_orderId == null
            ? 'Возврат с полки по заказу'
            : 'Возврат · заказ',),
      ),
      body: _orderId == null ? _orderPicker() : _composition(_orderId!),
    );
  }

  // ─── 1) Zakaz tanlash (balans/davr filtri) ───────────────────────────────
  Widget _orderPicker() {
    final async = ref.watch(expeditorReturnByOrderOrdersProvider);
    return async.when(
      loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.expeditorAccent),),
      error: (e, _) => _errorView(e),
      data: (data) {
        final orders = ((data['orders'] as List?) ?? const [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
        final mode = data['filter_mode']?.toString();
        if (orders.isEmpty) {
          return RefreshIndicator(
            onRefresh: () async =>
                ref.invalidate(expeditorReturnByOrderOrdersProvider),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                SizedBox(
                  height: MediaQuery.sizeOf(context).height * 0.6,
                  child: AgentEmptyState.fill(
                      message:
                          'Нет заказов, доступных для возврата по текущим настройкам',),
                ),
              ],
            ),
          );
        }
        final shown = _applyFilters(orders);
        return Column(
          children: [
            _filterHeader(orders, mode),
            Expanded(
              child: RefreshIndicator(
                onRefresh: () async =>
                    ref.invalidate(expeditorReturnByOrderOrdersProvider),
                child: shown.isEmpty
                    ? ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        children: [
                          SizedBox(
                            height: MediaQuery.sizeOf(context).height * 0.5,
                            child: AgentEmptyState.fill(
                                message:
                                    'По выбранным фильтрам заказов нет',),
                          ),
                        ],
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(12),
                        itemCount: shown.length,
                        itemBuilder: (_, i) {
                          final o = shown[i];
                          return Card(
                            margin: const EdgeInsets.only(bottom: 8),
                            child: ListTile(
                              leading: CircleAvatar(
                                backgroundColor: AppColors.expeditorAccent
                                    .withValues(alpha: 0.1),
                                child: const Icon(Icons.receipt_long,
                                    color: AppColors.expeditorAccent,),
                              ),
                              title: Text('№ ${o['number'] ?? o['id']}',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w700,),),
                              subtitle: Text(
                                '${o['client_name'] ?? ''}\n'
                                "${formatMoneySpaced((o['total_sum'] as num?)?.toDouble() ?? 0)} So'm",
                                maxLines: 2,
                              ),
                              isThreeLine: true,
                              trailing: const Icon(Icons.chevron_right),
                              onTap: () {
                                setState(() {
                                  _orderId = o['id'] as int?;
                                  _paid.clear();
                                  _bonus.clear();
                                  _returnQty.clear();
                                  _swap.clear();
                                  _method = _ReturnMethod.byProducts;
                                });
                              },
                            ),
                          );
                        },
                      ),
              ),
            ),
          ],
        );
      },
    );
  }

  bool get _hasActiveFilter =>
      _fClient != null ||
      _fCategory != null ||
      _fProduct != null ||
      _fFrom != null ||
      _fTo != null;

  /// Tanlangan filtrlar bo'yicha zakazlarni ajratish (mijoz/davr/kategoriya/tovar).
  List<Map<String, dynamic>> _applyFilters(List<Map<String, dynamic>> orders) {
    return orders.where((o) {
      if (_fClient != null && o['client_id'] != _fClient) return false;
      final created = DateTime.tryParse(o['created_at']?.toString() ?? '');
      if (_fFrom != null && created != null) {
        final from = DateTime(_fFrom!.year, _fFrom!.month, _fFrom!.day);
        if (created.isBefore(from)) return false;
      }
      if (_fTo != null && created != null) {
        final to = DateTime(_fTo!.year, _fTo!.month, _fTo!.day, 23, 59, 59);
        if (created.isAfter(to)) return false;
      }
      final products = ((o['products'] as List?) ?? const [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
      if (_fCategory != null &&
          !products.any((p) => p['category_id'] == _fCategory)) {
        return false;
      }
      if (_fProduct != null &&
          !products.any((p) => p['product_id'] == _fProduct)) {
        return false;
      }
      return true;
    }).toList();
  }

  Widget _filterHeader(List<Map<String, dynamic>> orders, String? mode) {
    return Container(
      width: double.infinity,
      color: AppColors.expeditorAccent.withValues(alpha: 0.06),
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.tune,
                  size: 16, color: AppColors.expeditorAccent,),
              const SizedBox(width: 8),
              Expanded(
                child: Text(_modeLabel(mode),
                    style: AppTypography.caption
                        .copyWith(color: AppColors.expeditorAccent),),
              ),
              TextButton.icon(
                onPressed: () => _openFilterSheet(orders),
                icon: const Icon(Icons.filter_list, size: 18),
                label: Text(_hasActiveFilter ? 'Фильтр •' : 'Фильтр'),
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.expeditorAccent,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  minimumSize: const Size(0, 32),
                ),
              ),
            ],
          ),
          if (_hasActiveFilter)
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                if (_fClient != null)
                  _chip(_clientName(orders, _fClient!),
                      () => setState(() => _fClient = null),),
                if (_fFrom != null || _fTo != null)
                  _chip(_periodLabel(),
                      () => setState(() {
                            _fFrom = null;
                            _fTo = null;
                          }),),
                if (_fCategory != null)
                  _chip(_categoryName(orders, _fCategory!),
                      () => setState(() => _fCategory = null),),
                if (_fProduct != null)
                  _chip(_productName(orders, _fProduct!),
                      () => setState(() => _fProduct = null),),
              ],
            ),
        ],
      ),
    );
  }

  Widget _chip(String label, VoidCallback onClear) {
    return Chip(
      label: Text(label, style: const TextStyle(fontSize: 12)),
      backgroundColor: AppColors.surface,
      side: const BorderSide(color: AppColors.expeditorAccent),
      labelStyle: const TextStyle(color: AppColors.expeditorAccent),
      deleteIconColor: AppColors.expeditorAccent,
      onDeleted: onClear,
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
      visualDensity: VisualDensity.compact,
    );
  }

  String _modeLabel(String? mode) {
    switch (mode) {
      case 'period_only':
        return 'Условие: по сроку (период)';
      case 'balance_zero_only':
        return 'Условие: по балансу (с обнуления)';
      case 'period_and_balance_zero':
        return 'Условие: по сроку и балансу';
      default:
        return 'Условие: без ограничений';
    }
  }

  String _periodLabel() {
    String f(DateTime? d) =>
        d == null ? '…' : '${d.day.toString().padLeft(2, '0')}.${d.month.toString().padLeft(2, '0')}';
    return '${f(_fFrom)} – ${f(_fTo)}';
  }

  // ─── Filtr opsiyalari (ro'yxatdagi ma'lumotdan) ──────────────────────────
  List<Map<String, dynamic>> _clientOptions(List<Map<String, dynamic>> orders) {
    final m = <int, String>{};
    for (final o in orders) {
      final id = o['client_id'] as int?;
      if (id != null) m[id] = (o['client_name'] ?? '').toString();
    }
    final list = m.entries
        .map((e) => <String, dynamic>{'id': e.key, 'name': e.value})
        .toList()
      ..sort((a, b) => (a['name'] as String).compareTo(b['name'] as String));
    return list;
  }

  List<Map<String, dynamic>> _categoryOptions(
      List<Map<String, dynamic>> orders,) {
    final m = <int, String>{};
    for (final o in orders) {
      for (final p in ((o['products'] as List?) ?? const [])) {
        final pm = Map<String, dynamic>.from(p as Map);
        final id = pm['category_id'] as int?;
        if (id != null) {
          m[id] = (pm['category_name'] ?? 'Без категории').toString();
        }
      }
    }
    final list = m.entries
        .map((e) => <String, dynamic>{'id': e.key, 'name': e.value})
        .toList()
      ..sort((a, b) => (a['name'] as String).compareTo(b['name'] as String));
    return list;
  }

  List<Map<String, dynamic>> _productOptions(
      List<Map<String, dynamic>> orders,) {
    final m = <int, Map<String, dynamic>>{};
    for (final o in orders) {
      for (final p in ((o['products'] as List?) ?? const [])) {
        final pm = Map<String, dynamic>.from(p as Map);
        final id = pm['product_id'] as int?;
        if (id != null) {
          m[id] = {
            'id': id,
            'name': (pm['name'] ?? '').toString(),
            'sku': (pm['sku'] ?? '').toString(),
            'category_id': pm['category_id'],
          };
        }
      }
    }
    final list = m.values.toList()
      ..sort((a, b) => (a['name'] as String).compareTo(b['name'] as String));
    return list;
  }

  String _clientName(List<Map<String, dynamic>> orders, int id) {
    final o = orders.firstWhere((e) => e['client_id'] == id,
        orElse: () => <String, dynamic>{},);
    return (o['client_name'] ?? '№$id').toString();
  }

  String _categoryName(List<Map<String, dynamic>> orders, int id) {
    final c = _categoryOptions(orders)
        .firstWhere((e) => e['id'] == id, orElse: () => <String, dynamic>{});
    return (c['name'] ?? '№$id').toString();
  }

  String _productName(List<Map<String, dynamic>> orders, int id) {
    final p = _productOptions(orders)
        .firstWhere((e) => e['id'] == id, orElse: () => <String, dynamic>{});
    return (p['name'] ?? '№$id').toString();
  }

  Future<void> _openFilterSheet(List<Map<String, dynamic>> orders) async {
    var client = _fClient;
    var category = _fCategory;
    var product = _fProduct;
    var from = _fFrom;
    var to = _fTo;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheet) {
            final clientOpts = _clientOptions(orders);
            final catOpts = _categoryOptions(orders);
            // Tanlangan kategoriya bo'yicha tovarlarni cheklash.
            final prodOpts = _productOptions(orders)
                .where((p) => category == null || p['category_id'] == category)
                .toList();
            String fmtDate(DateTime? d) => d == null
                ? 'Выбрать'
                : '${d.day.toString().padLeft(2, '0')}.${d.month.toString().padLeft(2, '0')}.${d.year}';

            return Padding(
              padding: EdgeInsets.only(
                left: 16,
                right: 16,
                top: 16,
                bottom: MediaQuery.viewInsetsOf(ctx).bottom + 16,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Text('Фильтр заказов',
                            style: TextStyle(
                                fontWeight: FontWeight.w800, fontSize: 16,),),
                        const Spacer(),
                        IconButton(
                          onPressed: () => Navigator.pop(ctx),
                          icon: const Icon(Icons.close),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    DropdownButtonFormField<int>(
                      isExpanded: true,
                      initialValue: client,
                      decoration: const InputDecoration(
                          labelText: 'Клиент', border: OutlineInputBorder(),),
                      items: [
                        const DropdownMenuItem<int>(
                            value: null, child: Text('Все клиенты'),),
                        ...clientOpts.map((c) => DropdownMenuItem<int>(
                              value: c['id'] as int,
                              child: Text(c['name'] as String,
                                  overflow: TextOverflow.ellipsis,),
                            ),),
                      ],
                      onChanged: (v) => setSheet(() => client = v),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            icon: const Icon(Icons.calendar_today, size: 16),
                            label: Text('С: ${fmtDate(from)}',
                                overflow: TextOverflow.ellipsis,),
                            onPressed: () async {
                              final d = await _pickDate(ctx, from);
                              if (d != null) setSheet(() => from = d);
                            },
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: OutlinedButton.icon(
                            icon: const Icon(Icons.calendar_today, size: 16),
                            label: Text('По: ${fmtDate(to)}',
                                overflow: TextOverflow.ellipsis,),
                            onPressed: () async {
                              final d = await _pickDate(ctx, to);
                              if (d != null) setSheet(() => to = d);
                            },
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<int>(
                      isExpanded: true,
                      initialValue: category,
                      decoration: const InputDecoration(
                          labelText: 'Категория',
                          border: OutlineInputBorder(),),
                      items: [
                        const DropdownMenuItem<int>(
                            value: null, child: Text('Все категории'),),
                        ...catOpts.map((c) => DropdownMenuItem<int>(
                              value: c['id'] as int,
                              child: Text(c['name'] as String,
                                  overflow: TextOverflow.ellipsis,),
                            ),),
                      ],
                      onChanged: (v) => setSheet(() {
                        category = v;
                        product = null;
                      }),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<int>(
                      isExpanded: true,
                      initialValue: prodOpts.any((p) => p['id'] == product)
                          ? product
                          : null,
                      decoration: const InputDecoration(
                          labelText: 'Товар', border: OutlineInputBorder(),),
                      items: [
                        const DropdownMenuItem<int>(
                            value: null, child: Text('Все товары'),),
                        ...prodOpts.map((p) => DropdownMenuItem<int>(
                              value: p['id'] as int,
                              child: Text(
                                  '${p['name']}'
                                  '${(p['sku'] as String).isNotEmpty ? ' · ${p['sku']}' : ''}',
                                  overflow: TextOverflow.ellipsis,),
                            ),),
                      ],
                      onChanged: (v) => setSheet(() => product = v),
                    ),
                    const SizedBox(height: 18),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => setSheet(() {
                              client = null;
                              category = null;
                              product = null;
                              from = null;
                              to = null;
                            }),
                            child: const Text('Сбросить'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.expeditorAccent,
                              foregroundColor: Colors.white,
                            ),
                            onPressed: () {
                              setState(() {
                                _fClient = client;
                                _fCategory = category;
                                _fProduct = product;
                                _fFrom = from;
                                _fTo = to;
                              });
                              Navigator.pop(ctx);
                            },
                            child: const Text('Применить'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Future<DateTime?> _pickDate(BuildContext ctx, DateTime? initial) {
    final now = DateTime.now();
    return showDatePicker(
      context: ctx,
      initialDate: initial ?? now,
      firstDate: DateTime(now.year - 2),
      lastDate: now,
    );
  }

  // ─── 2) Zakaz tarkibi + qiymat kiritish ──────────────────────────────────
  Widget _composition(int orderId) {
    final async = ref.watch(expeditorReturnCompositionProvider(orderId));
    return async.when(
      loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.expeditorAccent),),
      error: (e, _) => _errorView(e, allowBack: widget.initialOrderId == null),
      data: (data) {
        final items = ((data['items'] as List?) ?? const [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
        if (items.isEmpty) {
          return AgentEmptyState.fill(
              message: 'Нет товаров, доступных к возврату',);
        }
        return _form(orderId, data, items);
      },
    );
  }

  /// Composition itemlarini UNIKAL mahsulot bo'yicha guruhlash.
  /// Bitta mahsulot ham savdo, ham o'z bonusiga ega bo'lsa — bitta kartada
  /// ikkita input (savdo + bonus). Faqat bonus bo'lgan mahsulot — alohida.
  List<Map<String, dynamic>> _groupProducts(List<Map<String, dynamic>> items) {
    final order = <int>[];
    final map = <int, Map<String, dynamic>>{};
    for (final it in items) {
      final pid = it['product_id'] as int?;
      if (pid == null) continue;
      final isBonus = it['is_bonus'] == true;
      final maxQty = (it['max_qty'] as num?)?.toDouble() ?? 0;
      final price = (it['price'] as num?)?.toDouble() ?? 0;
      if (!map.containsKey(pid)) {
        order.add(pid);
        map[pid] = {
          'product_id': pid,
          'name': it['name'] ?? '',
          'sku': it['sku'] ?? '',
          'price': price,
          'max_paid': 0.0,
          'max_bonus': 0.0,
          'category_id': it['category_id'],
          'category_name': it['category_name'],
        };
      }
      final m = map[pid]!;
      if (price > 0) m['price'] = price;
      if (isBonus) {
        m['max_bonus'] = (m['max_bonus'] as double) + maxQty;
      } else {
        m['max_paid'] = (m['max_paid'] as double) + maxQty;
      }
    }
    return order.map((pid) => map[pid]!).toList();
  }

  Widget _form(
      int orderId, Map<String, dynamic> data, List<Map<String, dynamic>> items,) {
    final orderNo = (data['order'] as Map?)?['number']?.toString() ?? '$orderId';
    final products = _groupProducts(items);

    // Peresort opsiyalari (sozlamalardagi interchangeable guruhlar bo'yicha).
    _peresortEnabled = data['peresort_enabled'] == true;
    _peresort = {};
    final peresortRaw = (data['peresort'] as Map?) ?? const {};
    peresortRaw.forEach((k, v) {
      final pid = int.tryParse(k.toString());
      if (pid == null) return;
      _peresort[pid] = ((v as List?) ?? const [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
    });

    final fullOrder = _method == _ReturnMethod.fullOrder;
    final byOrder = _method == _ReturnMethod.byOrder;

    // «Полный заказ» — barcha mahsulotlarni to'liq (max) avtomatik belgilash.
    if (fullOrder) {
      _returnQty.clear();
      for (final p in products) {
        final t = (p['max_paid'] as double) + (p['max_bonus'] as double);
        if (t > 0) _returnQty[p['product_id'] as int] = t;
      }
    }

    var saleSum = 0.0;
    var bonusQty = 0.0;
    for (final p in products) {
      final pid = p['product_id'] as int;
      final price = p['price'] as double;
      saleSum += (_paid[pid] ?? 0) * price;
      bonusQty += (_bonus[pid] ?? 0);
    }

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.receipt_long,
                        color: AppColors.expeditorAccent,),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text('Заказ № $orderNo',
                          style: const TextStyle(
                              fontWeight: FontWeight.w800, fontSize: 15,),),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              _modeSelector(),
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                child: Text(
                    fullOrder
                        ? 'Полный возврат заказа — всё автоматически'
                        : byOrder
                            ? 'По категориям — количество к возврату'
                            : 'Товары к возврату',
                    style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        color: AppColors.expeditorAccent,),),
              ),
              if (fullOrder)
                ..._categoryAccordions(products, readOnly: true)
              else if (byOrder)
                ..._categoryAccordions(products)
              else
                ...products.map(_productCard),
            ],
          ),
        ),
        _bottomBar(orderId, products, saleSum, bonusQty),
      ],
    );
  }

  /// Uch usul: «По продуктам» (savdo/bonus alohida), «По заказу» (kategoriya
  /// bo'yicha, bitta umumiy miqdor — tizim hisoblaydi) va «Полный заказ»
  /// (hammasi avtomatik to'liq).
  Widget _modeSelector() {
    Widget seg(String label, IconData icon, _ReturnMethod m) {
      final selected = _method == m;
      return Expanded(
        child: GestureDetector(
          onTap: _submitting ? null : () => _setMethod(m),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 2),
            decoration: BoxDecoration(
              color: selected ? AppColors.expeditorAccent : Colors.transparent,
              borderRadius: BorderRadius.circular(9),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon,
                    size: 18,
                    color: selected ? Colors.white : AppColors.textMuted,),
                const SizedBox(height: 4),
                Text(label,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: selected ? Colors.white : AppColors.textMuted,),),
              ],
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          seg('По\nпродуктам', Icons.checklist_rtl, _ReturnMethod.byProducts),
          seg('По\nзаказу', Icons.category_outlined, _ReturnMethod.byOrder),
          seg('Полный\nзаказ', Icons.all_inbox_outlined,
              _ReturnMethod.fullOrder,),
        ],
      ),
    );
  }

  void _setMethod(_ReturnMethod m) {
    if (_method == m) return;
    setState(() {
      _method = m;
      _paid.clear();
      _bonus.clear();
      _returnQty.clear();
      _swap.clear();
    });
  }

  /// «По заказу»/«Полный заказ» — mahsulotlar kategoriya bo'yicha akkordeonda.
  /// Har mahsulotga bitta umumiy miqdor (savdo+bonus); bo'linishni tizim
  /// hisoblaydi. [readOnly] — «Полный заказ»: faqat ko'rsatish.
  List<Widget> _categoryAccordions(List<Map<String, dynamic>> products,
      {bool readOnly = false,}) {
    final order = <String>[];
    final groups = <String, List<Map<String, dynamic>>>{};
    for (final p in products) {
      final name = (p['category_name'] as String?)?.trim();
      final key = (name == null || name.isEmpty) ? 'Без категории' : name;
      if (!groups.containsKey(key)) {
        order.add(key);
        groups[key] = [];
      }
      groups[key]!.add(p);
    }

    return order.map((cat) {
      final list = groups[cat]!;
      var catQty = 0.0;
      for (final p in list) {
        catQty += _returnQty[p['product_id'] as int] ?? 0;
      }
      return Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: catQty > 0
                ? AppColors.expeditorAccent
                : Colors.transparent,
            width: catQty > 0 ? 1.5 : 0,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: Theme(
          data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
          child: ExpansionTile(
            initiallyExpanded: true,
            tilePadding: const EdgeInsets.symmetric(horizontal: 14),
            childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
            iconColor: AppColors.expeditorAccent,
            collapsedIconColor: AppColors.textMuted,
            title: Row(
              children: [
                Expanded(
                  child: Text(cat,
                      style: const TextStyle(fontWeight: FontWeight.w800),),
                ),
                if (catQty > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 2,),
                    decoration: BoxDecoration(
                      color: AppColors.expeditorAccent.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text('${_fmtQty(catQty)} шт',
                        style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: AppColors.expeditorAccent,),),
                  ),
              ],
            ),
            children:
                list.map((p) => _orderProductRow(p, readOnly: readOnly)).toList(),
          ),
        ),
      );
    }).toList();
  }

  /// «По заказу»/«Полный заказ» — bitta mahsulot qatori (umumiy miqdor).
  Widget _orderProductRow(Map<String, dynamic> p, {bool readOnly = false}) {
    final pid = p['product_id'] as int;
    final price = p['price'] as double;
    final maxPaid = p['max_paid'] as double;
    final maxBonus = p['max_bonus'] as double;
    final maxTotal = maxPaid + maxBonus;
    final qty = _returnQty[pid] ?? 0;

    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${p['name'] ?? ''}',
              style: const TextStyle(fontWeight: FontWeight.w700),),
          const SizedBox(height: 2),
          Row(
            children: [
              Expanded(
                child: Text(
                  'макс: ${_fmtQty(maxTotal)}'
                  "${price > 0 ? '   ·   ${formatMoneySpaced(price)} So\'m' : ''}",
                  style: AppTypography.caption.copyWith(
                      color: qty > 0
                          ? AppColors.expeditorAccent
                          : AppColors.textMuted,),
                ),
              ),
              if (readOnly)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.expeditorAccent.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text('${_fmtQty(qty)} шт',
                      style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          color: AppColors.expeditorAccent,),),
                )
              else
                AgentEditableQuantityStepper(
                  value: qty,
                  min: 0,
                  max: maxTotal,
                  disabled: _submitting || maxTotal <= 0,
                  onChanged: (v) => setState(() {
                    if (v <= 0) {
                      _returnQty.remove(pid);
                    } else {
                      _returnQty[pid] = v;
                    }
                  }),
                ),
            ],
          ),
          _peresortControls(p),
        ],
      ),
    );
  }

  String _fmtQty(double v) =>
      v.toStringAsFixed(v.truncateToDouble() == v ? 0 : 2);

  /// Peresort (almashtirish) boshqaruvi — «Возврат другого товара».
  /// Faqat sozlamalardagi interchangeable guruhga kiruvchi, shu zakazda bonus
  /// qoldig'i bor mahsulotlar uchun ko'rinadi. Bonus qismi tanlangan «aka-uka»
  /// mahsulotga yo'naltiriladi.
  Widget _peresortControls(Map<String, dynamic> p) {
    if (!_peresortEnabled) return const SizedBox.shrink();
    final pid = p['product_id'] as int;
    final options = _peresort[pid] ?? const [];
    if (options.isEmpty) return const SizedBox.shrink();

    final selectedId = _swap[pid];
    Map<String, dynamic>? selected;
    if (selectedId != null) {
      for (final o in options) {
        if (o['id'] == selectedId) {
          selected = o;
          break;
        }
      }
    }

    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _submitting ? null : () => _openSwapSheet(p),
              icon: const Icon(Icons.swap_horiz, size: 18),
              label: const Text('Возврат другого товара'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.expeditorAccent,
                side: BorderSide(
                    color: AppColors.expeditorAccent.withValues(alpha: 0.5),),
                padding: const EdgeInsets.symmetric(vertical: 8),
              ),
            ),
          ),
          if (selected != null)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Row(
                children: [
                  const Icon(Icons.arrow_forward,
                      size: 14, color: AppColors.success,),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      'Товар → ${selected['name']}',
                      style: AppTypography.caption
                          .copyWith(color: AppColors.success),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  InkWell(
                    onTap: _submitting
                        ? null
                        : () => setState(() => _swap.remove(pid)),
                    child: const Padding(
                      padding: EdgeInsets.all(2),
                      child: Icon(Icons.close,
                          size: 16, color: AppColors.textMuted,),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  /// «Возврат другого товара» — almashtiriladigan mahsulotni tanlash oynasi.
  Future<void> _openSwapSheet(Map<String, dynamic> p) async {
    final pid = p['product_id'] as int;
    final options = _peresort[pid] ?? const [];
    if (options.isEmpty) return;
    var sel = _swap[pid];

    final result = await showModalBottomSheet<int?>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return StatefulBuilder(builder: (ctx, setSheet) {
          return Padding(
            padding: EdgeInsets.only(
              left: 16,
              right: 16,
              top: 16,
              bottom: MediaQuery.viewInsetsOf(ctx).bottom + 16,
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Expanded(
                        child: Text('Возврат другого товара',
                            style: TextStyle(
                                fontWeight: FontWeight.w800, fontSize: 16,),),
                      ),
                      IconButton(
                        onPressed: () => Navigator.pop(ctx, sel),
                        icon: const Icon(Icons.close),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text('${p['name'] ?? ''}',
                      style: AppTypography.caption
                          .copyWith(color: AppColors.textMuted),),
                  const SizedBox(height: 10),
                  ...options.map((o) {
                    final id = o['id'] as int;
                    final sku = (o['sku'] ?? '').toString();
                    final checked = sel == id;
                    return InkWell(
                      onTap: () => setSheet(() => sel = checked ? null : id),
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.background,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: checked
                                ? AppColors.expeditorAccent
                                : Colors.transparent,
                            width: checked ? 1.5 : 0,
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              checked
                                  ? Icons.radio_button_checked
                                  : Icons.radio_button_unchecked,
                              color: checked
                                  ? AppColors.expeditorAccent
                                  : AppColors.textMuted,
                              size: 20,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('${o['name'] ?? ''}',
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w700,),),
                                  if (sku.isNotEmpty) ...[
                                    const SizedBox(height: 2),
                                    Text('Артикул: $sku',
                                        style: AppTypography.caption.copyWith(
                                            color: AppColors.textMuted,),),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: SizedBox(
                          height: 48,
                          child: OutlinedButton(
                            style: OutlinedButton.styleFrom(
                              foregroundColor: AppColors.textSecondary,
                              side:
                                  const BorderSide(color: AppColors.borderLight),
                            ),
                            onPressed: () => Navigator.pop(ctx, _swap[pid]),
                            child: const Text('Отменить',
                                style: TextStyle(fontWeight: FontWeight.w700),),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        flex: 2,
                        child: SizedBox(
                          height: 48,
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.expeditorAccent,
                              foregroundColor: Colors.white,
                            ),
                            onPressed: () => Navigator.pop(ctx, sel),
                            child: const Text('Заменить',
                                style: TextStyle(
                                    fontSize: 15, fontWeight: FontWeight.w700,),),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },);
      },
    );

    if (!mounted) return;
    setState(() {
      if (result == null) {
        _swap.remove(pid);
      } else {
        _swap[pid] = result;
      }
    });
  }

  Widget _productCard(Map<String, dynamic> p) {
    final pid = p['product_id'] as int;
    final price = p['price'] as double;
    final maxPaid = p['max_paid'] as double;
    final maxBonus = p['max_bonus'] as double;
    final paid = _paid[pid] ?? 0;
    final bonus = _bonus[pid] ?? 0;
    final active = paid > 0 || bonus > 0;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: active ? AppColors.expeditorAccent : Colors.transparent,
          width: active ? 1.5 : 0,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${p['name'] ?? ''}',
              style: const TextStyle(fontWeight: FontWeight.w700),),
          const SizedBox(height: 2),
          Text(
            '${p['sku'] ?? ''}'
            "${price > 0 ? ' · ${formatMoneySpaced(price)} So\'m' : ''}",
            style: AppTypography.caption.copyWith(color: AppColors.textMuted),
          ),
          if (maxPaid > 0)
            _qtyRow(
              label: 'Продажа',
              name: '${p['name'] ?? ''}',
              color: AppColors.expeditorAccent,
              maxQty: maxPaid,
              value: paid,
              hint: paid > 0
                  ? "= ${formatMoneySpaced(paid * price)} So'm"
                  : null,
              onChanged: (v) => setState(() {
                if (v <= 0) {
                  _paid.remove(pid);
                } else {
                  _paid[pid] = v;
                }
              }),
            ),
          if (maxBonus > 0)
            _qtyRow(
              label: 'Бонус',
              name: '${p['name'] ?? ''}',
              color: AppColors.success,
              maxQty: maxBonus,
              value: bonus,
              hint: null,
              onChanged: (v) => setState(() {
                if (v <= 0) {
                  _bonus.remove(pid);
                } else {
                  _bonus[pid] = v;
                }
              }),
            ),
          _peresortControls(p),
        ],
      ),
    );
  }

  Widget _qtyRow({
    required String label,
    required Color color,
    required double maxQty,
    required double value,
    String? name,
    String? hint,
    required ValueChanged<double> onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(label,
                style: TextStyle(
                    fontSize: 11, fontWeight: FontWeight.w700, color: color,),),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (name != null && name.trim().isNotEmpty)
                  Text(name,
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: color,),),
                Text(
                  'макс: ${_fmtQty(maxQty)}${hint != null ? '   $hint' : ''}',
                  style: AppTypography.caption.copyWith(
                      color: value > 0 ? color : AppColors.textMuted,),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          AgentEditableQuantityStepper(
            value: value,
            min: 0,
            max: maxQty,
            disabled: _submitting || maxQty <= 0,
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }

  Widget _bottomBar(int orderId, List<Map<String, dynamic>> products,
      double saleSum, double bonusQty,) {
    final byOrder = _method == _ReturnMethod.byOrder ||
        _method == _ReturnMethod.fullOrder;
    final hasAny = byOrder
        ? _returnQty.values.any((v) => v > 0)
        : (_paid.values.any((v) => v > 0) || _bonus.values.any((v) => v > 0));

    double totalReturnQty = 0;
    for (final v in _returnQty.values) {
      totalReturnQty += v;
    }
    final positions = _returnQty.values.where((v) => v > 0).length;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        boxShadow: [
          BoxShadow(
              color: Color(0x0F0F172A), blurRadius: 12, offset: Offset(0, -2),),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (byOrder)
              Row(
                children: [
                  Expanded(
                    child: _totalChip('Позиций', '$positions',
                        color: AppColors.expeditorAccent,),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _totalChip(
                        'Кол-во (шт)', _fmtQty(totalReturnQty),
                        color: AppColors.success,),
                  ),
                ],
              )
            else
              Row(
                children: [
                  Expanded(
                    child: _totalChip(
                        'Сумма (продажа)', "${formatMoneySpaced(saleSum)} So'm",
                        color: AppColors.expeditorAccent,),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _totalChip('Бонус (шт)',
                        bonusQty.toStringAsFixed(
                            bonusQty.truncateToDouble() == bonusQty ? 0 : 2,),
                        color: AppColors.success,),
                  ),
                ],
              ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                onPressed: (!hasAny || _submitting)
                    ? null
                    : () => _openFinalize(orderId, products, saleSum, bonusQty),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.expeditorAccent,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: AppColors.surfaceVariant,
                  disabledForegroundColor: AppColors.textMuted,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),),
                ),
                child: _submitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white,),
                      )
                    : const Text('Оформить возврат',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w700,),),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _totalChip(String label, String value, {required Color color}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style:
                  AppTypography.caption.copyWith(color: AppColors.textMuted),),
          const SizedBox(height: 2),
          Text(value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontWeight: FontWeight.w800, color: color),),
        ],
      ),
    );
  }

  /// Joriy usul bo'yicha qaytarish satrlari.
  ///  - «По заказу» / «Полный заказ» (AUTO): `return_qty` (savdo) — bonus haqqini
  ///    va bo'linishni tizim markazdan hisoblaydi;
  ///  - «По продуктам» (MANUAL): `paid_qty` + `bonus_qty` aynan yuboriladi.
  /// [withSwap] — submit uchun: peresort manzili (`bonus_target_product_id`)
  /// savdo va bonus ikkalasiga ham tegishli.
  List<Map<String, dynamic>> _aggregatedLines({bool withSwap = false}) {
    final isAuto = _method == _ReturnMethod.byOrder ||
        _method == _ReturnMethod.fullOrder;
    final lines = <Map<String, dynamic>>[];
    if (isAuto) {
      for (final e in _returnQty.entries) {
        if (!(e.value > 0)) continue;
        final line = <String, dynamic>{
          'product_id': e.key,
          'return_qty': e.value,
        };
        if (withSwap) {
          final target = _swap[e.key];
          if (target != null) line['bonus_target_product_id'] = target;
        }
        lines.add(line);
      }
    } else {
      final pids = <int>{..._paid.keys, ..._bonus.keys};
      for (final pid in pids) {
        final paid = _paid[pid] ?? 0;
        final bonus = _bonus[pid] ?? 0;
        if (!(paid > 0) && !(bonus > 0)) continue;
        final line = <String, dynamic>{
          'product_id': pid,
          'paid_qty': paid,
          'bonus_qty': bonus,
        };
        if (withSwap) {
          final target = _swap[pid];
          if (target != null) line['bonus_target_product_id'] = target;
        }
        lines.add(line);
      }
    }
    return lines;
  }

  /// «Оформить возврат» bosilganda: tizim bonus/skidka mexanizmi bo'yicha hisoblaydi
  /// (server preview), kamchilik bo'lsa — markazdan ogohlantirish bilan
  /// tasdiqlash modal oynasi (bekor → tahrirga qaytadi).
  Future<void> _openFinalize(int orderId, List<Map<String, dynamic>> products,
      double saleSum, double bonusQty,) async {
    final lines = _aggregatedLines();
    if (lines.isEmpty) {
      _toast('Укажите количество');
      return;
    }

    final isManual = _method == _ReturnMethod.byProducts;
    double refund;
    double bonusReturned;
    double bonusDebt;
    double discountDebt = 0;
    String? discountDebtNote;
    String discountDebtMode = 'none';
    var warnings = <String>[];

    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return;

    // Preview: AUTO — to‘liq; MANUAL — skidka/ogohlantirish uchun paid return_qty.
    final previewLines = isManual
        ? [
            for (final l in lines)
              if (((l['paid_qty'] as num?)?.toDouble() ?? 0) > 0)
                {
                  'product_id': l['product_id'],
                  'return_qty': (l['paid_qty'] as num).toDouble(),
                },
          ]
        : lines;

    setState(() => _submitting = true);
    Map<String, dynamic>? preview;
    try {
      if (previewLines.isNotEmpty) {
        preview = await ref.read(expeditorApiProvider).previewReturnByOrder(
              slug,
              orderId,
              lines: previewLines,
            );
      }
    } on ApiException catch (e) {
      if (mounted) _toast('Ошибка: ${e.message}', color: AppColors.error);
      return;
    } catch (e) {
      if (mounted) _toast('Ошибка: $e', color: AppColors.error);
      return;
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
    if (!mounted) return;

    final totals = Map<String, dynamic>.from(
      (preview?['totals'] as Map?) ?? const {},
    );
    if (isManual) {
      refund = saleSum;
      bonusReturned = bonusQty;
      bonusDebt = 0;
    } else {
      refund = double.tryParse('${totals['refund_amount'] ?? 0}') ?? 0;
      bonusReturned = (totals['bonus_qty'] as num?)?.toDouble() ?? 0;
      bonusDebt = double.tryParse('${totals['bonus_debt_amount'] ?? 0}') ?? 0;
    }
    discountDebt = double.tryParse('${totals['discount_debt_amount'] ?? 0}') ?? 0;
    discountDebtNote = totals['discount_debt_note']?.toString();
    discountDebtMode = totals['discount_debt_mode']?.toString() ?? 'none';
    warnings = ((preview?['warnings'] as List?) ?? const [])
        .map((e) => e.toString())
        .where((w) => w.trim().isNotEmpty)
        .toList();

    final hasBonusDebt = bonusDebt > 0.0001;
    final hasDiscountDebt = discountDebt > 0.0001;
    final hasDiscountRecalc =
        !hasDiscountDebt && discountDebtMode == 'proportional';
    final hasDebt = hasBonusDebt || hasDiscountDebt;

    var reason = _reason;
    final accepted = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return StatefulBuilder(builder: (ctx, setSheet) {
          return Padding(
            padding: EdgeInsets.only(
              left: 16,
              right: 16,
              top: 16,
              bottom: MediaQuery.viewInsetsOf(ctx).bottom + 16,
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Text('Оформление возврата',
                          style: TextStyle(
                              fontWeight: FontWeight.w800, fontSize: 16,),),
                      const Spacer(),
                      IconButton(
                        onPressed: () => Navigator.pop(ctx, false),
                        icon: const Icon(Icons.close),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Expanded(
                        child: _totalChip('К возврату (продажа)',
                            "${formatMoneySpaced(refund)} So'm",
                            color: AppColors.expeditorAccent,),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _totalChip('Бонус (шт)', _fmtQty(bonusReturned),
                            color: AppColors.success,),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  DropdownButtonFormField<String>(
                    initialValue: reason.isEmpty ? null : reason,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      labelText: 'Причина возврата',
                      border: OutlineInputBorder(),
                    ),
                    items: const [
                      DropdownMenuItem(
                          value: 'defective',
                          child: Text('Бракованный товар'),),
                      DropdownMenuItem(
                          value: 'wrong', child: Text('Неверный товар'),),
                      DropdownMenuItem(
                          value: 'excess', child: Text('Излишек'),),
                      DropdownMenuItem(value: 'other', child: Text('Другое')),
                    ],
                    onChanged: (v) => setSheet(() => reason = v ?? ''),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _noteCtrl,
                    maxLines: 2,
                    decoration: const InputDecoration(
                      labelText: 'Комментарий (необязательно)',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  if (hasBonusDebt) ...[
                    const SizedBox(height: 14),
                    _debtWarningCard(
                      title: 'Не хватает бонусной части',
                      body:
                          'По правилам возврата с полки бонусной части не хватает на '
                          "${formatMoneySpaced(bonusDebt)} So'm. "
                          'Эта сумма будет отнесена на баланс (долг) клиента '
                          'после приёмки на складе.',
                      extra: warnings
                          .where((w) => !w.contains('Долг скидка') && !w.contains('Скидка по заказу'))
                          .toList(),
                    ),
                  ],
                  if (hasDiscountDebt) ...[
                    const SizedBox(height: 14),
                    _debtWarningCard(
                      title: 'Долг скидка',
                      body: discountDebtNote?.trim().isNotEmpty == true
                          ? '${discountDebtNote!.trim()}\n\n'
                              "${formatMoneySpaced(discountDebt)} So'm будет отнесено "
                              'на баланс клиента после приёмки на складе '
                              '(скидка по оставшемуся товару отозвана).'
                          : 'Условие скидки по заказу больше не выполняется. '
                              "${formatMoneySpaced(discountDebt)} So'm — долг скидка "
                              'на баланс клиента после приёмки на складе.',
                    ),
                  ] else if (hasDiscountRecalc) ...[
                    const SizedBox(height: 14),
                    _debtWarningCard(
                      title: 'Скидка будет пересчитана',
                      body:
                          'Сумма скидки по исходному заказу уменьшится пропорционально '
                          'возврату. Дополнительный долг по скидке не начисляется '
                          '(возврат уже по цене со скидкой).',
                      tone: AppColors.info,
                    ),
                  ],
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      Expanded(
                        child: SizedBox(
                          height: 50,
                          child: OutlinedButton(
                            style: OutlinedButton.styleFrom(
                              foregroundColor: AppColors.textSecondary,
                              side: const BorderSide(
                                  color: AppColors.borderLight,),
                            ),
                            onPressed: () => Navigator.pop(ctx, false),
                            child: const Text('Отмена',
                                style:
                                    TextStyle(fontWeight: FontWeight.w700),),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        flex: 2,
                        child: SizedBox(
                          height: 50,
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: hasDebt
                                  ? AppColors.warning
                                  : AppColors.expeditorAccent,
                              foregroundColor: Colors.white,
                            ),
                            onPressed: () => Navigator.pop(ctx, true),
                            child: Text(
                                hasDebt
                                    ? 'Подтвердить (с долгом)'
                                    : 'Подтвердить возврат',
                                style: const TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w700,),),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },);
      },
    );

    if (accepted != true || !mounted) return;
    setState(() => _reason = reason);
    await _doSubmit(orderId);
  }

  Widget _debtWarningCard({
    required String title,
    required String body,
    List<String> extra = const [],
    Color tone = AppColors.warning,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: tone.withValues(alpha: 0.5)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.warning_amber_rounded, color: tone, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(fontWeight: FontWeight.w700, color: tone),
                ),
                const SizedBox(height: 4),
                Text(
                  body,
                  style: AppTypography.caption.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
                if (extra.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  ...extra.map(
                    (w) => Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        '• $w',
                        style: AppTypography.caption.copyWith(
                          color: AppColors.textMuted,
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _doSubmit(int orderId) async {
    final lines = _aggregatedLines(withSwap: true);
    if (lines.isEmpty) {
      _toast('Укажите количество');
      return;
    }

    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return;
    setState(() => _submitting = true);
    try {
      final res = await ref.read(expeditorApiProvider).createReturnByOrder(
            slug,
            orderId,
            lines: lines,
            reason: _reason.isEmpty ? null : _reason,
            note: _noteCtrl.text.trim().isEmpty ? null : _noteCtrl.text.trim(),
          );
      ref.invalidate(expeditorReturnCompositionProvider(orderId));
      ref.invalidate(expeditorReturnByOrderOrdersProvider);
      ref.invalidate(expeditorDashboardProvider);
      ref.invalidate(deliveriesProvider(null));
      if (!mounted) return;
      final refund = (res['refund_amount'])?.toString();
      final discDebt = double.tryParse('${res['discount_debt_amount'] ?? 0}') ?? 0;
      final parts = <String>[
        if (refund != null)
          'Возврат оформлен · сумма: ${formatMoneySpaced(double.tryParse(refund) ?? 0)}'
        else
          'Возврат оформлен',
      ];
      if (discDebt > 0.0001) {
        parts.add('Долг скидка: ${formatMoneySpaced(discDebt)} · после приёмки');
      }
      _toast(
        parts.join('\n'),
        color: discDebt > 0.0001 ? AppColors.warning : AppColors.success,
      );
      context.pop();
    } on ApiException catch (e) {
      if (mounted) _toast('Ошибка: ${e.message}', color: AppColors.error);
    } catch (e) {
      if (mounted) _toast('Ошибка: $e', color: AppColors.error);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Widget _errorView(Object e, {bool allowBack = false}) {
    final msg = e is ApiException ? e.message : e.toString();
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.info_outline,
                color: AppColors.textMuted, size: 40,),
            const SizedBox(height: 12),
            Text(
              _humanError(msg),
              textAlign: TextAlign.center,
              style: AppTypography.bodyMedium
                  .copyWith(color: AppColors.textSecondary),
            ),
            if (allowBack) ...[
              const SizedBox(height: 16),
              OutlinedButton(
                onPressed: () => setState(() {
                  _orderId = null;
                  _paid.clear();
                  _bonus.clear();
                  _returnQty.clear();
                  _swap.clear();
                  _method = _ReturnMethod.byProducts;
                }),
                child: const Text('К списку заказов'),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _humanError(String code) {
    switch (code) {
      case 'RETURN_FILTER_EMPTY':
      case 'RETURN_ORDER_OUT_OF_FILTER':
      case 'ORDER_OUT_OF_FILTER':
        return 'Этот заказ вне периода/баланса, разрешённого настройками возврата';
      case 'ORDER_FULLY_RETURNED':
        return 'Заказ уже полностью возвращён';
      case 'ORDER_NOT_DELIVERED':
      case 'BAD_STATUS':
        return 'Возврат возможен только для доставленного заказа';
      case 'ReturnDisabled':
      case 'RETURN_DISABLED':
        return 'Возврат с полки отключён в настройках администратора';
      default:
        return 'Ошибка: $code';
    }
  }
}
