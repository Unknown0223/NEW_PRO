export type SettingsItem = {
  title: string;
  slug: string;
  href: string;
  status: "available" | "planned";
  /** Bo‘sh bo‘lmasa — faqat ushbu rollar katalogda punktni ko‘radi (`RBAC.md` bilan sinxron). */
  requiredRoles?: readonly string[];
  /** Pastga ochiladigan pastki punktlar (masalan «Пользователи» → Агент, Экспедиторы…) */
  children?: SettingsItem[];
  /** Qisqa izoh (sidebar title / hub). */
  description?: string;
  /** Alohida sahifa o‘rniga modal (masalan vaqt mintaqasi). */
  opensModal?: "timezone";
};

export type SettingsSection = {
  title: string;
  slug: string;
  items: SettingsItem[];
};

function toSlug(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  if (slug) return slug;
  return "item";
}

function makeItem(
  sectionSlug: string,
  title: string,
  status: "available" | "planned",
  index: number,
  requiredRoles?: readonly string[]
): SettingsItem {
  const baseSlug = toSlug(title);
  const slug = `${baseSlug}-${index + 1}`;
  return {
    title,
    slug,
    href: `/settings/catalog/${sectionSlug}/${slug}`,
    status,
    ...(requiredRoles?.length ? { requiredRoles } : {})
  };
}

