import { listClientsForTenantPaged } from "../clients/clients.service";
import { listProductsForOrderCreateForm } from "../products/products.service";
import {
  listProductCategoriesForTenant,
  listUsersForOrderAgent,
  listWarehousesForTenant
} from "../reference/reference.service";
import { listStaff, type StaffRow } from "../staff/staff.service";
import { getTenantProfile, type TenantProfileDto } from "../tenant-settings/tenant-settings.service";
import {
  normalizeSelectedId,
  resolveConstraintScope,
  type LinkageConstraintScope,
  type LinkageSelectedMasters
} from "../linkage/linkage.service";
import { prisma } from "../../config/database";
import { priceTypeEntriesFromUnknown, priceTypeKey } from "../tenant-settings/finance-refs";
import { extractMobileConfigFromEntitlementsUnknown } from "../staff/agent-mobile-config";

import { loadOrderCreateCatalogSlice } from "./order-create-context.catalog";

export type OrderCreateContextBundle = {
  clients: Awaited<ReturnType<typeof listClientsForTenantPaged>>["data"];
  products: Awaited<ReturnType<typeof listProductsForOrderCreateForm>>;
  warehouses: Awaited<ReturnType<typeof listWarehousesForTenant>>;
  users: Awaited<ReturnType<typeof listUsersForOrderAgent>>;
  price_types: string[];
  expeditors: StaffRow[];
  settings_profile: TenantProfileDto;
  product_categories: Awaited<ReturnType<typeof listProductCategoriesForTenant>>;
};

/**
 * Yangi zakaz formasi uchun bitta javob: oldin 8 ta alohida HTTP o‘rniga serverda parallel DB.
 */
