"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import Link from "next/link";

type Variant = "bonus" | "discount";
type Mode = "new" | "edit" | "clone";

const COPY = {
  bonus: {
    backHref: "/settings/bonus-rules/active",
    backLabel: "← Список правил бонусов",
    newTitle: "Новое правило бонуса",
    editTitle: "Изменить бонус",
    cloneTitle: "Новое правило бонуса (копия)",
    newDescription: "Основные данные, условия, срок, фильтры и клиенты — в одной форме.",
    editDescription: "Основные данные, условия, срок, фильтры и клиенты — в одной форме.",
    cloneDescription:
      "Поля заполнены с выбранного правила. Измените название или условия и нажмите «Сохранить», чтобы создать новую запись."
  },
  discount: {
    backHref: "/settings/discount-rules/active",
    backLabel: "← Список скидок",
    newTitle: "Новое правило скидки",
    editTitle: "Изменить скидку",
    cloneTitle: "Новое правило скидки (копия)",
    newDescription:
      "Основные данные, параметры скидки или порог по сумме, срок, фильтры и клиенты — в одной форме. Бонусы за количество — в «Бонусах».",
    editDescription:
      "Основные данные, параметры скидки или порог по сумме, срок, фильтры и клиенты — в одной форме.",
    cloneDescription:
      "Поля заполнены с выбранной скидки. Измените название или процент и нажмите «Сохранить», чтобы создать новую запись."
  }
} as const;

export function BonusRuleFormPageHeader({
  variant,
  mode,
  ruleName
}: {
  variant: Variant;
  mode: Mode;
  ruleName?: string;
}) {
  const c = COPY[variant];
  const title =
    mode === "edit" ? (ruleName?.trim() ? `${c.editTitle}` : c.editTitle) : mode === "clone" ? c.cloneTitle : c.newTitle;
  const description =
    mode === "edit"
      ? ruleName?.trim()
        ? `${ruleName.trim()} · ${c.editDescription}`
        : c.editDescription
      : mode === "clone"
        ? c.cloneDescription
        : c.newDescription;

  return (
    <>
      <Link
        href={c.backHref}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 w-fit -ml-2 text-muted-foreground")}
      >
        {c.backLabel}
      </Link>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href="/dashboard">
            Панель управления
          </Link>
        }
      />
    </>
  );
}