export const settingsSections: SettingsSection[] = [
  {
    title: "Интерфейс и оформление",
    slug: "interfeys-oformlenie",
    items: [
      {
        title: "Тема и цвета",
        slug: "tema-tsveta",
        href: "/settings/appearance",
        status: "available"
      },
      {
        title: "Фильтр возврата",
        slug: "qaytarish-filtri",
        href: "/settings/returns/filter",
        status: "available",
        requiredRoles: ["admin"] as const
      },
      {
        title: "Мобильное приложение",
        slug: "mobil-ilova",
        href: "/settings/mobile-app",
        status: "available",
        requiredRoles: ["admin"] as const
      }
    ]
  },
  {
    title: "Основные настройки",
    slug: "osnovnye-nastroiki",
    items: [
      makeItem("osnovnye-nastroiki", "Территория", "available", 0),
      makeItem("osnovnye-nastroiki", "Единицы измерения", "available", 1),
      makeItem("osnovnye-nastroiki", "Филиалы", "available", 2),
      {
        title: "Границы на карте",
        slug: "geo-boundaries",
        href: "/settings/geo-boundaries",
        status: "available"
      },
      {
        title: "Должности",
        slug: "dolzhnosti-osnovnye",
        href: "/settings/web-staff-position-presets",
        status: "available",
        requiredRoles: ["admin"] as const,
        description: "Справочник должностей (роль, код, порядок)"
      }
    ]
  },
  {
    title: "Клиенты",
    slug: "klienty",
    items: [
      makeItem("klienty", "Формат клиента", "available", 0),
      makeItem("klienty", "Тип клиента", "available", 1),
      makeItem("klienty", "Категория клиента", "available", 2)
    ]
  },
  {
    title: "Продукты",
    slug: "produkty",
    items: [
      makeItem("produkty", "Категория продукта", "available", 0),
      {
        title: "Продукт",
        slug: "produkt-tab",
        href: "/settings/products",
        status: "available"
      },
      {
        title: "Группа товаров",
        slug: "gruppa-tovarov-tab",
        href: "/settings/products?tab=product-groups",
        status: "available"
      },
      {
        title: "Группа взаимозаменяемых",
        slug: "gruppa-vzaimozamenyaemykh-tab",
        href: "/settings/products?tab=interchangeable",
        status: "available"
      },
      {
        title: "Бренд",
        slug: "brend-tab",
        href: "/settings/products?tab=brands",
        status: "available"
      },
      {
        title: "Производитель",
        slug: "proizvoditel-tab",
        href: "/settings/products?tab=manufacturers",
        status: "available"
      },
      {
        title: "Сегменты",
        slug: "segmenty-tab",
        href: "/settings/products?tab=segments",
        status: "available"
      }
    ]
  },
  {
    title: "Финансы",
    slug: "finansy",
    items: [
      makeItem("finansy", "Валюты", "available", 0),
      makeItem("finansy", "Способ оплаты", "available", 1),
      makeItem("finansy", "Тип цены", "available", 2),
      makeItem("finansy", "Цена", "available", 3)
    ]
  },
  {
    title: "Направления продаж",
    slug: "napravleniia-prodazh",
    items: [
      makeItem("napravleniia-prodazh", "Направление торговли", "available", 0),
      makeItem("napravleniia-prodazh", "Канал продаж", "available", 1),
      makeItem("napravleniia-prodazh", "Группа KPI", "available", 2)
    ]
  },
  {
    title: "Бонусы и скидки",
    slug: "bonusy-i-skidki",
    items: [
      {
        title: "Бонусы",
        slug: "bonus-pravila",
        href: "/settings/bonus-rules",
        status: "available"
      },
      {
        title: "Скидки",
        slug: "skidki-pravila",
        href: "/settings/discount-rules",
        status: "available"
      },
      {
        title: "Стратегия бонусов и скидок",
        slug: "bonus-strategii",
        href: "/settings/bonus-strategies",
        status: "available"
      },
      makeItem("bonusy-i-skidki", "RLP бонусы", "available", 3)
    ]
  },
  {
    title: "Причины и категории",
    slug: "prichiny-i-kategorii",
    items: [
      makeItem("prichiny-i-kategorii", "Причины заявок", "available", 0),
      makeItem("prichiny-i-kategorii", "Причины отказа", "available", 1),
      makeItem("prichiny-i-kategorii", "Причины отмены оплаты", "available", 2),
      makeItem("prichiny-i-kategorii", "Примечание к заказу", "available", 3),
      makeItem("prichiny-i-kategorii", "Причины фотоотчёта", "available", 4),
      makeItem("prichiny-i-kategorii", "Категория доходов/расходов", "available", 5)
    ]
  },
  {
    title: "Инвентарь и упаковка",
    slug: "inventar-i-upakovka",
    items: [
      makeItem("inventar-i-upakovka", "Тип инвентаря", "available", 0),
      makeItem("inventar-i-upakovka", "Тип коробки", "available", 1)
    ]
  },
  {
    title: "Оборудование",
    slug: "oborudovanie",
    items: [
      makeItem("oborudovanie", "Принтеры", "available", 0),
      makeItem("oborudovanie", "Тара", "available", 1)
    ]
  },
  {
    title: "База знаний",
    slug: "baza-znanii",
    items: [
      makeItem("baza-znanii", "Тип базы знания", "available", 0),
      makeItem("baza-znanii", "База знаний", "available", 1)
    ]
  },
  {
    title: "Компания и персонал",
    slug: "kompaniya-personal",
    items: [
      makeItem("kompaniya-personal", "Компания", "available", 0),
      {
        title: "Должности",
        slug: "dolzhnosti-personal",
        href: "/settings/web-staff-position-presets",
        status: "available",
        requiredRoles: ["admin"] as const,
        description: "Справочник должностей — роль, код, порядок; привязка к сотрудникам"
      }
    ]
  },
  {
    title: "Период и регламент",
    slug: "period-reglament",
    items: [
      {
        title: "Ограничение периода",
        slug: "document-edit-lock",
        href: "/settings/document-edit-lock",
        status: "available",
        requiredRoles: ["admin"] as const,
        description: "Ограничение периода для редактирования документов"
      },
      {
        title: "Заказы → консигнация",
        slug: "orders-consignment",
        href: "/settings/period/orders-consignment",
        status: "available",
        requiredRoles: ["admin"] as const,
        description:
          "Доставленные и неоплаченные в течение N дней заказы — в консигнацию; в комментарии кто/условия"
      }
    ]
  },
  {
    title: "Система",
    slug: "sistema",
    items: [
      {
        title: "Часовой пояс",
        slug: "timezone",
        href: "/settings/timezone",
        status: "available",
        requiredRoles: ["admin"] as const,
        opensModal: "timezone",
        description: "Рабочие часы / окно синхронизации — стандартные часовые пояса IANA"
      },
      {
        title: "Начальная настройка",
        slug: "initial-setup",
        href: "/settings/initial-setup",
        status: "available",
        requiredRoles: ["admin"] as const
      },
      {
        title: "Должности",
        slug: "dolzhnosti-sistema",
        href: "/settings/web-staff-position-presets",
        status: "available",
        requiredRoles: ["admin"] as const,
        description: "Системные должности и привязка к ролям"
      },
      {
        title: "Миграция системы",
        slug: "system-migration",
        href: "/settings/system-migration",
        status: "available",
        requiredRoles: ["admin"] as const
      },
      makeItem("sistema", "Аудит", "available", 0, ["admin"] as const)
    ]
  }
];

