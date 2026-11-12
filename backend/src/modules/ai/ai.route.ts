/**
 * AI Assistant — HTTP marshrutlar.
 *
 * POST /api/:slug/ai/ask        — savol → plan → bajarish (yoki preview token)
 * POST /api/:slug/ai/confirm    — bir martalik token orqali amalni bajarish
 * GET  /api/:slug/ai/capabilities — foydalanuvchiga ruxsat berilgan tool’lar
 * GET  /api/:slug/ai/examples   — misol savollar
 * GET  /api/:slug/ai/exports/:token — xlsx/csv faylni yuklab olish
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { ensureTenantContext } from "../../lib/tenant-context";
import { sendApiError } from "../../lib/api-error";
import { jwtAccessVerify, getAccessUser } from "../../modules/auth/auth.prehandlers";
import { AI_CONFIG } from "./ai.config";
import { planFromQuestion, planPeriod } from "./ai.plan";
import { tashkentToday } from "./ai.dates";
import { runTool } from "./ai.exec";
import { handleConfirm } from "./ai.confirm";
import { signToken, newJti, verifyToken, tokenBelongsTo, type TokenPayload } from "./ai.token";
import { claimOnce } from "./ai.store";
import { buildCsv, buildXlsx, exportFilename } from "./ai.export";
import { auditAi } from "./ai.audit";
import { answerFromRun } from "./ai.answer";
import { getTool, listCapabilities, AI_EXAMPLES } from "./ai.registry";
import { gateWrite, loadPermissionState } from "./ai.guard";
import type { AiActor, AiAnswer, AiDenied, AiTableResult, AiToolRun } from "./ai.types";

const AskBody = z.object({
  question: z.string().trim().min(1).max(1000).optional(),
  exportFormat: z.enum(["xlsx", "csv"]).optional()
});

const ConfirmBody = z.object({ token: z.string().min(1) });

function actorOf(request: FastifyRequest): AiActor | null {
  const user = getAccessUser(request);
  const sub = Number(user.sub);
  if (!Number.isFinite(sub) || sub < 1) return null;
  return {
    userId: sub,
    tenantId: user.tenantId,
    tenantSlug: user.tenantSlug ?? (request.params as { slug: string }).slug,
    role: user.role,
    login: user.login,
    authorization: (request.headers.authorization as string) ?? ""
  };
}

function bad(reply: FastifyReply, request: FastifyRequest, status: number, code: string, message?: string) {
  return sendApiError(reply, request, status, code, message);
}

export async function registerAiRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/api/:slug/ai/ask",
    { preHandler: [jwtAccessVerify] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const actor = actorOf(request);
      if (!actor) return bad(reply, request, 401, "InvalidAccessUser");
      const parsed = AskBody.safeParse(request.body);
      if (!parsed.success) {
        return bad(reply, request, 400, "ValidationError", "Savol maydoni kerak");
      }
      const { question, exportFormat } = parsed.data;
      const startedAt = Date.now();
      const built = planFromQuestion(question ?? "", tashkentToday());
      const denied: AiDenied[] = [];

      if (built.write) {
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
          const answer: AiAnswer = {
            title: "Buyruq topilmadi",
            intent: built.intent,
            summary: [],
            lines: ["Buyruq aniqlanmadi"],
            groups: [],
            actions: [],
            denied,
            meta: { tools: [], durationMs: Date.now() - startedAt, period: {}, truncated: false }
          };
          return reply.send(answer);
        }
        const tool = getTool(call.tool);
        if (!tool || tool.kind !== "write") {
          return bad(reply, request, 400, "BadRequest", "Yozish buyruqi topilmadi");
        }
        const state = await loadPermissionState(actor);
        const allowed = gateWrite(tool, actor, state);
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
          });
        }
        if (actor.userId == null) return bad(reply, request, 401, "InvalidAccessUser");
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

      // Read intents — bajarish.
      const calls = built.plan.calls;
      const runs: Array<{ tool: string; run: AiToolRun }> = [];
      for (const call of calls) {
        const tool = getTool(call.tool);
        if (!tool) continue;
        const run = await runTool(app, actor, tool, call.params);
        runs.push({ tool: tool.id, run });
        if (run.status === "error" || run.status === "denied") break;
      }
      const last = runs[runs.length - 1];
      const first = answerFromRun({
        actor,
        toolId: last?.tool ?? "",
        run: last?.run ?? { tool: "", status: "error", statusCode: 404, message: "Buyruq bajarilmadi", durationMs: 0 },
        intent: built.intent,
        slots: {}
      });
      const groups: AiTableResult[] = runs.flatMap((r) => {
        if (r.run.status !== "ok" || !r.run.payload) return [];
        const g = answerFromRun({ actor, toolId: r.tool, run: r.run, intent: built.intent, slots: {} }).groups?.[0];
        if (!g) return [];
        return [
          {
            title: g.title,
            summary: g.summary ?? "",
            columns: g.columns,
            rows: g.rows,
            truncated: false
          }
        ];
      });
      const firstGroups: AiTableResult[] = (first.groups ?? []).map((g) => ({
        title: g.title,
        summary: g.summary ?? "",
        columns: g.columns,
        rows: g.rows,
        truncated: false
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
          truncated: groups.some((g) => Boolean(g.truncated))
        }
      };
      if (exportFormat && runs.length) {
        if (actor.userId == null) return bad(reply, request, 401, "InvalidAccessUser");
        const exportPayload: TokenPayload = {
          kind: "export",
          jti: newJti(),
          sub: actor.userId,
          tid: actor.tenantId,
          tool: "__export__",
          params: { fmt: exportFormat },
          calls: runs.map((r) => ({ tool: r.tool, params: {} })),
          iat: Date.now(),
          exp: Date.now() + AI_CONFIG.exportTtlSec * 1000
        };
        answer.export = {
          format: exportFormat,
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
        rows: answer.groups.reduce((n, g) => n + g.rows.length, 0)
      });
      return reply.send(answer);
    }
  );

  app.post(
    "/api/:slug/ai/confirm",
    { preHandler: [jwtAccessVerify] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const actor = actorOf(request);
      if (!actor) return bad(reply, request, 401, "InvalidAccessUser");
      const parsed = ConfirmBody.safeParse(request.body);
      if (!parsed.success) return bad(reply, request, 400, "ValidationError", "Token kerak");
      const { answer, denied } = await handleConfirm(app, actor, parsed.data);
      return reply.send(answer);
    }
  );

  app.get(
    "/api/:slug/ai/capabilities",
    { preHandler: [jwtAccessVerify] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const actor = actorOf(request);
      if (!actor) return bad(reply, request, 401, "InvalidAccessUser");
      const state = await loadPermissionState(actor);
      return reply.send({ capabilities: listCapabilities(state), writeEnabled: AI_CONFIG.writeEnabled });
    }
  );

  app.get(
    "/api/:slug/ai/examples",
    { preHandler: [jwtAccessVerify] },
    async (_request, reply) => {
      return reply.send({ examples: AI_EXAMPLES });
    }
  );

  app.get(
    "/api/:slug/ai/exports/:token",
    { preHandler: [jwtAccessVerify] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const actor = actorOf(request);
      if (!actor) return bad(reply, request, 401, "InvalidAccessUser");
      const token = (request.params as { token: string }).token;
      const verified = verifyToken(token);
      if (!verified.ok || verified.payload.kind !== "export") {
        return bad(reply, request, 400, "ValidationError", "Eksport tokeni noto‘g‘ri yoki muddati tugagan");
      }
      const payload = verified.payload;
      if (!tokenBelongsTo(payload, actor.userId, actor.tenantId)) {
        return bad(reply, request, 403, "ForbiddenRole", "Token boshqa foydalanuvchiga tegishli");
      }
      const ok = await claimOnce(payload.jti, Math.max(1, Math.floor((payload.exp - Date.now()) / 1000)));
      if (!ok) return bad(reply, request, 400, "ValidationError", "Token allaqachon ishlatilgan");

      const runs: Array<{ tool: string; payload: unknown }> = [];
      for (const call of payload.calls ?? []) {
        const tool = getTool(call.tool);
        if (!tool) continue;
        const run = await runTool(app, actor, tool, call.params);
        if (run.status === "ok") runs.push({ tool: tool.id, payload: run.payload });
      }
      const groups: AiTableResult[] = runs.flatMap((r) => {
        const g = answerFromRun({
          actor,
          toolId: r.tool,
          run: { tool: r.tool, status: "ok", statusCode: 200, payload: r.payload, message: undefined, durationMs: 0 },
          intent: "export",
          slots: {}
        }).groups?.[0];
        if (!g) return [];
        return [{ title: g.title, summary: g.summary ?? "", columns: g.columns, rows: g.rows }];
      });
      const title = `AI hisoboti (${new Date().toISOString().slice(0, 10)})`;
      let buffer: Buffer;
      let filename: string;
      let contentType: string;
      const wantCsv = payload.params?.fmt === "csv";
      if (wantCsv) {
        const out = buildCsv(groups, title);
        buffer = Buffer.from(out.content, "utf8");
        filename = exportFilename(title, "csv");
        contentType = "text/csv; charset=utf-8";
      } else {
        const out = await buildXlsx(
          groups,
          title,
          groups.map((g) => g.summary || "")
        );
        buffer = out.buffer;
        filename = exportFilename(title, "xlsx");
        contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      }
      void auditAi({ actor, action: "export", status: "ok", rows: groups.reduce((n, g) => n + g.rows.length, 0) });
      return reply
        .header("Content-Type", contentType)
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .send(buffer);
    }
  );
}
