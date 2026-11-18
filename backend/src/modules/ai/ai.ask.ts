/** AI Assistant — POST /ai/ask asosiy oqim. */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AI_CONFIG } from "./ai.config";
import { planFromLlmProposal, planFromQuestion, planPeriod } from "./ai.plan";
import { tashkentToday } from "./ai.dates";
import { runTool } from "./ai.exec";
import { signToken, newJti, type TokenPayload } from "./ai.token";
import { auditAi } from "./ai.audit";
import { answerForEmptyPlan, answerFromRun } from "./ai.answer";
import { getTool, listCapabilities } from "./ai.registry";
import { gateWrite, loadPermissionState, type PermissionState } from "./ai.guard";
import { ALL_INTENT_NAMES } from "./ai.intent";
import { proposePlanFromLlm } from "./ai.llm";
import type { AiActor, AiAnswer, AiDenied, AiTableResult, AiToolRun } from "./ai.types";

export async function handleAiAsk(input: {
  app: FastifyInstance;
  request: FastifyRequest;
  reply: FastifyReply;
  actor: AiActor;
  question: string;
  exportFormat?: "xlsx" | "csv";
  bad: (status: number, code: string, message?: string) => unknown;
}): Promise<unknown> {
  const { app, request: _request, reply, actor, question, exportFormat, bad } = input;
  const permState = await loadPermissionState(actor);
  const startedAt = Date.now();
  const today = tashkentToday();
  const q = question;
  let built = planFromQuestion(q, today);
  let nluProvider: string | undefined;
  try {
    const llm = await proposePlanFromLlm({
      tenantId: actor.tenantId,
      question: q,
      today,
      intentCatalog: [...ALL_INTENT_NAMES]
    });
    if (llm) {
      const fromLlm = planFromLlmProposal(q, llm, today);
      if (fromLlm && (fromLlm.plan.calls.length > 0 || fromLlm.plan.missing.length > 0)) {
        built = fromLlm;
        nluProvider = llm.providerName;
      }
    }
  } catch {
    // LLM ixtiyoriy — rules qoladi
  }
  const denied: AiDenied[] = [];

  if (built.write) {
    return handleWriteAsk({ actor, reply, bad, built, denied, startedAt, permState });
  }

  const calls = built.plan.calls;
  if (!calls.length) {
    const answer = answerForEmptyPlan({
      intent: built.intent,
      missing: built.plan.missing,
      capabilities: listCapabilities(permState),
      durationMs: Date.now() - startedAt
    });
    void auditAi({
      actor,
      action: "ask",
      intent: built.intent,
      tools: ["help.capabilities"],
      status: built.intent === "help.capabilities" ? "ok" : "clarify",
      denied,
      detail: { nlu_source: built.plan.source, nlu_provider: nluProvider }
    });
    return reply.send(answer);
  }

  const runs: Array<{ tool: string; run: AiToolRun }> = [];
  for (const call of calls) {
    const tool = getTool(call.tool);
    if (!tool) continue;
    const run = await runTool(app, actor, tool, call.params);
    runs.push({ tool: tool.id, run });
    if (run.status === "error" || run.status === "denied") break;
  }
  const previewRows = AI_CONFIG.chatPreviewRows;
  const last = runs[runs.length - 1];
  const first = answerFromRun({
    actor,
    toolId: last?.tool ?? "",
    run:
      last?.run ??
      ({ tool: "", status: "error", statusCode: 404, message: "Buyruq bajarilmadi", durationMs: 0 } satisfies AiToolRun),
    intent: built.intent,
    slots: {},
    maxRows: previewRows
  });
  const groups: AiTableResult[] = runs.flatMap((r) => {
    if (r.run.status !== "ok" || !r.run.payload) return [];
    const g = answerFromRun({
      actor,
      toolId: r.tool,
      run: r.run,
      intent: built.intent,
      slots: {},
      maxRows: previewRows
    }).groups?.[0];
    if (!g) return [];
    return [
      {
        title: g.title,
        summary: g.summary ?? "",
        columns: g.columns,
        rows: g.rows,
        truncated: Boolean(g.truncated)
      }
    ];
  });
  const firstGroups: AiTableResult[] = (first.groups ?? []).map((g) => ({
    title: g.title,
    summary: g.summary ?? "",
    columns: g.columns,
    rows: g.rows,
    truncated: Boolean(g.truncated)
  }));
  const answer: AiAnswer = {
    title: first.title,
    intent: built.intent,
    summary: first.lines ?? [],
    lines: first.lines ?? [],
    groups: groups.length ? groups : firstGroups,
    actions: [],
    denied,
    meta: {
      tools: runs.map((r) => r.tool),
      durationMs: Date.now() - startedAt,
      period: planPeriod(built.plan),
      truncated: groups.some((g) => Boolean(g.truncated)) || Boolean(first.truncated)
    }
  };
  /* 10+ qator yoki truncated → avtomatik Excel (batafsil). */
  const wantExport = Boolean(exportFormat) || answer.meta.truncated || answer.groups.some((g) => g.rows.length >= previewRows);
  if (wantExport && runs.length) {
    if (actor.userId == null) return bad(401, "InvalidAccessUser");
    const fmt = exportFormat ?? "xlsx";
    const exportPayload: TokenPayload = {
      kind: "export",
      jti: newJti(),
      sub: actor.userId,
      tid: actor.tenantId,
      tool: "__export__",
      params: { fmt },
      calls: runs.map((r) => ({ tool: r.tool, params: {} })),
      iat: Date.now(),
      exp: Date.now() + AI_CONFIG.exportTtlSec * 1000
    };
    answer.export = {
      format: fmt,
      url: `/api/${encodeURIComponent(actor.tenantSlug)}/ai/exports/${signToken(exportPayload)}`,
      rows: answer.groups.reduce((n, g) => n + g.rows.length, 0),
      truncated: answer.meta.truncated
    };
  }
  void auditAi({
    actor,
    action: "ask",
    intent: built.intent,
    tools: runs.map((r) => r.tool),
    status: "ok",
    rows: answer.groups.reduce((n, g) => n + g.rows.length, 0),
    detail: { nlu_source: built.plan.source, nlu_provider: nluProvider }
  });
  return reply.send(answer);
}

