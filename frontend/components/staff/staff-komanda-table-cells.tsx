"use client";

import {
  Building2,
  Calendar,
  MapPin,
  Smartphone,
  Users as UsersIcon
} from "lucide-react";
import { StaffFioCell } from "@/components/staff/staff-fio-cell";
import {
  formatAgentCreatedDate,
  formatAgentDateTime
} from "@/components/staff/agent-workspace-template-ui";
import type { PersonNameParts } from "@/lib/person-display";
import { formatApkVersion, formatDeviceName } from "@/lib/mobile-device-display";
import { cn } from "@/lib/utils";

export function StaffKomandaFioCell(
  props: PersonNameParts & { kpiColor?: string | null }
) {
  return (
    <StaffFioCell
      first_name={props.first_name}
      last_name={props.last_name}
      middle_name={props.middle_name}
      fio={props.fio}
      kpiColor={props.kpiColor}
      showAvatar
    />
  );
}

export function StaffKomandaLoginCell({ login }: { login: string }) {
  return <span className="font-mono text-xs text-slate-700">{login}</span>;
}

export function StaffKomandaPhoneCell({ phone }: { phone?: string | null }) {
  return <span className="font-mono text-xs text-slate-700">{phone || "—"}</span>;
}

export function StaffKomandaCodeCell({ code }: { code?: string | null }) {
  return <span className="font-mono text-xs text-slate-900">{code ?? "—"}</span>;
}

export function StaffKomandaPinflCell({ pinfl }: { pinfl?: string | null }) {
  return <span className="font-mono text-xs text-slate-600">{pinfl ?? "—"}</span>;
}

export function StaffKomandaApkCell({ version }: { version?: string | null }) {
  return (
    <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-slate-700">
      {formatApkVersion(version)}
    </span>
  );
}

export function StaffKomandaDeviceCell({ name }: { name?: string | null }) {
  return (
    <div className="flex items-center gap-2">
      <Smartphone className="h-4 w-4 text-teal-600" />
      <div className="text-xs leading-tight">
        <p className="font-medium text-slate-900">{formatDeviceName(name)}</p>
      </div>
    </div>
  );
}

export function StaffKomandaLastSyncCell({ at }: { at?: string | null }) {
  return <span className="text-xs text-slate-600">{formatAgentDateTime(at)}</span>;
}

export function StaffKomandaWarehouseCell({ warehouse }: { warehouse?: string | null }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-700">
      <MapPin className="h-3.5 w-3.5 text-slate-400" />
      {warehouse ?? "—"}
    </div>
  );
}

export function StaffKomandaBranchCell({ branch }: { branch?: string | null }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-700">
      <Building2 className="h-3.5 w-3.5 text-slate-400" />
      {branch ?? "—"}
    </div>
  );
}

export function StaffKomandaPositionCell({ position }: { position?: string | null }) {
  return <span className="text-xs text-slate-700">{position ?? "—"}</span>;
}

export function StaffKomandaCreatedAtCell({ at }: { at?: string | null }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-600">
      <Calendar className="h-3.5 w-3.5 text-slate-400" />
      {formatAgentCreatedDate(at)}
    </div>
  );
}

export function StaffKomandaTradeDirectionCell({ value }: { value?: string | null }) {
  return value ? (
    <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200">
      {value}
    </span>
  ) : (
    "—"
  );
}

export function StaffKomandaTerritoryCell({ territory }: { territory?: string | null }) {
  return <span className="max-w-[14rem] text-xs text-slate-700">{territory ?? "—"}</span>;
}

export function StaffKomandaAppAccessToggle({
  checked,
  disabled,
  onChange
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(!checked)}
      />
      <div
        className={cn(
          "relative h-5 w-9 rounded-full bg-muted transition peer-checked:bg-teal-500",
          disabled && "opacity-60"
        )}
      >
        <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-card shadow transition peer-checked:translate-x-4" />
      </div>
      <span className="ml-2 text-xs text-slate-600">{checked ? "Вкл" : "Выкл"}</span>
    </label>
  );
}

export function StaffKomandaActiveSessionsCell({
  count,
  max,
  onClick
}: {
  count: number;
  max: number;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <UsersIcon className="h-3.5 w-3.5 text-slate-400" />
      <button
        type="button"
        className={cn(
          "text-sm font-semibold hover:underline",
          count >= max ? "text-rose-600" : "text-slate-900"
        )}
        onClick={onClick}
      >
        {count}
      </button>
    </div>
  );
}

export function StaffKomandaMaxSessionsCell({ max }: { max: number }) {
  return <span className="text-sm text-slate-600">{max}</span>;
}

export function StaffKomandaTagList({
  items,
  maxVisible = 2
}: {
  items: string[];
  maxVisible?: number;
}) {
  if (!items.length) return "—";
  const shown = items.slice(0, maxVisible);
  const rest = items.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((p) => (
        <span
          key={p}
          className="rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700 ring-1 ring-teal-200"
        >
          {p}
        </span>
      ))}
      {rest > 0 ? (
        <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-slate-600">
          ещё {rest}
        </span>
      ) : null}
    </div>
  );
}

export function StaffKomandaYesNoCell({ value }: { value: boolean }) {
  return <span className="text-xs text-slate-700">{value ? "Да" : "Нет"}</span>;
}
