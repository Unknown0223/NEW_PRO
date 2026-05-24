import {
  DashboardFilters,
  FinancialKpi,
  VisitKpi,
  ProductCategoryAnalytics,
  DailyVisitRow,
  EfficiencyReport,
  ProductMatrixRow,
  RegionalPerformance,
  SalesFunnelData,
  CategoryTrendData,
  AgentPerformanceData,
  RegionalChartData,
} from '../types/dashboard'

// Mock Data Generators for Enterprise FMCG Dashboard
export const generateMockFilters = (): DashboardFilters => ({
  startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0],
  paymentMethods: ['Наличные', 'Терминал', 'Банковский перевод', 'Тенге'],
  agents: [],
  supervisors: [],
  tradeDirections: ['Опт', 'Розница', 'HoReCa'],
  customerCategories: ['Категория А', 'Категория Б', 'Категория В'],
  zones: ['Центральная', 'Северная', 'Южная', 'Восточная', 'Западная'],
  regions: ['Алматы', 'Астана', 'Шымкент', 'Актау', 'Атырау'],
  cities: ['Алматы', 'Астана', 'Шымкент', 'Тараз', 'Павлодар'],
})

export const generateFinancialKpis = (): FinancialKpi => {
  const total = 1250000000
  return {
    totalSales: total,
    cash: total * 0.35,
    terminal: total * 0.25,
    bankTransfer: total * 0.30,
    tenge: total * 0.10,
  }
}

export const generateVisitKpis = (): VisitKpi => {
  const planned = 15000
  const actual = 13500
  const successful = 12800
  const gpsVerified = 13200
  const photoReports = 12500

  return {
    plannedVisits: planned,
    actualVisits: actual,
    successfulVisits: successful,
    gpsVerifiedVisits: gpsVerified,
    photoReports: photoReports,
    completionRate: (actual / planned) * 100,
    gpsVerificationRate: (gpsVerified / actual) * 100,
    photoCoverageRate: (photoReports / actual) * 100,
  }
}

export const generateCategoryAnalytics = (): ProductCategoryAnalytics[] => {
  const categories = [
    'Молочные продукты',
    'Мясо и колбасы',
    'Овощи и фрукты',
    'Бакалея',
    'Напитки',
    'Кондитерские изделия',
    'Морепродукты',
    'Хлеб и выпечка',
    'Замороженные продукты',
    'Бытовая химия',
  ]

  const totalSales = 1250000000
  return categories.map((category) => {
    const share = Math.random() * 0.15 + 0.02
    return {
      category,
      sharePercent: parseFloat((share * 100).toFixed(2)),
      salesAmount: Math.floor(totalSales * share),
      volume: Math.floor(Math.random() * 500000 + 100000),
      akb: Math.floor(Math.random() * 5000 + 1000),
    }
  }).sort((a, b) => b.salesAmount - a.salesAmount)
}

export const generateDailyVisitReport = (count: number = 50): DailyVisitRow[] => {
  const agents = [
    'Алиев А.', 'Иванов П.', 'Петров С.', 'Смагулов Д.', 'Козлов М.',
    'Нургазиев Р.', 'Омаров К.', 'Тлеубеков А.', 'Жумабеков Б.', 'Абдиров Н.',
    'Каримов Т.', 'Рахимов С.', 'Байсеитов А.', 'Сейткалиев М.', 'Уалиханов Д.'
  ]

  return Array.from({ length: count }, (_, i) => {
    const planned = Math.floor(Math.random() * 30 + 20)
    const visited = Math.floor(planned * (Math.random() * 0.3 + 0.7))
    const successful = Math.floor(visited * (Math.random() * 0.4 + 0.6))
    const revenue = Math.floor(Math.random() * 500000 + 100000)

    return {
      agentId: `AGT${String(i + 1).padStart(4, '0')}`,
      agentName: agents[i % agents.length],
      plannedVisited: visited,
      plannedMissed: planned - visited,
      unplannedVisited: Math.floor(Math.random() * 10),
      unplannedMissed: Math.floor(Math.random() * 5),
      successfulOrders: successful,
      failedVisits: visited - successful,
      photoReports: Math.floor(successful * (Math.random() * 0.2 + 0.8)),
      revenue,
      quantity: Math.floor(revenue / 5000),
    }
  })
}

export const generateEfficiencyReport = (count: number = 50): EfficiencyReport[] => {
  const agents = [
    'Алиев А.', 'Иванов П.', 'Петров С.', 'Смагулов Д.', 'Козлов М.',
    'Нургазиев Р.', 'Омаров К.', 'Тлеубеков А.', 'Жумабеков Б.', 'Абдиров Н.',
    'Каримов Т.', 'Рахимов С.', 'Байсеитов А.', 'Сейткалиев М.', 'Уалиханов Д.'
  ]

  return Array.from({ length: count }, (_, i) => {
    const planned = Math.floor(Math.random() * 30 + 20)
    const visited = Math.floor(planned * (Math.random() * 0.3 + 0.7))
    const orders = Math.floor(visited * (Math.random() * 0.4 + 0.5))
    const sales = Math.floor(Math.random() * 800000 + 150000)

    return {
      agentId: `AGT${String(i + 1).padStart(4, '0')}`,
      agentName: agents[i % agents.length],
      totalSales: sales,
      orders,
      canceled: Math.floor(Math.random() * 5),
      plannedVisits: planned,
      refusals: Math.floor(Math.random() * 8),
      missedVisits: planned - visited,
      visitCompletionRate: parseFloat(((visited / planned) * 100).toFixed(2)),
      orderConversionRate: parseFloat(((orders / visited) * 100).toFixed(2)),
      photoReports: Math.floor(orders * (Math.random() * 0.3 + 0.7)),
    }
  })
}

