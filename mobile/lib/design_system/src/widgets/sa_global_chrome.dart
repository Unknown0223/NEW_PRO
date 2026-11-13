import 'package:flutter/material.dart';

import '../tokens/sa_colors.dart';
import 'sa_brand.dart';
import 'sa_motion.dart';

/// Shablon `GlobalChrome` top bar — hamburger | brand·rol | sync / tezkor.
class SaGlobalChromeBar extends StatelessWidget implements PreferredSizeWidget {
  final String roleLabel;
  final VoidCallback? onMenu;
  final VoidCallback? onSync;
  final VoidCallback? onQuick;
  final bool syncReady;
  final String? syncClock;
  final int? menuBadge;

  const SaGlobalChromeBar({
    super.key,
    required this.roleLabel,
    this.onMenu,
    this.onSync,
    this.onQuick,
    this.syncReady = true,
    this.syncClock,
    this.menuBadge,
  });

  @override
  Size get preferredSize => const Size.fromHeight(52);

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      elevation: 0,
      child: Container(
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: Color(0xFFE4E8EF))),
        ),
        child: SafeArea(
          bottom: false,
          child: SizedBox(
            height: 44,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Row(
                children: [
                  SaPressable(
                    pressedScale: 0.9,
                    borderRadius: BorderRadius.circular(10),
                    onTap: onMenu,
                    child: SizedBox(
                      width: 36,
                      height: 36,
                      child: Stack(
                        clipBehavior: Clip.none,
                        alignment: Alignment.center,
                        children: [
                          const Icon(Icons.menu_rounded, size: 22, color: Color(0xFF0E1420)),
                          if (menuBadge != null && menuBadge! > 0)
                            Positioned(
                              right: 2,
                              top: 2,
                              child: Container(
                                width: 8,
                                height: 8,
                                decoration: const BoxDecoration(
                                  color: Color(0xFFE0574B),
                                  shape: BoxShape.circle,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  const SaBrandWordmark(size: 13),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      '· $roleLabel',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: Color(0xFF677386),
                      ),
                    ),
                  ),
                  const Spacer(),
                  if (syncClock != null) ...[
                    Text(
                      syncClock!,
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        fontFamily: 'monospace',
                        color: Color(0xFF677386),
                      ),
                    ),
                    const SizedBox(width: 4),
                  ],
                  _ChromeIcon(
                    icon: Icons.sync_rounded,
                    onTap: onSync,
                    badge: syncReady,
                    badgeColor: const Color(0xFF22B573),
                  ),
                  _ChromeIcon(
                    icon: Icons.apps_rounded,
                    onTap: onQuick,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ChromeIcon extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;
  final bool badge;
  final Color badgeColor;

  const _ChromeIcon({
    required this.icon,
    this.onTap,
    this.badge = false,
    this.badgeColor = SaColors.agent,
  });

  @override
  Widget build(BuildContext context) {
    return SaPressable(
      pressedScale: 0.9,
      borderRadius: BorderRadius.circular(10),
      onTap: onTap,
      child: SizedBox(
        width: 36,
        height: 36,
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.center,
          children: [
            Icon(icon, size: 20, color: const Color(0xFF0E1420)),
            if (badge)
              Positioned(
                right: 6,
                top: 6,
                child: Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(
                    color: badgeColor,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 1),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
