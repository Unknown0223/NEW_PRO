export const formatCurrency = (value: number, currency: string = 'KZT'): string => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('ru-RU').format(value)
}

export const formatPercent = (value: number, decimals: number = 2): string => {
  return `${value.toFixed(decimals)}%`
}

export const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export const formatLargeNumber = (value: number): string => {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)} млрд`
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)} млн`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)} тыс`
  }
  return value.toString()
}

export const getProgressColor = (value: number): string => {
  if (value >= 90) return 'bg-emerald-500'
  if (value >= 75) return 'bg-blue-500'
  if (value >= 50) return 'bg-yellow-500'
  return 'bg-red-500'
}

export const getStatusColor = (value: number): string => {
  if (value >= 90) return 'text-emerald-600'
  if (value >= 75) return 'text-blue-600'
  if (value >= 50) return 'text-yellow-600'
  return 'text-red-600'
}
