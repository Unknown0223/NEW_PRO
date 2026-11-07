"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { getUserFacingError } from "@/lib/error-utils";
import { activeBranchNamesFromProfile, type BranchRefRow } from "@/lib/branch-options";
import { staffPickerDisplayName } from "@/lib/person-display";
import { usePermissions } from "@/lib/use-permissions";
import { TIMESHEET_ROLE_LABELS } from "@/components/timesheet/timesheet-shared";
import { TabelSettingsDictionariesPanel, TabelSettingsLocationsPanel } from "./tabel-settings-places";

type StaffOpt = { id: number; fio: string; role?: string };

type PunchMethodKey = "photo" | "video" | "kiosk" | "terminal";

const PUNCH_METHOD_COLS: Array<{ key: PunchMethodKey; label: string }> = [
  { key: "photo", label: "Фото + Face ID" },
  { key: "video", label: "Видео + код" },
  { key: "kiosk", label: "Киоск" },
  { key: "terminal", label: "Терминал" }
];

const PUNCH_MODE_ROLES = Object.keys(TIMESHEET_ROLE_LABELS);

export type TabelSettingsSectionSlug =
  | "lateness-rules"
  | "punch-modes"
  | "punch-video"
  | "face-antifraud"
  | "telegram-attendance"
  | "retention"
  | "locations"
  | "dictionaries";

const TABS: Array<{ slug: TabelSettingsSectionSlug; label: string; href: string }> = [
  { slug: "lateness-rules", label: "Опоздания и штрафы", href: "/settings/tabel/lateness-rules" },
  { slug: "punch-modes", label: "Режимы отметки", href: "/settings/tabel/punch-modes" },
  { slug: "punch-video", label: "Видео и 3-значный код", href: "/settings/tabel/punch-video" },
  { slug: "face-antifraud", label: "Face ID и Анти-фрод", href: "/settings/tabel/face-antifraud" },
  { slug: "telegram-attendance", label: "Telegram-группа", href: "/settings/tabel/telegram-attendance" },
  { slug: "retention", label: "Сроки хранения (Retention)", href: "/settings/tabel/retention" },
  { slug: "locations", label: "Локации и гео-зоны", href: "/settings/tabel/locations" },
  { slug: "dictionaries", label: "Справочники", href: "/settings/tabel/dictionaries" }
];

