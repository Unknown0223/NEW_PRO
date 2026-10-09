/**
 * Yangi klient sifati: lotin bosh harf, telefon/INN/PINFL unikal, 100 m + o‘xshash nom.
 * Import va Telegram bot bir xil qoidalarni ishlatadi (sof funksiyalar).
 */

export const CLIENT_GEO_SIMILAR_NAME_RADIUS_M = 100;

const CYR_MAP: Record<string, string> = {
  а: "A",
  б: "B",
  в: "V",
  г: "G",
  д: "D",
  е: "E",
  ё: "YO",
  ж: "J",
  з: "Z",
  и: "I",
  й: "Y",
  к: "K",
  л: "L",
  м: "M",
  н: "N",
  о: "O",
  п: "P",
  р: "R",
  с: "S",
  т: "T",
  у: "U",
  ф: "F",
  х: "X",
  ц: "TS",
  ч: "CH",
  ш: "SH",
  щ: "SH",
  ъ: "'",
  ы: "I",
  ь: "",
  э: "E",
  ю: "YU",
  я: "YA",
  ғ: "G'",
  қ: "Q",
  ҳ: "H",
  ў: "O'",
  ң: "NG"
};

export type ClientQualityPeer = {
  id?: number;
  name: string;
  phoneDigits?: string | null;
  inn?: string | null;
  pinfl?: string | null;
  lat?: number | null;
  lon?: number | null;
};

export type ClientQualityIssueKind =
  | "latin_name"
  | "phone"
  | "inn"
  | "pinfl"
  | "geo_name";

export type ClientQualityIssue = {
  kind: ClientQualityIssueKind;
  message: string;
  otherId?: number;
  meters?: number;
  otherName?: string;
};

function mapCyrChar(ch: string): string {
  const lower = ch.toLocaleLowerCase("ru-RU");
  return CYR_MAP[lower] ?? ch;
}

/** Kiril → lotin, keyin bosh harf. Bo‘sh joylar yig‘iladi. */
export function toLatinUppercase(raw: string): string {
  const chars = Array.from(String(raw ?? ""));
  let out = "";
  for (const ch of chars) {
    out += mapCyrChar(ch);
  }
  return out
    .toLocaleUpperCase("en-US")
    .replace(/\s+/g, " ")
    .trim();
}

