"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/lib/use-permissions";
import { getUserFacingError } from "@/lib/error-utils";
import { cn } from "@/lib/utils";
import { ApproverLeadersBar } from "./approver-leaders-bar";
import { ApproverTable, type EditableRow } from "./approver-table";
import {
  addColumnAfter,
  addColumnBefore,
  addLevelAfter,
  addLevelBefore,
  applyColumn,
  buildRows,
  maxLevels as computeMaxLevels,
  removeColumn,
  removeLevel,
  updateLevel
} from "./approver-state";
import { mergeApproverLeaderOptions } from "./approvers-api";
import { hasUnusedLeaderOption } from "./approver-used-options";
import { useApproverConfig, useApproverDirections, useApproverOptions, useSaveApproverConfig } from "./use-approvers";

export function ApprovalWorkflowWorkspace({ tenantSlug }: { tenantSlug: string }) {
  const perms = usePermissions();
  const canWrite = perms.has("plans.nastroyka_utverzhdayushchih.update");

  const [directionId, setDirectionId] = useState<number | null>(null);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [leaders, setLeaders] = useState<number[]>([]);
  const [baseline, setBaseline] = useState<string>("[]|[]");
  const [banner, setBanner] = useState<string | null>(null);
  const [supQuery, setSupQuery] = useState("");

  const directionsQ = useApproverDirections(tenantSlug);
  const optionsQ = useApproverOptions(tenantSlug, directionId);
  const configQ = useApproverConfig(tenantSlug, directionId);
  const saveMut = useSaveApproverConfig(tenantSlug, directionId);

  // Birinchi yo'nalishni avtomatik tanlash.
  useEffect(() => {
    if (directionId == null && directionsQ.data && directionsQ.data.length > 0) {
      setDirectionId(directionsQ.data[0].id);
    }
  }, [directionId, directionsQ.data]);

  // Yo'nalish almashganda eski qatorlar ko'rinmasin.
  useEffect(() => {
    setRows([]);
    setLeaders([]);
    setBaseline("[]|[]");
  }, [directionId]);

  // Server ma'lumotlari kelganda qatorlarni yangilash.
  useEffect(() => {
    if (directionId == null || !optionsQ.data || !configQ.data) return;
    if (optionsQ.isFetching || configQ.isFetching) return;
    const builtRows = buildRows(optionsQ.data, configQ.data);
    const builtLeaders = [...configQ.data.leaders];
    setRows(builtRows);
    setLeaders(builtLeaders);
    setBaseline(`${JSON.stringify(builtRows)}|${JSON.stringify(builtLeaders)}`);
  }, [directionId, optionsQ.data, configQ.data, optionsQ.isFetching, configQ.isFetching]);

  const nameOf = useMemo(() => {
    const map = new Map<number, string>();
    const o = optionsQ.data;
    if (o) {
      for (const p of [...o.supervisors, ...o.employees, ...o.leaders]) map.set(p.id, p.name);
    }
    return (id: number) => map.get(id) ?? `#${id}`;
  }, [optionsQ.data]);

  const maxLevels = computeMaxLevels(rows);
  const leaderOptions = useMemo(
    () => (optionsQ.data ? mergeApproverLeaderOptions(optionsQ.data) : []),
    [optionsQ.data]
  );
  const canAddLeader = useMemo(
    () => hasUnusedLeaderOption(leaderOptions, leaders, rows),
    [leaderOptions, leaders, rows]
  );
  const dirty = useMemo(
    () => `${JSON.stringify(rows)}|${JSON.stringify(leaders)}` !== baseline,
    [rows, leaders, baseline]
  );

  function resetFromServer() {
    if (!optionsQ.data || !configQ.data) return;
    const builtRows = buildRows(optionsQ.data, configQ.data);
    const builtLeaders = [...configQ.data.leaders];
    setRows(builtRows);
    setLeaders(builtLeaders);
    setBaseline(`${JSON.stringify(builtRows)}|${JSON.stringify(builtLeaders)}`);
    setBanner(null);
  }

  function addLeader() {
    const used = new Set(leaders);
    for (const row of rows) for (const v of row.levels) if (v != null) used.add(v);
    const next = leaderOptions.find((c) => !used.has(c.id))?.id;
    if (next != null) setLeaders((prev) => [...prev, next]);
  }

  async function handleSave() {
    setBanner(null);
    try {
      const payload = {
        // Faqat kamida bitta tasdiqlovchi tanlangan qatorlarni saqlaymiz
        // (199 ta bo'sh konfiguratsiya bilan bazani to'ldirmaslik uchun).
        rows: rows
          .filter((r) => r.levels.some((l) => l != null))
          .map((r) => ({ supervisor_user_id: r.supervisor_user_id, levels: r.levels })),
        leaders
      };
      const saved = await saveMut.mutateAsync(payload);
      const builtRows = buildRows(optionsQ.data!, saved);
      setRows(builtRows);
      setLeaders([...saved.leaders]);
      setBaseline(`${JSON.stringify(builtRows)}|${JSON.stringify(saved.leaders)}`);
    } catch (e) {
      setBanner(getUserFacingError(e, "Не удалось сохранить."));
    }
  }

  const directions = directionsQ.data ?? optionsQ.data?.directions ?? [];

  if (directionsQ.isLoading && directions.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Загрузка…</p>;
  }
  if (directionsQ.isError) {
    return <p className="p-6 text-sm text-destructive">{getUserFacingError(directionsQ.error, "Ошибка загрузки.")}</p>;
  }
  if (directions.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Нет направлений торговли. Сначала создайте направление.</p>;
  }

  return (
    <div className="space-y-4 pb-10">
      {/* Yo'nalish (Направление торговли) tablari */}
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {directions.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setDirectionId(d.id)}
            className={cn(
              "whitespace-nowrap border-b-2 px-3.5 py-2.5 text-xs font-medium transition-colors",
              directionId === d.id
                ? "border-teal-600 text-teal-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {d.name}
          </button>
        ))}
      </div>

      {/* Asosiy rahbarlar (Главные утверждающие) */}
      <ApproverLeadersBar
        leaders={leaders}
        rows={rows}
        options={leaderOptions}
        canWrite={canWrite}
        nameOf={nameOf}
        onReorder={setLeaders}
        onChange={(index, nextId) => setLeaders((prev) => prev.map((v, i) => (i === index ? nextId : v)))}
        onRemove={(index) => setLeaders((prev) => prev.filter((_, i) => i !== index))}
        onAdd={addLeader}
        canAdd={canAddLeader}
      />

      {/* Supervayzer qidiruvi */}
      <div className="flex items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={supQuery}
            onChange={(e) => setSupQuery(e.target.value)}
            placeholder="Поиск супервайзера…"
            className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-xs outline-none focus:border-teal-500"
          />
        </div>
        <span className="text-xs text-muted-foreground">{rows.length} супервайзеров</span>
      </div>

      {optionsQ.isFetching || configQ.isFetching ? (
        <p className="p-6 text-sm text-muted-foreground">Загрузка настроек…</p>
      ) : (
        <ApproverTable
          rows={rows}
          employees={optionsQ.data?.employees ?? []}
          leaders={leaders}
          maxLevels={maxLevels}
          canWrite={canWrite}
          supervisorFilter={supQuery}
          nameOf={nameOf}
          onUpdateLevel={(ri, li, v) => setRows((p) => updateLevel(p, ri, li, v))}
          onAddLevelBefore={(ri, li) => setRows((p) => addLevelBefore(p, ri, li))}
          onAddLevelAfter={(ri, li) => setRows((p) => addLevelAfter(p, ri, li))}
          onRemoveLevel={(ri, li) => setRows((p) => removeLevel(p, ri, li))}
          onAddColumnBefore={(li) => setRows((p) => addColumnBefore(p, li))}
          onAddColumnAfter={(li) => setRows((p) => addColumnAfter(p, li))}
          onRemoveColumn={(li) => setRows((p) => removeColumn(p, li))}
          onApplyColumn={(li, v) => setRows((p) => applyColumn(p, li, v))}
        />
      )}

      {banner && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {banner}
        </p>
      )}

      {canWrite && (
        <div className="flex justify-end gap-2.5">
          <Button variant="outline" onClick={resetFromServer} disabled={!dirty || saveMut.isPending}>
            Отменить
          </Button>
          <Button
            onClick={handleSave}
            disabled={!dirty || saveMut.isPending}
            className="bg-teal-600 text-white shadow-sm hover:bg-teal-700"
          >
            {saveMut.isPending ? "Сохранение…" : "Сохранить"}
          </Button>
        </div>
      )}
    </div>
  );
}