const existingHrefByItemTitle: Record<string, string> = {
  "территория": "/settings/territories",
  "xarita chegaralari": "/settings/geo-boundaries",
  "единицы измерения": "/settings/units",
  "настройка счёта": "/settings/catalog/osnovnye-nastroiki/item-3",
  "филиалы": "/settings/branches",
  "должности": "/settings/web-staff-position-presets",
  "формат клиента": "/settings/client-formats",
  "тип клиента": "/settings/client-types",
  "категория клиента": "/settings/client-categories",
  "категория продукта": "/settings/product-categories",
  "продукт": "/settings/products",
  "группа товаров": "/settings/products?tab=product-groups",
  "группа взаимозаменяемых": "/settings/products?tab=interchangeable",
  "бренд": "/settings/products?tab=brands",
  "производитель": "/settings/products?tab=manufacturers",
  "сегменты": "/settings/products?tab=segments",
  "способ оплаты": "/settings/payment-methods",
  "тип цены": "/settings/price-types",
  "валюты": "/settings/currencies",
  "цена": "/settings/prices",
  "направление торговли": "/settings/sales-directions/trade",
  "канал продаж": "/settings/sales-directions/sales-channels",
  "группа kpi": "/settings/sales-directions/kpi-groups",
  "бонусы": "/settings/bonus-rules",
  "скидки": "/settings/discount-rules",
  "стратегия бонусов и скидок": "/settings/bonus-strategies",
  "rlp бонусы": "/settings/bonus-stack",
  "причины отказа": "/settings/reasons/refusal-reasons",
  "компания": "/settings/company",
  "qaytarish filtri": "/settings/returns/filter",
  "фильтр возврата": "/settings/returns/filter",
  "аудит": "/settings/audit",
  "должности веб-сотрудников": "/settings/web-staff-position-presets",
  "должности веб сотрудников": "/settings/web-staff-position-presets",
  "lavozimlar": "/settings/web-staff-position-presets",
  "веб ходим лавозимлари": "/settings/web-staff-position-presets",
  "dolzhnosti-sistema": "/settings/web-staff-position-presets",
  "dolzhnosti-personal": "/settings/web-staff-position-presets",
  "dolzhnosti-osnovnye": "/settings/web-staff-position-presets",
  "причины заявок": "/settings/reasons/request-types",
  "причины отмены оплаты": "/settings/reasons/cancel-payment-reasons",
  "примечание к заказу": "/settings/reasons/order-notes",
  "категория фотоотчёта": "/settings/reasons/photo-categories",
  "причины фотоотчёта": "/settings/reasons/photo-categories",
  "категория доходов/расходов": "/settings/reasons/finance-categories",
  "тип инвентаря": "/settings/inventory/type",
  "тип коробки": "/settings/inventory/box-type",
  "принтеры": "/settings/equipment/printers",
  "тара": "/settings/equipment/tare",
  "тип базы знания": "/settings/knowledge-base/type",
  "база знаний": "/settings/knowledge-base/base",
  "тема и цвета": "/settings/appearance",
  "vaqt mintaqasi": "/settings/timezone",
  "время / часовой пояс": "/settings/timezone",
  "часовой пояс": "/settings/timezone",
  "boshlang‘ich sozlash": "/settings/initial-setup",
  "начальная настройка": "/settings/initial-setup",
  "davr cheklovi": "/settings/document-edit-lock",
  "ограничение периода": "/settings/document-edit-lock",
  "границы на карте": "/settings/geo-boundaries",
  "заказы → консигнация": "/settings/period/orders-consignment",
  "консигнация (oy yopish)": "/settings/spravochnik/consignment"
};

