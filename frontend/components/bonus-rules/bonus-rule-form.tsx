"use client";

import type { BonusRuleRow } from "@/components/bonus-rules/bonus-rule-types";
import { BonusRuleCategoryHoverField } from "@/components/bonus-rules/bonus-rule-category-hover-field";
import {
  BonusRuleFloatingInput,
  BonusRuleFloatingSelect,
  BonusRulePreviewQtyInput,
  BonusRuleSection,
  BonusRuleSectionTitle,
  BonusRuleTemplateButton,
  BonusRuleTemplateCheckbox,
  BonusRuleTemplateRadioGroup
} from "@/components/bonus-rules/bonus-rule-form-fields";
import { BonusRulePrerequisitesField } from "@/components/bonus-rules/bonus-rule-prerequisites-field";
import { BonusRuleSelectedClientsField } from "@/components/bonus-rules/bonus-rule-selected-clients-field";
import { BonusRuleProductDualPanels } from "@/components/bonus-rules/bonus-rule-product-dual-panels";
import { api } from "@/lib/api";
import { firstValidationUserHint, getZodFlattenFromApiErrorBody } from "@/lib/api-validation-details";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type BonusType = "qty" | "sum" | "discount";

type CondForm = {
  min_qty: string;
  max_qty: string;
  step_qty: string;
  bonus_qty: string;
  max_bonus_qty: string;
};

type ClientRefEntry = { id: string; name: string; active?: boolean };

