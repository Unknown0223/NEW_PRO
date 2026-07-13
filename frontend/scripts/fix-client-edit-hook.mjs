#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const monolith = readFileSync(path.join(root, "components/clients/client-edit/client-edit-form.monolith.tsx"), "utf8").split(/\r?\n/);
const imports = monolith.slice(0, 32).join("\n");
const body = monolith.slice(465, 1169).join("\n");

const retNames = [
  "isCreateMode", "effectiveClientId", "clientQ", "mutation", "localError", "fieldErrors", "tab", "setTab",
  "name", "setName", "legalName", "setLegalName", "phone", "setPhone", "isActive", "setIsActive",
  "creditLimit", "setCreditLimit", "category", "setCategory", "clientTypeCode", "setClientTypeCode",
  "address", "setAddress", "responsiblePerson", "setResponsiblePerson", "landmark", "setLandmark",
  "inn", "setInn", "pdl", "setPdl", "logisticsService", "setLogisticsService", "licenseUntil", "setLicenseUntil",
  "workingHours", "setWorkingHours", "region", "setRegion", "city", "setCity", "street", "setStreet",
  "houseNumber", "setHouseNumber", "apartment", "setApartment", "gpsText", "setGpsText", "notes", "setNotes",
  "clientFormat", "setClientFormat", "clientCode", "setClientCode", "salesChannel", "setSalesChannel",
  "productCategoryRef", "setProductCategoryRef", "bankName", "setBankName", "bankAccount", "setBankAccount",
  "bankMfo", "setBankMfo", "clientPinfl", "setClientPinfl", "oked", "setOked", "contractNumber", "setContractNumber",
  "vatRegCode", "setVatRegCode", "latitude", "setLatitude", "longitude", "setLongitude", "zone", "setZone",
  "mapSearchText", "setMapSearchText", "mapSearchPending", "mapSearchNotice", "setMapSearchNotice",
  "agentSlots", "setAgentSlots", "slot1LockType", "setSlot1LockType", "slot1LockReason", "setSlot1LockReason",
  "saveNotice", "inputCls", "selectCls", "latParsed", "lonParsed", "mapOk", "yandexMapsHref", "applyPickedCoords",
  "handleMapSearch", "onRegionSelect", "onCitySelect", "onZoneSelect", "catOpts", "typeOpts", "formatOpts",
  "terrOpts", "cascadedCityOpts", "cascadedZoneOpts", "prodCatOpts", "salesOpts", "logOpts",
  "agentTeamSelectOptions", "expeditorTeamSelectOptions", "agentsPickerQ", "expeditorsPickerQ",
  "territoryAgentPickerCtxQ", "onCancel", "onSuccess"
];

writeFileSync(
  path.join(root, "components/clients/client-edit/hooks/use-client-edit-form.ts"),
  `"use client";

${imports}
import { invalidateClientAuditQueries } from "@/lib/client-audit-history";
import { STALE } from "@/lib/query-stale";
import { useFormIntentTracking } from "@/lib/activity-tracker";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { pickCityTerritoryHint } from "@/lib/city-territory-hint";
import { mergeRefOptions } from "@/lib/merge-ref-options";
import { mergeRefSelectOptions } from "@/lib/ref-select-options";
import { orderAgentFilterOption, orderExpeditorFilterOption } from "@/lib/order-picker-labels";
import {
  type ClientDetailApi,
  isoToDateInput,
  pinflForApi,
  emptyAgentSlot,
  buildAgentSlots,
  toggleWeekday,
  dateInputToIso,
  parseCoordsFromLocationText,
  normalizeCoord,
  inLatRange,
  inLonRange,
  MAP_DEFAULT_LAT,
  MAP_DEFAULT_LON,
  MAX_TEAM_ROWS,
  VISIT_DAYS
} from "../client-edit-form.utils";
import { agentAssignmentsFieldHint } from "../client-edit-form-ui";

export type ClientEditFormVm = ReturnType<typeof useClientEditForm>;

export function useClientEditForm({
  tenantSlug,
  clientId,
  mode = "edit",
  onSuccess,
  onCancel,
  redirectOnSuccess = true
}: {
  tenantSlug: string | null;
  clientId?: number;
  mode?: "edit" | "create";
  onSuccess: (clientId: number) => void;
  onCancel: () => void;
  redirectOnSuccess?: boolean;
}) {
${body}

  return {
${retNames.map((n) => `    ${n},`).join("\n")}
  };
}
`
);