export function resolveSettingsItemHref(item: SettingsItem): string {
  return existingHrefByItemTitle[item.title.toLowerCase()] ?? item.href;
}

/** Sozlamalar punkty — Dostup kaliti (href yoki slug). */
const SETTINGS_HREF_VIEW_PERMS: Record<string, readonly string[]> = {
  "/settings/appearance": ["settings.appearance.view"],
  "/settings/returns/filter": ["settings.returns_filter.view"],
  "/settings/mobile-app": ["settings.mobile_app.view"],
  "/settings/territories": ["settings.territoriya.view"],
  "/settings/units": ["settings.edinitsy.view"],
  "/settings/branches": ["settings.filial.view"],
  "/settings/geo-boundaries": ["settings.geo_granitsy.view"],
  "/settings/web-staff-position-presets": ["settings.web_staff_positions.view", "settings.dolzhnost.view"],
  "/settings/client-formats": ["settings.format_klienta.view"],
  "/settings/client-types": ["settings.tip_klienta.view"],
  "/settings/client-categories": ["settings.kategoriya_klienta.view"],
  "/settings/product-categories": ["settings.kategoriya_tovara.view"],
  "/settings/products": ["settings.tovar.view"],
  "/settings/products?tab=product-groups": ["settings.kategoriya_tovara.view", "settings.tovar.view"],
  "/settings/products?tab=interchangeable": ["settings.tovar.view"],
  "/settings/products?tab=brands": ["settings.brend.view"],
  "/settings/products?tab=manufacturers": ["settings.tovar.view"],
  "/settings/products?tab=segments": ["settings.segment.view"],
  "/settings/currencies": ["settings.valyuty.view"],
  "/settings/payment-methods": ["settings.sposob_oplaty.view"],
  "/settings/price-types": ["settings.tip_tseny.view"],
  "/settings/prices": ["settings.tsena.view"],
  "/settings/sales-directions/trade": ["settings.napravlenie_torgovli.view"],
  "/settings/sales-directions/sales-channels": ["settings.kanal_sbyta.view"],
  "/settings/sales-directions/kpi-groups": ["settings.napravlenie_torgovli.view"],
  "/settings/bonus-rules": ["settings.bonusy_i_skidki.view"],
  "/settings/discount-rules": ["settings.bonusy_i_skidki.view"],
  "/settings/bonus-strategies": ["settings.bonusy_i_skidki.view"],
  "/settings/bonus-stack": ["settings.bonusy_i_skidki.view"],
  "/settings/reasons/request-types": ["settings.prichiny.view"],
  "/settings/reasons/refusal-reasons": ["settings.prichiny.view"],
  "/settings/reasons/cancel-payment-reasons": ["settings.prichiny.view"],
  "/settings/reasons/order-notes": ["settings.prichiny.view"],
  "/settings/reasons/photo-categories": ["settings.prichiny.view"],
  "/settings/reasons/finance-categories": ["settings.prichiny.view"],
  "/settings/inventory/type": ["settings.inventar_i_korobka.view"],
  "/settings/inventory/box-type": ["settings.inventar_i_korobka.view"],
  "/settings/equipment/printers": ["settings.oborudovanie.view"],
  "/settings/equipment/tare": ["settings.oborudovanie.view"],
  "/settings/knowledge-base/type": ["settings.baza_znaniy.view"],
  "/settings/knowledge-base/base": ["settings.baza_znaniy.view"],
  "/settings/company": ["settings.profil_kompanii.view"],
  "/settings/document-edit-lock": ["settings.document_edit_lock.view"],
  "/settings/period/orders-consignment": ["settings.orders_consignment.view"],
  "/settings/timezone": ["settings.timezone.view"],
  "/settings/initial-setup": ["settings.initial_setup.view"],
  "/settings/system-migration": ["settings.system_migration.view"],
  "/settings/audit": ["audit.log.view"]
};

export function settingsItemViewPermissions(item: SettingsItem): readonly string[] | null {
  const href = resolveSettingsItemHref(item);
  if (SETTINGS_HREF_VIEW_PERMS[href]) return SETTINGS_HREF_VIEW_PERMS[href];
  const path = href.split("?")[0] ?? href;
  return SETTINGS_HREF_VIEW_PERMS[path] ?? null;
}

