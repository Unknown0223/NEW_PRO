import { formatMoney } from '../../utils/constants';

const stats = [
  { label: 'Бугунги савдо', value: 84_500_000, sub: '+12.4% от вчера', color: 'from-emerald-500 to-teal-600', icon: '💰' },
  { label: 'Буюртмалар', value: 142, sub: '17 в обработке', color: 'from-sky-500 to-indigo-600', icon: '🧾', plain: true },
  { label: 'Қайтарилган', value: 6_240_000, sub: '8 позиций', color: 'from-rose-500 to-pink-600', icon: '↩️' },
  { label: 'Омбордаги қолдиқ', value: 18_924, sub: '142 м³', color: 'from-amber-500 to-orange-600', icon: '📦', plain: true },
];

const topProducts = [
  { name: 'Lalaku TRUSIK N3.(60)', sold: 1240, sum: 65_720_000 },
  { name: 'Monno lipuchka mega N1', sold: 980, sum: 51_940_000 },
  { name: 'Arzon Lipuchka N2.(74)', sold: 870, sum: 46_110_000 },
  { name: 'Sof Anatomic (Lipuchka) N1', sold: 612, sum: 32_436_000 },
  { name: 'Yoyoki trusik N5', sold: 540, sum: 28_620_000 },
];

const sales7d = [38, 52, 47, 61, 70, 58, 84];

export function DashboardPage() {
  const max = Math.max(...sales7d);
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Дашборд</h1>
        <p className="text-sm text-slate-500 mt-1">Хуш келибсиз! Бугунги савдо ва омбор ҳолати.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-5 relative overflow-hidden">
            <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br ${s.color} opacity-10`} />
            <div className="text-3xl">{s.icon}</div>
            <div className="mt-3 text-sm text-slate-500">{s.label}</div>
            <div className="text-2xl font-bold text-slate-800 mt-1">
              {s.plain ? s.value.toLocaleString('ru-RU') : `${formatMoney(s.value)} so'm`}
            </div>
            <div className="text-xs text-emerald-600 mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sales chart */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Савдо динамикаси (7 кун)</h2>
            <select className="text-sm border border-slate-200 rounded-lg px-3 py-1.5">
              <option>7 кун</option>
              <option>30 кун</option>
              <option>90 кун</option>
            </select>
          </div>
          <div className="flex items-end gap-4 h-56 px-2">
            {sales7d.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="text-xs text-slate-500">{v}M</div>
                <div
                  className="w-full rounded-t-lg bg-gradient-to-t from-[color:var(--brand)] to-emerald-300 transition-all hover:opacity-80"
                  style={{ height: `${(v / max) * 85}%` }}
                />
                <div className="text-xs text-slate-400">{['Дш','Сш','Чш','Пш','Жм','Шб','Як'][i]}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Top products */}
        <div className="card p-5">
          <h2 className="font-semibold text-slate-800 mb-3">Топ маҳсулотлар</h2>
          <div className="space-y-3">
            {topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white
                  ${i===0?'bg-amber-400':i===1?'bg-slate-400':i===2?'bg-orange-400':'bg-slate-300'}`}>
                  {i+1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-700 truncate">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.sold} шт</div>
                </div>
                <div className="text-sm font-semibold text-slate-800">{formatMoney(p.sum)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent orders */}
      <div className="card p-5">
        <h2 className="font-semibold text-slate-800 mb-3">Сўнгги буюртмалар</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-left border-b border-slate-200">
                <th className="py-3 pl-2">ID</th>
                <th className="py-3">Клиент</th>
                <th className="py-3">Агент</th>
                <th className="py-3">Склад</th>
                <th className="py-3 text-right">Сумма</th>
                <th className="py-3">Статус</th>
                <th className="py-3">Дата</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['#10241','NODIRBEK-BIBISORA ORZULARI XK','SHUKUROV M.','Navoiy SKLAD',12_400_000,'Готов','21.05.2026'],
                ['#10240','ALISHER SAVDO MCHJ','KARIMOV B.','Tashkent CENTRAL',8_750_000,'В пути','21.05.2026'],
                ['#10239','GULNARA MARKET','TOSHEV U.','Samarkand SKLAD',5_280_000,'Новый','20.05.2026'],
                ['#10238','TASHKENT TRADE LLC','SHUKUROV M.','Tashkent CENTRAL',21_900_000,'Готов','20.05.2026'],
                ['#10237','SAMARKAND OPT BAZA','KARIMOV B.','Samarkand SKLAD',3_410_000,'Отменён','19.05.2026'],
              ].map((r) => (
                <tr key={r[0] as string} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 pl-2 font-medium text-slate-700">{r[0]}</td>
                  <td className="py-3 text-slate-700">{r[1]}</td>
                  <td className="py-3 text-slate-600">{r[2]}</td>
                  <td className="py-3 text-slate-600">{r[3]}</td>
                  <td className="py-3 text-right font-medium">{formatMoney(r[4] as number)} so'm</td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium
                      ${r[5]==='Готов'?'bg-emerald-100 text-emerald-700':
                        r[5]==='В пути'?'bg-sky-100 text-sky-700':
                        r[5]==='Новый'?'bg-amber-100 text-amber-700':
                        'bg-rose-100 text-rose-700'}`}>
                      {r[5]}
                    </span>
                  </td>
                  <td className="py-3 text-slate-500">{r[6]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
