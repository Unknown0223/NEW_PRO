"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { TableRowActionGroup } from "@/components/data-table/table-row-actions";
import { SettingsWorkspace } from "@/components/settings/settings-workspace";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SearchableMultiSelectPanel,
  type SearchableMultiSelectItem
} from "@/components/ui/searchable-multi-select-panel";
import { filterSelectClassName } from "@/components/ui/filter-select";
import { api } from "@/lib/api";
import {
  firstMessagePerField,
  firstValidationUserHint,
  getZodFlattenFromApiErrorBody
} from "@/lib/api-validation-details";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  branchTerritoryCityDepths,
  collectActiveNamesAtDepth,
  maxForestDepth
} from "@/lib/territory-tree";
import { ChevronDown, ChevronRight, Pencil, Users } from "lucide-react";

type TerritoryNode = {
  id: string;
  name: string;
  children: TerritoryNode[];
};

type Branch = {
  id: string;
  name: string;
  code?: string | null;
  sort_order?: number | null;
  comment?: string | null;
  active?: boolean;
  territories?: string[];
  cities?: string[];
  cash_desk_ids?: number[];
  territory?: string | null;
  city?: string | null;
  cashbox?: string | null;
  cash_desk_id?: number | null;
  user_links?: { role: string; user_ids: number[] }[];
};

type CashDeskOpt = { id: number; name: string; code: string | null; is_active: boolean };

type TenantProfile = {
  references: {
    regions?: string[];
    territory_levels?: string[];
    territory_nodes?: TerritoryNode[];
    branches?: Branch[];
  };
};

