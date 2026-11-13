/** AI Assistant — sozlamalar API (provayderlar / kalitlar / probe). */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { ensureTenantContext } from "../../lib/tenant-context";
import { sendApiError } from "../../lib/api-error";
import { getAccessUser, jwtAccessVerify } from "../auth/auth.prehandlers";
import { probeProviders } from "./ai.llm";
import { isEnvLlmConfigured, toPublicSettings } from "./ai.providers.pure";
import {
  loadAiAssistantSettings,
  persistRemappedProviderModels,
  saveAiAssistantSettings
} from "./ai.providers.store";
import { AI_PROVIDER_PRESETS } from "./ai.providers.types";

function bad(reply: FastifyReply, request: FastifyRequest, status: number, code: string, message?: string) {
  return sendApiError(reply, request, status, code, message);
}

function requireAdmin(request: FastifyRequest, reply: FastifyReply): boolean {
  const user = getAccessUser(request);
  if (user.role !== "admin") {
    bad(reply, request, 403, "ForbiddenPermission", "Faqat admin");
    return false;
  }
  return true;
}

const ProviderBody = z.object({
  id: z.string().trim().min(1).max(64).optional(),
  name: z.string().trim().min(1).max(80),
  kind: z.literal("openai_compatible").optional(),
  tier: z.enum(["free", "paid", "local"]).optional(),
  baseUrl: z.string().trim().url().max(300),
  model: z.string().trim().min(1).max(120),
  apiKey: z.string().max(500).nullable().optional(),
  clearApiKey: z.boolean().optional(),
  enabled: z.boolean().optional(),
  priority: z.coerce.number().int().min(1).max(999).optional()
});

const PutBody = z.object({
  enabled: z.boolean().optional(),
  providers: z.array(ProviderBody).max(20).optional()
});

const ProbeBody = z.object({
  providerId: z.string().trim().min(1).max(64).optional()
});

export async function registerAiProviderRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/:slug/ai/settings",
    { preHandler: [jwtAccessVerify] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      if (!requireAdmin(request, reply)) return;
      const user = getAccessUser(request);
      const stored = await persistRemappedProviderModels(user.tenantId);
      return reply.send({
        settings: toPublicSettings(stored, isEnvLlmConfigured()),
        presets: AI_PROVIDER_PRESETS
      });
    }
  );

  app.put(
    "/api/:slug/ai/settings",
    { preHandler: [jwtAccessVerify] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      if (!requireAdmin(request, reply)) return;
      const parsed = PutBody.safeParse(request.body);
      if (!parsed.success) {
        return bad(reply, request, 400, "ValidationError", "Noto‘g‘ri sozlama");
      }
      const user = getAccessUser(request);
      const saved = await saveAiAssistantSettings(user.tenantId, parsed.data);
      return reply.send({
        settings: toPublicSettings(saved, isEnvLlmConfigured()),
        presets: AI_PROVIDER_PRESETS
      });
    }
  );

  app.post(
    "/api/:slug/ai/settings/probe",
    { preHandler: [jwtAccessVerify] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      if (!requireAdmin(request, reply)) return;
      const parsed = ProbeBody.safeParse(request.body ?? {});
      if (!parsed.success) return bad(reply, request, 400, "ValidationError");
      const user = getAccessUser(request);
      const results = await probeProviders({
        tenantId: user.tenantId,
        providerId: parsed.data.providerId
      });
      const stored = await loadAiAssistantSettings(user.tenantId);
      return reply.send({
        results,
        settings: toPublicSettings(stored, isEnvLlmConfigured())
      });
    }
  );
}
