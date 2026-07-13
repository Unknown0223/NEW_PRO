"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { cn } from "@/lib/utils";
import { ClientEditFormExtraTab } from "./client-edit-form-extra-tab";
import { ClientEditFormMainTab } from "./client-edit-form-main-tab";
import { useClientEditForm } from "./hooks/use-client-edit-form";

export function ClientEditForm(props: Parameters<typeof useClientEditForm>[0]) {
  const vm = useClientEditForm(props);
  const { isCreateMode, clientQ, onCancel, tab, setTab } = vm;

  if (!isCreateMode && clientQ.isError) {
    return (
      <div className="space-y-4">
        <PageHeader title="Редактирование клиента" description="Ошибка загрузки" />
        <p className="text-sm text-destructive">Не удалось загрузить карточку.</p>
        <Button type="button" variant="outline" onClick={onCancel}>
          Назад
        </Button>
      </div>
    );
  }

  if (!isCreateMode && !clientQ.data && clientQ.isLoading) {
    return <p className="text-sm text-muted-foreground">Загрузка…</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-[min(100%,90rem)] flex-col gap-4 px-3 pb-10 pt-1 sm:px-4 lg:px-6">
      <PageHeader
        title={isCreateMode ? "Создание клиента" : "Редактирование клиента"}
        description={
          isCreateMode
            ? "Создание клиента: структура и связи как в редактировании, начальные поля пустые."
            : "На основной вкладке: сверху ввод с клавиатуры, ниже — выбор из справочников. Команда и карта справа."
        }
        actions={
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Назад
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
        <div className="flex flex-wrap gap-3">
          <span>
            <span className="text-blue-600 dark:text-blue-400">■</span> Ввод с клавиатуры
          </span>
          <span>
            <span className="text-emerald-700 dark:text-emerald-400">■</span> Выбор из справочников (
            <Link href="/settings/spravochnik/client-lists" className="underline underline-offset-2">
              справочники клиента
            </Link>
            ,{" "}
            <Link href="/settings/spravochnik/agents" className="underline underline-offset-2">
              агенты
            </Link>
            ,{" "}
            <Link href="/settings/spravochnik/expeditors" className="underline underline-offset-2">
              экспедиторы
            </Link>
            )
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {(
          [
            ["main", "Основные сведения"],
            ["extra", "Дополнительно"]
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={cn(
              "rounded-t-md border border-b-0 px-3 py-2 text-sm font-medium transition-colors",
              tab === id
                ? "border-border bg-background text-foreground"
                : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted/60"
            )}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <ClientEditFormMainTab vm={vm} />
      <ClientEditFormExtraTab vm={vm} />

      {vm.localError ? <p className="text-sm text-destructive">{vm.localError}</p> : null}
      {vm.saveNotice ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{vm.saveNotice}</p> : null}

      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={vm.mutation.isPending}>
          Отмена
        </Button>
        <Button type="button" onClick={() => vm.mutation.mutate()} disabled={vm.mutation.isPending}>
          {vm.mutation.isPending ? (isCreateMode ? "Создание…" : "Сохранение…") : isCreateMode ? "Добавить" : "Сохранить"}
        </Button>
        {!isCreateMode && vm.effectiveClientId > 0 ? (
          <Link href={"/clients/" + vm.effectiveClientId} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            К карточке
          </Link>
        ) : null}
      </div>
    </div>
  );
}
