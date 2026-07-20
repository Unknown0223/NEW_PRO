"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { formatGroupedInteger } from "@/lib/format-numbers";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { WebOperatorCreateWorkspace } from "@/components/staff/web-operator-create-workspace";
import { KeyRound, MonitorSmartphone, Pencil, UserRoundCheck, UserRoundX } from "lucide-react";
import Link from "next/link";
import { WorkplaceMovedNotice } from "@/components/staff/workplace-moved-notice";
import { TableColumnSettingsDialog } from "@/components/data-table/table-column-settings-dialog";
import { StaffActiveSessionsDialog } from "@/components/staff/staff-active-sessions-dialog";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { DEFAULT_TABLE_PAGE_SIZES } from "@/lib/table-page-sizes";
import { WEB_ACCESS_ROLE_LABELS } from "@/lib/distribution-roles";
import { StaffFioCell } from "@/components/staff/staff-fio-cell";
import { formatPersonDisplayName } from "@/lib/person-display";
import { AgentIconButton } from "@/components/staff/agent-workspace-template-ui";
import {
  StaffFilterSelect,
  StaffWorkspaceFilterPanel,
  StaffWorkspaceHeader,
  StaffWorkspaceLayout,
  StaffWorkspaceTable
} from "@/components/staff/staff-workspace-shell";
import { filterSelectClassName } from "@/components/ui/filter-select";

const POSITION_PRESETS_SETTINGS_HREF = "/settings/web-staff-position-presets";

type WebStaffRow = {
  id: number;
  kind: string;
  fio: string;
  first_name?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
  login: string;
  phone: string | null;
  email: string | null;
  code: string | null;
  pinfl: string | null;
  branch: string | null;
  position: string | null;
  is_active: boolean;
  can_authorize: boolean;
  app_access: boolean;
  active_session_count: number;
  max_sessions: number;
};

type FilterOptions = { branches: string[]; positions: string[]; position_presets: string[] };

const OPERATOR_TABLE_ID = "staff.operators.v1";

const OPERATOR_COLUMN_IDS = [
  "fio",
  "login",
  "code",
  "pinfl",
  "email",
  "position",
  "kind",
  "phone",
  "active_sessions",
  "max_sessions",
  "app_access",
  "can_authorize"
] as const;

const OPERATOR_COLUMNS = OPERATOR_COLUMN_IDS.map((id) => ({
  id,
  label:
    {
      fio: "Ф.И.О.",
      login: "Логин",
      code: "Код",
      pinfl: "ПИНФЛ",
      email: "Email",
      position: "Должность",
      kind: "Системная роль",
      phone: "Телефон",
      active_sessions: "Активных сессий",
      max_sessions: "Макс. сессий",
      app_access: "Доступ к приложению",
      can_authorize: "Авторизоваться"
    }[id] ?? id
}));

const OPERATOR_COLUMN_LABEL_BY_ID = new Map(OPERATOR_COLUMNS.map((c) => [c.id, c.label]));

function operatorExportCellString(r: WebStaffRow, colId: string): string {
  switch (colId) {
    case "fio":
      return formatPersonDisplayName(r);
    case "login":
      return r.login;
    case "code":
      return r.code ?? "";
    case "pinfl":
      return r.pinfl ?? "";
    case "email":
      return r.email ?? "";
    case "position":
      return r.position ?? "";
    case "kind":
      return WEB_ACCESS_ROLE_LABELS[r.kind] ?? r.kind;
    case "phone":
      return r.phone ?? "";
    case "active_sessions":
      return String(r.active_session_count);
    case "max_sessions":
      return String(r.max_sessions);
    case "app_access":
      return r.app_access ? "Да" : "Нет";
    case "can_authorize":
      return r.can_authorize ? "Да" : "Нет";
    default:
      return "";
  }
}

