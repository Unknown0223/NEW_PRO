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
import { handleAiAsk } from "./ai.ask";
import { runTool } from "./ai.exec";
import { handleConfirm } from "./ai.confirm";
import { verifyToken, tokenBelongsTo } from "./ai.token";
import { claimOnce } from "./ai.store";
import { buildCsv, buildXlsx, exportFilename } from "./ai.export";
import { auditAi } from "./ai.audit";
import { answerFromRun } from "./ai.answer";
import { getTool, listCapabilities, AI_EXAMPLES } from "./ai.registry";
import { hasAssistantChat } from "./ai.assistant-access.pure";
import { loadPermissionState } from "./ai.guard";
import { registerAiProviderRoutes } from "./ai.providers.route";
import type { AiActor, AiTableResult } from "./ai.types";

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
  await registerAiProviderRoutes(app);

  app.post(
    "/api/:slug/ai/ask",
    { preHandler: [jwtAccessVerify] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const actor = actorOf(request);
      if (!actor) return bad(reply, request, 401, "InvalidAccessUser");
      const permState = await loadPermissionState(actor);
      if (!hasAssistantChat(permState)) {
        return bad(reply, request, 403, "ForbiddenPermission", "Помощник ruxsati yo‘q");
      }
      const parsed = AskBody.safeParse(request.body);
      if (!parsed.success) {
        return bad(reply, request, 400, "ValidationError", "Savol maydoni kerak");
      }
      return handleAiAsk({
        app,
        request,
        reply,
        actor,
        question: parsed.data.question ?? "",
        exportFormat: parsed.data.exportFormat,
        bad: (status, code, message) => bad(reply, request, status, code, message)
      });
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
      const chat = hasAssistantChat(state);
      return reply.send({
        capabilities: chat ? listCapabilities(state) : [],
        writeEnabled: AI_CONFIG.writeEnabled,
        features: {
          chat,
          reports: state.unrestricted || state.keys.has("assistant.reports.view"),
          tasksView: state.unrestricted || state.keys.has("assistant.tasks.view"),
          tasksCreate: state.unrestricted || state.keys.has("assistant.tasks.create")
        }
      });
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
