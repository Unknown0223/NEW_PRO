"use client";

import { AgentFormField, AgentFormSelect } from "@/components/staff/agent-workspace-template-ui";
import {
  CONSIGNMENT_CLOSE_DAY_OPTIONS,
  CONSIGNMENT_CLOSE_HOUR_OPTIONS,
  CONSIGNMENT_CLOSE_MINUTE_OPTIONS
} from "@/lib/consignment-close-schedule";

export type ConsignmentCloseScheduleFieldsProps = {
  closeDay: string;
  closeHour: string;
  closeMinute: string;
  onCloseDayChange: (v: string) => void;
  onCloseHourChange: (v: string) => void;
  onCloseMinuteChange: (v: string) => void;
  className?: string;
};

/** Konsignatsiya oy yopish: kun / soat / daqiqa — bitta agent va bulk dialog uchun. */
export function ConsignmentCloseScheduleFields({
  closeDay,
  closeHour,
  closeMinute,
  onCloseDayChange,
  onCloseHourChange,
  onCloseMinuteChange,
  className = "grid grid-cols-3 gap-2 border-t border-border/60 pt-2"
}: ConsignmentCloseScheduleFieldsProps) {
  return (
    <div className={className}>
      <AgentFormField label="День месяца">
        <AgentFormSelect
          value={closeDay}
          onChange={onCloseDayChange}
          options={CONSIGNMENT_CLOSE_DAY_OPTIONS.map((d) => ({
            value: String(d),
            label: String(d)
          }))}
        />
      </AgentFormField>
      <AgentFormField label="Часы">
        <AgentFormSelect
          value={closeHour}
          onChange={onCloseHourChange}
          options={CONSIGNMENT_CLOSE_HOUR_OPTIONS.map((h) => ({
            value: String(h),
            label: String(h).padStart(2, "0")
          }))}
        />
      </AgentFormField>
      <AgentFormField label="Минуты">
        <AgentFormSelect
          value={closeMinute}
          onChange={onCloseMinuteChange}
          options={CONSIGNMENT_CLOSE_MINUTE_OPTIONS.map((m) => ({
            value: String(m),
            label: String(m).padStart(2, "0")
          }))}
        />
      </AgentFormField>
    </div>
  );
}