type SystemUser = {
  id: number;
  login: string;
  name: string;
  role: string;
};

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `b-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function pickZodLeaf(per: Record<string, string>, leaf: string): string | undefined {
  for (const [k, v] of Object.entries(per)) {
    if (k === leaf || k.endsWith(`.${leaf}`)) return v;
  }
  return undefined;
}

function sortRows(rows: Branch[]): Branch[] {
  return [...rows].sort((a, b) => {
    const ao = typeof a.sort_order === "number" ? a.sort_order : Number.MAX_SAFE_INTEGER;
    const bo = typeof b.sort_order === "number" ? b.sort_order : Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return (a.name || "").toLocaleLowerCase().localeCompare((b.name || "").toLocaleLowerCase());
  });
}

/** Filtrlardagi kabi trigger — jadval ustidagi `FilterSelect` bilan bir xil balandlik/chiziq */
const BRANCH_FILTER_TRIGGER = cn(filterSelectClassName, "max-w-none min-w-0");

function summaryMultiFilterStrings(
  placeholder: string,
  selected: Set<string>,
  items: SearchableMultiSelectItem<string>[]
): string {
  if (selected.size === 0) return placeholder;
  const labels = items.filter((i) => selected.has(i.id)).map((i) => i.title);
  const joined = labels.join(", ");
  if (joined.length <= 52) return joined;
  return `Tanlangan: ${selected.size}`;
}

function summaryMultiFilterCash(
  placeholder: string,
  selected: Set<number>,
  items: SearchableMultiSelectItem<number>[]
): string {
  if (selected.size === 0) return placeholder;
  const labels = items.filter((i) => selected.has(i.id)).map((i) => i.title);
  const joined = labels.join(", ");
  if (joined.length <= 52) return joined;
  return `Tanlangan: ${selected.size}`;
}

/** Jadval: bir nechta qiymatda birinchi + «(+N)», to‘liq ro‘yxat `title` / tooltip uchun */
function formatCompactListLabels(
  labels: string[],
  emptyDisplay: string
): { cell: string; title?: string } {
  const items = labels.map((s) => s.trim()).filter(Boolean);
  if (items.length === 0) return { cell: emptyDisplay };
  if (items.length === 1) return { cell: items[0]!, title: items[0]!.length > 36 ? items[0] : undefined };
  const full = items.join(", ");
  return {
    cell: `${items[0]!} (+${items.length - 1})`,
    title: full
  };
}

export default function BranchesSettingsPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const role = useEffectiveRole();
  const isAdmin = role === "admin";
  const qc = useQueryClient();

  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [comment, setComment] = useState("");
  const [active, setActive] = useState(true);
  const [selectedTerritories, setSelectedTerritories] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedCashDeskIds, setSelectedCashDeskIds] = useState<number[]>([]);
  const [cashbox, setCashbox] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [serverFieldErrs, setServerFieldErrs] = useState<Record<string, string>>({});
  const [usersOpen, setUsersOpen] = useState(false);
  const [usersBranchId, setUsersBranchId] = useState<string | null>(null);
  const [usersSelected, setUsersSelected] = useState<Record<string, Set<number>>>({});
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());
  const [terrPanelSearch, setTerrPanelSearch] = useState("");
  const [cityPanelSearch, setCityPanelSearch] = useState("");
  const [cashPanelSearch, setCashPanelSearch] = useState("");
  const [branchFilterCloseTok, setBranchFilterCloseTok] = useState(0);

  const profileQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<TenantProfile>(`/api/${tenantSlug}/settings/profile`);
      return data;
    }
  });

  const usersQ = useQuery({
    queryKey: ["ref-users", tenantSlug, "branches-users"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: SystemUser[] }>(`/api/${tenantSlug}/users`);
      return data.data;
    }
  });

  const cashDesksQ = useQuery({
    queryKey: ["cash-desks", tenantSlug, "branches-picker"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("limit", "200");
      const { data } = await api.get<{ data: CashDeskOpt[] }>(`/api/${tenantSlug}/cash-desks?${params.toString()}`);
      return data.data;
    }
  });

  const deskById = useMemo(() => {
    const m = new Map<number, CashDeskOpt>();
    for (const d of cashDesksQ.data ?? []) m.set(d.id, d);
    return m;
  }, [cashDesksQ.data]);

  const rows = useMemo(() => sortRows(profileQ.data?.references?.branches ?? []), [profileQ.data]);
  const filtered = useMemo(() => rows.filter((x) => (tab === "active" ? x.active !== false : x.active === false)), [rows, tab]);

  const territoryOptions = useMemo(() => {
    const nodes = profileQ.data?.references?.territory_nodes ?? [];
    const s = new Set<string>();
    if (nodes.length > 0) {
      const lv = profileQ.data?.references?.territory_levels ?? [];
      const L = lv.filter((x) => typeof x === "string" && x.trim()).length;
      const td = maxForestDepth(nodes);
      const { territoryDepth } = branchTerritoryCityDepths(L, td);
      for (const n of collectActiveNamesAtDepth(nodes, territoryDepth)) s.add(n);
    } else {
      for (const n of profileQ.data?.references?.regions ?? []) {
        if (n.trim()) s.add(n.trim());
      }
    }
    for (const t of selectedTerritories) {
      if (t.trim()) s.add(t.trim());
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [profileQ.data, selectedTerritories]);

  const cityOptions = useMemo(() => {
    const nodes = profileQ.data?.references?.territory_nodes ?? [];
    const s = new Set<string>();
    if (nodes.length > 0) {
      const lv = profileQ.data?.references?.territory_levels ?? [];
      const L = lv.filter((x) => typeof x === "string" && x.trim()).length;
      const td = maxForestDepth(nodes);
      const { cityDepth } = branchTerritoryCityDepths(L, td);
      for (const n of collectActiveNamesAtDepth(nodes, cityDepth)) s.add(n);
    }
    for (const c of selectedCities) {
      if (c.trim()) s.add(c.trim());
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [profileQ.data, selectedCities]);

  const territoryPanelItems = useMemo((): SearchableMultiSelectItem<string>[] => {
    return territoryOptions.map((v) => ({ id: v, title: v }));
  }, [territoryOptions]);

  const cityPanelItems = useMemo((): SearchableMultiSelectItem<string>[] => {
    return cityOptions.map((v) => ({ id: v, title: v }));
  }, [cityOptions]);

  const cashPanelItems = useMemo((): SearchableMultiSelectItem<number>[] => {
    return (cashDesksQ.data ?? [])
      .filter((d) => d.is_active !== false)
      .map((d) => ({ id: d.id, title: d.name, subtitle: d.code?.trim() ? d.code : null }));
  }, [cashDesksQ.data]);

  const usersByRole = useMemo(() => {
    const grouped = new Map<string, SystemUser[]>();
    for (const u of usersQ.data ?? []) {
      const role = (u.role || "other").trim();
      if (!grouped.has(role)) grouped.set(role, []);
      grouped.get(role)!.push(u);
    }
    return Array.from(grouped.entries()).map(([role, list]) => ({
      role,
      users: list.sort((a, b) => a.name.localeCompare(b.name))
    }));
  }, [usersQ.data]);

  const saveMut = useMutation({
    mutationFn: async (next: Branch[]) => {
      if (!tenantSlug) throw new Error("no tenant");
      await api.patch(`/api/${tenantSlug}/settings/profile`, { references: { branches: next } });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["settings", "profile", tenantSlug] });
      setServerFieldErrs({});
      setMsg("Saqlandi.");
    },
    onError: (e: unknown) => {
      if (isAxiosError(e)) {
        const flat = getZodFlattenFromApiErrorBody(e.response?.data);
        if (flat) {
          const per = firstMessagePerField(flat);
          setServerFieldErrs(per);
          const top = flat.formErrors.map((s) => s.trim()).find(Boolean);
          const hint = firstValidationUserHint(flat);
          const line = top ?? hint ?? Object.values(per).find((m) => m.trim() !== "");
          setMsg(line ? withApiSupportLine(line, e) : getUserFacingError(e, "Saqlashda xatolik."));
          return;
        }
        setServerFieldErrs({});
      } else {
        setServerFieldErrs({});
      }
      setMsg(getUserFacingError(e, "Saqlashda xatolik."));
    }
  });

  function resetForm() {
    setEditId(null);
    setName("");
    setCode("");
    setSortOrder("");
    setComment("");
    setActive(true);
    setSelectedTerritories([]);
    setSelectedCities([]);
    setSelectedCashDeskIds([]);
    setCashbox("");
    setTerrPanelSearch("");
    setCityPanelSearch("");
    setCashPanelSearch("");
    setServerFieldErrs({});
  }

  function openAdd() {
    resetForm();
    setMsg(null);
    setServerFieldErrs({});
    setOpen(true);
  }

  function openEdit(row: Branch) {
    setEditId(row.id);
    setName(row.name ?? "");
    setCode(row.code ?? "");
    setSortOrder(row.sort_order == null ? "" : String(row.sort_order));
    setComment(row.comment ?? "");
    setActive(row.active !== false);
    setSelectedTerritories(
      row.territories?.length ? [...row.territories] : row.territory?.trim() ? [row.territory.trim()] : []
    );
    setSelectedCities(row.cities?.length ? [...row.cities] : row.city?.trim() ? [row.city.trim()] : []);
    const fromDesks = (row.cash_desk_ids ?? []).filter((n) => Number.isInteger(n) && n > 0);
    const deskIds =
      fromDesks.length > 0
        ? fromDesks
        : row.cash_desk_id != null && row.cash_desk_id > 0
          ? [row.cash_desk_id]
          : [];
    setSelectedCashDeskIds(Array.from(new Set(deskIds)));
    setCashbox(row.cashbox ?? "");
    setTerrPanelSearch("");
    setCityPanelSearch("");
    setCashPanelSearch("");
    setMsg(null);
    setServerFieldErrs({});
    setOpen(true);
  }

  function submitForm() {
    setServerFieldErrs({});
    setMsg(null);
    const n = name.trim();
    if (!n) return;
    const normalizedCode = code.trim().toUpperCase();
    const terr = selectedTerritories.map((t) => t.trim()).filter(Boolean);
    const citiesNorm = selectedCities.map((c) => c.trim()).filter(Boolean);
    const deskIds = Array.from(
      new Set(selectedCashDeskIds.filter((id) => Number.isInteger(id) && id > 0))
    );
    const prev = editId ? rows.find((x) => x.id === editId) : undefined;
    const next: Branch = {
      id: editId ?? newId(),
      name: n,
      code: normalizedCode || null,
      sort_order: sortOrder.trim() ? Number(sortOrder.trim()) : null,
      comment: comment.trim() || null,
      active,
      ...(terr.length
        ? { territories: terr, territory: terr[0] }
        : { territory: null, territories: undefined }),
      ...(citiesNorm.length
        ? { cities: citiesNorm, city: citiesNorm[0] }
        : { city: null, cities: undefined }),
      ...(deskIds.length
        ? { cash_desk_ids: deskIds, cash_desk_id: deskIds[0] }
        : { cash_desk_id: null, cash_desk_ids: undefined }),
      cashbox: cashbox.trim() || null,
      user_links: prev?.user_links
    };
    const merged = editId ? rows.map((x) => (x.id === editId ? next : x)) : [...rows, next];
    saveMut.mutate(sortRows(merged), {
      onSuccess: () => {
        setOpen(false);
        resetForm();
      }
    });
  }

  function openUsersModal(row: Branch) {
    setUsersBranchId(row.id);
    const selected: Record<string, Set<number>> = {};
    for (const link of row.user_links ?? []) {
      selected[link.role] = new Set(link.user_ids);
    }
    setUsersSelected(selected);
    setExpandedRoles(new Set((row.user_links ?? []).map((x) => x.role)));
    setMsg(null);
    setServerFieldErrs({});
    setUsersOpen(true);
  }

  function toggleRole(role: string) {
    setExpandedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  }

  function toggleUser(role: string, userId: number) {
    setUsersSelected((prev) => {
      const next: Record<string, Set<number>> = { ...prev };
      const set = new Set(next[role] ?? []);
      if (set.has(userId)) set.delete(userId);
      else set.add(userId);
      next[role] = set;
      return next;
    });
  }

  function applyUsersToBranch() {
    if (!usersBranchId) return;
    const links = Object.entries(usersSelected)
      .map(([role, ids]) => ({ role, user_ids: Array.from(ids).sort((a, b) => a - b) }))
      .filter((x) => x.user_ids.length > 0);
    const merged = rows.map((r) => (r.id === usersBranchId ? { ...r, user_links: links } : r));
    saveMut.mutate(sortRows(merged), {
      onSuccess: () => {
        setUsersOpen(false);
        setUsersBranchId(null);
      }
    });
  }

  if (!hydrated) return <PageShell><p className="text-sm text-muted-foreground">Sessiya...</p></PageShell>;
  if (!tenantSlug) return <PageShell><p className="text-sm text-destructive"><Link href="/login" className="underline">Kirish</Link></p></PageShell>;

  return (
    <PageShell>
      <PageHeader
        title="Филиалы"
        description="Filiallar, territoriya/shahar va kassa bog'lanishi."
        actions={
          <div className="flex gap-2">
            <Button size="sm" disabled={!isAdmin} onClick={openAdd}>Добавить</Button>
            <Link href="/settings/cash-desks" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Kassalar
            </Link>
            <Link href="/settings" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Katalog</Link>
          </div>
        }
      />

      <SettingsWorkspace>
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex gap-2">
            <button className={cn("rounded px-3 py-1 text-sm", tab === "active" ? "bg-primary text-primary-foreground" : "bg-muted")} onClick={() => setTab("active")}>Активный</button>
            <button className={cn("rounded px-3 py-1 text-sm", tab === "inactive" ? "bg-primary text-primary-foreground" : "bg-muted")} onClick={() => setTab("inactive")}>Не активный</button>
          </div>

          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="app-table-thead text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Названия</th>
                  <th className="px-3 py-2 font-medium">Территория</th>
                  <th className="px-3 py-2 font-medium">Город</th>
                  <th className="px-3 py-2 font-medium">Касса</th>
                  <th className="px-3 py-2 font-medium">Сортировка</th>
                  <th className="px-3 py-2 font-medium">Код</th>
                  <th className="px-3 py-2 font-medium">Комментарий</th>
                  <th className="px-3 py-2 font-medium text-right">...</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="max-w-[11rem] truncate px-3 py-2 align-top">
                      {(() => {
                        const list = r.territories?.length
                          ? r.territories
                          : r.territory?.trim()
                            ? [r.territory.trim()]
                            : [];
                        const { cell, title } = formatCompactListLabels(list, "-");
                        return <span title={title}>{cell}</span>;
                      })()}
                    </td>
                    <td className="max-w-[11rem] truncate px-3 py-2 align-top">
                      {(() => {
                        const list = r.cities?.length ? r.cities : r.city?.trim() ? [r.city.trim()] : [];
                        const { cell, title } = formatCompactListLabels(list, "-");
                        return <span title={title}>{cell}</span>;
                      })()}
                    </td>
                    <td className="max-w-[11rem] truncate px-3 py-2 align-top">
                      {(() => {
                        const fromArr = (r.cash_desk_ids ?? []).filter((x) => x > 0);
                        const ids =
                          fromArr.length > 0
                            ? fromArr
                            : r.cash_desk_id != null && r.cash_desk_id > 0
                              ? [r.cash_desk_id]
                              : [];
                        const names =
                          ids.length > 0
                            ? ids
                                .map((id) => deskById.get(id)?.name ?? `#${id}`)
                                .filter((x): x is string => Boolean(x))
                            : r.cashbox?.trim()
                              ? [r.cashbox.trim()]
                              : [];
                        const { cell, title } = formatCompactListLabels(names, "—");
                        return <span title={title}>{cell}</span>;
                      })()}
                    </td>
                    <td className="px-3 py-2">{r.sort_order ?? "-"}</td>
                    <td className="px-3 py-2">{r.code ?? "-"}</td>
                    <td className="px-3 py-2">{r.comment ?? "-"}</td>
                    <td className="px-3 py-2 text-right">
                      {isAdmin ? (
                        <TableRowActionGroup className="justify-end" ariaLabel="Filial">
                          <Button
                            variant="outline"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-foreground"
                            type="button"
                            title="Foydalanuvchilar"
                            aria-label="Foydalanuvchilar"
                            onClick={() => openUsersModal(r)}
                          >
                            <Users className="size-3.5" aria-hidden />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-foreground"
                            type="button"
                            title="Tahrirlash"
                            aria-label="Tahrirlash"
                            onClick={() => openEdit(r)}
                          >
                            <Pencil className="size-3.5" aria-hidden />
                          </Button>
                        </TableRowActionGroup>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Ma’lumot yo‘q</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </SettingsWorkspace>

      {msg && !open && !usersOpen ? <p className="text-sm text-muted-foreground">{msg}</p> : null}

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setBranchFilterCloseTok((x) => x + 1);
            setServerFieldErrs({});
            setMsg(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[460px]" showCloseButton>
          <DialogHeader>
            <DialogTitle>{editId ? "Редактировать" : "Добавить"}</DialogTitle>
            <DialogDescription>Kichik modal: filial + bog‘lanishlar.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {msg && open ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
            <div className="grid gap-1.5">
              <Label>Названия</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
              {pickZodLeaf(serverFieldErrs, "name") ? (
                <p className="text-xs text-destructive">{pickZodLeaf(serverFieldErrs, "name")}</p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label>Территория</Label>
              <SearchableMultiSelectPanel<string>
                label="Территория"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Территория"
                triggerClassName={BRANCH_FILTER_TRIGGER}
                items={territoryPanelItems}
                selected={new Set(selectedTerritories)}
                onSelectedChange={(next) => {
                  const resolved =
                    typeof next === "function" ? next(new Set(selectedTerritories)) : next;
                  setSelectedTerritories(Array.from(resolved));
                }}
                searchable
                search={terrPanelSearch}
                onSearchChange={setTerrPanelSearch}
                filterItemsBySearch
                searchPlaceholder="Qidiruv"
                closeToken={branchFilterCloseTok}
                minPopoverWidth={280}
                maxListHeightClass="max-h-44"
                emptyMessage="Katalogda hudud yo‘q"
                selectAllLabel="Ekrandagilarni hammasi"
                clearVisibleLabel="Ekrandan yechish"
                formatTriggerSummary={(sel, items) =>
                  summaryMultiFilterStrings("Территория", sel, items)
                }
              />
              {pickZodLeaf(serverFieldErrs, "territory") || pickZodLeaf(serverFieldErrs, "territories") ? (
                <p className="text-xs text-destructive">
                  {pickZodLeaf(serverFieldErrs, "territories") ?? pickZodLeaf(serverFieldErrs, "territory")}
                </p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label>Город</Label>
              <SearchableMultiSelectPanel<string>
                label="Город"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Город"
                triggerClassName={BRANCH_FILTER_TRIGGER}
                items={cityPanelItems}
                selected={new Set(selectedCities)}
                onSelectedChange={(next) => {
                  const resolved = typeof next === "function" ? next(new Set(selectedCities)) : next;
                  setSelectedCities(Array.from(resolved));
                }}
                searchable
                search={cityPanelSearch}
                onSearchChange={setCityPanelSearch}
                filterItemsBySearch
                searchPlaceholder="Qidiruv"
                closeToken={branchFilterCloseTok}
                minPopoverWidth={280}
                maxListHeightClass="max-h-44"
                emptyMessage="Shahar ro‘yxati bo‘sh"
                selectAllLabel="Ekrandagilarni hammasi"
                clearVisibleLabel="Ekrandan yechish"
                formatTriggerSummary={(sel, items) => summaryMultiFilterStrings("Город", sel, items)}
              />
              {pickZodLeaf(serverFieldErrs, "city") || pickZodLeaf(serverFieldErrs, "cities") ? (
                <p className="text-xs text-destructive">
                  {pickZodLeaf(serverFieldErrs, "cities") ?? pickZodLeaf(serverFieldErrs, "city")}
                </p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label>Kassa (tizim)</Label>
              <SearchableMultiSelectPanel<number>
                label="Kassa"
                hideOuterLabel
                hidePopoverHeader
                triggerPlaceholder="Kassa tanlanmagan"
                triggerClassName={BRANCH_FILTER_TRIGGER}
                items={cashPanelItems}
                selected={new Set(selectedCashDeskIds)}
                onSelectedChange={(next) => {
                  const resolved =
                    typeof next === "function" ? next(new Set(selectedCashDeskIds)) : next;
                  setSelectedCashDeskIds(Array.from(resolved));
                }}
                searchable
                search={cashPanelSearch}
                onSearchChange={setCashPanelSearch}
                filterItemsBySearch
                searchPlaceholder="Qidiruv"
                loading={cashDesksQ.isLoading}
                closeToken={branchFilterCloseTok}
                minPopoverWidth={280}
                maxListHeightClass="max-h-44"
                emptyMessage={
                  cashDesksQ.isLoading
                    ? "…"
                    : "Kassa yo‘q — avval kassa yarating (sozlamalar → Kassalar)."
                }
                selectAllLabel="Ekrandagilarni hammasi"
                clearVisibleLabel="Ekrandan yechish"
                formatTriggerSummary={(sel, items) =>
                  summaryMultiFilterCash("Kassa tanlanmagan", sel, items)
                }
              />
              {pickZodLeaf(serverFieldErrs, "cash_desk_ids") || pickZodLeaf(serverFieldErrs, "cash_desk_id") ? (
                <p className="text-xs text-destructive">
                  {pickZodLeaf(serverFieldErrs, "cash_desk_ids") ?? pickZodLeaf(serverFieldErrs, "cash_desk_id")}
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Ro‘yxat bo‘sh bo‘lsa:{" "}
                <Link href="/settings/cash-desks" className="underline">
                  kassa yarating
                </Link>
                .
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label>Kassa izohi (ixtiyoriy)</Label>
              <Input value={cashbox} onChange={(e) => setCashbox(e.target.value)} placeholder="Eski matn maydoni" />
              {pickZodLeaf(serverFieldErrs, "cashbox") ? (
                <p className="text-xs text-destructive">{pickZodLeaf(serverFieldErrs, "cashbox")}</p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label>Код</Label>
                <span className="text-xs text-muted-foreground">{code.length} / 20</span>
              </div>
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 20))} />
              {pickZodLeaf(serverFieldErrs, "code") ? (
                <p className="text-xs text-destructive">{pickZodLeaf(serverFieldErrs, "code")}</p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label>Сортировка</Label>
              <Input value={sortOrder} onChange={(e) => setSortOrder(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" />
              {pickZodLeaf(serverFieldErrs, "sort_order") ? (
                <p className="text-xs text-destructive">{pickZodLeaf(serverFieldErrs, "sort_order")}</p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label>Комментарий</Label>
              <textarea className="min-h-[72px] rounded-md border bg-background px-3 py-2 text-sm" value={comment} onChange={(e) => setComment(e.target.value)} />
              {pickZodLeaf(serverFieldErrs, "comment") ? (
                <p className="text-xs text-destructive">{pickZodLeaf(serverFieldErrs, "comment")}</p>
              ) : null}
            </div>
            <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>Активный</span>
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            </label>
            <Button onClick={submitForm} disabled={saveMut.isPending || !isAdmin}>{editId ? "Сохранить" : "Добавить"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={usersOpen}
        onOpenChange={(o) => {
          setUsersOpen(o);
          if (!o) {
            setUsersBranchId(null);
            setServerFieldErrs({});
            setMsg(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] sm:max-w-[860px]" showCloseButton>
          <DialogHeader>
            <DialogTitle>Прикрепить пользователей</DialogTitle>
            <DialogDescription>Rol ustiga bosing — hodimlar ro‘yxati ochiladi.</DialogDescription>
          </DialogHeader>
          {msg && usersOpen ? <p className="text-sm text-muted-foreground">{msg}</p> : null}

          <div className="space-y-2 overflow-y-auto pr-1">
            {usersByRole.map((group) => {
              const isOpen = expandedRoles.has(group.role);
              const selectedCount = usersSelected[group.role]?.size ?? 0;
              return (
                <div key={group.role} className="rounded-md border">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/40"
                    onClick={() => toggleRole(group.role)}
                  >
                    <div className="flex items-center gap-2">
                      {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      <span className="font-medium">{group.role}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{selectedCount} tanlangan</span>
                  </button>
                  {isOpen ? (
                    <div className="max-h-56 space-y-1 overflow-y-auto border-t px-3 py-2">
                      {group.users.map((u) => {
                        const checked = usersSelected[group.role]?.has(u.id) ?? false;
                        return (
                          <label key={u.id} className="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-muted/50">
                            <span className="text-sm">{u.name} <span className="text-xs text-muted-foreground">({u.login})</span></span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleUser(group.role, u.id)}
                            />
                          </label>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setUsersOpen(false)}>Отменить</Button>
            <Button type="button" onClick={applyUsersToBranch} disabled={!isAdmin || saveMut.isPending}>Сохранить</Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

