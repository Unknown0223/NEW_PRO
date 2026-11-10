"use client";

import { Button } from "@/components/ui/button";
import { TIMESHEET_ROLE_LABELS } from "@/components/timesheet/timesheet-shared";
import {
  applyRoleMethod,
  clearRole,
  resolvePunchMethods,
  roleMethodValue,
  type PunchMethodKey,
  type PunchModesValue
} from "../tabel-settings.logic";
import { TabelCheckRow, TabelNumberField, TabelSectionCard } from "./tabel-settings-ui";

export type TabelSettingsDict = Record<string, any>;

type Props = {
  cur: TabelSettingsDict;
  canEdit: boolean;
  onPatch: (patch: TabelSettingsDict) => void;
};

const PUNCH_METHOD_COLS: Array<{ key: PunchMethodKey; label: string }> = [
  { key: "photo", label: "Фото + Face ID" },
  { key: "video", label: "Видео + код" },
  { key: "kiosk", label: "Киоск" },
  { key: "terminal", label: "Терминал" }
];

const PUNCH_MODE_ROLES = Object.keys(TIMESHEET_ROLE_LABELS);

/* ─────────────────────── lateness-rules ─────────────────────── */

export function TabelLatenessSection({ cur, onPatch }: Props) {
  const lateness = cur.lateness ?? {};
  const set = (patch: Record<string, unknown>) => onPatch({ lateness: { ...lateness, ...patch } });

  return (
    <TabelSectionCard>
      <div>
        <h1 className="text-base font-bold">Правила опозданий и штрафов</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Первые опоздания в месяце можно простить. Остальные и ранний уход считаются по этим
          лимитам. Пример: 3 раза до 15 минут — полный день; дальше опоздание без прощения.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TabelNumberField
          label="Допустимых опозданий в месяц"
          hint="0–31. Сколько раз в месяц можно опоздать без штрафа."
          min={0}
          max={31}
          value={lateness.excusedPerMonth ?? 3}
          onChange={(v) => set({ excusedPerMonth: v })}
        />
        <TabelNumberField
          label="Максимум минут для прощения"
          hint="Если опоздание дольше — прощение не действует."
          min={1}
          max={1440}
          value={lateness.excusedMaxMinutes ?? 15}
          onChange={(v) => set({ excusedMaxMinutes: v })}
        />
        <TabelNumberField
          label="Льгота при раннем уходе (мин)"
          hint="Раньше уход на эти минуты не считается нарушением."
          min={0}
          max={240}
          value={lateness.earlyLeaveGraceMinutes ?? 15}
          onChange={(v) => set({ earlyLeaveGraceMinutes: v })}
        />
      </div>
      <div className="flex flex-col gap-2.5 text-xs">
        <TabelCheckRow
          title="Прощение опозданий"
          hint="Первые N опозданий в месяц (до лимита минут) считаются полным днём 1.0."
          checked={lateness.excusedEnabled !== false}
          onChange={(v) => set({ excusedEnabled: v })}
        />
        <TabelCheckRow
          title="Штраф за опоздание без прощения"
          hint="Непрощённое опоздание считать половиной дня (0.5), а не полным днём."
          checked={Boolean(lateness.penalizeUnexcusedLateAsHalfDay)}
          onChange={(v) => set({ penalizeUnexcusedLateAsHalfDay: v })}
        />
        <TabelCheckRow
          title="Уведомление при входе с терминала"
          hint="После Face ID / киоска отметки сотрудник получает уведомление о приходе."
          checked={lateness.notifyTerminalArrival !== false}
          onChange={(v) => set({ notifyTerminalArrival: v })}
        />
        <TabelCheckRow
          title="Без отметки = прогул (не агент)"
          hint="Складчик, кассир, оператор, экспедитор и др. без прихода/ухода за рабочий день получают «Прогул (0)». По умолчанию включено. Выключите, если таким ролям без отметки считать «Отработал»."
          checked={lateness.strictNonAgentAbsent !== false}
          onChange={(v) => set({ strictNonAgentAbsent: v })}
        />
      </div>
    </TabelSectionCard>
  );
}

/* ─────────────────────── punch-modes ─────────────────────── */

export function TabelPunchModesSection({ cur, onPatch }: Props) {
  const punchModes = (cur.punchModes ?? {}) as PunchModesValue;
  const punchMethods = resolvePunchMethods(punchModes);
  const punchByRole = punchModes.byRole ?? {};

  const setPunchModes = (next: PunchModesValue) =>
    onPatch({
      punchModes: {
        methods: { ...punchMethods, ...(next.methods ?? {}) },
        byRole: next.byRole !== undefined ? next.byRole : punchByRole
      }
    });

  return (
    <TabelSectionCard>
      <div>
        <h1 className="text-base font-bold">Режимы отметки (способы посещаемости)</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          В мобильном приложении видны только включённые способы. Если у роли только «Терминал» —
          отметка только с Face ID терминала. Несколько способов — сотрудник выбирает вкладку. Киоск
          дополнительно ограничен списком руководителей (Face ID / Анти-фрод).
        </p>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Базовые способы (для всех ролей)</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PUNCH_METHOD_COLS.map((col) => (
            <TabelCheckRow
              key={col.key}
              title={col.label}
              hint={
                col.key === "terminal"
                  ? "Hikvision / Office-Link. Без мобильных вкладок, если это единственный способ."
                  : col.key === "kiosk"
                    ? "Только админ, супервайзер или руководители из списка киоска."
                    : col.key === "video"
                      ? "Параметры длительности и кода — на вкладке «Видео и 3-значный код»."
                      : "Фото с фронтальной/задней камеры и Face ID."
              }
              checked={punchMethods[col.key]}
              onChange={(v) => setPunchModes({ methods: { [col.key]: v } })}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Матрица по ролям</h2>
        <p className="text-[11px] text-muted-foreground">
          «Как база» — берётся базовый флажок выше. «Вкл» / «Выкл» — жёстко для роли. Пустая строка
          = полное наследование.
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
                    const v = roleMethodValue(punchByRole, role, col.key);
                    return (
                      <td key={col.key} className="px-2 py-1.5">
                        <select
                          className="h-8 w-full min-w-[96px] rounded-md border border-input bg-background px-1.5 text-[11px]"
                          value={v}
                          onChange={(e) => {
                            const next = e.target.value as "default" | "on" | "off";
                            setPunchModes({
                              byRole: applyRoleMethod(
                                punchByRole,
                                role,
                                col.key,
                                next === "default" ? null : next === "on"
                              )
                            });
                          }}
                        >
                          <option value="default">
                            Как база ({punchMethods[col.key] ? "вкл" : "выкл"})
                          </option>
                          <option value="on">Вкл</option>
                          <option value="off">Выкл</option>
                        </select>
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5">
                    {punchByRole[role] ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-[11px]"
                        onClick={() => setPunchModes({ byRole: clearRole(punchByRole, role) })}
                      >
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
    </TabelSectionCard>
  );
}
