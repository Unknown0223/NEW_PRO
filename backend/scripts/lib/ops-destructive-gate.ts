/**
 * Ops skriptlar uchun ikki bosqichli confirm + majburiy backup flag.
 *
 * Talab:
 *   CONFIRM_TRUNCATE=YES  (yoki CONFIRM_TRUNCATE=yes)
 *   --confirm-phrase=DELETE_ALL_DATA  (yoki CONFIRM_PHRASE=DELETE_ALL_DATA)
 *   --backup-ok  (yoki BACKUP_OK=1)
 */
export const OPS_CONFIRM_PHRASE = "DELETE_ALL_DATA";

function truthyEnv(v: string | undefined): boolean {
  const t = (v ?? "").trim().toLowerCase();
  return t === "1" || t === "true" || t === "yes";
}

export type OpsDestructiveGateResult =
  | { ok: true }
  | { ok: false; message: string };

export function assertOpsDestructiveGate(opts: {
  scriptName: string;
  argv?: string[];
  /** Agar true — CONFIRM_TRUNCATE o‘rniga maxsus env ham qabul (masalan CONFIRM_RESET_CLIENTS). */
  altConfirmEnv?: string;
}): OpsDestructiveGateResult {
  const argv = opts.argv ?? process.argv.slice(2);
  const confirmTruncate = truthyEnv(process.env.CONFIRM_TRUNCATE);
  const altOk =
    opts.altConfirmEnv != null && truthyEnv(process.env[opts.altConfirmEnv]);

  if (!confirmTruncate && !altOk) {
    const altHint = opts.altConfirmEnv
      ? `\n  yoki ${opts.altConfirmEnv}=yes (eski usul)`
      : "";
    return {
      ok: false,
      message:
        `[${opts.scriptName}] To‘xtatildi — 1-bosqich confirm yo‘q.\n` +
        `  CONFIRM_TRUNCATE=YES${altHint}`
    };
  }

  const phraseArg = argv.find((a) => a.startsWith("--confirm-phrase="));
  const phrase =
    (phraseArg ? phraseArg.slice("--confirm-phrase=".length) : "") ||
    (process.env.CONFIRM_PHRASE ?? "").trim();

  if (phrase !== OPS_CONFIRM_PHRASE) {
    return {
      ok: false,
      message:
        `[${opts.scriptName}] To‘xtatildi — 2-bosqich phrase noto‘g‘ri yoki yo‘q.\n` +
        `  --confirm-phrase=${OPS_CONFIRM_PHRASE}\n` +
        `  yoki CONFIRM_PHRASE=${OPS_CONFIRM_PHRASE}`
    };
  }

  const backupFlag = argv.includes("--backup-ok") || truthyEnv(process.env.BACKUP_OK);
  if (!backupFlag) {
    return {
      ok: false,
      message:
        `[${opts.scriptName}] To‘xtatildi — backup tasdiqlanmagan.\n` +
        `  --backup-ok  yoki  BACKUP_OK=1\n` +
        `  (Avval DB backup oling, keyin shu flag bilan qayta ishga tushiring.)`
    };
  }

  return { ok: true };
}

/** Best-effort ops.purge audit (tenant bo‘lsa). Truncate oldin chaqiriladi. */
export async function tryAppendOpsPurgeAudit(input: {
  prisma: {
    tenantAuditEvent: {
      create: (args: {
        data: {
          tenant_id: number;
          actor_user_id: null;
          entity_type: string;
          entity_id: string;
          action: string;
          payload: object;
        };
      }) => Promise<unknown>;
    };
  };
  tenantId: number | null | undefined;
  script: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  if (input.tenantId == null || !Number.isFinite(input.tenantId) || input.tenantId < 1) {
    return;
  }
  try {
    await input.prisma.tenantAuditEvent.create({
      data: {
        tenant_id: Math.floor(input.tenantId),
        actor_user_id: null,
        entity_type: "ops",
        entity_id: input.script.slice(0, 64),
        action: "ops.purge",
        payload: {
          script: input.script,
          at: new Date().toISOString(),
          ...(input.detail ?? {})
        }
      }
    });
  } catch (err) {
    console.warn(`[${input.script}] ops.purge audit yozilmadi (best-effort):`, err);
  }
}
