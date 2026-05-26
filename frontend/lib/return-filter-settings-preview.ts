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
  const unit = s.period_unit === "month" ? "oy" : "kun";
  const periodText = `${s.period_value} ${unit}`;

  if (s.period_enabled && !s.balance_zero_enabled) {
    return {
      title: "HOLAT 1 — faqat davr",
      body: `Oxirgi ${periodText} ichidagi barcha yetkazilgan zakazlar chiqadi. Balans 0 (qarzdorlik/to‘lov) hisobga olinmaydi.`
    };
  }

  if (!s.period_enabled && s.balance_zero_enabled) {
    return {
      title: "HOLAT 2 — faqat balans 0",
      body:
        "Eng oxirgi balans 0 nuqtasidan keyingi zakazlar chiqadi. Agar mijoz hech qachon balans 0 bo‘lmagan bo‘lsa — barcha yetkazilgan zakazlar (eski qarzli mijozlar uchun)."
    };
  }

  if (s.period_enabled && s.balance_zero_enabled) {
    return {
      title: "HOLAT 3 — davr + balans 0 (eng qattiq)",
      body: `Avval oxirgi ${periodText} ichida balans 0 qidiriladi. Topilsa — shu nuqtadan keyingi zakazlar. Topilmasa — hech narsa chiqmaydi (davrda zakazlar bo‘lsa ham).`,
      warning:
        "Qarzdorlik o‘zi zakazlarni yashirmaydi — muhim jihat: tanlangan davr ichida to‘liq to‘lov bilan balans aynan 0 bo‘lishi kerak."
    };
  }

  return {
    title: "HOLAT 4 — filtr yo‘q",
    body: "Barcha yetkazilgan zakazlar chiqadi (eski yopilgan zakazlar ham).",
    warning: "Noto‘g‘ri qaytarish xavfi yuqori — faqat maxsus holatlar uchun."
  };
}
