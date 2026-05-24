import { useState } from 'react'
import {
  LayoutDashboard, ShoppingCart, Users, FileText, CreditCard,
  Package, Truck, Calendar, BarChart3, FileBarChart, UserCog,
  Search, Settings, Shield, ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  Filter, SlidersHorizontal, RotateCw, FileSpreadsheet, ArrowUpDown,
  ChevronDown, ChevronUp, Info, TrendingUp, DollarSign
} from 'lucide-react'

interface CategoryRow {
  id: string
  name: string
  share: number
  amount: number
  volume: number
  akb: number
}

interface DailyVisitRow {
  id: string
  agentName: string
  agentCode: string
  planTotal: number
  planVisited: number
  planMissed: number
  planOrderSum: number
  planOrderQty: number
  planNoOrder: number
  planMissedOrderSum: number
  planMissedOrderQty: number
  photo: number
  unplannedVisited: number
  unplannedOrderSum: number
  unplannedOrderQty: number
  unplannedNoOrder: number
  unplannedMissedOrderSum: number
  unplannedMissedOrderQty: number
}

interface EfficiencyRow {
  id: string
  agentName: string
  agentCode: string
  orderSum: number
  orders: number
  canceled: number
  plannedVisits: number
  refusals: number
  missedTT: number
  visitPercent: number
  photos: number
  photoCount: number
}

interface ProductSalesRow {
  id: string
  agentName: string
  total: number
  categories: { [key: string]: number }
}

const mockCategories: CategoryRow[] = [
  { id: '1', name: 'Prokladki', share: 25.7, amount: 143596100, volume: 0, akb: 537 },
  { id: '2', name: 'LALAKU TRUSIK 2026', share: 11.63, amount: 628189600, volume: 0, akb: 228 },
  { id: '3', name: 'Maska', share: 11.47, amount: 9583000, volume: 0, akb: 7 },
  { id: '4', name: 'Monno trusik mini', share: 9.25, amount: 221040000, volume: 0, akb: 260 },
  { id: '5', name: 'Lalaku ECONOM (trusik) 2026', share: 8.5, amount: 577212500, volume: 0, akb: 138 },
  { id: '6', name: 'LALAKU GIGA', share: 4.68, amount: 292200000, volume: 0, akb: 161 },
  { id: '7', name: 'Arzon Trusik', share: 4.15, amount: 111465000, volume: 0, akb: 64 },
  { id: '8', name: 'Monno trusik mega', share: 2.85, amount: 152240000, volume: 0, akb: 92 },
  { id: '9', name: 'Econom lipuchka', share: 2.36, amount: 148069050, volume: 0, akb: 85 },
  { id: '10', name: 'Reverem SB 0.5L', share: 2.1, amount: 10850000, volume: 0, akb: 50 },
  { id: '11', name: 'Reverem (banochniy)', share: 1.89, amount: 7568000, volume: 0, akb: 31 },
  { id: '12', name: 'Arzon Lipuchka', share: 1.72, amount: 46260000, volume: 0, akb: 49 },
  { id: '13', name: 'Ejednevka', share: 1.72, amount: 13542500, volume: 0, akb: 83 },
  { id: '14', name: 'Monno lipuchka', share: 1.47, amount: 35005600, volume: 0, akb: 81 },
  { id: '15', name: 'Yoyoki trusik', share: 1.47, amount: 12707000, volume: 0, akb: 113 },
]

