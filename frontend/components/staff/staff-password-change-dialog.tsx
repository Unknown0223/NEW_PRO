"use client";

import { useEffect, useState } from "react";
import type { AxiosError } from "axios";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { firstMessagePerField, firstValidationUserHint, getZodFlattenFromApiErrorBody } from "@/lib/api-validation-details";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

export type StaffPasswordApiSegment =
  | "agents"
  | "supervisors"
  | "expeditors"
  | "collectors"
  | "auditors"
  | "skladchik"
  | "operators";

type Props = {
  open: boolean;
  tenantSlug: string;
  apiSegment: StaffPasswordApiSegment;
  userId: number | null;
  login: string;
  onClose: () => void;
  onDone: () => void;
};

/** Jadval qatoridagi kalit — kichik parol o‘zgartirish oynasi. */
export function StaffPasswordChangeDialog({
  open,
  tenantSlug,
  apiSegment,
  userId,
  login,
  onClose,
  onDone
}: Props) {
  const [password, setPassword] = useState("");
  const [passErr, setPassErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPassword("");
    setPassErr(null);
  }, [open, userId]);

  const mut = useMutation({
    mutationFn: async () => {
      if (userId == null || userId <= 0) return;
      await api.patch(`/api/${tenantSlug}/${apiSegment}/${userId}`, { password });
    },
    onMutate: () => setPassErr(null),
    onSuccess: () => void onDone(),
    onError: (e: unknown) => {
      const ax = e as AxiosError<{ error?: string; message?: string }>;
      const flat = getZodFlattenFromApiErrorBody(ax.response?.data);
      if (flat) {
        const per = firstMessagePerField(flat);
        const under = per.password ?? per.new_password;
        if (under) {
          setPassErr(under);
          return;
        }
        const hint = firstValidationUserHint(flat);
        setPassErr(hint ? withApiSupportLine(hint, e) : withApiSupportLine("Parolni tekshiring.", e));
        return;
      }
      setPassErr(getUserFacingError(e, "Parolni saqlab bo‘lmadi."));
    }
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm border border-teal-800/20 shadow-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>Parolni o‘zgartirish — {login || "—"}</DialogTitle>
        </DialogHeader>
        {passErr ? (
          <p className="text-sm text-destructive" role="alert">
            {passErr}
          </p>
        ) : null}
        <label className="grid gap-1 text-sm">
          <span className="text-xs text-muted-foreground">Yangi parol (min 6)</span>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Bekor
          </Button>
          <Button
            type="button"
            className="bg-teal-700 hover:bg-teal-800"
            disabled={mut.isPending || password.trim().length < 6}
            onClick={() => mut.mutate()}
          >
            {mut.isPending ? "…" : "Saqlash"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
