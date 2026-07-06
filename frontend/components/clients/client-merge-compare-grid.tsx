"use client";

import type { ClientMapPoint } from "@/components/clients/clients-leaflet-map";
import { cn } from "@/lib/utils";
import {
  Ban,
  Box,
  Calendar,
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  Gift,
  Hash,
  Check,
  Pin,
  X
} from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
  buildMergeSections,
  cellTone,
  conflictLevelForRow,
  parseBalanceNumber,
  teamPart,
  type ClientDedupePreview,
  type MergeFieldDef,
  type MergeSectionDef
} from "./client-merge-compare-shared";

const MergeCompareClientsMap = dynamic(
  () => import("@/components/clients/clients-leaflet-map").then((mod) => ({ default: mod.ClientsLeafletMap })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[340px] w-full items-center justify-center rounded-xl border border-border bg-muted text-sm text-slate-500">
        Карта…
      </div>
    )
  }
);

const LABEL_W = "w-[260px]";
const COL_W = "w-[320px]";

/** Chap yon panel — faqat gorizontal scroll da qotadi; vertikal scroll jadval bilan birga */
const LABEL_STICKY_CELL = cn(
  LABEL_W,
  "sticky left-0 z-20 shrink-0 border-r border-border/80 bg-muted shadow-[4px_0_10px_-2px_rgba(15,23,42,0.06)]"
);
const LABEL_STICKY_CORNER = cn(LABEL_STICKY_CELL, "z-30 border-r-0 shadow-none");

const ROW_MIN = "min-h-[44px]";
const HEADER_SLOT_H = "h-[42px]";

type GroupKey = "balance" | "requisites" | "extra" | "stats" | "teams" | "location";

const DEFAULT_EXPANDED: Record<GroupKey, boolean> = {
  balance: true,
  requisites: false,
  extra: false,
  stats: true,
  teams: false,
  location: true
};

function sectionToGroupKey(id: string): GroupKey | null {
  if (id === "balance" || id === "requisites" || id === "extra" || id === "stats") return id;
  return null;
}

function isMasterColumn(i: number, c: ClientDedupePreview | null, masterId: number | null): boolean {
  return i === 0 && c != null && masterId != null && c.id === masterId;
}

function isPlaceholderColumn(i: number, c: ClientDedupePreview | null): boolean {
  return i === 0 && c == null;
}

function dataCellClass(i: number, c: ClientDedupePreview | null, masterId: number | null, extra?: string) {
  if (isPlaceholderColumn(i, c)) {
    return cn(COL_W, "mx-1.5 shrink-0 border-x-2 border-dashed border-border bg-card px-3", extra);
  }
  return cn(
    COL_W,
    "mx-1.5 shrink-0 border-x bg-card px-3",
    isMasterColumn(i, c, masterId) ? "border-x-emerald-500 bg-emerald-50/25" : "border-border",
    extra
  );
}

