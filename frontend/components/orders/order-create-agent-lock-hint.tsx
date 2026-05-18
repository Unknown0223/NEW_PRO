"use client";

import Link from "next/link";
import type { ClientAgentAssignmentRow } from "@/lib/client-types";
import { LockStatusBadge } from "@/components/work-slots/slot-badge";
import { cn } from "@/lib/utils";

function slot1Assignment(rows: ClientAgentAssignmentRow[] | undefined) {
  if (!rows?.length) return null;
  return rows.find((r) => r.slot === 1) ?? null;
}

/** Zakaz formasi: mijoz slot-1 qulfi va agent mosligi ogohlantirishi. */
export function OrderCreateAgentLockHint({
  assignments,
  selectedAgentId
}: {
  assignments: ClientAgentAssignmentRow[] | undefined;
  selectedAgentId: number | null;
}) {
  const slot1 = slot1Assignment(assignments);
  if (!slot1) return null;

  const lockType = slot1.lock_type ?? "none";
  const lockedAgentId = slot1.agent_id;
  const mismatch =
    lockType === "contract" &&
    lockedAgentId != null &&
    selectedAgentId != null &&
    lockedAgentId !== selectedAgentId;

  if (lockType === "none" && !mismatch) return null;

  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        mismatch ? "border-destructive/50 bg-destructive/5" : "border-border bg-muted/40"
      )}
    >
      <p className="flex flex-wrap items-center gap-2 font-medium">
        Agent biriktirish
        <LockStatusBadge lockType={lockType} />
      </p>
      <div className="mt-1 text-xs text-muted-foreground">
        {lockType === "contract" ? (
          <>
            Shartnoma qulfi: tizim faqat{" "}
            <strong>{slot1.agent_name ?? `agent #${lockedAgentId}`}</strong>
            {slot1.agent_code ? ` (${slot1.agent_code})` : ""} uchun zakaz yaratishga ruxsat beradi.
            {mismatch ? (
              <span className="mt-1 block text-destructive">
                Tanlangan agent mos kelmaydi — saqlashda xato (409) qaytadi.
              </span>
            ) : null}
          </>
        ) : lockType === "manual" ? (
          <>
            Qo‘lda qulflangan. Boshqa agent tanlansa ogohlantirish chiqadi.
            {slot1.lock_reason ? <span className="block text-muted-foreground">{slot1.lock_reason}</span> : null}
          </>
        ) : null}
        {slot1.work_slot_code ? (
          <span className="mt-1 block font-mono text-muted-foreground">Joy: {slot1.work_slot_code}</span>
        ) : null}
        <Link href="/work-slots" className="mt-1 inline-block text-primary underline">
          Ishchi o‘rinlari
        </Link>
      </div>
      </div>
  );
}
