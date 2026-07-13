"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterSelect } from "@/components/ui/filter-select";
import { FilterSearchableSelect } from "@/components/ui/filter-searchable-select";
import { AssignmentLockPanel } from "@/components/work-slots/assignment-lock-panel";
import { cn } from "@/lib/utils";
import { emptyAgentSlot, MAX_TEAM_ROWS, toggleWeekday, VISIT_DAYS } from "./client-edit-form.utils";
import { Caption, FieldHint, SpravochnikAdminLink, agentAssignmentsFieldHint } from "./client-edit-form-ui";
import { YandexCoordinatePicker } from "./yandex-coordinate-picker";
import type { ClientEditFormVm } from "./hooks/use-client-edit-form";

export function ClientEditFormMainTab({ vm }: { vm: ClientEditFormVm }) {
  const {
    tab,
    mutation,
    inputCls,
    selectCls,
    name, setName,
    legalName, setLegalName,
    address, setAddress,
    landmark, setLandmark,
    phone, setPhone,
    clientCode, setClientCode,
    responsiblePerson, setResponsiblePerson,
    isActive, setIsActive,
    notes, setNotes,
    fieldErrors,
    catOpts, typeOpts, formatOpts,
    category, setCategory,
    clientTypeCode, setClientTypeCode,
    clientFormat, setClientFormat,
    region, onRegionSelect,
    city, onCitySelect,
    zone, onZoneSelect,
    terrOpts, cascadedCityOpts, cascadedZoneOpts,
    street, setStreet,
    houseNumber, setHouseNumber,
    apartment, setApartment,
    gpsText, setGpsText,
    mapSearchText, setMapSearchText,
    mapSearchPending,
    handleMapSearch,
    mapSearchNotice,
    mapOk, latParsed, lonParsed,
    applyPickedCoords,
    latitude, setLatitude,
    longitude, setLongitude,
    setMapSearchNotice,
    yandexMapsHref,
    agentSlots, setAgentSlots,
    agentTeamSelectOptions,
    expeditorTeamSelectOptions,
    agentsPickerQ,
    expeditorsPickerQ,
    territoryAgentPickerCtxQ,
    isCreateMode,
    slot1LockType, setSlot1LockType,
    slot1LockReason, setSlot1LockReason
  } = vm;

  if (tab !== "main") return null;

  return (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)] xl:gap-8">
          <div className="flex flex-col gap-6">
            <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
              <Caption variant="write">Ввод с клавиатуры</Caption>
              <p className="mt-1 text-xs text-muted-foreground">
                Название, адрес, телефон и др. — вводятся напрямую.
              </p>
              <div className="mt-4 grid gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="ce-name">Название</Label>
                  <Input id="ce-name" value={name} onChange={(e) => setName(e.target.value)} disabled={mutation.isPending} />
                  <FieldHint name="name" errors={fieldErrors} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ce-legal">Юр. название / фирма</Label>
                  <Input
                    id="ce-legal"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    disabled={mutation.isPending}
                  />
                  <FieldHint name="legal_name" errors={fieldErrors} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ce-addr">Адрес</Label>
                  <Input id="ce-addr" value={address} onChange={(e) => setAddress(e.target.value)} disabled={mutation.isPending} />
                  <FieldHint name="address" errors={fieldErrors} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ce-land">Ориентир</Label>
                  <Input id="ce-land" value={landmark} onChange={(e) => setLandmark(e.target.value)} disabled={mutation.isPending} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="ce-phone">Телефон</Label>
                    <Input id="ce-phone" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={mutation.isPending} />
                    <FieldHint name="phone" errors={fieldErrors} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="ce-code">Код</Label>
                    <Input
                      id="ce-code"
                      maxLength={20}
                      value={clientCode}
                      onChange={(e) => setClientCode(e.target.value)}
                      disabled={mutation.isPending}
                    />
                    <span className="text-[10px] text-muted-foreground">{clientCode.length} / 20</span>
                    <FieldHint name="client_code" errors={fieldErrors} />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ce-contact">Контактное лицо</Label>
                  <Input
                    id="ce-contact"
                    placeholder="ФИО или краткая пометка"
                    value={responsiblePerson}
                    onChange={(e) => setResponsiblePerson(e.target.value)}
                    disabled={mutation.isPending}
                  />
                </div>
                <div className="flex items-center gap-2 rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-2">
                  <input
                    id="ce-active"
                    type="checkbox"
                    className="h-4 w-4 rounded border-input accent-primary"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    disabled={mutation.isPending}
                  />
                  <Label htmlFor="ce-active" className="font-normal">
                    Активный
                  </Label>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ce-notes">Примечание</Label>
                  <textarea
                    id="ce-notes"
                    className={`${inputCls} min-h-[100px] resize-y py-2.5`}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={mutation.isPending}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
              <Caption variant="pick">Справочники</Caption>
              <p className="mt-1 text-xs text-muted-foreground">
                Списки заполняет администратор в{" "}
                <SpravochnikAdminLink href="/settings/spravochnik/client-lists">справочниках клиента</SpravochnikAdminLink>{" "}
                (категория, район, махалля, зона, логистика и др.) и в{" "}
                <SpravochnikAdminLink href="/settings/territories">территориях компании</SpravochnikAdminLink>.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="mb-0">Категория</Label>
                    <SpravochnikAdminLink href="/settings/client-categories">Значения</SpravochnikAdminLink>
                  </div>
                  <FilterSelect
                    className={cn(selectCls, "min-w-0 max-w-none")}
                    emptyLabel="Категория"
                    aria-label="Категория"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    disabled={mutation.isPending}
                  >
                    {catOpts.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </FilterSelect>
                </div>
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="mb-0">Тип</Label>
                    <SpravochnikAdminLink href="/settings/client-types">Значения</SpravochnikAdminLink>
                  </div>
                  <FilterSelect
                    className={cn(selectCls, "min-w-0 max-w-none")}
                    emptyLabel="Тип"
                    aria-label="Тип"
                    value={clientTypeCode}
                    onChange={(e) => setClientTypeCode(e.target.value)}
                    disabled={mutation.isPending}
                  >
                    {typeOpts.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </FilterSelect>
                </div>
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="mb-0">Формат клиента</Label>
                    <SpravochnikAdminLink href="/settings/client-formats">Значения</SpravochnikAdminLink>
                  </div>
                  <FilterSelect
                    className={cn(selectCls, "min-w-0 max-w-none")}
                    emptyLabel="Формат клиента"
                    aria-label="Формат клиента"
                    value={clientFormat}
                    onChange={(e) => setClientFormat(e.target.value)}
                    disabled={mutation.isPending}
                  >
                    {formatOpts.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </FilterSelect>
                </div>
              </div>
            </section>

            <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
              <Caption>Адрес (детально, необязательно)</Caption>
              <p className="mt-1 text-xs text-muted-foreground">
                Список задаётся в{" "}
                <SpravochnikAdminLink href="/settings/spravochnik/client-lists#ref-city">справочниках клиента</SpravochnikAdminLink>
                ; значения из существующих клиентов тоже попадают в список. При выборе города область и зона подставляются из дерева
                территорий (если оно настроено).
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="mb-0">Область</Label>
                    <SpravochnikAdminLink href="/settings/territories">Территории</SpravochnikAdminLink>
                  </div>
                  <FilterSelect
                    id="ce-region"
                    className={cn(selectCls, "min-w-0 max-w-none")}
                    emptyLabel="Область"
                    aria-label="Область"
                    value={region}
                    onChange={(e) => onRegionSelect(e.target.value)}
                    disabled={mutation.isPending}
                  >
                    {terrOpts.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </FilterSelect>
                  <FieldHint name="region" errors={fieldErrors} />
                </div>
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="mb-0">Город</Label>
                    <SpravochnikAdminLink href="/settings/spravochnik/client-lists#ref-city">Значения</SpravochnikAdminLink>
                  </div>
                  <FilterSelect
                    id="ce-city"
                    className={cn(selectCls, "min-w-0 max-w-none")}
                    emptyLabel="Город"
                    aria-label="Город"
                    value={city}
                    onChange={(e) => onCitySelect(e.target.value)}
                    disabled={mutation.isPending}
                  >
                    {cascadedCityOpts.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </FilterSelect>
                  <FieldHint name="city" errors={fieldErrors} />
                </div>
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="mb-0">Зона</Label>
                    <SpravochnikAdminLink href="/settings/spravochnik/client-lists#ref-zone">Значения</SpravochnikAdminLink>
                  </div>
                  <FilterSelect
                    id="ce-zone"
                    className={cn(selectCls, "min-w-0 max-w-none")}
                    emptyLabel="Зона"
                    aria-label="Зона"
                    value={zone}
                    onChange={(e) => onZoneSelect(e.target.value)}
                    disabled={mutation.isPending}
                  >
                    {cascadedZoneOpts.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </FilterSelect>
                  <FieldHint name="zone" errors={fieldErrors} />
                  {territoryAgentPickerCtxQ.isError ? (
                    <p className="text-[11px] text-amber-700">
                      Не удалось подобрать агентов по территории. Сохранение клиента доступно; обновите страницу при
                      необходимости.
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="ce-str">Улица</Label>
                  <Input id="ce-str" value={street} onChange={(e) => setStreet(e.target.value)} disabled={mutation.isPending} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ce-house">Дом</Label>
                  <Input
                    id="ce-house"
                    value={houseNumber}
                    onChange={(e) => setHouseNumber(e.target.value)}
                    disabled={mutation.isPending}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ce-apt">Квартира</Label>
                  <Input
                    id="ce-apt"
                    value={apartment}
                    onChange={(e) => setApartment(e.target.value)}
                    disabled={mutation.isPending}
                  />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="ce-gps">Текст GPS</Label>
                  <Input id="ce-gps" value={gpsText} onChange={(e) => setGpsText(e.target.value)} disabled={mutation.isPending} />
                </div>
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-6">
            <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
              <Caption variant="write">Карта</Caption>
              <p className="mt-1 text-xs text-muted-foreground">
                Kartada nuqtani bevosita bosib tanlashingiz mumkin. Qidiruv maydoni Telegram/Google/Yandex linki, lat/lon juftligi
                yoki oddiy manzil matnini qabul qiladi.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <Input
                  className={cn(inputCls, "sm:flex-1")}
                  placeholder="Manzil yoki lokatsiya (41.31, 69.27 | Google/Telegram link)"
                  value={mapSearchText}
                  onChange={(e) => setMapSearchText(e.target.value)}
                  disabled={mutation.isPending || mapSearchPending}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    void handleMapSearch();
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="h-10 shrink-0 sm:w-auto"
                  disabled={mutation.isPending || mapSearchPending || !mapSearchText.trim()}
                  onClick={() => void handleMapSearch()}
                >
                  {mapSearchPending ? "Qidirilmoqda..." : "Topish / Qo‘llash"}
                </Button>
              </div>
              {mapSearchNotice ? <p className="mt-2 text-xs text-amber-600">{mapSearchNotice}</p> : null}
              <div className="relative mt-3 overflow-hidden rounded-lg border bg-muted/30">
                <YandexCoordinatePicker
                  lat={mapOk ? latParsed : null}
                  lon={mapOk ? lonParsed : null}
                  disabled={mutation.isPending}
                  onPick={applyPickedCoords}
                />
                {!mapOk ? (
                  <div className="pointer-events-none absolute bottom-2 left-2 right-2 rounded-md bg-background/95 px-2 py-1.5 text-center text-[11px] text-muted-foreground shadow-sm ring-1 ring-border/60">
                    Nuqtani xaritadan bosing yoki yuqoridagi maydonga koordinata/link/manzil qo‘ying
                  </div>
                ) : null}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label htmlFor="ce-lat">Широта</Label>
                  <Input
                    id="ce-lat"
                    inputMode="decimal"
                    value={latitude}
                    onChange={(e) => {
                      setLatitude(e.target.value);
                      setMapSearchNotice(null);
                    }}
                    disabled={mutation.isPending}
                  />
                  <FieldHint name="latitude" errors={fieldErrors} />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="ce-lon">Долгота</Label>
                  <Input
                    id="ce-lon"
                    inputMode="decimal"
                    value={longitude}
                    onChange={(e) => {
                      setLongitude(e.target.value);
                      setMapSearchNotice(null);
                    }}
                    disabled={mutation.isPending}
                  />
                  <FieldHint name="longitude" errors={fieldErrors} />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLatitude("");
                    setLongitude("");
                    setMapSearchNotice(null);
                  }}
                  disabled={mutation.isPending}
                >
                  Очистить координаты
                </Button>
                <a
                  href={yandexMapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-primary underline-offset-4 hover:underline"
                >
                  {mapOk ? "Открыть на полной карте" : "Яндекс.Карты (новая вкладка)"}
                </a>
              </div>
            </section>

            <div id="ce-team-block" className="rounded-lg border bg-card p-4 shadow-sm">
              <Caption variant="pick">
                Команда (агент / доставщик — в разделе пользователей)
              </Caption>
              <p className="mt-1 text-xs text-muted-foreground">
                Можно добавить несколько команд подряд (макс. {MAX_TEAM_ROWS}).
              </p>
              {territoryAgentPickerCtxQ.data?.territory_matched ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Списки агента и доставщика ограничены территорией по адресу (область / город / зона) или точке на
                  карте — только пользователи, привязанные к этой территории в разделе территорий; уже выбранные в
                  командах остаются в списке.
                </p>
              ) : null}
              {(() => {
                const teamErr = agentAssignmentsFieldHint(fieldErrors);
                return teamErr ? (
                  <p className="mt-2 text-xs text-destructive" role="alert">
                    {teamErr}
                  </p>
                ) : null;
              })()}
              <div className="mt-3 space-y-3">
                {agentSlots.map((slot, idx) => (
                  <div key={idx} className="rounded-md border bg-background p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Команда {idx + 1}</span>
                      {agentSlots.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          disabled={mutation.isPending}
                          onClick={() => {
                            setAgentSlots((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
                          }}
                        >
                          Удалить
                        </Button>
                      ) : null}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-1.5">
                        <Label className="text-xs">Агент</Label>
                        <FilterSearchableSelect
                          className={cn(selectCls, "min-w-0 max-w-none")}
                          emptyLabel="Агент"
                          value={slot.agentId}
                          options={agentTeamSelectOptions}
                          onValueChange={(v) => {
                            const next = [...agentSlots];
                            next[idx] = { ...next[idx], agentId: v };
                            setAgentSlots(next);
                          }}
                          disabled={mutation.isPending || agentsPickerQ.isPending}
                          searchPlaceholder="Поиск: логин, ФИО"
                          emptyMessage="Нет вариантов"
                          minPopoverWidth={320}
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label className="text-xs">Доставщик</Label>
                        <FilterSearchableSelect
                          className={cn(selectCls, "min-w-0 max-w-none")}
                          emptyLabel="Доставщик"
                          value={slot.expeditorUserId}
                          options={expeditorTeamSelectOptions}
                          onValueChange={(v) => {
                            const next = [...agentSlots];
                            next[idx] = { ...next[idx], expeditorUserId: v };
                            setAgentSlots(next);
                          }}
                          disabled={mutation.isPending || expeditorsPickerQ.isPending}
                          searchPlaceholder="Поиск: логин, ФИО"
                          emptyMessage="Нет вариантов"
                          minPopoverWidth={320}
                        />
                      </div>
                    </div>
                    <div className="mt-3">
                      <Label className="text-xs text-muted-foreground">День посещения (неделя)</Label>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {VISIT_DAYS.map(({ k, l }) => (
                          <label key={k} className="flex cursor-pointer items-center gap-1.5 text-xs">
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 rounded border-input accent-primary"
                              checked={slot.weekdays.includes(k)}
                              onChange={() => {
                                const next = [...agentSlots];
                                next[idx] = { ...next[idx], weekdays: toggleWeekday(next[idx], k) };
                                setAgentSlots(next);
                              }}
                              disabled={mutation.isPending}
                            />
                            {l}
                          </label>
                        ))}
                      </div>
                    </div>
                    {idx === 0 && !isCreateMode ? (
                      <div className="mt-3">
                        <AssignmentLockPanel
                          lockType={slot1LockType}
                          lockReason={slot1LockReason}
                          onLockTypeChange={setSlot1LockType}
                          onLockReasonChange={setSlot1LockReason}
                          disabled={mutation.isPending}
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={mutation.isPending || agentSlots.length >= MAX_TEAM_ROWS}
                  onClick={() => setAgentSlots((prev) => (prev.length >= MAX_TEAM_ROWS ? prev : [...prev, emptyAgentSlot()]))}
                >
                  Добавить
                </Button>
              </div>
            </div>
          </div>
        </div>
  );
}
