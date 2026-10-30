import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exceptions.dart';
import '../../../core/api/bank_transfer_inbox_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/format/money_display.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import 'bank_transfer_inbox_providers.dart';

/// Detail: summa, INN/hisob, status; assign / reassign + majburiy izoh; confirm pending.
class BankTransferInboxDetailPage extends ConsumerStatefulWidget {
  final int inboxId;
  const BankTransferInboxDetailPage({super.key, required this.inboxId});

  @override
  ConsumerState<BankTransferInboxDetailPage> createState() =>
      _BankTransferInboxDetailPageState();
}

class _BankTransferInboxDetailPageState
    extends ConsumerState<BankTransferInboxDetailPage> {
  final _commentCtrl = TextEditingController();
  final _searchCtrl = TextEditingController();
  int? _selectedClientId;
  String? _selectedClientLabel;
  List<Map<String, dynamic>> _searchHits = [];
  bool _searching = false;
  bool _submitting = false;
  String? _actionError;

  @override
  void dispose() {
    _commentCtrl.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  String _errMsg(Object e) => e is ApiException ? e.message : '$e';

  void _toast(String msg, {Color? color}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: color ?? AppColors.error,
      ),
    );
  }

  void _invalidateLists() {
    ref.invalidate(btiDetailProvider(widget.inboxId));
    ref.invalidate(btiCountsProvider);
    ref.invalidate(btiSelectedTabProvider);
    for (final t in btiTabs) {
      ref.invalidate(btiListProvider(t.key));
    }
  }

  Future<void> _runSearch(String q) async {
    final slug = ref.read(sessionProvider).tenantSlug;
    if (slug == null || slug.isEmpty) return;
    setState(() => _searching = true);
    try {
      final hits = await ref.read(bankTransferInboxApiProvider).searchClients(
            slug,
            search: q,
          );
      if (mounted) setState(() => _searchHits = hits);
    } catch (e) {
      if (mounted) {
        final msg = _errMsg(e);
        setState(() => _actionError = msg);
        _toast(msg);
      }
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  Future<void> _submitAssign({required bool reassign}) async {
    final clientId = _selectedClientId;
    final comment = _commentCtrl.text.trim();
    if (clientId == null) {
      setState(() => _actionError = 'Выберите клиента');
      return;
    }
    if (comment.length < 3) {
      setState(() => _actionError = 'Комментарий обязателен (минимум 3 символа)');
      return;
    }
    final slug = ref.read(sessionProvider).tenantSlug;
    if (slug == null || slug.isEmpty) return;

    final perms = ref.read(sessionProvider).permissions;
    if (!perms.canUpdateBankTransfers) {
      const msg =
          'Нет права назначения (cash.perechisleniya.update). Обратитесь к администратору.';
      setState(() => _actionError = msg);
      _toast(msg);
      return;
    }

    setState(() {
      _submitting = true;
      _actionError = null;
    });
    try {
      final api = ref.read(bankTransferInboxApiProvider);
      if (reassign) {
        await api.reassign(
          slug,
          widget.inboxId,
          clientId: clientId,
          comment: comment,
        );
      } else {
        await api.assign(
          slug,
          widget.inboxId,
          clientId: clientId,
          comment: comment,
        );
      }
      _invalidateLists();
      if (mounted) {
        _toast(
          reassign ? 'Клиент переназначен' : 'Клиент назначен',
          color: AppColors.success,
        );
        setState(() {
          _commentCtrl.clear();
          _selectedClientId = null;
          _selectedClientLabel = null;
        });
      }
    } catch (e) {
      final msg = _errMsg(e);
      if (mounted) {
        setState(() => _actionError = msg);
        _toast(msg);
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _createPayment() async {
    final perms = ref.read(sessionProvider).permissions;
    if (!perms.canUpdateBankTransfers) {
      const msg = 'Нет права (cash.perechisleniya.update).';
      setState(() => _actionError = msg);
      _toast(msg);
      return;
    }
    final slug = ref.read(sessionProvider).tenantSlug;
    if (slug == null || slug.isEmpty) return;
    setState(() {
      _submitting = true;
      _actionError = null;
    });
    try {
      await ref.read(bankTransferInboxApiProvider).createPayment(slug, widget.inboxId);
      _invalidateLists();
      if (mounted) {
        _toast('Платёж создан — можно подтвердить', color: AppColors.success);
      }
    } catch (e) {
      final msg = _errMsg(e);
      if (mounted) {
        setState(() => _actionError = msg);
        _toast(msg);
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _saveCommentOnly() async {
    final comment = _commentCtrl.text.trim();
    if (comment.length < 3) {
      setState(() => _actionError = 'Комментарий обязателен (минимум 3 символа)');
      return;
    }
    final perms = ref.read(sessionProvider).permissions;
    if (!perms.canUpdateBankTransfers) {
      const msg = 'Нет права (cash.perechisleniya.update).';
      setState(() => _actionError = msg);
      _toast(msg);
      return;
    }
    final slug = ref.read(sessionProvider).tenantSlug;
    if (slug == null || slug.isEmpty) return;
    setState(() {
      _submitting = true;
      _actionError = null;
    });
    try {
      await ref.read(bankTransferInboxApiProvider).comment(
            slug,
            widget.inboxId,
            comment: comment,
          );
      _invalidateLists();
      if (mounted) {
        _toast('Комментарий сохранён', color: AppColors.success);
        setState(() => _commentCtrl.clear());
      }
    } catch (e) {
      final msg = _errMsg(e);
      if (mounted) {
        setState(() => _actionError = msg);
        _toast(msg);
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _ignoreItem() async {
    final perms = ref.read(sessionProvider).permissions;
    if (!perms.canUpdateBankTransfers) {
      const msg = 'Нет права (cash.perechisleniya.update).';
      setState(() => _actionError = msg);
      _toast(msg);
      return;
    }
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Игнорировать перевод?'),
        content: const Text(
          'Запись будет скрыта из активных вкладок. Используйте только для явного мусора.',
          style: AppTypography.bodyMedium,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Отмена'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: AppColors.error),
            child: const Text('Игнорировать'),
          ),
        ],
      ),
    );
    if (ok != true) return;

    final slug = ref.read(sessionProvider).tenantSlug;
    if (slug == null || slug.isEmpty) return;
    setState(() {
      _submitting = true;
      _actionError = null;
    });
    try {
      final c = _commentCtrl.text.trim();
      await ref.read(bankTransferInboxApiProvider).ignore(
            slug,
            widget.inboxId,
            comment: c.isEmpty ? null : c,
          );
      _invalidateLists();
      if (mounted) {
        _toast('Запись проигнорирована', color: AppColors.success);
        Navigator.of(context).maybePop();
      }
    } catch (e) {
      final msg = _errMsg(e);
      if (mounted) {
        setState(() => _actionError = msg);
        _toast(msg);
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _confirmPayment(int paymentId) async {
    final perms = ref.read(sessionProvider).permissions;
    if (!perms.canConfirmClientPayments) {
      const msg =
          'Нет права подтверждения оплаты (cash.oplaty_klientov.update).';
      setState(() => _actionError = msg);
      _toast(msg);
      return;
    }

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Подтвердить оплату?'),
        content: Text(
          'Платёж #$paymentId будет подтверждён. Переназначение станет недоступно.',
          style: AppTypography.bodyMedium,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Отмена'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: AppColors.cashierAccent),
            child: const Text('Подтвердить'),
          ),
        ],
      ),
    );
    if (ok != true) return;

    final slug = ref.read(sessionProvider).tenantSlug;
    if (slug == null || slug.isEmpty) return;

    setState(() {
      _submitting = true;
      _actionError = null;
    });
    try {
      await ref.read(bankTransferInboxApiProvider).confirmPayment(slug, paymentId);
      _invalidateLists();
      if (mounted) {
        _toast('Оплата подтверждена — статус «Готово»', color: AppColors.success);
      }
    } catch (e) {
      final msg = _errMsg(e);
      if (mounted) {
        setState(() => _actionError = msg);
        _toast(msg);
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(btiDetailProvider(widget.inboxId));
    final perms = ref.watch(sessionProvider).permissions;
    const accent = AppColors.cashierAccent;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text('Перевод #${widget.inboxId}'),
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.textTitle,
        elevation: 0,
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _ErrorPane(
          message: _errMsg(e),
          onRetry: () => ref.invalidate(btiDetailProvider(widget.inboxId)),
        ),
        data: (d) {
          if (d.isEmpty) {
            return const _EmptyPane(
              icon: Icons.search_off_outlined,
              title: 'Запись не найдена',
              subtitle: 'Возможно, перевод удалён или нет доступа.',
            );
          }
          final amount = (d['amount'] as num?)?.toDouble() ?? 0;
          final currency = d['currency']?.toString() ?? 'UZS';
          final status = d['status']?.toString();
          final channelLabel = btiChannelBadge(d);
          final payer = d['payer_name']?.toString();
          final inn = d['payer_inn']?.toString();
          final account = d['payer_bank_account']?.toString();
          final purpose = d['purpose']?.toString();
          final paymentId = (d['payment_id'] as num?)?.toInt();
          final assigned = d['assigned_client'];
          String? assignedName;
          if (assigned is Map) {
            assignedName = assigned['name']?.toString();
          }

          final canAssign =
              status == 'unmatched' || status == 'ambiguous' || status == 'matched';
          final canReassign = status == 'pending';
          final canConfirmUi =
              paymentId != null && paymentId > 0 && status == 'pending';
          final allowAssignActions = perms.canUpdateBankTransfers;
          final canCreatePayment =
              status == 'matched' && paymentId == null && allowAssignActions;
          final canIgnore =
              status != 'ignored' && status != 'done' && allowAssignActions;

          final candidates = <Map<String, dynamic>>[];
          final rawCand = d['candidate_clients'];
          if (rawCand is List) {
            for (final c in rawCand) {
              if (c is Map) candidates.add(Map<String, dynamic>.from(c));
            }
          }

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
            children: [
              _card([
                _kv('Сумма', '${formatMoneySpaced(amount)} $currency'),
                _kv('Статус', btiStatusLabel(status)),
                _kv('Канал', channelLabel),
                _kv('Плательщик', payer?.isNotEmpty == true ? payer! : '—'),
                _kv('ИНН', inn?.isNotEmpty == true ? inn! : '—'),
                _kv('Счёт', account?.isNotEmpty == true ? account! : '—'),
                if (purpose != null && purpose.isNotEmpty) _kv('Назначение', purpose),
                if (assignedName != null) _kv('Клиент', assignedName),
                if (paymentId != null) _kv('Платёж', '#$paymentId'),
              ]),
              if (canConfirmUi) ...[
                const SizedBox(height: 12),
                if (!perms.canConfirmClientPayments)
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.warningSoft,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      'Нет права подтверждения (cash.oplaty_klientov.update). '
                      'Назначение клиента доступно; подтвердите оплату в вебе или запросите право.',
                      style: AppTypography.caption.copyWith(color: AppColors.textTitle),
                    ),
                  )
                else
                  FilledButton.icon(
                    onPressed: _submitting ? null : () => _confirmPayment(paymentId),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.success,
                      minimumSize: const Size.fromHeight(48),
                    ),
                    icon: const Icon(Icons.check_circle_outline),
                    label: Text(
                      _submitting ? 'Подтверждение…' : 'Подтвердить оплату #$paymentId',
                    ),
                  ),
              ] else if (status == 'done') ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.success.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    'Оплата подтверждена. Запись в статусе «Готово».',
                    style: AppTypography.caption.copyWith(color: AppColors.textTitle),
                  ),
                ),
              ] else if (canCreatePayment) ...[
                const SizedBox(height: 12),
                FilledButton.icon(
                  onPressed: _submitting ? null : _createPayment,
                  style: FilledButton.styleFrom(
                    backgroundColor: accent,
                    minimumSize: const Size.fromHeight(48),
                  ),
                  icon: const Icon(Icons.payment_outlined),
                  label: Text(_submitting ? 'Создание…' : 'Создать оплату'),
                ),
                const SizedBox(height: 8),
                Text(
                  'Клиент уже сопоставлен. Создайте ожидающий платёж, затем подтвердите.',
                  style: AppTypography.caption.copyWith(color: AppColors.textMuted),
                ),
              ] else if (paymentId == null && (canAssign || canReassign)) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.warningSoft,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    'После назначения создаётся ожидающий платёж — затем его можно подтвердить здесь.',
                    style: AppTypography.caption.copyWith(color: AppColors.textTitle),
                  ),
                ),
              ],
              if (candidates.isNotEmpty) ...[
                const SizedBox(height: 16),
                Text('Кандидаты матча', style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                for (final c in candidates)
                  ListTile(
                    dense: true,
                    tileColor: AppColors.surface,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    title: Text(c['name']?.toString() ?? '—'),
                    subtitle: Text(
                      [
                        if (c['client_code'] != null) 'код ${c['client_code']}',
                        if (c['inn'] != null) 'ИНН ${c['inn']}',
                      ].join(' · '),
                    ),
                    trailing: const Icon(Icons.person_add_alt_1_outlined, size: 20),
                    onTap: !allowAssignActions
                        ? null
                        : () {
                            setState(() {
                              _selectedClientId = (c['id'] as num?)?.toInt();
                              _selectedClientLabel = c['name']?.toString();
                            });
                          },
                  ),
              ],
              if ((canAssign || canReassign) && allowAssignActions) ...[
                const SizedBox(height: 20),
                Text(
                  canReassign && !canAssign ? 'Переназначить клиента' : 'Назначить клиента',
                  style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _searchCtrl,
                  decoration: InputDecoration(
                    hintText: 'Поиск клиента…',
                    filled: true,
                    fillColor: AppColors.surface,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                    suffixIcon: _searching
                        ? const Padding(
                            padding: EdgeInsets.all(12),
                            child: SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                          )
                        : IconButton(
                            icon: const Icon(Icons.search),
                            onPressed: () => _runSearch(_searchCtrl.text),
                          ),
                  ),
                  textInputAction: TextInputAction.search,
                  onSubmitted: _runSearch,
                ),
                if (_searchHits.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  ..._searchHits.take(12).map((c) {
                    final id = (c['id'] as num?)?.toInt();
                    final label = c['name']?.toString() ?? '—';
                    final selected = id != null && id == _selectedClientId;
                    return ListTile(
                      dense: true,
                      selected: selected,
                      selectedTileColor: accent.withValues(alpha: 0.1),
                      title: Text(label),
                      subtitle: Text(
                        [
                          if (c['client_code'] != null) '${c['client_code']}',
                          if (c['inn'] != null) 'ИНН ${c['inn']}',
                        ].join(' · '),
                      ),
                      onTap: id == null
                          ? null
                          : () => setState(() {
                                _selectedClientId = id;
                                _selectedClientLabel = label;
                              }),
                    );
                  }),
                ],
                if (_selectedClientLabel != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Выбран: $_selectedClientLabel',
                    style: AppTypography.bodyMedium.copyWith(color: accent, fontWeight: FontWeight.w600),
                  ),
                ],
                const SizedBox(height: 12),
                TextField(
                  controller: _commentCtrl,
                  minLines: 2,
                  maxLines: 4,
                  decoration: InputDecoration(
                    labelText: 'Комментарий (обязательно)',
                    filled: true,
                    fillColor: AppColors.surface,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
                if (_actionError != null) ...[
                  const SizedBox(height: 8),
                  Text(_actionError!, style: const TextStyle(color: AppColors.error)),
                ],
                const SizedBox(height: 12),
                if (canAssign)
                  FilledButton(
                    onPressed: _submitting ? null : () => _submitAssign(reassign: false),
                    style: FilledButton.styleFrom(backgroundColor: accent),
                    child: Text(_submitting ? 'Сохранение…' : 'Назначить + создать платёж'),
                  ),
                if (canReassign) ...[
                  const SizedBox(height: 8),
                  OutlinedButton(
                    onPressed: _submitting ? null : () => _submitAssign(reassign: true),
                    child: Text(_submitting ? 'Сохранение…' : 'Переназначить'),
                  ),
                ],
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: _submitting ? null : _saveCommentOnly,
                  child: const Text('Сохранить комментарий'),
                ),
              ] else if ((canAssign || canReassign) && !allowAssignActions) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.warningSoft,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    'Нет права назначения клиента (cash.perechisleniya.update).',
                    style: AppTypography.caption.copyWith(color: AppColors.textTitle),
                  ),
                ),
              ],
              // Comment-only / ignore when not in assign panel (e.g. pending with payment)
              if (allowAssignActions && !(canAssign || canReassign) && status != 'done' && status != 'ignored') ...[
                const SizedBox(height: 16),
                TextField(
                  controller: _commentCtrl,
                  minLines: 2,
                  maxLines: 4,
                  decoration: InputDecoration(
                    labelText: 'Комментарий',
                    filled: true,
                    fillColor: AppColors.surface,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: _submitting ? null : _saveCommentOnly,
                  child: const Text('Сохранить комментарий'),
                ),
              ],
              if (canIgnore) ...[
                const SizedBox(height: 16),
                TextButton(
                  onPressed: _submitting ? null : _ignoreItem,
                  style: TextButton.styleFrom(foregroundColor: AppColors.error),
                  child: const Text('Игнорировать запись'),
                ),
              ],
              if (_actionError != null && !(canAssign || canReassign)) ...[
                const SizedBox(height: 12),
                Text(_actionError!, style: const TextStyle(color: AppColors.error)),
              ],
            ],
          );
        },
      ),
    );
  }

  Widget _card(List<Widget> children) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0) const SizedBox(height: 8),
            children[i],
          ],
        ],
      ),
    );
  }

  Widget _kv(String k, String v) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 100,
          child: Text(k, style: AppTypography.caption.copyWith(color: AppColors.textMuted)),
        ),
        Expanded(child: Text(v, style: AppTypography.bodyMedium)),
      ],
    );
  }
}

class _EmptyPane extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  const _EmptyPane({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 48, color: AppColors.textMuted),
            const SizedBox(height: 12),
            Text(title, style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorPane extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorPane({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 48, color: AppColors.error),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: AppTypography.bodyMedium,
            ),
            const SizedBox(height: 16),
            OutlinedButton(onPressed: onRetry, child: const Text('Повторить')),
          ],
        ),
      ),
    );
  }
}
