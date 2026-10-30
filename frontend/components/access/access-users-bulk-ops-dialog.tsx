"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { filterAccessTree } from "@/lib/access-operations-tree";
import { PermissionTree } from "@/components/access/permission-tree/permission-tree";
import { useAccessOperationsTree } from "@/components/access/permission-tree/use-access-operations-tree";
import { userMessageAfterAccessPatchFailure } from "@/components/access/access-user-detail/access-user-detail.types";

type Mode = "grant" | "deny";

/** Tanlangan foydalanuvchilarga bir xil operatsiyalarni berish yoki taqiqlash (`users-bulk-patch`). */
export function AccessUsersBulkOpsDialog({
  tenantSlug,
  userIds,
  open,
  onOpenChange,
  onDone
}: {
  tenantSlug: string;
  userIds: number[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (message: string) => void;
}) {
  const treeQ = useAccessOperationsTree(tenantSlug);
  const [mode, setMode] = useState<Mode>("grant");
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tree = useMemo(() => filterAccessTree(treeQ.data ?? [], search), [treeQ.data, search]);

  const close = (v: boolean) => {
    if (pending) return;
    onOpenChange(v);
    if (!v) {
      setPicked(new Set());
      setSearch("");
      setError(null);
    }
  };

  const apply = async () => {
    const keys = [...picked].sort();
    if (!keys.length || !userIds.length) return;
    setPending(true);
    setError(null);
    try {
      const body =
        mode === "grant"
          ? { merge_permissions: true, permissions: keys, denied_permissions: [] as string[] }
          : { merge_permissions: true, permissions: [] as string[], denied_permissions: keys };
      await api.post(`/api/${tenantSlug}/access/users-bulk-patch`, {
        items: userIds.map((user_id) => ({ user_id, ...body }))
      });
      onDone(mode === "grant" ? "Операции выданы выбранным пользователям" : "Операции запрещены выбранным пользователям");
      setPending(false);
      close(false);
    } catch (err) {
      setError(userMessageAfterAccessPatchFailure(err, "Не удалось сохранить изменения"));
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent showCloseButton className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-4 sm:max-w-[min(46rem,calc(100vw-2rem))]">
        <DialogHeader className="shrink-0 border-b border-border/80 pb-3 text-left">
          <DialogTitle className="text-base">Операции для выбранных пользователей ({userIds.length})</DialogTitle>
          <DialogDescription className="text-xs">
            Изменения применяются только к выбранным пользователям. Роль пользователей не меняется.
          </DialogDescription>
        </DialogHeader>
        <div className="flex shrink-0 flex-wrap items-center gap-2 py-3">
          <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label="Действие">
            {(
              [
                ["grant", "Выдать"],
                ["deny", "Запретить"]
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded px-3 py-1 text-xs",
                  mode === m ? (m === "grant" ? "bg-teal-700 text-white" : "bg-rose-600 text-white") : "text-muted-foreground hover:bg-muted"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input className="h-8 pl-8 text-xs" placeholder="Поиск операции" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Поиск операции" />
          </div>
          <span className="text-xs text-muted-foreground">Выбрано: {picked.size}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {treeQ.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <PermissionTree
              tree={tree}
              isOn={(k) => picked.has(k)}
              onToggle={(keys, next) =>
                setPicked((prev) => {
                  const s = new Set(prev);
                  for (const k of keys) (next ? s.add(k) : s.delete(k));
                  return s;
                })
              }
              expanded={expanded}
              onExpandedChange={setExpanded}
              forceExpanded={search.trim().length > 0}
            />
          )}
        </div>
        {error ? (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter className="mt-3 shrink-0 border-t border-border/80 pt-3">
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => close(false)}>
            Отмена
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={pending || picked.size === 0}
            className={mode === "grant" ? "bg-teal-700 text-white hover:bg-teal-800" : "bg-rose-600 text-white hover:bg-rose-700"}
            onClick={() => void apply()}
          >
            {pending ? "Сохранение…" : mode === "grant" ? "Выдать операции" : "Запретить операции"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
