"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { apiFetch, useTenantReady } from "@/lib/api-client";
import { LockStatusBadge } from "./slot-badge";

/** Mijoz agent slot 1 uchun qulflash (assignment id kerak). */
export function AssignmentLockPanel({
  assignmentId,
  lockType,
  lockReason,
  onUpdated
}: {
  assignmentId: number | null;
  lockType: string;
  lockReason: string | null;
  onUpdated?: () => void;
}) {
  const { tenant, ready } = useTenantReady();
  const [type, setType] = useState(lockType);
  const [reason, setReason] = useState(lockReason ?? "");
  const [saving, setSaving] = useState(false);

  if (assignmentId == null) return null;

  const save = async () => {
    if (!ready || !tenant) {
      alert("Sessiya tayyor emas. Sahifani yangilang.");
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/${tenant}/client-agent-assignments/${assignmentId}/lock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lock_type: type,
          lock_reason: type === "none" ? null : reason.trim() || null
        })
      });
      onUpdated?.();
    } catch (e) {
      console.error(e);
      alert("Saqlab bo‘lmadi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Avtomatik o‘zgartirish:</span>
        <LockStatusBadge lockType={type} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Holat</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Erkin</SelectItem>
              <SelectItem value="manual">Qo‘lda</SelectItem>
              <SelectItem value="contract">Qulflangan (shartnoma)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {type !== "none" && (
          <div className="space-y-1">
            <Label>Sabab</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        )}
      </div>
      <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
        Saqlash
      </Button>
    </div>
  );
}
