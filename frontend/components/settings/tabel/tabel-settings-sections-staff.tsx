"use client";

import Link from "next/link";
import { staffPickerDisplayName } from "@/lib/person-display";
import { userOverridesOf, kioskLeaderIdsOf } from "../tabel-settings.logic";
import { TabelCheckRow, TabelNumberField, TabelSectionCard } from "./tabel-settings-ui";
import { TabelStaffPickerList, TabelStaffPickerTable } from "./tabel-settings-staff-pickers";

export type TabelSettingsDict = Record<string, any>;
export type StaffOpt = { id: number; fio: string; role?: string };

type Props = {
  cur: TabelSettingsDict;
  canEdit: boolean;
  /** Bo'lim maydonlarini `cur` ga qo'shish (boshqa kalitlarga tegmaydi). */
  onPatch: (patch: TabelSettingsDict) => void;
  staffById: Map<number, StaffOpt>;
  staff: StaffOpt[];
};

/* ─────────────────────── punch-video ─────────────────────── */

export function TabelPunchVideoSection({ cur, canEdit, onPatch, staffById, staff }: Props) {
  const pv = cur.punchVideo ?? {};
  const set = (patch: Record<string, unknown>) => onPatch({ punchVideo: { ...pv, ...patch } });

  const overrides = userOverridesOf(pv).sort((a, b) => {
    const an = staffPickerDisplayName(staffById.get(a.id) ?? { fio: `#${a.id}` });
    const bn = staffPickerDisplayName(staffById.get(b.id) ?? { fio: `#${b.id}` });
    return an.localeCompare(bn, "ru");
  });
  const overrideOptions = staff
    .filter((e) => !overrides.some((o) => o.id === e.id))
    .map((e) => ({ id: e.id, name: staffPickerDisplayName(e) }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));

  const setUserOverride = (
    userId: number,
    patch: { enabled?: boolean; codeRequired?: boolean } | null
  ) => {
    const next = { ...(pv.userOverrides ?? {}) } as Record<
      string,
      { enabled: boolean; codeRequired: boolean }
    >;
    if (patch == null) {
      delete next[String(userId)];
    } else {
      const prev = next[String(userId)] ?? { enabled: true, codeRequired: true };
      next[String(userId)] = {
        enabled: patch.enabled ?? prev.enabled,
        codeRequired: patch.codeRequired ?? prev.codeRequired
      };
    }
    set({ userOverrides: next });
  };

  return (
    <TabelSectionCard>
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
        <TabelNumberField
          label="Мин. длительность видео (сек)"
          hint="Не меньше 5 секунд."
          min={5}
          max={10}
          value={pv.minSec ?? 5}
          onChange={(v) => set({ minSec: v })}
        />
        <TabelNumberField
          label="Макс. длительность видео (сек)"
          hint="Не больше 10 секунд. Не меньше минимума."
          min={5}
          max={10}
          value={pv.maxSec ?? 10}
          onChange={(v) => set({ maxSec: v })}
        />
        <div>
          <label className="mb-1 block text-xs font-medium">Режим записи камер</label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={pv.captureMode ?? "sequential"}
            onChange={(e) => set({ captureMode: e.target.value })}
          >
            <option value="sequential">По очереди: фронт → задняя</option>
            <option value="simultaneous">Одновременно (две камеры)</option>
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-2.5 text-xs">
        <TabelCheckRow
          title="Видео-отметка в приложении"
          hint="Если выключено — мобильная видео-отметка недоступна."
          checked={pv.enabled !== false}
          onChange={(v) => set({ enabled: v })}
        />
        <TabelCheckRow
          title="3-значный дневной код"
          hint="Сотрудник должен произнести код дня (100–999). Исключения — в таблице ниже."
          checked={pv.codeRequired !== false}
          onChange={(v) => set({ codeRequired: v })}
        />
        <TabelCheckRow
          title="Видео доступно всем по умолчанию"
          hint="Выключите, если видео нужно только выбранным сотрудникам в исключениях."
          checked={pv.allowAllStaffByDefault !== false}
          onChange={(v) => set({ allowAllStaffByDefault: v })}
        />
      </div>

      <TabelStaffPickerTable
        title="Исключения по сотрудникам"
        hint="Для выбранного сотрудника можно отдельно включить/выключить видео и требование кода. В списке только имя."
        pickLabel="Сотрудник"
        emptyText="Исключений пока нет — действуют общие правила."
        canEdit={canEdit}
        options={overrideOptions}
        rows={overrides.map((row) => ({
          id: row.id,
          name: staffPickerDisplayName(staffById.get(row.id) ?? { fio: `Сотрудник #${row.id}` }),
          first: row.enabled,
          second: row.codeRequired
        }))}
        columns={["Видео", "Код обязателен"]}
        onAdd={(id) =>
          setUserOverride(id, { enabled: true, codeRequired: pv.codeRequired !== false })
        }
        onToggleFirst={(id, v) => setUserOverride(id, { enabled: v })}
        onToggleSecond={(id, v) => setUserOverride(id, { codeRequired: v })}
        onRemove={(id) => setUserOverride(id, null)}
      />
    </TabelSectionCard>
  );
}

