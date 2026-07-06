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
import '../../../core/clients/client_outlet_filters.dart';
import '../../../core/format/money_display.dart';
import '../../../core/config/mobile_config.dart';
import '../../../core/orders/order_status_labels.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/utils/external_actions.dart';
import '../../../core/ui/agent_ui_extended.dart';
import '../shell/agent_app_bar.dart';
import '../shell/agent_drawer.dart';
import '../orders/order_draft_model.dart';
import '../orders/order_draft_provider.dart';
import '../orders/order_draft_ui.dart';
import 'client_qr_sheet.dart';
import 'client_dynamic_form.dart';
import 'client_photo_report_flow.dart';

class ClientDetailScreen extends ConsumerStatefulWidget {
  final int clientId;

  const ClientDetailScreen({super.key, required this.clientId});

  @override
  ConsumerState<ClientDetailScreen> createState() => _ClientDetailScreenState();
}

class _ClientDetailScreenState extends ConsumerState<ClientDetailScreen> {
  final _scaffoldKey = GlobalKey<ScaffoldState>();
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
    final misc = ref.read(sessionProvider).mobileConfig?.misc ?? const MiscConfig();
    final clientName = _client?['name']?.toString() ?? 'Mijoz';
    showAgentClientActionsSheet(
      context,
      onPhotoReport: _addPhotoReport,
      onRefusal: () {
        _toast('Отказ — в разделе «Визиты»', accent: AppColors.warning);
      },
      onCreateOrder: _openCreateOrder,
      createOrderEnabled: ref.read(sessionProvider).permissions.canCreateOrders,
      qrEnabled: misc.qrAttachClientPage || misc.qrChangeClientPage,
      onQrBind: () async {
        final ok = await ClientQrSheet.show(
          context,
          clientId: widget.clientId,
          clientName: clientName,
          allowChange: misc.qrChangeClientPage,
        );
        if (ok == true && mounted) {
          _toast('QR saqlandi', accent: AppColors.success);
        }
      },
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
        key: _scaffoldKey,
        drawer: const AgentDrawer(),
        appBar: AgentAppBar(title: 'Ошибка', showBack: true, drawerScaffoldKey: _scaffoldKey),
        body: const Center(child: Text('Клиент не найден')),
      );
    }

    final c = _client!;
    final clientCfg = config?.client ?? const ClientConfig();
    final detailFields = clientDetailFieldKeys(clientCfg);
    final todayPhotos = photoReportsForToday(_photos);
    final draft = ref.watch(orderDraftForClientProvider(widget.clientId)).valueOrNull;
    final showBalance = config?.client.showBalance ?? true;
    final balanceAmount = parseMoneyAmount(c['balance']);
    final balanceText = showBalance ? formatClientBalanceAmount(balanceAmount) : '0 сум';

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: AppColors.background,
      drawer: const AgentDrawer(),
      appBar: AgentAppBar(
        title: 'Клиент',
        showBack: true,
        drawerScaffoldKey: _scaffoldKey,
        actions: [
          IconButton(icon: const Icon(Icons.more_horiz), onPressed: _showActionsSheet),
          if (config?.client.canEdit == true)
            AgentIconButton(icon: Icons.edit_outlined, onPressed: _editClient),
        ],
      ),
      bottomNavigationBar: session.permissions.canCreateOrders
          ? AgentBottomActionBar(
              children: [
                Expanded(
                  child: Material(
                    color: const Color(0xFF1AA39B),
                    borderRadius: BorderRadius.circular(12),
                    child: InkWell(
                      onTap: _openCreateOrder,
                      borderRadius: BorderRadius.circular(12),
                      child: const SizedBox(
                        height: 52,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.add, color: Colors.white),
                            SizedBox(width: 8),
                            Text(
                              'Добавить заказ',
                              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Material(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(12),
                  child: InkWell(
                    onTap: _showActionsSheet,
                    borderRadius: BorderRadius.circular(12),
                    child: const SizedBox(
                      width: 52,
                      height: 52,
                      child: Icon(Icons.more_horiz, color: AppColors.textSecondary),
                    ),
                  ),
                ),
              ],
            )
          : null,
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AgentClientHeaderCard(
              name: c['name']?.toString() ?? '—',
              balance: balanceText,
              balanceAmount: showBalance ? balanceAmount : null,
              nameTrailing: draft != null
                  ? OrderDraftHeaderBadge(
                      draft: draft,
                      onExpired: () {
                        ref.invalidate(orderDraftForClientProvider(widget.clientId));
                        ref.invalidate(orderDraftsProvider);
                      },
                    )
                  : null,
              onCall: () => _callClient(c),
              onLocation: () => _openClientLocation(c),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                const Icon(Icons.view_carousel_outlined, size: 22, color: AppColors.textSecondary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text('Фото отчёт', style: AppTypography.headlineSmall.copyWith(fontWeight: FontWeight.w800)),
                ),
                if (!_photoUploading && todayPhotos.isNotEmpty)
                  Text(
                    '${todayPhotos.length}',
                    style: AppTypography.bodySmall.copyWith(
                      color: AppColors.textMuted,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
              ],
            ),
            if (!_photoUploading && todayPhotos.length > 1) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  Icon(Icons.swipe_left_alt, size: 16, color: AppColors.textMuted.withValues(alpha: 0.8)),
                  const SizedBox(width: 4),
                  Text(
                    'Листайте влево',
                    style: AppTypography.bodySmall.copyWith(color: AppColors.textMuted),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 12),
            if (_photoUploading)
              const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator()))
            else if (_photosLoading && todayPhotos.isEmpty)
              const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator()))
            else if (todayPhotos.isEmpty)
              Column(
                children: [
                  const Center(
                    child: AgentEmptyState(
                      message: 'Пока здесь пусто',
                      padding: EdgeInsets.symmetric(vertical: 24),
                    ),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: _addPhotoReport,
                    icon: const Icon(Icons.add_a_photo_outlined),
                    label: const Text('Добавить фотоотчет'),
                  ),
                ],
              )
            else
              _PhotoReportCarousel(
                clientId: widget.clientId,
                photos: todayPhotos,
                onDelete: _deletePhoto,
                onReplace: _replacePhoto,
                onView: _viewPhoto,
                onAdd: _addPhotoReport,
              ),
            if (detailFields.isNotEmpty) ...[
              const SizedBox(height: 16),
              ...detailFields.map((key) {
                final value = clientFieldDisplayText(c, key);
                if (value == null) return const SizedBox.shrink();
                return Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: _DetailRow(_detailIcon(key), clientFieldLabel(key), value),
                );
              }),
            ],
            if (isClientFieldVisible(clientCfg, 'phone') && c['phone'] != null)
              _DetailRow(Icons.phone_outlined, 'Телефон', c['phone'].toString()),
            const SizedBox(height: 16),
            if (draft != null) ...[
              OrderDraftClientCard(
                draft: draft,
                onTap: () => _showDraftData(draft),
                onOptions: () => _showDraftOptions(draft),
              ),
              const SizedBox(height: 16),
            ],
            const Text('История заказов', style: AppTypography.titleMedium),
            const SizedBox(height: 4),
            Text(
              'За текущий месяц',
              style: AppTypography.bodySmall.copyWith(color: AppColors.textMuted),
            ),
            const SizedBox(height: 8),
            if (_orders.isEmpty)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Center(
                    child: Text(
                      'В этом месяце заказов нет',
                      style: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted),
                    ),
                  ),
                ),
              )
            else
              ..._orders.map(
                (o) => Card(
                  margin: const EdgeInsets.symmetric(vertical: 3),
                  child: ListTile(
                    title: Text('Заказ №${o['number'] ?? o['id']}'),
                    trailing: orderStatusChip(
                      o['status']?.toString() ?? 'new',
                      orderType: o['order_type']?.toString() ?? 'order',
                    ),
                  ),
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

class _PhotoReportCarousel extends StatelessWidget {
  final int clientId;
  final List<ClientPhotoReport> photos;
  final void Function(ClientPhotoReport photo) onDelete;
  final void Function(ClientPhotoReport photo) onReplace;
  final void Function(ClientPhotoReport photo) onView;
  final VoidCallback onAdd;

  const _PhotoReportCarousel({
    required this.clientId,
    required this.photos,
    required this.onDelete,
    required this.onReplace,
    required this.onView,
    required this.onAdd,
  });

  @override
  Widget build(BuildContext context) {
    final cardWidth = MediaQuery.sizeOf(context).width * 0.82;
    const carouselHeight = 300.0;

    return SizedBox(
      height: carouselHeight,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.only(right: 4),
        itemCount: photos.length + 1,
        separatorBuilder: (_, __) => const SizedBox(width: 12),
        itemBuilder: (context, index) {
          if (index == photos.length) {
            return SizedBox(
              width: 112,
              child: Material(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(12),
                child: InkWell(
                  onTap: onAdd,
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.borderLight),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.add_a_photo_outlined, size: 28, color: AppColors.primary.withValues(alpha: 0.85)),
                        const SizedBox(height: 8),
                        Text(
                          'Ещё фото',
                          textAlign: TextAlign.center,
                          style: AppTypography.bodySmall.copyWith(
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          }
          return SizedBox(
            width: cardWidth,
            child: _PhotoReportTile(
              clientId: clientId,
              photo: photos[index],
              onDelete: () => onDelete(photos[index]),
              onReplace: () => onReplace(photos[index]),
              onView: () => onView(photos[index]),
            ),
          );
        },
      ),
    );
  }
}

class _PhotoReportTile extends ConsumerStatefulWidget {
  final int clientId;
  final ClientPhotoReport photo;
  final VoidCallback onDelete;
  final VoidCallback onReplace;
  final VoidCallback onView;

  const _PhotoReportTile({
    required this.clientId,
    required this.photo,
    required this.onDelete,
    required this.onReplace,
    required this.onView,
  });

  @override
  ConsumerState<_PhotoReportTile> createState() => _PhotoReportTileState();
}

class _PhotoReportTileState extends ConsumerState<_PhotoReportTile> {
  String? _imageUrl;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _syncImage();
  }

  @override
  void didUpdateWidget(covariant _PhotoReportTile oldWidget) {
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
    final caption = (widget.photo.caption ?? '').trim();
    final hasImage = (_imageUrl ?? '').trim().isNotEmpty;
    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (caption.isNotEmpty)
              Text(
                caption,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w700),
              ),
            if (caption.isNotEmpty) const SizedBox(height: 8),
            Expanded(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Material(
                    color: AppColors.surfaceVariant,
                    borderRadius: BorderRadius.circular(10),
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      onTap: hasImage ? widget.onView : null,
                      child: _loading
                          ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
                          : hasImage
                              ? MediaImage(
                                  source: _imageUrl!,
                                  width: double.infinity,
                                  height: double.infinity,
                                  fit: BoxFit.contain,
                                  errorBuilder: (_, __, ___) => Container(
                                    color: AppColors.surfaceVariant,
                                    child: const Center(child: Icon(Icons.broken_image_outlined, size: 36)),
                                  ),
                                )
                              : const Center(child: Icon(Icons.image_not_supported_outlined, size: 36)),
                    ),
                  ),
                  Positioned(
                    left: 8,
                    top: 8,
                    child: _PhotoActionIcon(
                      icon: Icons.fullscreen,
                      color: AppColors.primary,
                      onTap: widget.onView,
                      tooltip: 'Открыть',
                    ),
                  ),
                  Positioned(
                    right: 8,
                    top: 8,
                    child: _PhotoActionIcon(
                      icon: Icons.cameraswitch_outlined,
                      color: const Color(0xFF0F766E),
                      onTap: widget.onReplace,
                      tooltip: 'Заменить',
                    ),
                  ),
                  Positioned(
                    right: 8,
                    bottom: 8,
                    child: _PhotoActionIcon(
                      icon: Icons.delete_outline,
                      color: AppColors.error,
                      onTap: widget.onDelete,
                      tooltip: 'Удалить',
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PhotoActionIcon extends StatelessWidget {
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  final String tooltip;

  const _PhotoActionIcon({
    required this.icon,
    required this.color,
    required this.onTap,
    required this.tooltip,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.94),
      elevation: 2,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: Tooltip(
          message: tooltip,
          child: Padding(
            padding: const EdgeInsets.all(8),
            child: Icon(icon, color: color, size: 20),
          ),
        ),
      ),
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
  final String label, value;
  const _DetailRow(this.icon, this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppColors.textMuted),
          const SizedBox(width: 8),
          Text(label, style: AppTypography.bodySmall.copyWith(color: AppColors.textMuted)),
          const Spacer(),
          Flexible(
            child: Text(value, style: AppTypography.bodyMedium, overflow: TextOverflow.ellipsis),
          ),
        ],
      ),
    );
  }
}
