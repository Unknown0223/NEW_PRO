"use client";

import {
  DateTimePickerField,
  localValueToDatetimeInput
} from "@/components/ui/datetime-popover";
import { cn } from "@/lib/utils";

type Props = {
  value: Date;
  onChange: (d: Date) => void;
  className?: string;
  disabled?: boolean;
};

function addHours(base: Date, h: number): Date {
  const d = new Date(base);
  d.setHours(d.getHours() + h);
  return d;
}

function tomorrowAt(hour: number, minute: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function PriceMatrixEffectiveDatetime({ value, onChange, className, disabled }: Props) {
  const iso = localValueToDatetimeInput(value);

  return (
    <DateTimePickerField
      value={iso}
      disabled={disabled}
      timePlacement="side"
      className={cn("h-10 w-full min-w-[11rem]", className)}
      onChange={(next) => {
        const d = new Date(next);
        if (!Number.isNaN(d.getTime())) onChange(d);
      }}
      quickPresets={[
        { label: "Hozir", value: new Date() },
        { label: "+1 soat", value: addHours(new Date(), 1) },
        { label: "Ertaga 00:00", value: tomorrowAt(0, 0) }
      ]}
    />
  );
}