export function leftoverNonLatinLetters(latinUpper: string): string {
  return latinUpper.replace(/[A-Z0-9\s\-'.",/&()]+/g, "");
}

export function hasCyrillicLetters(raw: string): boolean {
  return /[\u0400-\u052F]/.test(raw);
}

export function hasLatinLowercase(raw: string): boolean {
  return /[a-z]/.test(raw);
}

function escHint(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function applyLatinUpperName(
  raw: string,
  label = "Nom"
): { ok: true; name: string } | { ok: false; message: string } {
  const original = String(raw ?? "").trim();
  const name = toLatinUppercase(original);
  if (name.length < 3) {
    return {
      ok: false,
      message: `${label} kamida 3 belgidan iborat bo‘lishi kerak (faqat lotin <b>BOSH HARF</b>).`
    };
  }
  const leftover = leftoverNonLatinLetters(name);
  if (leftover) {
    return {
      ok: false,
      message: `${label} faqat lotin harfda. Qabul qilinmagan belgi: «${escHint(leftover.slice(0, 24))}».`
    };
  }
  if (hasCyrillicLetters(original)) {
    return {
      ok: false,
      message:
        `${label} faqat <b>lotin</b> harfda yoziladi (kichik bo‘lsa avtomatik katta qilinadi).\n` +
        `Kiril qabul qilinmaydi.\n` +
        `To‘g‘risi: <code>${escHint(name)}</code>`
    };
  }
  return { ok: true, name };
}

export function applyPhone(raw: string): { ok: true; phone: string } | { ok: false; message: string } {
  const t = String(raw ?? "").trim();
  const digits = t.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) {
    return { ok: false, message: "Telefon <b>9–15 raqam</b> bo‘lishi kerak." };
  }
  return { ok: true, phone: t };
}

export function applyInn(raw: string): { ok: true; inn: string } | { ok: false; message: string } {
  const t = String(raw ?? "").trim();
  if (!t) return { ok: true, inn: "" };
  const d = t.replace(/\D/g, "");
  if (d.length !== 9) {
    return { ok: false, message: "INN/STIR <b>9 raqam</b> bo‘lishi kerak yoki o‘tkazib yuboring." };
  }
  return { ok: true, inn: d };
}

export function applyPinfl(raw: string): { ok: true; pinfl: string } | { ok: false; message: string } {
  const t = String(raw ?? "").trim();
  if (!t) return { ok: true, pinfl: "" };
  const d = t.replace(/\D/g, "");
  if (d.length !== 14) {
    return { ok: false, message: "PINFL <b>14 raqam</b> bo‘lishi kerak yoki o‘tkazib yuboring." };
  }
  return { ok: true, pinfl: d };
}

export function missingRequiredFields(d: {
  name?: string;
  address?: string;
  phone?: string;
  city?: string;
  lat?: number | null;
}): string[] {
  const miss: string[] = [];
  if (!d.name?.trim()) miss.push("Nomi");
  if (!d.address?.trim()) miss.push("Manzil");
  if (!d.phone?.trim()) miss.push("Telefon");
  if (!d.city?.trim()) miss.push("Shahar");
  if (d.lat == null) miss.push("GPS");
  return miss;
}

export function normalizeNameCompareKey(raw: string): string {
  return toLatinUppercase(raw).replace(/[^A-Z0-9]/g, "");
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array<number>(b.length + 1);
  const cur = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min((cur[j - 1] ?? 0) + 1, (prev[j] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j] ?? 0;
  }
  return prev[b.length] ?? 0;
}

/** Lotin-normalizatsiyadan keyin bir xil yoki juda yaqin nom. */
export function namesAreSimilar(a: string, b: string): boolean {
  const ka = normalizeNameCompareKey(a);
  const kb = normalizeNameCompareKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  if (ka.length >= 4 && kb.length >= 4 && (ka.includes(kb) || kb.includes(ka))) return true;
  const minLen = Math.min(ka.length, kb.length);
  if (minLen >= 5 && levenshtein(ka, kb) <= 2) return true;
  return false;
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

export function geoBoundingBox(lat: number, lon: number, radiusM: number): {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
} {
  const dLat = radiusM / 111_320;
  const cos = Math.cos((lat * Math.PI) / 180);
  const dLon = radiusM / (111_320 * Math.max(0.2, Math.abs(cos)));
  return {
    latMin: lat - dLat,
    latMax: lat + dLat,
    lonMin: lon - dLon,
    lonMax: lon + dLon
  };
}

function digitsOrNull(raw: string | null | undefined): string | null {
  const d = String(raw ?? "").replace(/\D/g, "");
  return d.length >= 7 ? d : null;
}

function identOrNull(raw: string | null | undefined): string | null {
  const t = String(raw ?? "").trim().toLocaleLowerCase("ru-RU");
  return t || null;
}

export function formatQualityIssue(issue: ClientQualityIssue): string {
  return issue.message;
}

function peerLabel(peer: ClientQualityPeer): string {
  return peer.id != null ? `klient #${peer.id}` : "shu fayldagi boshqa qator";
}

/**
 * Birinchi qoida buzilishi. Nom allaqachon lotin-upper bo‘lishi kutiladi
 * (`applyLatinUpperName` dan keyin).
 */
export function findClientQualityIssue(
  candidate: ClientQualityPeer,
  peers: ClientQualityPeer[]
): ClientQualityIssue | null {
  const phone = digitsOrNull(candidate.phoneDigits);
  if (phone) {
    const hit = peers.find((p) => digitsOrNull(p.phoneDigits) === phone);
    if (hit) {
      return {
        kind: "phone",
        otherId: hit.id,
        message: `Telefon takrorlanmoqda (${phone}) — ${peerLabel(hit)}. Har bir mijozning telefoni unikal bo‘lishi shart.`
      };
    }
  }

  const inn = identOrNull(candidate.inn);
  if (inn) {
    const hit = peers.find((p) => identOrNull(p.inn) === inn);
    if (hit) {
      return {
        kind: "inn",
        otherId: hit.id,
        message: `INN/STIR takrorlanmoqda («${String(candidate.inn).trim()}») — ${peerLabel(hit)}.`
      };
    }
  }

  const pinfl = identOrNull(candidate.pinfl);
  if (pinfl) {
    const hit = peers.find((p) => identOrNull(p.pinfl) === pinfl);
    if (hit) {
      return {
        kind: "pinfl",
        otherId: hit.id,
        message: `PINFL/JSHSHIR takrorlanmoqda («${String(candidate.pinfl).trim()}») — ${peerLabel(hit)}.`
      };
    }
  }

  const lat = candidate.lat;
  const lon = candidate.lon;
  if (lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon) && candidate.name) {
    for (const p of peers) {
      if (p.lat == null || p.lon == null) continue;
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) continue;
      if (!namesAreSimilar(candidate.name, p.name)) continue;
      const meters = haversineMeters(lat, lon, p.lat, p.lon);
      if (meters <= CLIENT_GEO_SIMILAR_NAME_RADIUS_M) {
        return {
          kind: "geo_name",
          otherId: p.id,
          meters: Math.round(meters),
          otherName: p.name,
          message: `100 m radiusda o‘xshash nomli mijoz bor: «${p.name}» (${Math.round(meters)} m, ${peerLabel(p)}). Boshqa nuqta yoki aniqroq nom kiriting.`
        };
      }
    }
  }

  return null;
}
