"use client";

import { GroupedNumberInput } from "@/components/ui/grouped-number-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterSelect } from "@/components/ui/filter-select";
import { cn } from "@/lib/utils";
import { Caption, FieldHint, SpravochnikAdminLink } from "./client-edit-form-ui";
import type { ClientEditFormVm } from "./hooks/use-client-edit-form";

export function ClientEditFormExtraTab({ vm }: { vm: ClientEditFormVm }) {
  const {
    tab,
    mutation,
    selectCls,
    productCategoryRef, setProductCategoryRef,
    salesChannel, setSalesChannel,
    prodCatOpts, salesOpts,
    creditLimit, setCreditLimit,
    logisticsService, setLogisticsService,
    logOpts,
    licenseUntil, setLicenseUntil,
    workingHours, setWorkingHours,
    inn, setInn,
    pdl, setPdl,
    bankName, setBankName,
    bankAccount, setBankAccount,
    bankMfo, setBankMfo,
    clientPinfl, setClientPinfl,
    oked, setOked,
    contractNumber, setContractNumber,
    vatRegCode, setVatRegCode,
    fieldErrors,
    inputCls
  } = vm;

  if (tab !== "extra") return null;

  return (
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
            <Caption variant="pick">Выбор из справочника</Caption>
            <p className="mt-1 text-xs text-muted-foreground">
              Значения создаются в разделе{" "}
              <SpravochnikAdminLink href="/settings/spravochnik/client-lists#ref-prod-cat">
                справочники клиента
              </SpravochnikAdminLink>
              .
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="mb-0">Категория продукта</Label>
                  <SpravochnikAdminLink href="/settings/spravochnik/client-lists#ref-prod-cat">Значения</SpravochnikAdminLink>
                </div>
                <FilterSelect
                  className={cn(selectCls, "min-w-0 max-w-none")}
                  emptyLabel="Категория продукта"
                  aria-label="Категория продукта"
                  value={productCategoryRef}
                  onChange={(e) => setProductCategoryRef(e.target.value)}
                  disabled={mutation.isPending}
                >
                  {prodCatOpts.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </FilterSelect>
              </div>
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="mb-0">Канал продаж</Label>
                  <SpravochnikAdminLink href="/settings/spravochnik/client-lists#ref-sales">Значения</SpravochnikAdminLink>
                </div>
                <FilterSelect
                  className={cn(selectCls, "min-w-0 max-w-none")}
                  emptyLabel="Канал продаж"
                  aria-label="Канал продаж"
                  value={salesChannel}
                  onChange={(e) => setSalesChannel(e.target.value)}
                  disabled={mutation.isPending}
                >
                  {salesOpts.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </FilterSelect>
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-card p-4 shadow-sm">
            <Caption variant="write">Ввод с клавиатуры</Caption>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="ce-bank">Bank</Label>
                <Input id="ce-bank" value={bankName} onChange={(e) => setBankName(e.target.value)} disabled={mutation.isPending} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ce-rs">Расчётный счёт</Label>
                <Input
                  id="ce-rs"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  disabled={mutation.isPending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ce-mfo">MFO</Label>
                <Input id="ce-mfo" value={bankMfo} onChange={(e) => setBankMfo(e.target.value)} disabled={mutation.isPending} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ce-inn">INN</Label>
                <Input id="ce-inn" value={inn} onChange={(e) => setInn(e.target.value)} disabled={mutation.isPending} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ce-pinfl">JSHSHIR / PINFL</Label>
                <Input
                  id="ce-pinfl"
                  inputMode="numeric"
                  value={clientPinfl}
                  onChange={(e) => setClientPinfl(e.target.value)}
                  disabled={mutation.isPending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ce-oked">OKED / OKONH</Label>
                <Input id="ce-oked" value={oked} onChange={(e) => setOked(e.target.value)} disabled={mutation.isPending} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ce-contract">Договор №</Label>
                <Input
                  id="ce-contract"
                  value={contractNumber}
                  onChange={(e) => setContractNumber(e.target.value)}
                  disabled={mutation.isPending}
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="ce-vat">Код регистрации по НДС</Label>
                <Input
                  id="ce-vat"
                  value={vatRegCode}
                  onChange={(e) => setVatRegCode(e.target.value)}
                  disabled={mutation.isPending}
                />
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-card p-4 shadow-sm">
            <Caption>Прочее (ввод или выбор)</Caption>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="grid gap-1.5">
                <div className="flex min-h-5 items-center">
                  <Label htmlFor="ce-credit" className="mb-0">
                    Кредитный лимит (UZS)
                  </Label>
                </div>
                <GroupedNumberInput
                  id="ce-credit"
                  className={inputCls}
                  maxFractionDigits={2}
                  value={creditLimit}
                  onValueChange={setCreditLimit}
                  disabled={mutation.isPending}
                />
                <FieldHint name="credit_limit" errors={fieldErrors} />
              </div>
              <div className="grid gap-1.5">
                <div className="flex min-h-5 items-center justify-between gap-2">
                  <Label className="mb-0">Логистическая услуга</Label>
                  <SpravochnikAdminLink href="/settings/spravochnik/client-lists#ref-logistics">Значения</SpravochnikAdminLink>
                </div>
                <FilterSelect
                  className={cn(selectCls, "min-w-0 max-w-none")}
                  emptyLabel="Логистическая услуга"
                  aria-label="Логистическая услуга"
                  value={logisticsService}
                  onChange={(e) => setLogisticsService(e.target.value)}
                  disabled={mutation.isPending}
                >
                  {logOpts.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </FilterSelect>
              </div>
              <div className="grid gap-1.5">
                <div className="flex min-h-5 items-center">
                  <Label htmlFor="ce-lic" className="mb-0">
                    Срок лицензии
                  </Label>
                </div>
                <Input
                  id="ce-lic"
                  className={inputCls}
                  type="date"
                  value={licenseUntil}
                  onChange={(e) => setLicenseUntil(e.target.value)}
                  disabled={mutation.isPending}
                />
              </div>
              <div className="grid gap-1.5">
                <div className="flex min-h-5 items-center">
                  <Label htmlFor="ce-wh" className="mb-0">
                    Часы работы
                  </Label>
                </div>
                <Input
                  id="ce-wh"
                  className={inputCls}
                  value={workingHours}
                  onChange={(e) => setWorkingHours(e.target.value)}
                  disabled={mutation.isPending}
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2 lg:col-span-4">
                <Label htmlFor="ce-pdl">P-D-L</Label>
                <Input id="ce-pdl" className={inputCls} value={pdl} onChange={(e) => setPdl(e.target.value)} disabled={mutation.isPending} />
              </div>
            </div>
          </section>
        </div>
  );
}
