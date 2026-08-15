"use client";

import type { AgentRow } from "@/components/staff/agents-workspace";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { activeBranchNamesFromProfile } from "@/lib/branch-options";
import { getUserFacingError } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";

export type BonusStrategyScopeValue = {
  scope_branch_codes: string[];
  scope_agent_user_ids: number[];
  scope_trade_direction_ids: number[];
};

type TradeDirRow = {
  id: number;
  name: string;
  code: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantSlug: string;
  title?: string;
  value: BonusStrategyScopeValue;
  onApply: (next: BonusStrategyScopeValue) => void;
  /** When set, shows pending state while parent saves. */
  saving?: boolean;
  error?: string | null;
};

function sortStr(a: string, b: string) {
  return a.localeCompare(b, "ru");
}

const AgentScopeRow = memo(function AgentScopeRow({
  id,
  fio,
  checked,
  onToggle
}: {
  id: number;
  fio: string;
  checked: boolean;
  onToggle: (id: number, checked: boolean) => void;
}) {
  return (
    <li className="flex items-center gap-2 border-t border-border/40 px-3 py-1.5 pl-8">
      <input
        type="checkbox"
        className="size-4 accent-primary"
        checked={checked}
        onChange={(e) => onToggle(id, e.target.checked)}
        id={`bs-ag-${id}`}
      />
      <label htmlFor={`bs-ag-${id}`} className="min-w-0 flex-1 cursor-pointer text-sm">
        <span className="font-medium">{fio}</span>
        <span className="ml-2 font-mono text-[11px] text-muted-foreground">#{id}</span>
      </label>
    </li>
  );
});

export function formatBonusStrategyScopeSummary(v: BonusStrategyScopeValue): string {
  const parts: string[] = [];
  const b = v.scope_branch_codes.length;
  const a = v.scope_agent_user_ids.length;
  const d = v.scope_trade_direction_ids.length;
  if (b) parts.push(`${b} фил.`);
  if (a) parts.push(`${a} аг.`);
  if (d) parts.push(`${d} напр.`);
  return parts.length ? parts.join(" · ") : "Без ограничений";
}

