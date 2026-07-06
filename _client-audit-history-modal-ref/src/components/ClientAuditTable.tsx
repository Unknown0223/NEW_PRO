import {
  AUDIT_META,
  FIELD_ROWS,
  SNAPSHOT_COLUMNS,
  type TeamInfo,
} from "../data/auditTable";

function TeamBlock({ title, team }: { title: string; team: TeamInfo }) {
  return (
    <div className="py-1">
      <p className="text-slate-600">{title}:</p>
      {team.empty ? (
        <p className="text-slate-500">(Пусто)</p>
      ) : (
        <>
          {team.agent && (
            <p className="text-slate-600">
              <span className="font-semibold text-slate-700">Агент:</span> {team.agent}
              {team.agentDays && (
                <>
                  <br />
                  <span>({team.agentDays})</span>
                </>
              )}
            </p>
          )}
          {team.expeditor && (
            <p className="text-slate-600">
              <span className="font-semibold text-slate-700">Экспедитор:</span> {team.expeditor}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function ClientAuditTable() {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 px-1">
        <h1 className="text-xl font-bold text-slate-800">
          История клиента: {AUDIT_META.clientName}
        </h1>
        <p className="text-lg font-medium text-teal-600">
          Создано: {AUDIT_META.createdBy} от {AUDIT_META.createdAt}
        </p>
      </div>

      {/* Table */}
      <div className="audit-scroll overflow-x-auto pb-2">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-[260px] border border-slate-200 bg-white px-4 py-3 text-left font-normal text-slate-400">
                Дата
              </th>
              <th className="w-8 border border-slate-200 bg-white" />
              {SNAPSHOT_COLUMNS.map((col) => (
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
            {FIELD_ROWS.map((row, idx) => {
              const striped = idx % 2 === 1;
              return (
                <tr key={row.key} className={striped ? "bg-slate-50/70" : "bg-white"}>
                  <td
                    className={`sticky left-0 z-10 border border-slate-200 px-4 py-2.5 text-slate-400 ${
                      striped ? "bg-slate-50" : "bg-white"
                    }`}
                  >
                    {row.label}
                  </td>
                  <td className="border border-slate-200" />
                  {SNAPSHOT_COLUMNS.map((col) => (
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

            {/* Команда row */}
            <tr>
              <td className="sticky left-0 z-10 border border-slate-200 bg-white px-4 py-2.5 align-top text-slate-400">
                Команда
              </td>
              <td className="border border-slate-200" />
              {SNAPSHOT_COLUMNS.map((col) => (
                <td key={col.id} className="border border-slate-200 px-4 py-2.5 align-top">
                  {col.team1 || col.team2 ? (
                    <div className="space-y-3">
                      {col.team1 && (
                        <div className="border-b border-slate-100 pb-3">
                          <TeamBlock title="Команда 1" team={col.team1} />
                        </div>
                      )}
                      {col.team2 && <TeamBlock title="Команда 2" team={col.team2} />}
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
