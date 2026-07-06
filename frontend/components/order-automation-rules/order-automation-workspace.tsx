"use client";

import {
  AutoConfirmFiltersBar,
  RestrictionFiltersBar,
  type AutoConfirmFilterDraft,
  type RestrictionFilterDraft
} from "@/components/order-automation-rules/automation-filters-bar";
import { AutomationListToolbar, AutomationStatusTabs } from "@/components/order-automation-rules/automation-list-toolbar";
import { AutomationPageHeader } from "@/components/order-automation-rules/automation-page-header";
import { AutomationPagination } from "@/components/order-automation-rules/automation-pagination";
import { AutomationRulesTable } from "@/components/order-automation-rules/automation-rules-table";
import {
  emptyRuleForm,
  formFromRow,
  formToApiBody,
  type AutomationRuleRow
} from "@/components/order-automation-rules/order-automation-types";
import { RuleFormModal } from "@/components/order-automation-rules/rule-form-modal";
import { useOrderAutomationReference } from "@/components/order-automation-rules/use-order-automation-reference";
import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

type TabId = "restrictions" | "auto-confirm";

type ListResponse = {
  data: AutomationRuleRow[];
  total: number;
  page: number;
  limit: number;
};

const emptyRestrictionFilters = (): RestrictionFilterDraft => ({
  agent_user_id: "",
  trade_direction_ref: "",
  payment_method_ref: "",
  warehouse_id: "",
  zone: "",
  region: "",
  city: ""
});

const emptyAutoConfirmFilters = (): AutoConfirmFilterDraft => ({
  execution_type: "",
  request_type_ref: "",
  agent_user_id: "",
  trade_direction_ref: "",
  payment_method_ref: "",
  warehouse_id: ""
});

