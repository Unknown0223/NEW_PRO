import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/media_url.dart';
import '../../../core/api/mobile_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/database/app_database.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/config/client_field_policy.dart';
import '../../../core/clients/agent_client_balance.dart';
import '../../../core/clients/agent_outlet_filters_provider.dart';
import '../../../core/format/money_display.dart';
import '../../../core/config/mobile_config.dart';
import '../../../core/orders/order_status_labels.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/utils/external_actions.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../shell/agent_app_bar.dart';
import '../orders/order_draft_model.dart';
import '../orders/order_draft_provider.dart';
import '../orders/order_draft_ui.dart';
import 'client_dynamic_form.dart';
import 'client_photo_report_flow.dart';

class ClientDetailScreen extends ConsumerStatefulWidget {
  final int clientId;

  const ClientDetailScreen({super.key, required this.clientId});

  @override
  ConsumerState<ClientDetailScreen> createState() => _ClientDetailScreenState();
}

class _ClientDetailScreenState extends ConsumerState<ClientDetailScreen> {
  Map<String, dynamic>? _client;
  List<Map<String, dynamic>> _orders = [];
  List<ClientPhotoReport> _photos = [];
  bool _loading = true;
  bool _photosLoading = false;
  bool _photoUploading = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool reloadPhotos = true}) async {
    final db = AppDatabase();
    final results = await Future.wait<dynamic>([
      db.getClientById(widget.clientId),
      db.getClientOrdersForCurrentMonth(widget.clientId),
    ]);
    final client = results[0] as Map<String, dynamic>?;
    final clientOrders = results[1] as List<Map<String, dynamic>>;

    if (!mounted) return;
    setState(() {
      _client = client;
      _orders = clientOrders;
      _loading = false;
    });
    if (reloadPhotos) {
      unawaited(_loadPhotos());
    }
  }

  Future<void> _loadPhotos() async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty || _client == null) {
      if (mounted) setState(() => _photos = []);
      return;
    }
    if (mounted) setState(() => _photosLoading = true);
    try {
      final photos = await ref.read(mobileApiProvider).getClientPhotoReports(slug, widget.clientId);
      if (mounted) setState(() => _photos = photos);
    } catch (e) {
      if (mounted && _photos.isEmpty) {
        _toast('Фотоотчёты не загрузились: $e');
      }
    } finally {
      if (mounted) setState(() => _photosLoading = false);
    }
  }

  void _mergePhotoRow(ClientPhotoReport row) {
    setState(() {
      _photos = [row, ..._photos.where((p) => p.id != row.id)];
    });
  }

  bool get _canCreateOrder => ref.read(sessionProvider).permissions.canCreateOrders;

  void _toast(String message, {Color accent = AppColors.error}) {
    if (!mounted) return;
    showAgentToast(context, message, accentColor: accent);
  }

  Future<void> _addPhotoReport() async {
    if (_photoUploading) return;
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return;

    final category = await pickPhotoReportCategory(context, ref);
    if (category == null || !mounted) return;

    setState(() => _photoUploading = true);
    try {
      final row = await captureAndUploadPhotoReport(
        context: context,
        ref: ref,
        slug: slug,
        clientId: widget.clientId,
        category: category,
      );
      if (row != null) {
        _mergePhotoRow(row);
        if (mounted) {
          _toast('Фотоотчет сохранён', accent: AppColors.success);
        }
      }
    } finally {
      if (mounted) setState(() => _photoUploading = false);
    }
  }

  Future<void> _replacePhoto(ClientPhotoReport photo) async {
    if (_photoUploading) return;
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return;
    setState(() => _photoUploading = true);
    try {
      final row = await replacePhotoReport(
        context: context,
        ref: ref,
        slug: slug,
        clientId: widget.clientId,
        existing: photo,
      );
      if (row != null) {
        setState(() {
          _photos = _photos.where((p) => p.id != photo.id).toList();
        });
        _mergePhotoRow(row);
        if (mounted) {
          _toast('Фото обновлено', accent: AppColors.success);
        }
      }
    } finally {
      if (mounted) setState(() => _photoUploading = false);
    }
  }

  void _viewPhoto(ClientPhotoReport photo) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (ctx) => _PhotoReportFullscreenView(
          photo: photo,
          clientId: widget.clientId,
        ),
      ),
    );
  }

  Future<void> _deletePhoto(ClientPhotoReport photo) async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Удалить фото'),
        content: const Text('Удалить это фото?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Отмена')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Удалить')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await ref.read(mobileApiProvider).deleteClientPhotoReport(slug, widget.clientId, photo.id);
      if (mounted) {
        setState(() => _photos = _photos.where((p) => p.id != photo.id).toList());
      }
      unawaited(_loadPhotos());
    } catch (e) {
      if (mounted) {
        _toast('Ошибка удаления: $e');
      }
    }
  }

  void _openCreateOrder() {
    if (!_canCreateOrder || _client == null) return;
    context.push(
      '/orders/create?client_id=${widget.clientId}',
      extra: Map<String, dynamic>.from(_client!),
    ).then((_) {
      ref.invalidate(orderDraftForClientProvider(widget.clientId));
      ref.invalidate(orderDraftsProvider);
    });
  }

  Future<void> _resumeDraft() async {
    _openCreateOrder();
  }

  Future<void> _deleteDraft() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Отменить черновик'),
        content: const Text('Удалить сохранённый черновик заказа?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Отмена')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Удалить')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    await ref.read(orderDraftRepositoryProvider).delete(widget.clientId);
    ref.invalidate(orderDraftForClientProvider(widget.clientId));
    ref.invalidate(orderDraftsProvider);
    if (mounted) {
      _toast('Черновик удалён', accent: AppColors.success);
    }
  }

  Future<void> _showDraftOptions(OrderDraft draft) async {
    final action = await showOrderDraftOptionsSheet(context);
    if (!mounted || action == null) return;
    switch (action) {
      case 'edit':
        await _resumeDraft();
        break;
      case 'comment':
        if (mounted) {
          _toast('Комментарий — при редактировании заказа', accent: AppColors.warning);
        }
        break;
      case 'delete':
        await _deleteDraft();
        break;
    }
  }

  Future<void> _showDraftData(OrderDraft draft) async {
    final products = await AppDatabase().getAllProducts();
    if (!mounted) return;
    await showOrderDraftDataSheet(
      context,
      draft: draft,
      productNames: products,
      onEdit: _canCreateOrder ? _resumeDraft : null,
      onDelete: _deleteDraft,
    );
  }

  Future<void> _callClient(Map<String, dynamic> client) async {
    final phone = client['phone']?.toString() ?? '';
    if (!hasDialablePhone(phone)) {
      _toast('Телефон не указан', accent: AppColors.warning);
      return;
    }
    final ok = await launchPhoneCall(phone);
    if (!ok && mounted) {
      _toast('Не удалось открыть набор номера');
    }
  }

  void _openClientLocation(Map<String, dynamic> client) {
    final lat = (client['latitude'] as num?)?.toDouble();
    final lng = (client['longitude'] as num?)?.toDouble();
    final name = client['name']?.toString() ?? 'Клиент';
    if (lat == null || lng == null || (lat == 0 && lng == 0)) {
      _toast('Координаты не указаны', accent: AppColors.warning);
      return;
    }
    context.push(
      '/client-location',
      extra: {
        'name': name,
        'lat': lat,
        'lng': lng,
      },
    );
  }

  void _showActionsSheet() {
    showAgentClientActionsSheet(
      context,
      onPhotoReport: _addPhotoReport,
      onRefusal: () {
        _toast('Отказ — в разделе «Визиты»', accent: AppColors.warning);
      },
      onCreateOrder: _openCreateOrder,
      createOrderEnabled: ref.read(sessionProvider).permissions.canCreateOrders,
      onEdit: _editClient,
      editEnabled: ref.read(sessionProvider).mobileConfig?.client.canEdit == true,
    );
  }

  Future<void> _editClient() async {
    final c = _client;
    if (c == null) return;
    final clientCfg = ref.read(sessionProvider).mobileConfig?.client ?? const ClientConfig();

    final body = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      useSafeArea: false,
      backgroundColor: Colors.transparent,
      builder: (_) => _EditClientSheet(config: clientCfg, client: c),
    );

    if (body == null || !mounted) return;

    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    try {
      if (slug.isNotEmpty && body.isNotEmpty) {
        await ref.read(mobileApiProvider).patchClient(slug, widget.clientId, body);
      }
      await AppDatabase().upsertClients([
        {
          ...c,
          for (final entry in body.entries) entry.key: entry.value,
        },
      ]);
      await _load();
      if (mounted) {
        _toast('Клиент сохранён', accent: AppColors.success);
      }
    } catch (e) {
      await _load();
      if (mounted) {
        _toast('Ошибка сохранения: $e');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final config = session.mobileConfig;

    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_client == null) {
      return Scaffold(
        appBar: AgentAppBar(title: 'Ошибка', showBack: true),
        body: const Center(child: Text('Клиент не найден')),
      );
    }

    final c = _client!;
    final clientName = c['name']?.toString() ?? '—';
    final appBarTitle = clientName.length > 18 ? '${clientName.substring(0, 16)}…' : clientName;
    final clientCfg = config?.client ?? const ClientConfig();
    final detailFields = clientDetailFieldKeys(clientCfg);
    final todayPhotos = photoReportsForToday(_photos);
    final draft = ref.watch(orderDraftForClientProvider(widget.clientId)).valueOrNull;
    final showBalance = config?.client.showBalance ?? true;
    final agentBalances = ref.watch(clientAgentLedgerBalancesProvider).valueOrNull;
    final balanceAmount = showBalance
        ? clientAgentLedgerBalance(agentBalances, widget.clientId)
        : null;
    final balanceText = showBalance
        ? formatClientBalanceAmount(balanceAmount ?? 0)
        : '0 сум';
    final categoryLine = _categoryLine(c);
    final hasDetailCard = detailFields.isNotEmpty ||
        (isClientFieldVisible(clientCfg, 'phone') && c['phone'] != null) ||
        (c['address'] != null && c['address'].toString().trim().isNotEmpty) ||
        categoryLine != null;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AgentAppBar(
        title: appBarTitle,
        showBack: true,
        actions: [
          IconButton(icon: const Icon(Icons.more_vert_rounded), onPressed: _showActionsSheet),
        ],
      ),
      bottomNavigationBar: session.permissions.canCreateOrders
          ? AgentBottomActionBar(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _openCreateOrder,
                    icon: const Icon(Icons.shopping_cart_rounded, size: 18),
                    label: const Text(
                      'Добавить заказ',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      minimumSize: const Size(0, 50),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Material(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(14),
                  child: InkWell(
                    onTap: _showActionsSheet,
                    borderRadius: BorderRadius.circular(14),
                    child: const SizedBox(
                      width: 50,
                      height: 50,
                      child: Icon(Icons.more_horiz_rounded, color: AppColors.textSecondary),
                    ),
                  ),
                ),
              ],
            )
          : null,
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AgentSurfaceCard(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    clientName,
                    style: AppTypography.titleMedium.copyWith(fontSize: 17, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 4),
                  if (showBalance)
                    Text(
                      balanceText,
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: colorForClientBalance(balanceAmount ?? 0),
                      ),
                    ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () => _callClient(c),
                          icon: const Icon(Icons.phone_rounded, size: 16),
                          label: const Text('Call'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(11)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () => _openClientLocation(c),
                          icon: const Icon(Icons.location_on_rounded, size: 16, color: Color(0xFFEF4444)),
                          label: const Text('Location'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFF1F5F9),
                            foregroundColor: AppColors.textPrimary,
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(11)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            AgentSurfaceCard(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Text(
                        'Фото отчёт',
                        style: AppTypography.bodyMedium.copyWith(fontWeight: FontWeight.w700),
                      ),
                      const Spacer(),
                      if (!_photoUploading && todayPhotos.isNotEmpty)
                        _ClientCountBadge('${todayPhotos.length}'),
                    ],
                  ),
                  const SizedBox(height: 10),
                  if (_photoUploading)
                    const SizedBox(
                      height: 78,
                      child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                    )
                  else if (_photosLoading && todayPhotos.isEmpty)
                    const SizedBox(
                      height: 78,
                      child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                    )
                  else
                    _PhotoReportStrip(
                      clientId: widget.clientId,
                      photos: todayPhotos,
                      onView: _viewPhoto,
                      onReplace: _replacePhoto,
                      onDelete: _deletePhoto,
                      onAdd: _addPhotoReport,
                    ),
                ],
              ),
            ),
            if (hasDetailCard) ...[
              const SizedBox(height: 12),
              AgentSurfaceCard(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (c['address'] != null && c['address'].toString().trim().isNotEmpty)
                      _DetailRow(
                        Icons.location_on_rounded,
                        c['address'].toString(),
                        iconColor: const Color(0xFFEF4444),
                      ),
                    if (isClientFieldVisible(clientCfg, 'phone') && c['phone'] != null)
                      _DetailRow(
                        Icons.phone_rounded,
                        c['phone'].toString(),
                        iconColor: const Color(0xFFDB2777),
                      ),
                    if (categoryLine != null)
                      _DetailRow(Icons.label_rounded, categoryLine),
                    ...detailFields.map((key) {
                      final value = clientFieldDisplayText(c, key);
                      if (value == null) return const SizedBox.shrink();
                      if (key == 'address' || key == 'phone') return const SizedBox.shrink();
                      return _DetailRow(_detailIcon(key), value);
                    }),
                  ],
                ),
              ),
            ],
            if (draft != null) ...[
              const SizedBox(height: 12),
              AgentSurfaceCard(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Черновик', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                          Text(
                            '${draft.quantities.values.where((q) => q > 0).length} поз. · ${formatMoneySpaced(draft.totalSum)}',
                            style: AppTypography.captionSmall,
                          ),
                        ],
                      ),
                    ),
                    ElevatedButton(
                      onPressed: _resumeDraft,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: const Text('Возобновить', style: TextStyle(fontWeight: FontWeight.w700)),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 12),
            AgentSurfaceCard(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('История заказов', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 10),
                  if (_orders.isEmpty)
                    Text(
                      'В этом месяце заказов нет',
                      style: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted),
                    )
                  else
                    ..._orders.map((o) {
                      final orderNumber = o['number'] ?? o['id'];
                      final date = o['created_at']?.toString() ?? '';
                      final dateShort = date.length >= 10 ? date.substring(0, 10) : date;
                      final amount = o['total'] ?? o['total_amount'] ?? o['total_sum'];
                      final amountLabel = amount is num
                          ? formatMoneySpaced(amount.toDouble())
                          : formatMoneySpaced(double.tryParse(amount?.toString() ?? '') ?? 0);
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '#$orderNumber · $dateShort',
                                    style: AppTypography.bodySmall.copyWith(fontWeight: FontWeight.w700),
                                  ),
                                  Text('$amountLabel сум', style: AppTypography.captionSmall),
                                ],
                              ),
                            ),
                            orderStatusChip(
                              o['status']?.toString() ?? 'new',
                              orderType: o['order_type']?.toString() ?? 'order',
                            ),
                          ],
                        ),
                      );
                    }),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Tahrirlash — controllerlar faqat sheet ichida yaratiladi va dispose qilinadi.