const mockDailyVisits: DailyVisitRow[] = [
  {
    id: '1', agentName: '01 (ELDAR) GGTSH005- [ATAMUXAMEDOV TIMUR] (CHILONZOR) TTTT 09/03/26',
    agentCode: 'GGTSH005', planTotal: 91, planVisited: 1, planMissed: 90,
    planOrderSum: 0, planOrderQty: 0, planNoOrder: 0,
    planMissedOrderSum: 0, planMissedOrderQty: 0,
    photo: 1, unplannedVisited: 8, unplannedOrderSum: 735000, unplannedOrderQty: 2,
    unplannedNoOrder: 0, unplannedMissedOrderSum: 0, unplannedMissedOrderQty: 0,
  },
  {
    id: '2', agentName: '01 - GGAN002 - (SH) [MAMADJANOVA BADALISHOIM] AAAA 14/03/26',
    agentCode: 'GGAN002', planTotal: 58, planVisited: 6, planMissed: 52,
    planOrderSum: 0, planOrderQty: 0, planNoOrder: 0,
    planMissedOrderSum: 0, planMissedOrderQty: 0,
    photo: 7, unplannedVisited: 16, unplannedOrderSum: 190000, unplannedOrderQty: 1,
    unplannedNoOrder: 0, unplannedMissedOrderSum: 0, unplannedMissedOrderQty: 0,
  },
  {
    id: '3', agentName: '01 - GGFA002 - (R) [TESHABOYEVA MASHXURA] AAAA 10/09',
    agentCode: 'GGFA002', planTotal: 165, planVisited: 11, planMissed: 154,
    planOrderSum: 0, planOrderQty: 0, planNoOrder: 0,
    planMissedOrderSum: 0, planMissedOrderQty: 0,
    photo: 11, unplannedVisited: 17, unplannedOrderSum: 0, unplannedOrderQty: 0,
    unplannedNoOrder: 0, unplannedMissedOrderSum: 0, unplannedMissedOrderQty: 0,
  },
  {
    id: '4', agentName: '01 - GGJZ001 - (A) [VAKANT] AAAA 04/01/26',
    agentCode: 'GGJZ001', planTotal: 237, planVisited: 4, planMissed: 233,
    planOrderSum: 4050000, planOrderQty: 4, planNoOrder: 0,
    planMissedOrderSum: 0, planMissedOrderQty: 0,
    photo: 4, unplannedVisited: 0, unplannedOrderSum: 0, unplannedOrderQty: 0,
    unplannedNoOrder: 0, unplannedMissedOrderSum: 0, unplannedMissedOrderQty: 0,
  },
  {
    id: '5', agentName: '01 - GGNM002 - (S) [ERGASHOV UMAR] AAAA 15/01/26',
    agentCode: 'GGNM002', planTotal: 69, planVisited: 21, planMissed: 48,
    planOrderSum: 0, planOrderQty: 0, planNoOrder: 0,
    planMissedOrderSum: 0, planMissedOrderQty: 0,
    photo: 21, unplannedVisited: 0, unplannedOrderSum: 0, unplannedOrderQty: 0,
    unplannedNoOrder: 0, unplannedMissedOrderSum: 0, unplannedMissedOrderQty: 0,
  },
  {
    id: '6', agentName: '01 - GGNS002 - (G) [KALBAYEVA BAXITLI] AAAA 02/03/26',
    agentCode: 'GGNS002', planTotal: 99, planVisited: 26, planMissed: 73,
    planOrderSum: 0, planOrderQty: 0, planNoOrder: 1,
    planMissedOrderSum: 0, planMissedOrderQty: 0,
    photo: 26, unplannedVisited: 0, unplannedOrderSum: 0, unplannedOrderQty: 0,
    unplannedNoOrder: 0, unplannedMissedOrderSum: 0, unplannedMissedOrderQty: 0,
  },
  {
    id: '7', agentName: '01 - GGNV002 - (U) [KOMILJONOV KOMILJON] AAAA 06/08',
    agentCode: 'GGNV002', planTotal: 187, planVisited: 17, planMissed: 170,
    planOrderSum: 0, planOrderQty: 0, planNoOrder: 0,
    planMissedOrderSum: 0, planMissedOrderQty: 0,
    photo: 22, unplannedVisited: 0, unplannedOrderSum: 0, unplannedOrderQty: 0,
    unplannedNoOrder: 0, unplannedMissedOrderSum: 0, unplannedMissedOrderQty: 0,
  },
  {
    id: '8', agentName: '01 - GGXM001 - (S) [VAKANT] AAAA 12/05',
    agentCode: 'GGXM001', planTotal: 698, planVisited: 21, planMissed: 676,
    planOrderSum: 0, planOrderQty: 0, planNoOrder: 0,
    planMissedOrderSum: 0, planMissedOrderQty: 0,
    photo: 22, unplannedVisited: 0, unplannedOrderSum: 0, unplannedOrderQty: 0,
    unplannedNoOrder: 0, unplannedMissedOrderSum: 0, unplannedMissedOrderQty: 0,
  },
  {
    id: '9', agentName: '01 - KZX001 - [SHIMKENT SVR] 08/10',
    agentCode: 'KZX001', planTotal: 1, planVisited: 0, planMissed: 1,
    planOrderSum: 0, planOrderQty: 0, planNoOrder: 0,
    planMissedOrderSum: 0, planMissedOrderQty: 0,
    photo: 0, unplannedVisited: 0, unplannedOrderSum: 0, unplannedOrderQty: 0,
    unplannedNoOrder: 0, unplannedMissedOrderSum: 0, unplannedMissedOrderQty: 0,
  },
  {
    id: '10', agentName: '01 - MRBZ001 - [MARG\'ILON KOMBINAT] AAAA',
    agentCode: 'MRBZ001', planTotal: 94, planVisited: 0, planMissed: 94,
    planOrderSum: 0, planOrderQty: 0, planNoOrder: 0,
    planMissedOrderSum: 0, planMissedOrderQty: 0,
    photo: 0, unplannedVisited: 0, unplannedOrderSum: 0, unplannedOrderQty: 0,
    unplannedNoOrder: 0, unplannedMissedOrderSum: 0, unplannedMissedOrderQty: 0,
  },
]

const mockEfficiency: EfficiencyRow[] = [
  { id: '1', agentName: '01 (ELDAR) GGTSH005- [ATAMUXAMEDOV TIMUR] (CHILONZOR) TTTT 09/03/26', agentCode: 'GGTSH005', orderSum: 405000, orders: 1, canceled: 1, plannedVisits: 91, refusals: 0, missedTT: 90, visitPercent: 1, photos: 9, photoCount: 9 },
  { id: '2', agentName: '01 - GGAN002 - (SH) [MAMADJANOVA BADALISHOIM] AAAA 14/03/26', agentCode: 'GGAN002', orderSum: 190000, orders: 1, canceled: 0, plannedVisits: 58, refusals: 22, missedTT: 52, visitPercent: 10, photos: 25, photoCount: 25 },
  { id: '3', agentName: '01 - GGFA002 - (R) [TESHABOYEVA MASHXURA] AAAA 10/09', agentCode: 'GGFA002', orderSum: 0, orders: 0, canceled: 0, plannedVisits: 165, refusals: 28, missedTT: 154, visitPercent: 6, photos: 28, photoCount: 28 },
  { id: '4', agentName: '01 - GGJZ001 - (A) [VAKANT] AAAA 04/01/26', agentCode: 'GGJZ001', orderSum: 4050000, orders: 4, canceled: 0, plannedVisits: 237, refusals: 0, missedTT: 233, visitPercent: 1, photos: 4, photoCount: 4 },
  { id: '5', agentName: '01 - GGNM002 - (S) [ERGASHOV UMAR] AAAA 15/01/26', agentCode: 'GGNM002', orderSum: 0, orders: 0, canceled: 0, plannedVisits: 69, refusals: 21, missedTT: 48, visitPercent: 30, photos: 21, photoCount: 21 },
  { id: '6', agentName: '01 - GGNS002 - (G) [KALBAYEVA BAXITLI] AAAA 02/03/26', agentCode: 'GGNS002', orderSum: 0, orders: 0, canceled: 1, plannedVisits: 99, refusals: 0, missedTT: 73, visitPercent: 26, photos: 26, photoCount: 26 },
  { id: '7', agentName: '01 - GGNV002 - (U) [KOMILJONOV KOMILJON] AAAA 06/08', agentCode: 'GGNV002', orderSum: 0, orders: 0, canceled: 0, plannedVisits: 187, refusals: 22, missedTT: 170, visitPercent: 9, photos: 22, photoCount: 22 },
  { id: '8', agentName: '01 - GGXM001 - (S) [VAKANT] AAAA 12/05', agentCode: 'GGXM001', orderSum: 0, orders: 0, canceled: 0, plannedVisits: 698, refusals: 0, missedTT: 676, visitPercent: 3, photos: 22, photoCount: 22 },
  { id: '9', agentName: '01 - KZX001 - [SHIMKENT SVR] 08/10', agentCode: 'KZX001', orderSum: 0, orders: 0, canceled: 0, plannedVisits: 1, refusals: 0, missedTT: 1, visitPercent: 0, photos: 0, photoCount: 0 },
  { id: '10', agentName: '01 - MRBZ001 - [MARG\'ILON KOMBINAT] AAAA', agentCode: 'MRBZ001', orderSum: 0, orders: 0, canceled: 0, plannedVisits: 94, refusals: 0, missedTT: 94, visitPercent: 0, photos: 0, photoCount: 0 },
]

