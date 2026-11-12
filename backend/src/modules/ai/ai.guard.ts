/**
 * AI Assistant — dostup qo‘riqchisi (3-etap).
 *
 * Qatlam A: endpoint RBAC (executor orqali, o‘zgarmaydi).
 * Qatlam B: pre-flight — `tool.anyOf` ↔ foydalanuvchining effective ruxsatlari.
 * Qatlam C: data scope — self-service rollar uchun parametrlarni majburan o‘zgartirish.
 */
import { resolveUserPermissionKeys } from "../access/rbac.resolve";
import { AI_CONFIG } from "./ai.config";
import { pNum, stripInternal, type AiToolSpec } from "./ai.tool";
import type { AiActor, AiParams } from "./ai.types";

export type PermissionState = { unrestricted: boolean; keys: Set<string> };

/** `admin` — cheklovsiz; qolganlar — rol + shaxsiy ruxsatlar birlashmasi. */
export async function loadPermissionState(actor: AiActor): Promise<PermissionState> {
  if (actor.role === "admin") return { unrestricted: true, keys: new Set() };
  if (actor.userId === null) return { unrestricted: false, keys: new Set() };
  try {
    const keys = await resolveUserPermissionKeys(actor.tenantId, actor.userId, actor.role);
    return { unrestricted: false, keys };
  } catch {
    return { unrestricted: false, keys: new Set() };
  }
}

export type ToolGate = { allowed: boolean; reason?: string };

/** Pre-flight: tool ruxsat kalitlari foydalanuvchida bormi. */
export function gateTool(tool: AiToolSpec, state: PermissionState): ToolGate {
  if (state.unrestricted) return { allowed: true };
  if (tool.anyOf.length === 0) return { allowed: true };
  if (tool.anyOf.some((key) => state.keys.has(key))) return { allowed: true };
  return { allowed: false, reason: `Ruxsat yo‘q: ${tool.anyOf.join(", ")}` };
}

/** Yozish tool’i uchun qo‘shimcha rol tekshiruvi. */
export function gateWrite(tool: AiToolSpec, actor: AiActor, state: PermissionState): ToolGate {
  if (tool.kind !== "write") return { allowed: true };
  if (!AI_CONFIG.writeEnabled) return { allowed: false, reason: "Yozish rejimi o‘chirilgan (AI_WRITE_ENABLED=0)" };
  if (AI_CONFIG.selfScopedRoles.has(actor.role)) {
    return { allowed: false, reason: "Bu rol faqat o‘qish huquqiga ega" };
  }
  if (!AI_CONFIG.writeRoles.has(actor.role) && !state.unrestricted) {
    return { allowed: false, reason: `Bu rol o‘zgartirish kirita olmaydi: ${actor.role}` };
  }
  return gateTool(tool, state);
}

const SELF_ID_PARAMS = ["agent_id", "user_id", "assignee_user_id", "expeditor_user_id"];

/**
 * Qatlam C: self-service rol uchun shaxs parametrlari majburan o‘zgartiriladi.
 * Agent boshqa agentning `agent_id` sini so‘rasa ham — faqat o‘z id si qoladi.
 */
export function applyDataScope(params: AiParams, actor: AiActor): AiParams {
  const clean = stripInternal(params);
  if (!AI_CONFIG.selfScopedRoles.has(actor.role) || actor.userId === null) return clean;
  const scoped = { ...clean };
  for (const key of SELF_ID_PARAMS) {
    if (key in scoped) scoped[key] = actor.userId;
  }
  return scoped;
}

/** Yozish tool’i uchun: foydalanuvchi o‘zgartirmoqchi bo‘lgan obyektni ko‘ra oladimi? */
export function canWriteEntity(actor: AiActor, entity: { agent_id?: number | null; client_owner_id?: number | null }): boolean {
  if (!AI_CONFIG.selfScopedRoles.has(actor.role)) return true;
  if (actor.userId === null) return false;
  const owner = entity.agent_id ?? entity.client_owner_id;
  return owner == null || owner === actor.userId;
}

/** Tool parametrlaridan `user_id` ni xavfsiz olish (preview tekshiruvi uchun). */
export function paramUserId(params: AiParams): number | undefined {
  return pNum(params, "user_id") ?? pNum(params, "assignee_user_id");
}
