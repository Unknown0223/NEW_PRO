/**
 * Davomat belgi usullari (foto/video/kiosk/terminal) — tenant + rol matritsasi.
 */

export type PunchMethodFlags = {
  photo: boolean;
  video: boolean;
  kiosk: boolean;
  terminal: boolean;
};

export type PunchModesSettings = {
  methods: PunchMethodFlags;
  /** Rol uchun to‘liq/qisman override; bo‘sh kalitlar `methods` dan meros. */
  byRole: Record<string, Partial<PunchMethodFlags>>;
};

export const DEFAULT_PUNCH_METHOD_FLAGS: PunchMethodFlags = {
  photo: true,
  video: true,
  /** Yoqilganda faqat admin/supervisor / kioskLeaderIds ko‘radi. */
  kiosk: true,
  terminal: true
};

export const DEFAULT_PUNCH_MODES_SETTINGS: PunchModesSettings = {
  methods: { ...DEFAULT_PUNCH_METHOD_FLAGS },
  byRole: {}
};

export type ResolvedPunchModes = PunchMethodFlags & {
  mobileAny: boolean;
  allowedMethods: Array<"photo" | "video" | "kiosk" | "terminal">;
};

export type AttendancePunchSource = "mobile_photo" | "mobile_video" | "kiosk" | "terminal";

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function punchSourceToMethod(source: AttendancePunchSource): keyof PunchMethodFlags {
  if (source === "mobile_video") return "video";
  if (source === "kiosk") return "kiosk";
  if (source === "terminal") return "terminal";
  return "photo";
}

function normalizePunchMethodFlags(raw: unknown, fallback: PunchMethodFlags): PunchMethodFlags {
  const o = asObj(raw);
  return {
    photo: typeof o.photo === "boolean" ? o.photo : fallback.photo,
    video: typeof o.video === "boolean" ? o.video : fallback.video,
    kiosk: typeof o.kiosk === "boolean" ? o.kiosk : fallback.kiosk,
    terminal: typeof o.terminal === "boolean" ? o.terminal : fallback.terminal
  };
}

export function normalizePunchModesSettings(raw: unknown): PunchModesSettings {
  const root = asObj(raw);
  const methods = normalizePunchMethodFlags(root.methods, DEFAULT_PUNCH_METHOD_FLAGS);
  const byRole: Record<string, Partial<PunchMethodFlags>> = {};
  for (const [roleRaw, v] of Object.entries(asObj(root.byRole))) {
    const role = roleRaw.trim().toLowerCase();
    if (!role) continue;
    const o = asObj(v);
    const partial: Partial<PunchMethodFlags> = {};
    if (typeof o.photo === "boolean") partial.photo = o.photo;
    if (typeof o.video === "boolean") partial.video = o.video;
    if (typeof o.kiosk === "boolean") partial.kiosk = o.kiosk;
    if (typeof o.terminal === "boolean") partial.terminal = o.terminal;
    if (Object.keys(partial).length > 0) byRole[role] = partial;
  }
  return { methods, byRole };
}

/**
 * Rol + kiosk rahbar ro‘yxati bo‘yicha ruxsat etilgan belgi usullari.
 * `byRole[role]` bo‘lsa — berilgan kalitlar override, qolganlari `methods` dan.
 */
export function resolvePunchModesForRole(
  punchModes: PunchModesSettings,
  role: string | null | undefined,
  opts?: {
    userId?: number;
    kioskLeaderIds?: number[];
    /** Video parametrlari sahifasidagi global o‘chirish. */
    punchVideoEnabled?: boolean;
    /** Per-user video override (`enabled: false` → video yopiladi). */
    videoUserOverrideEnabled?: boolean | null;
    /**
     * true (default): kiosk faqat rahbarlarga. Maqsad xodimni tekshirganda false —
     * rol matritsasidagi kiosk bayrog‘i saqlanadi.
     */
    applyKioskLeaderGate?: boolean;
  }
): ResolvedPunchModes {
  const roleKey = String(role ?? "")
    .trim()
    .toLowerCase();
  const override = roleKey ? punchModes.byRole[roleKey] : undefined;
  const base = punchModes.methods;
  let photo = override && typeof override.photo === "boolean" ? override.photo : base.photo;
  let video = override && typeof override.video === "boolean" ? override.video : base.video;
  let kiosk = override && typeof override.kiosk === "boolean" ? override.kiosk : base.kiosk;
  let terminal = override && typeof override.terminal === "boolean" ? override.terminal : base.terminal;

  if (opts?.punchVideoEnabled === false) video = false;
  if (opts?.videoUserOverrideEnabled === false) video = false;

  const userId = opts?.userId;
  const leaders = opts?.kioskLeaderIds ?? [];
  const applyGate = opts?.applyKioskLeaderGate !== false;
  if (applyGate && kiosk) {
    const isKioskLeader =
      roleKey === "admin" ||
      roleKey === "supervisor" ||
      (typeof userId === "number" && userId > 0 && leaders.includes(userId));
    if (!isKioskLeader) kiosk = false;
  }

  const allowedMethods: ResolvedPunchModes["allowedMethods"] = [];
  if (photo) allowedMethods.push("photo");
  if (video) allowedMethods.push("video");
  if (kiosk) allowedMethods.push("kiosk");
  if (terminal) allowedMethods.push("terminal");

  return {
    photo,
    video,
    kiosk,
    terminal,
    mobileAny: photo || video || kiosk,
    allowedMethods
  };
}

export function assertPunchSourceAllowed(
  modes: ResolvedPunchModes,
  source: AttendancePunchSource
): { ok: true } | { ok: false; code: "METHOD_NOT_ALLOWED"; message: string } {
  const method = punchSourceToMethod(source);
  if (modes[method]) return { ok: true };
  return {
    ok: false,
    code: "METHOD_NOT_ALLOWED",
    message: "Для вашей роли этот способ отметки отключён"
  };
}
