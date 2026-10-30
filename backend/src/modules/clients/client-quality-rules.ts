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

export function applyLatinUpperName(raw: string): { ok: true; name: string } | { ok: false; message: string } {
  const name = toLatinUppercase(raw);
  if (name.length < 3) {
    return { ok: false, message: "Название должно содержать не менее 3 символов (заглавные латинские буквы)." };
  }
  const leftover = leftoverNonLatinLetters(name);
  if (leftover) {
    return {
      ok: false,
      message: `Название должно быть написано только заглавными латинскими буквами. Недопустимые символы: «${leftover.slice(0, 24)}». Кириллица автоматически переводится в латиницу, другие алфавиты не принимаются.`
    };
  }
  return { ok: true, name };
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
  return peer.id != null ? `клиент #${peer.id}` : "другая строка этого файла";
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
        message: `Телефон повторяется (${phone}) — ${peerLabel(hit)}. Телефон каждого клиента должен быть уникальным.`
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
        message: `ИНН повторяется («${String(candidate.inn).trim()}») — ${peerLabel(hit)}.`
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
        message: `ПИНФЛ повторяется («${String(candidate.pinfl).trim()}») — ${peerLabel(hit)}.`
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
          message: `В радиусе 100 м есть клиент с похожим названием: «${p.name}» (${Math.round(meters)} м, ${peerLabel(p)}). Укажите другую точку или более точное название.`
        };
      }
    }
  }

  return null;
}
