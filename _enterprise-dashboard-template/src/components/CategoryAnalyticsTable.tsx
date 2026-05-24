import { useMemo } from 'react'
import { useDashboardStore } from '../store/dashboardStore'
import { formatCurrency, formatNumber, formatPercent } from '../utils/formatting'
import { TrendingUp, Package, Users, Download } from 'lucide-react'
import * as XLSX from 'xlsx'

export default function CategoryAnalyticsTable() {
  const data = useDashboardStore((state) => state.categoryAnalytics)
  const exportLoading = useDashboardStore((state) => state.exportLoading)
  const setExportLoading = useDashboardStore((state) => state.setExportLoading)

  const totalSales = useMemo(() => {
    return data.reduce((sum, item) => sum + item.salesAmount, 0)
  }, [data])

  const handleExport = () => {
    setExportLoading('categories', true)
    setTimeout(() => {
      const ws = XLSX.utils.json_to_sheet(
        data.map((item) => ({
          'Категория': item.category,
          'Доля (%)': item.sharePercent,
          'Сумма (KZT)': item.salesAmount,
          'Объем': item.volume,
          'АКБ': item.akb,
        }))
      )
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Категории')
      XLSX.writeFile(wb, 'category_analytics.xlsx')
      setExportLoading('categories', false)
    }, 500)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-5 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-900">Аналитика по категориям</h2>
        </div>
        <button
          onClick={handleExport}
          disabled={exportLoading['categories']}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {exportLoading['categories'] ? 'Экспорт...' : 'Экспорт Excel'}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                #
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                По категории продуктов
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Доля
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Сумма
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Объем
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">
                АКБ
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {data.map((item, index) => (
              <tr key={item.category} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-4 text-sm text-slate-500">{index + 1}</td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-sm font-medium text-slate-900">{item.category}</span>
                  </div>
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-indigo-500 h-2 rounded-full"
                        style={{ width: `${item.sharePercent}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-slate-900 w-12">
                      {formatPercent(item.sharePercent)}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-4 text-right">
                  <span className="text-sm font-semibold text-slate-900">
                    {formatCurrency(item.salesAmount)}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  <span className="text-sm text-slate-600">{formatNumber(item.volume)}</span>
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Users className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm font-medium text-emerald-600">
                      {formatNumber(item.akb)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50">
            <tr>
              <td colSpan={2} className="px-5 py-3 text-sm font-semibold text-slate-700">
                ИТОГО
              </td>
              <td className="px-5 py-3 text-right text-sm font-semibold text-slate-700">
                100%
              </td>
              <td className="px-5 py-3 text-right text-sm font-bold text-indigo-600">
                {formatCurrency(totalSales)}
              </td>
              <td className="px-5 py-3 text-right text-sm text-slate-600">
                {formatNumber(data.reduce((sum, item) => sum + item.volume, 0))}
              </td>
              <td className="px-5 py-3 text-right text-sm text-slate-600">
                {formatNumber(data.reduce((sum, item) => sum + item.akb, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
