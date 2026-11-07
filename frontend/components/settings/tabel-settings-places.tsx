"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { activeBranchNamesFromProfile, type BranchRefRow } from "@/lib/branch-options";
import { getUserFacingError } from "@/lib/error-utils";
import { usePermissions } from "@/lib/use-permissions";

type LocRow = {
  id: number;
  name: string;
  address?: string | null;
  branch?: string | null;
  lat: number;
  lng: number;
  radius_m: number;
  require_comment_outside?: boolean;
  is_active?: boolean;
};

const emptyForm = {
  name: "",
  address: "",
  branch: "",
  lat: "40.7821",
  lng: "72.3442",
  radius: "150",
  requireComment: true,
  isActive: true
};

export function TabelSettingsLocationsPanel() {
  const { tenantSlug } = useAuthStore();
  const canEdit = usePermissions().has("settings.tabel_pravila.update");
  const qc = useQueryClient();
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const locationsQ = useQuery({
    queryKey: ["tabel", "locations", tenantSlug],
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const { data } = await api.get<{ data: { items: LocRow[] } }>(`/api/${tenantSlug}/tabel/locations`);
      return data.data.items ?? [];
    }
  });

  const branchesQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug, "tabel-locations-branches"],
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const { data } = await api.get<{ references?: { branches?: BranchRefRow[] } }>(`/api/${tenantSlug}/settings/profile`);
      return data.references?.branches ?? [];
    }
  });
  const branchNames = useMemo(() => activeBranchNamesFromProfile(branchesQ.data ?? []), [branchesQ.data]);

  function resetForm() {
    setEditId(null);
    setForm(emptyForm);
  }

  function startEdit(loc: LocRow) {
    setEditId(loc.id);
    setForm({
      name: loc.name ?? "",
      address: loc.address ?? "",
      branch: loc.branch ?? "",
      lat: String(loc.lat ?? ""),
      lng: String(loc.lng ?? ""),
      radius: String(loc.radius_m ?? 150),
      requireComment: loc.require_comment_outside !== false,
      isActive: loc.is_active !== false
    });
  }

  function formOk(): boolean {
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    const radius = Number(form.radius);
    return (
      form.name.trim().length > 0 &&
      Number.isFinite(lat) &&
      lat >= -90 &&
      lat <= 90 &&
      Number.isFinite(lng) &&
      lng >= -180 &&
      lng <= 180 &&
      Number.isFinite(radius) &&
      radius >= 20 &&
      radius <= 5000
    );
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      await api.post(`/api/${tenantSlug}/tabel/locations`, {
        id: editId ?? undefined,
        name: form.name.trim(),
        address: form.address.trim() || null,
        branch: form.branch.trim() || null,
        lat: Number(form.lat),
        lng: Number(form.lng),
        radius_m: Number(form.radius) || 150,
        require_comment_outside: form.requireComment,
        is_active: form.isActive
      });
    },
    onSuccess: async () => {
      resetForm();
      await qc.invalidateQueries({ queryKey: ["tabel", "locations", tenantSlug] });
    }
  });

  const delLocMut = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/${tenantSlug}/tabel/locations/${id}`);
    },
    onSuccess: async () => {
      if (editId) resetForm();
      await qc.invalidateQueries({ queryKey: ["tabel", "locations", tenantSlug] });
    }
  });

  const rows = locationsQ.data ?? [];

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
      <div>
        <h1 className="text-base font-bold">Локации и гео-зоны</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Офисы и склады для проверки геозоны. Вне радиуса можно требовать комментарий. В выборе филиала — только название.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
        <div className="text-sm font-semibold">{editId ? "Редактирование точки" : "Новая точка"}</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium">Название</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Центральный офис"
              disabled={!canEdit}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Филиал</label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
              value={form.branch}
              onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))}
              disabled={!canEdit}
            >
              <option value="">Без филиала (общая точка)</option>
              {branchNames.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
              {form.branch && !branchNames.includes(form.branch) ? <option value={form.branch}>{form.branch}</option> : null}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium">Адрес</label>
            <Input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Улица, дом (необязательно)"
              disabled={!canEdit}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Широта (Lat)</label>
            <Input value={form.lat} onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))} disabled={!canEdit} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Долгота (Lng)</label>
            <Input value={form.lng} onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))} disabled={!canEdit} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Радиус (м)</label>
            <Input
              type="number"
              min={20}
              max={5000}
              value={form.radius}
              onChange={(e) => setForm((f) => ({ ...f, radius: e.target.value }))}
              disabled={!canEdit}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">20–5000 м.</p>
          </div>
          <div className="flex flex-col justify-end gap-2 pb-1 text-xs">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.requireComment}
                onChange={(e) => setForm((f) => ({ ...f, requireComment: e.target.checked }))}
                disabled={!canEdit}
              />
              Комментарий вне радиуса
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                disabled={!canEdit}
              />
              Активна
            </label>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={!canEdit || saveMut.isPending || !formOk()}
            onClick={() => {
              if (!formOk()) {
                window.alert("Проверьте: название, широта −90…90, долгота −180…180, радиус 20–5000.");
                return;
              }
              void saveMut.mutateAsync().catch((e) => window.alert(getUserFacingError(e, "Ошибка сохранения локации")));
            }}
          >
            {editId ? (
              <>
                <Pencil className="mr-1 size-3.5" /> Сохранить
              </>
            ) : (
              <>
                <Plus className="mr-1 size-3.5" /> Добавить
              </>
            )}
          </Button>
          {editId ? (
            <Button type="button" size="sm" variant="ghost" disabled={!canEdit} onClick={resetForm}>
              <X className="mr-1 size-3.5" /> Отмена
            </Button>
          ) : null}
          {!canEdit ? <span className="text-[11px] text-muted-foreground">Нет права на изменение.</span> : null}
        </div>
      </div>

      {locationsQ.isLoading ? (
        <p className="text-xs text-muted-foreground">Загрузка…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Локаций пока нет.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border bg-background">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-muted/50 text-[11px] text-muted-foreground">
              <tr>
                <th className="px-2.5 py-2">Точка</th>
                <th className="px-2.5 py-2">Филиал</th>
                <th className="px-2.5 py-2">Координаты</th>
                <th className="px-2.5 py-2">Радиус</th>
                <th className="px-2.5 py-2">Правила</th>
                <th className="px-2.5 py-2 text-right"> </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((loc) => (
                <tr key={loc.id} className={loc.is_active === false ? "opacity-60" : undefined}>
                  <td className="px-2.5 py-2">
                    <div className="flex items-start gap-1.5">
                      <MapPin className="mt-0.5 size-3.5 shrink-0 text-teal-700" />
                      <div>
                        <div className="font-semibold">{loc.name}</div>
                        {loc.address ? <div className="text-[11px] text-muted-foreground">{loc.address}</div> : null}
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2">{loc.branch || "—"}</td>
                  <td className="whitespace-nowrap px-2.5 py-2 font-mono text-[11px]">
                    {loc.lat}, {loc.lng}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2">{loc.radius_m} м</td>
                  <td className="px-2.5 py-2 text-[11px] text-muted-foreground">
                    {loc.is_active === false ? "выкл." : "активна"}
                    {loc.require_comment_outside !== false ? " · коммент вне зоны" : ""}
                  </td>
                  <td className="px-2.5 py-2 text-right">
                    <div className="inline-flex gap-0.5">
                      <Button type="button" size="sm" variant="ghost" className="h-7" disabled={!canEdit} onClick={() => startEdit(loc)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-rose-600"
                        disabled={!canEdit || delLocMut.isPending}
                        onClick={() => {
                          if (!window.confirm(`Удалить локацию «${loc.name}»?`)) return;
                          void delLocMut.mutateAsync(loc.id).catch((e) => window.alert(getUserFacingError(e, "Ошибка удаления")));
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export type AbsenceDictRow = {
  code: string;
  labelRu: string;
  labelUz: string;
  paid: boolean;
  requiresAttachment: boolean;
};

export type ClearanceDictRow = {
  code: string;
  labelRu: string;
  department: string;
};

function slugifyCode(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export function TabelSettingsDictionariesPanel({
  absenceTypes,
  clearanceItems,
  canEdit,
  onChange
}: {
  absenceTypes: AbsenceDictRow[];
  clearanceItems: ClearanceDictRow[];
  canEdit: boolean;
  onChange: (next: { absenceTypes: AbsenceDictRow[]; clearanceItems: ClearanceDictRow[] }) => void;
}) {
  function setAbsence(next: AbsenceDictRow[]) {
    onChange({ absenceTypes: next, clearanceItems });
  }

  function setClearance(next: ClearanceDictRow[]) {
    onChange({ absenceTypes, clearanceItems: next });
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
      <div>
        <h1 className="text-base font-bold">Справочники отсутствий и обходного листа</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Виды заявок (отпуск, больничный, командировка и др.) и пункты обходного листа при увольнении. Код — внутренний ключ.
        </p>
      </div>

      <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold">Виды отсутствий / сверхурочных</div>
          <Button
            type="button"
            size="sm"
            disabled={!canEdit}
            onClick={() =>
              setAbsence([
                ...absenceTypes,
                {
                  code: `type_${absenceTypes.length + 1}`,
                  labelRu: "",
                  labelUz: "",
                  paid: true,
                  requiresAttachment: false
                }
              ])
            }
          >
            <Plus className="mr-1 size-3.5" /> Добавить вид
          </Button>
        </div>
        {absenceTypes.length === 0 ? (
          <p className="text-xs text-muted-foreground">Список пуст — добавьте хотя бы один вид.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border bg-background">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-muted/50 text-[11px] text-muted-foreground">
                <tr>
                  <th className="px-2 py-2">Код</th>
                  <th className="px-2 py-2">Название (RU)</th>
                  <th className="px-2 py-2">Название (UZ)</th>
                  <th className="px-2 py-2">Оплач.</th>
                  <th className="px-2 py-2">Вложение</th>
                  <th className="px-2 py-2 text-right"> </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {absenceTypes.map((row, idx) => (
                  <tr key={`abs-${idx}`}>
                    <td className="px-2 py-1.5">
                      <Input
                        className="h-8 font-mono text-[11px]"
                        value={row.code}
                        disabled={!canEdit}
                        onChange={(e) => {
                          const next = absenceTypes.map((r, i) => (i === idx ? { ...r, code: slugifyCode(e.target.value) || r.code } : r));
                          setAbsence(next);
                        }}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        className="h-8"
                        value={row.labelRu}
                        disabled={!canEdit}
                        onChange={(e) => {
                          const next = absenceTypes.map((r, i) => (i === idx ? { ...r, labelRu: e.target.value } : r));
                          setAbsence(next);
                        }}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        className="h-8"
                        value={row.labelUz}
                        disabled={!canEdit}
                        onChange={(e) => {
                          const next = absenceTypes.map((r, i) => (i === idx ? { ...r, labelUz: e.target.value } : r));
                          setAbsence(next);
                        }}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={row.paid}
                        disabled={!canEdit}
                        onChange={(e) => {
                          const next = absenceTypes.map((r, i) => (i === idx ? { ...r, paid: e.target.checked } : r));
                          setAbsence(next);
                        }}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={row.requiresAttachment}
                        disabled={!canEdit}
                        onChange={(e) => {
                          const next = absenceTypes.map((r, i) => (i === idx ? { ...r, requiresAttachment: e.target.checked } : r));
                          setAbsence(next);
                        }}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-rose-600"
                        disabled={!canEdit || absenceTypes.length <= 1}
                        onClick={() => setAbsence(absenceTypes.filter((_, i) => i !== idx))}
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

      <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">Пункты обходного листа</div>
            <p className="text-[11px] text-muted-foreground">Шаблон для новых листов. Уже созданные листы не меняются массово.</p>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={!canEdit}
            onClick={() =>
              setClearance([
                ...clearanceItems,
                { code: `item_${clearanceItems.length + 1}`, labelRu: "", department: "" }
              ])
            }
          >
            <Plus className="mr-1 size-3.5" /> Добавить пункт
          </Button>
        </div>
        {clearanceItems.length === 0 ? (
          <p className="text-xs text-muted-foreground">Список пуст — добавьте хотя бы один пункт.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border bg-background">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-muted/50 text-[11px] text-muted-foreground">
                <tr>
                  <th className="px-2 py-2">Код</th>
                  <th className="px-2 py-2">Название</th>
                  <th className="px-2 py-2">Отдел</th>
                  <th className="px-2 py-2 text-right"> </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {clearanceItems.map((row, idx) => (
                  <tr key={`clr-${idx}`}>
                    <td className="px-2 py-1.5">
                      <Input
                        className="h-8 font-mono text-[11px]"
                        value={row.code}
                        disabled={!canEdit}
                        onChange={(e) => {
                          const next = clearanceItems.map((r, i) => (i === idx ? { ...r, code: slugifyCode(e.target.value) || r.code } : r));
                          setClearance(next);
                        }}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        className="h-8"
                        value={row.labelRu}
                        disabled={!canEdit}
                        onChange={(e) => {
                          const next = clearanceItems.map((r, i) => (i === idx ? { ...r, labelRu: e.target.value } : r));
                          setClearance(next);
                        }}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        className="h-8"
                        value={row.department}
                        disabled={!canEdit}
                        onChange={(e) => {
                          const next = clearanceItems.map((r, i) => (i === idx ? { ...r, department: e.target.value } : r));
                          setClearance(next);
                        }}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-rose-600"
                        disabled={!canEdit || clearanceItems.length <= 1}
                        onClick={() => setClearance(clearanceItems.filter((_, i) => i !== idx))}
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
  );
}