export async function getOrderCreateContextBundle(
  tenantId: number,
  selected: LinkageSelectedMasters = {}
): Promise<OrderCreateContextBundle> {
  const parseStringArray = (v: unknown): string[] => {
    if (!Array.isArray(v)) return [];
    return v
      .filter((x): x is string => typeof x === "string" && x.trim() !== "")
      .map((s) => s.trim());
  };
  const mergeUnique = (...lists: string[][]): string[] => {
    const out = new Set<string>();
    for (const list of lists) {
      for (const item of list) {
        const t = item.trim();
        if (t) out.add(t);
      }
    }
    return [...out];
  };
  const intersectStrings = (a: string[], b: string[]): string[] => {
    if (a.length === 0 || b.length === 0) return [];
    const bNorm = new Set(b.map((x) => x.trim().toLowerCase()));
    return a.filter((x) => bNorm.has(x.trim().toLowerCase()));
  };

  const ORDER_CREATE_CONTEXT_DEBUG = process.env.ORDER_CREATE_CONTEXT_DEBUG === "1";
  const logDebug = (event: string, payload: Record<string, unknown>) => {
    if (!ORDER_CREATE_CONTEXT_DEBUG) return;
    // eslint-disable-next-line no-console
    console.info(`[order-create-context-debug] ${event}`, payload);
  };

  const prefetchSansAgentScope =
    normalizeSelectedId(selected.selected_client_id) != null &&
    normalizeSelectedId(selected.selected_agent_id) != null;

  const [scope, scopeSansAgentParallel] = await Promise.all([
    resolveConstraintScope(tenantId, selected),
    prefetchSansAgentScope
      ? resolveConstraintScope(tenantId, {
          selected_client_id: selected.selected_client_id ?? undefined,
          selected_expeditor_user_id: selected.selected_expeditor_user_id ?? undefined,
          selected_cash_desk_id: selected.selected_cash_desk_id ?? undefined
        })
      : Promise.resolve<LinkageConstraintScope | null>(null)
  ]);

  logDebug("scope.resolved", {
    tenantId,
    selected,
    constrained: scope.constrained,
    selected_client_id: scope.selected_client_id,
    selected_agent_id: scope.selected_agent_id,
    selected_warehouse_id: scope.selected_warehouse_id,
    selected_expeditor_user_id: scope.selected_expeditor_user_id,
    counts: {
      client_ids: scope.client_ids.length,
      agent_ids: scope.agent_ids.length,
      warehouse_ids: scope.warehouse_ids.length,
      expeditor_ids: scope.expeditor_ids.length,
      product_ids: scope.product_ids.length
    },
    ids_sample: {
      client_ids: scope.client_ids.slice(0, 20),
      agent_ids: scope.agent_ids.slice(0, 20),
      warehouse_ids: scope.warehouse_ids.slice(0, 20),
      expeditor_ids: scope.expeditor_ids.slice(0, 20)
    }
  });

  const clientsPromise = scope.constrained
    ? listClientsForTenantPaged(tenantId, {
        page: 1,
        limit: Math.max(400, scope.client_ids.length || 1),
        is_active: true,
        client_ids: scope.client_ids
      })
    : listClientsForTenantPaged(tenantId, { page: 1, limit: 400, is_active: true });

  const [clientsPaged, catalogSlice, warehouses, users, expeditors, profile] = await Promise.all([
    clientsPromise,
    loadOrderCreateCatalogSlice(tenantId, scope),
    listWarehousesForTenant(tenantId),
    listUsersForOrderAgent(tenantId),
    listStaff(tenantId, "expeditor", {}),
    getTenantProfile(tenantId)
  ]);

  const constrainedProducts = catalogSlice.products;
  const productCategoriesFiltered = catalogSlice.product_categories;

  const [selectedAgent, selectedExpeditor] = await Promise.all([
    scope.selected_agent_id != null
      ? prisma.user.findFirst({
          where: { tenant_id: tenantId, id: scope.selected_agent_id, role: "agent", is_active: true },
          select: { id: true, price_type: true, agent_price_types: true, agent_entitlements: true }
        })
      : Promise.resolve(null),
    scope.selected_expeditor_user_id != null
      ? prisma.user.findFirst({
          where: { tenant_id: tenantId, id: scope.selected_expeditor_user_id, role: "expeditor", is_active: true },
          select: { id: true, expeditor_assignment_rules: true }
        })
      : Promise.resolve(null)
  ]);

  const constrainedClients = clientsPaged.data.filter((c) => {
    if (c.agent_id != null && c.agent_id > 0) return true;
    return c.agent_assignments.some((row) => {
      const hasAgent = row.agent_id != null && row.agent_id > 0;
      const hasExpeditor = row.expeditor_user_id != null && row.expeditor_user_id > 0;
      return hasAgent || hasExpeditor;
    });
  });
  const scopedWarehouseIds = new Set(scope.warehouse_ids);
  const scopedAgentIds = new Set(scope.agent_ids);
  /** Tanlangan agentni almashtirish: klient bor-yo‘qligida `users` ro‘yxati faqat shu agentga qisqarmasin. */
  let scopedAgentIdsForUserPicker = scopedAgentIds;
  if (
    scope.constrained &&
    scope.selected_agent_id != null &&
    scope.selected_client_id != null &&
    scopeSansAgentParallel != null
  ) {
    /** Ombor kesimi agent tanlovi ro‘yxatini juda tor qiladi — tanlov faqat klient + ekspeditor (kassa) bo‘yicha. */
    scopedAgentIdsForUserPicker = new Set(scopeSansAgentParallel.agent_ids);
  }
  if (
    scopedAgentIdsForUserPicker.size === 0 &&
    scope.selected_client_id != null &&
    scope.selected_agent_id != null &&
    users.length > 0
  ) {
    scopedAgentIdsForUserPicker = new Set(users.map((u) => u.id));
  }
  const scopedExpeditorIds = new Set(scope.expeditor_ids);
  const strictWarehouseByClient = scope.selected_client_id != null;
  const constrainedWarehouses = scope.constrained
    ? scope.warehouse_ids.length > 0
      ? warehouses.filter((w) => scopedWarehouseIds.has(w.id))
      : strictWarehouseByClient
        ? []
        : warehouses
    : warehouses;
  const strictAgentScope =
    scope.selected_client_id != null ||
    scope.selected_warehouse_id != null ||
    scope.selected_expeditor_user_id != null;
  const constrainedUsers = scope.constrained
    ? scopedAgentIdsForUserPicker.size > 0
      ? users.filter((u) => scopedAgentIdsForUserPicker.has(u.id))
      : strictAgentScope
        ? []
        : users
    : users;
  const strictExpeditorByClient = scope.selected_client_id != null;
  const constrainedExpeditors = scope.constrained
    ? scope.expeditor_ids.length > 0
      ? expeditors.filter((r) => r.is_active && scopedExpeditorIds.has(r.id))
      : strictExpeditorByClient
        ? []
        : expeditors.filter((r) => r.is_active)
    : expeditors.filter((r) => r.is_active);

  const allPaymentMethods = profile.references.payment_method_entries ?? [];
  const salePriceTypeEntries = priceTypeEntriesFromUnknown(profile.references.price_type_entries).filter(
    (e) => e.active !== false && e.kind === "sale"
  );

  /**
   * Narx turlari manbasi:
   * - avvalo tenant sozlamalaridagi `price_type_entries` (sale, active)
   * - agar sozlama bo‘sh bo‘lsa: minimal `retail` (DB’dagi "tasodifiy" eski qiymatlar chiqib ketmasin)
   *   (oldingi distinct fallback `priceTypesRaw` maxsus tenantlarda aralash qiymatlar berib yuborishi mumkin).
   */
  const price_types = (() => {
    if (salePriceTypeEntries.length > 0) {
      const keys = salePriceTypeEntries.map((e) => priceTypeKey(e)).map((s) => s.trim()).filter(Boolean);
      return Array.from(new Set(keys)).sort((a, b) => a.localeCompare(b, "uz"));
    }
    // Sozlamalar bo‘sh bo‘lsa ham, forma ishlashi uchun kamida bitta qiymat.
    return ["retail"];
  })();
  const paymentMethodIdsByPriceType = new Map<string, Set<string>>();
  for (const entry of salePriceTypeEntries) {
    const key = priceTypeKey(entry).trim().toLowerCase();
    if (!key) continue;
    const pmId = entry.payment_method_id.trim();
    if (!pmId) continue;
    const set = paymentMethodIdsByPriceType.get(key) ?? new Set<string>();
    set.add(pmId);
    paymentMethodIdsByPriceType.set(key, set);
  }

  const agentEnt = selectedAgent?.agent_entitlements;
  const entPriceTypes =
    agentEnt != null && typeof agentEnt === "object" && !Array.isArray(agentEnt)
      ? parseStringArray((agentEnt as Record<string, unknown>).price_types)
      : [];
  const agentPriceTypes = parseStringArray(selectedAgent?.agent_price_types);
  const agentLegacyPriceType = selectedAgent?.price_type?.trim() ? [selectedAgent.price_type.trim()] : [];
  const agentAllowedPriceTypes = mergeUnique(entPriceTypes, agentPriceTypes, agentLegacyPriceType);

  const expRules = selectedExpeditor?.expeditor_assignment_rules;
  const expAllowedPriceTypes =
    expRules != null && typeof expRules === "object" && !Array.isArray(expRules)
      ? parseStringArray((expRules as Record<string, unknown>).price_types)
      : [];

  let restrictedPriceTypes: string[] | null = null;
  if (agentAllowedPriceTypes.length > 0 && expAllowedPriceTypes.length > 0) {
    restrictedPriceTypes = intersectStrings(agentAllowedPriceTypes, expAllowedPriceTypes);
  } else if (agentAllowedPriceTypes.length > 0) {
    restrictedPriceTypes = agentAllowedPriceTypes;
  } else if (expAllowedPriceTypes.length > 0) {
    restrictedPriceTypes = expAllowedPriceTypes;
  }

  let filteredPaymentMethods = allPaymentMethods;
  if (restrictedPriceTypes != null) {
    const allowedMethodIds = new Set<string>();
    for (const pt of restrictedPriceTypes) {
      const matched = paymentMethodIdsByPriceType.get(pt.trim().toLowerCase());
      if (!matched) continue;
      for (const id of matched) allowedMethodIds.add(id);
    }
    /**
     * Agar price_type → payment_method mapping topilmasa, select bo‘sh bo‘lib qolmasin:
     * bunday holatda fallback sifatida barcha usullarni qoldiramiz.
     */
    if (allowedMethodIds.size > 0) {
      filteredPaymentMethods = allPaymentMethods.filter((e) => allowedMethodIds.has(String(e.id).trim()));
    } else {
      logDebug("payment_method_filter.no_mapping_fallback_all", {
        tenantId,
        restrictedPriceTypes,
        salePriceTypeEntries: salePriceTypeEntries.length,
        allPaymentMethods: allPaymentMethods.length
      });
    }
  }

  const agentMobilePolicy = selectedAgent?.agent_entitlements
    ? extractMobileConfigFromEntitlementsUnknown(selectedAgent.agent_entitlements)
    : undefined;
  const disallowedPaymentIds = new Set(
    (agentMobilePolicy?.misc?.disallowed_payment_method_codes ?? [])
      .map((s) => String(s).trim())
      .filter(Boolean)
  );
  if (disallowedPaymentIds.size > 0) {
    filteredPaymentMethods = filteredPaymentMethods.filter((e) => !disallowedPaymentIds.has(String(e.id).trim()));
  }

  // Yakuniy fallback: profil bo‘yicha usullar bor-u, filter 0 qoldirsa — bo‘sh select o‘rniga hammasini beramiz.
  if (filteredPaymentMethods.length === 0 && allPaymentMethods.length > 0) {
    logDebug("payment_method_filter.empty_fallback_all", {
      tenantId,
      selected_agent_id: selectedAgent?.id ?? null,
      selected_expeditor_user_id: selectedExpeditor?.id ?? null,
      allPaymentMethods: allPaymentMethods.length
    });
    filteredPaymentMethods = allPaymentMethods;
  }

  const filteredProfile: TenantProfileDto = {
    ...profile,
    references: {
      ...profile.references,
      payment_method_entries: filteredPaymentMethods
    }
  };

  logDebug("bundle.filtered", {
    tenantId,
    selected,
    before: {
      clients: clientsPaged.data.length,
      products: constrainedProducts.length,
      warehouses: warehouses.length,
      users: users.length,
      expeditors: expeditors.filter((r) => r.is_active).length
    },
    after: {
      clients: constrainedClients.length,
      products: constrainedProducts.length,
      warehouses: constrainedWarehouses.length,
      users: constrainedUsers.length,
      expeditors: constrainedExpeditors.length,
      payment_method_entries: filteredPaymentMethods.length
    },
    selected_agent_only_mode: scope.constrained ? scope.selected_agent_id : null,
    payment_method_filter: {
      selected_agent_id: selectedAgent?.id ?? null,
      selected_expeditor_user_id: selectedExpeditor?.id ?? null,
      agent_allowed_price_types: agentAllowedPriceTypes,
      expeditor_allowed_price_types: expAllowedPriceTypes,
      restricted_price_types: restrictedPriceTypes ?? "all"
    }
  });

  return {
    clients: constrainedClients,
    products: constrainedProducts,
    warehouses: constrainedWarehouses,
    users: constrainedUsers,
    price_types,
    expeditors: constrainedExpeditors,
    settings_profile: filteredProfile,
    product_categories: productCategoriesFiltered
  };
}


export { getOrderCreateCatalogBundle, type OrderCreateCatalogBundle } from "./order-create-context.catalog";
