"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { getUserFacingError } from "@/lib/error-utils";
import { usePermissions } from "@/lib/use-permissions";
import { TabelSettingsDictionariesPanel, TabelSettingsLocationsPanel } from "./tabel-settings-places";

export type TabelSettingsSectionSlug =
  | "lateness-rules"
  | "punch-video"
  | "face-antifraud"
  | "telegram-attendance"
  | "retention"
  | "locations"
  | "dictionaries";

const TABS: Array<{ slug: TabelSettingsSectionSlug; label: string; href: string }> = [
  { slug: "lateness-rules", label: "Опоздания и штрафы", href: "/settings/tabel/lateness-rules" },
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

  const [form, setForm] = useState<Record<string, any> | null>(null);

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
          <h1 className="text-base font-bold">Правила опозданий, прощения и строгого режима</h1>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Допустимых опозданий в месяц (прощение)</label>
              <Input type="number" value={lateness.excusedPerMonth ?? 3} onChange={(e) => setForm({ ...cur, lateness: { ...lateness, excusedPerMonth: Number(e.target.value) } })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Максимум минут для прощения</label>
              <Input type="number" value={lateness.excusedMaxMinutes ?? 15} onChange={(e) => setForm({ ...cur, lateness: { ...lateness, excusedMaxMinutes: Number(e.target.value) } })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Льгота при раннем уходе (мин)</label>
              <Input type="number" value={lateness.earlyLeaveGraceMinutes ?? 15} onChange={(e) => setForm({ ...cur, lateness: { ...lateness, earlyLeaveGraceMinutes: Number(e.target.value) } })} />
            </div>
          </div>
          <div className="flex flex-col gap-2 text-xs">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={lateness.excusedEnabled !== false} onChange={(e) => setForm({ ...cur, lateness: { ...lateness, excusedEnabled: e.target.checked } })} />
              Включить месячный лимит прощения опозданий (первые N опозданий считаются полным днём 1.0)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={Boolean(lateness.strictNonAgentAbsent)} onChange={(e) => setForm({ ...cur, lateness: { ...lateness, strictNonAgentAbsent: e.target.checked } })} />
              Строгий режим: если сотрудник (складчик, кассир, оператор, экспедитор) не поставил отметку за день — ставить «Прогул (0)»
            </label>
          </div>
        </div>
      )}

      {section === "punch-video" && (
        <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
          <h1 className="text-base font-bold">Видео-отметка и 3-значный дневной код (100–999)</h1>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Мин. длительность видео (сек)</label>
              <Input type="number" value={pv.minSec ?? 5} onChange={(e) => setForm({ ...cur, punchVideo: { ...pv, minSec: Number(e.target.value) } })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Макс. длительность видео (сек)</label>
              <Input type="number" value={pv.maxSec ?? 10} onChange={(e) => setForm({ ...cur, punchVideo: { ...pv, maxSec: Number(e.target.value) } })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Режим записи фронтальной и задней камер</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={pv.captureMode ?? "sequential"}
                onChange={(e) => setForm({ ...cur, punchVideo: { ...pv, captureMode: e.target.value } })}
              >
                <option value="sequential">Последовательно (Фронтальная → Задняя)</option>
                <option value="simultaneous">Одновременно (Dual Camera)</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-2 text-xs">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={pv.enabled !== false} onChange={(e) => setForm({ ...cur, punchVideo: { ...pv, enabled: e.target.checked } })} />
              Разрешить видео-отметку в мобильном приложении
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={pv.codeRequired !== false} onChange={(e) => setForm({ ...cur, punchVideo: { ...pv, codeRequired: e.target.checked } })} />
              Требовать произнесение и проверку 3-значного дневного кода (100–999)
            </label>
          </div>
        </div>
      )}

      {section === "face-antifraud" && (
        <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
          <h1 className="text-base font-bold">Face ID, Liveness (4 / 8 поворотов) и 10-слойный Анти-фрод</h1>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Порог совпадения лица (0.30–0.99)</label>
              <Input type="number" step="0.01" value={fa.faceMatchThreshold ?? 0.85} onChange={(e) => setForm({ ...cur, faceAntifraud: { ...fa, faceMatchThreshold: Number(e.target.value) } })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Направления поворота головы (Liveness)</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={fa.livenessDirections ?? 4}
                onChange={(e) => setForm({ ...cur, faceAntifraud: { ...fa, livenessDirections: Number(e.target.value) } })}
              >
                <option value={4}>4 направления (Влево, Вправо, Вверх, Вниз)</option>
                <option value={8}>8 направлений (+ диагонали)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Макс. погрешность GPS (метров)</label>
              <Input type="number" value={fa.maxGpsAccuracyM ?? 100} onChange={(e) => setForm({ ...cur, faceAntifraud: { ...fa, maxGpsAccuracyM: Number(e.target.value) } })} />
            </div>
          </div>
          <div className="flex flex-col gap-2 text-xs">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={fa.blockMockGps !== false} onChange={(e) => setForm({ ...cur, faceAntifraud: { ...fa, blockMockGps: e.target.checked } })} />
              Блокировать Fake GPS / Mock Location и отправлять уведомление HR
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={fa.requireSingleFace !== false} onChange={(e) => setForm({ ...cur, faceAntifraud: { ...fa, requireSingleFace: e.target.checked } })} />
              Требовать строго 1 лицо в кадре во время отметки
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={fa.requireDualCameraPhoto !== false} onChange={(e) => setForm({ ...cur, faceAntifraud: { ...fa, requireDualCameraPhoto: e.target.checked } })} />
              Обязательный снимок с фронтальной и задней камеры (DualCapture)
            </label>
          </div>
        </div>
      )}

      {section === "telegram-attendance" && (
        <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
          <h1 className="text-base font-bold">Telegram-группа / канал для фото и видео отметок</h1>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium">
                Bot Token {tg.hasBotToken ? "(токен сохранён, оставьте пустым чтобы не менять)" : ""}
              </label>
              <Input type="password" placeholder="123456:ABC-DEF..." value={tg.botToken ?? ""} onChange={(e) => setForm({ ...cur, telegram: { ...tg, botToken: e.target.value } })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Chat ID группы / канала (например -1001234567890)</label>
              <Input value={tg.defaultChatId ?? ""} placeholder="-100..." onChange={(e) => setForm({ ...cur, telegram: { ...tg, defaultChatId: e.target.value } })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={Boolean(tg.enabled)} onChange={(e) => setForm({ ...cur, telegram: { ...tg, enabled: e.target.checked } })} />
            Включить автоматическую отправку видео (фронтальная + задняя + 3-значный код) и фото в Telegram
          </label>
        </div>
      )}

      {section === "retention" && (
        <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
          <h1 className="text-base font-bold">Сроки хранения фото и видео (Retention) и сжатие</h1>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium">Фото Прихода (дней)</label>
              <Input
                type="number"
                value={ret.in?.retentionValue ?? 90}
                onChange={(e) => setForm({ ...cur, retention: { ...ret, in: { ...(ret.in ?? {}), enabled: true, retentionValue: Number(e.target.value), retentionUnit: "day" } } })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Фото Ухода (дней)</label>
              <Input
                type="number"
                value={ret.out?.retentionValue ?? 90}
                onChange={(e) => setForm({ ...cur, retention: { ...ret, out: { ...(ret.out ?? {}), enabled: true, retentionValue: Number(e.target.value), retentionUnit: "day" } } })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Видео-отметки (дней)</label>
              <Input type="number" value={ret.videoDays ?? 30} onChange={(e) => setForm({ ...cur, retention: { ...ret, videoDays: Number(e.target.value) } })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Удаление лица уволенного (дней)</label>
              <Input type="number" value={ret.dismissedFacePurgeDays ?? 30} onChange={(e) => setForm({ ...cur, retention: { ...ret, dismissedFacePurgeDays: Number(e.target.value) } })} />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">
              Авто-сжатие перед сохранением: {ret.compress?.maxEdge ?? 720}px · JPEG {ret.compress?.quality ?? 62}%
            </span>
            <Button variant="outline" size="sm" disabled={!canEdit || runRetentionMut.isPending} onClick={() => void runRetentionMut.mutateAsync()}>
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
        />
      )}

      {section !== "locations" && (
        <div className="flex flex-col items-end gap-2">
          {!canEdit ? (
            <p className="text-xs text-muted-foreground">Нет права на изменение настроек табеля (Доступ).</p>
          ) : null}
          <Button
            disabled={!canEdit || saveMut.isPending}
            onClick={() => void saveMut.mutateAsync(cur).catch((e) => window.alert(getUserFacingError(e, "Ошибка сохранения")))}
          >
            <Save className="mr-1.5 size-4" /> Сохранить настройки
          </Button>
        </div>
      )}
    </div>
  );
}
