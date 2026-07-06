"use client";

import {
  ClientMapButtonGroup,
  ClientMapChoiceButton,
  ClientMapFilterActions,
  ClientMapSearchableMultiSelect
} from "@/components/clients/map/client-map-ui";
import {
  CLIENT_MAP_WEEKDAYS,
  type ClientMapFiltersState
} from "@/lib/client-map-filters";
import type { RefSelectOption } from "@/lib/ref-select-options";

const STATUS_OPTS = [
  { value: "all" as const, label: "Все" },
  { value: "active" as const, label: "Активный" },
  { value: "inactive" as const, label: "Не активный" }
];

const EQUIPMENT_OPTS = [
  { value: "all" as const, label: "Все" },
  { value: "with" as const, label: "С оборуд." },
  { value: "without" as const, label: "Без оборуд." }
];

type Props = {
  draft: ClientMapFiltersState;
  onDraftChange: (patch: Partial<ClientMapFiltersState>) => void;
  onApply: () => void;
  onReset: () => void;
  agentOptions: Array<{ value: string; label: string }>;
  categoryOptions: RefSelectOption[];
  clientTypeOptions: RefSelectOption[];
  zoneOptions: RefSelectOption[];
  regionOptions: RefSelectOption[];
  cityOptions: RefSelectOption[];
};

export function ClientMapFiltersPanel({
  draft,
  onDraftChange,
  onApply,
  onReset,
  agentOptions,
  categoryOptions,
  clientTypeOptions,
  zoneOptions,
  regionOptions,
  cityOptions
}: Props) {
  return (
    <div className="client-map-filter-scroll max-h-[calc(100vh-285px)] space-y-4 overflow-y-auto px-3 pb-3 pt-1">
      <ClientMapButtonGroup label="Дни">
        <ClientMapChoiceButton
          active={draft.visitWeekdays.length === 0}
          onClick={() => onDraftChange({ visitWeekdays: [] })}
        >
          Все
        </ClientMapChoiceButton>
        {CLIENT_MAP_WEEKDAYS.map((day) => (
          <ClientMapChoiceButton
            key={day.value}
            active={draft.visitWeekdays.includes(day.value)}
            onClick={() => {
              const next = draft.visitWeekdays.includes(day.value)
                ? draft.visitWeekdays.filter((item) => item !== day.value)
                : [...draft.visitWeekdays, day.value];
              onDraftChange({ visitWeekdays: next });
            }}
          >
            {day.label}
          </ClientMapChoiceButton>
        ))}
      </ClientMapButtonGroup>

      <ClientMapSearchableMultiSelect
        label="Агенты"
        placeholder="Агенты"
        searchPlaceholder="Поиск агента"
        values={draft.agentIds.map(String)}
        options={agentOptions}
        onChange={(ids) =>
          onDraftChange({
            agentIds: ids.map((x) => Number.parseInt(x, 10)).filter((n) => Number.isFinite(n) && n > 0)
          })
        }
      />

      <ClientMapButtonGroup label="Категории">
        <ClientMapChoiceButton
          active={draft.categories.length === 0}
          onClick={() => onDraftChange({ categories: [] })}
        >
          Все
        </ClientMapChoiceButton>
        {categoryOptions.map((category) => (
          <ClientMapChoiceButton
            key={category.value}
            active={draft.categories.includes(category.value)}
            onClick={() => {
              const next = draft.categories.includes(category.value)
                ? draft.categories.filter((item) => item !== category.value)
                : [...draft.categories, category.value];
              onDraftChange({ categories: next });
            }}
          >
            {category.label}
          </ClientMapChoiceButton>
        ))}
      </ClientMapButtonGroup>

      <ClientMapButtonGroup label="Тип клиента">
        <ClientMapChoiceButton
          active={draft.clientTypes.length === 0}
          onClick={() => onDraftChange({ clientTypes: [] })}
        >
          Все
        </ClientMapChoiceButton>
        {clientTypeOptions.map((type) => (
          <ClientMapChoiceButton
            key={type.value}
            active={draft.clientTypes.includes(type.value)}
            onClick={() => {
              const next = draft.clientTypes.includes(type.value)
                ? draft.clientTypes.filter((item) => item !== type.value)
                : [...draft.clientTypes, type.value];
              onDraftChange({ clientTypes: next });
            }}
          >
            {type.label}
          </ClientMapChoiceButton>
        ))}
      </ClientMapButtonGroup>

      <ClientMapButtonGroup label="Статус">
        {STATUS_OPTS.map((status) => (
          <ClientMapChoiceButton
            key={status.value}
            active={draft.status === status.value}
            onClick={() => onDraftChange({ status: status.value })}
          >
            {status.label}
          </ClientMapChoiceButton>
        ))}
      </ClientMapButtonGroup>

      <ClientMapButtonGroup label="Оборудование">
        {EQUIPMENT_OPTS.map((option) => (
          <ClientMapChoiceButton
            key={option.value}
            active={draft.equipment === option.value}
            onClick={() => onDraftChange({ equipment: option.value })}
          >
            {option.label}
          </ClientMapChoiceButton>
        ))}
      </ClientMapButtonGroup>

      <ClientMapSearchableMultiSelect
        label="Зона"
        placeholder="Зона"
        searchPlaceholder="Поиск зоны"
        values={draft.zones}
        options={zoneOptions}
        onChange={(zones) => onDraftChange({ zones })}
      />

      <ClientMapSearchableMultiSelect
        label="Область"
        placeholder="Область"
        searchPlaceholder="Поиск области"
        values={draft.regions}
        options={regionOptions}
        onChange={(regions) => onDraftChange({ regions })}
      />

      <ClientMapSearchableMultiSelect
        label="Город"
        placeholder="Город"
        searchPlaceholder="Поиск города"
        values={draft.cities}
        options={cityOptions}
        onChange={(cities) => onDraftChange({ cities })}
      />

      <ClientMapFilterActions onApply={onApply} onReset={onReset} />
    </div>
  );
}
