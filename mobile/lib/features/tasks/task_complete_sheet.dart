import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/api/tasks_api.dart';
import '../../core/auth/session.dart';
import '../../core/camera/photo_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';

const taskMaxPhotos = 3;

Future<bool?> showTaskCompleteSheet(BuildContext context, TaskItem task) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
    builder: (_) => _TaskCompleteSheet(task: task),
  );
}

class _TaskCompleteSheet extends ConsumerStatefulWidget {
  final TaskItem task;
  const _TaskCompleteSheet({required this.task});

  @override
  ConsumerState<_TaskCompleteSheet> createState() => _TaskCompleteSheetState();
}

class _TaskCompleteSheetState extends ConsumerState<_TaskCompleteSheet> {
  final _comment = TextEditingController();
  final List<String> _paths = [];
  bool _sending = false;
  String? _error;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  Future<void> _addPhoto(ImageSource source) async {
    if (_paths.length >= taskMaxPhotos) return;
    final String? path;
    if (source == ImageSource.camera) {
      path = (await ref.read(photoServiceProvider).takeClientPhoto())?.filePath;
    } else {
      path = (await ImagePicker().pickImage(source: ImageSource.gallery))?.path;
    }
    if (path != null && mounted) setState(() => _paths.add(path!));
  }

  Future<void> _submit() async {
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      final photos = <String>[];
      for (final p in _paths) {
        final b64 = await encodeClientPhotoBase64(p);
        if (b64 == null) throw Exception('Не удалось подготовить фото');
        photos.add(b64);
      }
      final slug = ref.read(sessionProvider).tenantSlug ?? '';
      await ref.read(tasksApiProvider).complete(slug, widget.task.id, comment: _comment.text, photos: photos);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 12, 16, 16 + MediaQuery.of(context).viewInsets.bottom),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Выполнить задачу', style: AppTypography.headlineSmall),
            const SizedBox(height: 4),
            Text(widget.task.title, style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary)),
            const SizedBox(height: 14),
            TextField(
              controller: _comment,
              maxLines: 4,
              maxLength: 2000,
              decoration: const InputDecoration(
                labelText: 'Комментарий (необязательно)',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 6),
            const Text('Фото (до $taskMaxPhotos, необязательно)', style: AppTypography.labelMedium),
            const SizedBox(height: 8),
            SizedBox(
              height: 84,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  for (var i = 0; i < _paths.length; i++)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: Stack(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: Image.file(File(_paths[i]), width: 84, height: 84, fit: BoxFit.cover),
                          ),
                          Positioned(
                            right: 2,
                            top: 2,
                            child: InkWell(
                              onTap: _sending ? null : () => setState(() => _paths.removeAt(i)),
                              child: const CircleAvatar(
                                radius: 12,
                                backgroundColor: Colors.black54,
                                child: Icon(Icons.close, size: 14, color: Colors.white),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  if (_paths.length < taskMaxPhotos) ...[
                    _AddTile(icon: Icons.photo_camera_outlined, label: 'Камера', onTap: _sending ? null : () => _addPhoto(ImageSource.camera)),
                    const SizedBox(width: 8),
                    _AddTile(icon: Icons.photo_library_outlined, label: 'Галерея', onTap: _sending ? null : () => _addPhoto(ImageSource.gallery)),
                  ],
                ],
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(_error!, style: const TextStyle(color: AppColors.error)),
            ],
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: _sending ? null : _submit,
              icon: _sending
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.check),
              label: Text(_sending ? 'Отправка…' : 'Отметить выполненной'),
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48), backgroundColor: AppColors.success),
            ),
          ],
        ),
      ),
    );
  }
}

class _AddTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  const _AddTile({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        width: 84,
        height: 84,
        decoration: BoxDecoration(
          color: AppColors.surfaceMuted,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: AppColors.primary),
            const SizedBox(height: 4),
            Text(label, style: AppTypography.caption),
          ],
        ),
      ),
    );
  }
}
