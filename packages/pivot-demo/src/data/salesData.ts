const DEALERS = ["Alpha Trade", "Beta Savdo", "Gamma Plus", "Delta Market"];
const REGIONS = ["Toshkent", "Samarqand", "Buxoro", "Farg'ona"];
const PRODUCTS = [
  { name: "Suv 0.5L", category: "Ichimliklar" },
  { name: "Cola 1L", category: "Ichimliklar" },
  { name: "Chips 150g", category: "Gazaklar" },
  { name: "Shokolad", category: "Shirinliklar" },
  { name: "Sut 1L", category: "Sut mahsulotlari" }
];
const QUARTERS = ["2025-Q1", "2025-Q2", "2025-Q3", "2025-Q4"];
const MONTHS = ["Yan", "Fev", "Mar", "Apr", "May", "Iyun", "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Mock savdo ma'lumotlari — API talab qilmaydi */
export function generateSalesData(count = 480): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];

  for (let i = 0; i < count; i++) {
    const product = PRODUCTS[i % PRODUCTS.length];
    const monthIdx = i % 12;
    const quarter = QUARTERS[Math.floor(monthIdx / 3)];
    const day = (i % 28) + 1;
    const qty = (i % 40) + 1;
    const amount = qty * ((i % 50) + 10) * 1_000;

    rows.push({
      dealer_name: DEALERS[i % DEALERS.length],
      region: REGIONS[i % REGIONS.length],
      product_name: product.name,
      category: product.category,
      sale_date: `2025-${pad(monthIdx + 1)}-${pad(day)}`,
      sale_year: "2025",
      sale_month: MONTHS[monthIdx],
      sale_quarter: quarter,
      quantity: qty,
      amount,
      bonus: Math.round(amount * 0.02)
    });
  }

  return rows;
}

export const SALES_DATA = generateSalesData();
