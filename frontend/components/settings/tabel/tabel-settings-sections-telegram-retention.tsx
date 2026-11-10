"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getUserFacingError } from "@/lib/error-utils";
import { branchChatRowsOf } from "../tabel-settings.logic";
import { TabelCheckRow, TabelNumberField, TabelSectionCard } from "./tabel-settings-ui";

export type TabelSettingsDict = Record<string, any>;

type BaseProps = {
  cur: TabelSettingsDict;
  canEdit: boolean;
  onPatch: (patch: TabelSettingsDict) => void;
};

/* ─────────────────────── telegram-attendance ─────────────────────── */

export function TabelTelegramSection({
  cur,
  canEdit,
  onPatch,
  branchNames
}: BaseProps & { branchNames: string[] }) {
  const tg = cur.telegram ?? {};
  const set = (patch: Record<string, unknown>) => onPatch({ telegram: { ...tg, ...patch } });

  const [pick, setPick] = useState("");
  const [chatId, setChatId] = useState("");

  const branchChatRows = branchChatRowsOf(tg);
  const taken = new Set(branchChatRows.map((r) => r.branch));
  const branchChatOptions = branchNames.filter((b) => !taken.has(b));

  return (
    <TabelSectionCard>
      <div>
        <h1 className="text-base font-bold">Telegram-группа для отметок</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Сюда уходят фото и видео отметок. Токен бота на экране скрыт. Можно задать общую группу и
          отдельные группы по филиалам.
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
            onChange={(e) => set({ botToken: e.target.value })}
            disabled={!canEdit}
          />
          {tg.hasBotToken ? (
            <button
              type="button"
              className="mt-1 text-[11px] text-rose-700 hover:underline disabled:opacity-50"
              disabled={!canEdit}
              onClick={() => {
                if (!window.confirm("Удалить сохранённый Bot Token?")) return;
                set({ botToken: null, hasBotToken: false });
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
            onChange={(e) => set({ defaultChatId: e.target.value })}
            disabled={!canEdit}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Если у филиала нет своей группы — используется этот ID.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2.5 text-xs">
        <TabelCheckRow
          title="Отправка в Telegram"
          hint="Включить авто-отправку отметок в группу или канал."
          checked={Boolean(tg.enabled)}
          onChange={(v) => set({ enabled: v })}
          disabled={!canEdit}
        />
        <TabelCheckRow
          title="Отправлять фото"
          hint="Фото прихода и ухода."
          checked={tg.sendPhotos !== false}
          onChange={(v) => set({ sendPhotos: v })}
          disabled={!canEdit}
        />
        <TabelCheckRow
          title="Отправлять видео"
          hint="Видео-отметка с фронтальной и задней камеры."
          checked={tg.sendVideos !== false}
          onChange={(v) => set({ sendVideos: v })}
          disabled={!canEdit}
        />
        <TabelCheckRow
          title="Оповещения о мошенничестве"
          hint="Fake GPS и другие срабатывания антифрода."
          checked={tg.sendFraudAlerts !== false}
          onChange={(v) => set({ sendFraudAlerts: v })}
          disabled={!canEdit}
        />
      </div>

      <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
        <div className="text-sm font-semibold">Группы по филиалам</div>
        <p className="text-[11px] text-muted-foreground">
          Для филиала можно задать отдельный Chat ID. В списке только название филиала.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
              Филиал
            </label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={pick}
              onChange={(e) => setPick(e.target.value)}
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
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
              Chat ID
            </label>
            <Input
              value={chatId}
              placeholder="-100..."
              onChange={(e) => setChatId(e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <Button
            type="button"
            size="sm"
            disabled={!canEdit || !pick || !chatId.trim()}
            onClick={() => {
              set({ branchChatIds: { ...(tg.branchChatIds ?? {}), [pick]: chatId.trim() } });
              setPick("");
              setChatId("");
            }}
          >
            <Plus className="mr-1 size-3.5" /> Добавить
          </Button>
        </div>
        {branchChatRows.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Отдельных групп по филиалам нет — используется общий Chat ID.
          </p>
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
                          set({ branchChatIds: next });
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
    </TabelSectionCard>
  );
}

/* ─────────────────────── retention ─────────────────────── */

const PHOTO_POLICIES = [
  { key: "in" as const, title: "Фото прихода", hint: "Снимки на вход" },
  { key: "out" as const, title: "Фото ухода", hint: "Снимки на выход" },
  {
    key: "estimated_out" as const,
    title: "Фото середины дня",
    hint: "Промежуточная / estimated_out отметка"
  }
];

export function TabelRetentionSection({
  cur,
  canEdit,
  onPatch,
  onRunRetention,
  retentionRunning
}: BaseProps & { onRunRetention: () => Promise<unknown>; retentionRunning: boolean }) {
  const ret = cur.retention ?? {};
  const set = (patch: Record<string, unknown>) => onPatch({ retention: { ...ret, ...patch } });

  const setPhotoPolicy = (kind: "in" | "out" | "estimated_out", next: Record<string, unknown>) => {
    const prev = (ret[kind] ?? {}) as Record<string, unknown>;
    set({ [kind]: { ...prev, ...next } });
  };

  return (
    <TabelSectionCard>
      <div>
        <h1 className="text-base font-bold">Сроки хранения фото и видео</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Старые файлы удаляются по сроку. Сжатие уменьшает размер перед сохранением. Очистка
          необратима.
        </p>
      </div>

      {PHOTO_POLICIES.map((row) => {
        const policy = (ret[row.key] ?? {}) as Record<string, unknown>;
        const enabled = policy.enabled !== false;
        return (
          <div key={row.key} className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <TabelCheckRow
              title={row.title}
              hint={row.hint}
              checked={enabled}
              onChange={(v) => setPhotoPolicy(row.key, { enabled: v })}
              disabled={!canEdit}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TabelNumberField
                label="Срок"
                min={1}
                max={3650}
                value={(policy.retentionValue as number) ?? 90}
                onChange={(v) => setPhotoPolicy(row.key, { retentionValue: v })}
                disabled={!canEdit || !enabled}
              />
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  Единица
                </label>
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
        <TabelNumberField
          label="Видео-отметки (дней)"
          hint="1–3650 дней."
          min={1}
          max={3650}
          value={ret.videoDays ?? 30}
          onChange={(v) => set({ videoDays: v })}
          disabled={!canEdit}
        />
        <TabelNumberField
          label="Удаление лица уволенного (дней)"
          hint="0 — не удалять эталон лица автоматически."
          min={0}
          max={3650}
          value={ret.dismissedFacePurgeDays ?? 30}
          onChange={(v) => set({ dismissedFacePurgeDays: v })}
          disabled={!canEdit}
        />
      </div>

      <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
        <TabelCheckRow
          title="Сжатие фото перед сохранением"
          hint="Уменьшает диск и трафик Telegram."
          checked={ret.compress?.enabled !== false}
          onChange={(v) => set({ compress: { ...(ret.compress ?? {}), enabled: v } })}
          disabled={!canEdit}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TabelNumberField
            label="Макс. сторона (px)"
            hint="240–1920."
            min={240}
            max={1920}
            value={ret.compress?.maxEdge ?? 720}
            onChange={(v) => set({ compress: { ...(ret.compress ?? {}), maxEdge: v } })}
            disabled={!canEdit || ret.compress?.enabled === false}
          />
          <TabelNumberField
            label="JPEG качество (%)"
            hint="30–95."
            min={30}
            max={95}
            value={ret.compress?.quality ?? 62}
            onChange={(v) => set({ compress: { ...(ret.compress ?? {}), quality: v } })}
            disabled={!canEdit || ret.compress?.enabled === false}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <p className="text-[11px] text-muted-foreground">
          Ручная очистка сразу применяет текущие сроки на сервере.
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={!canEdit || retentionRunning}
          onClick={() => {
            if (
              !window.confirm(
                "Удалить устаревшие фото, видео и эталоны лиц по текущим срокам? Это необратимо."
              )
            )
              return;
            void onRunRetention().catch((e) =>
              window.alert(getUserFacingError(e, "Ошибка очистки"))
            );
          }}
        >
          Запустить очистку сейчас
        </Button>
      </div>
    </TabelSectionCard>
  );
}