export function TabelSettingsWorkspace({ section }: { section: TabelSettingsSectionSlug }) {
  const { tenantSlug } = useAuthStore();
  const canEdit = usePermissions().has("settings.tabel_pravila.update");
  const qc = useQueryClient();
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const settingsQ = useQuery({
    queryKey: ["settings", "tabel", tenantSlug],
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const { data } = await api.get<{ data: Record<string, any> }>(`/api/${tenantSlug}/settings/tabel`);
      return data.data;
    }
  });

  const staffQ = useQuery({
    queryKey: ["timesheet", "filters", tenantSlug, "tabel-settings-staff"],
    enabled: Boolean(tenantSlug) && (section === "punch-video" || section === "face-antifraud"),
    queryFn: async () => {
      const { data } = await api.get<{ data: { employees: StaffOpt[] } }>(`/api/${tenantSlug}/timesheet/filters`);
      return data.data.employees ?? [];
    }
  });

  const branchesQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug, "tabel-telegram-branches"],
    enabled: Boolean(tenantSlug) && section === "telegram-attendance",
    queryFn: async () => {
      const { data } = await api.get<{ references?: { branches?: BranchRefRow[] } }>(`/api/${tenantSlug}/settings/profile`);
      return data.references?.branches ?? [];
    }
  });
  const branchNames = useMemo(() => activeBranchNamesFromProfile(branchesQ.data ?? []), [branchesQ.data]);

  const [form, setForm] = useState<Record<string, any> | null>(null);
  const [overrideUserId, setOverrideUserId] = useState("");
  const [kioskUserId, setKioskUserId] = useState("");
  const [branchChatPick, setBranchChatPick] = useState("");
  const [branchChatId, setBranchChatId] = useState("");

  useEffect(() => {
    if (settingsQ.data && !form) setForm(structuredClone(settingsQ.data));
  }, [settingsQ.data, form]);

  const saveMut = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.put<{ data: Record<string, any> }>(`/api/${tenantSlug}/settings/tabel`, payload);
      return data.data;
    },
    onSuccess: async (next) => {
      setForm(structuredClone(next));
      setSavedNotice("Сохранено успешно!");
      await qc.invalidateQueries({ queryKey: ["settings", "tabel", tenantSlug] });
    }
  });

  const runRetentionMut = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: Record<string, number> }>(`/api/${tenantSlug}/settings/tabel/run-retention`, {});
      return data.data;
    },
    onSuccess: (res) => {
      setSavedNotice(`Очистка выполнена: фото=${res.photosPurged ?? 0}, видео=${res.videosPurged ?? 0}, закрыто смен=${res.shiftsClosed ?? 0}`);
    }
  });

  const cur = form ?? settingsQ.data ?? {};
  const lateness = cur.lateness ?? {};
  const pv = cur.punchVideo ?? {};
  const fa = cur.faceAntifraud ?? {};
  const tg = cur.telegram ?? {};
  const ret = cur.retention ?? {};
  const punchModes = (cur.punchModes ?? {}) as {
    methods?: Partial<Record<PunchMethodKey, boolean>>;
    byRole?: Record<string, Partial<Record<PunchMethodKey, boolean>>>;
  };
  const punchMethods = {
    photo: punchModes.methods?.photo !== false,
    video: punchModes.methods?.video !== false,
    kiosk: punchModes.methods?.kiosk !== false,
    terminal: punchModes.methods?.terminal !== false
  };
  const punchByRole = punchModes.byRole ?? {};

  const staffById = useMemo(() => {
    const map = new Map<number, StaffOpt>();
    for (const e of staffQ.data ?? []) map.set(e.id, e);
    return map;
  }, [staffQ.data]);

  const overrides = useMemo(() => {
    const raw = (pv.userOverrides ?? {}) as Record<string, { enabled?: boolean; codeRequired?: boolean }>;
    return Object.entries(raw)
      .map(([id, row]) => ({
        id: Number(id),
        enabled: row.enabled !== false,
        codeRequired: row.codeRequired !== false
      }))
      .filter((r) => Number.isFinite(r.id) && r.id > 0)
      .sort((a, b) => {
        const an = staffPickerDisplayName(staffById.get(a.id) ?? { fio: `#${a.id}` });
        const bn = staffPickerDisplayName(staffById.get(b.id) ?? { fio: `#${b.id}` });
        return an.localeCompare(bn, "ru");
      });
  }, [pv.userOverrides, staffById]);

  const overrideOptions = useMemo(() => {
    const taken = new Set(overrides.map((o) => o.id));
    return (staffQ.data ?? [])
      .filter((e) => !taken.has(e.id))
      .map((e) => ({ id: e.id, name: staffPickerDisplayName(e) }))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [staffQ.data, overrides]);

  function setPunchVideo(next: Record<string, unknown>) {
    setForm({ ...cur, punchVideo: { ...pv, ...next } });
  }

  function setPunchModes(next: { methods?: Partial<Record<PunchMethodKey, boolean>>; byRole?: Record<string, Partial<Record<PunchMethodKey, boolean>>> }) {
    setForm({
      ...cur,
      punchModes: {
        methods: { ...punchMethods, ...(next.methods ?? {}) },
        byRole: next.byRole !== undefined ? next.byRole : punchByRole
      }
    });
  }

  function setBaseMethod(key: PunchMethodKey, value: boolean) {
    setPunchModes({ methods: { [key]: value } });
  }

  function setRoleMethod(role: string, key: PunchMethodKey, value: boolean | null) {
    const next = { ...punchByRole };
    const prev = { ...(next[role] ?? {}) };
    if (value === null) {
      delete prev[key];
      if (Object.keys(prev).length === 0) delete next[role];
      else next[role] = prev;
    } else {
      next[role] = { ...prev, [key]: value };
    }
    setPunchModes({ byRole: next });
  }

  function roleMethodValue(role: string, key: PunchMethodKey): "default" | "on" | "off" {
    const o = punchByRole[role];
    if (!o || typeof o[key] !== "boolean") return "default";
    return o[key] ? "on" : "off";
  }

  function clearRoleOverrides(role: string) {
    const next = { ...punchByRole };
    delete next[role];
    setPunchModes({ byRole: next });
  }

  function setFaceAntifraud(next: Record<string, unknown>) {
    setForm({ ...cur, faceAntifraud: { ...fa, ...next } });
  }

  function setTelegram(next: Record<string, unknown>) {
    setForm({ ...cur, telegram: { ...tg, ...next } });
  }

  function setRetention(next: Record<string, unknown>) {
    setForm({ ...cur, retention: { ...ret, ...next } });
  }

  function setPhotoPolicy(kind: "in" | "out" | "estimated_out", next: Record<string, unknown>) {
    const prev = (ret[kind] ?? {}) as Record<string, unknown>;
    setRetention({ [kind]: { ...prev, ...next } });
  }

  const branchChatRows = useMemo(() => {
    const raw = (tg.branchChatIds ?? {}) as Record<string, string>;
    return Object.entries(raw)
      .filter(([, chat]) => String(chat ?? "").trim())
      .map(([branch, chat]) => ({ branch, chat: String(chat).trim() }))
      .sort((a, b) => a.branch.localeCompare(b.branch, "ru"));
  }, [tg.branchChatIds]);

  const branchChatOptions = useMemo(() => {
    const taken = new Set(branchChatRows.map((r) => r.branch));
    return branchNames.filter((b) => !taken.has(b));
  }, [branchNames, branchChatRows]);

  const kioskLeaderIds = useMemo(() => {
    const raw = Array.isArray(fa.kioskLeaderIds) ? fa.kioskLeaderIds : [];
    return raw.map((x: unknown) => Number(x)).filter((x: number) => Number.isInteger(x) && x > 0);
  }, [fa.kioskLeaderIds]);

  const kioskLeaders = useMemo(
    () =>
      kioskLeaderIds
        .map((id) => ({ id, name: staffPickerDisplayName(staffById.get(id) ?? { fio: `Сотрудник #${id}` }) }))
        .sort((a, b) => a.name.localeCompare(b.name, "ru")),
    [kioskLeaderIds, staffById]
  );

  const kioskOptions = useMemo(() => {
    const taken = new Set(kioskLeaderIds);
    return (staffQ.data ?? [])
      .filter((e) => !taken.has(e.id))
      .map((e) => ({ id: e.id, name: staffPickerDisplayName(e) }))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [staffQ.data, kioskLeaderIds]);

  function setUserOverride(userId: number, patch: { enabled?: boolean; codeRequired?: boolean } | null) {
    const next = { ...(pv.userOverrides ?? {}) } as Record<string, { enabled: boolean; codeRequired: boolean }>;
    if (patch == null) {
      delete next[String(userId)];
    } else {
      const prev = next[String(userId)] ?? { enabled: true, codeRequired: true };
      next[String(userId)] = {
        enabled: patch.enabled ?? prev.enabled,
        codeRequired: patch.codeRequired ?? prev.codeRequired
      };
    }
    setPunchVideo({ userOverrides: next });
  }

  function latenessOk(): boolean {
    const per = Number(lateness.excusedPerMonth);
    const maxMin = Number(lateness.excusedMaxMinutes);
    const early = Number(lateness.earlyLeaveGraceMinutes);
    return (
      Number.isFinite(per) &&
      per >= 0 &&
      per <= 31 &&
      Number.isFinite(maxMin) &&
      maxMin >= 1 &&
      maxMin <= 1440 &&
      Number.isFinite(early) &&
      early >= 0 &&
      early <= 240
    );
  }

  function punchVideoOk(): boolean {
    const minSec = Number(pv.minSec ?? 5);
    const maxSec = Number(pv.maxSec ?? 10);
    return Number.isFinite(minSec) && Number.isFinite(maxSec) && minSec >= 5 && maxSec <= 10 && minSec <= maxSec;
  }

  function faceAntifraudOk(): boolean {
    const face = Number(fa.faceMatchThreshold ?? 0.85);
    const sface = Number(fa.sfaceThreshold ?? 0.45);
    const gps = Number(fa.maxGpsAccuracyM ?? 100);
    const skew = Number(fa.maxClockSkewSec ?? 300);
    const dirs = Number(fa.livenessDirections ?? 4);
    return (
      Number.isFinite(face) &&
      face >= 0.3 &&
      face <= 0.99 &&
      Number.isFinite(sface) &&
      sface >= 0.25 &&
      sface <= 0.95 &&
      Number.isFinite(gps) &&
      gps >= 15 &&
      gps <= 1000 &&
      Number.isFinite(skew) &&
      skew >= 30 &&
      skew <= 3600 &&
      (dirs === 4 || dirs === 8)
    );
  }

  function telegramOk(): boolean {
    if (!tg.enabled) return true;
    const hasToken = Boolean(tg.hasBotToken) || String(tg.botToken ?? "").trim().length > 0;
    const hasChat = String(tg.defaultChatId ?? "").trim().length > 0 || branchChatRows.length > 0;
    return hasToken && hasChat;
  }

  function photoPolicyOk(p: Record<string, unknown> | undefined): boolean {
    if (!p || p.enabled === false) return true;
    const v = Number(p.retentionValue);
    const u = String(p.retentionUnit ?? "day");
    return Number.isFinite(v) && v >= 1 && v <= 3650 && (u === "day" || u === "month" || u === "year");
  }

  function retentionOk(): boolean {
    const video = Number(ret.videoDays ?? 30);
    const face = Number(ret.dismissedFacePurgeDays ?? 30);
    const edge = Number(ret.compress?.maxEdge ?? 720);
    const quality = Number(ret.compress?.quality ?? 62);
    return (
      photoPolicyOk(ret.in) &&
      photoPolicyOk(ret.out) &&
      photoPolicyOk(ret.estimated_out) &&
      Number.isFinite(video) &&
      video >= 1 &&
      video <= 3650 &&
      Number.isFinite(face) &&
      face >= 0 &&
      face <= 3650 &&
      Number.isFinite(edge) &&
      edge >= 240 &&
      edge <= 1920 &&
      Number.isFinite(quality) &&
      quality >= 30 &&
      quality <= 95
    );
  }

  function dictionariesOk(): boolean {
    const abs = (cur.dictionaries?.absenceTypes ?? []) as Array<Record<string, unknown>>;
    const clr = (cur.dictionaries?.clearanceItems ?? []) as Array<Record<string, unknown>>;
    if (abs.length < 1 || clr.length < 1) return false;
    const absCodes = new Set<string>();
    for (const a of abs) {
      const code = String(a.code ?? "").trim();
      const ru = String(a.labelRu ?? "").trim();
      if (!code || !ru || absCodes.has(code)) return false;
      absCodes.add(code);
    }
    const clrCodes = new Set<string>();
    for (const c of clr) {
      const code = String(c.code ?? "").trim();
      const ru = String(c.labelRu ?? "").trim();
      if (!code || !ru || clrCodes.has(code)) return false;
      clrCodes.add(code);
    }
    return true;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5 rounded-xl border bg-card p-2 shadow-sm">
        {TABS.map((t) => (
          <Link
            key={t.slug}
            href={t.href}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              t.slug === section ? "bg-teal-700 text-white" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {savedNotice ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
          <CheckCircle2 className="size-4" />
          {savedNotice}
        </div>
      ) : null}

      {section === "lateness-rules" && (
        <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
          <div>
            <h1 className="text-base font-bold">Правила опозданий и штрафов</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Первые опоздания в месяце можно простить. Остальные и ранний уход считаются по этим лимитам. Пример: 3 раза до 15 минут — полный день; дальше опоздание без прощения.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Допустимых опозданий в месяц</label>
              <Input
                type="number"
                min={0}
                max={31}
                value={lateness.excusedPerMonth ?? 3}
                onChange={(e) => setForm({ ...cur, lateness: { ...lateness, excusedPerMonth: Number(e.target.value) } })}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">0–31. Сколько раз в месяц можно опоздать без штрафа.</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Максимум минут для прощения</label>
              <Input
                type="number"
                min={1}
                max={1440}
                value={lateness.excusedMaxMinutes ?? 15}
                onChange={(e) => setForm({ ...cur, lateness: { ...lateness, excusedMaxMinutes: Number(e.target.value) } })}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Если опоздание дольше — прощение не действует.</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Льгота при раннем уходе (мин)</label>
              <Input
                type="number"
                min={0}
                max={240}
                value={lateness.earlyLeaveGraceMinutes ?? 15}
                onChange={(e) => setForm({ ...cur, lateness: { ...lateness, earlyLeaveGraceMinutes: Number(e.target.value) } })}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Раньше уход на эти минуты не считается нарушением.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 text-xs">
            <label className="flex items-start gap-2 rounded-lg border bg-background px-3 py-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={lateness.excusedEnabled !== false}
                onChange={(e) => setForm({ ...cur, lateness: { ...lateness, excusedEnabled: e.target.checked } })}
              />
              <span>
                <span className="font-semibold">Прощение опозданий</span>
                <span className="mt-0.5 block text-muted-foreground">Первые N опозданий в месяц (до лимита минут) считаются полным днём 1.0.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border bg-background px-3 py-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={Boolean(lateness.penalizeUnexcusedLateAsHalfDay)}
                onChange={(e) => setForm({ ...cur, lateness: { ...lateness, penalizeUnexcusedLateAsHalfDay: e.target.checked } })}
              />
              <span>
                <span className="font-semibold">Штраф за опоздание без прощения</span>
                <span className="mt-0.5 block text-muted-foreground">Непрощённое опоздание считать половиной дня (0.5), а не полным днём.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border bg-background px-3 py-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={lateness.notifyTerminalArrival !== false}
                onChange={(e) => setForm({ ...cur, lateness: { ...lateness, notifyTerminalArrival: e.target.checked } })}
              />
              <span>
                <span className="font-semibold">Уведомление при входе с терминала</span>
                <span className="mt-0.5 block text-muted-foreground">После Face ID / киоска отметки сотрудник получает уведомление о приходе.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border bg-background px-3 py-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={lateness.strictNonAgentAbsent !== false}
                onChange={(e) => setForm({ ...cur, lateness: { ...lateness, strictNonAgentAbsent: e.target.checked } })}
              />
              <span>
                <span className="font-semibold">Без отметки = прогул (не агент)</span>
                <span className="mt-0.5 block text-muted-foreground">
                  Складчик, кассир, оператор, экспедитор и др. без прихода/ухода за рабочий день получают «Прогул (0)».
                  По умолчанию включено. Выключите, если таким ролям без отметки считать «Отработал».
                </span>
              </span>
            </label>
          </div>
        </div>
      )}

      {section === "punch-modes" && (
        <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
          <div>
            <h1 className="text-base font-bold">Режимы отметки (способы посещаемости)</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              В мобильном приложении видны только включённые способы. Если у роли только «Терминал» — отметка только с Face ID
              терминала. Несколько способов — сотрудник выбирает вкладку. Киоск дополнительно ограничен списком руководителей
              (Face ID / Анти-фрод).
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Базовые способы (для всех ролей)</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PUNCH_METHOD_COLS.map((col) => (
                <label key={col.key} className="flex items-start gap-2 rounded-lg border bg-background px-3 py-2 text-xs">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={punchMethods[col.key]}
                    onChange={(e) => setBaseMethod(col.key, e.target.checked)}
                  />
                  <span>
                    <span className="font-semibold">{col.label}</span>
                    {col.key === "terminal" ? (
                      <span className="mt-0.5 block text-muted-foreground">Hikvision / Office-Link. Без мобильных вкладок, если это единственный способ.</span>
                    ) : col.key === "kiosk" ? (
                      <span className="mt-0.5 block text-muted-foreground">Только админ, супервайзер или руководители из списка киоска.</span>
                    ) : col.key === "video" ? (
                      <span className="mt-0.5 block text-muted-foreground">Параметры длительности и кода — на вкладке «Видео и 3-значный код».</span>
                    ) : (
                      <span className="mt-0.5 block text-muted-foreground">Фото с фронтальной/задней камеры и Face ID.</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Матрица по ролям</h2>
            <p className="text-[11px] text-muted-foreground">
              «Как база» — берётся базовый флажок выше. «Вкл» / «Выкл» — жёстко для роли. Пустая строка = полное наследование.
            </p>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="border-b bg-muted/40 text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2">Роль</th>
                    {PUNCH_METHOD_COLS.map((c) => (
                      <th key={c.key} className="px-2 py-2">
                        {c.label}
                      </th>
                    ))}
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {PUNCH_MODE_ROLES.map((role) => (
                    <tr key={role} className="border-b last:border-0">
                      <td className="px-2 py-1.5 font-medium">{TIMESHEET_ROLE_LABELS[role] ?? role}</td>
                      {PUNCH_METHOD_COLS.map((col) => {
                        const v = roleMethodValue(role, col.key);
                        return (
                          <td key={col.key} className="px-2 py-1.5">
                            <select
                              className="h-8 w-full min-w-[96px] rounded-md border border-input bg-background px-1.5 text-[11px]"
                              value={v}
                              onChange={(e) => {
                                const next = e.target.value as "default" | "on" | "off";
                                setRoleMethod(role, col.key, next === "default" ? null : next === "on");
                              }}
                            >
                              <option value="default">Как база ({punchMethods[col.key] ? "вкл" : "выкл"})</option>
                              <option value="on">Вкл</option>
                              <option value="off">Выкл</option>
                            </select>
                          </td>
                        );
                      })}
                      <td className="px-2 py-1.5">
                        {punchByRole[role] ? (
                          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-[11px]" onClick={() => clearRoleOverrides(role)}>
                            Сброс
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {section === "punch-video" && (
        <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
          <div>
            <h1 className="text-base font-bold">Видео-отметка и 3-значный код</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Параметры видео (длительность, код). Включение видео для ролей — в{" "}
              <Link href="/settings/tabel/punch-modes" className="underline">
                Режимы отметки
              </Link>
              . Ниже — исключения по сотрудникам.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Мин. длительность видео (сек)</label>
              <Input
                type="number"
                min={5}
                max={10}
                value={pv.minSec ?? 5}
                onChange={(e) => setPunchVideo({ minSec: Number(e.target.value) })}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Не меньше 5 секунд.</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Макс. длительность видео (сек)</label>
              <Input
                type="number"
                min={5}
                max={10}
                value={pv.maxSec ?? 10}
                onChange={(e) => setPunchVideo({ maxSec: Number(e.target.value) })}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Не больше 10 секунд. Не меньше минимума.</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Режим записи камер</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={pv.captureMode ?? "sequential"}
                onChange={(e) => setPunchVideo({ captureMode: e.target.value })}
              >
                <option value="sequential">По очереди: фронт → задняя</option>
                <option value="simultaneous">Одновременно (две камеры)</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 text-xs">
            <label className="flex items-start gap-2 rounded-lg border bg-background px-3 py-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={pv.enabled !== false}
                onChange={(e) => setPunchVideo({ enabled: e.target.checked })}
              />
              <span>
                <span className="font-semibold">Видео-отметка в приложении</span>
                <span className="mt-0.5 block text-muted-foreground">Если выключено — мобильная видео-отметка недоступна.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border bg-background px-3 py-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={pv.codeRequired !== false}
                onChange={(e) => setPunchVideo({ codeRequired: e.target.checked })}
              />
              <span>
                <span className="font-semibold">3-значный дневной код</span>
                <span className="mt-0.5 block text-muted-foreground">Сотрудник должен произнести код дня (100–999). Исключения — в таблице ниже.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border bg-background px-3 py-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={pv.allowAllStaffByDefault !== false}
                onChange={(e) => setPunchVideo({ allowAllStaffByDefault: e.target.checked })}
              />
              <span>
                <span className="font-semibold">Видео доступно всем по умолчанию</span>
                <span className="mt-0.5 block text-muted-foreground">Выключите, если видео нужно только выбранным сотрудникам в исключениях.</span>
              </span>
            </label>
          </div>

          <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <div className="text-sm font-semibold">Исключения по сотрудникам</div>
            <p className="text-[11px] text-muted-foreground">
              Для выбранного сотрудника можно отдельно включить/выключить видео и требование кода. В списке только имя.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[220px] flex-1">
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Сотрудник</label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={overrideUserId}
                  onChange={(e) => setOverrideUserId(e.target.value)}
                  disabled={!canEdit}
                >
                  <option value="">Выберите сотрудника</option>
                  {overrideOptions.map((o) => (
                    <option key={o.id} value={String(o.id)}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={!canEdit || !overrideUserId}
                onClick={() => {
                  const id = Number(overrideUserId);
                  if (!id) return;
                  setUserOverride(id, { enabled: true, codeRequired: pv.codeRequired !== false });
                  setOverrideUserId("");
                }}
              >
                <Plus className="mr-1 size-3.5" /> Добавить
              </Button>
            </div>
            {overrides.length === 0 ? (
              <p className="text-xs text-muted-foreground">Исключений пока нет — действуют общие правила.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border bg-background">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-muted/50 text-[11px] text-muted-foreground">
                    <tr>
                      <th className="px-2.5 py-2">Сотрудник</th>
                      <th className="px-2.5 py-2">Видео</th>
                      <th className="px-2.5 py-2">Код обязателен</th>
                      <th className="px-2.5 py-2 text-right"> </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {overrides.map((row) => {
                      const name = staffPickerDisplayName(staffById.get(row.id) ?? { fio: `Сотрудник #${row.id}` });
                      return (
                        <tr key={row.id}>
                          <td className="whitespace-nowrap px-2.5 py-2 font-semibold">{name}</td>
                          <td className="px-2.5 py-2">
                            <label className="inline-flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={row.enabled}
                                disabled={!canEdit}
                                onChange={(e) => setUserOverride(row.id, { enabled: e.target.checked })}
                              />
                              {row.enabled ? "Да" : "Нет"}
                            </label>
                          </td>
                          <td className="px-2.5 py-2">
                            <label className="inline-flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={row.codeRequired}
                                disabled={!canEdit}
                                onChange={(e) => setUserOverride(row.id, { codeRequired: e.target.checked })}
                              />
                              {row.codeRequired ? "Да" : "Нет"}
                            </label>
                          </td>
                          <td className="px-2.5 py-2 text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 text-rose-600"
                              disabled={!canEdit}
                              onClick={() => setUserOverride(row.id, null)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {section === "face-antifraud" && (
        <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
          <div>
            <h1 className="text-base font-bold">Face ID, Liveness и Анти-фрод</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Порог распознавания лица, проверка «живого» человека (повороты головы), защита от Fake GPS и список руководителей для режима Киоск.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Порог совпадения лица</label>
              <Input
                type="number"
                step="0.01"
                min={0.3}
                max={0.99}
                value={fa.faceMatchThreshold ?? 0.85}
                onChange={(e) => setFaceAntifraud({ faceMatchThreshold: Number(e.target.value) })}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">0.30–0.99. Выше — строже. По умолчанию 0.85.</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Порог SFace</label>
              <Input
                type="number"
                step="0.01"
                min={0.25}
                max={0.95}
                value={fa.sfaceThreshold ?? 0.45}
                onChange={(e) => setFaceAntifraud({ sfaceThreshold: Number(e.target.value) })}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">0.25–0.95. Для модели SFace, по умолчанию 0.45.</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Направления Liveness</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={fa.livenessDirections ?? 4}
                onChange={(e) => setFaceAntifraud({ livenessDirections: Number(e.target.value) })}
              >
                <option value={4}>4 направления</option>
                <option value={8}>8 направлений</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Макс. погрешность GPS (м)</label>
              <Input
                type="number"
                min={15}
                max={1000}
                value={fa.maxGpsAccuracyM ?? 100}
                onChange={(e) => setFaceAntifraud({ maxGpsAccuracyM: Number(e.target.value) })}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">15–1000 м. Больше — GPS слишком неточный.</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Допуск рассинхрона часов (сек)</label>
              <Input
                type="number"
                min={30}
                max={3600}
                value={fa.maxClockSkewSec ?? 300}
                onChange={(e) => setFaceAntifraud({ maxClockSkewSec: Number(e.target.value) })}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">30–3600. Если телефон и сервер сильно расходятся — отказ.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 text-xs">
            <label className="flex items-start gap-2 rounded-lg border bg-background px-3 py-2">
              <input type="checkbox" className="mt-0.5" checked={fa.blockMockGps !== false} onChange={(e) => setFaceAntifraud({ blockMockGps: e.target.checked })} />
              <span>
                <span className="font-semibold">Блокировать Fake GPS</span>
                <span className="mt-0.5 block text-muted-foreground">Mock Location запрещён.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border bg-background px-3 py-2">
              <input type="checkbox" className="mt-0.5" checked={fa.notifyHrOnFraud !== false} onChange={(e) => setFaceAntifraud({ notifyHrOnFraud: e.target.checked })} />
              <span>
                <span className="font-semibold">Уведомлять HR при мошенничестве</span>
                <span className="mt-0.5 block text-muted-foreground">При Fake GPS и других срабатываниях антифрода.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border bg-background px-3 py-2">
              <input type="checkbox" className="mt-0.5" checked={fa.requireSingleFace !== false} onChange={(e) => setFaceAntifraud({ requireSingleFace: e.target.checked })} />
              <span>
                <span className="font-semibold">Только 1 лицо в кадре</span>
                <span className="mt-0.5 block text-muted-foreground">Если лиц больше — отметка не принимается.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border bg-background px-3 py-2">
              <input type="checkbox" className="mt-0.5" checked={fa.requireDualCameraPhoto !== false} onChange={(e) => setFaceAntifraud({ requireDualCameraPhoto: e.target.checked })} />
              <span>
                <span className="font-semibold">Фронт + задняя камера</span>
                <span className="mt-0.5 block text-muted-foreground">Обязательный DualCapture при отметке в приложении.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border bg-background px-3 py-2">
              <input type="checkbox" className="mt-0.5" checked={fa.blockGalleryPhotos !== false} onChange={(e) => setFaceAntifraud({ blockGalleryPhotos: e.target.checked })} />
              <span>
                <span className="font-semibold">Запрет фото из галереи</span>
                <span className="mt-0.5 block text-muted-foreground">Только снимок с камеры телефона.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border bg-background px-3 py-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={Boolean(fa.requireFaceEnrollmentOnStaffCreate)}
                onChange={(e) => setFaceAntifraud({ requireFaceEnrollmentOnStaffCreate: e.target.checked })}
              />
              <span>
                <span className="font-semibold">Лицо обязательно при создании сотрудника</span>
                <span className="mt-0.5 block text-muted-foreground">Без эталонного лица карточку нельзя сохранить.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border bg-background px-3 py-2">
              <input type="checkbox" className="mt-0.5" checked={Boolean(fa.requireFaceLogin)} onChange={(e) => setFaceAntifraud({ requireFaceLogin: e.target.checked })} />
              <span>
                <span className="font-semibold">Вход по Face ID</span>
                <span className="mt-0.5 block text-muted-foreground">Если включено — вход в приложение требует лицо.</span>
              </span>
            </label>
          </div>

          <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <div className="text-sm font-semibold">Руководители режима Киоск</div>
            <p className="text-[11px] text-muted-foreground">
              Админ и супервайзер уже могут. Здесь — дополнительные сотрудники. В списке только имя.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[220px] flex-1">
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Сотрудник</label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={kioskUserId}
                  onChange={(e) => setKioskUserId(e.target.value)}
                  disabled={!canEdit}
                >
                  <option value="">Выберите сотрудника</option>
                  {kioskOptions.map((o) => (
                    <option key={o.id} value={String(o.id)}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={!canEdit || !kioskUserId}
                onClick={() => {
                  const id = Number(kioskUserId);
                  if (!id || kioskLeaderIds.includes(id)) return;
                  setFaceAntifraud({ kioskLeaderIds: [...kioskLeaderIds, id] });
                  setKioskUserId("");
                }}
              >
                <Plus className="mr-1 size-3.5" /> Добавить
              </Button>
            </div>
            {kioskLeaders.length === 0 ? (
              <p className="text-xs text-muted-foreground">Дополнительных руководителей нет.</p>
            ) : (
              <ul className="divide-y rounded-md border bg-background">
                {kioskLeaders.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-2 px-2.5 py-2 text-xs">
                    <span className="font-semibold">{row.name}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 text-rose-600"
                      disabled={!canEdit}
                      onClick={() => setFaceAntifraud({ kioskLeaderIds: kioskLeaderIds.filter((x) => x !== row.id) })}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {section === "telegram-attendance" && (
        <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
          <div>
            <h1 className="text-base font-bold">Telegram-группа для отметок</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Сюда уходят фото и видео отметок. Токен бота на экране скрыт. Можно задать общую группу и отдельные группы по филиалам.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium">
                Bot Token {tg.hasBotToken ? "(сохранён — оставьте пустым, чтобы не менять)" : ""}
              </label>
              <Input
                type="password"
                autoComplete="new-password"
                placeholder={tg.hasBotToken ? "••••••••••••" : "123456:ABC-DEF..."}
                value={tg.botToken ?? ""}
                onChange={(e) => setTelegram({ botToken: e.target.value })}
                disabled={!canEdit}
              />
              {tg.hasBotToken ? (
                <button
                  type="button"
                  className="mt-1 text-[11px] text-rose-700 hover:underline disabled:opacity-50"
                  disabled={!canEdit}
                  onClick={() => {
                    if (!window.confirm("Удалить сохранённый Bot Token?")) return;
                    setTelegram({ botToken: null, hasBotToken: false });
                  }}
                >
                  Удалить сохранённый токен
                </button>
              ) : null}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Общий Chat ID группы / канала</label>
              <Input
                value={tg.defaultChatId ?? ""}
                placeholder="-1001234567890"
                onChange={(e) => setTelegram({ defaultChatId: e.target.value })}
                disabled={!canEdit}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Если у филиала нет своей группы — используется этот ID.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 text-xs">
            <label className="flex items-start gap-2 rounded-lg border bg-background px-3 py-2">
              <input type="checkbox" className="mt-0.5" checked={Boolean(tg.enabled)} onChange={(e) => setTelegram({ enabled: e.target.checked })} disabled={!canEdit} />
              <span>
                <span className="font-semibold">Отправка в Telegram</span>
                <span className="mt-0.5 block text-muted-foreground">Включить авто-отправку отметок в группу или канал.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border bg-background px-3 py-2">
              <input type="checkbox" className="mt-0.5" checked={tg.sendPhotos !== false} onChange={(e) => setTelegram({ sendPhotos: e.target.checked })} disabled={!canEdit} />
              <span>
                <span className="font-semibold">Отправлять фото</span>
                <span className="mt-0.5 block text-muted-foreground">Фото прихода и ухода.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border bg-background px-3 py-2">
              <input type="checkbox" className="mt-0.5" checked={tg.sendVideos !== false} onChange={(e) => setTelegram({ sendVideos: e.target.checked })} disabled={!canEdit} />
              <span>
                <span className="font-semibold">Отправлять видео</span>
                <span className="mt-0.5 block text-muted-foreground">Видео-отметка с фронтальной и задней камеры.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border bg-background px-3 py-2">
              <input type="checkbox" className="mt-0.5" checked={tg.sendFraudAlerts !== false} onChange={(e) => setTelegram({ sendFraudAlerts: e.target.checked })} disabled={!canEdit} />
              <span>
                <span className="font-semibold">Оповещения о мошенничестве</span>
                <span className="mt-0.5 block text-muted-foreground">Fake GPS и другие срабатывания антифрода.</span>
              </span>
            </label>
          </div>

          <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <div className="text-sm font-semibold">Группы по филиалам</div>
            <p className="text-[11px] text-muted-foreground">Для филиала можно задать отдельный Chat ID. В списке только название филиала.</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[180px] flex-1">
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Филиал</label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={branchChatPick}
                  onChange={(e) => setBranchChatPick(e.target.value)}
                  disabled={!canEdit}
                >
                  <option value="">Выберите филиал</option>
                  {branchChatOptions.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[180px] flex-1">
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Chat ID</label>
                <Input value={branchChatId} placeholder="-100..." onChange={(e) => setBranchChatId(e.target.value)} disabled={!canEdit} />
              </div>
              <Button
                type="button"
                size="sm"
                disabled={!canEdit || !branchChatPick || !branchChatId.trim()}
                onClick={() => {
                  const next = { ...(tg.branchChatIds ?? {}), [branchChatPick]: branchChatId.trim() };
                  setTelegram({ branchChatIds: next });
                  setBranchChatPick("");
                  setBranchChatId("");
                }}
              >
                <Plus className="mr-1 size-3.5" /> Добавить
              </Button>
            </div>
            {branchChatRows.length === 0 ? (
              <p className="text-xs text-muted-foreground">Отдельных групп по филиалам нет — используется общий Chat ID.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border bg-background">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-muted/50 text-[11px] text-muted-foreground">
                    <tr>
                      <th className="px-2.5 py-2">Филиал</th>
                      <th className="px-2.5 py-2">Chat ID</th>
                      <th className="px-2.5 py-2 text-right"> </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {branchChatRows.map((row) => (
                      <tr key={row.branch}>
                        <td className="whitespace-nowrap px-2.5 py-2 font-semibold">{row.branch}</td>
                        <td className="px-2.5 py-2 font-mono text-[11px]">{row.chat}</td>
                        <td className="px-2.5 py-2 text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 text-rose-600"
                            disabled={!canEdit}
                            onClick={() => {
                              const next = { ...(tg.branchChatIds ?? {}) };
                              delete next[row.branch];
                              setTelegram({ branchChatIds: next });
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {section === "retention" && (
        <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
          <div>
            <h1 className="text-base font-bold">Сроки хранения фото и видео</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Старые файлы удаляются по сроку. Сжатие уменьшает размер перед сохранением. Очистка необратима.
            </p>
          </div>

          {(
            [
              { key: "in" as const, title: "Фото прихода", hint: "Снимки на вход" },
              { key: "out" as const, title: "Фото ухода", hint: "Снимки на выход" },
              { key: "estimated_out" as const, title: "Фото середины дня", hint: "Промежуточная / estimated_out отметка" }
            ] as const
          ).map((row) => {
            const policy = (ret[row.key] ?? {}) as Record<string, unknown>;
            const enabled = policy.enabled !== false;
            return (
              <div key={row.key} className="space-y-2 rounded-lg border bg-muted/20 p-3">
                <label className="flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={enabled}
                    onChange={(e) => setPhotoPolicy(row.key, { enabled: e.target.checked })}
                    disabled={!canEdit}
                  />
                  <span>
                    <span className="font-semibold">{row.title}</span>
                    <span className="mt-0.5 block text-muted-foreground">{row.hint}</span>
                  </span>
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Срок</label>
                    <Input
                      type="number"
                      min={1}
                      max={3650}
                      value={policy.retentionValue ?? 90}
                      onChange={(e) => setPhotoPolicy(row.key, { retentionValue: Number(e.target.value) })}
                      disabled={!canEdit || !enabled}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Единица</label>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
                      value={String(policy.retentionUnit ?? "day")}
                      onChange={(e) => setPhotoPolicy(row.key, { retentionUnit: e.target.value })}
                      disabled={!canEdit || !enabled}
                    >
                      <option value="day">Дни</option>
                      <option value="month">Месяцы</option>
                      <option value="year">Годы</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium">Видео-отметки (дней)</label>
              <Input
                type="number"
                min={1}
                max={3650}
                value={ret.videoDays ?? 30}
                onChange={(e) => setRetention({ videoDays: Number(e.target.value) })}
                disabled={!canEdit}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">1–3650 дней.</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Удаление лица уволенного (дней)</label>
              <Input
                type="number"
                min={0}
                max={3650}
                value={ret.dismissedFacePurgeDays ?? 30}
                onChange={(e) => setRetention({ dismissedFacePurgeDays: Number(e.target.value) })}
                disabled={!canEdit}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">0 — не удалять эталон лица автоматически.</p>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <label className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={ret.compress?.enabled !== false}
                onChange={(e) => setRetention({ compress: { ...(ret.compress ?? {}), enabled: e.target.checked } })}
                disabled={!canEdit}
              />
              <span>
                <span className="font-semibold">Сжатие фото перед сохранением</span>
                <span className="mt-0.5 block text-muted-foreground">Уменьшает диск и трафик Telegram.</span>
              </span>
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Макс. сторона (px)</label>
                <Input
                  type="number"
                  min={240}
                  max={1920}
                  value={ret.compress?.maxEdge ?? 720}
                  onChange={(e) => setRetention({ compress: { ...(ret.compress ?? {}), maxEdge: Number(e.target.value) } })}
                  disabled={!canEdit || ret.compress?.enabled === false}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">240–1920.</p>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">JPEG качество (%)</label>
                <Input
                  type="number"
                  min={30}
                  max={95}
                  value={ret.compress?.quality ?? 62}
                  onChange={(e) => setRetention({ compress: { ...(ret.compress ?? {}), quality: Number(e.target.value) } })}
                  disabled={!canEdit || ret.compress?.enabled === false}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">30–95.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <p className="text-[11px] text-muted-foreground">Ручная очистка сразу применяет текущие сроки на сервере.</p>
            <Button
              variant="outline"
              size="sm"
              disabled={!canEdit || runRetentionMut.isPending}
              onClick={() => {
                if (!window.confirm("Удалить устаревшие фото, видео и эталоны лиц по текущим срокам? Это необратимо.")) return;
                void runRetentionMut.mutateAsync().catch((e) => window.alert(getUserFacingError(e, "Ошибка очистки")));
              }}
            >
              Запустить очистку сейчас
            </Button>
          </div>
        </div>
      )}

      {section === "locations" && <TabelSettingsLocationsPanel />}

      {section === "dictionaries" && (
        <TabelSettingsDictionariesPanel
          absenceTypes={cur.dictionaries?.absenceTypes ?? []}
          clearanceItems={cur.dictionaries?.clearanceItems ?? []}
          canEdit={canEdit}
          onChange={(next) => setForm({ ...cur, dictionaries: next })}
        />
      )}

      {section !== "locations" && (
        <div className="flex flex-col items-end gap-2">
          {!canEdit ? (
            <p className="text-xs text-muted-foreground">Нет права на изменение настроек табеля (Доступ).</p>
          ) : null}
          <Button
            disabled={
              !canEdit ||
              saveMut.isPending ||
              (section === "lateness-rules" && !latenessOk()) ||
              (section === "punch-video" && !punchVideoOk()) ||
              (section === "face-antifraud" && !faceAntifraudOk()) ||
              (section === "telegram-attendance" && !telegramOk()) ||
              (section === "retention" && !retentionOk()) ||
              (section === "dictionaries" && !dictionariesOk())
            }
            onClick={() => {
              if (section === "lateness-rules" && !latenessOk()) {
                window.alert("Проверьте числа: опоздания 0–31, минуты прощения 1–1440, ранняя льгота 0–240.");
                return;
              }
              if (section === "punch-video" && !punchVideoOk()) {
                window.alert("Длительность видео: минимум 5, максимум 10, минимум не больше максимума.");
                return;
              }
              if (section === "face-antifraud" && !faceAntifraudOk()) {
                window.alert("Проверьте числа: лицо 0.30–0.99, SFace 0.25–0.95, GPS 15–1000, часы 30–3600, Liveness 4 или 8.");
                return;
              }
              if (section === "telegram-attendance" && !telegramOk()) {
                window.alert("При включённой отправке нужны Bot Token и хотя бы один Chat ID (общий или по филиалу).");
                return;
              }
              if (section === "retention" && !retentionOk()) {
                window.alert("Проверьте сроки: фото 1–3650, видео 1–3650, лицо 0–3650, сторона 240–1920, JPEG 30–95.");
                return;
              }
              if (section === "dictionaries" && !dictionariesOk()) {
                window.alert("Нужны уникальные коды и названия (RU) хотя бы для одного вида отсутствия и одного пункта обходного.");
                return;
              }
              const payload =
                section === "telegram-attendance"
                  ? {
                      ...cur,
                      telegram: {
                        ...tg,
                        botToken: tg.botToken === null ? null : String(tg.botToken ?? "").trim() === "" ? "" : tg.botToken
                      }
                    }
                  : cur;
              void saveMut.mutateAsync(payload).catch((e) => window.alert(getUserFacingError(e, "Ошибка сохранения")));
            }}
          >
            <Save className="mr-1.5 size-4" /> Сохранить настройки
          </Button>
        </div>
      )}
    </div>
  );
}