export function BonusStrategyScopeDialog({
  open,
  onOpenChange,
  tenantSlug,
  title = "Привязка стратегии",
  value,
  onApply,
  saving = false,
  error = null
}: Props) {
  const [tab, setTab] = useState("branches");
  const [branchSel, setBranchSel] = useState<Set<string>>(new Set());
  const [agentSel, setAgentSel] = useState<Set<number>>(new Set());
  const [tradeDirSel, setTradeDirSel] = useState<Set<number>>(new Set());
  const [searchBranch, setSearchBranch] = useState("");
  const [searchAgent, setSearchAgent] = useState("");
  const [debouncedAgentSearch, setDebouncedAgentSearch] = useState("");
  const [searchTd, setSearchTd] = useState("");
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedAgentSearch(searchAgent.trim()), 250);
    return () => window.clearTimeout(t);
  }, [searchAgent]);

  // Hydrate only when the dialog opens (not on every parent re-render of `value`).
  useEffect(() => {
    if (!open) return;
    setTab("branches");
    setBranchSel(new Set(value.scope_branch_codes ?? []));
    setAgentSel(new Set(value.scope_agent_user_ids ?? []));
    setTradeDirSel(new Set(value.scope_trade_direction_ids ?? []));
    setSearchBranch("");
    setSearchAgent("");
    setSearchTd("");
    setShowSelectedOnly(false);
    setExpandedGroups(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally sync once per open
  }, [open]);

  const profileQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug, "bonus-strategy-scope-branches"],
    enabled: open && Boolean(tenantSlug),
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{
        references?: { branches?: Array<{ name: string; active?: boolean; is_active?: boolean }> };
      }>(`/api/${tenantSlug}/settings/profile`);
      return data;
    }
  });

  const agentsQ = useQuery({
    queryKey: ["agents", tenantSlug, "bonus-strategy-scope", open],
    enabled: open && Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const q = new URLSearchParams({ is_active: "true" });
      const { data: body } = await api.get<{ data: AgentRow[] }>(`/api/${tenantSlug}/agents?${q}`);
      return body.data ?? [];
    }
  });

  const tradeDirQ = useQuery({
    queryKey: ["trade-directions", tenantSlug, "bonus-strategy-scope"],
    enabled: open && Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get<{ data: TradeDirRow[] }>(
        `/api/${tenantSlug}/trade-directions?is_active=true`
      );
      return data.data ?? [];
    }
  });

  const branchesFromProfile = useMemo(
    () => activeBranchNamesFromProfile(profileQ.data?.references?.branches),
    [profileQ.data]
  );
  const branchesFromAgents = useMemo(() => {
    const names = new Set<string>();
    for (const a of agentsQ.data ?? []) {
      const name = (a.branch ?? "").trim();
      if (name) names.add(name);
    }
    return [...names].sort(sortStr);
  }, [agentsQ.data]);
  const branchSource = branchesFromProfile.length > 0 ? "settings" : "agents";
  const branchRows = useMemo(() => {
    const q = searchBranch.trim().toLowerCase();
    const list = branchesFromProfile.length > 0 ? [...branchesFromProfile] : [...branchesFromAgents];
    list.sort(sortStr);
    if (!q) return list;
    return list.filter((b) => b.toLowerCase().includes(q));
  }, [branchesFromProfile, branchesFromAgents, searchBranch]);

  const agentGroups = useMemo(() => {
    const agents = agentsQ.data ?? [];
    const q = debouncedAgentSearch.toLowerCase();
    const filtered = q
      ? agents.filter(
          (a) =>
            a.fio.toLowerCase().includes(q) ||
            (a.branch ?? "").toLowerCase().includes(q) ||
            (a.login ?? "").toLowerCase().includes(q)
        )
      : agents;
    const m = new Map<string, AgentRow[]>();
    for (const a of filtered) {
      const key = (a.branch ?? "").trim() || "—";
      const arr = m.get(key) ?? [];
      arr.push(a);
      m.set(key, arr);
    }
    const keys = Array.from(m.keys()).sort(sortStr);
    for (const k of keys) {
      m.get(k)!.sort((a, b) => a.fio.localeCompare(b.fio, "ru"));
    }
    return { keys, map: m };
  }, [agentsQ.data, debouncedAgentSearch]);

  const expandAllGroups = useCallback(() => {
    setExpandedGroups(new Set(agentGroups.keys));
  }, [agentGroups.keys]);

  const toggleAgent = useCallback((id: number, checked: boolean) => {
    setAgentSel((prev) => {
      const n = new Set(prev);
      if (checked) n.add(id);
      else n.delete(id);
      return n;
    });
  }, []);

  const tradeDirRows = useMemo(() => {
    const q = searchTd.trim().toLowerCase();
    const list = [...(tradeDirQ.data ?? [])].sort((a, b) => a.name.localeCompare(b.name, "ru"));
    if (!q) return list;
    return list.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.code ?? "").toLowerCase().includes(q)
    );
  }, [tradeDirQ.data, searchTd]);

  const toggleBranch = (b: string, checked: boolean) => {
    setBranchSel((prev) => {
      const n = new Set(prev);
      if (checked) n.add(b);
      else n.delete(b);
      return n;
    });
  };

  const toggleTradeDir = (id: number, checked: boolean) => {
    setTradeDirSel((prev) => {
      const n = new Set(prev);
      if (checked) n.add(id);
      else n.delete(id);
      return n;
    });
  };

  const visibleAgentRows = useMemo(() => {
    if (!showSelectedOnly) return null;
    return (agentsQ.data ?? []).filter((a) => agentSel.has(a.id));
  }, [showSelectedOnly, agentsQ.data, agentSel]);

  const handleApply = () => {
    onApply({
      scope_branch_codes: Array.from(branchSel).sort(sortStr),
      scope_agent_user_ids: Array.from(agentSel).sort((a, b) => a - b),
      scope_trade_direction_ids: Array.from(tradeDirSel).sort((a, b) => a - b)
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[min(640px,90vh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl",
          "max-md:left-1/2 md:left-[calc(50%+min(150px,14vw))]"
        )}
      >
        <DialogHeader className="border-b border-border/60 px-4 py-3 pr-10">
          <DialogTitle className="text-left text-base leading-snug">
            {title}
            <span className="mt-1 block text-xs font-normal text-muted-foreground">
              Филиалы, агенты и направления торговли — как у бонусов и скидок. Пустой список = без
              ограничения по этому признаку.
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-2 px-4 pb-3 pt-2">
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v ?? "branches")}
            className="flex min-h-0 flex-1 flex-col gap-2"
          >
            <TabsList className="grid w-full shrink-0 grid-cols-3 gap-1">
              <TabsTrigger value="branches" className="text-[11px] sm:text-xs">
                Филиалы
                {branchSel.size ? (
                  <span className="ml-1 text-muted-foreground">({branchSel.size})</span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="agents" className="text-[11px] sm:text-xs">
                Агенты
                {agentSel.size ? (
                  <span className="ml-1 text-muted-foreground">({agentSel.size})</span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="directions" className="text-[11px] sm:text-xs">
                Направления
                {tradeDirSel.size ? (
                  <span className="ml-1 text-muted-foreground">({tradeDirSel.size})</span>
                ) : null}
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="branches"
              className="mt-0 flex min-h-0 flex-1 flex-col gap-2 data-[state=inactive]:hidden"
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1">
                  <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-9 pl-8"
                    placeholder="Поиск"
                    value={searchBranch}
                    onChange={(e) => setSearchBranch(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => {
                    const all = branchRows;
                    const allOn = all.length > 0 && all.every((b) => branchSel.has(b));
                    setBranchSel((prev) => {
                      const n = new Set(prev);
                      if (allOn) for (const b of all) n.delete(b);
                      else for (const b of all) n.add(b);
                      return n;
                    });
                  }}
                >
                  Выбрать все
                </Button>
              </div>
              <div className="min-h-[220px] overflow-y-auto rounded-md border border-border/60">
                {profileQ.isLoading ? (
                  <p className="p-3 text-xs text-muted-foreground">Загрузка…</p>
                ) : branchRows.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">
                    Нет филиалов. Добавьте в «Настройки → Филиалы» или назначьте филиал агентам.
                  </p>
                ) : (
                  <>
                    {branchSource === "agents" ? (
                      <p className="border-b border-border/40 px-3 py-2 text-[11px] text-muted-foreground">
                        Список из филиалов агентов (в справочнике филиалов пусто).
                      </p>
                    ) : null}
                    <ul className="divide-y divide-border/50">
                      {branchRows.map((b) => (
                        <li key={b} className="flex items-center gap-2 px-3 py-2">
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            checked={branchSel.has(b)}
                            onChange={(e) => toggleBranch(b, e.target.checked)}
                            id={`bs-br-${b}`}
                          />
                          <label htmlFor={`bs-br-${b}`} className="flex-1 cursor-pointer text-sm">
                            {b}
                          </label>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent
              value="agents"
              className="mt-0 flex min-h-0 flex-1 flex-col gap-2 data-[state=inactive]:hidden"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="h-9" onClick={expandAllGroups}>
                  Развернуть все
                </Button>
                <div className="relative min-w-[200px] flex-1">
                  <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-9 pl-8"
                    placeholder="Поиск"
                    value={searchAgent}
                    onChange={(e) => setSearchAgent(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => {
                    const rows =
                      showSelectedOnly && visibleAgentRows
                        ? visibleAgentRows
                        : agentGroups.keys.flatMap((k) => agentGroups.map.get(k) ?? []);
                    const ids = rows.map((r) => r.id);
                    const allOn = ids.length > 0 && ids.every((id) => agentSel.has(id));
                    setAgentSel((prev) => {
                      const n = new Set(prev);
                      if (allOn) for (const id of ids) n.delete(id);
                      else for (const id of ids) n.add(id);
                      return n;
                    });
                  }}
                >
                  Выбрать все
                </Button>
              </div>
              <div className="min-h-[220px] overflow-y-auto rounded-md border border-border/60">
                {agentsQ.isLoading ? (
                  <p className="p-3 text-xs text-muted-foreground">Загрузка…</p>
                ) : (
                  <div className="divide-y divide-border/50">
                    {(showSelectedOnly && visibleAgentRows
                      ? [{ key: "selected", label: "Выбранные", rows: visibleAgentRows }]
                      : agentGroups.keys.map((key) => ({
                          key,
                          label: key,
                          rows: agentGroups.map.get(key) ?? []
                        }))
                    ).map((group) =>
                      group.rows.length === 0 ? null : (
                        <div key={group.key}>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 bg-muted/30 px-2 py-1.5 text-left text-xs font-medium"
                            onClick={() =>
                              setExpandedGroups((prev) => {
                                const n = new Set(prev);
                                if (n.has(group.key)) n.delete(group.key);
                                else n.add(group.key);
                                return n;
                              })
                            }
                          >
                            {expandedGroups.has(group.key) ? (
                              <ChevronDown className="size-3.5 shrink-0" />
                            ) : (
                              <ChevronRight className="size-3.5 shrink-0" />
                            )}
                            {group.label}
                            <span className="text-muted-foreground">({group.rows.length})</span>
                          </button>
                          {expandedGroups.has(group.key) ? (
                            <ul>
                              {group.rows.map((a) => (
                                <AgentScopeRow
                                  key={a.id}
                                  id={a.id}
                                  fio={a.fio}
                                  checked={agentSel.has(a.id)}
                                  onToggle={toggleAgent}
                                />
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent
              value="directions"
              className="mt-0 flex min-h-0 flex-1 flex-col gap-2 data-[state=inactive]:hidden"
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1">
                  <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-9 pl-8"
                    placeholder="Поиск"
                    value={searchTd}
                    onChange={(e) => setSearchTd(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => {
                    const all = tradeDirRows;
                    const allOn = all.length > 0 && all.every((r) => tradeDirSel.has(r.id));
                    setTradeDirSel((prev) => {
                      const n = new Set(prev);
                      if (allOn) for (const r of all) n.delete(r.id);
                      else for (const r of all) n.add(r.id);
                      return n;
                    });
                  }}
                >
                  Выбрать все
                </Button>
              </div>
              <div className="min-h-[220px] overflow-y-auto rounded-md border border-border/60">
                {tradeDirQ.isLoading ? (
                  <p className="p-3 text-xs text-muted-foreground">Загрузка…</p>
                ) : tradeDirRows.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">Нет направлений.</p>
                ) : (
                  <ul className="divide-y divide-border/50">
                    {tradeDirRows.map((r) => (
                      <li key={r.id} className="flex items-center gap-2 px-3 py-2">
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={tradeDirSel.has(r.id)}
                          onChange={(e) => toggleTradeDir(r.id, e.target.checked)}
                          id={`bs-td-${r.id}`}
                        />
                        <label htmlFor={`bs-td-${r.id}`} className="flex-1 cursor-pointer text-sm">
                          {r.name}
                          {r.code?.trim() ? (
                            <span className="ml-2 text-xs text-muted-foreground">[{r.code}]</span>
                          ) : null}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={showSelectedOnly}
              onChange={(e) => setShowSelectedOnly(e.target.checked)}
            />
            Показать только выбранные (вкладка «Агенты»)
          </label>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-2 border-t border-border/60 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Отменить
            </Button>
            <Button
              type="button"
              onClick={handleApply}
              disabled={saving}
              className="bg-primary text-primary-foreground"
            >
              {saving ? "Сохранение…" : "Применить"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