class _EditClientSheet extends ConsumerStatefulWidget {
  final ClientConfig config;
  final Map<String, dynamic> client;

  const _EditClientSheet({required this.config, required this.client});

  @override
  ConsumerState<_EditClientSheet> createState() => _EditClientSheetState();
}

class _EditClientSheetState extends ConsumerState<_EditClientSheet> {
  final _controllers = <String, TextEditingController>{};
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    ClientDynamicFormFields.populateFromClient(widget.client, _controllers);
  }

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    final validation = ClientDynamicFormFields.validate(widget.config, _controllers);
    if (validation != null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(validation), backgroundColor: AppColors.error),
        );
      }
      return;
    }

    setState(() => _saving = true);
    try {
      Position? pos;
      if (showCoordinatesField(widget.config)) {
        try {
          pos = await Geolocator.getCurrentPosition();
        } catch (_) {}
      }
      final body = ClientDynamicFormFields.toApiBody(
        widget.config,
        _controllers,
        latitude: pos?.latitude,
        longitude: pos?.longitude,
      );
      if (!mounted) return;
      Navigator.pop(context, body);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final maxHeight = media.size.height * 0.92 - media.viewInsets.bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: media.viewInsets.bottom),
      child: Material(
        color: AppColors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: maxHeight),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 12, 0),
                child: Row(
                  children: [
                    const Expanded(child: Text('Редактирование клиента', style: AppTypography.headlineSmall)),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: _saving ? null : () => Navigator.pop(context),
                    ),
                  ],
                ),
              ),
              Flexible(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
                  child: ClientDynamicFormFields(
                    config: widget.config,
                    controllers: _controllers,
                    showGpsHint: showCoordinatesField(widget.config),
                  ),
                ),
              ),
              SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                  child: SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: _saving ? null : _save,
                      child: _saving
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Text('Сохранить'),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PhotoReportStrip extends StatelessWidget {
  final int clientId;
  final List<ClientPhotoReport> photos;
  final void Function(ClientPhotoReport photo) onView;
  final void Function(ClientPhotoReport photo) onReplace;
  final void Function(ClientPhotoReport photo) onDelete;
  final VoidCallback onAdd;

  const _PhotoReportStrip({
    required this.clientId,
    required this.photos,
    required this.onView,
    required this.onReplace,
    required this.onDelete,
    required this.onAdd,
  });

  static const _height = 78.0;
  static const _thumbWidth = 92.0;
  static const _addWidth = 78.0;

  void _showPhotoMenu(BuildContext context, ClientPhotoReport photo) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.fullscreen_rounded),
              title: const Text('Открыть'),
              onTap: () {
                Navigator.pop(ctx);
                onView(photo);
              },
            ),
            ListTile(
              leading: const Icon(Icons.cameraswitch_outlined),
              title: const Text('Заменить'),
              onTap: () {
                Navigator.pop(ctx);
                onReplace(photo);
              },
            ),
            ListTile(
              leading: const Icon(Icons.delete_outline, color: AppColors.error),
              title: const Text('Удалить', style: TextStyle(color: AppColors.error)),
              onTap: () {
                Navigator.pop(ctx);
                onDelete(photo);
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: _height,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: photos.length + 1,
        separatorBuilder: (_, __) => const SizedBox(width: 9),
        itemBuilder: (context, index) {
          if (index == photos.length) {
            return Material(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(12),
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: onAdd,
                child: Container(
                  width: _addWidth,
                  height: _height,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFC9D7E1), width: 1.5),
                  ),
                  child: const Center(
                    child: Icon(Icons.add_rounded, color: AppColors.textMuted),
                  ),
                ),
              ),
            );
          }
          final photo = photos[index];
          return _PhotoReportThumb(
            clientId: clientId,
            photo: photo,
            width: _thumbWidth,
            height: _height,
            onTap: () => onView(photo),
            onLongPress: () => _showPhotoMenu(context, photo),
            onDelete: () => onDelete(photo),
          );
        },
      ),
    );
  }
}

