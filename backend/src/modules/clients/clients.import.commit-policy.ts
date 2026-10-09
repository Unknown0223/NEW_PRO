/** Import yakuni: xato bo‘lsa avval yozmasdan foydalanuvchi tanlovi. */

export type ClientImportCommitDecision = "accept_valid" | "reject_all";

export type ClientImportRowIssue = {
  excelRow: number;
  kind: "error" | "duplicate";
  message: string;
  /** Import kalitlari (name, inn, import_agent_1, …) — UI qizil ustunlar uchun */
  fields: string[];
};

export type ClientImportDecisionPreview = {
  validCount: number;
  errorCount: number;
  duplicateCount: number;
  /** Qisqa ro‘yxat (UI da max 5 ko‘rsatiladi) */
  errorSamples: string[];
  totalErrorMessages: number;
  rowIssues: ClientImportRowIssue[];
};

export function decideImportWriteAction(input: {
  errorCount: number;
  validCount: number;
  commitDecision?: ClientImportCommitDecision | null;
}): "write" | "ask" | "reject" {
  if (input.commitDecision === "reject_all") return "reject";
  if (input.errorCount <= 0) return "write";
  if (input.commitDecision === "accept_valid") return "write";
  if (input.validCount > 0) return "ask";
  return "reject";
}

export function buildImportDecisionPreview(input: {
  validCount: number;
  issues: ClientImportRowIssue[];
  sampleLimit?: number;
  rowIssuesLimit?: number;
}): ClientImportDecisionPreview {
  const sampleLimit = input.sampleLimit ?? 5;
  const rowIssuesLimit = input.rowIssuesLimit ?? 2500;
  const errorIssues = input.issues.filter((i) => i.kind === "error" || i.kind === "duplicate");
  const msgs = errorIssues.map((i) => `Строка ${i.excelRow}: ${i.message}`);
  return {
    validCount: input.validCount,
    errorCount: errorIssues.filter((i) => i.kind === "error").length,
    duplicateCount: errorIssues.filter((i) => i.kind === "duplicate").length,
    errorSamples: msgs.slice(0, sampleLimit),
    totalErrorMessages: msgs.length,
    rowIssues: errorIssues.slice(0, rowIssuesLimit)
  };
}
