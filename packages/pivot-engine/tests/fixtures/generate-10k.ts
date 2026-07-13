/** 10k qator benchmark fixture generator (test/build uchun). */
export function generate10kRows(): Record<string, unknown>[] {
  const regions = ["Toshkent", "Samarqand", "Buxoro", "Farg'ona", "Andijon"];
  const products = ["A", "B", "C", "D", "E"];
  const months = ["Yan", "Fev", "Mar", "Apr", "May", "Iyun"];

  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < 10_000; i++) {
    rows.push({
      region: regions[i % regions.length],
      product: products[i % products.length],
      month: months[i % months.length],
      amount: (i % 500 + 1) * 1_000,
      qty: (i % 100) + 1
    });
  }
  return rows;
}