function renderOperatorDataCell(colId: string, r: WebStaffRow) {
  switch (colId) {
    case "fio":
      return (
        <StaffFioCell
          first_name={r.first_name}
          last_name={r.last_name}
          middle_name={r.middle_name}
          fio={r.fio}
        />
      );
    case "login":
      return <span className="font-mono text-xs">{r.login}</span>;
    case "code":
      return <span className="text-xs">{r.code ?? "—"}</span>;
    case "pinfl":
      return <span className="text-xs">{r.pinfl ?? "—"}</span>;
    case "email":
      return <span className="text-xs">{r.email ?? "—"}</span>;
    case "position":
      return <span className="text-xs">{r.position?.trim() || "—"}</span>;
    case "kind":
      return (
        <span className="text-xs text-muted-foreground">{WEB_ACCESS_ROLE_LABELS[r.kind] ?? r.kind}</span>
      );
    case "phone":
      return <span className="text-xs">{r.phone ?? "—"}</span>;
    case "max_sessions":
      return (
        <span className="text-xs tabular-nums">{formatGroupedInteger(r.max_sessions)}</span>
      );
    case "app_access":
      return <span className="text-xs">{r.app_access ? "Да" : "Нет"}</span>;
    case "can_authorize":
      return <span className="text-xs">{r.can_authorize ? "Да" : "Нет"}</span>;
    default:
      return "—";
  }
}

type Props = { tenantSlug: string };

