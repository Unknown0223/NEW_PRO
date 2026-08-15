/**
 * Qurilma/brauzer IANA vaqt mintaqalari — `Intl.supportedValuesOf('timeZone')`.
 * Windows/Android stilidagi yorliq: `(UTC+05:00) Asia/Tashkent`
 */

export type IanaTimezoneOption = {
  id: string;
  /** Ro‘yxatdagi ko‘rinish */
  label: string;
  /** Qidiruv uchun */
  search: string;
  offsetMinutes: number;
};

function offsetMinutesForZone(timeZone: string, instant = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
      hour: "2-digit",
      hourCycle: "h23"
    }).formatToParts(instant);
    const tzName = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    const m = tzName.match(/(?:GMT|UTC)([+-])(\d{1,2})(?::(\d{2}))?/i);
    if (m) {
      const sign = m[1] === "-" ? -1 : 1;
      const h = Number(m[2]);
      const mins = m[3] != null ? Number(m[3]) : 0;
      if (Number.isFinite(h) && Number.isFinite(mins)) return sign * (h * 60 + mins);
    }
  } catch {
    /* ignore */
  }
  return 0;
}

export function formatUtcOffsetLabel(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function cityLabel(id: string): string {
  if (id === "UTC" || id === "Etc/UTC") return "UTC";
  const slash = id.lastIndexOf("/");
  const city = (slash >= 0 ? id.slice(slash + 1) : id).replace(/_/g, " ");
  const region = slash >= 0 ? id.slice(0, slash).replace(/_/g, " ") : "";
  return region ? `${city} (${region})` : city;
}

/** Brauzer qo‘llab-quvvatlaydigan barcha IANA mintaqalar (standart qurilma ro‘yxati). */
export function listDeviceIanaTimezones(instant = new Date()): IanaTimezoneOption[] {
  let ids: string[] = [];
  try {
    if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
      ids = (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf(
        "timeZone"
      );
    }
  } catch {
    ids = [];
  }
  if (!ids.length) {
    ids = [
      "Asia/Tashkent",
      "Asia/Samarkand",
      "Asia/Almaty",
      "Asia/Bishkek",
      "Asia/Dushanbe",
      "Asia/Ashgabat",
      "Asia/Dubai",
      "Europe/Moscow",
      "Europe/Istanbul",
      "UTC"
    ];
  }

  const out: IanaTimezoneOption[] = ids.map((id) => {
    const offsetMinutes = offsetMinutesForZone(id, instant);
    const off = formatUtcOffsetLabel(offsetMinutes);
    const city = cityLabel(id);
    const label = `(${off}) ${city}`;
    return {
      id,
      label,
      search: `${id} ${city} ${off}`.toLowerCase(),
      offsetMinutes
    };
  });

  out.sort((a, b) => {
    if (a.offsetMinutes !== b.offsetMinutes) return a.offsetMinutes - b.offsetMinutes;
    return a.id.localeCompare(b.id);
  });
  return out;
}

export function detectDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tashkent";
  } catch {
    return "Asia/Tashkent";
  }
}

/** Orqaga moslik — eski importlar. */
export type TenantTimezoneOption = {
  id: string;
  label: string;
  utc_offset_hours: number;
};

export function toTenantTimezoneOptions(list: IanaTimezoneOption[]): TenantTimezoneOption[] {
  return list.map((o) => ({
    id: o.id,
    label: o.label,
    utc_offset_hours: o.offsetMinutes / 60
  }));
}
