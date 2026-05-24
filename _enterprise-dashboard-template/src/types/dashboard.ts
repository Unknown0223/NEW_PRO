// Dashboard Filter Types
export interface DashboardFilters {
  startDate: string
  endDate: string
  paymentMethods: string[]
  agents: string[]
  supervisors: string[]
  tradeDirections: string[]
  customerCategories: string[]
  zones: string[]
  regions: string[]
  cities: string[]
}

// Financial KPI Types
export interface FinancialKpi {
  totalSales: number
  cash: number
  terminal: number
  bankTransfer: number
  tenge: number
}

// Visit KPI Types
export interface VisitKpi {
  plannedVisits: number
  actualVisits: number
  successfulVisits: number
  gpsVerifiedVisits: number
  photoReports: number
  completionRate: number
  gpsVerificationRate: number
  photoCoverageRate: number
}

// Product Category Analytics
export interface ProductCategoryAnalytics {
  category: string
  sharePercent: number
  salesAmount: number
  volume: number
  akb: number
}

// Daily Visit Report
export interface DailyVisitRow {
  agentId: string
  agentName: string
  plannedVisited: number
  plannedMissed: number
  unplannedVisited: number
  unplannedMissed: number
  successfulOrders: number
  failedVisits: number
  photoReports: number
  revenue: number
  quantity: number
}

// Efficiency Report
export interface EfficiencyReport {
  agentId: string
  agentName: string
  totalSales: number
  orders: number
  canceled: number
  plannedVisits: number
  refusals: number
  missedVisits: number
  visitCompletionRate: number
  orderConversionRate: number
  photoReports: number
}

// Product Sales Matrix
export interface ProductMatrixRow {
  agent: string
  agentId: string
  categories: { [categoryName: string]: number }
  total: number
}

// Regional Performance
export interface RegionalPerformance {
  region: string
  city: string
  zone: string
  totalSales: number
  visitCount: number
  orderCount: number
  completionRate: number
  topCategory: string
}

// Sales Funnel Data
export interface SalesFunnelData {
  plannedTT: number
  visitedTT: number
  photoVerified: number
  orderCreated: number
  revenueGenerated: number
}

// Chart Data Types
export interface CategoryTrendData {
  date: string
  category: string
  sales: number
}

export interface AgentPerformanceData {
  agent: string
  sales: number
  visits: number
  conversion: number
}

export interface RegionalChartData {
  region: string
  sales: number
  visits: number
}

// Export Types
export interface ExportConfig {
  format: 'xlsx' | 'csv' | 'pdf'
  includeCharts: boolean
  includeRawData: boolean
  fileName: string
}
