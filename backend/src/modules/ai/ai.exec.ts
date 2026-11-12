/**
 * AI Assistant — tool bajaruvchisi.
 *
 * Har bir chaqiruv foydalanuvchining o‘z JWT tokeni bilan `app.inject` orqali
 * ketadi. Shu sababli barcha global hook va RBAC guard’lar ishlaydi.
 */
import type { FastifyInstance } from "fastify";
import { AI_CONFIG } from "./ai.config";
import { applyDataScope } from "./ai.guard";
import { type AiToolSpec } from "./ai.tool";
import type { AiActor, AiParams, AiToolRun } from "./ai.types";

function elapsed(startedAt: number): number {
  return Math.max(0, Date.now() - startedAt);
}

function errorMessage(body: unknown): string {
  if (!body || typeof body !== "object") return "Ma’lumot olinmadi";
  const obj = body as Record<string, unknown>;
  const message = typeof obj.message === "string" ? obj.message : typeof obj.error === "string" ? obj.error : "";
  return message.slice(0, 160) || "Ma’lumot olinmadi";
}

async function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("AI_TOOL_TIMEOUT")), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type RunToolOptions = {
  /** Ichki chaqiruvni o‘chirish (test uchun). */
  inject?: (opts: { method: string; url: string; headers: Record<string, string>; payload?: unknown }) => Promise<{
    statusCode: number;
    body: string;
  }>;
};

/** Tool’ni bajaradi va natijani normallashtiradi. */
export async function runTool(
  app: FastifyInstance,
  actor: AiActor,
  tool: AiToolSpec,
  rawParams: AiParams,
  options: RunToolOptions = {}
): Promise<AiToolRun> {
  const startedAt = Date.now();
  const parsed = tool.schema.safeParse(rawParams ?? {});
  if (!parsed.success) {
    return {
      tool: tool.id,
      status: "error",
      statusCode: 400,
      message: "Parametrlar yetarli emas",
      durationMs: elapsed(startedAt)
    };
  }
  const scoped = applyDataScope(parsed.data as AiParams, actor);
  const path = tool.path(scoped);
  const url = `/api/${encodeURIComponent(actor.tenantSlug)}${path}`;
  const headers = {
    authorization: actor.authorization,
    "x-tenant-slug": actor.tenantSlug
  };

  let payload: unknown;
  if (tool.body) {
    payload = tool.body(scoped);
  }

  try {
    const doInject =
      options.inject ??
      ((opts: { method: string; url: string; headers: Record<string, string>; payload?: unknown }) =>
        app.inject({
          method: opts.method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
          url: opts.url,
          headers: opts.headers,
          payload: opts.payload as Record<string, unknown> | undefined
        }));

    const response = await withTimeout(doInject({ method: tool.method, url, headers, payload }), AI_CONFIG.toolTimeoutMs);
    const statusCode = response.statusCode;
    let body: unknown;
    try {
      body = response.body ? JSON.parse(response.body) : undefined;
    } catch {
      body = response.body;
    }
    if (statusCode === 401 || statusCode === 403) {
      return { tool: tool.id, status: "denied", statusCode, message: errorMessage(body), durationMs: elapsed(startedAt) };
    }
    if (statusCode >= 400) {
      return { tool: tool.id, status: "error", statusCode, message: errorMessage(body), durationMs: elapsed(startedAt) };
    }
    return { tool: tool.id, status: "ok", statusCode, payload: body, durationMs: elapsed(startedAt) };
  } catch (error) {
    const timedOut = error instanceof Error && error.message === "AI_TOOL_TIMEOUT";
    return {
      tool: tool.id,
      status: "error",
      statusCode: timedOut ? 504 : 500,
      message: timedOut ? "So‘rov vaqti tugadi" : "Ichki xatolik",
      durationMs: elapsed(startedAt)
    };
  }
}
