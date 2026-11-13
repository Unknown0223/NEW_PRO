/** AI assistant sozlamalari — tenant.settings.ai_assistant. */
import { prisma } from "../../config/database";
import { withLockedTenantSettings } from "../tenant-settings/tenant-settings.atomic";
import {
  aiAssistantSettingsKey,
  emptyAiAssistantSettings,
  markProviderFailure,
  markProviderSuccess,
  mergeProvidersPatch,
  parseAiAssistantSettings,
  type ProviderPatchInput
} from "./ai.providers.pure";
import type { AiAssistantSettingsStored, AiProviderStored } from "./ai.providers.types";

export async function loadAiAssistantSettings(tenantId: number): Promise<AiAssistantSettingsStored> {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  if (!row) return emptyAiAssistantSettings();
  return parseAiAssistantSettings(row.settings);
}

/**
 * Eski/deprecation model idlarni DB ga yozib qo‘yadi (faqat farq bo‘lsa).
 * Probe/GET dan chaqiriladi — UI ham yangi modelni ko‘rsatadi.
 */
export async function persistRemappedProviderModels(
  tenantId: number
): Promise<AiAssistantSettingsStored> {
  let saved = emptyAiAssistantSettings();
  let changed = false;
  await withLockedTenantSettings(tenantId, (current) => {
    const key = aiAssistantSettingsKey();
    const prevRaw = parseAiAssistantSettings(current);
    /* parse allaqachon remap qiladi — raw model bilan solishtirish. */
    const root =
      current != null && typeof current === "object" && !Array.isArray(current)
        ? (current as Record<string, unknown>)
        : {};
    const rawBlock =
      root[key] != null && typeof root[key] === "object" && !Array.isArray(root[key])
        ? (root[key] as Record<string, unknown>)
        : {};
    const rawList = Array.isArray(rawBlock.providers) ? rawBlock.providers : [];
    const rawModels = new Map<string, string>();
    for (const item of rawList) {
      if (item != null && typeof item === "object" && !Array.isArray(item)) {
        const o = item as Record<string, unknown>;
        const id = typeof o.id === "string" ? o.id : "";
        const model = typeof o.model === "string" ? o.model.trim() : "";
        if (id) rawModels.set(id, model);
      }
    }
    for (const p of prevRaw.providers) {
      const before = rawModels.get(p.id);
      if (before != null && before !== p.model) {
        changed = true;
        break;
      }
    }
    saved = prevRaw;
    if (!changed) return current;
    return { ...current, [key]: prevRaw };
  });
  return saved;
}

export async function saveAiAssistantSettings(
  tenantId: number,
  patch: { enabled?: boolean; providers?: ProviderPatchInput[] }
): Promise<AiAssistantSettingsStored> {
  let saved = emptyAiAssistantSettings();
  await withLockedTenantSettings(tenantId, (current) => {
    const prev = parseAiAssistantSettings(current);
    saved = mergeProvidersPatch(prev, patch);
    return { ...current, [aiAssistantSettingsKey()]: saved };
  });
  return saved;
}

export async function updateProviderHealth(
  tenantId: number,
  providerId: string,
  result: { ok: true } | { ok: false; error: string }
): Promise<void> {
  if (providerId === "__env__") return;
  await withLockedTenantSettings(tenantId, (current) => {
    const prev = parseAiAssistantSettings(current);
    const providers: AiProviderStored[] = prev.providers.map((p) => {
      if (p.id !== providerId) return p;
      return result.ok ? markProviderSuccess(p) : markProviderFailure(p, result.error);
    });
    return { ...current, [aiAssistantSettingsKey()]: { ...prev, providers } };
  });
}
