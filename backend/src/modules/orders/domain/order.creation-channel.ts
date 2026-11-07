export type OrderCreationChannel = "web" | "mobile";

/** Agent / ekspeditor ilovadan; qolgan rollar (operator, admin, …) — veb. */
export function orderCreationChannelFromRole(role: string | null | undefined): OrderCreationChannel {
  const r = (role ?? "").toLowerCase();
  if (r.includes("agent") || r.includes("expeditor")) return "mobile";
  return "web";
}

export function resolveOrderCreationChannel(opts: {
  explicit?: OrderCreationChannel | null;
  viewerRole?: string | null;
}): OrderCreationChannel {
  if (opts.explicit === "mobile" || opts.explicit === "web") return opts.explicit;
  return orderCreationChannelFromRole(opts.viewerRole);
}

export function normalizeStoredCreationChannel(
  raw: string | null | undefined,
  fallback: OrderCreationChannel
): OrderCreationChannel {
  if (raw === "mobile" || raw === "web") return raw;
  return fallback;
}

/**
 * Status-logdagi birinchi foydalanuvchi ko‘pincha keyingi operator (bekor/tasdiq),
 * yaratuvchi emas. Saqlangan kanal yo‘q bo‘lsa agent roli ishonchliroq.
 */
export function inferListCreationChannel(opts: {
  firstLogRole?: string | null;
  agentRole?: string | null;
}): OrderCreationChannel {
  if (orderCreationChannelFromRole(opts.agentRole) === "mobile") return "mobile";
  if (orderCreationChannelFromRole(opts.firstLogRole) === "mobile") return "mobile";
  return "web";
}

function trimLabel(value: string | null | undefined): string | null {
  const t = value?.trim();
  return t ? t : null;
}

/**
 * «Кто создал»: manba ismi → mobil agent → yaratish paytidagi jurnal → agent.
 * Keyinroq meta/status tahriri yaratuvchi hisoblanmaydi.
 */
export function resolveOrderCreatedByDisplay(opts: {
  sourceCreatedBy?: string | null;
  creationChannel?: string | null;
  agentName?: string | null;
  agentLogin?: string | null;
  firstLogName?: string | null;
  firstLogLogin?: string | null;
  firstLogAtMs?: number | null;
  orderCreatedAtMs?: number | null;
  contemporaneousWindowMs?: number;
}): string | null {
  const fromSource = trimLabel(opts.sourceCreatedBy);
  if (fromSource) return fromSource;

  const agentLabel = trimLabel(opts.agentName) || trimLabel(opts.agentLogin);
  const channel = normalizeStoredCreationChannel(opts.creationChannel, "web");
  if (channel === "mobile" && agentLabel) return agentLabel;

  const windowMs = opts.contemporaneousWindowMs ?? 5 * 60 * 1000;
  const createdAt = opts.orderCreatedAtMs;
  const logAt = opts.firstLogAtMs;
  const logIsContemporaneous =
    createdAt != null &&
    logAt != null &&
    Number.isFinite(createdAt) &&
    Number.isFinite(logAt) &&
    logAt >= createdAt - windowMs &&
    logAt <= createdAt + windowMs;
  if (logIsContemporaneous) {
    const fromLog = trimLabel(opts.firstLogName) || trimLabel(opts.firstLogLogin);
    if (fromLog) return fromLog;
  }

  return agentLabel;
}
