"use client";

import {
  MONITORING_SECTION_SETTINGS_ITEMS,
  type MonitoringSectionId
} from "@/components/dashboard/monitoring/monitoring-section-config";
import { SupervisorDashboardMultiFilter } from "@/components/dashboard/supervisor-dashboard-multi-filter";
import { useMemo } from "react";

/** «Настройки разделов» — shablon ro‘yxati; bir nechta yorliq bitta bo‘limga bog‘lanishi mumkin. */
export function MonitoringSectionSettingsFilter({
  visibleSectionIds,
  onVisibleChange,
  triggerClassName
}: {
  visibleSectionIds: Set<MonitoringSectionId>;
  onVisibleChange: (next: Set<MonitoringSectionId>) => void;
  triggerClassName?: string;
}) {
  const selectedRowKeys = useMemo(() => {
    const keys: string[] = [];
    MONITORING_SECTION_SETTINGS_ITEMS.forEach((row, idx) => {
      if (visibleSectionIds.has(row.id)) keys.push(`${row.id}::${idx}`);
    });
    return keys;
  }, [visibleSectionIds]);

  const items = useMemo(
    () =>
      MONITORING_SECTION_SETTINGS_ITEMS.map((row, idx) => ({
        id: `${row.id}::${idx}`,
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
      selectedValues={selectedRowKeys}
      minPopoverWidth={300}
      maxListHeightClass="max-h-64"
      onChange={(keys) => {
        const next = new Set<MonitoringSectionId>();
        for (const key of keys) {
          const id = key.split("::")[0] as MonitoringSectionId;
          next.add(id);
        }
        if (keys.length === 0) {
          onVisibleChange(new Set());
          return;
        }
        onVisibleChange(next);
      }}
    />
  );
}