class _PhotoReportThumb extends ConsumerStatefulWidget {
  final int clientId;
  final ClientPhotoReport photo;
  final double width;
  final double height;
  final VoidCallback onTap;
  final VoidCallback onLongPress;
  final VoidCallback onDelete;

  const _PhotoReportThumb({
    required this.clientId,
    required this.photo,
    required this.width,
    required this.height,
    required this.onTap,
    required this.onLongPress,
    required this.onDelete,
  });

  @override
  ConsumerState<_PhotoReportThumb> createState() => _PhotoReportThumbState();
}

class _PhotoReportThumbState extends ConsumerState<_PhotoReportThumb> {
  String? _imageUrl;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _syncImage();
  }

  @override
  void didUpdateWidget(covariant _PhotoReportThumb oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.photo.id != widget.photo.id || oldWidget.photo.imageUrl != widget.photo.imageUrl) {
      _syncImage();
    }
  }

  void _syncImage() {
    final inline = widget.photo.imageUrl.trim();
    if (inline.isNotEmpty) {
      setState(() {
        _imageUrl = inline;
        _loading = false;
      });
      return;
    }
    unawaited(_fetchImage());
  }

  Future<void> _fetchImage() async {
    if (_loading) return;
    setState(() => _loading = true);
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) {
      if (mounted) setState(() => _loading = false);
      return;
    }
    try {
      final row = await ref.read(mobileApiProvider).getClientPhotoReport(slug, widget.clientId, widget.photo.id);
      if (mounted) {
        setState(() {
          _imageUrl = row.imageUrl.trim().isNotEmpty ? row.imageUrl : null;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasImage = (_imageUrl ?? '').trim().isNotEmpty;
    return SizedBox(
      width: widget.width,
      height: widget.height,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Material(
            color: const Color(0xFFEAF1F6),
            borderRadius: BorderRadius.circular(12),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: widget.onTap,
              onLongPress: widget.onLongPress,
              child: _loading
                  ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
                  : hasImage
                      ? MediaImage(
                          source: _imageUrl!,
                          width: widget.width,
                          height: widget.height,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => const Center(
                            child: Icon(Icons.broken_image_outlined, color: AppColors.textMuted),
                          ),
                        )
                      : Center(
                          child: Text(
                            'IMG',
                            style: AppTypography.captionSmall.copyWith(
                              color: AppColors.textMuted,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
            ),
          ),
          Positioned(
            top: 4,
            right: 4,
            child: Material(
              color: Colors.white.withValues(alpha: 0.95),
              elevation: 2,
              shape: const CircleBorder(),
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: widget.onDelete,
                customBorder: const CircleBorder(),
                child: const Padding(
                  padding: EdgeInsets.all(5),
                  child: Icon(Icons.close_rounded, size: 14, color: AppColors.error),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ClientCountBadge extends StatelessWidget {
  final String label;
  const _ClientCountBadge(this.label);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(label, style: AppTypography.captionSmall.copyWith(fontWeight: FontWeight.w800)),
    );
  }
}

class _PhotoReportFullscreenView extends ConsumerStatefulWidget {
  final ClientPhotoReport photo;
  final int clientId;

  const _PhotoReportFullscreenView({required this.photo, required this.clientId});

  @override
  ConsumerState<_PhotoReportFullscreenView> createState() => _PhotoReportFullscreenViewState();
}

class _PhotoReportFullscreenViewState extends ConsumerState<_PhotoReportFullscreenView> {
  String? _imageUrl;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    final inline = widget.photo.imageUrl.trim();
    if (inline.isNotEmpty) {
      _imageUrl = inline;
    } else {
      unawaited(_fetchImage());
    }
  }

  Future<void> _fetchImage() async {
    setState(() => _loading = true);
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) {
      if (mounted) setState(() => _loading = false);
      return;
    }
    try {
      final row = await ref.read(mobileApiProvider).getClientPhotoReport(slug, widget.clientId, widget.photo.id);
      if (mounted) {
        setState(() {
          _imageUrl = row.imageUrl.trim().isNotEmpty ? row.imageUrl : null;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final caption = (widget.photo.caption ?? '').trim();
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(caption.isEmpty ? 'Фотоотчёт' : caption, maxLines: 1, overflow: TextOverflow.ellipsis),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Colors.white))
          : InteractiveViewer(
              minScale: 0.5,
              maxScale: 5,
              child: Center(
                child: (_imageUrl ?? '').trim().isNotEmpty
                    ? MediaImage(
                        source: _imageUrl!,
                        fit: BoxFit.contain,
                        errorBuilder: (_, __, ___) =>
                            const Icon(Icons.broken_image_outlined, color: Colors.white54, size: 64),
                      )
                    : const Icon(Icons.broken_image_outlined, color: Colors.white54, size: 64),
              ),
            ),
    );
  }
}

String? _categoryLine(Map<String, dynamic> client) {
  final category = client['category']?.toString().trim();
  final inn = client['inn']?.toString().trim();
  if (category != null && category.isNotEmpty && inn != null && inn.isNotEmpty) {
    return 'Категория $category · INN $inn';
  }
  if (category != null && category.isNotEmpty) return 'Категория $category';
  if (inn != null && inn.isNotEmpty) return 'INN $inn';
  return null;
}

IconData _detailIcon(String key) {
  switch (key) {
    case 'address':
      return Icons.location_on_outlined;
    case 'phone':
      return Icons.phone_outlined;
    case 'inn':
    case 'pinfl':
    case 'client_pc':
    case 'agreement_number':
      return Icons.numbers_outlined;
    case 'bank':
    case 'mfo':
    case 'oked':
      return Icons.account_balance_outlined;
    case 'notes':
      return Icons.notes_outlined;
    default:
      return Icons.info_outline;
  }
}

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String text;
  final Color? iconColor;
  const _DetailRow(this.icon, this.text, {this.iconColor});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: iconColor ?? AppColors.textMuted),
          const SizedBox(width: 10),
          Expanded(
            child: Text(text, style: AppTypography.bodySmall),
          ),
        ],
      ),
    );
  }
}
