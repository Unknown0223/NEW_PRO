"use client";

import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import {
  firstMessagePerField,
  firstValidationUserHint,
  getZodFlattenFromApiErrorBody
} from "@/lib/api-validation-details";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SalesChannelRow } from "./sales-channels-workspace";

function pickZodLeaf(per: Record<string, string>, leaf: string): string | undefined {
  for (const [k, v] of Object.entries(per)) {
    if (k === leaf || k.endsWith(`.${leaf}`)) return v;
  }
  return undefined;
}

export function ChannelFormDialog({
  mode,
  open,
  row,
  onOpenChange,
  saving,
  onSaveRequest
}: {
  mode: "add" | "edit";
  open: boolean;
  row?: SalesChannelRow | null;
  onOpenChange: (o: boolean) => void;
  saving: boolean;
  onSaveRequest: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [comment, setComment] = useState("");
  const [sort_order, setSort] = useState("0");
  const [is_active, setActive] = useState(true);
  const [serverFieldErrs, setServerFieldErrs] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setServerFieldErrs({});
    setMsg(null);
    if (mode === "add") {
      setName("");
      setCode("");
      setComment("");
      setSort("0");
      setActive(true);
    } else if (row) {
      setName(row.name);
      setCode(row.code ?? "");
      setComment(row.comment ?? "");
      setSort(String(row.sort_order));
      setActive(row.is_active);
    }
  }, [open, mode, row]);

  const submit = async () => {
    setServerFieldErrs({});
    setMsg(null);
    const so = Number.parseInt(sort_order, 10);
    const body = {
      name: name.trim(),
      code: code.trim() || null,
      comment: comment.trim() || null,
      sort_order: Number.isFinite(so) ? so : 0,
      is_active
    };
    try {
      await onSaveRequest(body);
      setServerFieldErrs({});
      setMsg(null);
      onOpenChange(false);
    } catch (e: unknown) {
      if (isAxiosError(e)) {
        const flat = getZodFlattenFromApiErrorBody(e.response?.data);
        if (flat) {
          const per = firstMessagePerField(flat);
          setServerFieldErrs(per);
          const top = flat.formErrors.map((s) => s.trim()).find(Boolean);
          const hint = firstValidationUserHint(flat);
          const line = top ?? hint ?? Object.values(per).find((m) => m.trim() !== "");
          setMsg(line ? withApiSupportLine(line, e) : getUserFacingError(e, "Ошибка сохранения."));
          return;
        }
        setServerFieldErrs({});
      } else {
        setServerFieldErrs({});
      }
      setMsg(getUserFacingError(e, "Ошибка сохранения."));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Добавить" : "Редактировать"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          {msg ? <p className="text-sm text-destructive">{msg}</p> : null}
          <label className="text-xs text-muted-foreground">
            Название
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Название *" />
            {pickZodLeaf(serverFieldErrs, "name") ? (
              <p className="mt-1 text-xs text-destructive">{pickZodLeaf(serverFieldErrs, "name")}</p>
            ) : null}
          </label>
          <label className="text-xs text-muted-foreground">
            Код
            <Input className="mt-1 font-mono" value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} />
            <span className="text-[10px]">{code.length} / 20</span>
            {pickZodLeaf(serverFieldErrs, "code") ? (
              <p className="mt-1 text-xs text-destructive">{pickZodLeaf(serverFieldErrs, "code")}</p>
            ) : null}
          </label>
          <label className="text-xs text-muted-foreground">
            Комментарий
            <textarea
              className="mt-1 min-h-[56px] w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            {pickZodLeaf(serverFieldErrs, "comment") ? (
              <p className="mt-1 text-xs text-destructive">{pickZodLeaf(serverFieldErrs, "comment")}</p>
            ) : null}
          </label>
          <label className="text-xs text-muted-foreground">
            Сортировка
            <Input className="mt-1" type="number" value={sort_order} onChange={(e) => setSort(e.target.value)} />
            {pickZodLeaf(serverFieldErrs, "sort_order") ? (
              <p className="mt-1 text-xs text-destructive">{pickZodLeaf(serverFieldErrs, "sort_order")}</p>
            ) : null}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={is_active} onChange={(e) => setActive(e.target.checked)} />
            Активный
          </label>
          {pickZodLeaf(serverFieldErrs, "is_active") ? (
            <p className="text-xs text-destructive">{pickZodLeaf(serverFieldErrs, "is_active")}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" className="w-full" disabled={saving || !name.trim()} onClick={() => void submit()}>
            {mode === "add" ? "Добавить" : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
