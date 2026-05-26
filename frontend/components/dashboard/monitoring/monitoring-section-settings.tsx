"use client";

import {
  MONITORING_SECTION_SETTINGS_ITEMS,
  type MonitoringSectionId
} from "@/components/dashboard/monitoring/monitoring-section-config";
import { SupervisorDashboardMultiFilter } from "@/components/dashboard/supervisor-dashboard-multi-filter";
import { useMemo } from "react";

export function MonitoringSectionSettingsFilter({
  visibleSectionIds,
  onVisibleChange,
  triggerClassName
}: {
  visibleSectionIds: Set<MonitoringSectionId>;
  onVisibleChange: (next: Set<MonitoringSectionId>) => void;
  triggerClassName?: string;
}) {
  const selectedValues = useMemo(
    () => MONITORING_SECTION_SETTINGS_ITEMS.filter((row) => visibleSectionIds.has(row.id)).map((r) => r.id),
    [visibleSectionIds]
  );

  const items = useMemo(
    () =>
      MONITORING_SECTION_SETTINGS_ITEMS.map((row) => ({
        id: row.id,
        title: row.label,
        searchText: row.label
      })),
    []
  );

  return (
    <SupervisorDashboardMultiFilter
      placeholder="Настройки разделов"
      searchPlaceholder="Поиск"
      triggerClassName={triggerClassName}
      items={items}
      selectedValues={selectedValues}
      minPopoverWidth={300}
      maxListHeightClass="max-h-64"
      onChange={(keys) => {
        const next = new Set(keys as MonitoringSectionId[]);
        onVisibleChange(next);
      }}
    />
  );
}
