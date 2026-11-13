import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/session.dart';
import '../../../core/prefs/quick_panel_prefs.dart';
import '../../../core/prefs/quick_panel_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../design_system/design_system.dart';
import '../../../core/ui/quick_panel_sheet.dart';
import '../shell/agent_app_bar.dart';

/// Sozlamalar: tezkor panel bandlarini qo‘shish / tartiblash / o‘chirish.
class QuickPanelSettingsPage extends ConsumerStatefulWidget {
  const QuickPanelSettingsPage({super.key});

  @override
  ConsumerState<QuickPanelSettingsPage> createState() =>
      _QuickPanelSettingsPageState();
}

class _QuickPanelSettingsPageState
    extends ConsumerState<QuickPanelSettingsPage> {
  List<QuickPanelItem> _items = const [];
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _hydrate());
  }

  Future<void> _hydrate() async {
    final role = quickPanelRoleOf(ref.read(sessionProvider));
    final fromProvider = ref.read(quickPanelItemsProvider).valueOrNull;
    final items = fromProvider ?? await QuickPanelPrefs.load(role);
    if (!mounted) return;
    setState(() {
      _items = List<QuickPanelItem>.from(items);
      _loaded = true;
    });
  }

  Future<void> _persist(List<QuickPanelItem> next) async {
    setState(() => _items = next);
    await ref.read(quickPanelItemsProvider.notifier).setItems(next);
  }

  Future<void> _addItem() async {
    final role = quickPanelRoleOf(ref.read(sessionProvider));
    final catalog = QuickPanelPrefs.catalogForRole(role);
    final existing = _items.map((e) => e.id).toSet();
    final available =
        catalog.where((e) => !existing.contains(e.id)).toList();
    if (available.isEmpty) {
      if (!mounted) return;
      showAgentToast(context, 'Все разделы уже добавлены');
      return;
    }
    final picked = await showModalBottomSheet<QuickPanelItem>(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (ctx) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Text(
                'Добавить раздел',
                style: AppTypography.headlineSmall.copyWith(
                  color: AppColors.textTitle,
                ),
              ),
            ),
            ...available.map(
              (item) => ListTile(
                leading: Icon(
                  quickPanelIcon(item.icon),
                  color: AppColors.primary,
                ),
                title: Text(item.label),
                onTap: () => Navigator.pop(ctx, item),
              ),
            ),
          ],
        ),
      ),
    );
    if (picked == null) return;
    await _persist([..._items, picked]);
  }

  Future<void> _reset() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Сбросить быстрое меню?'),
        content: const Text('Будут восстановлены разделы по умолчанию.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Отмена'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Сбросить'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    await ref.read(quickPanelItemsProvider.notifier).reset();
    final role = quickPanelRoleOf(ref.read(sessionProvider));
    if (!mounted) return;
    setState(() => _items = QuickPanelPrefs.defaultsForRole(role));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AgentAppBar(
        title: 'Tezkor menyu',
        showBack: true,
        useShellDrawer: false,
        showQuickPanel: false,
        actions: [
          AgentIconButton(
            icon: Icons.restart_alt,
            onPressed: _reset,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _addItem,
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text('Добавить'),
      ),
      body: !_loaded
          ? const Center(child: CircularProgressIndicator())
          : ReorderableListView.builder(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 140),
              itemCount: _items.length,
              onReorder: (oldIndex, newIndex) {
                var next = List<QuickPanelItem>.from(_items);
                if (newIndex > oldIndex) newIndex -= 1;
                final item = next.removeAt(oldIndex);
                next.insert(newIndex, item);
                _persist(next);
              },
              itemBuilder: (context, index) {
                final item = _items[index];
                return SaEnter(
                  delay: SaStaggerDelay.of(index),
                  preset: SaMotionPreset.rise,
                  child: Card(
                  key: ValueKey(item.id),
                  margin: const EdgeInsets.only(bottom: 8),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: const BorderSide(color: AppColors.border),
                  ),
                  child: ListTile(
                    leading: Icon(
                      quickPanelIcon(item.icon),
                      color: AppColors.primary,
                    ),
                    title: Text(
                      item.label,
                      style: AppTypography.bodyMedium.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          tooltip: 'Удалить',
                          icon: const Icon(Icons.delete_outline),
                          color: AppColors.error,
                          onPressed: () {
                            final next = List<QuickPanelItem>.from(_items)
                              ..removeAt(index);
                            _persist(next);
                          },
                        ),
                        ReorderableDragStartListener(
                          index: index,
                          child: const Icon(
                            Icons.drag_handle,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                );
              },
            ),
    );
  }
}
