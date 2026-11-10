"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/* ─────────────────────── umumiy: xodim tanlash + jadval ─────────────────────── */

type PickerOption = { id: number; name: string };
type PickerRow = { id: number; name: string };
type TableRow = PickerRow & { first: boolean; second: boolean };

/**
 * "Xodim qo'shish" + checkbox'li jadval (video-otmetka istisnolari).
 * Pekerlarni alohida hookka chiqarmaymiz — mahalliy `useState` yetarli.
 */
export function TabelStaffPickerTable({
  title,
  hint,
  pickLabel,
  emptyText,
  columns,
  canEdit,
  options,
  rows,
  onAdd,
  onToggleFirst,
  onToggleSecond,
  onRemove
}: {
  title: string;
  hint: string;
  pickLabel: string;
  emptyText: string;
  columns: [string, string];
  canEdit: boolean;
  options: PickerOption[];
  rows: TableRow[];
  onAdd: (id: number) => void;
  onToggleFirst: (id: number, next: boolean) => void;
  onToggleSecond: (id: number, next: boolean) => void;
  onRemove: (id: number) => void;
}) {
  const [pick, setPick] = useState("");
  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
      <div className="text-sm font-semibold">{title}</div>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
            {pickLabel}
          </label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            disabled={!canEdit}
          >
            <option value="">Выберите сотрудника</option>
            {options.map((o) => (
              <option key={o.id} value={String(o.id)}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={!canEdit || !pick}
          onClick={() => {
            const id = Number(pick);
            if (!id) return;
            onAdd(id);
            setPick("");
          }}
        >
          <Plus className="mr-1 size-3.5" /> Добавить
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border bg-background">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-muted/50 text-[11px] text-muted-foreground">
              <tr>
                <th className="px-2.5 py-2">Сотрудник</th>
                <th className="px-2.5 py-2">{columns[0]}</th>
                <th className="px-2.5 py-2">{columns[1]}</th>
                <th className="px-2.5 py-2 text-right"> </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-2.5 py-2 font-semibold">{row.name}</td>
                  <td className="px-2.5 py-2">
                    <label className="inline-flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={row.first}
                        disabled={!canEdit}
                        onChange={(e) => onToggleFirst(row.id, e.target.checked)}
                      />
                      {row.first ? "Да" : "Нет"}
                    </label>
                  </td>
                  <td className="px-2.5 py-2">
                    <label className="inline-flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={row.second}
                        disabled={!canEdit}
                        onChange={(e) => onToggleSecond(row.id, e.target.checked)}
                      />
                      {row.second ? "Да" : "Нет"}
                    </label>
                  </td>
                  <td className="px-2.5 py-2 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 text-rose-600"
                      disabled={!canEdit}
                      onClick={() => onRemove(row.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** "Xodim qo'shish" + oddiy ro'yxat (kiosk rahbarlari). */
export function TabelStaffPickerList({
  title,
  hint,
  emptyText,
  canEdit,
  options,
  rows,
  onAdd,
  onRemove
}: {
  title: string;
  hint: string;
  emptyText: string;
  canEdit: boolean;
  options: PickerOption[];
  rows: PickerRow[];
  onAdd: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  const [pick, setPick] = useState("");
  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
      <div className="text-sm font-semibold">{title}</div>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
            Сотрудник
          </label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            disabled={!canEdit}
          >
            <option value="">Выберите сотрудника</option>
            {options.map((o) => (
              <option key={o.id} value={String(o.id)}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={!canEdit || !pick}
          onClick={() => {
            const id = Number(pick);
            if (!id) return;
            onAdd(id);
            setPick("");
          }}
        >
          <Plus className="mr-1 size-3.5" /> Добавить
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="divide-y rounded-md border bg-background">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-2 px-2.5 py-2 text-xs"
            >
              <span className="font-semibold">{row.name}</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-rose-600"
                disabled={!canEdit}
                onClick={() => onRemove(row.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