export function OperatorsWorkspace({ tenantSlug }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterPosition, setFilterPosition] = useState("");
  const [appliedPosition, setAppliedPosition] = useState("");

  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [editRow, setEditRow] = useState<WebStaffRow | null>(null);
  const [passwordRow, setPasswordRow] = useState<WebStaffRow | null>(null);
  const [bulkRevokeOpen, setBulkRevokeOpen] = useState(false);
  const [bulkLimitsOpen, setBulkLimitsOpen] = useState(false);
  /** Modallarda qulflash: ochilgan paytdagi qatorlar (tanlov yoki joriy ro‘yxat) */
  const [bulkRevokeRows, setBulkRevokeRows] = useState<WebStaffRow[] | null>(null);
  const [bulkLimitsRows, setBulkLimitsRows] = useState<WebStaffRow[] | null>(null);
  const [limitsDraft, setLimitsDraft] = useState<Record<number, number>>({});
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [sessionRow, setSessionRow] = useState<WebStaffRow | null>(null);
  const [createOperatorOpen, setCreateOperatorOpen] = useState(false);
  const [createOperatorFormKey, setCreateOperatorFormKey] = useState(0);

  const tablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: OPERATOR_TABLE_ID,
    defaultColumnOrder: [...OPERATOR_COLUMN_IDS],
    defaultPageSize: 10,
    allowedPageSizes: DEFAULT_TABLE_PAGE_SIZES
  });
  const pageSize = tablePrefs.pageSize;

  const filterOptsQ = useQuery({
    queryKey: ["operators", tenantSlug, "filter-options"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: FilterOptions }>(
        `/api/${tenantSlug}/operators/meta/filter-options`
      );
      return data.data;
    }
  });

  const listQ = useQuery({
    queryKey: ["operators", tenantSlug, tab, appliedPosition],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.live,
    refetchInterval: 45_000,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("is_active", tab === "active" ? "true" : "false");
      if (appliedPosition.trim()) params.set("position", appliedPosition.trim());
      const { data } = await api.get<{ data: WebStaffRow[] }>(
        `/api/${tenantSlug}/operators?${params.toString()}`
      );
      return data.data;
    }
  });

  const bulkRevokeMut = useMutation({
    mutationFn: async (userIds: number[]) => {
      await api.post(`/api/${tenantSlug}/operators/bulk/sessions/revoke`, { user_ids: userIds });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["operators", tenantSlug] });
      setBulkRevokeOpen(false);
      setBulkRevokeRows(null);
      setSelected(new Set());
    }
  });

  const bulkLimitsMut = useMutation({
    mutationFn: async (updates: { user_id: number; max_sessions: number }[]) => {
      await api.post(`/api/${tenantSlug}/operators/bulk/max-sessions`, { updates });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["operators", tenantSlug] });
      setBulkLimitsOpen(false);
      setBulkLimitsRows(null);
      setSelected(new Set());
    }
  });

  const deactivateMut = useMutation({
    mutationFn: async (row: WebStaffRow) => {
      await api.patch(`/api/${tenantSlug}/operators/${row.id}`, {
        is_active: !row.is_active
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["operators", tenantSlug] });
    }
  });

  const rows = useMemo(() => {
    const src = listQ.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return src;
    return src.filter(
      (r) =>
        r.fio.toLowerCase().includes(q) ||
        r.login.toLowerCase().includes(q) ||
        (r.phone ?? "").toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        (r.code ?? "").toLowerCase().includes(q) ||
        (r.pinfl ?? "").toLowerCase().includes(q)
    );
  }, [listQ.data, search]);

  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, safePage, pageSize]);

  useEffect(() => {
    setSelected(new Set());
    setPage(1);
  }, [tab, appliedPosition, search]);

  /** Guruh amali: tanlov bo‘lsa faqat tanlanganlar, aks holda joriy jadvaldagi hammasi */
  function computeBulkTargets(): WebStaffRow[] {
    if (selected.size > 0) return rows.filter((r) => selected.has(r.id));
    return rows;
  }

  const allOnPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));

  function toggleAllOnPage(checked: boolean) {
    if (checked) {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const r of pageRows) next.add(r.id);
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const r of pageRows) next.delete(r.id);
        return next;
      });
    }
  }

  function openBulkLimits() {
    const targets = computeBulkTargets();
    if (!targets.length) return;
    const draft: Record<number, number> = {};
    for (const r of targets) {
      draft[r.id] = r.max_sessions;
    }
    setLimitsDraft(draft);
    setBulkLimitsRows(targets);
    setBulkLimitsOpen(true);
  }

  function openBulkRevoke() {
    const targets = computeBulkTargets();
    if (!targets.length) return;
    setBulkRevokeRows(targets);
    setBulkRevokeOpen(true);
  }

  function adjustLimit(id: number, delta: number) {
    setLimitsDraft((d) => {
      const cur = d[id] ?? 1;
      const next = Math.min(99, Math.max(1, cur + delta));
      return { ...d, [id]: next };
    });
  }

  function setAllLimitsTo(n: number) {
    if (!Number.isFinite(n) || n < 1 || n > 99) return;
    setLimitsDraft((d) => {
      const next = { ...d };
      for (const id of Object.keys(next).map(Number)) {
        next[id] = n;
      }
      return next;
    });
  }

  function bumpAllLimits(delta: number) {
    setLimitsDraft((d) => {
      const next = { ...d };
      for (const id of Object.keys(next).map(Number)) {
        next[id] = Math.min(99, Math.max(1, (next[id] ?? 1) + delta));
      }
      return next;
    });
  }

  function resetFilters() {
    setFilterPosition("");
    setAppliedPosition("");
    setPage(1);
  }

  function applyFilters() {
    setAppliedPosition(filterPosition);
    setPage(1);
  }

  return (
    <StaffWorkspaceLayout>
      {rows.length > 0 ? (
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-2.5 text-xs leading-relaxed text-slate-700">
          <span className="font-medium text-slate-900">Групповая обработка: </span>
          {selected.size > 0 ? (
            <>
              выбрано <strong>{selected.size}</strong> — закрытие сессий и лимиты применяются{" "}
              <strong>только к выбранным</strong>.
            </>
          ) : (
            <>
              ничего не выбрано — действие применится ко{" "}
              <strong>всем {rows.length} сотрудникам</strong> текущего списка (с учётом фильтров и
              поиска).
            </>
          )}
        </div>
      ) : null}

      <StaffWorkspaceHeader
        title="Сотрудники"
        subtitle="Веб-пользователи: логин, доступ, сессии и должность"
        addLabel="Добавить сотрудника"
        onAdd={() => {
          setCreateOperatorFormKey((k) => k + 1);
          setCreateOperatorOpen(true);
        }}
        onColumnSettings={() => setColumnDialogOpen(true)}
      />

      <StaffWorkspaceFilterPanel
        filters={
          <>
            <StaffFilterSelect
              label="Должность"
              value={filterPosition}
              onChange={setFilterPosition}
              emptyLabel="Все должности"
            >
              {(filterOptsQ.data?.positions ?? []).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </StaffFilterSelect>
          </>
        }
        onReset={resetFilters}
        onApply={applyFilters}
        tab={tab}
        onTabChange={setTab}
        pageSize={pageSize}
        onPageSizeChange={(n) => {
          tablePrefs.setPageSize(n);
          setPage(1);
        }}
        allOnPageSelected={allOnPageSelected}
        onToggleAllOnPage={toggleAllOnPage}
        onColumnSettings={() => setColumnDialogOpen(true)}
        onSearch={setSearch}
        searchPlaceholder="Поиск по ФИО, логину, телефону…"
        onExport={() => {
          const order = tablePrefs.visibleColumnOrder;
          const headers = order.map(
            (id) => OPERATOR_COLUMN_LABEL_BY_ID.get(id as (typeof OPERATOR_COLUMN_IDS)[number]) ?? id
          );
          const dataRows = rows.map((r) =>
            order.map((colId) =>
              operatorExportCellString(r, colId as (typeof OPERATOR_COLUMN_IDS)[number])
            )
          );
          downloadXlsxSheet(
            `sotrudniki_${tab}_${new Date().toISOString().slice(0, 10)}.xlsx`,
            "Сотрудники",
            headers,
            dataRows
          );
        }}
        onRefresh={() => void listQ.refetch()}
        isFetching={listQ.isFetching}
        bulkMenu={
          <select
            aria-label="Групповая обработка"
            className={cn(filterSelectClassName, "min-w-[11rem] max-w-[14rem]")}
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (v === "revoke" && rows.length > 0) openBulkRevoke();
              if (v === "limits" && rows.length > 0) openBulkLimits();
              e.target.value = "";
            }}
          >
            <option value="">Групповая обработка…</option>
            <option value="revoke" disabled={rows.length === 0}>
              Закрыть сессии
            </option>
            <option value="limits" disabled={rows.length === 0}>
              Лимиты сессий
            </option>
          </select>
        }
      />

      <TableColumnSettingsDialog
        open={columnDialogOpen}
        onOpenChange={setColumnDialogOpen}
        title="Управление столбцами"
        description="Выберите видимые столбцы и порядок. Сохраняется для вашей учётной записи."
        columns={OPERATOR_COLUMNS}
        columnOrder={tablePrefs.columnOrder}
        hiddenColumnIds={tablePrefs.hiddenColumnIds}
        saving={tablePrefs.saving}
        onSave={(next) => tablePrefs.saveColumnLayout(next)}
        onReset={() => tablePrefs.resetColumnLayout()}
      />

      <StaffWorkspaceTable
        columnOrder={tablePrefs.visibleColumnOrder}
        columnLabelById={OPERATOR_COLUMN_LABEL_BY_ID}
        pageRows={pageRows}
        filteredTotal={total}
        entityLabel="сотрудников"
        page={safePage}
        totalPages={pageCount}
        onPageChange={setPage}
        isLoading={listQ.isLoading}
        selectedIds={selected}
        onToggleSelection={(id, checked) => {
          if (checked) {
            setSelected((prev) => new Set(prev).add(id));
          } else {
            setSelected((prev) => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
          }
        }}
        renderCell={(colId, row) => {
          const r = pageRows.find((x) => x.id === row.id)!;
          if (colId === "active_sessions") {
            return (
              <button
                type="button"
                className="text-xs font-medium text-teal-700 tabular-nums underline-offset-2 hover:underline"
                onClick={() => setSessionRow(r)}
              >
                {r.active_session_count}
              </button>
            );
          }
          return renderOperatorDataCell(colId as (typeof OPERATOR_COLUMN_IDS)[number], r);
        }}
        renderActions={(row) => {
          const r = pageRows.find((x) => x.id === row.id)!;
          return (
            <div className="flex items-center justify-end gap-1">
              <AgentIconButton title="Активные сессии" onClick={() => setSessionRow(r)}>
                <MonitorSmartphone className="h-4 w-4" />
              </AgentIconButton>
              <AgentIconButton title="Сменить пароль" onClick={() => setPasswordRow(r)}>
                <KeyRound className="h-4 w-4" />
              </AgentIconButton>
              <AgentIconButton title="Редактировать" onClick={() => setEditRow(r)}>
                <Pencil className="h-4 w-4 text-amber-600" />
              </AgentIconButton>
              {tab === "active" ? (
                <AgentIconButton
                  title="Деактивировать"
                  onClick={() => {
                    if (window.confirm(`${r.fio} — деактивировать пользователя?`)) {
                      deactivateMut.mutate(r);
                    }
                  }}
                >
                  <UserRoundX className="h-4 w-4 text-rose-600" />
                </AgentIconButton>
              ) : (
                <AgentIconButton title="Активировать" onClick={() => deactivateMut.mutate(r)}>
                  <UserRoundCheck className="h-4 w-4 text-teal-600" />
                </AgentIconButton>
              )}
            </div>
          );
        }}
      />

      <p className="text-xs text-slate-500">
        <strong className="text-slate-700">Системная роль</strong> сейчас только{" "}
        <code className="text-slate-700">operator</code> (JWT).{" "}
        <strong className="text-slate-700">Должность</strong> — организационное название (кассир,
        менеджер и т.д.). Шаблоны:{" "}
        <Link href="/settings/web-staff-position-presets" className="text-teal-700 underline">
          Настройки → Должности веб-сотрудников
        </Link>
        . Счётчик активных сессий обновляется каждые ~45 с или по кнопке обновления.
      </p>

      <Dialog open={createOperatorOpen} onOpenChange={setCreateOperatorOpen}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
          showCloseButton
        >
          <DialogHeader>
            <DialogTitle>Yangi veb xodim</DialogTitle>
            <DialogDescription>
              Login va parol noyob bo‘lishi kerak. Lavozim ro‘yxatdan tanlanadi.
            </DialogDescription>
          </DialogHeader>
          <WebOperatorCreateWorkspace
            key={createOperatorFormKey}
            tenantSlug={tenantSlug}
            layout="embedded"
            onCancel={() => setCreateOperatorOpen(false)}
            onCreated={() => setCreateOperatorOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <WebStaffEditDialog
        row={editRow}
        tenantSlug={tenantSlug}
        filterOptions={filterOptsQ.data}
        onClose={() => setEditRow(null)}
        onDone={async () => {
          await qc.invalidateQueries({ queryKey: ["operators", tenantSlug] });
          setEditRow(null);
        }}
      />

      <WebStaffPasswordDialog
        row={passwordRow}
        tenantSlug={tenantSlug}
        onClose={() => setPasswordRow(null)}
        onDone={async () => {
          await qc.invalidateQueries({ queryKey: ["operators", tenantSlug] });
          setPasswordRow(null);
        }}
      />

      <StaffActiveSessionsDialog
        open={sessionRow != null}
        onOpenChange={(open) => {
          if (!open) setSessionRow(null);
        }}
        tenantSlug={tenantSlug}
        staffKind="operator"
        userId={sessionRow?.id ?? null}
        maxSessions={sessionRow?.max_sessions ?? 1}
        onPatched={() => {
          void qc.invalidateQueries({ queryKey: ["operators", tenantSlug] });
        }}
      />

      <Dialog
        open={bulkRevokeOpen}
        onOpenChange={(o) => {
          if (!o) {
            setBulkRevokeOpen(false);
            setBulkRevokeRows(null);
          }
        }}
      >
        <DialogContent className="max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>Veb-sessiyalarni yopish</DialogTitle>
            <p className="text-xs font-normal text-muted-foreground">
              {bulkRevokeRows && bulkRevokeRows.length > 0 ? (
                <>
                  <strong className="text-foreground">{bulkRevokeRows.length}</strong> ta xodimning barcha faol
                  refresh-sessiyalari yopiladi.
                  {selected.size === 0 ? (
                    <span> (Tanlov qilinmagan — joriy ro‘yxatdagi hammasi.)</span>
                  ) : null}
                </>
              ) : null}
            </p>
          </DialogHeader>
          <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
            {(bulkRevokeRows ?? []).map((r) => (
              <li key={r.id} className="flex justify-between gap-2 rounded border px-2 py-1.5">
                <span>{r.fio}</span>
                <span className="tabular-nums text-muted-foreground">
                  faol sessiyalar: {r.active_session_count}
                </span>
              </li>
            ))}
          </ul>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setBulkRevokeOpen(false);
                setBulkRevokeRows(null);
              }}
            >
              Bekor
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                bulkRevokeMut.isPending || !bulkRevokeRows || bulkRevokeRows.length === 0
              }
              onClick={() => {
                if (!bulkRevokeRows?.length) return;
                bulkRevokeMut.mutate(bulkRevokeRows.map((r) => r.id));
              }}
            >
              {bulkRevokeMut.isPending ? "…" : "Sessiyalarni yopish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={bulkLimitsOpen}
        onOpenChange={(o) => {
          if (!o) {
            setBulkLimitsOpen(false);
            setBulkLimitsRows(null);
          }
        }}
      >
        <DialogContent className="max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>Sessiya limitlarini o‘zgartirish</DialogTitle>
            <p className="text-xs font-normal text-muted-foreground">
              {bulkLimitsRows && bulkLimitsRows.length > 0 ? (
                <>
                  <strong className="text-foreground">{bulkLimitsRows.length}</strong> ta xodim uchun maksimal
                  parallel sessiya yangilanadi.
                  {selected.size === 0 ? (
                    <span> (Tanlov qilinmagan — joriy ro‘yxatdagi hammasi.)</span>
                  ) : null}
                </>
              ) : null}
            </p>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Button type="button" size="sm" variant="secondary" onClick={() => bumpAllLimits(-1)}>
              Hammasiga −1
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => bumpAllLimits(1)}>
              Hammasiga +1
            </Button>
            <span className="text-muted-foreground">yoki</span>
            <Input
              className="w-20"
              inputMode="numeric"
              placeholder="1–99"
              id="uniform-limit"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                const el = document.getElementById("uniform-limit") as HTMLInputElement | null;
                if (el) setAllLimitsTo(Number.parseInt(el.value, 10));
              }}
            >
              Qiymatni qo‘llash
            </Button>
          </div>
          <ul className="max-h-56 space-y-2 overflow-y-auto text-sm">
            {(bulkLimitsRows ?? []).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded border px-2 py-1.5">
                <span className="min-w-0 flex-1 truncate">{r.fio}</span>
                <div className="flex items-center gap-1">
                  <Button type="button" size="sm" variant="outline" onClick={() => adjustLimit(r.id, -1)}>
                    −
                  </Button>
                  <span className="w-8 text-center tabular-nums">{limitsDraft[r.id] ?? r.max_sessions}</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => adjustLimit(r.id, 1)}>
                    +
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setBulkLimitsOpen(false);
                setBulkLimitsRows(null);
              }}
            >
              Bekor
            </Button>
            <Button
              type="button"
              disabled={
                bulkLimitsMut.isPending || !bulkLimitsRows || bulkLimitsRows.length === 0
              }
              onClick={() => {
                if (!bulkLimitsRows?.length) return;
                const updates = bulkLimitsRows.map((r) => ({
                  user_id: r.id,
                  max_sessions: limitsDraft[r.id] ?? r.max_sessions
                }));
                bulkLimitsMut.mutate(updates);
              }}
            >
              {bulkLimitsMut.isPending ? "…" : "Saqlash"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StaffWorkspaceLayout>
  );
}

