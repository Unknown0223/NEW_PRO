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
