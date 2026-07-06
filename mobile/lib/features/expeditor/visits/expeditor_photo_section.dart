import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/media_url.dart';
import '../../../core/api/mobile_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';
import 'expeditor_photo_flow.dart';

/// Ekspeditor — mijoz fotohisoboti (agentnikidek). Vizit kartasi ichida
/// gorizontal karusel: rasm olish (kamera), ko'rish, almashtirish, o'chirish.
class ExpeditorPhotoSection extends ConsumerStatefulWidget {
  final int clientId;
  const ExpeditorPhotoSection({super.key, required this.clientId});

  @override
  ConsumerState<ExpeditorPhotoSection> createState() =>
      _ExpeditorPhotoSectionState();
}

class _ExpeditorPhotoSectionState extends ConsumerState<ExpeditorPhotoSection> {
  List<ClientPhotoReport> _photos = const [];
  bool _loading = true;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) {
      if (mounted) setState(() => _loading = false);
      return;
    }
    try {
      final rows =
          await ref.read(mobileApiProvider).getClientPhotoReports(slug, widget.clientId);
      if (mounted) setState(() => _photos = rows);
    } catch (_) {
      // jim — bo'sh holatda ko'rinadi
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _toast(String msg, {Color color = AppColors.warning}) {
    if (!mounted) return;
    showAgentToast(context, msg, accentColor: color);
  }

  Future<void> _add() async {
    if (_busy) return;
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return;
    setState(() => _busy = true);
    try {
      final res = await captureAndUploadExpeditorPhoto(
        context: context,
        ref: ref,
        slug: slug,
        clientId: widget.clientId,
      );
      if (res != null) {
        _toast('Фото добавлено', color: AppColors.success);
        await _load();
      }
    } catch (e) {
      _toast('Ошибка: $e', color: AppColors.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _replace(ClientPhotoReport photo) async {
    if (_busy) return;
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return;
    setState(() => _busy = true);
    try {
      final res = await replaceExpeditorPhoto(
        context: context,
        ref: ref,
        slug: slug,
        clientId: widget.clientId,
        existing: photo,
      );
      if (res != null) {
        _toast('Фото заменено', color: AppColors.success);
        await _load();
      }
    } catch (e) {
      _toast('Ошибка: $e', color: AppColors.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _delete(ClientPhotoReport photo) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Удалить фото?'),
        content: const Text('Это действие нельзя отменить.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Отмена'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Удалить'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return;
    try {
      await ref
          .read(mobileApiProvider)
          .deleteClientPhotoReport(slug, widget.clientId, photo.id);
      _toast('Фото удалено', color: AppColors.success);
      await _load();
    } catch (e) {
      _toast('Ошибка: $e', color: AppColors.error);
    }
  }

  void _view(ClientPhotoReport photo) {
    showDialog<void>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.92),
      builder: (_) =>
          _PhotoFullscreen(clientId: widget.clientId, photo: photo),
    );
  }

  /// Foto faqat olingan kunida ko'rinadi (ertasiga eskisi ko'rinmaydi).
  bool _isToday(ClientPhotoReport p) {
    final dt = DateTime.tryParse(p.createdAt);
    if (dt == null) return false;
    final local = dt.toLocal();
    final now = DateTime.now();
    return local.year == now.year &&
        local.month == now.month &&
        local.day == now.day;
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.photo_camera_outlined,
                size: 18, color: AppColors.expeditorAccent,),
            const SizedBox(width: 6),
            const Text('Фотоотчёт',
                style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: AppColors.expeditorAccent,),),
            const Spacer(),
            if (_busy)
              const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: AppColors.expeditorAccent,),
              ),
          ],
        ),
        const SizedBox(height: 6),
        Container(height: 2, width: 64, color: AppColors.expeditorAccent),
        const SizedBox(height: 10),
        if (_loading)
          const SizedBox(
            height: 60,
            child: Center(
                child: CircularProgressIndicator(
                    color: AppColors.expeditorAccent,),),
          )
        else
          SizedBox(
            height: 200,
            child: Builder(
              builder: (context) {
                final visiblePhotos =
                    _photos.where(_isToday).toList(growable: false);
                return ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: visiblePhotos.length + 1,
                  separatorBuilder: (_, __) => const SizedBox(width: 10),
                  itemBuilder: (context, index) {
                    if (index == visiblePhotos.length) return _addTile();
                    final p = visiblePhotos[index];
                    return SizedBox(
                      width: 150,
                      child: _PhotoTile(
                        clientId: widget.clientId,
                        photo: p,
                        onView: () => _view(p),
                        onReplace: () => _replace(p),
                        onDelete: () => _delete(p),
                      ),
                    );
                  },
                );
              },
            ),
          ),
      ],
    );
  }

  Widget _addTile() {
    return SizedBox(
      width: 120,
      child: Material(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          onTap: _busy ? null : _add,
          borderRadius: BorderRadius.circular(12),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.expeditorAccent),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.add_a_photo_outlined,
                    size: 28, color: AppColors.expeditorAccent,),
                const SizedBox(height: 8),
                Text(_photos.isEmpty ? 'Добавить' : 'Ещё фото',
                    style: AppTypography.bodySmall.copyWith(
                        color: AppColors.expeditorAccent,
                        fontWeight: FontWeight.w700,),),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PhotoTile extends ConsumerStatefulWidget {
  final int clientId;
  final ClientPhotoReport photo;
  final VoidCallback onView;
  final VoidCallback onReplace;
  final VoidCallback onDelete;

  const _PhotoTile({
    required this.clientId,
    required this.photo,
    required this.onView,
    required this.onReplace,
    required this.onDelete,
  });

  @override
  ConsumerState<_PhotoTile> createState() => _PhotoTileState();
}

class _PhotoTileState extends ConsumerState<_PhotoTile> {
  String? _imageUrl;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _sync();
  }

  @override
  void didUpdateWidget(covariant _PhotoTile oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.photo.id != widget.photo.id) _sync();
  }

  void _sync() {
    final inline = widget.photo.imageUrl.trim();
    if (inline.isNotEmpty) {
      setState(() => _imageUrl = inline);
      return;
    }
    unawaited(_fetch());
  }

  Future<void> _fetch() async {
    if (_loading) return;
    setState(() => _loading = true);
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) {
      if (mounted) setState(() => _loading = false);
      return;
    }
    try {
      final row = await ref
          .read(mobileApiProvider)
          .getClientPhotoReport(slug, widget.clientId, widget.photo.id);
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
    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Material(
            color: AppColors.surfaceVariant,
            child: InkWell(
              onTap: hasImage ? widget.onView : null,
              child: _loading
                  ? const Center(
                      child: CircularProgressIndicator(strokeWidth: 2),)
                  : hasImage
                      ? MediaImage(
                          source: _imageUrl!,
                          width: double.infinity,
                          height: double.infinity,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => const Center(
                              child: Icon(Icons.broken_image_outlined,
                                  size: 32,),),
                        )
                      : const Center(
                          child: Icon(Icons.image_not_supported_outlined,
                              size: 32,),),
            ),
          ),
          Positioned(
            right: 6,
            top: 6,
            child: _IconBtn(
              icon: Icons.cameraswitch_outlined,
              color: const Color(0xFF0F766E),
              onTap: widget.onReplace,
            ),
          ),
          Positioned(
            right: 6,
            bottom: 6,
            child: _IconBtn(
              icon: Icons.delete_outline,
              color: AppColors.error,
              onTap: widget.onDelete,
            ),
          ),
        ],
      ),
    );
  }
}

