"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { loginAlertErrorMessage, useIpWhitelist, useIpWhitelistMutations } from "@/lib/security/login-alerts-api";
import { Trash2 } from "lucide-react";
import { useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canCreate: boolean;
  canDelete: boolean;
};

export function IpWhitelistDialog({ open, onOpenChange, canCreate, canDelete }: Props) {
  const q = useIpWhitelist(open);
  const { add, remove } = useIpWhitelistMutations();
  const [cidr, setCidr] = useState("");
  const [label, setLabel] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const doAdd = async () => {
    if (!cidr.trim()) return;
    setErr(null);
    try {
      await add.mutateAsync({ cidr: cidr.trim(), label: label.trim() || null });
      setCidr("");
      setLabel("");
    } catch (e) {
      setErr(loginAlertErrorMessage(e, "Не удалось добавить IP"));
    }
  };

  const doRemove = async (id: number) => {
    setErr(null);
    try {
      await remove.mutateAsync(id);
    } catch (e) {
      setErr(loginAlertErrorMessage(e, "Не удалось удалить IP"));
    }
  };

  const rows = q.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Белый список IP</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Внешние IP офиса и складов. Когда несколько сотрудников входят с такого IP, предупреждение «Один IP — разные аккаунты»
          не создаётся. Проверки устройств продолжают работать.
        </p>
        {canCreate ? (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void doAdd();
            }}
          >
            <Input className="h-9 w-44" placeholder="213.230.1.0/24" value={cidr} onChange={(e) => setCidr(e.target.value)} />
            <Input className="h-9 min-w-0 flex-1" placeholder="Название (Офис, Склад)" value={label} onChange={(e) => setLabel(e.target.value)} />
            <Button type="submit" size="sm" disabled={add.isPending || !cidr.trim()}>
              Добавить
            </Button>
          </form>
        ) : null}
        {err ? <p className="text-sm text-destructive">{err}</p> : null}
        <div className="max-h-72 overflow-auto rounded-lg border border-border/70">
          {q.isLoading ? (
            <p className="p-3 text-sm text-muted-foreground">Загрузка…</p>
          ) : rows.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">Список пуст</p>
          ) : (
            <ul className="divide-y divide-border/60 text-sm">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span>
                    <span className="font-mono tabular-nums">{r.cidr}</span>
                    {r.label ? <span className="text-muted-foreground"> · {r.label}</span> : null}
                  </span>
                  {canDelete ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      title="Удалить"
                      disabled={remove.isPending}
                      onClick={() => void doRemove(r.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
