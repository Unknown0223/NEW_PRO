"use client";

import type { ClientRow } from "@/lib/client-types";
import { api } from "@/lib/api";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import {
  firstMessagePerField,
  firstValidationUserHint,
  getZodFlattenFromApiErrorBody
} from "@/lib/api-validation-details";
import { isAxiosError } from "axios";
import { invalidateClientAuditQueries } from "@/lib/client-audit-history";
import { STALE } from "@/lib/query-stale";
import { useFormIntentTracking } from "@/lib/activity-tracker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { pickCityTerritoryHint } from "@/lib/city-territory-hint";
import { mergeRefOptions } from "@/lib/merge-ref-options";
import { mergeRefSelectOptions } from "@/lib/ref-select-options";
import { orderAgentFilterOption, orderExpeditorFilterOption } from "@/lib/order-picker-labels";
import {
  type ClientDetailApi,
  type AgentSlotForm,
  isoToDateInput,
  pinflForApi,
  emptyAgentSlot,
  buildAgentSlots,
  toggleWeekday,
  dateInputToIso,
  MAP_DEFAULT_LAT,
  MAP_DEFAULT_LON,
  MAX_TEAM_ROWS,
  VISIT_DAYS
} from "../client-edit-form.utils";
import {
  parseCoordsFromLocationText,
  normalizeCoord,
  inLatRange,
  inLonRange
} from "../yandex-coordinate-picker";
import { loadYandexMapsApi } from "../yandex-coordinate-picker";
import { agentAssignmentsFieldHint } from "../client-edit-form-ui";

export type ClientEditFormVm = ReturnType<typeof useClientEditForm>;

