export const formatNumber = (value: number | string | undefined): string => {
  if (value === undefined || value === null || value === '') return '0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return Math.round(num).toLocaleString('ru-RU');
};

export const parseNumber = (value: string): number => {
  if (!value) return 0;
  const cleaned = value.replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};
