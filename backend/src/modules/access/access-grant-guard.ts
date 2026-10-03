/**
 * Delegatsiya tekshiruvi: admin bo'lmagan foydalanuvchi boshqalarga faqat o'zida
 * «может выдавать» (`access.grant.<key>`) belgisi bor operatsiyalarni bera / olib qo'ya oladi.
 */
import { prisma } from "../../config/database";
import { TENANT_ADMIN_ROLE } from "../../lib/tenant-user-roles";
import {
  isGrantDelegationKey,
  isMatrixOperationKey,
  loadGrantDelegationOperationKeys,
  normalizeGrantDelegationOperationKey
} from "./access-grant-delegation";
import { structuredCatalogByKey } from "./access-operations-tree";
import { expandPermissionKeyAliases } from "./legacy-key-map";
import { loadRolesByKeys, resolveUserPermissionKeys } from "./rbac.resolve";

export class AccessGrantForbiddenError extends Error {
  readonly code = "ACCESS_GRANT_FORBIDDEN" as const;
  constructor(readonly keys: string[]) {
    super("ACCESS_GRANT_FORBIDDEN");
    this.name = "AccessGrantForbiddenError";
  }
}

export class AccessAdminTargetError extends Error {
  readonly code = "ACCESS_ADMIN_TARGET" as const;
  constructor() {
    super("ACCESS_ADMIN_TARGET");
    this.name = "AccessAdminTargetError";
  }
}

export type GrantGuardActor = { userId: number | null; role: string | null | undefined };

export type GrantGuardPatchBody = {
  role?: string;
  permissions?: string[];
  denied_permissions?: string[];
  remove_permission_keys?: string[];
  merge_permissions?: boolean;
  grant_delegation_allow?: string[];
  grant_delegation_revoke?: string[];
  extra_role_keys?: string[];
};

export function isAdminActor(actor: GrantGuardActor): boolean {
  return (actor.role ?? "").trim() === TENANT_ADMIN_ROLE;
}

function opKeys(keys: readonly string[] | undefined): string[] {
  return (keys ?? [])
    .map((k) => normalizeGrantDelegationOperationKey(k.trim()))
    .filter((k) => k.length > 0 && !isGrantDelegationKey(k) && isMatrixOperationKey(k));
}

/**
 * PATCH tanasi qaysi operatsiyalarga tegadi (rol/paketlardan tashqari).
 * `merge_permissions: false` — to'liq almashtirish: joriy shaxsiy ruxsatlar bilan farq olinadi.
 */
export function collectPatchOperationKeys(
  body: GrantGuardPatchBody,
  currentUserEffects: ReadonlyMap<string, "allow" | "deny">
): string[] {
  const out = new Set<string>();
  for (const k of opKeys(body.remove_permission_keys)) out.add(k);
  for (const k of opKeys(body.grant_delegation_allow)) out.add(k);
  for (const k of opKeys(body.grant_delegation_revoke)) out.add(k);
  const permDefined = body.permissions !== undefined || body.denied_permissions !== undefined;
  if (permDefined) {
    const allow = opKeys(body.permissions);
    const deny = opKeys(body.denied_permissions);
    if (body.merge_permissions) {
      for (const k of [...allow, ...deny]) out.add(k);
    } else {
      const next = new Map<string, "allow" | "deny">();
      for (const k of allow) next.set(k, "allow");
      for (const k of deny) next.set(k, "deny");
      for (const [k, e] of next) if (currentUserEffects.get(k) !== e) out.add(k);
      for (const [k] of currentUserEffects) {
        if (!isGrantDelegationKey(k) && isMatrixOperationKey(k) && !next.has(k)) out.add(k);
      }
    }
  }
  return [...out];
}

export function forbiddenGrantKeys(keys: readonly string[], grantable: ReadonlySet<string>): string[] {
  return [...new Set(keys)].filter((k) => !grantable.has(k)).sort();
}

/** Actor bera oladigan operatsiyalar: o'zida bor + «может выдавать» belgisi bor. */
export async function loadActorGrantableKeys(tenantId: number, actor: GrantGuardActor): Promise<Set<string>> {
  if (actor.userId == null) return new Set();
  const [effective, delegated] = await Promise.all([
    resolveUserPermissionKeys(tenantId, actor.userId, actor.role ?? null),
    loadGrantDelegationOperationKeys(tenantId, actor.userId)
  ]);
  const out = new Set<string>();
  for (const k of delegated) if (effective.has(k)) out.add(k);
  return out;
}

