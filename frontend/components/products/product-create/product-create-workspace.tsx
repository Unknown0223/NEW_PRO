"use client";

import { type FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { api } from "@/lib/api";
import {
  firstValidationUserHint,
  getZodFlattenFromApiErrorBody
} from "@/lib/api-validation-details";
import { getUserFacingError } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { ProductCreateGridForm } from "./product-create-grid-form";
import {
  buildProductCreatePayload,
  createPackage,
  emptyMasterData,
  initialProductCreateForm,
  validateProductCreate,
  type PackageCreateForm,
  type ProductCreateErrors,
  type ProductCreateForm,
  type ProductCreateMasterData,
  type RefOption
} from "./product-create-types";

type Props = {
  tenantSlug: string | null;
  backHref: string;
  onDone?: () => void;
};

type CatRow = { id: number; name: string; code: string | null };

function catalogQuery(tenantSlug: string, path: string, key: string) {
  return {
    queryKey: ["product-create-master", path, tenantSlug, key],
    staleTime: STALE.reference,
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", limit: "500", is_active: "true" });
      const { data } = await api.get<{ data: RefOption[] }>(
        `/api/${tenantSlug}/${path}?${params}`
      );
      return data.data ?? [];
    }
  };
}

export function ProductCreateWorkspace({ tenantSlug, backHref, onDone }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ProductCreateForm>(initialProductCreateForm);
  const [packages, setPackages] = useState<PackageCreateForm[]>([createPackage(1, true)]);
  const [errors, setErrors] = useState<ProductCreateErrors>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const catsQ = useQuery({
    queryKey: ["product-categories", tenantSlug, "product-create"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: CatRow[] }>(
        `/api/${tenantSlug}/product-categories`
      );
      return data.data;
    }
  });

  const groupsQ = useQuery({
    ...catalogQuery(tenantSlug ?? "", "catalog/product-groups", "groups"),
    enabled: Boolean(tenantSlug)
  });
  const brandsQ = useQuery({
    ...catalogQuery(tenantSlug ?? "", "catalog/brands", "brands"),
    enabled: Boolean(tenantSlug)
  });
  const segmentsQ = useQuery({
    ...catalogQuery(tenantSlug ?? "", "catalog/segments", "segments"),
    enabled: Boolean(tenantSlug)
  });
  const tradeDirsQ = useQuery({
    queryKey: ["trade-directions", tenantSlug, "product-create"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: RefOption[] }>(
        `/api/${tenantSlug}/trade-directions?is_active=true`
      );
      return data.data ?? [];
    }
  });

  const masterData: ProductCreateMasterData = useMemo(
    () => ({
      categories: (catsQ.data ?? []).map((c) => ({ id: c.id, name: c.name, code: c.code })),
      groups: groupsQ.data ?? [],
      brands: brandsQ.data ?? [],
      segments: segmentsQ.data ?? [],
      tradeDirections: tradeDirsQ.data ?? []
    }),
    [catsQ.data, groupsQ.data, brandsQ.data, segmentsQ.data, tradeDirsQ.data]
  );

  const loadingMasterData =
    catsQ.isLoading ||
    groupsQ.isLoading ||
    brandsQ.isLoading ||
    segmentsQ.isLoading ||
    tradeDirsQ.isLoading;

  const masterLoadFailed =
    catsQ.isError ||
    groupsQ.isError ||
    brandsQ.isError ||
    segmentsQ.isError ||
    tradeDirsQ.isError;

  function updateForm<K extends keyof ProductCreateForm>(key: K, value: ProductCreateForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function updatePackage<K extends keyof PackageCreateForm>(
    id: string,
    key: K,
    value: PackageCreateForm[K]
  ) {
    setPackages((current) =>
      current.map((item) => (item.id === id ? { ...item, [key]: value } : item))
    );
    setErrors((current) => ({ ...current, packages: undefined }));
  }

  function addPackage() {
    setPackages((current) => [...current, createPackage(current.length + 1)]);
  }

  function deletePackage(id: string) {
    setPackages((current) => {
      if (current.length === 1) return current;
      const deletedWasDefault = current.find((item) => item.id === id)?.default;
      const next = current.filter((item) => item.id !== id);
      if (deletedWasDefault && next[0]) {
        return next.map((item, index) => ({ ...item, default: index === 0 }));
      }
      return next;
    });
  }

  function selectDefaultPackage(id: string) {
    setPackages((current) => current.map((item) => ({ ...item, default: item.id === id })));
  }

  function resetForm() {
    setForm(initialProductCreateForm);
    setPackages([createPackage(1, true)]);
    setErrors({});
    setMessage(null);
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!tenantSlug) throw new Error("Tenant topilmadi");
      const payload = buildProductCreatePayload(form, packages);
      await api.post(`/api/${tenantSlug}/products`, payload);
    },
    onSuccess: async () => {
      const savedName = form.name.trim();
      setMessage({ type: "success", text: `Товар «${savedName}» сохранён.` });
      resetForm();
      await qc.invalidateQueries({ queryKey: ["products", tenantSlug] });
      onDone?.();
    },
    onError: (error: unknown) => {
      if (isAxiosError(error)) {
        const flat = getZodFlattenFromApiErrorBody(error.response?.data);
        if (flat) {
          const hint = firstValidationUserHint(flat);
          setMessage({
            type: "error",
            text: hint ? `Проверка: ${hint}` : getUserFacingError(error, "Ошибка сохранения")
          });
          return;
        }
      }
      setMessage({ type: "error", text: getUserFacingError(error, "Не удалось сохранить товар") });
    }
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const nextErrors = validateProductCreate(form, packages);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setMessage({ type: "error", text: "Заполните обязательные поля." });
      return;
    }
    saveMut.mutate();
  }

  if (!tenantSlug) {
    return (
      <p className="text-sm text-destructive">Сессия не найдена. Войдите снова.</p>
    );
  }

  return (
    <ProductCreateGridForm
      backHref={backHref}
      masterData={masterLoadFailed ? emptyMasterData : masterData}
      loadingMasterData={loadingMasterData}
      form={form}
      packages={packages}
      errors={errors}
      saving={saveMut.isPending}
      message={
        masterLoadFailed && !message
          ? { type: "error", text: "Справочники не загрузились. Проверьте подключение." }
          : message
      }
      onFormChange={updateForm}
      onPackageChange={updatePackage}
      onAddPackage={addPackage}
      onDeletePackage={deletePackage}
      onSelectDefaultPackage={selectDefaultPackage}
      onReset={resetForm}
      onSubmit={handleSubmit}
    />
  );
}