const productCategories = [
  'Super anatomic Giga', 'Anatomic (Lipuchka)', '2-SORT', 'Arzon Lipuchka', 'Arzon Trusik',
  'Barberry', 'Bonus', 'Dielux lipuchka', 'Dielux trusik', 'DRY (Qo\'ltiq qistirma)',
  'Econom lipuchka', 'Ejednevka', 'Giga Eski', 'Grudnoy', 'Jonny Eski', 'Jonny Trusik', 'Jonny Ultra'
]

const mockProductSales: ProductSalesRow[] = [
  { id: '1', agentName: '01 (ELDAR) GGTSH005- [ATAMUXAMEDOV TIMUR] (CHILONZOR) TTTT 09/03/26', total: 405000, categories: {} },
  { id: '2', agentName: '01 - GGAN002 - (SH) [MAMADJANOVA BADALISHOIM] AAAA 14/03/26', total: 190000, categories: {} },
  { id: '3', agentName: '01 - GGJZ001 - (A) [VAKANT] AAAA 04/01/26', total: 4050000, categories: {} },
  { id: '4', agentName: '01 (A) -GGKK002- [SHAMSIDDINOV XAMIDJON] (БЕШАРИК) AAAA 12/07', total: 4050000, categories: { 'Econom lipuchka': 810000 } },
  { id: '5', agentName: '02 - GGAN003 - (SH) [ATAMIRZAYEV ZARDOBJON] AAAA', total: 405000, categories: {} },
]

const navItems = [
  { icon: LayoutDashboard, label: 'Дашборды', hasSub: true },
  { icon: ShoppingCart, label: 'Заявки', hasSub: true },
  { icon: Users, label: 'Клиенты', hasSub: true },
  { icon: FileText, label: 'Накладные', hasSub: true },
  { icon: CreditCard, label: 'Касса', hasSub: true },
  { icon: Package, label: 'Склад', hasSub: true },
  { icon: Truck, label: 'Поставщики', hasSub: true },
  { icon: Calendar, label: 'Планы', hasSub: true },
  { icon: BarChart3, label: 'Отчёт', hasSub: true },
  { icon: FileBarChart, label: 'Pivot отчёты', hasSub: true },
  { icon: UserCog, label: 'Пользователи', hasSub: true },
  { icon: Shield, label: 'Аудит', hasSub: true },
  { icon: Users, label: 'Доступ', hasSub: false },
  { icon: Settings, label: 'Настройки', hasSub: false },
]

