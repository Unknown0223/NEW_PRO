"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { dashboardReportsNav } from "@/components/dashboard/nav-config";
import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { firstValidationUserHint, getZodFlattenFromApiErrorBody } from "@/lib/api-validation-details";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { isAxiosError } from "axios";

type UiPrefsRoot = { reports?: { hidden_menu_item_hrefs?: string[] } };

export default function ReportSettingsPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const prefsQ = useQuery({
    queryKey: ["me", "ui-preferences", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{ data: UiPrefsRoot }>(`/api/${tenantSlug}/me/ui-preferences`);
      return data.data ?? {};
    }
  });

  const saveMut = useMutation({
    mutationFn: async (hiddenHrefs: string[]) => {
      await api.patch(`/api/${tenantSlug}/me/ui-preferences`, {
        reports: { hidden_menu_item_hrefs: hiddenHrefs }
      });
    },
    onSuccess: async () => {
      setSaveErr(null);
      await qc.invalidateQueries({ queryKey: ["me", "ui-preferences", tenantSlug] });
    }
  });

  const items = useMemo(
    () =>
      dashboardReportsNav.items
        .filter((x) => !x.disabled && x.href !== "#" && x.href !== "/reports/settings")
        .map((x) => ({ href: x.href, label: x.label })),
    []
  );
  const validHrefSet = useMemo(() => new Set(items.map((x) => x.href)), [items]);

  const hiddenFromServer = useMemo(() => {
    const raw = prefsQ.data?.reports?.hidden_menu_item_hrefs;
    if (!Array.isArray(raw)) return new Set<string>();
    return new Set(
      raw
        .filter((x) => typeof x === "string")
        .map((x) => x.trim())
        .filter((x) => x.length > 0 && x.length <= 200 && validHrefSet.has(x))
    );
  }, [prefsQ.data?.reports?.hidden_menu_item_hrefs, validHrefSet]);

  const [localOverride, setLocalOverride] = useState<Set<string> | null>(null);

  const hidden = localOverride ?? hiddenFromServer;
  const searchNorm = search.trim().toLowerCase();
  const visibleItems = useMemo(
    () => (searchNorm ? items.filter((x) => x.label.toLowerCase().includes(searchNorm)) : items),
    [items, searchNorm]
  );
  const checkedCount = items.reduce((acc, item) => acc + (hidden.has(item.href) ? 0 : 1), 0);

  const setHidden = (updater: (prev: Set<string>) => Set<string>) => {
    setLocalOverride((prev) => updater(prev ? new Set(prev) : new Set(hiddenFromServer)));
  };

  const toggleItem = (href: string, checked: boolean) => {
    setHidden((prev) => {
      if (checked) prev.delete(href);
      else prev.add(href);
      return prev;
    });
  };

  const toggleAllVisible = (checked: boolean) => {
    setHidden((prev) => {
      for (const item of visibleItems) {
        if (checked) prev.delete(item.href);
        else prev.add(item.href);
      }
      return prev;
    });
  };

  const allVisibleChecked = visibleItems.length > 0 && visibleItems.every((x) => !hidden.has(x.href));

  return (
    <div className="mx-auto w-full max-w-2xl p-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Показать/скрыть отчеты из меню</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск"
              className="pl-8"
            />
          </div>

          {saveErr ? (
            <p className="text-sm text-destructive" role="alert">
              {saveErr}
            </p>
          ) : null}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allVisibleChecked}
              onChange={(e) => toggleAllVisible(e.target.checked)}
            />
            Выбрать все
          </label>

          <div className="max-h-[55vh] space-y-1 overflow-y-auto rounded-md border p-2">
            {visibleItems.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Ничего не найдено</p>
            ) : (
              visibleItems.map((item) => {
                const checked = !hidden.has(item.href);
                return (
                  <label
                    key={item.href}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50"
                  >
                    <input type="checkbox" checked={checked} onChange={(e) => toggleItem(item.href, e.target.checked)} />
                    <span>{item.label}</span>
                  </label>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Показано: {checkedCount} из {items.length}</p>
            <Button
              type="button"
              className="min-w-32"
              disabled={saveMut.isPending}
              onClick={() => {
                setSaveErr(null);
                void saveMut
                  .mutateAsync(Array.from(hidden).filter((x) => x.length > 0 && x.length <= 200 && validHrefSet.has(x)))
                  .catch((err: unknown) => {
                    if (isAxiosError(err)) {
                      const flat = getZodFlattenFromApiErrorBody(err.response?.data);
                      const hint = flat ? firstValidationUserHint(flat) : undefined;
                      if (hint) {
                        setSaveErr(withApiSupportLine(hint, err));
                        return;
                      }
                    }
                    setSaveErr(getUserFacingError(err, "Ошибка сохранения"));
                  });
              }}
            >
              {saveMut.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Сохранить
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
