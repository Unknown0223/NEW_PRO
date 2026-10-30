export function normalizeAgentLookupKey(raw: string): string {
  return raw.trim().replace(/\s+/g, "").toUpperCase();
}

export function excelAgentMatchesCard(
  excelCode: string,
  cardCode: string | null | undefined,
  cardLogin: string | null | undefined
): boolean {
  const excel = normalizeAgentLookupKey(excelCode);
  if (!excel) return true;
  const code = normalizeAgentLookupKey(cardCode ?? "");
  const login = normalizeAgentLookupKey(cardLogin ?? "");
  return (Boolean(code) && excel === code) || (Boolean(login) && excel === login);
}

export type PickOpeningBalanceAgentInput = {
  excelAgentId: number | null;
  cardAgentId: number | null;
  excelCode: string;
};

export type PickOpeningBalanceAgentResult =
  | { ok: true; agentId: number; warning: string | null; source: "excel" | "card" }
  | { ok: false; error: "NO_AGENT" };

/** Excel agent (if found) wins for the ledger; otherwise card agent. */
export function pickOpeningBalanceAgent(
  input: PickOpeningBalanceAgentInput
): PickOpeningBalanceAgentResult {
  if (input.excelAgentId != null && input.excelAgentId > 0) {
    return { ok: true, agentId: input.excelAgentId, warning: null, source: "excel" };
  }
  if (input.cardAgentId != null && input.cardAgentId > 0) {
    const code = input.excelCode.trim();
    return {
      ok: true,
      agentId: input.cardAgentId,
      warning: code
        ? `код агента Excel «${code}» не найден в системе — принят агент из карточки`
        : null,
      source: "card"
    };
  }
  return { ok: false, error: "NO_AGENT" };
}
