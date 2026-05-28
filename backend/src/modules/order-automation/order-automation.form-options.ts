import { getClientReferences } from "../clients/clients.references";
import { listWarehousesForTenant } from "../reference/reference.warehouse.list";
import { listStaff } from "../staff/staff.service";
import {
  defaultCurrencyCodeFromEntries,
  resolveCurrencyEntries
} from "../tenant-settings/finance-refs";
import { getTenantProfile } from "../tenant-settings/tenant-settings.service";
import {
  activeValuesFromClientRefEntries,
  clientRefEntriesFromUnknown
} from "../tenant-settings/tenant-settings.service";
import { isWarehouseEligibleForAutomationScope } from "./order-automation.warehouse-scope";
type TerritoryTreeNode = { name?: string; children?: TerritoryTreeNode[] };

export type FormSelectOption = { value: string; label: string };

export type OrderAutomationFormOptions = {
  agents: { id: number; label: string }[];
  warehouses: { id: number; label: string }[];
  territories: FormSelectOption[];
  payment_methods: FormSelectOption[];
  trade_directions: FormSelectOption[];
  request_types: FormSelectOption[];
  currencies: FormSelectOption[];
  default_currency_code: string;
};

function currencyOptions(profile: Awaited<ReturnType<typeof getTenantProfile>>): {
  options: FormSelectOption[];
  defaultCode: string;
} {
  const entries = resolveCurrencyEntries((profile.references ?? {}) as Record<string, unknown>);
  const active = entries.filter((e) => e.active !== false);
  const options = active.map((e) => ({
    value: e.code,
    label: e.name.trim() || e.code
  }));
  return {
    options,
    defaultCode: defaultCurrencyCodeFromEntries(active.length ? active : entries)
  };
}

function warehouseOptionsForForm(
  warehouses: Awaited<ReturnType<typeof listWarehousesForTenant>>
): { id: number; label: string }[] {
  return warehouses
    .filter((w) => isWarehouseEligibleForAutomationScope(w))
    .sort((a, b) => {
      const aMain = a.type === "main" ? 0 : 1;
      const bMain = b.type === "main" ? 0 : 1;
      if (aMain !== bMain) return aMain - bMain;
      return a.name.localeCompare(b.name, "ru");
    })
    .map((w) => ({ id: w.id, label: w.name.trim() || `#${w.id}` }));
}

function collectTerritoryOptions(
  clientRefs: Awaited<ReturnType<typeof getClientReferences>>,
  territoryNodes: TerritoryTreeNode[] | undefined
): FormSelectOption[] {
  const seen = new Set<string>();
  const out: FormSelectOption[] = [];
  const add = (raw: string) => {
    const t = raw.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push({ value: t, label: t });
  };

  for (const z of clientRefs.zones ?? []) add(String(z));
  for (const r of clientRefs.regions ?? []) add(String(r));
  for (const c of clientRefs.cities ?? []) add(String(c));

  const walk = (nodes: TerritoryTreeNode[]) => {
    for (const n of nodes) {
      if (n.name?.trim()) add(n.name);
      if (n.children?.length) walk(n.children);
    }
  };
  if (territoryNodes?.length) walk(territoryNodes);

  return out.sort((a, b) => a.label.localeCompare(b.label, "ru"));
}

function paymentMethodOptions(profile: Awaited<ReturnType<typeof getTenantProfile>>): FormSelectOption[] {
  const refs = profile.references ?? {};
  const entries = clientRefEntriesFromUnknown(refs.payment_method_entries);
  if (entries.length > 0) {
    return entries
      .filter((e) => e.active !== false)
      .map((e) => {
        const code = e.code?.trim();
        const value = code || e.name.trim();
        return { value, label: e.name.trim() || value };
      })
      .filter((o) => o.value.length > 0);
  }
  const legacy = refs.payment_types;
  if (!Array.isArray(legacy)) return [];
  const seen = new Set<string>();
  const out: FormSelectOption[] = [];
  for (const x of legacy) {
    const t = String(x).trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push({ value: t, label: t });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, "ru"));
}

function requestTypeOptions(profile: Awaited<ReturnType<typeof getTenantProfile>>): FormSelectOption[] {
  const refs = profile.references ?? {};
  const entries = clientRefEntriesFromUnknown(refs.request_type_entries);
  return activeValuesFromClientRefEntries(entries).map((value) => {
    const e = entries.find((x) => (x.code?.trim() || x.name.trim()) === value);
    return { value, label: e?.name.trim() || value };
  });
}

function tradeDirectionOptions(
  profile: Awaited<ReturnType<typeof getTenantProfile>>,
  agents: Awaited<ReturnType<typeof listStaff>>
): FormSelectOption[] {
  const seen = new Set<string>();
  const out: FormSelectOption[] = [];
  const add = (raw: string | null | undefined) => {
    const t = String(raw ?? "").trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push({ value: t, label: t });
  };
  for (const td of profile.references?.trade_directions ?? []) {
    if (typeof td === "string") add(td);
  }
  for (const a of agents) {
    add(a.trade_direction);
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, "ru"));
}

/** Modal va filtrlar uchun bitta manba — linkage filtri yo‘q, to‘liq ro‘yxat. */
export async function getOrderAutomationFormOptions(
  tenantId: number
): Promise<OrderAutomationFormOptions> {
  const [warehouses, agents, profile, clientRefs] = await Promise.all([
    listWarehousesForTenant(tenantId),
    listStaff(tenantId, "agent", { is_active: true }),
    getTenantProfile(tenantId),
    getClientReferences(tenantId)
  ]);

  const territoryNodes = profile.references?.territory_nodes as TerritoryTreeNode[] | undefined;
  const { options: currencies, defaultCode: default_currency_code } = currencyOptions(profile);

  return {
    warehouses: warehouseOptionsForForm(warehouses),
    agents: agents.map((a) => ({ id: a.id, label: a.fio })),
    territories: collectTerritoryOptions(clientRefs, territoryNodes),
    payment_methods: paymentMethodOptions(profile),
    trade_directions: tradeDirectionOptions(profile, agents),
    request_types: requestTypeOptions(profile),
    currencies,
    default_currency_code
  };
}
