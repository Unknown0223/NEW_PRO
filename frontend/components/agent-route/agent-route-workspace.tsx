"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { filterPanelSelectClassName } from "@/components/ui/filter-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  WEEKDAY_RU,
  parseSavedStops,
  planClientToStop,
  useRouteAgents,
  useRouteDay,
  useSaveRouteDay,
  type RouteStop
} from "@/lib/agent-route/agent-route-api";
import { optimizeRoute, routeLengthKm } from "@/lib/agent-route/route-optimize";
import { getUserFacingError } from "@/lib/error-utils";
import { usePermissions } from "@/lib/use-permissions";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, CalendarCheck, MapPinOff, Route, Save, Undo2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AgentRouteMap } from "./agent-route-map";

function todayYmd(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function renumber(list: RouteStop[]): RouteStop[] {
  return list.map((s, i) => ({ ...s, sort_order: i + 1 }));
}

export function AgentRouteWorkspace() {
  const { has } = usePermissions();
  const canEdit = has("gps.marshrut.update");
  const agentsQ = useRouteAgents();
  const [agentId, setAgentId] = useState<number | null>(null);
  const [date, setDate] = useState(todayYmd);
  const dayQ = useRouteDay(agentId, date);
  const save = useSaveRouteDay();

  const [draft, setDraft] = useState<RouteStop[]>([]);
  const [dirty, setDirty] = useState(false);
  const [addId, setAddId] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [highlight, setHighlight] = useState<number | null>(null);

  const savedStops = useMemo(() => parseSavedStops(dayQ.data?.saved?.stops), [dayQ.data?.saved]);
  const hasSaved = savedStops.length > 0;

  useEffect(() => {
    if (!dayQ.data) return;
    setDraft(hasSaved ? savedStops : renumber(dayQ.data.planned.map(planClientToStop)));
    setDirty(false);
    setMsg(null);
  }, [dayQ.data, hasSaved, savedStops]);

  const apply = (next: RouteStop[]) => {
    setDraft(renumber(next));
    setDirty(true);
    setMsg(null);
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= draft.length) return;
    const next = [...draft];
    [next[i], next[j]] = [next[j]!, next[i]!];
    apply(next);
  };

  const pool = dayQ.data?.pool ?? [];
  const inRoute = new Set(draft.map((s) => s.client_id));
  const addable = pool.filter((c) => !inRoute.has(c.client_id));
  const noCoords = draft.filter((s) => s.latitude == null || s.longitude == null).length;
  const km = routeLengthKm(draft);

  const doSave = async () => {
    if (agentId == null) return;
    try {
      await save.mutateAsync({ agent_id: agentId, route_date: date, stops: renumber(draft) });
      setDirty(false);
      setMsg({ ok: true, text: "Маршрут сохранён. Агент увидит этот порядок в мобильном приложении." });
    } catch (e) {
      setMsg({ ok: false, text: getUserFacingError(e, "Не удалось сохранить маршрут") });
    }
  };

  return (
    <PageShell className="space-y-4">
      <PageHeader
        title="Маршрут дня агента"
        description="Порядок посещения клиентов на выбранный день. Список берётся из плана визитов (дни недели у клиента), его можно поменять местами, оптимизировать по расстоянию и сохранить — агент увидит этот порядок в приложении."
      />

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Агент</Label>
          <select
            className={filterPanelSelectClassName}
            value={agentId ?? ""}
            onChange={(e) => setAgentId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— выберите агента —</option>
            {(agentsQ.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.code ? ` (${a.code})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">День</Label>
          <Input type="date" className="h-10 w-[11rem]" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {dayQ.data ? (
          <div className="flex flex-wrap items-center gap-2 pb-2 text-sm">
            <Badge variant="outline">{WEEKDAY_RU[dayQ.data.weekday]}</Badge>
            {hasSaved ? (
              <Badge variant="success">Сохранён</Badge>
            ) : (
              <Badge variant="warning">Не сохранён — показан план визитов</Badge>
            )}
            {dirty ? <Badge variant="info">Есть изменения</Badge> : null}
          </div>
        ) : null}
      </div>

      {agentId == null ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Выберите агента и день.
        </p>
      ) : dayQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : dayQ.isError ? (
        <p className="text-sm text-destructive">{getUserFacingError(dayQ.error, "Не удалось загрузить маршрут")}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(340px,440px)_1fr]">
          <div className="space-y-3">
            {canEdit ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => apply(optimizeRoute(draft))} disabled={draft.length < 3}>
                  <Route className="mr-1 size-4" />
                  Оптимизировать
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => apply((dayQ.data?.planned ?? []).map(planClientToStop))}
                >
                  <CalendarCheck className="mr-1 size-4" />
                  Из плана визитов
                </Button>
                {dirty ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDraft(hasSaved ? savedStops : renumber((dayQ.data?.planned ?? []).map(planClientToStop)));
                      setDirty(false);
                    }}
                  >
                    <Undo2 className="mr-1 size-4" />
                    Отменить
                  </Button>
                ) : null}
                <Button type="button" size="sm" onClick={() => void doSave()} disabled={save.isPending || (!dirty && hasSaved)}>
                  <Save className="mr-1 size-4" />
                  {save.isPending ? "Сохранение…" : "Сохранить"}
                </Button>
              </div>
            ) : null}

            {msg ? <p className={cn("text-sm", msg.ok ? "text-emerald-600" : "text-destructive")}>{msg.text}</p> : null}

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Точек: <b className="text-foreground">{draft.length}</b> · ≈ <b className="text-foreground">{km.toFixed(1)}</b> км по прямой
              </span>
              {noCoords > 0 ? (
                <span className="inline-flex items-center gap-1 text-amber-600">
                  <MapPinOff className="size-3.5" />
                  без координат: {noCoords}
                </span>
              ) : null}
            </div>

            <ol className="max-h-[60vh] divide-y divide-border/60 overflow-y-auto rounded-xl border border-border bg-card">
              {draft.length === 0 ? (
                <li className="p-6 text-center text-sm text-muted-foreground">
                  На этот день в плане визитов нет клиентов. Добавьте клиентов ниже.
                </li>
              ) : (
                draft.map((s, i) => (
                  <li
                    key={s.client_id}
                    className={cn("flex items-center gap-2 px-3 py-2 text-sm", highlight === s.client_id && "bg-primary/10")}
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold tabular-nums text-primary">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{s.client_name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {s.address || (s.latitude == null ? "нет координат" : "")}
                        {s.visited ? " · посещён" : ""}
                      </div>
                    </div>
                    {canEdit ? (
                      <div className="flex shrink-0 items-center">
                        <Button type="button" variant="ghost" size="icon" className="size-7" disabled={i === 0} onClick={() => move(i, -1)} title="Выше">
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="size-7" disabled={i === draft.length - 1} onClick={() => move(i, 1)} title="Ниже">
                          <ArrowDown className="size-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => apply(draft.filter((x) => x.client_id !== s.client_id))} title="Убрать">
                          <X className="size-4" />
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))
              )}
            </ol>

            {canEdit ? (
              <div className="flex gap-2">
                <select className={cn(filterPanelSelectClassName, "max-w-none flex-1")} value={addId} onChange={(e) => setAddId(e.target.value)}>
                  <option value="">Добавить клиента агента… ({addable.length})</option>
                  {addable.map((c) => (
                    <option key={c.client_id} value={c.client_id}>
                      {c.client_name}
                      {c.visit_weekdays.length > 0 ? ` · дни: ${c.visit_weekdays.join(",")}` : ""}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!addId}
                  onClick={() => {
                    const c = pool.find((x) => x.client_id === Number(addId));
                    if (c) apply([...draft, planClientToStop(c, draft.length)]);
                    setAddId("");
                  }}
                >
                  Добавить
                </Button>
              </div>
            ) : null}
          </div>

          <AgentRouteMap stops={draft} onPick={setHighlight} />
        </div>
      )}
    </PageShell>
  );
}
