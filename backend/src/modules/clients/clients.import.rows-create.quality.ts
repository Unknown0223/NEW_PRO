import {
  applyLatinUpperName,
  findClientQualityIssue,
  type ClientQualityPeer
} from "./client-quality-rules";

export type ImportQualityPeerRow = ClientQualityPeer & { id: number };

export function peerFromImportExisting(row: {
  id: number;
  name: string;
  phone_normalized: string | null;
  inn: string | null;
  client_pinfl: string | null;
  latitude: unknown;
  longitude: unknown;
}): ImportQualityPeerRow {
  const lat = row.latitude == null ? null : Number(row.latitude);
  const lon = row.longitude == null ? null : Number(row.longitude);
  return {
    id: row.id,
    name: row.name,
    phoneDigits: row.phone_normalized,
    inn: row.inn,
    pinfl: row.client_pinfl,
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null
  };
}

export function latinNameOrImportError(raw: string): { ok: true; name: string } | { ok: false; message: string } {
  return applyLatinUpperName(raw);
}

export function importRowQualityError(
  candidate: ClientQualityPeer,
  peers: ClientQualityPeer[]
): string | null {
  const issue = findClientQualityIssue(candidate, peers);
  return issue?.message ?? null;
}

export function skipReasonForNewImportRow(
  candidate: ClientQualityPeer,
  peers: ClientQualityPeer[],
  dupKey: string | null,
  seenDuplicateKeys: Set<string>,
  duplicateKeyFields: string[]
): { kind: "dup" | "quality"; message: string } | null {
  if (dupKey != null && seenDuplicateKeys.has(dupKey)) {
    return {
      kind: "dup",
      message: `dublikat (kalit: ${duplicateKeyFields.join(", ") || "kod"}) — o‘tkazib yuborildi.`
    };
  }
  const qErr = importRowQualityError(candidate, peers);
  if (qErr) return { kind: "quality", message: qErr };
  return null;
}