export function useClientEditForm({
  tenantSlug,
  clientId,
  mode = "edit",
  onSuccess,
  onCancel,
  redirectOnSuccess = true
}: {
  tenantSlug: string | null;
  clientId?: number;
  mode?: "edit" | "create";
  onSuccess: (clientId: number) => void;
  onCancel: () => void;
  redirectOnSuccess?: boolean;
}) {
  const isCreateMode = mode === "create";
  const effectiveClientId = Number.isFinite(clientId) ? Number(clientId) : 0;
  const qc = useQueryClient();
  const { markSaved } = useFormIntentTracking({
    module: "clients",
    section: "klient",
    entityType: "client",
    entityId: isCreateMode ? undefined : effectiveClientId,
    label: isCreateMode ? "Создание клиента" : "Редактирование клиента"
  });
  const [localError, setLocalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"main" | "extra">("main");

  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [phone, setPhone] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [creditLimit, setCreditLimit] = useState("");
  const [category, setCategory] = useState("");
  const [clientTypeCode, setClientTypeCode] = useState("");
  const [address, setAddress] = useState("");
  const [responsiblePerson, setResponsiblePerson] = useState("");
  const [landmark, setLandmark] = useState("");
  const [inn, setInn] = useState("");
  const [pdl, setPdl] = useState("");
  const [logisticsService, setLogisticsService] = useState("");
  const [licenseUntil, setLicenseUntil] = useState("");
  const [workingHours, setWorkingHours] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [apartment, setApartment] = useState("");
  const [gpsText, setGpsText] = useState("");
  const [notes, setNotes] = useState("");
  const [clientFormat, setClientFormat] = useState("");
  const [clientCode, setClientCode] = useState("");
  const [salesChannel, setSalesChannel] = useState("");
  const [productCategoryRef, setProductCategoryRef] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankMfo, setBankMfo] = useState("");
  const [clientPinfl, setClientPinfl] = useState("");
  const [oked, setOked] = useState("");
  const [contractNumber, setContractNumber] = useState("");
  const [vatRegCode, setVatRegCode] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [zone, setZone] = useState("");
  const [mapSearchText, setMapSearchText] = useState("");
  const [mapSearchPending, setMapSearchPending] = useState(false);
  const [mapSearchNotice, setMapSearchNotice] = useState<string | null>(null);
  const [agentSlots, setAgentSlots] = useState<AgentSlotForm[]>(() => [emptyAgentSlot()]);
  const [slot1LockType, setSlot1LockType] = useState("none");
  const [slot1LockReason, setSlot1LockReason] = useState("");
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const clientQ = useQuery({
    queryKey: ["client", tenantSlug, effectiveClientId],
    enabled: Boolean(tenantSlug) && !isCreateMode && effectiveClientId > 0,
    staleTime: STALE.detail,
    queryFn: async () => {
      const { data } = await api.get<ClientDetailApi>(`/api/${tenantSlug}/clients/${effectiveClientId}`);
      return data;
    }
  });

  const agentsPickerQ = useQuery({
    queryKey: ["agents", tenantSlug, "client-edit"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{
        data: Array<{ id: number; fio: string; login: string; is_active: boolean }>;
      }>(`/api/${tenantSlug}/agents`);
      return data.data
        .filter((r) => r.is_active)
        .map((r) => ({ id: r.id, name: r.fio, login: r.login }));
    }
  });

  const expeditorsPickerQ = useQuery({
    queryKey: ["expeditors", tenantSlug, "client-edit"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{
        data: Array<{ id: number; fio: string; login: string; is_active: boolean }>;
      }>(`/api/${tenantSlug}/expeditors`);
      return data.data
        .filter((r) => r.is_active)
        .map((r) => ({ id: r.id, name: r.fio, login: r.login }));
    }
  });

  const debouncedRegion = useDebouncedValue(region.trim(), 400);
  const debouncedCity = useDebouncedValue(city.trim(), 400);
  const debouncedZone = useDebouncedValue(zone.trim(), 400);
  const debouncedLatitude = useDebouncedValue(latitude.trim(), 600);
  const debouncedLongitude = useDebouncedValue(longitude.trim(), 600);

  const territoryPickerInputsReady = Boolean(
    debouncedRegion || debouncedCity || debouncedZone || (debouncedLatitude && debouncedLongitude)
  );

  const territoryAgentPickerCtxQ = useQuery({
    queryKey: [
      "territory-agent-picker-context",
      tenantSlug,
      debouncedRegion,
      debouncedCity,
      debouncedZone,
      debouncedLatitude,
      debouncedLongitude
    ],
    enabled: Boolean(tenantSlug) && territoryPickerInputsReady,
    staleTime: STALE.reference,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const p = new URLSearchParams();
      if (debouncedRegion) p.set("region", debouncedRegion);
      if (debouncedCity) p.set("city", debouncedCity);
      if (debouncedZone) p.set("zone", debouncedZone);
      const latT = debouncedLatitude.replace(/\s/g, "").replace(",", ".").trim();
      const lngT = debouncedLongitude.replace(/\s/g, "").replace(",", ".").trim();
      if (latT) p.set("latitude", latT);
      if (lngT) p.set("longitude", lngT);
      const qs = p.toString();
      const { data } = await api.get<{
        territory_matched: boolean;
        territory_ids: number[];
        agent_ids: number[];
        expeditor_ids: number[];
      }>(`/api/${tenantSlug}/territories/agent-picker-context${qs ? `?${qs}` : ""}`);
      return data;
    }
  });

  const refsQ = useQuery({
    queryKey: ["clients-references", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{
        categories: string[];
        client_type_codes: string[];
        regions: string[];
        districts: string[];
        cities: string[];
        neighborhoods: string[];
        zones: string[];
        client_formats: string[];
        sales_channels: string[];
        product_category_refs: string[];
        logistics_services: string[];
        category_options?: { value: string; label: string }[];
        client_type_options?: { value: string; label: string }[];
        client_format_options?: { value: string; label: string }[];
        sales_channel_options?: { value: string; label: string }[];
        city_options?: { value: string; label: string }[];
        region_options?: { value: string; label: string }[];
        city_territory_hints?: Record<
          string,
          {
            region_stored: string | null;
            region_label: string | null;
            zone_stored: string | null;
            zone_label: string | null;
            district_stored: string | null;
            district_label: string | null;
          }
        >;
      }>(`/api/${tenantSlug}/clients/references`);
      return data;
    }
  });

  const catOpts = useMemo(() => {
    const d = refsQ.data;
    if (!d) return [];
    if (d.category_options?.length) {
      return mergeRefSelectOptions(category, d.category_options, d.categories);
    }
    return mergeRefOptions(category, d.categories).map((v) => ({ value: v, label: v }));
  }, [category, refsQ.data]);
  const typeOpts = useMemo(() => {
    const d = refsQ.data;
    if (!d) return [];
    if (d.client_type_options?.length) {
      return mergeRefSelectOptions(clientTypeCode, d.client_type_options, d.client_type_codes);
    }
    return mergeRefOptions(clientTypeCode, d.client_type_codes).map((v) => ({ value: v, label: v }));
  }, [clientTypeCode, refsQ.data]);
  const terrOpts = useMemo(() => {
    const d = refsQ.data;
    if (!d) return [];
    if (d.region_options?.length) {
      return mergeRefSelectOptions(region, d.region_options, d.regions);
    }
    return mergeRefOptions(region, d.regions).map((v) => ({ value: v, label: v }));
  }, [region, refsQ.data]);
  const formatOpts = useMemo(() => {
    const d = refsQ.data;
    if (!d) return [];
    if (d.client_format_options?.length) {
      return mergeRefSelectOptions(clientFormat, d.client_format_options, d.client_formats);
    }
    return mergeRefOptions(clientFormat, d.client_formats).map((v) => ({ value: v, label: v }));
  }, [clientFormat, refsQ.data]);
  const salesOpts = useMemo(() => {
    const d = refsQ.data;
    if (!d) return [];
    if (d.sales_channel_options?.length) {
      return mergeRefSelectOptions(salesChannel, d.sales_channel_options, d.sales_channels);
    }
    return mergeRefOptions(salesChannel, d.sales_channels).map((v) => ({ value: v, label: v }));
  }, [salesChannel, refsQ.data]);
  const prodCatOpts = useMemo(
    () => mergeRefOptions(productCategoryRef, refsQ.data?.product_category_refs),
    [productCategoryRef, refsQ.data?.product_category_refs]
  );
  const cityOpts = useMemo(() => {
    const d = refsQ.data;
    if (!d) return [];
    if (d.city_options?.length) {
      return mergeRefSelectOptions(city, d.city_options, d.cities);
    }
    return mergeRefOptions(city, d.cities).map((v) => ({ value: v, label: v }));
  }, [city, refsQ.data]);
  const zoneOpts = useMemo(() => mergeRefOptions(zone, refsQ.data?.zones), [zone, refsQ.data?.zones]);
  const logOpts = useMemo(
    () => mergeRefOptions(logisticsService, refsQ.data?.logistics_services),
    [logisticsService, refsQ.data?.logistics_services]
  );

  const hintRows = useMemo(() => Object.values(refsQ.data?.city_territory_hints ?? {}), [refsQ.data?.city_territory_hints]);

  const cascadedCityOpts = useMemo(() => {
    if (!region) return cityOpts;
    const allow = new Set(
      hintRows
        .filter((h) => !region || h.region_stored === region)
        .map((h) => [h.region_stored, h.zone_stored])
        .flat()
        .filter(Boolean)
    );
    const filtered = cityOpts.filter((o) => {
      if (!allow.size) return true;
      const h = pickCityTerritoryHint(refsQ.data?.city_territory_hints, o.value);
      return (!!h && (!region || h.region_stored === region)) || allow.has(o.value);
    });
    return filtered.length > 0 ? filtered : cityOpts;
  }, [cityOpts, hintRows, refsQ.data?.city_territory_hints, region]);

  const cascadedZoneOpts = useMemo(() => {
    let base: string[];
    if (!region && !city) {
      base = zoneOpts;
    } else {
      const allow = new Set(
        hintRows
          .filter(
            (h) =>
              (!region || h.region_stored === region) &&
              (!city || pickCityTerritoryHint(refsQ.data?.city_territory_hints, city)?.zone_stored === h.zone_stored)
          )
          .map((h) => h.zone_stored)
          .filter(Boolean) as string[]
      );
      const cityHint = city ? pickCityTerritoryHint(refsQ.data?.city_territory_hints, city) : null;
      if (cityHint?.zone_stored) allow.add(cityHint.zone_stored);
      const filtered = zoneOpts.filter((v) => allow.has(v));
      base = filtered.length > 0 ? filtered : zoneOpts;
    }
    const current = zone.trim();
    if (current && !base.includes(current)) return [current, ...base];
    return base;
  }, [city, hintRows, refsQ.data?.city_territory_hints, region, zone, zoneOpts]);

  const onCitySelect = (next: string) => {
    setCity(next);
    const h = pickCityTerritoryHint(refsQ.data?.city_territory_hints, next);
    if (!h) return;
    if (h.region_stored) setRegion(h.region_stored);
    if (h.zone_stored) setZone(h.zone_stored);
  };
  const onRegionSelect = (next: string) => {
    setRegion(next);
    if (next.trim() !== region.trim()) {
      setCity("");
      setZone("");
    }
  };

  const onZoneSelect = (next: string) => {
    setZone(next);
  };

  const agentsForTeamPicker = useMemo(() => {
    const all = agentsPickerQ.data ?? [];
    const ctx = territoryAgentPickerCtxQ.data;
    if (!ctx || !ctx.territory_matched) return all;
    const slotIds = new Set<number>();
    for (const sl of agentSlots) {
      const n = Number.parseInt(String(sl.agentId).trim(), 10);
      if (Number.isFinite(n) && n > 0) slotIds.add(n);
    }
    const allow = new Set(ctx.agent_ids);
    for (const id of slotIds) allow.add(id);
    return all.filter((a) => allow.has(a.id));
  }, [agentsPickerQ.data, territoryAgentPickerCtxQ.data, agentSlots]);

  const agentTeamSelectOptions = useMemo(
    () => agentsForTeamPicker.map((u) => orderAgentFilterOption({ id: u.id, name: u.name, login: u.login })),
    [agentsForTeamPicker]
  );
  const expeditorsForTeamPicker = useMemo(() => {
    const all = expeditorsPickerQ.data ?? [];
    const ctx = territoryAgentPickerCtxQ.data;
    if (!ctx || !ctx.territory_matched) return all;
    const slotIds = new Set<number>();
    for (const sl of agentSlots) {
      const n = Number.parseInt(String(sl.expeditorUserId).trim(), 10);
      if (Number.isFinite(n) && n > 0) slotIds.add(n);
    }
    const allow = new Set(ctx.expeditor_ids);
    for (const id of slotIds) allow.add(id);
    return all.filter((u) => allow.has(u.id));
  }, [expeditorsPickerQ.data, territoryAgentPickerCtxQ.data, agentSlots]);

  const expeditorTeamSelectOptions = useMemo(
    () => expeditorsForTeamPicker.map((u) => orderExpeditorFilterOption({ id: u.id, fio: u.name, login: u.login })),
    [expeditorsForTeamPicker]
  );

  useEffect(() => {
    const client = clientQ.data;
    if (!client) return;
    setLocalError(null);
    setFieldErrors({});
    setName(client.name);
    setLegalName(client.legal_name ?? "");
    setPhone(client.phone ?? "");
    setIsActive(client.is_active);
    setCreditLimit(client.credit_limit);
    setCategory(client.category ?? "");
    setClientTypeCode(client.client_type_code ?? "");
    setAddress(client.address ?? "");
    setResponsiblePerson(client.responsible_person ?? "");
    setLandmark(client.landmark ?? "");
    setInn(client.inn ?? "");
    setPdl(client.pdl ?? "");
    setLogisticsService(client.logistics_service ?? "");
    setLicenseUntil(isoToDateInput(client.license_until));
    setWorkingHours(client.working_hours ?? "");
    setRegion(client.region ?? "");
    setCity(client.city ?? "");
    setStreet(client.street ?? "");
    setHouseNumber(client.house_number ?? "");
    setApartment(client.apartment ?? "");
    setGpsText(client.gps_text ?? "");
    setNotes(client.notes ?? "");
    setClientFormat(client.client_format ?? "");
    setClientCode(client.client_code ?? "");
    setSalesChannel(client.sales_channel ?? "");
    setProductCategoryRef(client.product_category_ref ?? "");
    setBankName(client.bank_name ?? "");
    setBankAccount(client.bank_account ?? "");
    setBankMfo(client.bank_mfo ?? "");
    setClientPinfl(client.client_pinfl ?? "");
    setOked(client.oked ?? "");
    setContractNumber(client.contract_number ?? "");
    setVatRegCode(client.vat_reg_code ?? "");
    setLatitude(client.latitude != null ? String(client.latitude) : "");
    setLongitude(client.longitude != null ? String(client.longitude) : "");
    setZone(client.zone ?? "");
    setAgentSlots(buildAgentSlots(client));
    const slot1 = client.agent_assignments.find((a) => a.slot === 1);
    setSlot1LockType(slot1?.lock_type ?? "none");
    setSlot1LockReason(slot1?.lock_reason ?? "");
  }, [clientQ.data]);

  useEffect(() => {
    const client = clientQ.data;
    const hints = refsQ.data?.city_territory_hints;
    if (!client || !hints) return;
    const c = client.city?.trim();
    if (!c) return;
    const h = pickCityTerritoryHint(hints, c);
    if (!h) return;
    if (h.region_stored) setRegion(h.region_stored);
    if (h.zone_stored) setZone(h.zone_stored);
  }, [clientQ.data, refsQ.data?.city_territory_hints]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!tenantSlug) throw new Error("Нет данных");
      setSaveNotice(null);
      if (slot1LockType !== "none" && !slot1LockReason.trim()) {
        throw new Error("Для ручной блокировки или договора укажите причину в поле «Сабаб».");
      }
      const creditRaw = creditLimit.replace(/\s/g, "").replace(",", ".");
      const credit = creditRaw === "" ? 0 : Number.parseFloat(creditRaw);
      if (!Number.isFinite(credit) || credit < 0) {
        throw new Error("Некорректный кредитный лимит");
      }

      const filled = agentSlots.filter(
        (s) =>
          s.agentId.trim() !== "" ||
          s.expeditorUserId.trim() !== "" ||
          s.weekdays.length > 0 ||
          s.legacyVisitDate.trim() !== "" ||
          s.legacyExpeditorPhone.trim() !== ""
      );
      const agent_assignments = filled.map((s, idx) => {
        const slot = idx + 1;
        let agent_id: number | null = null;
        if (s.agentId.trim() !== "") {
          const n = Number.parseInt(s.agentId, 10);
          if (!Number.isFinite(n) || n <= 0) throw new Error(`Некорректный выбор агента в строке ${slot}`);
          agent_id = n;
        }
        let expeditor_user_id: number | null = null;
        if (s.expeditorUserId.trim() !== "") {
          const e = Number.parseInt(s.expeditorUserId, 10);
          if (!Number.isFinite(e) || e <= 0) throw new Error(`Некорректный доставщик в строке ${slot}`);
          expeditor_user_id = e;
        }
        return {
          slot,
          agent_id,
          visit_date: s.legacyVisitDate.trim() ? dateInputToIso(s.legacyVisitDate) : null,
          expeditor_phone: s.legacyExpeditorPhone.trim() || null,
          expeditor_user_id,
          visit_weekdays: s.weekdays.length ? s.weekdays : undefined
        };
      });

      const body: Record<string, unknown> = {
        name: name.trim(),
        legal_name: legalName.trim() || null,
        phone: phone.trim() || null,
        is_active: isActive,
        credit_limit: credit,
        category: category.trim() || null,
        client_type_code: clientTypeCode.trim() || null,
        address: address.trim() || null,
        responsible_person: responsiblePerson.trim() || null,
        landmark: landmark.trim() || null,
        inn: inn.trim() || null,
        pdl: pdl.trim() || null,
        logistics_service: logisticsService.trim() || null,
        license_until: licenseUntil.trim() ? dateInputToIso(licenseUntil) : null,
        working_hours: workingHours.trim() || null,
        region: region.trim() || null,
        city: city.trim() || null,
        district: null,
        neighborhood: null,
        street: street.trim() || null,
        house_number: houseNumber.trim() || null,
        apartment: apartment.trim() || null,
        gps_text: gpsText.trim() || null,
        notes: notes.trim() || null,
        client_format: clientFormat.trim() || null,
        client_code: clientCode.trim().slice(0, 20) || null,
        sales_channel: salesChannel.trim() || null,
        product_category_ref: productCategoryRef.trim() || null,
        bank_name: bankName.trim() || null,
        bank_account: bankAccount.trim() || null,
        bank_mfo: bankMfo.trim() || null,
        client_pinfl: pinflForApi(clientPinfl),
        oked: oked.trim() || null,
        contract_number: contractNumber.trim() || null,
        vat_reg_code: vatRegCode.trim() || null,
        latitude: latitude.trim() === "" ? null : latitude.trim(),
        longitude: longitude.trim() === "" ? null : longitude.trim(),
        zone: zone.trim() || null,
        agent_assignments
      };
      if (isCreateMode) {
        if (name.trim().length < 3) throw new Error("Название должно быть не короче 3 символов.");
        if (!phone.trim()) throw new Error("Телефон обязателен.");
        if (!region.trim()) throw new Error("Территория (область) обязательна.");
        if (latitude.trim() === "" || longitude.trim() === "") throw new Error("Координаты обязательны.");

        const createBody: Record<string, unknown> = {
          name: name.trim(),
          phone: phone.trim(),
          category: category.trim() || null,
          client_type_code: clientTypeCode.trim() || null,
          region: region.trim(),
          district: null,
          city: city.trim() || null,
          neighborhood: null,
          zone: zone.trim() || null,
          client_format: clientFormat.trim() || null,
          sales_channel: salesChannel.trim() || null,
          product_category_ref: productCategoryRef.trim() || null,
          logistics_service: logisticsService.trim() || null,
          legal_name: legalName.trim() || null,
          address: address.trim() || null,
          responsible_person: responsiblePerson.trim() || null,
          landmark: landmark.trim() || null,
          inn: inn.trim() || null,
          working_hours: workingHours.trim() || null,
          notes: notes.trim() || null,
          client_code: clientCode.trim().slice(0, 20) || null,
          latitude: latitude.trim(),
          longitude: longitude.trim(),
          is_active: isActive,
          agent_assignments
        };
        const created = await api.post<{ id: number }>(`/api/${tenantSlug}/clients`, createBody);
        const createdId = created.data.id;
        const { data: createdDetail } = await api.patch<ClientDetailApi>(
          `/api/${tenantSlug}/clients/${createdId}`,
          body
        );
        const slot1 = createdDetail.agent_assignments?.find((a) => a.slot === 1);
        if (slot1?.id && slot1LockType !== "none") {
          await api.patch(`/api/${tenantSlug}/client-agent-assignments/${slot1.id}/lock`, {
            lock_type: slot1LockType,
            lock_reason: slot1LockReason.trim() || null
          });
        }
        return { id: createdId };
      }

      const { data: updatedDetail } = await api.patch<ClientDetailApi>(
        `/api/${tenantSlug}/clients/${effectiveClientId}`,
        body
      );
      const slot1 = updatedDetail.agent_assignments?.find((a) => a.slot === 1);
      if (slot1?.id) {
        const savedType = slot1.lock_type ?? "none";
        const savedReason = slot1.lock_reason ?? "";
        if (slot1LockType !== savedType || slot1LockReason.trim() !== savedReason.trim()) {
          await api.patch(`/api/${tenantSlug}/client-agent-assignments/${slot1.id}/lock`, {
            lock_type: slot1LockType,
            lock_reason: slot1LockType === "none" ? null : slot1LockReason.trim() || null
          });
        }
      }
      return { id: effectiveClientId };
    },
    onSuccess: async (res) => {
      markSaved();
      setFieldErrors({});
      setSaveNotice(isCreateMode ? "Клиент создан" : "Изменения сохранены");
      const doneId = typeof res?.id === "number" && Number.isFinite(res.id) ? res.id : effectiveClientId;
      await qc.invalidateQueries({ queryKey: ["clients", tenantSlug] });
      if (doneId > 0 && tenantSlug) {
        await qc.invalidateQueries({ queryKey: ["client", tenantSlug, doneId] });
        await invalidateClientAuditQueries(qc, tenantSlug, doneId);
      }
      await qc.invalidateQueries({ queryKey: ["orders", tenantSlug] });
      if (redirectOnSuccess) {
        onSuccess(doneId);
      }
    },
    onError: (e: unknown) => {
      const navigateToField = (elementId: string, targetTab: "main" | "extra") => {
        setTab(targetTab);
        window.setTimeout(() => {
          const el = document.getElementById(elementId);
          if (!el) return;
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          const focusable =
            el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
              ? el
              : el.querySelector<HTMLElement>("input, select, textarea, button[type='button']");
          focusable?.focus({ preventScroll: true });
        }, 100);
      };

      if (isAxiosError(e)) {
        const status = e.response?.status;
        const data = e.response?.data as { error?: string; message?: string } | undefined;
        if (status === 401) {
          setFieldErrors({});
          setLocalError(getUserFacingError(e, "Ошибка сохранения"));
          return;
        }
        if (status === 403) {
          setFieldErrors({});
          setLocalError(getUserFacingError(e, "Ошибка сохранения"));
          return;
        }
        const errCode = data?.error;
        const apiMsg = (data?.message ?? "").toLowerCase();
        if (status === 409) {
          setFieldErrors({});
          setLocalError(getUserFacingError(e, "Ошибка сохранения"));
          if (errCode === "DuplicatePhone") navigateToField("ce-phone", "main");
          else if (errCode === "DuplicateName") navigateToField("ce-name", "main");
          return;
        }
        const flat = getZodFlattenFromApiErrorBody(data);
        if (flat) {
          setFieldErrors(firstMessagePerField(flat));
          const top = flat.formErrors.map((s) => s.trim()).find(Boolean);
          const hint = firstValidationUserHint(flat);
          const line = top ?? hint;
          setLocalError(line ? withApiSupportLine(line, e) : withApiSupportLine(getUserFacingError(e, "Ошибка сохранения"), e));
        } else {
          setFieldErrors({});
          setLocalError(getUserFacingError(e, "Ошибка сохранения"));
        }
        if (status === 400 && !flat) {
          if (apiMsg.includes("телефон")) navigateToField("ce-phone", "main");
          else if (apiMsg.includes("област") || apiMsg.includes("территор")) navigateToField("ce-region", "main");
          else if (apiMsg.includes("координат")) navigateToField("ce-lat", "main");
          return;
        }
        return;
      }

      setFieldErrors({});
      const userMsg = getUserFacingError(e, "Ошибка сохранения");
      setLocalError(userMsg);
      const lower = userMsg.toLowerCase();
      if (lower.includes("кредит")) navigateToField("ce-credit", "extra");
      else if (lower.includes("телефон")) navigateToField("ce-phone", "main");
      else if (lower.includes("название") || lower.includes("3 символ")) navigateToField("ce-name", "main");
      else if (lower.includes("област") || lower.includes("территор")) navigateToField("ce-region", "main");
      else if (lower.includes("координат")) navigateToField("ce-lat", "main");
      else if (lower.includes("агент") || lower.includes("доставщик")) navigateToField("ce-team-block", "main");
      else if (lower.includes("сабаб") || lower.includes("блокировк") || lower.includes("договор"))
        navigateToField("ce-team-block", "main");
    }
  });

  const inputCls =
    "flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring";
  const selectCls = inputCls;

  const latParsed = normalizeCoord(latitude);
  const lonParsed = normalizeCoord(longitude);
  const mapOk = latParsed != null && lonParsed != null && inLatRange(latParsed) && inLonRange(lonParsed);
  const latN = mapOk ? String(latParsed) : "";
  const lonN = mapOk ? String(lonParsed) : "";
  const yandexMapsHref = mapOk
    ? `https://yandex.com/maps/?pt=${encodeURIComponent(lonN)},${encodeURIComponent(latN)}&z=17&l=map`
    : `https://yandex.com/maps/?ll=${encodeURIComponent(String(MAP_DEFAULT_LON))}%2C${encodeURIComponent(String(MAP_DEFAULT_LAT))}&z=11`;

  const applyPickedCoords = (nextLat: number, nextLon: number) => {
    setLatitude(nextLat.toFixed(6));
    setLongitude(nextLon.toFixed(6));
    setMapSearchNotice(null);
  };

  const handleMapSearch = async () => {
    const query = mapSearchText.trim();
    if (!query) return;

    const parsed = parseCoordsFromLocationText(query, latitude, longitude);
    if (parsed && parsed.lat != null && parsed.lon != null) {
      applyPickedCoords(parsed.lat, parsed.lon);
      return;
    }

    setMapSearchPending(true);
    setMapSearchNotice(null);
    try {
      const ymaps = await loadYandexMapsApi();
      const byAddress = await new Promise<{ lat: number; lon: number } | null>((resolve) => {
        ymaps.ready(() => {
          void ymaps
            .geocode?.(query, { results: 1 })
            .then((res) => {
              if (!res) {
                resolve(null);
                return;
              }
              if (res.geoObjects.getLength() < 1) {
                resolve(null);
                return;
              }
              const coords = res.geoObjects.get(0).geometry.getCoordinates();
              const nextLat = Number(coords[0]);
              const nextLon = Number(coords[1]);
              if (!Number.isFinite(nextLat) || !Number.isFinite(nextLon)) {
                resolve(null);
                return;
              }
              resolve({ lat: nextLat, lon: nextLon });
            })
            .catch(() => resolve(null));
        });
      });
      if (byAddress) {
        applyPickedCoords(byAddress.lat, byAddress.lon);
        return;
      }
      setMapSearchNotice("Koordinata yoki manzil aniqlanmadi. Matn formatini tekshiring.");
    } catch {
      setMapSearchNotice("Yandex карта yuklanmadi. Internet yoki API kalitini tekshiring.");
    } finally {
      setMapSearchPending(false);
    }
  };

  return {
    isCreateMode,
    effectiveClientId,
    clientQ,
    mutation,
    localError,
    fieldErrors,
    tab,
    setTab,
    name,
    setName,
    legalName,
    setLegalName,
    phone,
    setPhone,
    isActive,
    setIsActive,
    creditLimit,
    setCreditLimit,
    category,
    setCategory,
    clientTypeCode,
    setClientTypeCode,
    address,
    setAddress,
    responsiblePerson,
    setResponsiblePerson,
    landmark,
    setLandmark,
    inn,
    setInn,
    pdl,
    setPdl,
    logisticsService,
    setLogisticsService,
    licenseUntil,
    setLicenseUntil,
    workingHours,
    setWorkingHours,
    region,
    setRegion,
    city,
    setCity,
    street,
    setStreet,
    houseNumber,
    setHouseNumber,
    apartment,
    setApartment,
    gpsText,
    setGpsText,
    notes,
    setNotes,
    clientFormat,
    setClientFormat,
    clientCode,
    setClientCode,
    salesChannel,
    setSalesChannel,
    productCategoryRef,
    setProductCategoryRef,
    bankName,
    setBankName,
    bankAccount,
    setBankAccount,
    bankMfo,
    setBankMfo,
    clientPinfl,
    setClientPinfl,
    oked,
    setOked,
    contractNumber,
    setContractNumber,
    vatRegCode,
    setVatRegCode,
    latitude,
    setLatitude,
    longitude,
    setLongitude,
    zone,
    setZone,
    mapSearchText,
    setMapSearchText,
    mapSearchPending,
    mapSearchNotice,
    setMapSearchNotice,
    agentSlots,
    setAgentSlots,
    slot1LockType,
    setSlot1LockType,
    slot1LockReason,
    setSlot1LockReason,
    saveNotice,
    inputCls,
    selectCls,
    latParsed,
    lonParsed,
    mapOk,
    yandexMapsHref,
    applyPickedCoords,
    handleMapSearch,
    onRegionSelect,
    onCitySelect,
    onZoneSelect,
    catOpts,
    typeOpts,
    formatOpts,
    terrOpts,
    cascadedCityOpts,
    cascadedZoneOpts,
    prodCatOpts,
    salesOpts,
    logOpts,
    agentTeamSelectOptions,
    expeditorTeamSelectOptions,
    agentsPickerQ,
    expeditorsPickerQ,
    territoryAgentPickerCtxQ,
    onCancel,
    onSuccess,
  };
}