function WebStaffPasswordDialog({
  row,
  onClose,
  tenantSlug,
  onDone
}: {
  row: WebStaffRow | null;
  onClose: () => void;
  tenantSlug: string;
  onDone: () => void;
}) {
  const [password, setPassword] = useState("");

  useEffect(() => {
    setPassword("");
  }, [row?.id]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!row) return;
      await api.patch(`/api/${tenantSlug}/operators/${row.id}`, { password });
    },
    onSuccess: () => void onDone()
  });

  if (!row) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm" showCloseButton>
        <DialogHeader>
          <DialogTitle>Parolni o‘zgartirish — {row.login}</DialogTitle>
        </DialogHeader>
        <label className="grid gap-1 text-sm">
          <span className="text-xs text-muted-foreground">Yangi parol (min 6)</span>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </label>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Bekor
          </Button>
          <Button
            type="button"
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

function WebStaffEditDialog({
  row,
  onClose,
  tenantSlug,
  filterOptions,
  onDone
}: {
  row: WebStaffRow | null;
  onClose: () => void;
  tenantSlug: string;
  filterOptions: FilterOptions | undefined;
  onDone: () => void;
}) {
  const [first_name, setFirst] = useState("");
  const [last_name, setLast] = useState("");
  const [middle_name, setMid] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pinfl, setPinfl] = useState("");
  const [position, setPosition] = useState("");
  const [max_sessions, setMaxS] = useState("1");
  const [app_access, setAppAccess] = useState(false);
  const [can_authorize, setCanAuth] = useState(true);

  useEffect(() => {
    if (!row) return;
    setFirst((row.first_name ?? "").trim() || row.fio);
    setLast((row.last_name ?? "").trim());
    setMid((row.middle_name ?? "").trim());
    setPhone(row.phone ?? "");
    setEmail(row.email ?? "");
    setCode(row.code ?? "");
    setPinfl(row.pinfl ?? "");
    setPosition(row.position ?? "");
    setMaxS(String(row.max_sessions));
    setAppAccess(row.app_access);
    setCanAuth(row.can_authorize);
  }, [row]);

  const patchMut = useMutation({
    mutationFn: async () => {
      if (!row) return;
      const ms = Number.parseInt(max_sessions, 10);
      await api.patch(`/api/${tenantSlug}/operators/${row.id}`, {
        first_name: first_name.trim(),
        last_name: last_name.trim() || null,
        middle_name: middle_name.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        code: code.trim() || null,
        pinfl: pinfl.trim() || null,
        position: position.trim() || null,
        max_sessions: Number.isFinite(ms) ? ms : row.max_sessions,
        app_access,
        can_authorize
      });
    },
    onSuccess: () => void onDone()
  });

  if (!row) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto" showCloseButton>
        <DialogHeader>
          <DialogTitle>Tahrirlash — {row.login}</DialogTitle>
        </DialogHeader>
        <WorkplaceMovedNotice />
        <div className="grid gap-2 text-sm">
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Ism *</span>
            <Input value={first_name} onChange={(e) => setFirst(e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Familiya</span>
            <Input value={last_name} onChange={(e) => setLast(e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Otasining ismi</span>
            <Input value={middle_name} onChange={(e) => setMid(e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Telefon</span>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Email</span>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Kod</span>
            <Input value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">PINFL</span>
            <Input value={pinfl} onChange={(e) => setPinfl(e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Lavozim</span>
            <Input
              list="webstaff-positions-edit"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            />
            <datalist id="webstaff-positions-edit">
              {(filterOptions?.positions ?? []).map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <span className="text-[11px] leading-snug text-muted-foreground">
              Shablonlar ro‘yxatini{" "}
              <Link
                href={POSITION_PRESETS_SETTINGS_HREF}
                className="text-primary underline underline-offset-2 hover:text-primary/90"
              >
                bu yerda
              </Link>{" "}
              boshqarasiz.
            </span>
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Maks. veb-sessiyalar</span>
            <Input
              inputMode="numeric"
              value={max_sessions}
              onChange={(e) => setMaxS(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={app_access} onChange={(e) => setAppAccess(e.target.checked)} />
            Mobil ilova
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={can_authorize} onChange={(e) => setCanAuth(e.target.checked)} />
            Kirish ruxsati
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Bekor
          </Button>
          <Button type="button" disabled={patchMut.isPending} onClick={() => patchMut.mutate()}>
            {patchMut.isPending ? "…" : "Saqlash"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
