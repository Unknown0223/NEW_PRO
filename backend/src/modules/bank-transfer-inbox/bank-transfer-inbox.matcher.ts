/**
 * Domain: Bank Transfer Inbox (универсальное перечисление).
 * Matcher: bank_account > inn/pinfl > client_code. Имя — никогда не авто-матч.
 */

export type MatchField = "bank_account" | "inn" | "pinfl" | "client_code";

export type MatchCandidate = {
  client_id: number;
  match_field: MatchField;
  warehouse_id: number | null;
};

export type MatcherPayerInput = {
  payer_bank_account?: string | null;
  payer_inn?: string | null;
  payer_pinfl?: string | null;
  payer_client_code?: string | null;
  /** Игнорируется matcher'ом (запрет авто-матча по имени). */
  payer_name?: string | null;
};

export type MatcherClientRow = {
  id: number;
  warehouse_id: number | null;
  bank_account: string | null;
  inn: string | null;
  client_pinfl: string | null;
  client_code: string | null;
  is_active: boolean;
};

export type MatchResult =
  | { status: "unmatched"; candidates: []; match_field: null; matched_client_id: null }
  | {
      status: "matched";
      candidates: MatchCandidate[];
      match_field: MatchField;
      matched_client_id: number;
    }
  | {
      status: "ambiguous";
      candidates: MatchCandidate[];
      match_field: MatchField | null;
      matched_client_id: null;
    };

export function normalizeDigits(v: string | null | undefined): string | null {
  if (v == null) return null;
  const d = String(v).replace(/\D/g, "");
  if (!d || /^0+$/.test(d)) return null;
  return d;
}

export function normalizeAccount(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = String(v).replace(/\s+/g, "").trim().toUpperCase();
  return t.length > 0 ? t : null;
}

export function normalizeClientCode(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t.length > 0 ? t : null;
}

function collectByField(
  clients: MatcherClientRow[],
  field: MatchField,
  needle: string
): MatchCandidate[] {
  const out: MatchCandidate[] = [];
  for (const c of clients) {
    if (!c.is_active) continue;
    let hay: string | null = null;
    if (field === "bank_account") hay = normalizeAccount(c.bank_account);
    else if (field === "inn") hay = normalizeDigits(c.inn);
    else if (field === "pinfl") hay = normalizeDigits(c.client_pinfl);
    else hay = normalizeClientCode(c.client_code);
    if (hay != null && hay === needle) {
      out.push({ client_id: c.id, match_field: field, warehouse_id: c.warehouse_id });
    }
  }
  return out;
}

function finalizeCandidates(
  candidates: MatchCandidate[],
  field: MatchField
): MatchResult {
  if (candidates.length === 0) {
    return { status: "unmatched", candidates: [], match_field: null, matched_client_id: null };
  }
  const uniqueIds = [...new Set(candidates.map((c) => c.client_id))];
  if (uniqueIds.length > 1) {
    return {
      status: "ambiguous",
      candidates,
      match_field: field,
      matched_client_id: null
    };
  }
  const warehouses = [
    ...new Set(candidates.map((c) => c.warehouse_id).filter((w): w is number => w != null && w > 0))
  ];
  // Несколько складов среди кандидатов (кросс-филиал) — без авто-payment.
  if (warehouses.length > 1) {
    return {
      status: "ambiguous",
      candidates,
      match_field: field,
      matched_client_id: null
    };
  }
  return {
    status: "matched",
    candidates,
    match_field: field,
    matched_client_id: uniqueIds[0]!
  };
}

/**
 * Приоритет: bank_account → inn → pinfl → client_code.
 * Первое непустое поле плательщика, давшее ≥1 hit, останавливает поиск.
 * Имя клиента в матче не участвует.
 */
export function matchBankTransferPayer(
  payer: MatcherPayerInput,
  clients: MatcherClientRow[]
): MatchResult {
  const account = normalizeAccount(payer.payer_bank_account);
  if (account) {
    const hits = collectByField(clients, "bank_account", account);
    if (hits.length > 0) return finalizeCandidates(hits, "bank_account");
  }

  const inn = normalizeDigits(payer.payer_inn);
  if (inn) {
    const hits = collectByField(clients, "inn", inn);
    if (hits.length > 0) return finalizeCandidates(hits, "inn");
  }

  const pinfl = normalizeDigits(payer.payer_pinfl);
  if (pinfl) {
    const hits = collectByField(clients, "pinfl", pinfl);
    if (hits.length > 0) return finalizeCandidates(hits, "pinfl");
  }

  const code = normalizeClientCode(payer.payer_client_code);
  if (code) {
    const hits = collectByField(clients, "client_code", code);
    if (hits.length > 0) return finalizeCandidates(hits, "client_code");
  }

  return { status: "unmatched", candidates: [], match_field: null, matched_client_id: null };
}