export function MergeCompareGrid(props: {
  previews: ClientDedupePreview[];
  masterId: number | null;
  setMasterId: (id: number | null) => void;
  hiddenIds: Set<number>;
  onHideClient: (id: number) => void;
}) {
  const { previews, masterId, setMasterId, hiddenIds, onHideClient } = props;
  const sections = useMemo(() => buildMergeSections(), []);
  const visible = useMemo(() => previews.filter((p) => !hiddenIds.has(p.id)), [previews, hiddenIds]);

  const master = useMemo(
    () => (masterId != null ? visible.find((p) => p.id === masterId) ?? null : null),
    [visible, masterId]
  );
  const others = useMemo(() => visible.filter((p) => p.id !== masterId), [visible, masterId]);
  const displayColumns = useMemo(
    (): (ClientDedupePreview | null)[] => (master ? [master, ...others] : [null, ...visible]),
    [master, others, visible]
  );

  const [expanded, setExpanded] = useState<Record<GroupKey, boolean>>(DEFAULT_EXPANDED);
  const toggle = (k: GroupKey) => setExpanded((p) => ({ ...p, [k]: !p[k] }));

  const maxTeams = useMemo(
    () => Math.max(0, ...visible.map((p) => p.team_lines?.length ?? 0)),
    [visible]
  );

  const mapClients: ClientMapPoint[] = useMemo(() => {
    const out: ClientMapPoint[] = [];
    for (const p of visible) {
      const lat = Number(String(p.latitude ?? "").replace(/,/g, "."));
      const lon = Number(String(p.longitude ?? "").replace(/,/g, "."));
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      out.push({
        id: p.id,
        name: p.name,
        legal_name: p.legal_name,
        phone: p.phone,
        address: p.address,
        category: p.category,
        client_type_code: p.client_type_code,
        credit_limit: p.credit_limit ?? "0",
        is_active: p.is_active,
        account_balance: p.balance ?? "0",
        responsible_person: p.responsible_person,
        landmark: p.landmark,
        inn: p.inn,
        pdl: null,
        logistics_service: null,
        license_until: null,
        working_hours: null,
        region: p.region,
        district: null,
        city: p.city,
        neighborhood: null,
        street: null,
        house_number: null,
        apartment: null,
        gps_text: null,
        visit_date: null,
        notes: p.notes,
        client_format: p.client_format,
        client_code: p.client_code,
        sales_channel: p.sales_channel,
        product_category_ref: p.product_category_ref,
        bank_name: p.bank_name,
        bank_account: p.bank_account,
        bank_mfo: p.bank_mfo,
        client_pinfl: p.client_pinfl,
        oked: p.oked,
        contract_number: p.contract_number,
        vat_reg_code: p.vat_reg_code,
        latitude: p.latitude,
        longitude: p.longitude,
        zone: p.zone,
        agent_id: null,
        agent_name: null,
        agent_assignments: [],
        contact_persons: [],
        created_at: p.updated_at,
        lat,
        lon
      } as ClientMapPoint);
    }
    return out;
  }, [visible]);

  const toggleMaster = (clientId: number) => {
    setMasterId(masterId === clientId ? null : clientId);
  };

  const rowProps = {
    displayColumns,
    allPreviews: visible,
    masterId,
    toggleMaster,
    onHideClient
  };

  return (
    <div className="scrollbar-none h-full min-h-0 overflow-auto">
      <div className="min-w-max bg-muted">
        {/* Ustun sarlavhalari — shablon: bo‘sh chap burchak + ustunlar */}
        <div className="flex p-4 pb-2">
          <div className={cn(LABEL_STICKY_CORNER, HEADER_SLOT_H, "shrink-0")} />
          {displayColumns.map((client, idx) => (
            <div key={client?.id ?? `ph-${idx}`} className={cn(COL_W, "mx-1.5 shrink-0")}>
              {client ? (
                <div
                  className={cn(
                    "flex items-center justify-between rounded-t-xl border-x border-t px-4 py-2.5",
                    HEADER_SLOT_H,
                    isMasterColumn(idx, client, masterId)
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-border bg-card"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleMaster(client.id)}
                    className="flex min-w-0 items-center gap-2 text-[13px] font-bold text-slate-700"
                    title={isMasterColumn(idx, client, masterId) ? "Открепить (закрепить)" : "Закрепить как мастера"}
                  >
                    <Pin
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isMasterColumn(idx, client, masterId) ? "rotate-45 text-emerald-600" : "text-slate-300"
                      )}
                    />
                    <span className="truncate">#{client.id}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onHideClient(client.id)}
                    className="shrink-0 text-slate-400 hover:text-rose-500"
                    title="Скрыть из сравнения"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div
                  className={cn(
                    "flex min-h-[72px] flex-col items-center justify-center gap-2 rounded-t-xl border-2 border-dashed border-border bg-card px-3 py-3 text-center",
                    HEADER_SLOT_H
                  )}
                >
                  <span className="text-[13px] font-medium leading-snug text-slate-500">Выберите один объект</span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-muted">
                    <Check className="h-5 w-5 text-slate-400" strokeWidth={2} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Barcha qatorlar — vertikal scroll birga; chap label sticky left */}
        <div className="flex flex-col gap-0.5 px-4 pb-10">
          {sections.map((section) => (
            <SectionBlock key={section.id} section={section} expanded={expanded} toggle={toggle} {...rowProps} />
          ))}

          <TeamsBlock expanded={expanded.teams} onToggle={() => toggle("teams")} maxTeams={maxTeams} {...rowProps} />

          <LocationBlock
            expanded={expanded.location}
            onToggle={() => toggle("location")}
            mapClients={mapClients}
            {...rowProps}
          />
        </div>
      </div>
    </div>
  );
}

function SectionBlock(props: {
  section: MergeSectionDef;
  expanded: Record<GroupKey, boolean>;
  toggle: (k: GroupKey) => void;
  displayColumns: (ClientDedupePreview | null)[];
  allPreviews: ClientDedupePreview[];
  masterId: number | null;
  toggleMaster: (id: number) => void;
  onHideClient: (id: number) => void;
}) {
  const { section, expanded, toggle, displayColumns, allPreviews, masterId } = props;
  const groupKey = sectionToGroupKey(section.id);
  const isExpandable = section.expandable && groupKey != null;
  const isOpen = !isExpandable || (groupKey ? expanded[groupKey] : true);

  if (isExpandable && groupKey) {
    return (
      <>
        <GroupHeaderRow
          label={section.label}
          expanded={expanded[groupKey]}
          onToggle={() => toggle(groupKey)}
          displayColumns={displayColumns}
          isBalance={section.isBalance}
          masterId={masterId}
        />
        {isOpen
          ? section.fields.map((field) => (
              <FieldRow
                key={field.key}
                field={field}
                displayColumns={displayColumns}
                allPreviews={allPreviews}
                masterId={masterId}
              />
            ))
          : null}
      </>
    );
  }

  return (
    <>
      {section.fields.map((field) => (
        <FieldRow
          key={field.key}
          field={field}
          displayColumns={displayColumns}
          allPreviews={allPreviews}
          masterId={masterId}
        />
      ))}
    </>
  );
}

function GroupHeaderRow(props: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  displayColumns: (ClientDedupePreview | null)[];
  isBalance?: boolean;
  masterId: number | null;
}) {
  const { label, expanded, onToggle, displayColumns, isBalance, masterId } = props;
  return (
    <div className={cn("flex items-stretch", ROW_MIN)}>
      <div className={cn(LABEL_STICKY_CELL, "flex items-center gap-2 px-5 py-3")}>
        <button type="button" onClick={onToggle} className="flex items-center gap-2 text-[13px] font-bold text-slate-700">
          {expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
          {label}
        </button>
      </div>
      {displayColumns.map((c, i) => (
        <div
          key={i}
          className={dataCellClass(i, c, masterId, cn("flex items-center py-2", isBalance ? "justify-end" : "justify-between"))}
        >
          {c && isBalance ? (
            <span className="text-[13px] font-bold text-emerald-700 tabular-nums">
              {parseBalanceNumber(c.balance).toLocaleString("ru-RU")} UZS
            </span>
          ) : c && !isBalance ? (
            <span className="text-[13px] font-medium text-emerald-700">{label}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function FieldRow(props: {
  field: MergeFieldDef;
  displayColumns: (ClientDedupePreview | null)[];
  allPreviews: ClientDedupePreview[];
  masterId: number | null;
}) {
  const { field, displayColumns, allPreviews, masterId } = props;
  return (
    <div className={cn("group flex items-stretch hover:bg-muted/50", ROW_MIN)}>
      <div
        className={cn(
          LABEL_STICKY_CELL,
          "flex items-center gap-2 px-5 py-2 text-[13px] text-slate-600 group-hover:bg-muted/80",
          field.indent ? "pl-10" : ""
        )}
      >
        {field.dot ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/80" /> : null}
        {field.indent && !field.dot ? <span className="h-1 w-1 shrink-0 rounded-full bg-slate-300" /> : null}
        <span className="truncate">{field.label}</span>
      </div>
      {displayColumns.map((c, i) => (
        <div key={i} className={dataCellClass(i, c, masterId, "flex items-center py-1.5")}>
          {!c ? <div className={cn("w-full", ROW_MIN)} aria-hidden /> : (
            <div className="w-full">
              <MergeCell field={field} preview={c} allPreviews={allPreviews} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MergeCell(props: {
  field: MergeFieldDef;
  preview: ClientDedupePreview;
  allPreviews: ClientDedupePreview[];
}) {
  const { field, preview, allPreviews } = props;
  const text = field.get(preview);
  const values = allPreviews.map((x) => field.get(x));
  const level = conflictLevelForRow(values, { pinfl: field.pinfl });
  const tone = cellTone(level);

  if (field.variant === "currency") {
    const n = parseBalanceNumber(text);
    return (
      <div
        className={cn(
          "flex h-9 w-full items-center justify-end rounded-md border px-2 text-[13px] tabular-nums",
          tone,
          n < 0 ? "font-semibold text-red-700" : n > 0 ? "text-emerald-700" : "text-slate-500"
        )}
      >
        {text}
      </div>
    );
  }

  if (field.variant === "input") {
    return (
      <div className={cn("flex h-9 w-full items-center gap-2 rounded-md border border-border bg-card px-3 text-[13px]", tone)}>
        <span className="block min-w-0 flex-1 truncate">{text}</span>
        {field.copy ? <Copy className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : null}
      </div>
    );
  }

  if (field.variant === "dropdown") {
    return (
      <div
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-border bg-card px-3 text-[13px]",
          tone
        )}
      >
        <span className="truncate">{text}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </div>
    );
  }

  if (field.variant === "stat" && field.statIcon) {
    const icon = statIcon(field.statIcon);
    const plain = field.statIcon === "code" || field.statIcon === "date";
    return (
      <div
        className={cn(
          "flex h-9 w-full items-center justify-between px-3 text-[13px]",
          !plain && "rounded-md border border-border",
          tone
        )}
      >
        <span className="truncate tabular-nums">{text}</span>
        <span className="shrink-0 text-emerald-500">{icon}</span>
      </div>
    );
  }

  return (
    <div className={cn("flex h-9 w-full items-center rounded-md border px-2 text-[13px] font-medium text-slate-700", tone)}>
      {text}
    </div>
  );
}

function statIcon(kind: NonNullable<MergeFieldDef["statIcon"]>) {
  const cls = "h-4 w-4";
  switch (kind) {
    case "orders":
      return <FileText className={cn(cls, "text-emerald-500")} />;
    case "unfinished":
      return <FileText className={cn(cls, "text-slate-400")} />;
    case "cancel":
      return <Ban className={cn(cls, "text-rose-400")} />;
    case "bonus":
      return <Gift className={cn(cls, "text-emerald-500")} />;
    case "equipment":
      return <Box className={cn(cls, "text-emerald-500")} />;
    case "code":
      return <Hash className={cn(cls, "text-slate-400")} />;
    case "date":
      return <Calendar className={cn(cls, "text-slate-400")} />;
    default:
      return null;
  }
}

function TeamsBlock(props: {
  expanded: boolean;
  onToggle: () => void;
  displayColumns: (ClientDedupePreview | null)[];
  maxTeams: number;
  masterId: number | null;
}) {
  const { expanded, onToggle, displayColumns, maxTeams, masterId } = props;
  if (maxTeams === 0) return null;

  return (
    <>
      <div className={cn("flex items-stretch", ROW_MIN)}>
        <div className={cn(LABEL_STICKY_CELL, "flex items-center gap-2 px-5 py-3")}>
          <button type="button" onClick={onToggle} className="flex items-center gap-2 text-[13px] font-bold text-slate-700">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Команды
          </button>
        </div>
        {displayColumns.map((c, i) => (
          <div key={i} className={dataCellClass(i, c, masterId, "flex items-center py-2")}>
            {c ? (
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: c.team_lines?.length ?? 0 }).map((_, idx) => (
                  <span
                    key={idx}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white"
                  >
                    {idx + 1}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {expanded
        ? Array.from({ length: maxTeams }).map((_, teamIdx) => (
            <div key={teamIdx}>
              <TeamSubRow label="Название команды" teamIdx={teamIdx + 1} part={0} {...props} />
              <TeamSubRow label="Агент" teamIdx={teamIdx + 1} part={1} {...props} />
              <TeamSubRow label="Экспедитор" teamIdx={teamIdx + 1} part={2} {...props} />
            </div>
          ))
        : null}
    </>
  );
}

function TeamSubRow(props: {
  label: string;
  teamIdx: number;
  part: 0 | 1 | 2;
  displayColumns: (ClientDedupePreview | null)[];
  masterId: number | null;
}) {
  const { label, teamIdx, part, displayColumns, masterId } = props;
  return (
    <div className={cn("group flex items-stretch hover:bg-muted", ROW_MIN)}>
      <div className={cn(LABEL_STICKY_CELL, "flex items-center gap-2 px-10 py-1.5 text-[12px] text-slate-500 group-hover:bg-muted")}>
        <span className="h-1 w-1 shrink-0 rounded-full bg-slate-300" />
        <span className="truncate">{label}</span>
      </div>
      {displayColumns.map((c, i) => (
        <div key={i} className={dataCellClass(i, c, masterId, "flex items-center py-1.5")}>
          {c && (c.team_lines?.length ?? 0) >= teamIdx ? (
            <span className="block truncate text-[12px] text-slate-700">{teamPart(c.team_lines, teamIdx, part)}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function LocationBlock(props: {
  expanded: boolean;
  onToggle: () => void;
  mapClients: ClientMapPoint[];
  displayColumns: (ClientDedupePreview | null)[];
  masterId: number | null;
}) {
  const { expanded, onToggle, mapClients, masterId } = props;
  return (
    <>
      <div className={cn("flex items-stretch", ROW_MIN)}>
        <div className={cn(LABEL_STICKY_CELL, "flex items-center gap-2 px-5 py-3")}>
          <button type="button" onClick={onToggle} className="flex items-center gap-2 text-[13px] font-bold text-slate-700">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Локация
          </button>
        </div>
        {props.displayColumns.map((c, i) => (
          <div key={i} className={dataCellClass(i, c, masterId, "py-2")} />
        ))}
      </div>
      {expanded ? (
        <div className="flex">
          <div className={cn(LABEL_STICKY_CELL, "shrink-0")} />
          <div className="min-w-0 flex-1 px-1.5 py-4">
            <div className="overflow-hidden rounded-xl border border-border bg-muted shadow-inner">
              {mapClients.length > 0 ? (
                <MergeCompareClientsMap
                  clients={mapClients}
                  selectedClientId={masterId}
                  heightPx={340}
                  hideBuiltinControls
                />
              ) : (
                <div className="flex h-[340px] items-center justify-center text-sm text-slate-500">
                  Нет координат у клиентов группы
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
