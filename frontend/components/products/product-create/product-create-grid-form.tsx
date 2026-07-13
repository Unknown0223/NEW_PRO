"use client";

import { type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  DefaultPackageBadge,
  DeletePackageButton,
  GridMultiSelect,
  GridNumberInput,
  GridSelectInput,
  GridSwitch,
  GridTemplateSelect,
  GridTextInput,
  GridUnitSelect,
  LabelCell,
  VolumeInputs
} from "./product-create-grid-ui";
import type {
  PackageCreateForm,
  ProductCreateErrors,
  ProductCreateForm,
  ProductCreateMasterData
} from "./product-create-types";

type Props = {
  backHref: string;
  masterData: ProductCreateMasterData;
  loadingMasterData: boolean;
  form: ProductCreateForm;
  packages: PackageCreateForm[];
  errors: ProductCreateErrors;
  saving: boolean;
  message: { type: "success" | "error"; text: string } | null;
  onFormChange: <K extends keyof ProductCreateForm>(key: K, value: ProductCreateForm[K]) => void;
  onPackageChange: <K extends keyof PackageCreateForm>(
    id: string,
    key: K,
    value: PackageCreateForm[K]
  ) => void;
  onAddPackage: () => void;
  onDeletePackage: (id: string) => void;
  onSelectDefaultPackage: (id: string) => void;
  onReset: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function GridRow({
  label,
  product,
  packages
}: {
  label: ReactNode;
  product: ReactNode;
  packages: ReactNode[];
}) {
  return (
    <>
      <div className="sticky left-0 z-10 flex items-center border-r border-slate-200 bg-white pr-3">
        <LabelCell>{label}</LabelCell>
      </div>
      <div className="flex items-start">{product}</div>
      {packages.map((node, index) => (
        <div key={index} className="flex items-start">
          {node}
        </div>
      ))}
    </>
  );
}

export function ProductCreateGridForm({
  backHref,
  masterData,
  loadingMasterData,
  form,
  packages,
  errors,
  saving,
  message,
  onFormChange,
  onPackageChange,
  onAddPackage,
  onDeletePackage,
  onSelectDefaultPackage,
  onReset,
  onSubmit
}: Props) {
  return (
    <section className="flex min-w-0 flex-1 flex-col rounded-lg border border-border bg-white shadow-sm">
      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-4 pt-4">
          <div className="flex items-center gap-3">
            <Link
              href={backHref}
              className="grid h-11 w-11 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
              aria-label="Назад"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <p className="text-xs text-slate-400">Настройки / Продукты</p>
              <h1 className="text-2xl font-semibold text-slate-950">Добавление товара</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={onAddPackage}
            className="flex h-10 items-center gap-2 rounded-lg border border-[#07958f] bg-white px-4 text-sm font-semibold text-slate-900 transition hover:bg-[#f0fbfb]"
          >
            <Plus className="h-4 w-4" />
            Добавить еще
          </button>
        </div>

        {message ? (
          <div
            className={cn(
              "mx-6 mb-3 rounded-lg px-4 py-3 text-sm",
              message.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            )}
          >
            {message.text}
          </div>
        ) : null}

        {loadingMasterData ? (
          <div className="mx-6 mb-3 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Справочники загружаются...
          </div>
        ) : null}

        <div className="relative min-h-0 flex-1 overflow-auto">
          <div
            className="grid w-max px-3 pb-4"
            style={{
              gridTemplateColumns: `200px repeat(${packages.length + 1}, minmax(280px, 360px))`,
              columnGap: "12px",
              rowGap: "12px"
            }}
          >
            <div className="sticky left-0 z-20 flex items-end border-r border-slate-200 bg-white px-2 pt-3 pb-1 text-sm font-medium text-slate-700">
              Название
            </div>
            <div className="flex items-end px-2 pt-3 pb-1 text-sm font-medium text-slate-700">
              Шаблон
            </div>
            {packages.map((item, index) => (
              <div
                key={`${item.id}-header`}
                className="flex items-end justify-between px-2 pt-3 pb-1 text-sm font-medium text-slate-700"
              >
                <span>Объект {index + 1}</span>
                <DeletePackageButton
                  disabled={packages.length === 1}
                  onClick={() => onDeletePackage(item.id)}
                />
              </div>
            ))}

            <GridRow
              label="Название *"
              product={
                <GridTextInput
                  value={form.name}
                  onChange={(value) => onFormChange("name", value)}
                  placeholder="Название товара"
                  error={errors.name}
                />
              }
              packages={packages.map((item) => (
                <GridTextInput
                  key={`${item.id}-name`}
                  value={item.name}
                  onChange={(value) => onPackageChange(item.id, "name", value)}
                  placeholder="Название объекта"
                  error={!item.name.trim() && errors.packages ? "*" : undefined}
                  suffix={
                    <DefaultPackageBadge
                      active={item.default}
                      onClick={() => onSelectDefaultPackage(item.id)}
                    />
                  }
                />
              ))}
            />

            <GridRow
              label="Категория"
              product={
                <GridSelectInput
                  value={form.categoryId}
                  onChange={(value) => onFormChange("categoryId", value)}
                  options={masterData.categories}
                  placeholder="Выберите"
                  error={errors.categoryId}
                />
              }
              packages={packages.map((item) => (
                <GridTemplateSelect
                  key={`${item.id}-template`}
                  value={item.template}
                  onChange={(value) => onPackageChange(item.id, "template", value)}
                />
              ))}
            />

            <GridRow
              label="Название товар"
              product={
                <GridTextInput
                  value={form.productTitle}
                  onChange={(value) => onFormChange("productTitle", value)}
                  placeholder="Название товар"
                  suffix={<span className="text-[#07958f]">По умол. ☆</span>}
                />
              }
              packages={packages.map((item) => (
                <GridTextInput
                  key={`${item.id}-display`}
                  value={item.template}
                  onChange={(value) => onPackageChange(item.id, "template", value)}
                  placeholder="Шаблон / описание"
                  suffix={
                    <DefaultPackageBadge
                      active={item.default}
                      onClick={() => onSelectDefaultPackage(item.id)}
                    />
                  }
                />
              ))}
            />

            <GridRow
              label="Количества в блоке"
              product={
                <GridNumberInput
                  value={form.blockQuantity}
                  onChange={(value) => onFormChange("blockQuantity", value)}
                />
              }
              packages={packages.map((item) => (
                <GridNumberInput
                  key={`${item.id}-block`}
                  value={item.blockQuantity}
                  onChange={(value) => onPackageChange(item.id, "blockQuantity", value)}
                />
              ))}
            />

            <GridRow
              label="Код"
              product={
                <GridTextInput
                  value={form.code}
                  onChange={(value) => onFormChange("code", value.slice(0, 20))}
                  maxLength={20}
                  suffix={`${form.code.length} / 20`}
                />
              }
              packages={packages.map((item) => (
                <GridTextInput
                  key={`${item.id}-code`}
                  value={item.code}
                  onChange={(value) => onPackageChange(item.id, "code", value.slice(0, 20))}
                  maxLength={20}
                  suffix={`${item.code.length} / 20`}
                />
              ))}
            />

            <GridRow
              label="Единицы измерения"
              product={
                <GridUnitSelect
                  value={form.unit}
                  custom={form.unitCustom}
                  onChange={(value) => onFormChange("unit", value)}
                  onCustomChange={(value) => onFormChange("unitCustom", value)}
                  error={errors.unit}
                />
              }
              packages={packages.map((item) => (
                <div
                  key={`${item.id}-unit`}
                  className="flex h-10 items-center rounded-lg border border-dashed border-slate-200 px-3 text-sm text-slate-400"
                >
                  —
                </div>
              ))}
            />

            <GridRow
              label="Группа продуктов"
              product={
                <GridSelectInput
                  value={form.groupId}
                  onChange={(value) => onFormChange("groupId", value)}
                  options={masterData.groups}
                  placeholder="Выберите"
                />
              }
              packages={packages.map((item) => (
                <GridSelectInput
                  key={`${item.id}-group`}
                  value={item.groupId}
                  onChange={(value) => onPackageChange(item.id, "groupId", value)}
                  options={masterData.groups}
                  placeholder="Выберите"
                />
              ))}
            />

            <GridRow
              label="Направление торговли"
              product={
                <GridMultiSelect
                  value={form.tradeDirectionIds}
                  onChange={(value) => onFormChange("tradeDirectionIds", value)}
                  options={masterData.tradeDirections}
                  placeholder="Выберите"
                  error={errors.tradeDirectionIds}
                />
              }
              packages={packages.map((item) => (
                <GridMultiSelect
                  key={`${item.id}-trade`}
                  value={item.tradeDirectionIds}
                  onChange={(value) => onPackageChange(item.id, "tradeDirectionIds", value)}
                  options={masterData.tradeDirections}
                  placeholder="Выберите"
                />
              ))}
            />

            <GridRow
              label="Сегменты"
              product={
                <GridMultiSelect
                  value={form.segmentIds}
                  onChange={(value) => onFormChange("segmentIds", value)}
                  options={masterData.segments}
                  placeholder="Выберите"
                />
              }
              packages={packages.map((item) => (
                <GridMultiSelect
                  key={`${item.id}-segments`}
                  value={item.segmentIds}
                  onChange={(value) => onPackageChange(item.id, "segmentIds", value)}
                  options={masterData.segments}
                  placeholder="Выберите"
                />
              ))}
            />

            <GridRow
              label="Бранд"
              product={
                <GridSelectInput
                  value={form.brandId}
                  onChange={(value) => onFormChange("brandId", value)}
                  options={masterData.brands}
                  placeholder="Выберите"
                />
              }
              packages={packages.map((item) => (
                <GridSelectInput
                  key={`${item.id}-brand`}
                  value={item.brandId}
                  onChange={(value) => onPackageChange(item.id, "brandId", value)}
                  options={masterData.brands}
                  placeholder="Выберите"
                />
              ))}
            />

            <GridRow
              label="Штрих (Бар) код"
              product={
                <GridTextInput
                  value={form.barcode}
                  onChange={(value) => onFormChange("barcode", value)}
                />
              }
              packages={packages.map((item) => (
                <GridTextInput
                  key={`${item.id}-barcode`}
                  value={item.barcode}
                  onChange={(value) => onPackageChange(item.id, "barcode", value)}
                />
              ))}
            />

            <GridRow
              label="ТН ВЭД"
              product={
                <GridTextInput value={form.tnVed} onChange={(value) => onFormChange("tnVed", value)} />
              }
              packages={packages.map((item) => (
                <GridTextInput
                  key={`${item.id}-tnved`}
                  value={item.tnVed}
                  onChange={(value) => onPackageChange(item.id, "tnVed", value)}
                />
              ))}
            />

            <GridRow
              label="Статус"
              product={
                <div className="flex h-10 items-center">
                  <GridSwitch checked={form.status} onChange={(value) => onFormChange("status", value)} />
                </div>
              }
              packages={packages.map((item) => (
                <div key={`${item.id}-status`} className="flex h-10 items-center">
                  <GridSwitch
                    checked={item.status}
                    onChange={(value) => onPackageChange(item.id, "status", value)}
                  />
                </div>
              ))}
            />

            <GridRow
              label={
                <span className="flex items-center gap-2">
                  Объем
                  <span className="flex rounded-lg bg-[#07958f] p-1 text-xs font-semibold text-white">
                    <button
                      type="button"
                      onClick={() => onFormChange("volumeUnit", "m3")}
                      className={cn(
                        "rounded-md px-2 py-1",
                        form.volumeUnit === "m3" ? "bg-white text-[#057a76]" : "text-white"
                      )}
                    >
                      m3
                    </button>
                    <button
                      type="button"
                      onClick={() => onFormChange("volumeUnit", "cm3")}
                      className={cn(
                        "rounded-md px-2 py-1",
                        form.volumeUnit === "cm3" ? "bg-white text-[#057a76]" : "text-white"
                      )}
                    >
                      cm3
                    </button>
                  </span>
                </span>
              }
              product={
                <VolumeInputs
                  width={form.width}
                  height={form.height}
                  length={form.length}
                  onWidth={(value) => onFormChange("width", value)}
                  onHeight={(value) => onFormChange("height", value)}
                  onLength={(value) => onFormChange("length", value)}
                  unit={form.volumeUnit}
                />
              }
              packages={packages.map((item) => (
                <VolumeInputs
                  key={`${item.id}-volume`}
                  width={item.width}
                  height={item.height}
                  length={item.length}
                  onWidth={(value) => onPackageChange(item.id, "width", value)}
                  onHeight={(value) => onPackageChange(item.id, "height", value)}
                  onLength={(value) => onPackageChange(item.id, "length", value)}
                />
              ))}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-4 border-t border-slate-100 bg-white px-4 py-3">
          <button
            type="button"
            onClick={onReset}
            className="h-10 rounded-lg bg-slate-200 px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-300"
          >
            Отменить
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-10 rounded-lg bg-[#07958f] px-5 text-sm font-semibold text-white transition hover:bg-[#057a76] disabled:cursor-wait disabled:opacity-70"
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </form>
    </section>
  );
}