function isoToLocalDatetime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localDatetimeToIso(local: string): string | null {
  const t = local.trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

const emptyCond = (): CondForm => ({
  min_qty: "",
  max_qty: "",
  step_qty: "6",
  bonus_qty: "1",
  max_bonus_qty: ""
});

type ErrorTarget = "basics" | "restrictions" | "products" | "conditions" | "discount" | null;

function scrollToRef(el: HTMLElement | null) {
  if (!el) return;
  requestAnimationFrame(() => {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

type SumThresholdScope = "order" | "calendar_month";

/** Бонус: порог по сумме или по количеству (те же режимы заказ / месяц). */
function SumThresholdScopeFields({
  radioGroupName,
  sumThresholdScope,
  onScopeChange,
  disabled,
  variant = "sum"
}: {
  radioGroupName: string;
  sumThresholdScope: SumThresholdScope;
  onScopeChange: (scope: SumThresholdScope) => void;
  disabled: boolean;
  variant?: "sum" | "qty";
}) {
  const title = variant === "qty" ? "Порог по количеству" : "Порог по сумме";
  const description =
    variant === "qty"
      ? "Сравнивается с количеством платных единиц в строках заказа (без бонусных). «Календарный месяц» — накопление по клиенту за месяц (Asia/Tashkent) плюс текущий заказ; отменённые и возвращённые заказы не учитываются. С ассортиментом или категорией считается по каждому SKU отдельно."
      : "Сравнивается с суммой товаров до скидки. «Календарный месяц» — накопление по клиенту за месяц (Asia/Tashkent) плюс текущий заказ; отменённые и возвращённые заказы не учитываются.";
  const monthLabel =
    variant === "qty"
      ? "Календарный месяц (количество по клиенту + текущий заказ)"
      : "Календарный месяц (сумма заказов клиента + текущий)";
  return (
    <div className="space-y-3 pt-1">
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      <BonusRuleTemplateRadioGroup
        title={title}
        name={radioGroupName}
        value={sumThresholdScope}
        onChange={(v) => onScopeChange(v as SumThresholdScope)}
        disabled={disabled}
        options={[
          { value: "order", label: "Только этот заказ" },
          { value: "calendar_month", label: monthLabel }
        ]}
      />
    </div>
  );
}

function parseCondRow(c: CondForm) {
  const min_qty = c.min_qty.trim() === "" ? null : Number.parseFloat(c.min_qty);
  const max_qty = c.max_qty.trim() === "" ? null : Number.parseFloat(c.max_qty);
  const step_qty = Number.parseFloat(c.step_qty);
  const bonus_qty = Number.parseFloat(c.bonus_qty);
  const max_bonus_qty = c.max_bonus_qty.trim() === "" ? null : Number.parseFloat(c.max_bonus_qty);
  if (Number.isNaN(step_qty) || step_qty <= 0 || Number.isNaN(bonus_qty) || bonus_qty < 0) {
    throw new Error("В строках условий укажите шаг и количество бонуса");
  }
  if (min_qty != null && Number.isNaN(min_qty)) throw new Error("Мин. неверно");
  if (max_qty != null && Number.isNaN(max_qty)) throw new Error("Макс. неверно");
  if (min_qty != null && max_qty != null && min_qty > max_qty) throw new Error("мин ≤ макс");
  if (max_bonus_qty != null && (Number.isNaN(max_bonus_qty) || max_bonus_qty < 0)) {
    throw new Error("Макс. бонус неверен");
  }
  return {
    min_qty,
    max_qty,
    step_qty,
    bonus_qty,
    max_bonus_qty: max_bonus_qty != null && !Number.isNaN(max_bonus_qty) ? max_bonus_qty : null
  };
}

/** Ikkala cheklov ham o‘chiq bo‘lsa — Saqlashda chiqadigan xabar (matn bir xil bo‘lishi kerak). */
const BONUS_SCOPE_REQUIRED_MSG = "Нужно выбрать одно из ограничений.";
const NAME_REQUIRED_MSG = "Введите название правила.";

export type BonusRuleFormVariant = "default" | "discountOnly";

type Props = {
  tenantSlug: string;
  initialRule: BonusRuleRow | null;
  /** Ro‘yxatdan nusxa: `initialRule.id === 0` bo‘lsa, shakl to‘ldirilgan, lekin saqlash — POST. */
  prefillNonce?: string | null;
  /** Chegirma bo‘limi: tur doim discount, saqlashdan keyin chegirmalar ro‘yxatiga qaytish */
  variant?: BonusRuleFormVariant;
};

export function BonusRuleForm({
  tenantSlug,
  initialRule,
  prefillNonce = null,
  variant = "default"
}: Props) {
  const discountOnly = variant === "discountOnly";
  const listHref = discountOnly ? "/settings/discount-rules/active" : "/settings/bonus-rules/active";
  const router = useRouter();
  const qc = useQueryClient();
  const isEdit = Boolean(initialRule && initialRule.id > 0);
  const formLocked = Boolean(isEdit && initialRule?.has_been_used);
  const seedKey =
    initialRule && initialRule.id > 0
      ? `${initialRule.id}:${initialRule.updated_at ?? ""}`
      : initialRule && prefillNonce
        ? prefillNonce
        : initialRule
          ? `prefill-${initialRule.name}-${initialRule.type}`
          : "new";

  const profileRefsQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug, "bonus-form-refs"],
    staleTime: STALE.profile,
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const { data } = await api.get<{
        references?: {
          /** Yangi spravochnik */
          payment_method_entries?: { id?: string; name: string; active?: boolean }[];
          /** Legacy: faqat nomlar (backend `resolvePaymentMethodEntries` bilan bir xil manba) */
          payment_types?: string[];
          client_category_entries?: ClientRefEntry[];
        };
      }>(`/api/${tenantSlug}/settings/profile`);
      return data?.references ?? {};
    }
  });

  /** Faol yozuvlar; bo‘sh bo‘lsa `payment_types` dan (barchasi nofaol bo‘lib qolgan ham). */
  const paymentOptions = useMemo(() => {
    const refs = profileRefsQ.data;
    if (!refs) return [] as { key: string; name: string }[];
    const activeEntries = (refs.payment_method_entries ?? []).filter((p) => p.active !== false);
    if (activeEntries.length > 0) {
      return activeEntries.map((p, i) => ({
        key: p.id?.trim() || `pm-${i}-${p.name}`,
        name: p.name.trim()
      }));
    }
    const legacy = refs.payment_types ?? [];
    return legacy
      .map((n) => String(n).trim())
      .filter(Boolean)
      .map((name, i) => ({ key: `pt-${i}-${name}`, name }));
  }, [profileRefsQ.data]);
  const clientCategoryOptions = (profileRefsQ.data?.client_category_entries ?? []).filter((c) => c.active !== false);

  const priceTypesQ = useQuery({
    queryKey: ["price-types", tenantSlug, "bonus-form"],
    staleTime: STALE.reference,
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const { data } = await api.get<{ data: string[] }>(`/api/${tenantSlug}/price-types`);
      return data.data;
    }
  });

  const [name, setName] = useState("");
  const [type, setType] = useState<BonusType>(discountOnly ? "discount" : "qty");
  const [minSum, setMinSum] = useState("");
  const [discountPct, setDiscountPct] = useState("");
  const [priority, setPriority] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [conditions, setConditions] = useState<CondForm[]>([emptyCond()]);
  const [clientCategory, setClientCategory] = useState("");
  const [paymentType, setPaymentType] = useState("");
  const [clientType, setClientType] = useState("");
  const [salesChannel, setSalesChannel] = useState("");
  const [priceType, setPriceType] = useState("");
  const [triggerProductIds, setTriggerProductIds] = useState<number[]>([]);
  const [bonusProductIds, setBonusProductIds] = useState<number[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [targetAllClients, setTargetAllClients] = useState(true);
  const [selectedClientIds, setSelectedClientIds] = useState<number[]>([]);
  const [selectedClientNames, setSelectedClientNames] = useState<Record<number, string>>({});
  const [sumThresholdScope, setSumThresholdScope] = useState<SumThresholdScope>("order");
  const [isManual, setIsManual] = useState(false);
  const [inBlocks, setInBlocks] = useState(false);
  const [oncePerClient, setOncePerClient] = useState(false);
  const [prerequisiteRuleIds, setPrerequisiteRuleIds] = useState<number[]>([]);
  const [scopeBranchCodes, setScopeBranchCodes] = useState<string[]>([]);
  const [scopeAgentUserIds, setScopeAgentUserIds] = useState<number[]>([]);
  const [scopeTradeDirectionIds, setScopeTradeDirectionIds] = useState<number[]>([]);
  const [onlyByAssortment, setOnlyByAssortment] = useState(false);
  const [onlyByCategory, setOnlyByCategory] = useState(false);
  const [previewPurchaseQty, setPreviewPurchaseQty] = useState("50");
  const [localError, setLocalError] = useState<string | null>(null);
  /** Qaysi blokka scroll, ramka va ichki bildirishnoma bog‘langan */
  const [errorTarget, setErrorTarget] = useState<ErrorTarget>(null);
  const [errorShake, setErrorShake] = useState(false);
  const basicsRef = useRef<HTMLDivElement>(null);
  const restrictionsRef = useRef<HTMLDivElement>(null);
  const conditionsRef = useRef<HTMLDivElement>(null);
  const discountRef = useRef<HTMLDivElement>(null);
  /** Скидки: один блок с % или суммой — как «Условия» у бонуса */
  const discountDetailsRef = useRef<HTMLDivElement>(null);
  const productsRef = useRef<HTMLDivElement>(null);

  const pulseErrorOn = (target: ErrorTarget) => {
    setErrorShake(true);
    window.setTimeout(() => setErrorShake(false), 500);
    if (target === "restrictions") scrollToRef(restrictionsRef.current);
    else if (target === "products") scrollToRef(productsRef.current);
    else if (target === "conditions") {
      scrollToRef(discountOnly ? discountDetailsRef.current : conditionsRef.current);
    } else if (target === "discount") {
      scrollToRef(discountOnly ? discountDetailsRef.current : discountRef.current);
    } else if (target === "basics") scrollToRef(basicsRef.current);
  };

  useEffect(() => {
    setLocalError(null);
    setErrorTarget(null);
    const rule = initialRule;
    let cancelled = false;

    const loadClientLabels = async (ids: number[]) => {
      if (!tenantSlug || ids.length === 0) return;
      const patch: Record<number, string> = {};
      for (const id of ids) {
        try {
          const { data } = await api.get<{ name?: string }>(`/api/${tenantSlug}/clients/${id}`);
          if (cancelled) return;
          if (data?.name) patch[id] = data.name;
        } catch {
          /* ignore */
        }
      }
      if (!cancelled) setSelectedClientNames(patch);
    };

    if (rule) {
      setName(rule.name);
      setType(
        discountOnly
          ? rule.type === "sum" || rule.type === "discount"
            ? (rule.type as BonusType)
            : "discount"
          : ((rule.type as BonusType) || "qty")
      );
      setMinSum(rule.min_sum != null ? String(rule.min_sum) : "");
      setDiscountPct(rule.discount_pct != null ? String(rule.discount_pct) : "");
      setPriority(String(rule.priority));
      setIsActive(rule.is_active);
      setValidFrom(isoToLocalDatetime(rule.valid_from));
      setValidTo(isoToLocalDatetime(rule.valid_to));
      if (rule.conditions?.length) {
        setConditions(
          rule.conditions.map((c) => ({
            min_qty: c.min_qty != null ? String(c.min_qty) : "",
            max_qty: c.max_qty != null ? String(c.max_qty) : "",
            step_qty: String(c.step_qty),
            bonus_qty: String(c.bonus_qty),
            max_bonus_qty: c.max_bonus_qty != null ? String(c.max_bonus_qty) : ""
          }))
        );
      } else {
        setConditions([
          {
            min_qty: "",
            max_qty: "",
            step_qty: rule.buy_qty != null ? String(rule.buy_qty) : "6",
            bonus_qty: rule.free_qty != null ? String(rule.free_qty) : "1",
            max_bonus_qty: ""
          }
        ]);
      }
      setClientCategory(rule.client_category ?? "");
      setPaymentType(rule.payment_type ?? "");
      setClientType(rule.client_type ?? "");
      setSalesChannel(rule.sales_channel ?? "");
      setPriceType(rule.price_type ?? "");
      setBonusProductIds([...(rule.bonus_product_ids ?? [])]);
      setTargetAllClients(rule.target_all_clients ?? true);
      {
        const sc = [...(rule.selected_client_ids ?? [])];
        setSelectedClientIds(sc);
        setSelectedClientNames({});
        void loadClientLabels(sc);
      }
      setSumThresholdScope(rule.sum_threshold_scope === "calendar_month" ? "calendar_month" : "order");
      setIsManual(rule.is_manual ?? false);
      setInBlocks(rule.in_blocks ?? true);
      setOncePerClient(rule.once_per_client ?? false);
      setPrerequisiteRuleIds([...(rule.prerequisite_rule_ids ?? [])]);
      setScopeBranchCodes([...(rule.scope_branch_codes ?? [])]);
      setScopeAgentUserIds([...(rule.scope_agent_user_ids ?? [])]);
      setScopeTradeDirectionIds([...(rule.scope_trade_direction_ids ?? [])]);
      const pids = [...(rule.product_ids ?? [])];
      const cids = [...(rule.product_category_ids ?? [])];
      const hasScopeFlags =
        rule.scope_restrict_assortment === true || rule.scope_restrict_category === true;
      if (hasScopeFlags) {
        setOnlyByAssortment(rule.scope_restrict_assortment === true);
        setOnlyByCategory(rule.scope_restrict_category === true);
      } else {
        const legacyCategory = cids.length > 0;
        setOnlyByCategory(legacyCategory);
        setOnlyByAssortment(!legacyCategory && pids.length > 0);
      }
      setTriggerProductIds(pids);
      setSelectedCategoryIds(cids);
    } else {
      setName("");
      setType(discountOnly ? "discount" : "qty");
      setMinSum("");
      setDiscountPct("");
      setPriority("0");
      setIsActive(true);
      setValidFrom("");
      setValidTo("");
      setConditions([emptyCond()]);
      setClientCategory("");
      setPaymentType("");
      setClientType("");
      setSalesChannel("");
      setPriceType("");
      setTriggerProductIds([]);
      setBonusProductIds([]);
      setSelectedCategoryIds([]);
      setTargetAllClients(true);
      setSelectedClientIds([]);
      setSelectedClientNames({});
      setSumThresholdScope("order");
      setIsManual(false);
      setInBlocks(false);
      setOncePerClient(false);
      setPrerequisiteRuleIds([]);
      setScopeBranchCodes([]);
      setScopeAgentUserIds([]);
      setScopeTradeDirectionIds([]);
      setOnlyByAssortment(false);
      setOnlyByCategory(false);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faqat id o‘zgarganda seed
  }, [seedKey, tenantSlug]);

  useEffect(() => {
    if (onlyByAssortment || onlyByCategory) {
      setErrorTarget((t) => (t === "restrictions" ? null : t));
      setLocalError((prev) => (prev === BONUS_SCOPE_REQUIRED_MSG ? null : prev));
    }
  }, [onlyByAssortment, onlyByCategory]);

  useEffect(() => {
    if (errorTarget !== "basics" || localError !== NAME_REQUIRED_MSG) return;
    if (name.trim()) {
      setLocalError(null);
      setErrorTarget(null);
    }
  }, [name, errorTarget, localError]);

  useEffect(() => {
    if (errorTarget !== "products") return;
    if (triggerProductIds.length > 0) {
      setLocalError(null);
      setErrorTarget(null);
    }
  }, [triggerProductIds.length, errorTarget]);

  const errorTargetRef = useRef<ErrorTarget>(null);
  errorTargetRef.current = errorTarget;

  useEffect(() => {
    if (errorTargetRef.current !== "conditions") return;
    setLocalError(null);
    setErrorTarget(null);
  }, [conditions, minSum, type]);

  useEffect(() => {
    if (errorTargetRef.current !== "discount") return;
    setLocalError(null);
    setErrorTarget(null);
  }, [discountPct]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (formLocked && initialRule && initialRule.id > 0) {
        const payload: Record<string, unknown> = {
          is_active: isActive,
          valid_to: localDatetimeToIso(validTo)
        };
        const { data } = await api.put(`/api/${tenantSlug}/bonus-rules/${initialRule.id}`, payload);
        return data;
      }

      const p = Number.parseInt(priority, 10);
      const product_ids = onlyByAssortment || onlyByCategory ? triggerProductIds : [];
      const product_category_ids = onlyByCategory ? selectedCategoryIds : [];
      const assortmentOnlyNoBonusPicker = onlyByAssortment && !onlyByCategory;
      const bonus_product_ids = discountOnly
        ? []
        : assortmentOnlyNoBonusPicker && (type === "qty" || type === "sum")
          ? []
          : bonusProductIds;
      const payload: Record<string, unknown> = {
        name: name.trim(),
        type,
        priority: Number.isNaN(p) ? 0 : p,
        is_active: isActive,
        valid_from: localDatetimeToIso(validFrom),
        valid_to: localDatetimeToIso(validTo),
        client_category: clientCategory.trim() || null,
        payment_type: paymentType.trim() || null,
        client_type: clientType.trim() || null,
        sales_channel: salesChannel.trim() || null,
        price_type: priceType.trim() || null,
        product_ids,
        bonus_product_ids,
        product_category_ids,
        scope_restrict_assortment: onlyByAssortment,
        scope_restrict_category: onlyByCategory,
        target_all_clients: targetAllClients,
        selected_client_ids: targetAllClients ? [] : selectedClientIds,
        is_manual: isManual,
        in_blocks: inBlocks,
        once_per_client: oncePerClient,
        one_plus_one_gift: initialRule?.one_plus_one_gift ?? false,
        prerequisite_rule_ids: prerequisiteRuleIds,
        scope_branch_codes: scopeBranchCodes,
        scope_agent_user_ids: scopeAgentUserIds,
        scope_trade_direction_ids: scopeTradeDirectionIds
      };

      if (type === "qty") {
        const rows = conditions.map(parseCondRow);
        payload.conditions = rows.map((r, i) => ({ ...r, sort_order: i }));
        payload.buy_qty = Math.floor(rows[0].step_qty);
        payload.free_qty = Math.floor(rows[0].bonus_qty);
        payload.sum_threshold_scope = sumThresholdScope;
        payload.min_sum = null;
        payload.discount_pct = null;
      } else if (type === "sum") {
        payload.min_sum = Number.parseFloat(minSum);
        payload.sum_threshold_scope = sumThresholdScope;
        payload.buy_qty = null;
        payload.free_qty = null;
        payload.discount_pct = discountOnly ? Number.parseFloat(discountPct) : null;
        payload.conditions = [];
      } else {
        payload.discount_pct = Number.parseFloat(discountPct);
        payload.buy_qty = null;
        payload.free_qty = null;
        payload.min_sum = null;
        payload.conditions = [];
      }

      if (isEdit && initialRule && initialRule.id > 0) {
        const { data } = await api.put(`/api/${tenantSlug}/bonus-rules/${initialRule.id}`, payload);
        return data;
      }
      const { data } = await api.post(`/api/${tenantSlug}/bonus-rules`, payload);
      return data;
    },
    onSuccess: async (saved) => {
      const savedRule = saved as BonusRuleRow | undefined;
      if (initialRule && initialRule.id > 0 && savedRule?.id === initialRule.id) {
        qc.setQueryData(["bonus-rule", tenantSlug, initialRule.id], savedRule);
      }
      await qc.invalidateQueries({ queryKey: ["bonus-rules", tenantSlug] });
      if (initialRule && initialRule.id > 0) {
        await qc.invalidateQueries({ queryKey: ["bonus-rule", tenantSlug, initialRule.id] });
      }
      router.push(listHref);
    },
    onError: (e: unknown) => {
      const ax = e as { response?: { data?: { error?: string }; status?: number } };
      if (ax.response?.status === 403) {
        setLocalError("Нет доступа (только администратор или оператор).");
        setErrorTarget(null);
        return;
      }
      if (ax.response?.data?.error === "ValidationError") {
        const flat = getZodFlattenFromApiErrorBody(ax.response?.data);
        const hint = flat != null ? firstValidationUserHint(flat) : undefined;
        setLocalError(
          hint
            ? withApiSupportLine(`Проверка сервера: ${hint}`, e)
            : "Проверка сервера: проверьте поля (название, срок, товары, условия)."
        );
        setErrorTarget("basics");
        pulseErrorOn("basics");
        return;
      }
      if (ax.response?.data?.error === "ProductScopeRequired") {
        setLocalError(BONUS_SCOPE_REQUIRED_MSG);
        setErrorTarget("restrictions");
        pulseErrorOn("restrictions");
        return;
      }
      if (ax.response?.data?.error === "RuleLocked") {
        setLocalError(
          "Правило уже применялось в заказах — можно менять только дату окончания и активность."
        );
        setErrorTarget(null);
        return;
      }
      setLocalError(getUserFacingError(e, "Ошибка сохранения"));
      setErrorTarget(null);
    }
  });

  const submit = () => {
    setLocalError(null);
    setErrorTarget(null);

    if (formLocked) {
      mutation.mutate();
      return;
    }

    if (!name.trim()) {
      setLocalError(NAME_REQUIRED_MSG);
      setErrorTarget("basics");
      pulseErrorOn("basics");
      return;
    }
    if (!onlyByAssortment && !onlyByCategory) {
      setLocalError(BONUS_SCOPE_REQUIRED_MSG);
      setErrorTarget("restrictions");
      pulseErrorOn("restrictions");
      return;
    }
    if (!targetAllClients && selectedClientIds.length === 0) {
      setLocalError("Выберите хотя бы одного клиента или включите «Все клиенты».");
      setErrorTarget("restrictions");
      pulseErrorOn("restrictions");
      return;
    }
    if (onlyByAssortment) {
      if ((type === "qty" || type === "sum") && triggerProductIds.length === 0) {
        setLocalError("Включено «Только ассортимент»: слева отметьте хотя бы один триггер-товар.");
        setErrorTarget("products");
        pulseErrorOn("products");
        return;
      }
      if (type === "discount" && triggerProductIds.length === 0) {
        setLocalError(
          "Для ограничения по ассортименту выберите слева хотя бы один товар или отключите «Только ассортимент»."
        );
        setErrorTarget("products");
        pulseErrorOn("products");
        return;
      }
    }
    if (
      onlyByCategory &&
      (type === "qty" || type === "sum" || type === "discount") &&
      selectedCategoryIds.length === 0 &&
      triggerProductIds.length === 0
    ) {
      setLocalError(
        "В режиме «Категория» отметьте хотя бы одну категорию (флажок у названия) или триггер-товар."
      );
      setErrorTarget("products");
      pulseErrorOn("products");
      return;
    }
    if (type === "sum") {
      const m = Number.parseFloat(minSum);
      if (minSum.trim() === "" || Number.isNaN(m) || m < 0) {
        setLocalError("Введите минимальную сумму: число ≥ 0.");
        setErrorTarget("conditions");
        pulseErrorOn("conditions");
        return;
      }
      if (discountOnly) {
        const d = Number.parseFloat(discountPct);
        if (discountPct.trim() === "" || Number.isNaN(d) || d < 0 || d > 100) {
          setLocalError("Введите процент скидки от 0 до 100.");
          setErrorTarget("discount");
          pulseErrorOn("discount");
          return;
        }
      }
    }
    if (type === "discount") {
      const d = Number.parseFloat(discountPct);
      if (discountPct.trim() === "" || Number.isNaN(d) || d < 0 || d > 100) {
        setLocalError("Введите процент скидки от 0 до 100.");
        setErrorTarget("discount");
        pulseErrorOn("discount");
        return;
      }
    }
    if (type === "qty") {
      for (let i = 0; i < conditions.length; i++) {
        try {
          parseCondRow(conditions[i]);
        } catch (err) {
          const base = err instanceof Error ? err.message : "Проверьте условия";
          setLocalError(
            conditions.length > 1
              ? `${getUserFacingError(err, base)} (условие №${i + 1})`
              : getUserFacingError(err, base)
          );
          setErrorTarget("conditions");
          pulseErrorOn("conditions");
          return;
        }
      }
    }
    mutation.mutate();
  };

  const showBonusColumn =
    !discountOnly && (type === "qty" || type === "sum") && !(onlyByAssortment && !onlyByCategory);
  const showTriggerColumn =
    discountOnly
      ? (onlyByAssortment || onlyByCategory) && (type === "sum" || type === "discount")
      : type === "qty" || type === "sum" || (type === "discount" && (onlyByAssortment || onlyByCategory));

  const previewBonusQty = useMemo(() => {
    if (type !== "qty" || conditions.length === 0) return 0;
    const row = conditions[0];
    const purchaseQty = Number.parseFloat(previewPurchaseQty);
    const minQty = row.min_qty.trim() === "" ? 0 : Number.parseFloat(row.min_qty);
    const stepQty = Number.parseFloat(row.step_qty);
    const bonusQty = Number.parseFloat(row.bonus_qty);
    const maxBonusRaw = row.max_bonus_qty.trim();
    const maxBonusQty =
      maxBonusRaw === "" ? Number.POSITIVE_INFINITY : Number.parseFloat(maxBonusRaw);
    if (!Number.isFinite(purchaseQty) || purchaseQty < 0) return 0;
    if (Number.isFinite(minQty) && purchaseQty < minQty) return 0;
    if (!Number.isFinite(stepQty) || stepQty <= 0 || !Number.isFinite(bonusQty) || bonusQty < 0) return 0;
    const raw = Math.floor(purchaseQty / stepQty) * bonusQty;
    if (!Number.isFinite(maxBonusQty) || maxBonusQty < 0) return raw;
    return Math.min(raw, maxBonusQty);
  }, [conditions, previewPurchaseQty, type]);

  const sectionAlert = (target: ErrorTarget) =>
    errorTarget === target && localError ? (
      <div
        role="alert"
        aria-live="assertive"
        className="mb-4 rounded-lg border border-destructive/45 bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive"
      >
        {localError}
      </div>
    ) : null;

  const fieldDisabled = mutation.isPending || formLocked;
  /** Locked rules still allow save (is_active + valid_to only). */
  const actionDisabled = mutation.isPending;

  return (
    <div className="w-full space-y-4">
      {formLocked ? (
        <div
          role="status"
          className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
        >
          Правило уже применялось в заказах. Редактирование заблокировано для сохранения истории — можно
          изменить только дату окончания («Действует до») и включить или выключить правило.
        </div>
      ) : null}
      {localError && errorTarget === null ? (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {localError}
        </div>
      ) : null}
      <div
        ref={basicsRef}
        className={cn(
          "rounded-xl",
          errorTarget === "basics" &&
            "ring-2 ring-destructive ring-offset-2 ring-offset-background",
          errorTarget === "basics" && errorShake && "animate-bonus-rule-shake"
        )}
      >
      <BonusRuleSection>
        <BonusRuleSectionTitle>
          {discountOnly ? "Скидка — основные настройки" : "Основные настройки"}
        </BonusRuleSectionTitle>
        {sectionAlert("basics")}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
          <BonusRuleFloatingInput
            id="br-name"
            label="Название"
            className="xl:col-span-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={fieldDisabled}
            aria-invalid={errorTarget === "basics" && !name.trim()}
          />
          {discountOnly ? (
            <BonusRuleFloatingSelect
              id="br-skidka-type"
              label="Тип скидки"
              title="Процентная скидка или скидка по минимальной сумме заказа"
              value={type === "sum" || type === "discount" ? type : "discount"}
              onChange={(e) => setType(e.target.value as BonusType)}
              disabled={fieldDisabled}
            >
              <option value="discount">Процентная скидка (%)</option>
              <option value="sum">Минимальная сумма заказа (% скидка)</option>
            </BonusRuleFloatingSelect>
          ) : (
            <BonusRuleFloatingSelect
              id="br-bonus-type"
              label="Тип бонуса"
              title="Бонус за количество или за сумму заказа"
              value={type === "sum" ? "sum" : "qty"}
              onChange={(e) => setType(e.target.value === "sum" ? "sum" : "qty")}
              disabled={fieldDisabled}
            >
              <option value="qty">Бонус за количество</option>
              <option value="sum">Бонус за сумму заказа</option>
            </BonusRuleFloatingSelect>
          )}
          <BonusRuleFloatingInput
            id="br-valid-from"
            label="Действует с"
            type="datetime-local"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            disabled={mutation.isPending || formLocked}
            readOnly={formLocked}
          />
          <BonusRuleFloatingInput
            id="br-valid-to"
            label="Действует до"
            type="datetime-local"
            value={validTo}
            onChange={(e) => setValidTo(e.target.value)}
            disabled={mutation.isPending}
          />
          <BonusRuleFloatingSelect
            id="br-client-cat"
            label="Категория клиента"
            value={
              clientCategory && !clientCategoryOptions.some((c) => c.name === clientCategory)
                ? `__custom:${clientCategory}`
                : clientCategory
            }
            onChange={(e) => {
              const v = e.target.value;
              setClientCategory(v.startsWith("__custom:") ? v.slice(11) : v);
            }}
            disabled={fieldDisabled}
          >
            <option value="">Все</option>
            {clientCategory && !clientCategoryOptions.some((c) => c.name === clientCategory) ? (
              <option value={`__custom:${clientCategory}`}>{clientCategory} (текущее)</option>
            ) : null}
            {clientCategoryOptions.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </BonusRuleFloatingSelect>
          <BonusRuleFloatingSelect
            id="br-price-type"
            label="Тип цены"
            value={priceType}
            onChange={(e) => setPriceType(e.target.value)}
            disabled={fieldDisabled}
          >
            <option value="">Все</option>
            {(priceTypesQ.data ?? []).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </BonusRuleFloatingSelect>
          <BonusRuleFloatingSelect
            id="br-payment"
            label="Способ оплаты"
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value)}
            disabled={fieldDisabled || profileRefsQ.isLoading}
          >
            <option value="">Все</option>
            {paymentOptions.map((p) => (
              <option key={p.key} value={p.name}>
                {p.name}
              </option>
            ))}
          </BonusRuleFloatingSelect>
          <BonusRuleFloatingInput
            id="br-priority"
            label="Приоритет"
            type="number"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            disabled={fieldDisabled}
            title="При нескольких правилах — какое применить раньше"
            inputClassName="text-right"
          />
        </div>
        {profileRefsQ.isSuccess && paymentOptions.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Активные способы оплаты не найдены. Добавьте в{" "}
            <a className="underline underline-offset-2 hover:text-foreground" href="/settings/payment-methods">
              способах оплаты
            </a>
            .
          </p>
        ) : null}

        <div
          ref={restrictionsRef}
          id="bonus-rule-restrictions"
          className={cn(
            "mt-4 flex flex-wrap items-center gap-4 text-sm",
            errorTarget === "restrictions" &&
              "rounded-xl ring-2 ring-destructive ring-offset-2 ring-offset-background p-2 -m-2",
            errorTarget === "restrictions" && errorShake && "animate-bonus-rule-shake"
          )}
        >
          {sectionAlert("restrictions")}
          <BonusRuleTemplateRadioGroup
            title="Для кого"
            name="br-target-clients"
            value={targetAllClients ? "all" : "selected"}
            onChange={(v) => setTargetAllClients(v === "all")}
            disabled={fieldDisabled}
            options={[
              { value: "all", label: "Все клиенты" },
              {
                value: "selected",
                label: discountOnly ? "Выбранные клиенты" : "Избранные клиенты"
              }
            ]}
          />
          <BonusRuleTemplateRadioGroup
            title="Способ"
            name="br-method"
            value={isManual ? "manual" : "auto"}
            onChange={(v) => setIsManual(v === "manual")}
            disabled={fieldDisabled}
            options={[
              { value: "auto", label: "Автоматически" },
              { value: "manual", label: "Вручную" }
            ]}
          />
          <BonusRuleTemplateCheckbox
            checked={isActive}
            onChange={setIsActive}
            disabled={mutation.isPending}
            label="Активен"
          />
          <BonusRuleTemplateCheckbox
            checked={inBlocks}
            muted={!inBlocks}
            onChange={setInBlocks}
            disabled={fieldDisabled}
            label="По блокам"
          />
          <BonusRuleTemplateCheckbox
            checked={onlyByAssortment}
            muted={!onlyByAssortment}
            onChange={(v) => {
              setOnlyByAssortment(v);
              if (v) {
                setOnlyByCategory(false);
                setSelectedCategoryIds([]);
                setBonusProductIds([]);
              }
              if (!v) setTriggerProductIds([]);
            }}
            disabled={fieldDisabled}
            label="Только ассортимент"
          />
          <BonusRuleCategoryHoverField
            checked={onlyByCategory}
            onCheckedChange={(v) => {
              setOnlyByCategory(v);
              if (v) setOnlyByAssortment(false);
              if (!v) setSelectedCategoryIds([]);
            }}
            disabled={fieldDisabled}
          />
          <BonusRuleTemplateCheckbox
            checked={oncePerClient}
            muted={!oncePerClient}
            onChange={setOncePerClient}
            disabled={fieldDisabled}
            label="Один раз на клиента"
          />
        </div>

        {!targetAllClients ? (
          <div className="mt-4 rounded-xl border border-border bg-muted/15 p-3">
            <BonusRuleSelectedClientsField
              tenantSlug={tenantSlug}
              selectedIds={selectedClientIds}
              nameById={selectedClientNames}
              disabled={fieldDisabled}
              onChange={(ids, namePatch) => {
                setSelectedClientIds(ids);
                setSelectedClientNames((prev) => {
                  const next = { ...prev };
                  for (const [k, v] of Object.entries(namePatch)) {
                    const id = Number(k);
                    if (!v.trim()) delete next[id];
                    else next[id] = v;
                  }
                  return next;
                });
              }}
            />
          </div>
        ) : null}

        {!isManual ? (
          <div className="mt-4 rounded-xl border border-border bg-muted/15 p-4">
            <p className="mb-1 text-sm font-semibold text-foreground">Предварительные условия</p>
            <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
              Если в этом заказе выбранные правила не пройдут автоматическую проверку своего типа, текущее правило не
              применится.
            </p>
            <BonusRulePrerequisitesField
              tenantSlug={tenantSlug}
              excludeRuleId={initialRule && initialRule.id > 0 ? initialRule.id : null}
              value={prerequisiteRuleIds}
              onChange={setPrerequisiteRuleIds}
              disabled={fieldDisabled}
            />
          </div>
        ) : null}
      </BonusRuleSection>
      </div>

      {showTriggerColumn || showBonusColumn ? (
        <div
          ref={productsRef}
          className={cn(
            "rounded-xl",
            errorTarget === "products" && "ring-2 ring-destructive ring-offset-2 ring-offset-background",
            errorTarget === "products" && errorShake && "animate-bonus-rule-shake"
          )}
        >
          <div className="space-y-4">
            {sectionAlert("products")}
            <BonusRuleProductDualPanels
              tenantSlug={tenantSlug}
              triggerProductIds={triggerProductIds}
              bonusProductIds={bonusProductIds}
              onTriggerChange={setTriggerProductIds}
              onBonusChange={setBonusProductIds}
              onlyByAssortment={onlyByAssortment}
              onlyByCategory={onlyByCategory}
              selectedCategoryIds={selectedCategoryIds}
              onSelectedCategoryIdsChange={setSelectedCategoryIds}
              showTriggerColumn={showTriggerColumn}
              showBonusColumn={showBonusColumn}
              disabled={mutation.isPending}
              lockedView={formLocked}
            />
          </div>
        </div>
      ) : null}

      {discountOnly ? (
        <div
          ref={discountDetailsRef}
          className={cn(
            "rounded-xl",
            (errorTarget === "conditions" || errorTarget === "discount") &&
              "ring-2 ring-destructive ring-offset-2 ring-offset-background",
            (errorTarget === "conditions" || errorTarget === "discount") &&
              errorShake &&
              "animate-bonus-rule-shake"
          )}
        >
          <BonusRuleSection>
            <BonusRuleSectionTitle>
              {type === "discount" ? "Параметры скидки (%)" : "Условие по сумме заказа"}
            </BonusRuleSectionTitle>
              {sectionAlert("conditions")}
              {sectionAlert("discount")}
              {type === "discount" ? (
                <BonusRuleFloatingInput
                  id="br-discount-pct"
                  label="Процент скидки (%)"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={discountPct}
                  onChange={(e) => setDiscountPct(e.target.value)}
                  disabled={fieldDisabled}
                  aria-invalid={errorTarget === "discount"}
                  inputClassName="text-right"
                  className="max-w-md"
                />
              ) : null}
              {type === "sum" ? (
                <div className="space-y-4">
                  <BonusRuleFloatingInput
                    label="Минимальная сумма"
                    type="number"
                    min={0}
                    step="0.01"
                    value={minSum}
                    onChange={(e) => setMinSum(e.target.value)}
                    disabled={fieldDisabled}
                    inputClassName="text-right"
                    className="max-w-md"
                  />
                  <BonusRuleFloatingInput
                    id="br-discount-pct-sum"
                    label="Процент скидки (%)"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={discountPct}
                    onChange={(e) => setDiscountPct(e.target.value)}
                    disabled={fieldDisabled}
                    aria-invalid={errorTarget === "discount"}
                    inputClassName="text-right"
                    className="max-w-md"
                  />
                  <SumThresholdScopeFields
                    radioGroupName="br-sum-scope-skid"
                    sumThresholdScope={sumThresholdScope}
                    onScopeChange={setSumThresholdScope}
                    disabled={fieldDisabled}
                  />
                </div>
              ) : null}
          </BonusRuleSection>
        </div>
      ) : type === "qty" || type === "sum" ? (
      <div
        ref={conditionsRef}
        className={cn(
          "rounded-xl",
          errorTarget === "conditions" &&
            "ring-2 ring-destructive ring-offset-2 ring-offset-background",
          errorTarget === "conditions" && errorShake && "animate-bonus-rule-shake"
        )}
      >
      <BonusRuleSection>
        <BonusRuleSectionTitle>Условия</BonusRuleSectionTitle>
          {sectionAlert("conditions")}
          {type === "qty" ? (
            <div className="space-y-4">
              {conditions.map((row, idx) => (
                <div key={idx} className={cn("space-y-4", idx > 0 && "border-t border-border/60 pt-5")}>
                  {conditions.length > 1 ? (
                    <p className="text-sm font-medium text-muted-foreground">Условие №{idx + 1}</p>
                  ) : null}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <BonusRuleFloatingInput
                      label="Минимальное количество"
                      value={row.min_qty}
                      onChange={(e) => {
                        const next = [...conditions];
                        next[idx] = { ...next[idx], min_qty: e.target.value };
                        setConditions(next);
                      }}
                      disabled={fieldDisabled}
                      placeholder="например 10"
                      inputClassName="text-right"
                    />
                    <BonusRuleFloatingInput
                      label="На какое количество"
                      value={row.step_qty}
                      onChange={(e) => {
                        const next = [...conditions];
                        next[idx] = { ...next[idx], step_qty: e.target.value };
                        setConditions(next);
                      }}
                      disabled={fieldDisabled}
                      inputClassName="text-right"
                    />
                    <BonusRuleFloatingInput
                      label="Количество бонуса"
                      value={row.bonus_qty}
                      onChange={(e) => {
                        const next = [...conditions];
                        next[idx] = { ...next[idx], bonus_qty: e.target.value };
                        setConditions(next);
                      }}
                      disabled={fieldDisabled}
                      inputClassName="text-right"
                    />
                    <BonusRuleFloatingInput
                      label="Максимальное количество бонуса"
                      value={row.max_bonus_qty}
                      onChange={(e) => {
                        const next = [...conditions];
                        next[idx] = { ...next[idx], max_bonus_qty: e.target.value };
                        setConditions(next);
                      }}
                      disabled={fieldDisabled}
                      inputClassName="text-right"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:max-w-[25%]">
                    <BonusRuleFloatingInput
                      label="Макс. количество (диапазон)"
                      value={row.max_qty}
                      onChange={(e) => {
                        const next = [...conditions];
                        next[idx] = { ...next[idx], max_qty: e.target.value };
                        setConditions(next);
                      }}
                      disabled={fieldDisabled}
                      placeholder="необязательно"
                      inputClassName="text-right"
                    />
                  </div>
                  {conditions.length > 1 ? (
                    <BonusRuleTemplateButton
                      variant="outline"
                      onClick={() => setConditions(conditions.filter((_, i) => i !== idx))}
                      disabled={fieldDisabled}
                    >
                      Удалить условие
                    </BonusRuleTemplateButton>
                  ) : null}
                </div>
              ))}
              <BonusRuleTemplateButton
                variant="outline"
                onClick={() => setConditions([...conditions, emptyCond()])}
                disabled={fieldDisabled}
              >
                + Добавить условие
              </BonusRuleTemplateButton>
              <SumThresholdScopeFields
                variant="qty"
                radioGroupName="br-qty-scope"
                sumThresholdScope={sumThresholdScope}
                onScopeChange={setSumThresholdScope}
                disabled={fieldDisabled}
              />
            </div>
          ) : null}

          {type === "sum" ? (
            <div className="space-y-4">
              <BonusRuleFloatingInput
                label="Минимальная сумма"
                type="number"
                min={0}
                step="0.01"
                value={minSum}
                onChange={(e) => setMinSum(e.target.value)}
                disabled={fieldDisabled}
                inputClassName="text-right"
                className="max-w-md"
              />
              <SumThresholdScopeFields
                radioGroupName="br-sum-scope"
                sumThresholdScope={sumThresholdScope}
                onScopeChange={setSumThresholdScope}
                disabled={fieldDisabled}
              />
            </div>
          ) : null}
      </BonusRuleSection>
      </div>
      ) : null}

      {!discountOnly && type === "discount" ? (
        <div
          ref={discountRef}
          className={cn(
            "rounded-xl",
            errorTarget === "discount" &&
              "ring-2 ring-destructive ring-offset-2 ring-offset-background",
            errorTarget === "discount" && errorShake && "animate-bonus-rule-shake"
          )}
        >
          <BonusRuleSection>
            <BonusRuleSectionTitle>Скидка</BonusRuleSectionTitle>
              {sectionAlert("discount")}
              <BonusRuleFloatingInput
                id="br-discount-pct-legacy"
                label="Процент скидки (%)"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={discountPct}
                onChange={(e) => setDiscountPct(e.target.value)}
                disabled={fieldDisabled}
                aria-invalid={errorTarget === "discount"}
                inputClassName="text-right"
                className="max-w-md"
              />
          </BonusRuleSection>
        </div>
      ) : null}

      <BonusRuleSection className="flex flex-wrap items-center justify-between gap-4">
        {!discountOnly && type === "qty" ? (
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-foreground">Предпросмотр правила</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Если клиент купит {previewPurchaseQty || "0"} шт., система автоматически добавит {previewBonusQty}{" "}
              бонусных товаров.
            </p>
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-foreground">Сохранение правила</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Проверьте настройки и нажмите «Сохранить», чтобы применить изменения.
            </p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {!discountOnly && type === "qty" ? (
            <>
              <label htmlFor="br-preview-qty" className="text-sm text-muted-foreground">
                Проверить количество
              </label>
              <BonusRulePreviewQtyInput
                value={previewPurchaseQty}
                onChange={setPreviewPurchaseQty}
                disabled={fieldDisabled}
              />
            </>
          ) : null}
          <BonusRuleTemplateButton variant="outline" onClick={() => router.push(listHref)} disabled={actionDisabled}>
            Отмена
          </BonusRuleTemplateButton>
          <BonusRuleTemplateButton onClick={submit} disabled={actionDisabled}>
            {mutation.isPending ? "Сохранение…" : "Сохранить"}
          </BonusRuleTemplateButton>
        </div>
      </BonusRuleSection>
    </div>
  );
}
