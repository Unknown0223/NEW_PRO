class ProfileShortcut {
  final String id;
  final String label;
  final bool enabled;
  final String? badge;
  const ProfileShortcut({
    required this.id,
    required this.label,
    required this.enabled,
    this.badge,
  });
}

/// Wave 2: Ulashish yoqilgan.
ProfileShortcut ulashishShortcutWave1() {
  return const ProfileShortcut(
    id: 'ulashish',
    label: 'Ulashish',
    enabled: true,
    badge: null,
  );
}
