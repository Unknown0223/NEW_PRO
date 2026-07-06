import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../expeditor_providers.dart';
import '../shared/expeditor_history_filter.dart';
import '../shell/expeditor_drawer.dart';
import 'expeditor_invoices_filter.dart';

class ExpeditorInvoicesPage extends ConsumerStatefulWidget {
  const ExpeditorInvoicesPage({super.key});

  @override
  ConsumerState<ExpeditorInvoicesPage> createState() =>
      _ExpeditorInvoicesPageState();
}

class _ExpeditorInvoicesPageState extends ConsumerState<ExpeditorInvoicesPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 2, vsync: this);
  InvoiceFilterState _filter = InvoiceFilterState.defaults();
  bool _showFilters = false;
  String _search = '';
  final _searchCtrl = TextEditingController();
  bool _searchOpen = false;

  @override
  void dispose() {
    _tabs.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  String get _docType => _tabs.index == 0 ? 'shipping' : 'return';

  Future<void> _openAdvancedFilter() async {
    final warehouses = await ref.read(expeditorWarehousesProvider.future);
    if (!mounted) return;
    final next = await showInvoiceFilterSheet(
      context,
      current: _filter,
      warehouses: warehouses,
    );
    if (next != null && mounted) {
      setState(() {
        _filter = next;
        _showFilters = true;
      });
    }
  }

  String _advancedLabel() {
    final parts = <String>[];
    if (_filter.warehouseName != null) parts.add(_filter.warehouseName!);
    if (_filter.statuses.isNotEmpty) {
      parts.add(_filter.statuses.map(invoiceStatusLabel).join(', '));
    }
    return parts.isEmpty ? 'Склад · Статус' : parts.join(' · ');
  }

  List<Map<String, dynamic>> _filterRows(List<Map<String, dynamic>> rows) {
    // Filtr faqat foydalanuvchi filtrni ochганда qo'llanadi; aks holda barchasi
    // ko'rsatiladi (sana bo'yicha yashirilib qolmasligi uchun).
    var out = _showFilters ? applyInvoiceFilters(rows, _filter) : rows;
    if (_search.trim().isNotEmpty) {
      final q = _search.trim().toLowerCase();
      out = out.where((d) {
        final id = d['id']?.toString().toLowerCase() ?? '';
        final wh = d['warehouse_name']?.toString().toLowerCase() ?? '';
        return id.contains(q) || wh.contains(q);
      }).toList();
    }
    return out;
  }

  @override
  Widget build(BuildContext context) {
    final docs = ref.watch(expeditorShipmentDocsProvider(_docType));

    return Scaffold(
      backgroundColor: AppColors.background,
      drawer: const ExpeditorDrawer(),
      appBar: AppBar(
        title: _searchOpen
            ? TextField(
                controller: _searchCtrl,
                autofocus: true,
                decoration: const InputDecoration(
                  hintText: 'Поиск…',
                  border: InputBorder.none,
                ),
                onChanged: (v) => setState(() => _search = v),
              )
            : const Text('Накладные'),
        actions: [
          IconButton(
            icon: Icon(_searchOpen ? Icons.close : Icons.search),
            onPressed: () => setState(() {
              _searchOpen = !_searchOpen;
              if (!_searchOpen) {
                _searchCtrl.clear();
                _search = '';
              }
            }),
          ),
          IconButton(
            tooltip: 'Фильтр',
            icon: Icon(
              _showFilters ? Icons.filter_list_off : Icons.filter_list,
              color: _showFilters ? AppColors.expeditorAccent : null,
            ),
            onPressed: () => setState(() => _showFilters = !_showFilters),
          ),
        ],
        bottom: TabBar(
          controller: _tabs,
          onTap: (_) => setState(() {}),
          labelColor: AppColors.expeditorAccent,
          unselectedLabelColor: AppColors.textSecondary,
          indicatorColor: AppColors.expeditorAccent,
          tabs: const [
            Tab(text: 'Отгрузочные накладные'),
            Tab(text: 'Возвратные накладные'),
          ],
        ),
      ),
      floatingActionButton: _tabs.index == 1
          ? FloatingActionButton(
              heroTag: 'exp-invoices-create-return',
              onPressed: () => context.push('/exp-return-by-order'),
              backgroundColor: AppColors.expeditorAccent,
              child: const Icon(Icons.add),
            )
          : null,
      body: Column(
        children: [
          if (_showFilters) ...[
            HistoryFilterBar(
              range: _filter.dateRange,
              onPresetTap: () async {
                final r = await showHistoryPresetSheet(context);
                if (r != null && mounted) {
                  setState(() => _filter = _filter.copyWith(dateRange: r));
                }
              },
              onRangeTap: () async {
                final r =
                    await pickHistoryDateRange(context, current: _filter.dateRange);
                if (r != null && mounted) {
                  setState(() => _filter = _filter.copyWith(dateRange: r));
                }
              },
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 6),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _openAdvancedFilter,
                      icon: const Icon(Icons.tune, size: 18),
                      label: Text(_advancedLabel()),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.expeditorAccent,
                        side: const BorderSide(color: AppColors.borderLight),
                        padding:
                            const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      ),
                    ),
                  ),
                  if (_filter.hasAdvanced) ...[
                    const SizedBox(width: 8),
                    IconButton(
                      tooltip: 'Сбросить',
                      icon: const Icon(Icons.close),
                      onPressed: () => setState(() => _filter = _filter.copyWith(
                            clearWarehouse: true,
                            statuses: const {},
                          ),),
                    ),
                  ],
                ],
              ),
            ),
          ],
          Expanded(
            child: docs.when(
              data: (rows) {
                final filtered = _filterRows(rows);
                if (filtered.isEmpty) {
                  return RefreshIndicator(
                    color: AppColors.expeditorAccent,
                    onRefresh: () async =>
                        ref.invalidate(expeditorShipmentDocsProvider(_docType)),
                    child: ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: [
                        SizedBox(
                          height: MediaQuery.sizeOf(context).height * 0.45,
                          child: AgentEmptyState.fill(
                              message: 'Пока здесь пусто',),
                        ),
                      ],
                    ),
                  );
                }
                return RefreshIndicator(
                  color: AppColors.expeditorAccent,
                  onRefresh: () async =>
                      ref.invalidate(expeditorShipmentDocsProvider(_docType)),
                  child: ListView.separated(
                    padding: const EdgeInsets.all(12),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, i) => _InvoiceCard(
                      doc: filtered[i],
                      onTap: () => context.push('/invoices/${filtered[i]['id']}'),
                    ),
                  ),
                );
              },
              loading: () => const Center(
                  child: CircularProgressIndicator(
                      color: AppColors.expeditorAccent,),),
              error: (e, _) => Center(child: Text('Ошибка: $e')),
            ),
          ),
        ],
      ),
    );
  }

}

class _InvoiceCard extends StatelessWidget {
  final Map<String, dynamic> doc;
  final VoidCallback onTap;

  const _InvoiceCard({required this.doc, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final id = doc['id']?.toString() ?? '—';
    final waiting = doc['status'] == 'waiting_confirmation';
    final (label, color) = waiting
        ? ('Ожидание', AppColors.warning)
        : ('Подтвержден', AppColors.success);
    final created = formatInvoiceDay(doc['created_at']?.toString());
    final shipped = formatInvoiceDay(doc['ship_date']?.toString());

    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text('№:$id',
                        style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textHeadline,),),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(label,
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: color,),),
                  ),
                ],
              ),
              const Divider(height: 18, color: AppColors.borderLight),
              _row('Дата создание:', created),
              const SizedBox(height: 6),
              _row('Дата отправки:', shipped),
            ],
          ),
        ),
      ),
    );
  }

  Widget _row(String label, String value) {
    return Row(
      children: [
        Text(label,
            style: AppTypography.bodyMedium
                .copyWith(color: AppColors.textMuted),),
        const Spacer(),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
      ],
    );
  }
}
