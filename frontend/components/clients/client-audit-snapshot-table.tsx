"use client";

import {
  CLIENT_AUDIT_FIELD_ROWS,
  snapshotFieldLabel,
  type ClientAuditSnapshotColumn,
  type ClientTeamSnapshot
} from "@/lib/client-audit-history";

function TeamBlock({ title, team }: { title: string; team: ClientTeamSnapshot }) {
  return (
    <div className="py-1">
      <p className="text-slate-600">{title}:</p>
      {team.empty ? (
        <p className="text-slate-500">(Пусто)</p>
      ) : (
        <>
          {team.agent ? (
            <p className="text-slate-600">
              <span className="font-semibold text-slate-700">Агент:</span> {team.agent}
              {team.agentDays ? (
                <>
                  <br />
                  <span>({team.agentDays})</span>
                </>
              ) : null}
            </p>
          ) : null}
          {team.expeditor ? (
            <p className="text-slate-600">
              <span className="font-semibold text-slate-700">Экспедитор:</span> {team.expeditor}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

type Props = {
  clientName: string;
  createdBy: string;
  createdAtShort: string;
  columns: ClientAuditSnapshotColumn[];
};

export function ClientAuditSnapshotTable({ clientName, createdBy, createdAtShort, columns }: Props) {
  return (
    <div className="min-w-0 rounded-2xl bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 px-1">
        <h1 className="text-xl font-bold text-slate-800">История клиента: {clientName}</h1>
        <p className="text-lg font-medium text-teal-600">
          Создано: {createdBy} от {createdAtShort}
        </p>
      </div>

      <div className="audit-scroll min-w-0 overflow-x-auto pb-2">
        <table className="w-max min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-[260px] border border-slate-200 bg-white px-4 py-3 text-left font-normal text-slate-400">
                Дата
              </th>
              <th className="w-8 border border-slate-200 bg-white" aria-hidden />
              {columns.map((col) => (
                <th
                  key={col.id}
                  className="min-w-[240px] whitespace-nowrap border border-slate-200 bg-white px-4 py-3 text-left font-semibold text-teal-600"
                >
                  {col.date}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CLIENT_AUDIT_FIELD_ROWS.map((row, idx) => {
              const striped = idx % 2 === 1;
              return (
                <tr key={row.key} className={striped ? "bg-slate-50/70" : "bg-white"}>
                  <td
                    className={`sticky left-0 z-10 border border-slate-200 px-4 py-2.5 text-slate-400 ${
                      striped ? "bg-slate-50" : "bg-white"
                    }`}
                  >
                    {snapshotFieldLabel(row.key)}
                  </td>
                  <td className="border border-slate-200" />
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      className="border border-slate-200 px-4 py-2.5 text-slate-600"
                    >
                      {col.values[row.key] ?? ""}
                    </td>
                  ))}
                </tr>
              );
            })}

            <tr>
              <td className="sticky left-0 z-10 border border-slate-200 bg-white px-4 py-2.5 align-top text-slate-400">
                Команда
              </td>
              <td className="border border-slate-200" />
              {columns.map((col) => (
                <td key={col.id} className="border border-slate-200 px-4 py-2.5 align-top">
                  {col.team1 || col.team2 ? (
                    <div className="space-y-3">
                      {col.team1 ? (
                        <div className="border-b border-slate-100 pb-3">
                          <TeamBlock title="Команда 1" team={col.team1} />
                        </div>
                      ) : null}
                      {col.team2 ? <TeamBlock title="Команда 2" team={col.team2} /> : null}
                    </div>
                  ) : null}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