writeFileSync(
  path.join(root, "components/clients/client-edit/client-edit-form-view.tsx"),
  `"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { cn } from "@/lib/utils";
import { ClientEditFormExtraTab } from "./client-edit-form-extra-tab";
import { ClientEditFormMainTab } from "./client-edit-form-main-tab";
import { useClientEditForm } from "./hooks/use-client-edit-form";

export function ClientEditForm(props: Parameters<typeof useClientEditForm>[0]) {
  const vm = useClientEditForm(props);
  const { isCreateMode, clientQ, onCancel, tab, setTab } = vm;

  if (!isCreateMode && clientQ.isError) {
    return (
      <div className="space-y-4">
        <PageHeader title="Редактирование клиента" description="Ошибка загрузки" />
        <p className="text-sm text-destructive">Не удалось загрузить карточку.</p>
        <Button type="button" variant="outline" onClick={onCancel}>
          Назад
        </Button>
      </div>
    );
  }

  if (!isCreateMode && !clientQ.data && clientQ.isLoading) {
    return <p className="text-sm text-muted-foreground">Загрузка…</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-[min(100%,90rem)] flex-col gap-4 px-3 pb-10 pt-1 sm:px-4 lg:px-6">
      <PageHeader
        title={isCreateMode ? "Создание клиента" : "Редактирование клиента"}
        description={
          isCreateMode
            ? "Создание клиента: структура и связи как в редактировании, начальные поля пустые."
            : "На основной вкладке: сверху ввод с клавиатуры, ниже — выбор из справочников. Команда и карта справа."
        }
        actions={
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Назад
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
        <div className="flex flex-wrap gap-3">
          <span>
            <span className="text-blue-600 dark:text-blue-400">■</span> Ввод с клавиатуры
          </span>
          <span>
            <span className="text-emerald-700 dark:text-emerald-400">■</span> Выбор из справочников (
            <Link href="/settings/spravochnik/client-lists" className="underline underline-offset-2">
              справочники клиента
            </Link>
            ,{" "}
            <Link href="/settings/spravochnik/agents" className="underline underline-offset-2">
              агенты
            </Link>
            ,{" "}
            <Link href="/settings/spravochnik/expeditors" className="underline underline-offset-2">
              экспедиторы
            </Link>
            )
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {(
          [
            ["main", "Основные сведения"],
            ["extra", "Дополнительно"]
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={cn(
              "rounded-t-md border border-b-0 px-3 py-2 text-sm font-medium transition-colors",
              tab === id
                ? "border-border bg-background text-foreground"
                : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted/60"
            )}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <ClientEditFormMainTab vm={vm} />
      <ClientEditFormExtraTab vm={vm} />

      {vm.localError ? <p className="text-sm text-destructive">{vm.localError}</p> : null}
      {vm.saveNotice ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{vm.saveNotice}</p> : null}

      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={vm.mutation.isPending}>
          Отмена
        </Button>
        <Button type="button" onClick={() => vm.mutation.mutate()} disabled={vm.mutation.isPending}>
          {vm.mutation.isPending ? (isCreateMode ? "Создание…" : "Сохранение…") : isCreateMode ? "Добавить" : "Сохранить"}
        </Button>
        {!isCreateMode && vm.effectiveClientId > 0 ? (
          <Link href={"/clients/" + vm.effectiveClientId} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            К карточке
          </Link>
        ) : null}
      </div>
    </div>
  );
}
`
);

console.log("fixed client hook + view");
