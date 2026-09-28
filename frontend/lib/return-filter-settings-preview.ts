export type ReturnFilterSettingsDraft = {
  period_enabled: boolean;
  period_unit: "day" | "month";
  period_value: number;
  balance_zero_enabled: boolean;
};

export type ReturnFilterSettingsPreview = {
  title: string;
  body: string;
  warning?: string;
};

export function previewReturnFilterSettings(
  s: ReturnFilterSettingsDraft
): ReturnFilterSettingsPreview {
  const unit = s.period_unit === "month" ? "мес." : "дн.";
  const periodText = `${s.period_value} ${unit}`;

  if (s.period_enabled && !s.balance_zero_enabled) {
    return {
      title: "Режим 1 — только период",
      body: `Выводятся все доставленные заказы за последние ${periodText}. Баланс 0 (задолженность/оплата) не учитывается.`
    };
  }

  if (!s.period_enabled && s.balance_zero_enabled) {
    return {
      title: "Режим 2 — только баланс 0",
      body:
        "Выводятся заказы после последней точки нулевого баланса. Если у клиента баланс никогда не был равен 0 — все доставленные заказы (для старых клиентов с долгом)."
    };
  }

  if (s.period_enabled && s.balance_zero_enabled) {
    return {
      title: "Режим 3 — период + баланс 0 (самый строгий)",
      body: `Сначала ищется нулевой баланс за последние ${periodText}. Если найден — выводятся заказы после этой точки. Если не найден — ничего не выводится (даже если в периоде есть заказы).`,
      warning:
        "Сама задолженность заказы не скрывает — важно: в выбранном периоде баланс должен стать ровно 0 за счёт полной оплаты."
    };
  }

  return {
    title: "Режим 4 — без фильтра",
    body: "Выводятся все доставленные заказы (включая старые закрытые).",
    warning: "Высокий риск ошибочного возврата — только для особых случаев."
  };
}