export function isSettingsItemAllowedForAccess(
  item: SettingsItem,
  role: string | null,
  permissionKeys: Set<string> | null
): boolean {
  if (role === "admin") return true;
  const perms = settingsItemViewPermissions(item);
  if (perms?.length) {
    if (permissionKeys && perms.some((k) => permissionKeys.has(k))) return true;
    if (item.requiredRoles?.length) {
      return role != null && item.requiredRoles.includes(role);
    }
    return false;
  }
  if (item.requiredRoles?.length) {
    return role != null && item.requiredRoles.includes(role);
  }
  return true;
}

function filterSettingsItemByAccess(
  item: SettingsItem,
  role: string | null,
  permissionKeys: Set<string> | null
): SettingsItem | null {
  if (item.children?.length) {
    const kids = item.children.filter((c) => isSettingsItemAllowedForAccess(c, role, permissionKeys));
    if (!kids.length) return null;
    return { ...item, children: kids };
  }
  return isSettingsItemAllowedForAccess(item, role, permissionKeys) ? item : null;
}

/** Katalog yon paneli: rol + Dostup kalitlari. */
export function filterSettingsSectionsForAccess(
  sections: SettingsSection[],
  role: string | null,
  permissionKeys: Set<string> | null
): SettingsSection[] {
  const out: SettingsSection[] = [];
  for (const section of sections) {
    const items = section.items
      .map((item) => filterSettingsItemByAccess(item, role, permissionKeys))
      .filter((item): item is SettingsItem => item != null);
    if (items.length) out.push({ ...section, items });
  }
  return out;
}

/** Katalog yon paneli: `requiredRoles` bo‘yicha (null rol — admin-only punktlar yashirin). */
export function filterSettingsSectionsByRole(
  sections: SettingsSection[],
  role: string | null
): SettingsSection[] {
  return filterSettingsSectionsForAccess(sections, role, null);
}

export function findSettingsItem(sectionSlug: string, itemSlug: string): SettingsItem | null {
  const section = settingsSections.find((s) => s.slug === sectionSlug);
  if (!section) return null;
  for (const item of section.items) {
    if (item.slug === itemSlug) return item;
    const child = item.children?.find((c) => c.slug === itemSlug);
    if (child) return child;
  }
  return null;
}

/** Deep-link: pathname (+ ixtiyoriy query) bo‘yicha sozlama bandini topish. */
export function findSettingsItemForPath(pathname: string, search = ""): SettingsItem | null {
  const path = pathname.split("?")[0] ?? pathname;
  const normalized = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  const cur = new URLSearchParams(search.replace(/^\?/, ""));
  let best: SettingsItem | null = null;
  let bestScore = -1;

  const visit = (item: SettingsItem) => {
    const href = resolveSettingsItemHref(item);
    const hrefPath = (href.split("?")[0] ?? "").trim();
    const hrefNorm = hrefPath.length > 1 && hrefPath.endsWith("/") ? hrefPath.slice(0, -1) : hrefPath;
    if (!(normalized === hrefNorm || normalized.startsWith(`${hrefNorm}/`))) return;
    const qIdx = href.indexOf("?");
    const hrefQuery = qIdx >= 0 ? new URLSearchParams(href.slice(qIdx + 1)) : null;
    let score = hrefNorm.length * 10;
    if (hrefQuery && Array.from(hrefQuery.keys()).length > 0) {
      for (const [k, v] of Array.from(hrefQuery.entries())) {
        if (cur.get(k) !== v) return;
      }
      score += 50;
    }
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  };

  for (const section of settingsSections) {
    for (const item of section.items) {
      visit(item);
      for (const child of item.children ?? []) visit(child);
    }
  }
  return best;
}

/** Deep-link: pathname bo‘yicha `requiredRoles` bandini topish. */
export function findSettingsItemRequiringRolesForPath(pathname: string): SettingsItem | null {
  const item = findSettingsItemForPath(pathname);
  if (!item?.requiredRoles?.length) return null;
  return item;
}

export function isSettingsItemAllowedForRole(item: SettingsItem, role: string | null): boolean {
  return isSettingsItemAllowedForAccess(item, role, null);
}
