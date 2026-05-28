"use client";

import type { ExpeditorLoading520Preview } from "@/lib/expeditor-loading-520-preview";
import { cn } from "@/lib/utils";
import { Fragment } from "react";

const th =
  "border border-gray-400 bg-[#d9d9d9] px-1.5 py-1 text-center text-[11px] font-semibold text-gray-900";
const td =
  "border border-gray-400 px-1.5 py-0.5 text-[11px] text-gray-900 align-middle";
const groupBg = "bg-[#e9ceff]";

export function NakladnoyPreview520Body({ data }: { data: ExpeditorLoading520Preview }) {
  const { meta } = data;
  return (
    <div className="min-w-[min(100%,640px)] space-y-3 text-gray-900">
      <h2 className="text-center text-sm font-bold leading-snug">{data.title}</h2>

      <table className="w-full max-w-xl border-collapse text-[11px]">
        <tbody>
          <tr>
            <td className="py-0.5 pr-2 font-medium text-gray-700">Дата заказа:</td>
            <td>{meta.dateOrder}</td>
          </tr>
          <tr>
            <td className="py-0.5 pr-2 font-medium text-gray-700">Дата отгрузки:</td>
            <td>{meta.dateShip ?? "—"}</td>
          </tr>
          <tr>
            <td className="py-0.5 pr-2 font-medium text-gray-700">Торговый представитель:</td>
            <td>{meta.agents}</td>
            {meta.agentPhonesVisible ? (
              <td className="py-0.5 pl-4 font-medium text-gray-700">
                Телефон: <span className="font-normal">{meta.agentPhones}</span>
              </td>
            ) : null}
          </tr>
          <tr>
            <td className="py-0.5 pr-2 font-medium text-gray-700">Территория:</td>
            <td colSpan={meta.agentPhonesVisible ? 2 : 1}>{meta.territory}</td>
          </tr>
          {meta.expeditorVisible ? (
            <tr>
              <td className="py-0.5 pr-2 font-medium text-gray-700">Экспедитор:</td>
              <td colSpan={2}>{meta.expeditor}</td>
            </tr>
          ) : null}
          <tr>
            <td className="py-0.5 pr-2 font-medium text-gray-700">Валюта:</td>
            <td colSpan={2}>{meta.currency}</td>
          </tr>
        </tbody>
      </table>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr>
              <th className={cn(th, "w-8")}>№</th>
              <th className={cn(th, "min-w-[72px]")} colSpan={2}>
                Код
              </th>
              <th className={cn(th, "min-w-[180px]")}>Продукт</th>
              <th className={cn(th, "w-14")}>Кол-во</th>
              <th className={cn(th, "w-14")}>Бонус</th>
              <th className={cn(th, "w-16")}>Цена</th>
              <th className={cn(th, "w-20")}>Сумма</th>
            </tr>
          </thead>
          <tbody>
            {data.groups.map((g) => (
              <Fragment key={g.name}>
                <tr className={groupBg}>
                  <td className={td} />
                  <td className={td} colSpan={2} />
                  <td className={cn(td, "font-bold")}>{g.name}</td>
                  <td className={cn(td, "text-right font-bold tabular-nums")}>
                    {g.qty > 0 ? g.qty : ""}
                  </td>
                  <td className={cn(td, "text-right font-bold tabular-nums")}>
                    {g.bonus > 0 ? g.bonus : ""}
                  </td>
                  <td className={td} />
                  <td className={cn(td, "text-right font-bold tabular-nums")}>{g.sum}</td>
                </tr>
                {g.lines.map((ln) => (
                  <tr key={`${g.name}-${ln.num}`}>
                    <td className={cn(td, "text-center tabular-nums")}>{ln.num}</td>
                    <td className={cn(td, "font-mono text-[10px]")} colSpan={2}>
                      {ln.code}
                    </td>
                    <td className={td}>{ln.name}</td>
                    <td className={cn(td, "text-right tabular-nums")}>{ln.qty ?? ""}</td>
                    <td className={cn(td, "text-right tabular-nums")}>{ln.bonus ?? ""}</td>
                    <td className={cn(td, "text-right tabular-nums")}>{ln.price}</td>
                    <td className={cn(td, "text-right tabular-nums")}>{ln.sum}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
            <tr className="bg-gray-100 font-bold">
              <td className={cn(td, "font-bold")} colSpan={4}>
                Итого
              </td>
              <td className={cn(td, "text-right font-bold tabular-nums")}>{data.totals.qty}</td>
              <td className={cn(td, "text-right font-bold tabular-nums")}>{data.totals.bonus}</td>
              <td className={cn(td, "text-right font-bold tabular-nums")} colSpan={2}>
                {data.totals.sum}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-8 pt-6 text-[11px] text-gray-700">
        <div>
          <div className="font-medium">Складчик:</div>
          <div className="mt-8 border-b border-gray-400" />
        </div>
        <div>
          <div className="font-medium">Доставщик:</div>
          <div className="mt-8 border-b border-gray-400" />
        </div>
      </div>
    </div>
  );
}
