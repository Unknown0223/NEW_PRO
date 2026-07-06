import {
  INITIAL_SETUP_GROUPS,
  INITIAL_SETUP_STEPS,
  canStartStep,
  getStepById
} from "@/lib/initial-setup/catalog";
import type { InitialSetupStep } from "@/lib/initial-setup/types";
import { flattenTerritoryNodes } from "@/lib/initial-setup/profile-to-preview";

/** Boshlang‘ich sozlash oqimidagi barcha qadamlar — `order` bo‘yicha. */
export function getColdStartSteps(): InitialSetupStep[] {
  const ids = new Set(
    INITIAL_SETUP_GROUPS.filter((g) => g.inColdStartFlow).flatMap((g) => g.stepIds)
  );
  return INITIAL_SETUP_STEPS.filter((s) => ids.has(s.id)).sort((a, b) => a.order - b.order);
}

export function sortStepsByFlowOrder(steps: InitialSetupStep[]): InitialSetupStep[] {
  const order = new Map(getColdStartSteps().map((s) => [s.id, s.order]));
  return [...steps].sort((a, b) => (order.get(a.id) ?? a.order) - (order.get(b.id) ?? b.order));
}

export function sortStepIdsByFlowOrder(stepIds: string[]): string[] {
  const order = new Map(getColdStartSteps().map((s) => [s.id, s.order]));
  return [...stepIds].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
}

export type ProfileReadiness = {
  name?: string;
  phone?: string | null;
  address?: string | null;
  references?: Record<string, unknown>;
};

/** Tizimda allaqachon to‘ldirilgan qadamlar — progress belgilanmasa ham bog‘liqlik ochiladi. */
export function systemSatisfiedStepIds(
  profile?: ProfileReadiness | null,
  extras?: {
    warehousesCount?: number;
    productCategoriesCount?: number;
    tradeDirectionsCount?: number;
    salesChannelsCount?: number;
  }
): Set<string> {
  const ids = new Set<string>();
  const refs = profile?.references ?? {};

  if (profile?.name?.trim()) ids.add("company");

  const territoryRows = flattenTerritoryNodes(refs.territory_nodes);
  if (territoryRows.length) ids.add("territory");

  if (Array.isArray(refs.branches) && refs.branches.length) ids.add("branches");
  if (Array.isArray(refs.unit_measures) && refs.unit_measures.length) ids.add("units");
  if (Array.isArray(refs.currency_entries) && refs.currency_entries.length) ids.add("currencies");
  if (Array.isArray(refs.payment_method_entries) && refs.payment_method_entries.length) {
    ids.add("payment-methods");
  }
  if (Array.isArray(refs.price_type_entries) && refs.price_type_entries.length) ids.add("price-types");
  if (Array.isArray(refs.client_format_entries) && refs.client_format_entries.length) {
    ids.add("client-formats");
  }
  if (Array.isArray(refs.client_type_entries) && refs.client_type_entries.length) ids.add("client-types");
  if (Array.isArray(refs.client_category_entries) && refs.client_category_entries.length) {
    ids.add("client-categories");
  }

  if ((extras?.tradeDirectionsCount ?? 0) > 0) ids.add("trade-directions");
  if ((extras?.salesChannelsCount ?? 0) > 0) ids.add("sales-channels");
  if ((extras?.warehousesCount ?? 0) > 0) ids.add("warehouses");
  if ((extras?.productCategoriesCount ?? 0) > 0) ids.add("product-categories");

  return ids;
}

export function effectiveDoneIds(
  progressDone: ReadonlySet<string>,
  systemDone: ReadonlySet<string>
): Set<string> {
  return new Set([...progressDone, ...systemDone]);
}

export function isStepReady(
  step: InitialSetupStep,
  doneIds: ReadonlySet<string>
): { ok: boolean; missing: string[] } {
  return canStartStep(step, doneIds);
}

/** Navbatdagi birinchi bajarilmagan qadam (bog‘liqlik bo‘yicha tayyor yoki yo‘q). */
export function getCurrentFlowStep(
  progressDone: ReadonlySet<string>,
  systemDone: ReadonlySet<string>
): InitialSetupStep | undefined {
  void effectiveDoneIds(progressDone, systemDone);
  return getColdStartSteps().find((s) => !progressDone.has(s.id));
}

/** Keyingi qo‘llash mumkin bo‘lgan qadam (bog‘liqlik bajarilgan). */
export function getNextReadyStep(
  progressDone: ReadonlySet<string>,
  systemDone: ReadonlySet<string>
): InitialSetupStep | undefined {
  const done = effectiveDoneIds(progressDone, systemDone);
  return getColdStartSteps().find((s) => !progressDone.has(s.id) && isStepReady(s, done).ok);
}

export function missingDependencyTitles(step: InitialSetupStep, doneIds: ReadonlySet<string>): string[] {
  return step.dependsOn
    .filter((id) => !doneIds.has(id))
    .map((id) => getStepById(id)?.title ?? id);
}
