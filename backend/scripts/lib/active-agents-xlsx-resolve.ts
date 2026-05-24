import * as fs from "node:fs";
import * as path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { normPersonKey, parseNameFromFio } from "./active-agents-xlsx-header";

// ─── resolve path helpers ─────────────────────────────────────────

export type AgentsXlsxResolvedPath =
  | { ok: true; path: string }
  | { ok: false; reason: "none" }
  | { ok: false; reason: "missing_env_file"; detail: string };

function downloadsDir(): string | null {
  const d = (process.env.USERPROFILE || process.env.HOME || "").trim();
  return d ? path.join(d, "Downloads") : null;
}

function resolveXlsxPath(
  cwdBackend: string,
  envPath: string | undefined,
  defaultCandidates: string[]
): AgentsXlsxResolvedPath {
  const trimmed = (envPath ?? "").trim();
  if (trimmed) {
    const abs = path.isAbsolute(trimmed) ? trimmed : path.join(cwdBackend, trimmed);
    if (!fs.existsSync(abs)) return { ok: false, reason: "missing_env_file", detail: abs };
    return { ok: true, path: abs };
  }
  for (const p of defaultCandidates) {
    if (fs.existsSync(p)) return { ok: true, path: p };
  }
  return { ok: false, reason: "none" };
}

function withDownloadsFallback(names: string[]): string[] {
  const dl = downloadsDir();
  if (!dl) return names;
  const extra = names.flatMap((p) => {
    const base = path.basename(p);
    return [p, path.join(dl, base)];
  });
  /** scripts/data ustun, keyin Downloads */
  return extra;
}

/** AGENTS_XLSX_PATH yoki scripts/data / Downloads dagi standart nomlar */
export function resolveAgentsXlsxPath(cwdBackend: string, envPath: string | undefined): AgentsXlsxResolvedPath {
  return resolveXlsxPath(
    cwdBackend,
    envPath,
    withDownloadsFallback([
      path.join(cwdBackend, "scripts/data/staff-agents.xlsx"),
      path.join(cwdBackend, "scripts/data/active-agents.xlsx"),
      path.join(cwdBackend, "scripts/data/Активные агенты (3).xlsx"),
      path.join(cwdBackend, "scripts/data/Активные агенты (2).xlsx"),
      path.join(cwdBackend, "scripts/data/Активные агенты (1).xlsx"),
      path.join(cwdBackend, "scripts/data/Активные агенты.xlsx")
    ])
  );
}

export function resolveExpeditorsXlsxPath(
  cwdBackend: string,
  envPath: string | undefined
): AgentsXlsxResolvedPath {
  return resolveXlsxPath(
    cwdBackend,
    envPath,
    withDownloadsFallback([
      path.join(cwdBackend, "scripts/data/staff-expeditors.xlsx"),
      path.join(cwdBackend, "scripts/data/active-expeditors.xlsx"),
      path.join(cwdBackend, "scripts/data/Активные Активные экспедиторы (3).xlsx"),
      path.join(cwdBackend, "scripts/data/Активные Активные экспедиторы (1).xlsx"),
      path.join(cwdBackend, "scripts/data/Активные Активные экспедиторы (2).xlsx"),
      path.join(cwdBackend, "scripts/data/Активные экспедиторы (1).xlsx"),
      path.join(cwdBackend, "scripts/data/Активные экспедиторы (2).xlsx"),
      path.join(cwdBackend, "scripts/data/Активные экспедиторы.xlsx")
    ])
  );
}

export function resolveSupervisorsXlsxPath(
  cwdBackend: string,
  envPath: string | undefined
): AgentsXlsxResolvedPath {
  return resolveXlsxPath(
    cwdBackend,
    envPath,
    withDownloadsFallback([
      path.join(cwdBackend, "scripts/data/staff-supervisors.xlsx"),
      path.join(cwdBackend, "scripts/data/active-supervisors.xlsx"),
      path.join(cwdBackend, "scripts/data/Супервайзеры (4).xlsx"),
      path.join(cwdBackend, "scripts/data/Супервайзеры (3).xlsx"),
      path.join(cwdBackend, "scripts/data/Супервайзеры (1).xlsx"),
      path.join(cwdBackend, "scripts/data/Супервайзеры (2).xlsx"),
      path.join(cwdBackend, "scripts/data/Супервайзеры.xlsx")
    ])
  );
}

type TenantAgentLookup = {
  byCodeNorm: Map<string, number>;
  byNameNorm: Map<string, number>;
  byLoginNorm: Map<string, number>;
  agents: Array<{
    id: number;
    code: string | null;
    name: string | null;
    login: string;
    first_name: string | null;
    last_name: string | null;
  }>;
};