export function OrderAutomationWorkspace() {
  const hydrated = useAuthStoreHydrated();
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const qc = useQueryClient();

  const [tab, setTab] = useState<TabId>("restrictions");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive">("active");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [restrictionFilterDraft, setRestrictionFilterDraft] = useState(emptyRestrictionFilters);
  const [restrictionFilterApplied, setRestrictionFilterApplied] = useState(emptyRestrictionFilters);
  const [autoFilterDraft, setAutoFilterDraft] = useState(emptyAutoConfirmFilters);
  const [autoFilterApplied, setAutoFilterApplied] = useState(emptyAutoConfirmFilters);

  const [formOpen, setFormOpen] = useState(false);
  const [editRow, setEditRow] = useState<AutomationRuleRow | null>(null);
  const [form, setForm] = useState(emptyRuleForm);
  const [msg, setMsg] = useState<string | null>(null);

  const { filterRefs, refsLoading, refsError, defaultCurrencyCode, refLabelByCode } =
    useOrderAutomationReference();

  const basePath =
    tab === "restrictions" ? "order-restriction-rules" : "order-auto-confirm-rules";

  const listParams = useMemo(() => {
    const p = new URLSearchParams({
      page: String(page),
      limit: String(itemsPerPage),
      is_active: statusFilter === "active" ? "true" : "false"
    });
    if (search.trim()) p.set("search", search.trim());
    const f = tab === "restrictions" ? restrictionFilterApplied : autoFilterApplied;
    if (f.agent_user_id) p.set("agent_user_id", f.agent_user_id);
    if (f.warehouse_id) p.set("warehouse_id", f.warehouse_id);
    if (f.trade_direction_ref) p.set("trade_direction_ref", f.trade_direction_ref);
    if (f.payment_method_ref) p.set("payment_method_ref", f.payment_method_ref);
    if (tab === "restrictions") {
      const rf = f as RestrictionFilterDraft;
      if (rf.zone) p.set("zone", rf.zone);
      if (rf.region) p.set("region", rf.region);
      if (rf.city) p.set("city", rf.city);
    } else {
      const af = f as AutoConfirmFilterDraft;
      if (af.execution_type) p.set("execution_type", af.execution_type);
      if (af.request_type_ref) p.set("request_type_ref", af.request_type_ref);
    }
    return p;
  }, [
    page,
    itemsPerPage,
    statusFilter,
    search,
    tab,
    restrictionFilterApplied,
    autoFilterApplied
  ]);

  const listQ = useQuery({
    queryKey: [basePath, tenantSlug, listParams.toString()],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get<ListResponse>(
        `/api/${tenantSlug}/${basePath}?${listParams.toString()}`
      );
      return data;
    }
  });

  const saveM = useMutation({
    mutationFn: async () => {
      const body = formToApiBody(form, tab === "auto-confirm");
      if (editRow) {
        await api.patch(`/api/${tenantSlug}/${basePath}/${editRow.id}`, body);
      } else {
        await api.post(`/api/${tenantSlug}/${basePath}`, body);
      }
    },
    onSuccess: async () => {
      setFormOpen(false);
      setEditRow(null);
      setForm(emptyRuleForm());
      setMsg("Сохранено");
      await qc.invalidateQueries({ queryKey: [basePath] });
    },
    onError: (e) => setMsg(getUserFacingError(e))
  });

  const deleteM = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/${tenantSlug}/${basePath}/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [basePath] })
  });

  const duplicateM = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/api/${tenantSlug}/${basePath}/${id}/duplicate`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [basePath] })
  });

  const toggleM = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      await api.patch(`/api/${tenantSlug}/${basePath}/${id}`, { is_active: active });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [basePath] })
  });


  const totalPages = Math.max(1, Math.ceil((listQ.data?.total ?? 0) / itemsPerPage));

  const openCreate = useCallback(() => {
    setEditRow(null);
    setForm({ ...emptyRuleForm(), currency_code: defaultCurrencyCode });
    setFormOpen(true);
  }, [defaultCurrencyCode]);

  const openEdit = useCallback(
    (row: AutomationRuleRow) => {
      setEditRow(row);
      const allowedWh = new Set(filterRefs.warehouses.map((w) => w.id));
      const allowedCur = new Set(filterRefs.currencyFilterOpts.map((c) => c.value));
      const base = formFromRow(row, tab === "auto-confirm");
      setForm({
        ...base,
        warehouse_ids: row.warehouse_ids.filter((id) => allowedWh.has(id)).map(String),
        currency_code: allowedCur.has(row.currency_code) ? row.currency_code : defaultCurrencyCode
      });
      setFormOpen(true);
    },
    [tab, filterRefs.warehouses, filterRefs.currencyFilterOpts, defaultCurrencyCode]
  );

  const exportCsv = useCallback(async () => {
    if (!tenantSlug) return;
    const p = new URLSearchParams(listParams);
    p.set("export", "csv");
    p.set("page", "1");
    p.set("limit", "5000");
    const res = await api.get<Blob>(`/api/${tenantSlug}/${basePath}?${p}`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = tab === "restrictions" ? "restriction-rules.csv" : "auto-confirm-rules.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [tenantSlug, basePath, listParams, tab]);

  const handleTabChange = (t: TabId) => {
    setTab(t);
    setPage(1);
    setSearch("");
  };

  if (!hydrated) return null;

  return (
    <div className="-mx-4 -mt-4 flex min-h-[calc(100vh-4rem)] flex-col bg-muted md:-mx-6">
      <AutomationPageHeader
        activeTab={tab}
        onTabChange={handleTabChange}
        onCreateClick={openCreate}
      />

      {msg ? (
        <p className="bg-card px-4 py-2 text-sm text-gray-600" role="status">
          {msg}
        </p>
      ) : null}

      {tab === "restrictions" ? (
        <RestrictionFiltersBar
          draft={restrictionFilterDraft}
          onChange={setRestrictionFilterDraft}
          onApply={() => {
            setRestrictionFilterApplied({ ...restrictionFilterDraft });
            setPage(1);
          }}
          onReset={() => {
            const e = emptyRestrictionFilters();
            setRestrictionFilterDraft(e);
            setRestrictionFilterApplied(e);
            setPage(1);
          }}
          refs={filterRefs}
        />
      ) : (
        <AutoConfirmFiltersBar
          draft={autoFilterDraft}
          onChange={setAutoFilterDraft}
          onApply={() => {
            setAutoFilterApplied({ ...autoFilterDraft });
            setPage(1);
          }}
          onReset={() => {
            const e = emptyAutoConfirmFilters();
            setAutoFilterDraft(e);
            setAutoFilterApplied(e);
            setPage(1);
          }}
          refs={filterRefs}
        />
      )}

      <AutomationStatusTabs status={statusFilter} onChange={(s) => { setStatusFilter(s); setPage(1); }} />

      <AutomationListToolbar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={(n) => { setItemsPerPage(n); setPage(1); }}
        onRefresh={() => listQ.refetch()}
        onExport={() => void exportCsv()}
      />

      <div className="min-h-0 flex-1 overflow-hidden">
        {listQ.isLoading ? (
          <div className="bg-card px-4 py-12 text-center text-sm text-gray-500">Загрузка…</div>
        ) : listQ.isError ? (
          <div className="bg-card px-4 py-12 text-center text-sm text-red-600">
            {getUserFacingError(listQ.error)}
          </div>
        ) : (listQ.data?.data ?? []).length === 0 ? (
          <div className="bg-card px-4 py-12 text-center text-sm text-gray-500">Нет правил</div>
        ) : (
          <AutomationRulesTable
            tab={tab}
            rows={listQ.data?.data ?? []}
            refLabelByCode={refLabelByCode}
            onEdit={openEdit}
            onDelete={(id) => {
              if (window.confirm("Удалить правило?")) deleteM.mutate(id);
            }}
            onToggleActive={(id, active) => toggleM.mutate({ id, active })}
            onDuplicate={(id) => duplicateM.mutate(id)}
          />
        )}
      </div>

      <AutomationPagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={listQ.data?.total ?? 0}
        itemsPerPage={itemsPerPage}
        onPageChange={setPage}
        onItemsPerPageChange={(n) => { setItemsPerPage(n); setPage(1); }}
      />

      <RuleFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditRow(null); }}
        autoConfirm={tab === "auto-confirm"}
        isEdit={Boolean(editRow)}
        form={form}
        setForm={setForm}
        agents={filterRefs.agents}
        warehouses={filterRefs.warehouses}
        paymentMethodFilterOpts={filterRefs.paymentMethodFilterOpts}
        tradeDirectionFilterOpts={filterRefs.tradeDirectionFilterOpts}
        requestTypeFilterOpts={filterRefs.requestTypeFilterOpts}
        territoryMultiselectOpts={filterRefs.territoryMultiselectOpts}
        currencyFilterOpts={filterRefs.currencyFilterOpts}
        refsLoading={refsLoading}
        refsError={refsError}
        onSubmit={() => saveM.mutate()}
        saving={saveM.isPending}
      />
    </div>
  );
}
