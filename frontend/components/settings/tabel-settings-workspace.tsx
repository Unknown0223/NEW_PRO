"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { getUserFacingError } from "@/lib/error-utils";
import { activeBranchNamesFromProfile, type BranchRefRow } from "@/lib/branch-options";
import { usePermissions } from "@/lib/use-permissions";
import {
  TabelSettingsDictionariesPanel,
  TabelSettingsLocationsPanel
} from "./tabel-settings-places";
import { branchChatRowsOf, sectionValid, SECTION_ERROR_MESSAGES } from "./tabel-settings.logic";
import {
  TabelLatenessSection,
  TabelPunchModesSection,
  TabelPunchVideoSection,
  TabelFaceAntifraudSection
} from "./tabel/tabel-settings-sections-punch";
import {
  TabelRetentionSection,
  TabelTelegramSection
} from "./tabel/tabel-settings-sections-telegram-retention";

export type { StaffOpt } from "./tabel/tabel-settings-sections-staff";

type StaffOpt = { id: number; fio: string; role?: string };

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
  {
    slug: "telegram-attendance",
    label: "Telegram-группа",
    href: "/settings/tabel/telegram-attendance"
  },
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
      const { data } = await api.get<{ data: Record<string, any> }>(
        `/api/${tenantSlug}/settings/tabel`
      );
      return data.data;
    }
  });

  const needsStaff = section === "punch-video" || section === "face-antifraud";
  const staffQ = useQuery({
    queryKey: ["timesheet", "filters", tenantSlug, "tabel-settings-staff"],
    enabled: Boolean(tenantSlug) && needsStaff,
    queryFn: async () => {
      const { data } = await api.get<{ data: { employees: StaffOpt[] } }>(
        `/api/${tenantSlug}/timesheet/filters`
      );
      return data.data.employees ?? [];
    }
  });

  const branchesQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug, "tabel-telegram-branches"],
    enabled: Boolean(tenantSlug) && section === "telegram-attendance",
    queryFn: async () => {
      const { data } = await api.get<{ references?: { branches?: BranchRefRow[] } }>(
        `/api/${tenantSlug}/settings/profile`
      );
      return data.references?.branches ?? [];
    }
  });
  const branchNames = useMemo(
    () => activeBranchNamesFromProfile(branchesQ.data ?? []),
    [branchesQ.data]
  );

  const [form, setForm] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    if (settingsQ.data && !form) setForm(structuredClone(settingsQ.data));
  }, [settingsQ.data, form]);

  const saveMut = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.put<{ data: Record<string, any> }>(
        `/api/${tenantSlug}/settings/tabel`,
        payload
      );
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
      const { data } = await api.post<{ data: Record<string, number> }>(
        `/api/${tenantSlug}/settings/tabel/run-retention`,
        {}
      );
      return data.data;
    },
    onSuccess: (res) => {
      setSavedNotice(
        `Очистка выполнена: фото=${res.photosPurged ?? 0}, видео=${res.videosPurged ?? 0}, закрыто смен=${res.shiftsClosed ?? 0}`
      );
    }
  });

  const cur = form ?? settingsQ.data ?? {};
  const staffById = useMemo(() => {
    const map = new Map<number, StaffOpt>();
    for (const e of staffQ.data ?? []) map.set(e.id, e);
    return map;
  }, [staffQ.data]);

  /** Faqat bitta kalitni yangilaydi — qolgan sozlamalar tegilmaydi. */
  function patchSection(patch: Record<string, any>) {
    setForm({ ...cur, ...patch });
  }

  const branchChatRows = useMemo(() => branchChatRowsOf(cur.telegram ?? {}), [cur.telegram]);
  const valid = sectionValid(section, { cur, branchChatRows });
  const saveDisabled = !canEdit || saveMut.isPending || valid === false;

  function handleSave() {
    const message = SECTION_ERROR_MESSAGES[section];
    if (valid === false && message) {
      window.alert(message);
      return;
    }
    const tg = cur.telegram ?? {};
    const payload =
      section === "telegram-attendance"
        ? {
            ...cur,
            telegram: {
              ...tg,
              botToken:
                tg.botToken === null
                  ? null
                  : String(tg.botToken ?? "").trim() === ""
                    ? ""
                    : tg.botToken
            }
          }
        : cur;
    void saveMut
      .mutateAsync(payload)
      .catch((e) => window.alert(getUserFacingError(e, "Ошибка сохранения")));
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
        <TabelLatenessSection cur={cur} canEdit={canEdit} onPatch={patchSection} />
      )}

      {section === "punch-modes" && (
        <TabelPunchModesSection cur={cur} canEdit={canEdit} onPatch={patchSection} />
      )}

      {section === "punch-video" && (
        <TabelPunchVideoSection
          cur={cur}
          canEdit={canEdit}
          onPatch={patchSection}
          staff={staffQ.data ?? []}
          staffById={staffById}
        />
      )}

      {section === "face-antifraud" && (
        <TabelFaceAntifraudSection
          cur={cur}
          canEdit={canEdit}
          onPatch={patchSection}
          staff={staffQ.data ?? []}
          staffById={staffById}
        />
      )}

      {section === "telegram-attendance" && (
        <TabelTelegramSection
          cur={cur}
          canEdit={canEdit}
          onPatch={patchSection}
          branchNames={branchNames}
        />
      )}

      {section === "retention" && (
        <TabelRetentionSection
          cur={cur}
          canEdit={canEdit}
          onPatch={patchSection}
          onRunRetention={() => runRetentionMut.mutateAsync()}
          retentionRunning={runRetentionMut.isPending}
        />
      )}

      {section === "locations" && <TabelSettingsLocationsPanel />}

      {section === "dictionaries" && (
        <TabelSettingsDictionariesPanel
          absenceTypes={cur.dictionaries?.absenceTypes ?? []}
          clearanceItems={cur.dictionaries?.clearanceItems ?? []}
          canEdit={canEdit}
          onChange={(next) => patchSection({ dictionaries: next })}
        />
      )}

      {section !== "locations" && (
        <div className="flex flex-col items-end gap-2">
          {!canEdit ? (
            <p className="text-xs text-muted-foreground">
              Нет права на изменение настроек табеля (Доступ).
            </p>
          ) : null}
          <Button disabled={saveDisabled} onClick={handleSave}>
            <Save className="mr-1.5 size-4" /> Сохранить настройки
          </Button>
        </div>
      )}
    </div>
  );
}
