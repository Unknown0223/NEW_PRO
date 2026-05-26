import { ExternalLink } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  block: number;
  quantity: number;
  volume: number;
  discount: number;
  total: number;
}

interface ProductsTableProps {
  products: Product[];
  editable?: boolean;
  onProductUpdate?: (productId: string, field: string, value: number) => void;
}

export default function ProductsTable({ products, editable = false, onProductUpdate }: ProductsTableProps) {
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('ru-RU').format(amount);
  };

  const calculateTotal = (product: Product) => {
    const baseTotal = product.quantity * product.price;
    const discountedTotal = baseTotal - (baseTotal * product.discount / 100);
    return discountedTotal;
  };

  const totalQuantity = products.reduce((sum, p) => sum + p.quantity, 0);
  const totalDiscount = products.length > 0 
    ? (products.reduce((sum, p) => sum + p.discount, 0) / products.length).toFixed(2)
    : '0.00';
  const grandTotal = products.reduce((sum, p) => sum + calculateTotal(p), 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center">
            <span className="text-xs font-bold text-white">!</span>
          </div>
          <h3 className="text-base font-semibold text-gray-900">Prokladki</h3>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ассортимент
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Цена
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Блок
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Количество
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Объем
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Скидка
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Общая сумма
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <a
                    href={`/products/${product.id}`}
                    className="flex items-center gap-2 text-sm font-medium text-gray-900 hover:text-teal-600 transition-colors"
                  >
                    {product.name}
                    <ExternalLink className="w-3 h-3 text-gray-400" />
                  </a>
                </td>
                <td className="px-6 py-4 text-right">
                  {editable ? (
                    <input
                      type="number"
                      value={product.price}
                      onChange={(e) => onProductUpdate?.(product.id, 'price', Number(e.target.value))}
                      className="w-24 px-2 py-1 text-right border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  ) : (
                    <span className="text-sm text-gray-900">{formatMoney(product.price)}</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  {editable ? (
                    <input
                      type="number"
                      value={product.block}
                      onChange={(e) => onProductUpdate?.(product.id, 'block', Number(e.target.value))}
                      className="w-20 px-2 py-1 text-right border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  ) : (
                    <span className="text-sm text-gray-900">{product.block}</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  {editable ? (
                    <input
                      type="number"
                      value={product.quantity}
                      onChange={(e) => onProductUpdate?.(product.id, 'quantity', Number(e.target.value))}
                      className="w-20 px-2 py-1 text-right border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  ) : (
                    <span className="text-sm text-gray-900">{product.quantity}</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-sm text-gray-900">{product.volume}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  {editable ? (
                    <input
                      type="number"
                      value={product.discount}
                      onChange={(e) => onProductUpdate?.(product.id, 'discount', Number(e.target.value))}
                      className="w-16 px-2 py-1 text-right border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      min="0"
                      max="100"
                    />
                  ) : (
                    <span className="text-sm text-gray-900">{product.discount > 0 ? `${product.discount}%` : '-'}</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-sm font-medium text-gray-900">
                    {formatMoney(calculateTotal(product))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50">
              <td className="px-6 py-4 text-left">
                <span className="text-sm font-semibold text-gray-900">Итого</span>
              </td>
              <td className="px-6 py-4"></td>
              <td className="px-6 py-4"></td>
              <td className="px-6 py-4 text-right">
                <span className="text-sm font-semibold text-gray-900">{totalQuantity}</span>
              </td>
              <td className="px-6 py-4"></td>
              <td className="px-6 py-4 text-right">
                <span className="text-sm font-medium text-gray-900">{totalDiscount}%</span>
              </td>
              <td className="px-6 py-4 text-right">
                <span className="text-sm font-semibold text-gray-900">
                  {formatMoney(grandTotal)} So'm
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
