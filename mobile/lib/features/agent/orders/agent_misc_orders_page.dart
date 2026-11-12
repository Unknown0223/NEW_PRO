import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/auth/session.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../design_system/design_system.dart';
import '../shell/agent_app_bar.dart';

/// Shablon `shelf-return`: to‘liq / qisman / polka + almashtirish + foto.
class AgentMiscOrdersPage extends ConsumerStatefulWidget {
  final String mode;

  const AgentMiscOrdersPage({super.key, required this.mode});

  @override
  ConsumerState<AgentMiscOrdersPage> createState() =>
      _AgentMiscOrdersPageState();
}

class _AgentMiscOrdersPageState extends ConsumerState<AgentMiscOrdersPage> {
  String _kind = 'full'; // full | partial | shelf
  String? _reason;
  String? _photoPath;
  final _noteCtrl = TextEditingController();

  bool get _isExchange => widget.mode == 'exchange';

  static const _reasons = <String>[
    'Просрочка',
    'Брак',
    'Неверный товар',
    'Избыток на полке',
    'Другое',
  ];

  @override
  void dispose() {
    _noteCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto() async {
    final file = await ImagePicker().pickImage(
      source: ImageSource.camera,
      imageQuality: 72,
    );
    if (file == null) return;
    setState(() => _photoPath = file.path);
  }

  void _continueToOrder() {
    final parts = <String>[
      if (_isExchange) 'Обмен' else 'Возврат с полки',
      if (!_isExchange) 'тип: $_kind',
      if (_reason != null) 'причина: $_reason',
      if (_noteCtrl.text.trim().isNotEmpty) _noteCtrl.text.trim(),
      if (_photoPath != null) 'фото: приложено',
    ];
    final comment = Uri.encodeComponent(parts.join(' · '));
    context.push('/orders/create?prefill_comment=$comment');
  }

  @override
  Widget build(BuildContext context) {
    final cfg = ref.watch(sessionProvider).mobileConfig;
    final enabled = _isExchange
        ? cfg?.misc.allowExchangeRequest == true
        : cfg?.orders.allowReturnFromShelf == true;

    final title = _isExchange ? 'Запрос на обмен' : 'Возврат с полки';

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AgentAppBar(title: title, showBack: true),
      body: !enabled
          ? const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'Эта функция отключена в конфигурации.',
                  style: TextStyle(color: AppColors.textMuted),
                ),
              ),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 140),
              children: [
                SaEnter(
                  preset: SaMotionPreset.rise,
                  child: Text(
                    _isExchange
                        ? 'Укажите причину и фото, затем создайте заказ обмена.'
                        : 'Выберите тип возврата, причину и фото (как в шаблоне).',
                    style: AppTypography.bodyMedium.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
                if (!_isExchange) ...[
                  const SizedBox(height: 16),
                  SaEnter(
                    delay: SaStaggerDelay.of(1),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Тип возврата',
                          style: AppTypography.labelLarge.copyWith(
                            color: AppColors.textTitle,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            for (final e in const [
                              ('full', 'Полный'),
                              ('partial', 'Частичный'),
                              ('shelf', 'С полки'),
                            ])
                              ChoiceChip(
                                label: Text(e.$2),
                                selected: _kind == e.$1,
                                selectedColor: AppColors.primarySoft,
                                onSelected: (_) => setState(() => _kind = e.$1),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                SaEnter(
                  delay: SaStaggerDelay.of(2),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Причина',
                        style: AppTypography.labelLarge.copyWith(
                          color: AppColors.textTitle,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          for (final r in _reasons)
                            ChoiceChip(
                              label: Text(r),
                              selected: _reason == r,
                              selectedColor: AppColors.warningSoft,
                              onSelected: (_) => setState(() => _reason = r),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                SaEnter(
                  delay: SaStaggerDelay.of(3),
                  child: TextField(
                    controller: _noteCtrl,
                    maxLines: 3,
                    decoration: InputDecoration(
                      labelText: 'Комментарий',
                      filled: true,
                      fillColor: AppColors.surface,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                SaEnter(
                  delay: SaStaggerDelay.of(4),
                  child: SaPressable(
                    onTap: _pickPhoto,
                    child: OutlinedButton.icon(
                      onPressed: _pickPhoto,
                      icon: const Icon(Icons.photo_camera_outlined),
                      label: Text(
                        _photoPath == null ? 'Сделать фото' : 'Фото добавлено',
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                SaEnter(
                  delay: SaStaggerDelay.of(5),
                  child: SaPressable(
                    onTap: _reason == null ? null : _continueToOrder,
                    child: FilledButton(
                      onPressed: _reason == null ? null : _continueToOrder,
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        minimumSize: const Size.fromHeight(48),
                      ),
                      child: Text(
                        _isExchange ? 'Создать заказ обмена' : 'Создать возврат',
                      ),
                    ),
                  ),
                ),
                if (_reason == null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      'Выберите причину',
                      style: AppTypography.caption.copyWith(
                        color: AppColors.warning,
                      ),
                    ),
                  ),
              ],
            ),
    );
  }
}
