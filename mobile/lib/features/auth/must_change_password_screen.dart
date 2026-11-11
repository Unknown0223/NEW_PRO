import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/dio_client.dart';
import '../../core/auth/session.dart';
import '../../core/theme/app_colors.dart';
import 'auth_provider.dart';

/// Login: must_change_password=true bo‘lsa PIN/bootstrap oldidan majburiy ekran.
class MustChangePasswordScreen extends ConsumerStatefulWidget {
  const MustChangePasswordScreen({super.key});

  @override
  ConsumerState<MustChangePasswordScreen> createState() =>
      _MustChangePasswordScreenState();
}

class _MustChangePasswordScreenState
    extends ConsumerState<MustChangePasswordScreen> {
  final _old = TextEditingController();
  final _neu = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _old.dispose();
    _neu.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _error = null;
      _busy = true;
    });
    final neu = _neu.text.trim();
    if (neu != _confirm.text.trim()) {
      setState(() {
        _error = 'Новый пароль и подтверждение не совпадают';
        _busy = false;
      });
      return;
    }
    if (neu.length < 8) {
      setState(() {
        _error = 'Пароль: минимум 8 символов, буква и цифра';
        _busy = false;
      });
      return;
    }
    try {
      final session = ref.read(sessionProvider);
      final slug = session.tenantSlug;
      if (slug == null || slug.isEmpty) {
        throw StateError('no_slug');
      }
      final dio = ref.read(dioProvider);
      await dio.post(
        '/api/$slug/mobile/me/change-password',
        data: {
          'old_password': _old.text,
          'new_password': neu,
        },
      );
      await ref.read(authStateProvider.notifier).continueAfterPasswordChange();
    } catch (_) {
      setState(() {
        _error =
            'Не удалось сменить пароль. Проверьте текущий пароль и правила.';
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 24),
              Text(
                'Смена пароля',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                'Администратор требует сменить временный пароль перед работой.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppColors.textSecondary,
                    ),
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _old,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Текущий пароль'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _neu,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Новый пароль'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _confirm,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Подтверждение'),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: AppColors.error)),
              ],
              const Spacer(),
              FilledButton(
                onPressed: _busy ? null : _submit,
                child: Text(_busy ? 'Сохранение…' : 'Сохранить'),
              ),
              TextButton(
                onPressed: _busy
                    ? null
                    : () => ref.read(authStateProvider.notifier).logout(),
                child: const Text('Выйти'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
