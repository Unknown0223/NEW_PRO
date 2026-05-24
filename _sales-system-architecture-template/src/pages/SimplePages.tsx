import { formatMoney } from '../utils/constants';

export function GenericListPage({
  title,
  subtitle,
  columns,
  rows,
}: {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <input
            placeholder="Поиск..."
            className="flex-1 max-w-md px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand)]/15"
          />
          <button className="btn-primary !py-2">+ Добавить</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-left border-b border-slate-200">
                {columns.map((c) => <th key={c} className="py-3 pl-2 font-medium">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                  {r.map((cell, j) => (
                    <td key={j} className="py-3 pl-2 text-slate-700">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function OrdersListPage() {
  return (
    <GenericListPage
      title="Заявки"
      subtitle="Управление всеми буюртмалар"
      columns={['ID', 'Клиент', 'Агент', 'Склад', 'Сумма', 'Статус', 'Дата']}
      rows={[
        ['#10241','NODIRBEK-BIBISORA ORZULARI XK','SHUKUROV M.','Navoiy SKLAD',`${formatMoney(12400000)} so'm`,'Готов','21.05.2026'],
        ['#10240','ALISHER SAVDO MCHJ','KARIMOV B.','Tashkent CENTRAL',`${formatMoney(8750000)} so'm`,'В пути','21.05.2026'],
        ['#10239','GULNARA MARKET','TOSHEV U.','Samarkand SKLAD',`${formatMoney(5280000)} so'm`,'Новый','20.05.2026'],
        ['#10238','TASHKENT TRADE LLC','SHUKUROV M.','Tashkent CENTRAL',`${formatMoney(21900000)} so'm`,'Готов','20.05.2026'],
      ]}
    />
  );
}

export function ClientsPage() {
  return (
    <GenericListPage
      title="Клиенты"
      subtitle="База клиентов"
      columns={['Код', 'Название', 'Адрес', 'Телефон', 'Баланс', 'Менеджер']}
      rows={[
        ['CL-001','NODIRBEK-BIBISORA ORZULARI XK','Navoiy, ул. Mustaqillik 12','+998 90 123 45 67',`${formatMoney(2400000)} so'm`,'SHUKUROV M.'],
        ['CL-002','ALISHER SAVDO MCHJ','Tashkent, ул. Amir Temur 88','+998 90 234 56 78',`${formatMoney(0)} so'm`,'KARIMOV B.'],
        ['CL-003','GULNARA MARKET','Samarkand, ул. Registan 5','+998 90 345 67 89',`${formatMoney(380000)} so'm`,'TOSHEV U.'],
      ]}
    />
  );
}

export function WarehousePage() {
  return (
    <GenericListPage
      title="Склад"
      subtitle="Қолдиқлар ва ҳажм назорати"
      columns={['Артикул', 'Категория', 'Блок', 'Количество', 'Объем (м³)', 'Склад']}
      rows={[
        ['Arzon Lipuchka N1.(82)','Arzon Lipuchka',24,1968,'35.42','Navoiy SKLAD'],
        ['Arzon Lipuchka N2.(74)','Arzon Lipuchka',18,1332,'23.97','Navoiy SKLAD'],
        ['Lalaku TRUSIK N3.(60)','LALAKU TRUSIK',32,1920,'42.20','Tashkent CENTRAL'],
        ['Monno lipuchka mega N1','Monno lipuchka mega',12,480,'11.50','Samarkand SKLAD'],
      ]}
    />
  );
}

export function ReportsPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Отчёты</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { t: 'Кунлик савдо', v: `${formatMoney(84500000)} so'm`, c: 'from-emerald-500 to-teal-600' },
          { t: 'Ойлик савдо', v: `${formatMoney(1842000000)} so'm`, c: 'from-sky-500 to-indigo-600' },
          { t: 'Қайтарилган маҳсулот', v: `${formatMoney(38240000)} so'm`, c: 'from-rose-500 to-pink-600' },
        ].map((s) => (
          <div key={s.t} className="card p-5">
            <div className={`text-xs uppercase tracking-wide text-slate-500`}>{s.t}</div>
            <div className={`mt-2 text-2xl font-bold bg-gradient-to-r ${s.c} bg-clip-text text-transparent`}>{s.v}</div>
          </div>
        ))}
      </div>
      <div className="card p-5">
        <h2 className="font-semibold text-slate-800 mb-4">Категория бўйича таҳлил</h2>
        <div className="space-y-3">
          {[
            ['Arzon Lipuchka', 85],
            ['Lalaku TRUSIK', 72],
            ['Monno lipuchka mega', 64],
            ['Sof Anatomic', 53],
            ['Yoyoki trusik', 41],
            ['Dielux trusik', 28],
          ].map(([name, pct]) => (
            <div key={name as string}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-700">{name}</span>
                <span className="text-slate-500">{pct}%</span>
              </div>
              <div className="h-2 rounded bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[color:var(--brand)] to-emerald-400 rounded transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="p-6">
      <div className="card p-10 text-center">
        <div className="text-5xl mb-3">🚧</div>
        <h1 className="text-xl font-bold text-slate-800">{title}</h1>
        <p className="text-slate-500 mt-2 text-sm">Бу бўлим тез орада тайёр бўлади.</p>
      </div>
    </div>
  );
}