class _IconBtn extends StatelessWidget {
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  const _IconBtn(
      {required this.icon, required this.color, required this.onTap,});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.94),
      shape: const CircleBorder(),
      elevation: 2,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(6),
          child: Icon(icon, color: color, size: 18),
        ),
      ),
    );
  }
}

class _PhotoFullscreen extends ConsumerStatefulWidget {
  final int clientId;
  final ClientPhotoReport photo;
  const _PhotoFullscreen({required this.clientId, required this.photo});

  @override
  ConsumerState<_PhotoFullscreen> createState() => _PhotoFullscreenState();
}

class _PhotoFullscreenState extends ConsumerState<_PhotoFullscreen> {
  String? _imageUrl;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    final inline = widget.photo.imageUrl.trim();
    if (inline.isNotEmpty) {
      _imageUrl = inline;
    } else {
      unawaited(_fetch());
    }
  }

  Future<void> _fetch() async {
    setState(() => _loading = true);
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) {
      if (mounted) setState(() => _loading = false);
      return;
    }
    try {
      final row = await ref
          .read(mobileApiProvider)
          .getClientPhotoReport(slug, widget.clientId, widget.photo.id);
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
    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.all(12),
      child: Stack(
        children: [
          Center(
            child: _loading
                ? const CircularProgressIndicator(color: Colors.white)
                : hasImage
                    ? InteractiveViewer(
                        maxScale: 4,
                        child: MediaImage(source: _imageUrl!, fit: BoxFit.contain),
                      )
                    : const Icon(Icons.broken_image_outlined,
                        color: Colors.white, size: 48,),
          ),
          Positioned(
            right: 0,
            top: 0,
            child: IconButton(
              icon: const Icon(Icons.close, color: Colors.white, size: 28),
              onPressed: () => Navigator.pop(context),
            ),
          ),
        ],
      ),
    );
  }
}
