import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/auth/biometric_preferences.dart';
import '../../../core/auth/biometric_service.dart';
import '../../../core/api/api_exceptions.dart';
import '../../../core/api/auth_api.dart';
import '../../../core/api/dio_client.dart' show ensureAuthTokens;
import '../../../core/api/mobile_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/ui/agent_ui.dart';
import '../../auth/auth_provider.dart';
import '../../agent/shell/agent_app_bar.dart';
import '../../agent/shell/agent_scaffold_key.dart';

class ProfilePage extends ConsumerStatefulWidget {
  const ProfilePage({super.key});

  @override
  ConsumerState<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends ConsumerState<ProfilePage> {
  final _firstName = TextEditingController();
  final _lastName = TextEditingController();
  final _phone = TextEditingController();
  final _oldPass = TextEditingController();
  final _newPass = TextEditingController();
  final _newPass2 = TextEditingController();

  bool _loading = true;
  bool _saving = false;
  bool _bioAvailable = false;
  bool _bioEnabled = false;
  String _bioLabel = 'биометрию';
  String? _error;
  String? _avatarBase64;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _firstName.dispose();
    _lastName.dispose();
    _phone.dispose();
    _oldPass.dispose();
    _newPass.dispose();
    _newPass2.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ensureAuthTokens(ref);
      final bio = ref.read(biometricServiceProvider);
      final prefs = ref.read(biometricPreferencesProvider);
      final p = await ref.read(mobileApiProvider).getMyProfile(slug);
      final bioAvailable = await bio.isAvailable();
      final bioEnabled = await prefs.isEnabled();
      final bioLabel = await bio.getBiometricLabel();
      if (!mounted) return;
      _firstName.text = p.firstName ?? _splitName(p.name).$1;
      _lastName.text = p.lastName ?? _splitName(p.name).$2;
      _phone.text = (p.phone ?? '').replaceAll(RegExp(r'\D'), '');
      setState(() {
        _avatarBase64 = p.avatarBase64;
        _bioAvailable = bioAvailable;
        _bioEnabled = bioEnabled;
        _bioLabel = bioLabel;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
        _error = e.message;
        _loading = false;
      });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
        _error = e.toString();
        _loading = false;
      });
      }
    }
  }

  (String, String) _splitName(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return ('', '');
    if (parts.length == 1) return (parts.first, '');
    return (parts.first, parts.sublist(1).join(' '));
  }

  Future<void> _pickAvatar() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 512, imageQuality: 75);
    if (picked == null) return;
    final bytes = await picked.readAsBytes();
    if (bytes.length > 150000) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Rasm juda katta — kichikroq tanlang'), backgroundColor: AppColors.warning),
        );
      }
      return;
    }
    setState(() => _avatarBase64 = base64Encode(bytes));
  }

  void _clearAvatar() => setState(() => _avatarBase64 = null);

  Future<void> _save() async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return;

    final oldPw = _oldPass.text;
    final newPw = _newPass.text;
    final newPw2 = _newPass2.text;
    if (newPw.isNotEmpty || newPw2.isNotEmpty || oldPw.isNotEmpty) {
      if (oldPw.isEmpty || newPw.length < 6) {
        setState(() => _error = 'Parol: eski parol va yangi (kamida 6 belgi) kerak');
        return;
      }
      if (newPw != newPw2) {
        setState(() => _error = 'Yangi parollar mos emas');
        return;
      }
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      await ensureAuthTokens(ref);
      final api = ref.read(mobileApiProvider);

      if (oldPw.isNotEmpty && newPw.isNotEmpty) {
        await api.changeMyPassword(slug, oldPassword: oldPw, newPassword: newPw);
        _oldPass.clear();
        _newPass.clear();
        _newPass2.clear();
      }

      final body = <String, dynamic>{
        'first_name': _firstName.text.trim(),
        'last_name': _lastName.text.trim(),
        'phone': _phone.text.trim().isEmpty ? null : _phone.text.trim(),
        'avatar_base64': _avatarBase64,
      };

      final updated = await api.patchMyProfile(slug, body);
      final u = ref.read(sessionProvider).user;
      if (u != null) {
        await ref.read(sessionProvider.notifier).setUser(
              AuthUser(
                id: u.id,
                name: updated.name,
                login: u.login,
                role: u.role,
                tenantId: u.tenantId,
                tenantSlug: u.tenantSlug,
                workSlotCode: u.workSlotCode,
                workSlotId: u.workSlotId,
                code: u.code,
                appAccess: u.appAccess,
              ),
              slug: slug,
            );
      }

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Профиль сохранён'), backgroundColor: AppColors.success),
      );
      context.pop();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _avatarWidget() {
    if (_avatarBase64 != null && _avatarBase64!.isNotEmpty) {
      try {
        return CircleAvatar(
          radius: 44,
          backgroundColor: AppColors.surfaceVariant,
          backgroundImage: MemoryImage(base64Decode(_avatarBase64!)),
        );
      } catch (_) {}
    }
    return const CircleAvatar(
      radius: 44,
      backgroundColor: AppColors.surfaceVariant,
      child: Icon(Icons.person, size: 52, color: AppColors.textMuted),
    );
  }

  bool _canEditFullProfile(String? role) =>
      role == 'agent' || role == 'expeditor' || role == 'supervisor';

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final user = session.user;
    final isAgent = user?.role == 'agent';
    final fullProfile = _canEditFullProfile(user?.role);
    final accent =
        user?.role == 'expeditor' ? AppColors.expeditorAccent : AppColors.primary;

    if (!fullProfile) {
      return Scaffold(
        backgroundColor: AppColors.background,
        appBar: const AgentAppBar(title: 'Профиль', showBack: true),
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              const CircleAvatar(
                radius: 44,
                backgroundColor: AppColors.surfaceVariant,
                child: Icon(Icons.person, size: 52, color: AppColors.textMuted),
              ),
              const SizedBox(height: 12),
              Text(user?.name ?? 'Пользователь', style: AppTypography.headlineMedium),
              const SizedBox(height: 24),
              ListTile(
                leading: const Icon(Icons.logout, color: AppColors.error),
                title: const Text('Выйти из аккаунта', style: TextStyle(color: AppColors.error)),
                onTap: () async {
                  await ref.read(authStateProvider.notifier).logout();
                },
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: isAgent
          ? AgentAppBar(
              title: 'Редактировать профиль',
              showBack: true,
              actions: [
                AgentIconButton(icon: Icons.menu, onPressed: () => openAgentMenu(context)),
              ],
            )
          : const AgentAppBar(
              title: 'Редактировать профиль',
              showBack: true,
            ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : Column(
              children: [
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.all(12),
                    children: [
                      AgentSurfaceCard(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          children: [
                            _avatarWidget(),
                            const SizedBox(height: 12),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                TextButton(
                                  onPressed: _pickAvatar,
                                  style: TextButton.styleFrom(foregroundColor: accent),
                                  child: const Text('Загрузить'),
                                ),
                                const SizedBox(width: 24),
                                TextButton(
                                  onPressed: _clearAvatar,
                                  child: const Text('Удалить', style: TextStyle(color: AppColors.error)),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            AgentFloatingInput(label: 'Имя', controller: _firstName),
                            const SizedBox(height: 12),
                            AgentFloatingInput(label: 'Фамилия', controller: _lastName),
                            const SizedBox(height: 12),
                            AgentFloatingInput(
                              label: 'Номер телефона',
                              controller: _phone,
                              keyboardType: TextInputType.phone,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      if (_bioAvailable)
                        AgentSurfaceCard(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          child: SwitchListTile(
                            value: _bioEnabled,
                            activeThumbColor: accent,
                            onChanged: (v) async {
                              if (v) {
                                final ok = await ref.read(authStateProvider.notifier).enableBiometricLock();
                                if (!mounted) return;
                                if (ok) {
                                  setState(() => _bioEnabled = true);
                                  showAgentToast(context, 'Biometrik qulf yoqildi', accentColor: AppColors.success);
                                }
                              } else {
                                await ref.read(authStateProvider.notifier).disableBiometricLock();
                                if (mounted) setState(() => _bioEnabled = false);
                              }
                            },
                            secondary: Icon(Icons.fingerprint_rounded, color: accent),
                            title: const Text('Быстрый вход', style: TextStyle(fontWeight: FontWeight.w700)),
                            subtitle: Text(
                              '$_bioLabel — только на этом телефоне, не на сервере',
                              style: AppTypography.bodySmall.copyWith(color: AppColors.textMuted),
                            ),
                          ),
                        ),
                      if (_bioAvailable) const SizedBox(height: 16),
                      AgentSurfaceCard(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Изменить пароль',
                              style: AppTypography.headlineSmall.copyWith(fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: 16),
                            AgentFloatingInput(label: 'Старый пароль', controller: _oldPass, obscureText: true),
                            const SizedBox(height: 12),
                            AgentFloatingInput(label: 'Новый пароль', controller: _newPass, obscureText: true),
                            const SizedBox(height: 12),
                            AgentFloatingInput(
                              label: 'Повторите новый пароль',
                              controller: _newPass2,
                              obscureText: true,
                            ),
                          ],
                        ),
                      ),
                      if (_error != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: Text(_error!, style: const TextStyle(color: AppColors.error, fontWeight: FontWeight.w600)),
                        ),
                      const SizedBox(height: 16),
                      AgentSecondaryButton(
                        label: 'Выйти из аккаунта',
                        onPressed: () async {
                          await ref.read(authStateProvider.notifier).logout();
                        },
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: AgentPrimaryButton(
                    label: _saving ? 'Сохранение…' : 'Сохранить',
                    height: 52,
                    color: accent,
                    onPressed: _saving ? null : _save,
                  ),
                ),
              ],
            ),
    );
  }
}