export async function loadTenantAgentLookup(prisma: PrismaClient, tenantId: number): Promise<TenantAgentLookup> {
  const agents = await prisma.user.findMany({
    where: { tenant_id: tenantId, role: "agent" },
    select: { id: true, code: true, name: true, login: true, first_name: true, last_name: true }
  });
  const byCodeNorm = new Map<string, number>();
  const byNameNorm = new Map<string, number>();
  const byLoginNorm = new Map<string, number>();
  const putName = (raw: string | null | undefined, id: number) => {
    const k = normPersonKey(raw ?? "");
    if (k.length > 0) byNameNorm.set(k, id);
  };
  for (const a of agents) {
    if (a.code) {
      const c = a.code.toUpperCase().replace(/\s+/g, "").trim();
      if (c) byCodeNorm.set(c, a.id);
    }
    const lg = normPersonKey(a.login.replace(/\s+/g, ""));
    if (lg) byLoginNorm.set(lg, a.id);
    putName(a.name, a.id);
    putName([a.first_name, a.last_name].filter(Boolean).join(" "), a.id);
    const bracket = (a.name ?? "").match(/\[([^\]]+)\]/);
    if (bracket) putName(bracket[1], a.id);
  }
  return { byCodeNorm, byNameNorm, byLoginNorm, agents };
}

function resolveAgentIdFromLookup(lookup: TenantAgentLookup, token: string): number | null {
  const raw = token.replace(/\u00a0/g, " ").replace(/[\u200b-\u200d\ufeff]/g, "").trim();
  if (!raw) return null;
  const { displayName } = parseNameFromFio(raw);
  const nameKey = normPersonKey(displayName || raw);
  if (nameKey && lookup.byNameNorm.has(nameKey)) {
    return lookup.byNameNorm.get(nameKey) ?? null;
  }
  const codeCompact = raw.toUpperCase().replace(/\s+/g, "").trim();
  if (codeCompact.length >= 2 && codeCompact.length <= 48 && lookup.byCodeNorm.has(codeCompact)) {
    return lookup.byCodeNorm.get(codeCompact) ?? null;
  }
  const loginKey = normPersonKey(raw.replace(/\s+/g, ""));
  if (loginKey && lookup.byLoginNorm.has(loginKey)) {
    return lookup.byLoginNorm.get(loginKey) ?? null;
  }

  if (nameKey.length >= 4) {
    for (const a of lookup.agents) {
      const an = normPersonKey(a.name ?? "");
      if (!an) continue;
      if (an === nameKey || an.includes(nameKey) || nameKey.includes(an)) return a.id;
    }
  }
  return null;
}

/**
 * SVR «агент» ustuni: rasmiy ajratuvchi — **vergul**; `;` `|` tab/yangi qator noto‘g‘ri bo‘lsa vergulga almashtiriladi, keyin `,` bo‘yicha bo‘linadi.
 */
function normalizeSupervisorAgentsCellForCommaSplit(raw: string): string {
  return raw
    .replace(/\u00a0/g, " ")
    .replace(/\uff0c/g, ",")
    .replace(/[;|]/g, ",")
    .replace(/\t+/g, ",")
    .replace(/\r?\n+/g, ",")
    .replace(/\s+,/g, ",")
    .replace(/,\s+/g, ",")
    .replace(/,{2,}/g, ",");
}

/** Tahlil skriptlari va import bir xil qoidada agent tokenlarini ajratadi. */
export function splitSupervisorAgentsCell(raw: string): string[] {
  return normalizeSupervisorAgentsCellForCommaSplit(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function linkSupervisorAgentsForRow(opts: {
  prisma: PrismaClient;
  tenantId: number;
  supervisorUserId: number;
  agentsCell: string;
  lookup: TenantAgentLookup;
  dry: boolean;
}): Promise<{ applied: number; unmatched: string[]; resolvedCount: number }> {
  const { prisma, tenantId, supervisorUserId, agentsCell, lookup, dry } = opts;
  const parts = splitSupervisorAgentsCell(agentsCell);
  const unmatched: string[] = [];
  const ids = new Set<number>();
  for (const p of parts) {
    const id = resolveAgentIdFromLookup(lookup, p);
    if (id == null) unmatched.push(p);
    else ids.add(id);
  }
  const idArr = [...ids];
  if (idArr.length === 0) {
    return { applied: 0, unmatched, resolvedCount: 0 };
  }
  if (dry) {
    return { applied: 0, unmatched, resolvedCount: idArr.length };
  }
  await prisma.user.updateMany({
    where: { tenant_id: tenantId, id: { in: idArr }, role: "agent" },
    data: { supervisor_user_id: supervisorUserId }
  });
  return { applied: idArr.length, unmatched, resolvedCount: idArr.length };
}

export type RunStaffXlsxImportOpts = {
  prisma: PrismaClient;
  tenantId: number;
  tenantSlug: string;
  xlsxPath: string;
  dry: boolean;
  defaultPassword: string;
  resetPassword: boolean;
};

/** Eski nom bilan moslik */
export type RunActiveAgentsXlsxImportOpts = RunStaffXlsxImportOpts;