/* ─────────────────────── face-antifraud ─────────────────────── */

export function TabelFaceAntifraudSection({ cur, canEdit, onPatch, staffById, staff }: Props) {
  const fa = cur.faceAntifraud ?? {};
  const set = (patch: Record<string, unknown>) => onPatch({ faceAntifraud: { ...fa, ...patch } });
  const kioskLeaderIds = kioskLeaderIdsOf(fa);

  const kioskLeaders = kioskLeaderIds
    .map((id) => ({
      id,
      name: staffPickerDisplayName(staffById.get(id) ?? { fio: `Сотрудник #${id}` })
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));

  const kioskOptions = staff
    .filter((e) => !kioskLeaderIds.includes(e.id))
    .map((e) => ({ id: e.id, name: staffPickerDisplayName(e) }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));

  return (
    <TabelSectionCard>
      <div>
        <h1 className="text-base font-bold">Face ID, Liveness и Анти-фрод</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Порог распознавания лица, проверка «живого» человека (повороты головы), защита от Fake GPS
          и список руководителей для режима Киоск.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TabelNumberField
          label="Порог совпадения лица"
          hint="0.30–0.99. Выше — строже. По умолчанию 0.85."
          step="0.01"
          min={0.3}
          max={0.99}
          value={fa.faceMatchThreshold ?? 0.85}
          onChange={(v) => set({ faceMatchThreshold: v })}
        />
        <TabelNumberField
          label="Порог SFace"
          hint="0.25–0.95. Для модели SFace, по умолчанию 0.45."
          step="0.01"
          min={0.25}
          max={0.95}
          value={fa.sfaceThreshold ?? 0.45}
          onChange={(v) => set({ sfaceThreshold: v })}
        />
        <div>
          <label className="mb-1 block text-xs font-medium">Направления Liveness</label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={fa.livenessDirections ?? 4}
            onChange={(e) => set({ livenessDirections: Number(e.target.value) })}
          >
            <option value={4}>4 направления</option>
            <option value={8}>8 направлений</option>
          </select>
        </div>
        <TabelNumberField
          label="Макс. погрешность GPS (м)"
          hint="15–1000 м. Больше — GPS слишком неточный."
          min={15}
          max={1000}
          value={fa.maxGpsAccuracyM ?? 100}
          onChange={(v) => set({ maxGpsAccuracyM: v })}
        />
        <TabelNumberField
          label="Допуск рассинхрона часов (сек)"
          hint="30–3600. Если телефон и сервер сильно расходятся — отказ."
          min={30}
          max={3600}
          value={fa.maxClockSkewSec ?? 300}
          onChange={(v) => set({ maxClockSkewSec: v })}
        />
      </div>
      <div className="flex flex-col gap-2.5 text-xs">
        <TabelCheckRow
          title="Блокировать Fake GPS"
          hint="Mock Location запрещён."
          checked={fa.blockMockGps !== false}
          onChange={(v) => set({ blockMockGps: v })}
        />
        <TabelCheckRow
          title="Уведомлять HR при мошенничестве"
          hint="При Fake GPS и других срабатываниях антифрода."
          checked={fa.notifyHrOnFraud !== false}
          onChange={(v) => set({ notifyHrOnFraud: v })}
        />
        <TabelCheckRow
          title="Только 1 лицо в кадре"
          hint="Если лиц больше — отметка не принимается."
          checked={fa.requireSingleFace !== false}
          onChange={(v) => set({ requireSingleFace: v })}
        />
        <TabelCheckRow
          title="Фронт + задняя камера"
          hint="Обязательный DualCapture при отметке в приложении."
          checked={fa.requireDualCameraPhoto !== false}
          onChange={(v) => set({ requireDualCameraPhoto: v })}
        />
        <TabelCheckRow
          title="Запрет фото из галереи"
          hint="Только снимок с камеры телефона."
          checked={fa.blockGalleryPhotos !== false}
          onChange={(v) => set({ blockGalleryPhotos: v })}
        />
        <TabelCheckRow
          title="Лицо обязательно при создании сотрудника"
          hint="Без эталонного лица карточку нельзя сохранить."
          checked={Boolean(fa.requireFaceEnrollmentOnStaffCreate)}
          onChange={(v) => set({ requireFaceEnrollmentOnStaffCreate: v })}
        />
        <TabelCheckRow
          title="Вход по Face ID"
          hint="Если включено — вход в приложение требует лицо."
          checked={Boolean(fa.requireFaceLogin)}
          onChange={(v) => set({ requireFaceLogin: v })}
        />
      </div>

      <TabelStaffPickerList
        title="Руководители режима Киоск"
        hint="Админ и супервайзер уже могут. Здесь — дополнительные сотрудники. В списке только имя."
        emptyText="Дополнительных руководителей нет."
        canEdit={canEdit}
        options={kioskOptions}
        rows={kioskLeaders}
        onAdd={(id) => set({ kioskLeaderIds: [...kioskLeaderIds, id] })}
        onRemove={(id) => set({ kioskLeaderIds: kioskLeaderIds.filter((x) => x !== id) })}
      />
    </TabelSectionCard>
  );
}