async function roleCatalogKeys(tenantId: number, roleKeys: string[]): Promise<string[]> {
  if (roleKeys.length === 0) return [];
  const roles = await loadRolesByKeys(tenantId, roleKeys);
  const catalog = structuredCatalogByKey();
  const out = new Set<string>();
  for (const r of roles.values()) {
    for (const k of expandPermissionKeyAliases(r.permissions.map((p) => p.permission.key))) {
      if (catalog.has(k)) out.add(k);
    }
  }
  return [...out];
}

/** Bitta foydalanuvchiga PATCH — admin bo'lmagan actor uchun tekshiruv. */
export async function assertActorCanPatchUser(
  tenantId: number,
  actor: GrantGuardActor,
  target: { id: number; role: string },
  body: GrantGuardPatchBody,
  grantableCache?: Set<string>
): Promise<void> {
  if (isAdminActor(actor)) return;
  if (target.role === TENANT_ADMIN_ROLE || body.role?.trim() === TENANT_ADMIN_ROLE) throw new AccessAdminTargetError();
  if ((body.extra_role_keys ?? []).includes(TENANT_ADMIN_ROLE)) throw new AccessAdminTargetError();

  const needsCurrent = body.merge_permissions !== true && (body.permissions !== undefined || body.denied_permissions !== undefined);
  const currentEffects = new Map<string, "allow" | "deny">();
  if (needsCurrent) {
    const rows = await prisma.userPermission.findMany({
      where: { user_id: target.id, permission: { tenant_id: tenantId } },
      select: { effect: true, permission: { select: { key: true } } }
    });
    for (const r of rows) currentEffects.set(r.permission.key, r.effect === "deny" ? "deny" : "allow");
  }
  const touched = collectPatchOperationKeys(body, currentEffects);
  const roleKeys = [body.role?.trim() && body.role.trim() !== target.role ? body.role.trim() : "", ...(body.extra_role_keys ?? [])].filter(Boolean);
  touched.push(...(await roleCatalogKeys(tenantId, roleKeys)));
  if (touched.length === 0) return;

  const grantable = grantableCache ?? (await loadActorGrantableKeys(tenantId, actor));
  const forbidden = forbiddenGrantKeys(touched, grantable);
  if (forbidden.length > 0) throw new AccessGrantForbiddenError(forbidden);
}

/** «Состав ролей по умолчанию» — qo'shilgan/olib tashlangan operatsiyalar ham actor bera oladiganlar bo'lishi shart. */
export async function assertActorCanEditRoleDefaults(
  tenantId: number,
  actor: GrantGuardActor,
  roleKey: string,
  currentKeys: readonly string[],
  nextKeys: readonly string[]
): Promise<void> {
  if (isAdminActor(actor)) return;
  if (roleKey === TENANT_ADMIN_ROLE) throw new AccessAdminTargetError();
  const cur = new Set(currentKeys);
  const next = new Set(nextKeys);
  const touched = [...[...next].filter((k) => !cur.has(k)), ...[...cur].filter((k) => !next.has(k))].filter(
    (k) => !isGrantDelegationKey(k) && isMatrixOperationKey(k)
  );
  if (touched.length === 0) return;
  const forbidden = forbiddenGrantKeys(touched, await loadActorGrantableKeys(tenantId, actor));
  if (forbidden.length > 0) throw new AccessGrantForbiddenError(forbidden);
}

/** Route'lar uchun: guard xatosini HTTP javobga aylantiradi (boshqa xatolar — null). */
export function grantGuardErrorResponse(e: unknown): { code: string; message: string; keys?: string[] } | null {
  if (e instanceof AccessAdminTargetError) {
    return { code: e.code, message: "Права администратора может изменять только администратор." };
  }
  if (e instanceof AccessGrantForbiddenError) {
    return {
      code: e.code,
      message: `У вас нет права выдавать эти операции другим: ${describeForbiddenGrantKeys(e.keys)}.`,
      keys: e.keys
    };
  }
  return null;
}

/** Xabar uchun: kalitlar o'rniga operatsiya nomlari (birinchi 5 tasi). */
export function describeForbiddenGrantKeys(keys: readonly string[]): string {
  const catalog = structuredCatalogByKey();
  const names = keys.slice(0, 5).map((k) => catalog.get(k)?.description ?? k);
  const more = keys.length > 5 ? ` и ещё ${keys.length - 5}` : "";
  return `${names.join("; ")}${more}`;
}
