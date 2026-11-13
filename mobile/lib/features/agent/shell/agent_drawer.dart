import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/app/app_build_info.dart';
import '../../../core/auth/session.dart';
import '../../../core/l10n/app_strings_ru.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/time/work_region_time.dart';
import '../../../core/ui/agent_ui.dart';
import '../../../core/update/app_update_info.dart';
import '../../../design_system/design_system.dart';
import '../../auth/auth_provider.dart';
import '../orders/create_order_exit_guard.dart';
import '../warehouse/warehouse_stock_providers.dart';
import 'agent_display_title.dart';
import 'agent_drawer_widgets.dart';
import 'agent_menu_config.dart';

/// Shablon `MenuScreen` — gradient profil, qidiruv, kartalar + stagger.
class AgentDrawer extends ConsumerStatefulWidget {
  const AgentDrawer({super.key});

  @override
  ConsumerState<AgentDrawer> createState() => _AgentDrawerState();
}

class _AgentDrawerState extends ConsumerState<AgentDrawer> {
  bool _checkingUpdate = false;
  final _search = TextEditingController();
  String _query = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(authStateProvider.notifier).refreshMobileConfig();
      ref.read(authStateProvider.notifier).refreshAgentIdentity();
    });
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _soonSnack() {
    showAgentToast(context, '«Maosh» moduli keyingi yangilanishda chiqadi');
  }

  Future<void> _onCheckUpdate() async {
    if (_checkingUpdate) return;
    setState(() => _checkingUpdate = true);
    try {
      final result = await ref.read(authStateProvider.notifier).checkForAppUpdateManual();
      if (!mounted) return;
      switch (result) {
        case AppUpdateUpToDate(:final currentVersion):
          showAgentToast(
            context,
            S.appUpdateAlreadyLatest(currentVersion),
            accentColor: AppColors.success,
          );
        case AppUpdateOffered():
          Navigator.pop(context);
        case AppUpdateCheckFailed(:final message):
          showAgentToast(context, message, accentColor: AppColors.error);
      }
    } finally {
      if (mounted) setState(() => _checkingUpdate = false);
    }
  }

  Future<void> _go(String path) async {
    if (path.isEmpty) {
      Navigator.pop(context);
      return;
    }
    final router = GoRouter.of(context);
    final loc = GoRouterState.of(context).uri.path;
    final container = ProviderScope.containerOf(context);
    Navigator.pop(context);
    await WidgetsBinding.instance.endOfFrame;
    await leaveCreateOrderThenGo(
      container: container,
      go: router.go,
      path: path,
      currentLocation: loc,
      onSameLocation: (p) {
        container.read(agentRouteReselectProvider.notifier).state = p;
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final user = session.user;
    final menu = agentMenuItems(session.mobileConfig);
    final q = _query.trim().toLowerCase();
    final filtered = q.isEmpty
        ? menu
        : menu
            .where((m) => '${m.label} ${m.sub}'.toLowerCase().contains(q))
            .toList();
    final drawerRows = <Object>[];
    var lastGroup = '';
  for (final m in filtered) {
    final g = m.group;
    if (q.isEmpty && g != lastGroup) {
      final n = filtered.where((x) => x.group == g).length;
      drawerRows.add(AgentMenuGroupHeader(title: g, count: n));
      lastGroup = g;
    }
    drawerRows.add(m);
  }

    final agentName = (user?.name ?? '').trim();
    final displayName = agentName.isEmpty ? 'Agent' : agentName;
    final tenant = session.tenantName?.trim().isNotEmpty == true
        ? session.tenantName!
        : (session.tenantSlug ?? '');
    final syncAt = formatWorkRegionDateTime(session.lastSyncAt);
    final syncShort = syncAt.length > 5 ? syncAt.substring(syncAt.length - 5) : syncAt;

    return Drawer(
      backgroundColor: AppColors.background,
      width: MediaQuery.sizeOf(context).width,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Column(
                children: [
                  SaEnter(
                    preset: SaMotionPreset.rise,
                    child: AgentMenuHeaderCard(
                      name: displayName,
                      subtitle: 'Agent · $tenant · Sync $syncShort',
                      initials: agentMenuInitials(name: agentName, code: user?.code),
                      onProfile: () => _go('/profile'),
                      onClose: () => Navigator.pop(context),
                    ),
                  ),
                  const SizedBox(height: 10),
                  SaEnter(
                    delay: SaStaggerDelay.of(1),
                    preset: SaMotionPreset.rise,
                    child: AgentMenuSearchField(
                      controller: _search,
                      onChanged: (v) => setState(() => _query = v),
                      onClear: () {
                        _search.clear();
                        setState(() => _query = '');
                      },
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                itemCount: drawerRows.length + 2,
                itemBuilder: (context, i) {
                  if (i < drawerRows.length) {
                    final row = drawerRows[i];
                    if (row is AgentMenuGroupHeader) {
                      return SaEnter(
                        delay: SaStaggerDelay.of(i % 8),
                        preset: SaMotionPreset.rise,
                        child: row,
                      );
                    }
                    final m = row as AgentMenuItem;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: SaEnter(
                        delay: SaStaggerDelay.of(i % 8),
                        preset: SaMotionPreset.rise,
                        child: AgentMenuRowCard(
                          item: m,
                          onTap: m.soon ? _soonSnack : () => _go(m.route),
                        ),
                      ),
                    );
                  }
                  if (i == drawerRows.length) {
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 6, top: 4),
                      child: SaEnter(
                        delay: SaStaggerDelay.of(2),
                        child: AgentMenuRowCard(
                          item: AgentMenuItem(
                            label: _checkingUpdate ? S.appUpdateChecking : S.checkAppUpdate,
                            sub: 'APK versiyasini tekshirish',
                            route: '',
                            icon: Icons.system_update_outlined,
                            group: 'Tizim',
                          ),
                          onTap: _checkingUpdate ? null : _onCheckUpdate,
                          loading: _checkingUpdate,
                        ),
                      ),
                    );
                  }
                  return SaEnter(
                    delay: SaStaggerDelay.of(3),
                    child: AgentMenuLogoutRow(
                      onTap: () async {
                        Navigator.pop(context);
                        await ref.read(authStateProvider.notifier).logout();
                      },
                    ),
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Column(
                children: [
                  Image.asset(
                    'assets/brand/header_logo.png',
                    height: 22,
                    fit: BoxFit.contain,
                    errorBuilder: (_, __, ___) => Text(
                      S.appName,
                      style: AppTypography.caption.copyWith(
                        color: AppColors.textMuted,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  FutureBuilder<String>(
                    future: AppBuildInfo.versionWithBuild(),
                    builder: (_, snap) => Text(
                      'v${snap.data ?? '…'}',
                      style: AppTypography.caption.copyWith(
                        color: AppColors.textMuted,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
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
