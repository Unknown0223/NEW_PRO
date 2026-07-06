/** Hodim / kontakt: ko‘rinishda faqat ism va familiya (ixtiyoriy otasining ismi). */

export type PersonNameParts = {
  first_name?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
  /** Backend `toFio`: familiya ism [sharif] */
  fio?: string | null;
  name?: string | null;
};

/** `fio` qatorini backend tartibida (familiya ism sharif) ajratadi. */
export function parseStoredFio(fio: string): { first: string; last: string; middle: string } {
  const parts = fio.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "", middle: "" };
  if (parts.length === 1) return { first: parts[0]!, last: "", middle: "" };
  return {
    last: parts[0] ?? "",
    first: parts[1] ?? "",
    middle: parts.slice(2).join(" ")
  };
}

/** Standart ko‘rinish: «Ism Familiya [Sharif]». */
export function formatPersonDisplayName(p: PersonNameParts): string {
  const first = (p.first_name ?? "").trim();
  const last = (p.last_name ?? "").trim();
  const middle = (p.middle_name ?? "").trim();
  if (first || last) {
    return [first, last, middle].filter(Boolean).join(" ");
  }
  const raw = (p.fio ?? p.name ?? "").trim();
  if (!raw) return "";
  const parsed = parseStoredFio(raw);
  return [parsed.first, parsed.last, parsed.middle].filter(Boolean).join(" ") || raw;
}

export function personDisplayInitials(p: PersonNameParts): string {
  const display = formatPersonDisplayName(p);
  const parts = display.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  if (parts.length === 1) return (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
  return "?";
}

/** Dropdown / qidiruv: ko‘rinishda faqat FIO; qidiruv matniga kod/login qo‘shiladi. */
export function staffPickerDisplayName(
  s: PersonNameParts & { login?: string | null; id?: number }
): string {
  const n = formatPersonDisplayName(s);
  if (n) return n;
  const login = (s.login ?? "").trim();
  if (login) return login;
  if (s.id != null) return `#${s.id}`;
  return "—";
}

export function staffPickerSearchText(
  s: PersonNameParts & { code?: string | null; login?: string | null; id?: number }
): string {
  return [
    formatPersonDisplayName(s),
    s.code,
    s.login,
    s.id != null ? String(s.id) : null
  ]
    .filter((x) => x != null && String(x).trim())
    .join(" ");
}