export const generateProductMatrix = (count: number = 30): ProductMatrixRow[] => {
  const agents = [
    'Алиев А.', 'Иванов П.', 'Петров С.', 'Смагулов Д.', 'Козлов М.',
    'Нургазиев Р.', 'Омаров К.', 'Тлеубеков А.', 'Жумабеков Б.', 'Абдиров Н.'
  ]

  const categories = [
    'Молочные продукты',
    'Мясо и колбасы',
    'Овощи и фрукты',
    'Бакалея',
    'Напитки',
    'Кондитерские изделия',
  ]

  return Array.from({ length: count }, (_, i) => {
    const categoriesData: { [key: string]: number } = {}
    let total = 0

    categories.forEach((cat) => {
      const value = Math.floor(Math.random() * 200000 + 50000)
      categoriesData[cat] = value
      total += value
    })

    return {
      agent: agents[i % agents.length],
      agentId: `AGT${String(i + 1).padStart(4, '0')}`,
      categories: categoriesData,
      total,
    }
  })
}

export const generateRegionalPerformance = (count: number = 25): RegionalPerformance[] => {
  const regions = [
    { region: 'Алматы', cities: ['Алматы', 'Талгар', 'Каскелен'] },
    { region: 'Астана', cities: ['Астана', 'Сарыарка'] },
    { region: 'Шымкент', cities: ['Шымкент', 'Ордабасы'] },
    { region: 'Актау', cities: ['Актау', 'Жанаозен'] },
    { region: 'Атырау', cities: ['Атырау', 'Курмангазы'] },
  ]

  const zones = ['Центральная', 'Северная', 'Южная', 'Восточная', 'Западная']

  return Array.from({ length: count }, () => {
    const region = regions[Math.floor(Math.random() * regions.length)]
    const city = region.cities[Math.floor(Math.random() * region.cities.length)]
    const zone = zones[Math.floor(Math.random() * zones.length)]
    const sales = Math.floor(Math.random() * 50000000 + 10000000)

    return {
      region: region.region,
      city,
      zone,
      totalSales: sales,
      visitCount: Math.floor(Math.random() * 500 + 100),
      orderCount: Math.floor(Math.random() * 400 + 80),
      completionRate: parseFloat((Math.random() * 30 + 70).toFixed(2)),
      topCategory: ['Молочные продукты', 'Напитки', 'Бакалея'][Math.floor(Math.random() * 3)],
    }
  })
}

export const generateSalesFunnel = (): SalesFunnelData => {
  const plannedTT = 15000
  const visitedTT = Math.floor(plannedTT * 0.9)
  const photoVerified = Math.floor(visitedTT * 0.92)
  const orderCreated = Math.floor(photoVerified * 0.75)
  const revenueGenerated = orderCreated * Math.floor(Math.random() * 50000 + 30000)

  return {
    plannedTT,
    visitedTT,
    photoVerified,
    orderCreated,
    revenueGenerated,
  }
}

export const generateCategoryTrends = (days: number = 30): CategoryTrendData[] => {
  const categories = ['Молочные продукты', 'Напитки', 'Бакалея', 'Кондитерские изделия']
  const data: CategoryTrendData[] = []

  for (let i = 0; i < days; i++) {
    const date = new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000)
    categories.forEach((category) => {
      data.push({
        date: date.toISOString().split('T')[0],
        category,
        sales: Math.floor(Math.random() * 5000000 + 2000000),
      })
    })
  }

  return data
}

export const generateAgentPerformance = (count: number = 20): AgentPerformanceData[] => {
  const agents = [
    'Алиев А.', 'Иванов П.', 'Петров С.', 'Смагулов Д.', 'Козлов М.',
    'Нургазиев Р.', 'Омаров К.', 'Тлеубеков А.', 'Жумабеков Б.', 'Абдиров Н.'
  ]

  return Array.from({ length: count }, (_, i) => ({
    agent: agents[i % agents.length],
    sales: Math.floor(Math.random() * 1000000 + 300000),
    visits: Math.floor(Math.random() * 100 + 50),
    conversion: parseFloat((Math.random() * 40 + 50).toFixed(2)),
  }))
}

export const generateRegionalChart = (): RegionalChartData[] => {
  const regions = ['Алматы', 'Астана', 'Шымкент', 'Актау', 'Атырау']

  return regions.map((region) => ({
    region,
    sales: Math.floor(Math.random() * 200000000 + 50000000),
    visits: Math.floor(Math.random() * 2000 + 500),
  }))
}
