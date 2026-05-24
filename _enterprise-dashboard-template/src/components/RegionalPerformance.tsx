import { useMemo, useState } from 'react'
import { useDashboardStore } from '../store/dashboardStore'
import { formatCurrency, formatNumber, formatPercent, getStatusColor } from '../utils/formatting'
import { Download, Search, MapPin, TrendingUp } from 'lucide-react'
import * as XLSX from 'xlsx'

export default function RegionalPerformance() {
  const data = useDashboardStore((state) => state.regionalPerformance)
  const exportLoading = useDashboardStore((state) => state.exportLoading)
  const setExportLoading = useDashboardStore((state) => state.setExportLoading)

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRegion, setSelectedRegion] = useState<string>('')

  const regions = useMemo(() => {
    return Array.from(new Set(data.map((d) => d.region)))
  }, [data])

  const filteredData = useMemo(() => {
    let result = [...data]

    if (selectedRegion) {
      result = result.filter((d) => d.region === selectedRegion)
    }

    if (searchTerm) {
      result = result.filter(
        (d) =>
          d.region.toLowerCase().includes(searchTerm.toLowerCase()) ||
          d.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
          d.zone.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    return result
  }, [data, searchTerm, selectedRegion])

  const regionSummary = useMemo(() => {
    const summary: { [key: string]: { sales: number; visits: number; orders: number; count: number } } = {}
    filteredData.forEach((d) => {
      if (!summary[d.region]) {
        summary[d.region] = { sales: 0, visits: 0, orders: 0, count: 0 }
      }
      summary[d.region].sales += d.totalSales
      summary[d.region].visits += d.visitCount
      summary[d.region].orders += d.orderCount
      summary[d.region].count++
    })
    return summary
  }, [filteredData])

  const handleExport = () => {
    setExportLoading('regional', true)
    setTimeout(() => {
      const ws = XLSX.utils.json_to_sheet(
        filteredData.map((row) => ({
          'Область': row.region,
          'Город': row.city,
          'Зона': row.zone,
          'Выручка': row.totalSales,
          'Посещения': row.visitCount,
          'Заказы': row.orderCount,
          'Выполнение %': row.completionRate,
          'Топ категория': row.topCategory,
        }))
      )
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Региональная производительность')
      XLSX.writeFile(wb, 'regional_performance.xlsx')
      setExportLoading('regional', false)
    }, 500)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-5 border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-slate-900">Региональная матрица</h2>
          </div>
          <button
            onClick={handleExport}
            disabled={exportLoading['regional']}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {exportLoading['regional'] ? 'Экспорт...' : 'Экспорт Excel'}
          </button>
        </div>

        {/* Region Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-4">
          {regions.map((region) => {
            const summary = regionSummary[region]
            return (
              <button
                key={region}
                onClick={() => setSelectedRegion(selectedRegion === region ? '' : region)}
                className={`p-3 rounded-lg border transition-all ${
                  selectedRegion === region
                    ? 'bg-indigo-50 border-indigo-300'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <p className="text-xs text-slate-500 mb-1">{region}</p>
                <p className="text-sm font-bold text-slate-900">{formatCurrency(summary.sales)}</p>
                <p className="text-xs text-slate-400">{summary.count} точек</p>
              </button>
            )
          })}
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Поиск по региону, городу, зоне..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto max-h-96">
        <table className="w-full">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Область</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Город</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Зона</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Выручка</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Посещения</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Заказы</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Выполнение</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Топ категория</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredData.map((row, index) => (
              <tr key={`${row.region}-${row.city}-${index}`} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <span className="text-sm font-medium text-slate-900">{row.region}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-slate-600">{row.city}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded">
                    {row.zone}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`text-sm font-semibold ${getStatusColor(row.completionRate)}`}>
                    {formatCurrency(row.totalSales)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-slate-600">{formatNumber(row.visitCount)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                    <span className="text-sm font-medium text-emerald-600">{formatNumber(row.orderCount)}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 bg-slate-200 rounded-full h-2">
                      <div
                        className={`${getStatusColor(row.completionRate).replace('text-', 'bg-')} h-2 rounded-full`}
                        style={{ width: `${row.completionRate}%` }}
                      />
                    </div>
                    <span className={`text-xs font-semibold ${getStatusColor(row.completionRate)}`}>
                      {formatPercent(row.completionRate, 0)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-slate-600">{row.topCategory}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
