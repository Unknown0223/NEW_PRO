"use client";

import { useEffect, useMemo, useState } from "react";
import type { AxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { firstValidationUserHint, getZodFlattenFromApiErrorBody } from "@/lib/api-validation-details";
import { withApiSupportLine } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { Button } from "@/components/ui/button";
import { WorkplaceMovedNotice } from "@/components/staff/workplace-moved-notice";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { TableColumnSettingsDialog } from "@/components/data-table/table-column-settings-dialog";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { DEFAULT_TABLE_PAGE_SIZES } from "@/lib/table-page-sizes";
import { MonitorSmartphone, Pencil, UserMinus } from "lucide-react";
import { StaffActiveSessionsDialog } from "@/components/staff/staff-active-sessions-dialog";
import { messageFromStaffCreateError } from "@/lib/staff-api-errors";
import { AgentIconButton, AgentTemplateConfirmDialog } from "@/components/staff/agent-workspace-template-ui";
import { StaffBulkFloatingBar } from "@/components/staff/staff-bulk-floating-bar";
import {
  StaffFilterSelect,
  StaffWorkspaceFilterPanel,
  StaffWorkspaceHeader,
  StaffWorkspaceLayout,
  StaffWorkspaceTable
} from "@/components/staff/staff-workspace-shell";
import { useStaffKomandaBulk } from "@/hooks/use-staff-komanda-bulk";
import { formatPersonDisplayName } from "@/lib/person-display";
import {
  StaffKomandaActiveSessionsCell,
  StaffKomandaApkCell,
  StaffKomandaAppAccessToggle,
  StaffKomandaBranchCell,
  StaffKomandaCodeCell,
  StaffKomandaDeviceCell,
  StaffKomandaFioCell,
  StaffKomandaLoginCell,
  StaffKomandaMaxSessionsCell,
  StaffKomandaPhoneCell,
  StaffKomandaPinflCell,
  StaffKomandaPositionCell,
  StaffKomandaTagList,
  StaffKomandaTerritoryCell
} from "@/components/staff/staff-komanda-table-cells";

type CollectorRow = {
  id: number;
  fio: string;
  first_name?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
  login: string;
  phone: string | null;
  code: string | null;
  pinfl: string | null;
  branch: string | null;
  position: string | null;
  apk_version: string | null;
  app_access: boolean;
  territory: string | null;
  device_name: string | null;
  active_session_count: number;
  max_sessions: number;
  cash_desks?: Array<{ id: number; name: string }>;
  is_active: boolean;
};

const COLS = [
  "Ф.И.О",
  "Авторизоваться",
  "Кассы",
  "Территории",
  "Телефон",
  "Код",
  "Название устройства",
  "ПИНФЛ",
  "Филиал",
  "Должность",
  "Версия APK",
  "Доступ к приложение",
  "Количество активных сессий",
  "Максимальное количество сессий"
] as const;

const COLLECTOR_TABLE_ID = "staff.collectors.v1";
const COLLECTOR_COLUMN_IDS = [
  "fio",
  "login",
  "cash_desks",
  "territory",
  "phone",
  "code",
  "device_name",
  "pinfl",
  "branch",
  "position",
  "apk_version",
  "app_access",
  "active_sessions",
  "max_sessions"
] as const;
const COLLECTOR_COLUMNS = COLLECTOR_COLUMN_IDS.map((id, i) => ({
  id,
  label: COLS[i] ?? id
}));
const COLLECTOR_COLUMN_LABEL_BY_ID = new Map<string, string>(
  COLLECTOR_COLUMNS.map((c) => [c.id, c.label])
);

type Props = { tenantSlug: string };

export function CollectorsWorkspace({ tenantSlug }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [search, setSearch] = useState("");
  const [draftPos, setDraftPos] = useState("");
  const [draftTerritory, setDraftTerritory] = useState("");
  const [appliedPos, setAppliedPos] = useState("");
  const [appliedTerritory, setAppliedTerritory] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [editRow, setEditRow] = useState<CollectorRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [sessionRow, setSessionRow] = useState<CollectorRow | null>(null);
  const [deactivateRow, setDeactivateRow] = useState<CollectorRow | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const tablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: COLLECTOR_TABLE_ID,
    defaultColumnOrder: [...COLLECTOR_COLUMN_IDS],
    defaultPageSize: 10,
    allowedPageSizes: DEFAULT_TABLE_PAGE_SIZES
  });
  const pageSize = tablePrefs.pageSize;

  useEffect(() => {
    setSelected(new Set());
  }, [tab]);

  const filterQ = useQuery({
    queryKey: ["collectors-filter-options", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: { positions: string[]; territories: string[] } }>(
        `/api/${tenantSlug}/collectors/filter-options`
      );
      return data.data;
    }
  });

  const listQ = useQuery({
    queryKey: ["collectors", tenantSlug, tab, appliedPos, appliedTerritory],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set("is_active", tab === "active" ? "true" : "false");
      if (appliedPos.trim()) p.set("position", appliedPos.trim());
      if (appliedTerritory.trim()) p.set("territory", appliedTerritory.trim());
      const { data } = await api.get<{ data: CollectorRow[] }>(`/api/${tenantSlug}/collectors?${p.toString()}`);
      return data.data;
    }
  });

  const patchMut = useMutation({
    mutationFn: async (vars: { id: number; body: Record<string, unknown> }) => {
      const { data } = await api.patch<CollectorRow>(`/api/${tenantSlug}/collectors/${vars.id}`, vars.body);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["collectors", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["collectors-filter-options", tenantSlug] });
    }
  });

  const createMut = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await api.post<CollectorRow>(`/api/${tenantSlug}/collectors`, body);
      return data;
    },
    onSuccess: () => {
      setCreateError(null);
      setAddOpen(false);
      void qc.invalidateQueries({ queryKey: ["collectors", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["collectors-filter-options", tenantSlug] });
    },
    onError: (e: unknown) => {
      const ax = e as AxiosError<{ error?: string; message?: string }>;
      const flat = getZodFlattenFromApiErrorBody(ax.response?.data);
      if (flat) {
        const hint = firstValidationUserHint(flat);
        setCreateError(withApiSupportLine(hint ?? "Ma'lumotlarni tekshiring.", e));
        return;
      }
      setCreateError(messageFromStaffCreateError(e));
    }
  });

  const deactivateMut = useMutation({
    mutationFn: async (id: number) => {
      await api.patch(`/api/${tenantSlug}/collectors/${id}`, { is_active: false });
    },
    onSuccess: () => {
      setDeactivateRow(null);
      void qc.invalidateQueries({ queryKey: ["collectors", tenantSlug] });
    }
  });

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const src = listQ.data ?? [];
    if (!q) return src;
    return src.filter((r) =>
      [
        r.fio,
        r.login,
        r.phone ?? "",
        r.code ?? "",
        r.pinfl ?? "",
        r.branch ?? "",
        r.position ?? "",
        r.device_name ?? "",
        r.territory ?? "",
        ...(r.cash_desks ?? []).map((c) => c.name)
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [listQ.data, search]);

  const total = filteredRows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, safePage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [tab, appliedPos, appliedTerritory, search, pageSize]);

  useEffect(() => {
    setSelected(new Set());
  }, [tab, appliedPos, appliedTerritory, safePage, pageSize]);

  const applyFilters = () => {
    setAppliedPos(draftPos);
    setAppliedTerritory(draftTerritory);
  };

  const resetFilters = () => {
    setDraftPos("");
    setDraftTerritory("");
    setAppliedPos("");
    setAppliedTerritory("");
    setPage(1);
  };

  const toggleSelection = (id: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAllOnPage = (checked: boolean) => {
    if (checked) setSelected(new Set(pageRows.map((r) => r.id)));
    else setSelected(new Set());
  };

  const allPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));

  const selectedRows = useMemo(
    () => filteredRows.filter((r) => selected.has(r.id)),
    [filteredRows, selected]
  );

  const bulk = useStaffKomandaBulk({
    tenantSlug,
    apiSegment: "collectors",
    invalidateQueryKeys: [
      ["collectors", tenantSlug],
      ["collectors-filter-options", tenantSlug]
    ],
    selectedIds: selected,
    setSelectedIds: setSelected,
    selectedRows
  });

  function exportCellString(r: CollectorRow, colId: string): string {
    switch (colId) {
      case "fio":
        return formatPersonDisplayName(r);
      case "login":
        return r.login;
      case "cash_desks":
        return (r.cash_desks ?? []).map((c) => c.name).join("; ");
      case "territory":
        return r.territory ?? "";
      case "phone":
        return r.phone ?? "";
      case "code":
        return r.code ?? "";
      case "device_name":
        return r.device_name ?? "";
      case "pinfl":
        return r.pinfl ?? "";
      case "branch":
        return r.branch ?? "";
      case "position":
        return r.position ?? "";
      case "apk_version":
        return r.apk_version ?? "";
      case "app_access":
        return r.app_access ? "Да" : "Нет";
      case "active_sessions":
        return String(r.active_session_count);
      case "max_sessions":
        return String(r.max_sessions);
      default:
        return "";
    }
  }

  function renderDataCell(colId: string, r: CollectorRow) {
    switch (colId) {
      case "fio":
        return (
          <StaffKomandaFioCell
            first_name={r.first_name}
            last_name={r.last_name}
            middle_name={r.middle_name}
            fio={r.fio}
          />
        );
      case "login":
        return <StaffKomandaLoginCell login={r.login} />;
      case "cash_desks":
        return (
          <StaffKomandaTagList items={(r.cash_desks ?? []).map((x) => x.name)} maxVisible={2} />
        );
      case "territory":
        return <StaffKomandaTerritoryCell territory={r.territory} />;
      case "phone":
        return <StaffKomandaPhoneCell phone={r.phone} />;
      case "code":
        return <StaffKomandaCodeCell code={r.code} />;
      case "device_name":
        return <StaffKomandaDeviceCell name={r.device_name} />;
      case "pinfl":
        return <StaffKomandaPinflCell pinfl={r.pinfl} />;
      case "branch":
        return <StaffKomandaBranchCell branch={r.branch} />;
      case "position":
        return <StaffKomandaPositionCell position={r.position} />;
      case "apk_version":
        return <StaffKomandaApkCell version={r.apk_version} />;
      case "app_access":
        return (
          <StaffKomandaAppAccessToggle
            checked={r.app_access}
            disabled={patchMut.isPending}
            onChange={(next) => patchMut.mutate({ id: r.id, body: { app_access: next } })}
          />
        );
      case "active_sessions":
        return (
          <StaffKomandaActiveSessionsCell
            count={r.active_session_count}
            max={r.max_sessions}
            onClick={() => setSessionRow(r)}
          />
        );
      case "max_sessions":
        return <StaffKomandaMaxSessionsCell max={r.max_sessions} />;
      default:
        return "—";
    }
  }

  return (
    <StaffWorkspaceLayout>
      <StaffWorkspaceHeader
        title="Инкассатор"
        subtitle="Управление инкассаторами: территории, кассы, доступ к приложению и контроль сессий"
        addLabel="Добавить инкассатора"
        onAdd={() => {
          setCreateError(null);
          setAddOpen(true);
        }}
        onColumnSettings={() => setColumnDialogOpen(true)}
      />

      <StaffWorkspaceFilterPanel
        filters={
          <>
            <StaffFilterSelect
              label="Должность"
              value={draftPos}
              onChange={setDraftPos}
              emptyLabel="Все должности"
            >
              {(filterQ.data?.positions ?? []).map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </StaffFilterSelect>
            <StaffFilterSelect
              label="Территория"
              value={draftTerritory}
              onChange={setDraftTerritory}
              emptyLabel="Все территории"
            >
              {(filterQ.data?.territories ?? []).map((x) => (
                <option key={x} value={x}>
                  {x}
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
        onPageSizeChange={(n) => tablePrefs.setPageSize(n)}
        allOnPageSelected={allPageSelected}
        onToggleAllOnPage={toggleAllOnPage}
        onColumnSettings={() => setColumnDialogOpen(true)}
        onSearch={setSearch}
        searchPlaceholder="Поиск по ФИО, коду, телефону…"
        onExport={() => {
          const order = tablePrefs.visibleColumnOrder;
          const headers = order.map((id) => COLLECTOR_COLUMN_LABEL_BY_ID.get(id) ?? id);
          const exportData = filteredRows.map((r) => order.map((colId) => exportCellString(r, colId)));
          downloadXlsxSheet(
            `collectors_${tab}_${new Date().toISOString().slice(0, 10)}.xlsx`,
            "Инкассаторы",
            headers,
            exportData
          );
        }}
        onRefresh={() => void listQ.refetch()}
        isFetching={listQ.isFetching}
      />

      <TableColumnSettingsDialog
        open={columnDialogOpen}
        onOpenChange={setColumnDialogOpen}
        title="Управление столбцами"
        description="Выберите видимые столбцы и порядок. Сохраняется для вашей учётной записи."
        columns={COLLECTOR_COLUMNS}
        columnOrder={tablePrefs.columnOrder}
        hiddenColumnIds={tablePrefs.hiddenColumnIds}
        saving={tablePrefs.saving}
        onSave={(next) => tablePrefs.saveColumnLayout(next)}
        onReset={() => tablePrefs.resetColumnLayout()}
      />

      <StaffWorkspaceTable
        columnOrder={tablePrefs.visibleColumnOrder}
        columnLabelById={COLLECTOR_COLUMN_LABEL_BY_ID}
        pageRows={pageRows}
        filteredTotal={total}
        entityLabel="инкассаторов"
        page={safePage}
        totalPages={pageCount}
        onPageChange={setPage}
        isLoading={listQ.isLoading}
        selectedIds={selected}
        onToggleSelection={toggleSelection}
        renderCell={(colId, row) => renderDataCell(colId, pageRows.find((r) => r.id === row.id)!)}
        renderActions={(row) => {
          const r = pageRows.find((x) => x.id === row.id)!;
          return (
            <div className="flex items-center justify-end gap-1">
              <AgentIconButton title="Сессии" onClick={() => setSessionRow(r)}>
                <MonitorSmartphone className="h-4 w-4" />
              </AgentIconButton>
              <AgentIconButton title="Редактировать" onClick={() => setEditRow(r)}>
                <Pencil className="h-4 w-4 text-amber-600" />
              </AgentIconButton>
              {tab === "active" ? (
                <AgentIconButton title="Деактивировать" onClick={() => setDeactivateRow(r)}>
                  <UserMinus className="h-4 w-4 text-rose-600" />
                </AgentIconButton>
              ) : null}
            </div>
          );
        }}
      />

      <StaffBulkFloatingBar
        count={selected.size}
        allAccessOn={bulk.allAccessOn}
        isActiveTab={tab === "active"}
        busy={bulk.bulkBusy}
        onToggleAccess={bulk.onToggleAccess}
        onToggleActive={() => bulk.onRequestToggleActive(tab === "active")}
        onClearSessions={bulk.onClearSessions}
        onClearSelection={() => setSelected(new Set())}
      />

      <AgentTemplateConfirmDialog
        open={bulk.confirmBulk != null}
        message={bulk.confirmMessage}
        busy={bulk.bulkBusy}
        onCancel={() => bulk.setConfirmBulk(null)}
        onConfirm={bulk.handleConfirmBulk}
      />

      <CollectorEditDialog row={editRow} onClose={() => setEditRow(null)} onPatch={(id, body) => patchMut.mutateAsync({ id, body })} />
      <CollectorAddDialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) setCreateError(null);
        }}
        loading={createMut.isPending}
        submitError={createError}
        onSubmit={(body) => {
          setCreateError(null);
          createMut.mutate(body);
        }}
      />

      <StaffActiveSessionsDialog
        open={sessionRow != null}
        onOpenChange={(o) => !o && setSessionRow(null)}
        tenantSlug={tenantSlug}
        staffKind="collector"
        userId={sessionRow?.id ?? null}
        maxSessions={sessionRow?.max_sessions ?? 1}
        onPatched={() => void qc.invalidateQueries({ queryKey: ["collectors", tenantSlug] })}
      />

      <Dialog open={Boolean(deactivateRow)} onOpenChange={(o) => !o && setDeactivateRow(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Деактивировать инкассатора</DialogTitle>
          </DialogHeader>
          <p className="text-sm">Вы хотите деактивировать инкассатора?</p>
          <DialogFooter className="flex-row justify-end gap-2 border-0 bg-transparent p-0">
            <Button type="button" variant="outline" onClick={() => setDeactivateRow(null)}>
              Нет
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deactivateMut.isPending}
              onClick={() => deactivateRow && deactivateMut.mutate(deactivateRow.id)}
            >
              Да
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StaffWorkspaceLayout>
  );
}

function CollectorEditDialog({
  row,
  onClose,
  onPatch
}: {
  row: CollectorRow | null;
  onClose: () => void;
  onPatch: (id: number, body: Record<string, unknown>) => Promise<unknown>;
}) {
  const [saving, setSaving] = useState(false);
  const [first_name, setFirst] = useState("");
  const [last_name, setLast] = useState("");
  const [middle_name, setMid] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [pinfl, setPinfl] = useState("");
  const [branch, setBranch] = useState("");
  const [position, setPosition] = useState("");
  const [territory, setTerritory] = useState("");

  useEffect(() => {
    if (!row) return;
    const parts = row.fio.split(/\s+/);
    setLast(parts[0] ?? "");
    setFirst(parts[1] ?? parts[0] ?? "");
    setMid(parts[2] ?? "");
    setPhone(row.phone ?? "");
    setCode(row.code ?? "");
    setPinfl(row.pinfl ?? "");
    setBranch(row.branch ?? "");
    setPosition(row.position ?? "");
    setTerritory(row.territory ?? "");
  }, [row]);

  return (
    <Dialog open={Boolean(row)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Редактировать</DialogTitle>
        </DialogHeader>
        <WorkplaceMovedNotice className="mb-2" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Имя" value={first_name} onChange={(e) => setFirst(e.target.value)} />
          <Input placeholder="Фамилия" value={last_name} onChange={(e) => setLast(e.target.value)} />
          <Input placeholder="Отчество" value={middle_name} onChange={(e) => setMid(e.target.value)} />
          <Input placeholder="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input placeholder="Код" value={code} onChange={(e) => setCode(e.target.value)} />
          <Input placeholder="ПИНФЛ" value={pinfl} onChange={(e) => setPinfl(e.target.value)} />
          <Input placeholder="Должность" value={position} onChange={(e) => setPosition(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button
            disabled={saving || !row}
            onClick={async () => {
              if (!row) return;
              setSaving(true);
              try {
                await onPatch(row.id, {
                  first_name: first_name.trim(),
                  last_name: last_name.trim() || null,
                  middle_name: middle_name.trim() || null,
                  phone: phone.trim() || null,
                  code: code.trim() || null,
                  pinfl: pinfl.trim() || null,
                  position: position.trim() || null
                });
                onClose();
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CollectorAddDialog({
  open,
  onOpenChange,
  loading,
  submitError,
  onSubmit
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  submitError: string | null;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [first_name, setFirst] = useState("");
  const [last_name, setLast] = useState("");
  const [middle_name, setMid] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [pinfl, setPinfl] = useState("");
  const [branch, setBranch] = useState("");
  const [position, setPosition] = useState("");
  const [territory, setTerritory] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [can_authorize, setCanAuthorize] = useState(true);
  const [app_access, setAppAccess] = useState(true);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setFirst("");
          setLast("");
          setMid("");
          setPhone("");
          setCode("");
          setPinfl("");
          setBranch("");
          setPosition("");
          setTerritory("");
          setLogin("");
          setPassword("");
          setCanAuthorize(true);
          setAppAccess(true);
        }
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Добавить инкассатора</DialogTitle>
        </DialogHeader>
        <WorkplaceMovedNotice className="mb-2" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Имя *" value={first_name} onChange={(e) => setFirst(e.target.value)} />
          <Input placeholder="Фамилия" value={last_name} onChange={(e) => setLast(e.target.value)} />
          <Input placeholder="Отчество" value={middle_name} onChange={(e) => setMid(e.target.value)} />
          <Input placeholder="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input placeholder="Код" value={code} onChange={(e) => setCode(e.target.value)} />
          <Input placeholder="ПИНФЛ" value={pinfl} onChange={(e) => setPinfl(e.target.value)} />
          <Input placeholder="Должность" value={position} onChange={(e) => setPosition(e.target.value)} />
          <Input className="sm:col-span-2 font-mono" placeholder="Логин *" value={login} onChange={(e) => setLogin(e.target.value)} />
          <Input className="sm:col-span-2" type="password" placeholder="Пароль * (min 6)" value={password} onChange={(e) => setPassword(e.target.value)} />
          <label className="inline-flex items-center gap-2 text-xs">
            <input type="checkbox" checked={can_authorize} onChange={(e) => setCanAuthorize(e.target.checked)} />
            Авторизация включена
          </label>
          <label className="inline-flex items-center gap-2 text-xs">
            <input type="checkbox" checked={app_access} onChange={(e) => setAppAccess(e.target.checked)} />
            Доступ к приложению
          </label>
        </div>
        {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            disabled={loading || !first_name.trim() || !login.trim() || password.trim().length < 6}
            onClick={() =>
              onSubmit({
                first_name: first_name.trim(),
                last_name: last_name.trim() || null,
                middle_name: middle_name.trim() || null,
                phone: phone.trim() || null,
                code: code.trim() || null,
                pinfl: pinfl.trim() || null,
                position: position.trim() || null,
                login: login.trim(),
                password,
                can_authorize,
                app_access
              })
            }
          >
            {loading ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
