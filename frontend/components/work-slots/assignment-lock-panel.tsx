"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { LockStatusBadge } from "./slot-badge";

/** Mijoz slot 1 uchun avtomatik agent o'zgartirish siyosati (forma bilan birga saqlanadi). */
export function AssignmentLockPanel({
  lockType,
  lockReason,
  onLockTypeChange,
  onLockReasonChange,
  disabled
}: {
  lockType: string;
  lockReason: string;
  onLockTypeChange: (value: string) => void;
  onLockReasonChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Avtomatik o‘zgartirish:</span>
        <LockStatusBadge lockType={lockType} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Holat</Label>
          <Select value={lockType} onValueChange={onLockTypeChange} disabled={disabled}>
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
        {lockType !== "none" && (
          <div className="space-y-1">
            <Label>Sabab</Label>
            <Input
              value={lockReason}
              onChange={(e) => onLockReasonChange(e.target.value)}
              disabled={disabled}
              placeholder="Masalan: shartnoma №, maxsus kelishuv"
            />
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Holat pastdagi «Сохранить» tugmasi bilan saqlanadi.
      </p>
    </div>
  );
}