const formatNumber = (n: number) => n.toLocaleString('ru-RU')

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeNav, setActiveNav] = useState(0)
  const [date, setDate] = useState('2026-04-01')
  const [categoryTab, setCategoryTab] = useState('category')
  const [efficiencyTab, setEfficiencyTab] = useState('agents')
  const [categoryExpanded, setCategoryExpanded] = useState(true)
  const [dailyExpanded, setDailyExpanded] = useState(true)
  const [efficiencyExpanded, setEfficiencyExpanded] = useState(true)
  const [productSalesExpanded, setProductSalesExpanded] = useState(true)
  const [productSalesTab, setProductSalesTab] = useState('sum')
  const [productSalesSubTab, setProductSalesSubTab] = useState('agents')
  const [searchCategory, setSearchCategory] = useState('')
  const [searchDaily, setSearchDaily] = useState('')
  const [searchEfficiency, setSearchEfficiency] = useState('')
  const [searchProductSales, setSearchProductSales] = useState('')
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [efficiencyRowsPerPage, setEfficiencyRowsPerPage] = useState(10)
  const [productSalesRowsPerPage, setProductSalesRowsPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [efficiencyPage, setEfficiencyPage] = useState(1)
  const [productSalesPage, setProductSalesPage] = useState(1)

  const [paymentMethod, setPaymentMethod] = useState('')
  const [agent, setAgent] = useState('')
  const [supervisor, setSupervisor] = useState('')
  const [tradeDirection, setTradeDirection] = useState('')
  const [customerCategory, setCustomerCategory] = useState('')
  const [zone, setZone] = useState('')
  const [region, setRegion] = useState('')
  const [city, setCity] = useState('')

  const filteredCategories = mockCategories.filter(r => r.name.toLowerCase().includes(searchCategory.toLowerCase()))
  const filteredDaily = mockDailyVisits.filter(r => r.agentName.toLowerCase().includes(searchDaily.toLowerCase()))
  const filteredEfficiency = mockEfficiency.filter(r => r.agentName.toLowerCase().includes(searchEfficiency.toLowerCase()))
  const filteredProductSales = mockProductSales.filter(r => r.agentName.toLowerCase().includes(searchProductSales.toLowerCase()))

  const totalPages = Math.ceil(filteredDaily.length / rowsPerPage)
  const efficiencyTotalPages = Math.ceil(filteredEfficiency.length / efficiencyRowsPerPage)
  const productSalesTotalPages = Math.ceil(filteredProductSales.length / productSalesRowsPerPage)
  const paginatedDaily = filteredDaily.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)
  const paginatedEfficiency = filteredEfficiency.slice((efficiencyPage - 1) * efficiencyRowsPerPage, efficiencyPage * efficiencyRowsPerPage)
  const paginatedProductSales = filteredProductSales.slice((productSalesPage - 1) * productSalesRowsPerPage, productSalesPage * productSalesRowsPerPage)

  const totalOrderSum = mockEfficiency.reduce((s, r) => s + r.orderSum, 0)
  const totalOrders = mockEfficiency.reduce((s, r) => s + r.orders, 0)
  const totalCanceled = mockEfficiency.reduce((s, r) => s + r.canceled, 0)
  const totalPlanned = mockEfficiency.reduce((s, r) => s + r.plannedVisits, 0)
  const totalRefusals = mockEfficiency.reduce((s, r) => s + r.refusals, 0)
  const totalMissed = mockEfficiency.reduce((s, r) => s + r.missedTT, 0)
  const totalPhotos = mockEfficiency.reduce((s, r) => s + r.photos, 0)

  const dateDisplay = new Date(date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')

  const sidebarBg = '#0f2d2d'
  const sidebarActive = '#1e5050'
  const primary = '#2a9d8f'

  return (
    <div className="flex h-screen bg-[#f0f2f5] overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-60' : 'w-[68px]'} flex flex-col transition-all duration-300 shrink-0`} style={{ backgroundColor: sidebarBg }}>
        <div className="p-4 flex items-center justify-between border-b border-white/10">
          {sidebarOpen && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/30">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <span className="text-white font-bold text-sm">FMCG ERP</span>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <ChevronLeft className={`h-4 w-4 text-gray-400 transition-transform ${!sidebarOpen && 'rotate-180'}`} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {navItems.map((item, i) => (
            <button
              key={i}
              onClick={() => setActiveNav(i)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                activeNav === i
                  ? 'text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
              style={activeNav === i ? { backgroundColor: sidebarActive, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' } : {}}
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" style={{ width: 18, height: 18 }} />
              {sidebarOpen && (
                <>
                  <span className="flex-1 text-left font-medium">{item.label}</span>
                  {item.hasSub && <ChevronRight className="h-3 w-3 opacity-60" />}
                </>
              )}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200/60 px-6 py-3 flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer">
            <span className="text-xs">🌐</span> GPS
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer">
            🔖 Избранные страницы <ChevronDown className="h-3 w-3" />
          </div>
          <div className="flex-1" />
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white text-sm font-bold cursor-pointer shadow-md shadow-teal-500/30">
            А
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Title + Date Picker */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Дашбоард - Супервайзер</h1>
              <p className="text-sm text-gray-500 mt-0.5">Аналитика и мониторинг торговых агентов</p>
            </div>
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm">
              <CalendarIcon className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-500 font-medium">Дата</span>
              <div className="flex items-center gap-1 ml-2 bg-gray-50 rounded-lg px-1">
                <button className="p-1.5 hover:bg-white rounded-md transition-colors" onClick={() => { const d = new Date(date); d.setDate(d.getDate() - 1); setDate(d.toISOString().split('T')[0]); }}>
                  <ChevronLeft className="h-4 w-4 text-gray-600" />
                </button>
                <span className="text-sm font-semibold text-gray-800 min-w-[110px] text-center px-2">{dateDisplay}</span>
                <button className="p-1.5 hover:bg-white rounded-md transition-colors" onClick={() => { const d = new Date(date); d.setDate(d.getDate() + 1); setDate(d.toISOString().split('T')[0]); }}>
                  <ChevronRight className="h-4 w-4 text-gray-600" />
                </button>
              </div>
              <button className="p-1.5 bg-gray-100 rounded-lg ml-1 hover:bg-gray-200 transition-colors">
                <SlidersHorizontal className="h-4 w-4 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm">
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Способ оплаты', value: paymentMethod, setter: setPaymentMethod, options: ['Наличные', 'Терминал', 'Банковский перевод', 'Тенге'] },
                { label: 'Агент', value: agent, setter: setAgent, options: ['Алиев А.', 'Иванов П.', 'Петров С.'] },
                { label: 'Супервайзеры', value: supervisor, setter: setSupervisor, options: ['Смирнов К.', 'Васильев А.'] },
                { label: 'Направление торговли', value: tradeDirection, setter: setTradeDirection, options: ['Опт', 'Розница', 'HoReCa'] },
                { label: 'Категория клиента', value: customerCategory, setter: setCustomerCategory, options: ['Категория А', 'Категория Б'] },
                { label: 'Зона', value: zone, setter: setZone, options: ['Центральная', 'Северная', 'Южная'] },
                { label: 'Область', value: region, setter: setRegion, options: ['Алматы', 'Астана', 'Шымкент'] },
              ].map((f, i) => (
                <div key={i} className="relative">
                  <select value={f.value} onChange={e => f.setter(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-gray-50/50 hover:bg-gray-50 transition-all appearance-none cursor-pointer">
                    <option value="">{f.label}</option>
                    {f.options.map(o => <option key={o}>{o}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <div className="relative w-48">
                <select value={city} onChange={e => setCity(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-gray-50/50 hover:bg-gray-50 transition-all appearance-none cursor-pointer">
                  <option value="">Город</option>
                  <option>Алматы</option>
                  <option>Астана</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
              <div className="flex items-center gap-3">
                <button className="p-2.5 rounded-xl text-white transition-all hover:shadow-lg hover:shadow-teal-500/30" style={{ backgroundColor: primary }}>
                  <Filter className="h-4 w-4" />
                </button>
                <button className="px-8 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:shadow-lg hover:shadow-teal-500/30" style={{ backgroundColor: primary }}>
                  Применить
                </button>
              </div>
            </div>
          </div>

          {/* Financial KPIs */}
          <div className="grid grid-cols-5 gap-4">
            {[
              { title: 'Общая сумма', value: '2 738 000 125', suffix: 'UZS', gradient: 'from-teal-500 to-emerald-600', icon: DollarSign },
              { title: 'Банковский перевод', value: '94 416 100', suffix: 'Pereches', gradient: 'from-emerald-400 to-green-500', icon: CreditCard },
              { title: 'Наличные', value: '2 336 984 700', suffix: 'naqd', gradient: 'from-amber-400 to-orange-500', icon: DollarSign },
              { title: 'Наличные деньги Тенге', value: '83 010', suffix: 'tenge', gradient: 'from-purple-400 to-violet-500', icon: DollarSign },
              { title: 'Терминал', value: '304 524 075', suffix: 'terminal', gradient: 'from-blue-400 to-indigo-500', icon: CreditCard },
            ].map((card, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 group">
                <div className={`bg-gradient-to-r ${card.gradient} px-4 py-2.5 flex items-center justify-between`}>
                  <span className="text-white text-sm font-semibold">{card.title}</span>
                  <card.icon className="h-4 w-4 text-white/80" />
                </div>
                <div className="p-4">
                  <div className="text-lg font-bold text-gray-800 group-hover:scale-105 transition-transform origin-left">
                    {card.value} <span className="text-sm font-normal text-gray-500">{card.suffix}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Visit KPIs */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { title: 'Посещения (по визитам)', percent: '10 %', plan: '95 015', fact: '9 920', color: 'red', borderColor: 'border-red-300', bg: 'bg-red-50', percentColor: 'text-red-500' },
              { title: 'Успешные визиты', percent: '100 %', plan: '9 920', fact: '9 920', color: 'emerald', borderColor: 'border-emerald-400', bg: 'bg-emerald-50', percentColor: 'text-emerald-600' },
              { title: 'Посещения (по GPS)', percent: '34 %', plan: '9 920', fact: '3 384', color: 'pink', borderColor: 'border-pink-400', bg: 'bg-pink-50', percentColor: 'text-pink-500' },
              { title: 'Фото отчеты', percent: '100 %', plan: '9 920', fact: '9 932', color: 'emerald', borderColor: 'border-emerald-400', bg: 'bg-emerald-50', percentColor: 'text-emerald-600' },
            ].map((card, i) => (
              <div key={i} className={`rounded-2xl border-2 ${card.borderColor} ${card.bg} p-5 hover:shadow-lg transition-all duration-300`}>
                <div className="text-sm text-gray-600 font-medium mb-3">{card.title}</div>
                <div className={`text-3xl font-bold ${card.percentColor} mb-4`}>{card.percent}</div>
                <div className="flex justify-between text-sm bg-white/60 rounded-xl p-3">
                  <div>
                    <div className="text-gray-400 text-xs mb-0.5">План</div>
                    <div className="font-bold text-gray-800">{card.plan}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-gray-400 text-xs mb-0.5">Факт</div>
                    <div className="font-bold text-gray-800">{card.fact}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Key Indicators - Category Analytics */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <button onClick={() => setCategoryExpanded(!categoryExpanded)} className="flex items-center gap-3 group">
                <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center group-hover:bg-teal-100 transition-colors">
                  {categoryExpanded ? <ChevronUp className="h-4 w-4 text-teal-600" /> : <ChevronDown className="h-4 w-4 text-teal-600" />}
                </div>
                <h2 className="text-lg font-bold text-gray-800">Ключевые показатели</h2>
              </button>
              <div className="flex bg-gray-100 rounded-xl p-1">
                {[
                  { key: 'category', label: 'По категории продуктов' },
                  { key: 'group', label: 'По группам товаров' },
                  { key: 'brand', label: 'По брендам' },
                ].map(tab => (
                  <button key={tab.key} onClick={() => setCategoryTab(tab.key)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                      categoryTab === tab.key
                        ? 'bg-white text-teal-700 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            {categoryExpanded && (
              <div className="p-5">
                <div className="flex items-center gap-3 mb-5">
                  <button className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"><ArrowUpDown className="h-4 w-4 text-gray-500" /></button>
                  <button className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"><SlidersHorizontal className="h-4 w-4 text-gray-500" /></button>
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input type="text" placeholder="Поиск..." value={searchCategory} onChange={e => setSearchCategory(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-gray-50/50" />
                  </div>
                  <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition-colors font-medium">
                    <FileSpreadsheet className="h-4 w-4 text-green-600" /> Excel
                  </button>
                  <button className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"><RotateCw className="h-4 w-4 text-gray-500" /></button>
                </div>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/80">
                        <th className="px-5 py-3.5 text-left font-semibold text-gray-600 text-xs uppercase tracking-wider">По категории продуктов</th>
                        <th className="px-5 py-3.5 text-right font-semibold text-gray-600 text-xs uppercase tracking-wider">Доля</th>
                        <th className="px-5 py-3.5 text-right font-semibold text-gray-600 text-xs uppercase tracking-wider">Сумма</th>
                        <th className="px-5 py-3.5 text-right font-semibold text-gray-600 text-xs uppercase tracking-wider">Объем</th>
                        <th className="px-5 py-3.5 text-right font-semibold text-gray-600 text-xs uppercase tracking-wider">АКБ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredCategories.map((row) => (
                        <tr key={row.id} className="hover:bg-teal-50/40 transition-colors">
                          <td className="px-5 py-3.5 font-medium text-gray-800">{row.name}</td>
                          <td className="px-5 py-3.5 text-right text-gray-600">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 font-semibold text-xs">{row.share}%</span>
                          </td>
                          <td className="px-5 py-3.5 text-right font-semibold text-gray-800">{formatNumber(row.amount)}</td>
                          <td className="px-5 py-3.5 text-right text-gray-500">{row.volume}</td>
                          <td className="px-5 py-3.5 text-right">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-semibold text-xs">
                              <Users className="h-3 w-3" /> {row.akb}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Daily Visit Report */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <button onClick={() => setDailyExpanded(!dailyExpanded)} className="flex items-center gap-3 group">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                  {dailyExpanded ? <ChevronUp className="h-4 w-4 text-blue-600" /> : <ChevronDown className="h-4 w-4 text-blue-600" />}
                </div>
                <h2 className="text-lg font-bold text-gray-800">Дневной отчет по визитам</h2>
              </button>
            </div>
            {dailyExpanded && (
              <div className="p-5">
                <div className="flex items-center gap-3 mb-5">
                  <select value={rowsPerPage} onChange={e => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                    className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-gray-50/50">
                    <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option>
                  </select>
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input type="text" placeholder="Поиск..." value={searchDaily} onChange={e => setSearchDaily(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-gray-50/50" />
                  </div>
                  <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition-colors font-medium">
                    <FileSpreadsheet className="h-4 w-4 text-green-600" /> Excel
                  </button>
                  <button className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"><RotateCw className="h-4 w-4 text-gray-500" /></button>
                </div>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th rowSpan={3} className="border border-gray-200 px-3 py-3 bg-gray-50 text-left font-semibold text-gray-600 min-w-[220px]">Агент</th>
                        <th colSpan={9} className="border border-gray-200 px-3 py-2 bg-emerald-50 text-center font-semibold text-emerald-700 text-xs">По плану</th>
                        <th rowSpan={3} className="border border-gray-200 px-3 py-3 bg-gray-50 text-center font-semibold text-gray-600">Фото</th>
                        <th colSpan={8} className="border border-gray-200 px-3 py-2 bg-rose-50 text-center font-semibold text-rose-700 text-xs">Вне плана</th>
                      </tr>
                      <tr>
                        <th rowSpan={2} className="border border-gray-200 px-2 py-2 bg-gray-50/50 text-center font-semibold text-gray-600">План</th>
                        <th rowSpan={2} className="border border-gray-200 px-2 py-2 bg-gray-50/50 text-center font-semibold text-gray-600">Посещено</th>
                        <th rowSpan={2} className="border border-gray-200 px-2 py-2 bg-gray-50/50 text-center font-semibold text-gray-600">Непосещено</th>
                        <th colSpan={3} className="border border-gray-200 px-2 py-2 bg-gray-50/50 text-center font-semibold text-gray-600">Посещено</th>
                        <th colSpan={2} className="border border-gray-200 px-2 py-2 bg-gray-50/50 text-center font-semibold text-gray-600">Непосещено</th>
                        <th rowSpan={2} className="border border-gray-200 px-2 py-2 bg-gray-50/50 text-center font-semibold text-gray-600">Посещено</th>
                        <th colSpan={3} className="border border-gray-200 px-2 py-2 bg-gray-50/50 text-center font-semibold text-gray-600">Посещено</th>
                        <th colSpan={2} className="border border-gray-200 px-2 py-2 bg-gray-50/50 text-center font-semibold text-gray-600">Непосещено</th>
                      </tr>
                      <tr>
                        <th className="border border-gray-200 px-2 py-2 bg-gray-50/50 text-center font-semibold text-gray-600">Сумма</th>
                        <th className="border border-gray-200 px-2 py-2 bg-gray-50/50 text-center font-semibold text-gray-600">Кол-во</th>
                        <th className="border border-gray-200 px-2 py-2 bg-gray-50/50 text-center font-semibold text-gray-600">Нет заказа</th>
                        <th className="border border-gray-200 px-2 py-2 bg-gray-50/50 text-center font-semibold text-gray-600">Сумма</th>
                        <th className="border border-gray-200 px-2 py-2 bg-gray-50/50 text-center font-semibold text-gray-600">Кол-во</th>
                        <th className="border border-gray-200 px-2 py-2 bg-gray-50/50 text-center font-semibold text-gray-600">Сумма</th>
                        <th className="border border-gray-200 px-2 py-2 bg-gray-50/50 text-center font-semibold text-gray-600">Кол-во</th>
                        <th className="border border-gray-200 px-2 py-2 bg-gray-50/50 text-center font-semibold text-gray-600">Нет заказа</th>
                        <th className="border border-gray-200 px-2 py-2 bg-gray-50/50 text-center font-semibold text-gray-600">Сумма</th>
                        <th className="border border-gray-200 px-2 py-2 bg-gray-50/50 text-center font-semibold text-gray-600">Кол-во</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedDaily.map((row) => (
                        <tr key={row.id} className="hover:bg-teal-50/30 transition-colors">
                          <td className="border border-gray-200 px-3 py-3 whitespace-pre-line leading-tight text-gray-800 font-medium">{row.agentName}</td>
                          <td className="border border-gray-200 px-2 py-2 text-center text-gray-700">{row.planTotal}</td>
                          <td className="border border-gray-200 px-2 py-2 text-center text-emerald-600 font-semibold">{row.planVisited}</td>
                          <td className="border border-gray-200 px-2 py-2 text-center text-gray-500">{row.planMissed}</td>
                          <td className="border border-gray-200 px-2 py-2 text-center text-gray-700">{row.planOrderSum}</td>
                          <td className="border border-gray-200 px-2 py-2 text-center text-gray-700">{row.planOrderQty}</td>
                          <td className="border border-gray-200 px-2 py-2 text-center text-gray-500">{row.planNoOrder}</td>
                          <td className="border border-gray-200 px-2 py-2 text-center text-gray-500">{row.planMissedOrderSum}</td>
                          <td className="border border-gray-200 px-2 py-2 text-center text-gray-500">{row.planMissedOrderQty}</td>
                          <td className="border border-gray-200 px-2 py-2 text-center text-gray-700">{row.photo}</td>
                          <td className="border border-gray-200 px-2 py-2 text-center text-gray-700">{row.unplannedVisited}</td>
                          <td className="border border-gray-200 px-2 py-2 text-center text-rose-600 font-semibold">{row.unplannedOrderSum}</td>
                          <td className="border border-gray-200 px-2 py-2 text-center text-gray-700">{row.unplannedOrderQty}</td>
                          <td className="border border-gray-200 px-2 py-2 text-center text-gray-500">{row.unplannedNoOrder}</td>
                          <td className="border border-gray-200 px-2 py-2 text-center text-gray-500">{row.unplannedMissedOrderSum}</td>
                          <td className="border border-gray-200 px-2 py-2 text-center text-gray-500">{row.unplannedMissedOrderQty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
                  <span className="text-gray-500">Показано {(currentPage - 1) * rowsPerPage + 1} - {Math.min(currentPage * rowsPerPage, filteredDaily.length)} / {filteredDaily.length}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">&lt;</button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => setCurrentPage(p)}
                        className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          currentPage === p ? 'text-white shadow-md' : 'border border-gray-200 hover:bg-gray-50'
                        }`}
                        style={currentPage === p ? { backgroundColor: primary } : {}}>
                        {p}
                      </button>
                    ))}
                    {totalPages > 5 && <span className="px-2 text-gray-400">...</span>}
                    {totalPages > 5 && (
                      <button onClick={() => setCurrentPage(totalPages)}
                        className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          currentPage === totalPages ? 'text-white shadow-md' : 'border border-gray-200 hover:bg-gray-50'
                        }`}
                        style={currentPage === totalPages ? { backgroundColor: primary } : {}}>
                        {totalPages}
                      </button>
                    )}
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">&gt;</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Efficiency Report */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <button onClick={() => setEfficiencyExpanded(!efficiencyExpanded)} className="flex items-center gap-3 group">
                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                  {efficiencyExpanded ? <ChevronUp className="h-4 w-4 text-purple-600" /> : <ChevronDown className="h-4 w-4 text-purple-600" />}
                </div>
                <h2 className="text-lg font-bold text-gray-800">Отчет по эффективности</h2>
              </button>
            </div>
            {efficiencyExpanded && (
              <div className="p-5">
                <div className="flex border-b border-gray-200 mb-5">
                  {[
                    { key: 'agents', label: 'Торговые агенты' },
                    { key: 'supervisors', label: 'Супервайзеры' },
                  ].map(tab => (
                    <button key={tab.key} onClick={() => setEfficiencyTab(tab.key)}
                      className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-all ${
                        efficiencyTab === tab.key
                          ? 'border-teal-500 text-teal-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}>
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 mb-5">
                  <button className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"><ArrowUpDown className="h-4 w-4 text-gray-500" /></button>
                  <button className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"><SlidersHorizontal className="h-4 w-4 text-gray-500" /></button>
                  <select value={efficiencyRowsPerPage} onChange={e => { setEfficiencyRowsPerPage(Number(e.target.value)); setEfficiencyPage(1); }}
                    className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-gray-50/50">
                    <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option>
                  </select>
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input type="text" placeholder="Поиск..." value={searchEfficiency} onChange={e => setSearchEfficiency(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-gray-50/50" />
                  </div>
                  <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition-colors font-medium">
                    <FileSpreadsheet className="h-4 w-4 text-green-600" /> Excel
                  </button>
                  <button className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"><RotateCw className="h-4 w-4 text-gray-500" /></button>
                </div>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/80">
                        <th className="px-4 py-3.5 text-left font-semibold text-gray-600 text-xs uppercase tracking-wider min-w-[320px]">Агент ▲</th>
                        <th className="px-4 py-3.5 text-left font-semibold text-gray-600 text-xs uppercase tracking-wider">Код агента</th>
                        <th className="px-4 py-3.5 text-right font-semibold text-gray-600 text-xs uppercase tracking-wider">Сумма заказов</th>
                        <th className="px-4 py-3.5 text-right font-semibold text-gray-600 text-xs uppercase tracking-wider">Заказ(ы)</th>
                        <th className="px-4 py-3.5 text-center font-semibold text-gray-600 text-xs uppercase tracking-wider">Отмененные <Info className="h-3 w-3 inline ml-1" /></th>
                        <th className="px-4 py-3.5 text-right font-semibold text-gray-600 text-xs uppercase tracking-wider">Визиты (План)</th>
                        <th className="px-4 py-3.5 text-right font-semibold text-gray-600 text-xs uppercase tracking-wider">Отказы</th>
                        <th className="px-4 py-3.5 text-right font-semibold text-gray-600 text-xs uppercase tracking-wider">Непосещенные Т.Т</th>
                        <th className="px-4 py-3.5 text-right font-semibold text-gray-600 text-xs uppercase tracking-wider">Посещенные в %</th>
                        <th className="px-4 py-3.5 text-right font-semibold text-gray-600 text-xs uppercase tracking-wider">Фотоотчет</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedEfficiency.map((row) => (
                        <tr key={row.id} className="hover:bg-teal-50/30 transition-colors">
                          <td className="px-4 py-3.5 text-gray-800 font-medium">{row.agentName}</td>
                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-700 font-mono text-xs">{row.agentCode}</span>
                          </td>
                          <td className="px-4 py-3.5 text-right font-semibold text-gray-800">{formatNumber(row.orderSum)}</td>
                          <td className="px-4 py-3.5 text-right text-gray-700">{row.orders}</td>
                          <td className="px-4 py-3.5 text-center">
                            {row.canceled > 0 ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-lg bg-red-50 text-red-600 font-semibold text-xs">{row.canceled}</span>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right text-gray-700">{row.plannedVisits}</td>
                          <td className="px-4 py-3.5 text-right text-gray-700">{row.refusals}</td>
                          <td className="px-4 py-3.5 text-right text-gray-700">{row.missedTT}</td>
                          <td className="px-4 py-3.5 text-right">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg font-semibold text-xs ${
                              row.visitPercent >= 50 ? 'bg-emerald-50 text-emerald-700' :
                              row.visitPercent >= 20 ? 'bg-amber-50 text-amber-700' :
                              'bg-red-50 text-red-600'
                            }`}>{row.visitPercent}%</span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <span className="text-teal-600 font-medium text-xs">{row.photos} Т.Т. ({row.photoCount} foto)</span>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-100/80 font-bold">
                        <td className="px-4 py-3.5 text-gray-800">Общий</td>
                        <td className="px-4 py-3.5"></td>
                        <td className="px-4 py-3.5 text-right text-gray-800">{formatNumber(totalOrderSum)}</td>
                        <td className="px-4 py-3.5 text-right text-gray-800">{totalOrders}</td>
                        <td className="px-4 py-3.5 text-center text-red-600">{totalCanceled}</td>
                        <td className="px-4 py-3.5 text-right text-gray-800">{totalPlanned}</td>
                        <td className="px-4 py-3.5 text-right text-gray-800">{totalRefusals}</td>
                        <td className="px-4 py-3.5 text-right text-gray-800">{totalMissed}</td>
                        <td className="px-4 py-3.5 text-right text-gray-800">10</td>
                        <td className="px-4 py-3.5 text-right text-teal-600">{totalPhotos}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
                  <span className="text-gray-500">Показано {(efficiencyPage - 1) * efficiencyRowsPerPage + 1} - {Math.min(efficiencyPage * efficiencyRowsPerPage, filteredEfficiency.length)} / {filteredEfficiency.length}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEfficiencyPage(p => Math.max(1, p - 1))} className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">&lt;</button>
                    {Array.from({ length: Math.min(efficiencyTotalPages, 5) }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => setEfficiencyPage(p)}
                        className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          efficiencyPage === p ? 'text-white shadow-md' : 'border border-gray-200 hover:bg-gray-50'
                        }`}
                        style={efficiencyPage === p ? { backgroundColor: primary } : {}}>
                        {p}
                      </button>
                    ))}
                    {efficiencyTotalPages > 5 && <span className="px-2 text-gray-400">...</span>}
                    {efficiencyTotalPages > 5 && (
                      <button onClick={() => setEfficiencyPage(efficiencyTotalPages)}
                        className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          efficiencyPage === efficiencyTotalPages ? 'text-white shadow-md' : 'border border-gray-200 hover:bg-gray-50'
                        }`}
                        style={efficiencyPage === efficiencyTotalPages ? { backgroundColor: primary } : {}}>
                        {efficiencyTotalPages}
                      </button>
                    )}
                    <button onClick={() => setEfficiencyPage(p => Math.min(efficiencyTotalPages, p + 1))} className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">&gt;</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Product Sales by Category Matrix */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <button onClick={() => setProductSalesExpanded(!productSalesExpanded)} className="flex items-center gap-3 group">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                  {productSalesExpanded ? <ChevronUp className="h-4 w-4 text-indigo-600" /> : <ChevronDown className="h-4 w-4 text-indigo-600" />}
                </div>
                <h2 className="text-lg font-bold text-gray-800">Продажа по категории продуктов</h2>
              </button>
              <div className="flex bg-gray-100 rounded-xl p-1">
                {[
                  { key: 'akb', label: 'АКБ' },
                  { key: 'volume', label: 'Объем' },
                  { key: 'sum', label: 'Сумма' },
                  { key: 'qty', label: 'Количество' },
                ].map(tab => (
                  <button key={tab.key} onClick={() => setProductSalesTab(tab.key)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                      productSalesTab === tab.key
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            {productSalesExpanded && (
              <div className="p-5">
                <div className="flex border-b border-gray-200 mb-5">
                  {[
                    { key: 'agents', label: 'По агентам' },
                    { key: 'supervisors', label: 'По супервайзерам' },
                  ].map(tab => (
                    <button key={tab.key} onClick={() => setProductSalesSubTab(tab.key)}
                      className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-all ${
                        productSalesSubTab === tab.key
                          ? 'border-teal-500 text-teal-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}>
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 mb-5">
                  <button className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"><ArrowUpDown className="h-4 w-4 text-gray-500" /></button>
                  <button className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"><SlidersHorizontal className="h-4 w-4 text-gray-500" /></button>
                  <select value={productSalesRowsPerPage} onChange={e => { setProductSalesRowsPerPage(Number(e.target.value)); setProductSalesPage(1); }}
                    className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-gray-50/50">
                    <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option>
                  </select>
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input type="text" placeholder="Поиск..." value={searchProductSales} onChange={e => setSearchProductSales(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-gray-50/50" />
                  </div>
                  <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition-colors font-medium">
                    <FileSpreadsheet className="h-4 w-4 text-green-600" /> Excel
                  </button>
                  <button className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"><RotateCw className="h-4 w-4 text-gray-500" /></button>
                </div>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50/80">
                        <th className="border border-gray-200 px-3 py-3 text-left font-semibold text-gray-600 min-w-[280px]">Агент ▲</th>
                        <th className="border border-gray-200 px-3 py-3 text-right font-semibold text-gray-600 min-w-[100px]">Сумма</th>
                        {productCategories.map(cat => (
                          <th key={cat} className="border border-gray-200 px-2 py-3 text-center font-semibold text-gray-500 min-w-[80px] whitespace-nowrap" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', padding: '8px 4px' }}>
                            {cat}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedProductSales.map((row) => (
                        <tr key={row.id} className="hover:bg-teal-50/30 transition-colors">
                          <td className="border border-gray-200 px-3 py-3 whitespace-pre-line leading-tight text-gray-800 font-medium text-xs">{row.agentName}</td>
                          <td className="border border-gray-200 px-3 py-3 text-right font-semibold text-gray-800 text-xs">{formatNumber(row.total)}</td>
                          {productCategories.map(cat => (
                            <td key={cat} className="border border-gray-200 px-2 py-3 text-center text-xs text-gray-600">
                              {row.categories[cat] ? formatNumber(row.categories[cat]) : ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
                  <span className="text-gray-500">Показано {(productSalesPage - 1) * productSalesRowsPerPage + 1} - {Math.min(productSalesPage * productSalesRowsPerPage, filteredProductSales.length)} / {filteredProductSales.length}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setProductSalesPage(p => Math.max(1, p - 1))} className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">&lt;</button>
                    {Array.from({ length: Math.min(productSalesTotalPages, 5) }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => setProductSalesPage(p)}
                        className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          productSalesPage === p ? 'text-white shadow-md' : 'border border-gray-200 hover:bg-gray-50'
                        }`}
                        style={productSalesPage === p ? { backgroundColor: primary } : {}}>
                        {p}
                      </button>
                    ))}
                    {productSalesTotalPages > 5 && <span className="px-2 text-gray-400">...</span>}
                    {productSalesTotalPages > 5 && (
                      <button onClick={() => setProductSalesPage(productSalesTotalPages)}
                        className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          productSalesPage === productSalesTotalPages ? 'text-white shadow-md' : 'border border-gray-200 hover:bg-gray-50'
                        }`}
                        style={productSalesPage === productSalesTotalPages ? { backgroundColor: primary } : {}}>
                        {productSalesTotalPages}
                      </button>
                    )}
                    <button onClick={() => setProductSalesPage(p => Math.min(productSalesTotalPages, p + 1))} className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">&gt;</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