async function handleWriteAsk(input: {
  actor: AiActor;
  reply: FastifyReply;
  bad: (status: number, code: string, message?: string) => unknown;
  built: ReturnType<typeof planFromQuestion>;
  denied: AiDenied[];
  startedAt: number;
  permState: PermissionState;
}): Promise<unknown> {
  const { actor, reply, bad, built, denied, startedAt, permState } = input;
  const plan = built.plan;
  if (plan.missing.length) {
    const answer: AiAnswer = {
      title: "Aniqlashtirish kerak",
      intent: built.intent,
      summary: plan.missing,
      lines: plan.missing,
      groups: [],
      actions: [],
      denied,
      meta: { tools: [], durationMs: Date.now() - startedAt, period: planPeriod(plan), truncated: false }
    };
    void auditAi({ actor, action: "ask", intent: built.intent, status: "clarify", denied });
    return reply.send(answer);
  }
  const call = plan.calls[0];
  if (!call) {
    return reply.send({
      title: "Buyruq topilmadi",
      intent: built.intent,
      summary: [],
      lines: ["Buyruq aniqlanmadi"],
      groups: [],
      actions: [],
      denied,
      meta: { tools: [], durationMs: Date.now() - startedAt, period: {}, truncated: false }
    } satisfies AiAnswer);
  }
  const tool = getTool(call.tool);
  if (!tool || tool.kind !== "write") return bad(400, "BadRequest", "Yozish buyruqi topilmadi");
  const allowed = gateWrite(tool, actor, permState);
  if (!allowed.allowed) {
    denied.push({ tool: tool.id, reason: allowed.reason ?? "Ruxsat yo‘q" });
    void auditAi({ actor, action: "ask", intent: built.intent, status: "denied", denied });
    return reply.send({
      title: "Ruxsat yo‘q",
      intent: built.intent,
      summary: [],
      lines: [allowed.reason ?? ""],
      groups: [],
      actions: [],
      denied,
      meta: { tools: [tool.id], durationMs: Date.now() - startedAt, period: {}, truncated: false }
    } satisfies AiAnswer);
  }
  if (actor.userId == null) return bad(401, "InvalidAccessUser");
  const tokenPayload: TokenPayload = {
    kind: "confirm",
    jti: newJti(),
    sub: actor.userId,
    tid: actor.tenantId,
    tool: tool.id,
    params: call.params,
    iat: Date.now(),
    exp: Date.now() + AI_CONFIG.confirmTtlSec * 1000
  };
  const token = signToken(tokenPayload);
  const preview = tool.preview ? tool.preview(call.params) : undefined;
  const answer: AiAnswer = {
    title: preview?.title || "Tasdiqlash kerak",
    intent: built.intent,
    summary: preview ? [preview.summary] : [],
    lines: preview ? [preview.summary] : [],
    groups: preview
      ? [{ title: preview.title, summary: preview.summary, columns: preview.columns, rows: preview.rows }]
      : [],
    actions: [
      {
        kind: "confirm",
        tool: tool.id,
        token,
        title: preview?.title || "Amalni tasdiqlang",
        summary: preview?.summary || "",
        columns: preview?.columns ?? [],
        rows: preview?.rows ?? [],
        expiresAt: new Date(tokenPayload.exp).toISOString()
      }
    ],
    denied,
    meta: { tools: [tool.id], durationMs: Date.now() - startedAt, period: planPeriod(plan), truncated: false }
  };
  void auditAi({ actor, action: "ask", intent: built.intent, tools: [tool.id], status: "preview" });
  return reply.send(answer);
}
