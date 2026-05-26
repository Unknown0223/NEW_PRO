import React from 'react';
import { Dialog } from '@/components/ui/Dialog';
import type { OrderProduct } from '@/types/order';

interface ProductsModalProps {
  open: boolean;
  onClose: () => void;
  products: OrderProduct[];
  orderNumber: string;
}

export const ProductsModal: React.FC<ProductsModalProps> = ({ open, onClose, products, orderNumber }) => {
  const total = products.reduce((sum, p) => sum + p.total, 0);

  return (
    <Dialog open={open} onClose={onClose} title={`Товары заказа №${orderNumber}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 font-medium text-gray-500">Продукт</th>
              <th className="text-right py-2 px-3 font-medium text-gray-500">Кол-во</th>
              <th className="text-right py-2 px-3 font-medium text-gray-500">Цена</th>
              <th className="text-right py-2 px-3 font-medium text-gray-500">Скидка</th>
              <th className="text-right py-2 px-3 font-medium text-gray-500">Итого</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-2.5 px-3 text-gray-900">{product.name}</td>
                <td className="py-2.5 px-3 text-right text-gray-700">{product.qty}</td>
                <td className="py-2.5 px-3 text-right text-gray-700">
                  {product.price.toLocaleString('ru-RU')}
                </td>
                <td className="py-2.5 px-3 text-right text-gray-700">{product.discount}%</td>
                <td className="py-2.5 px-3 text-right font-medium text-gray-900">
                  {product.total.toLocaleString('ru-RU')}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200">
              <td className="py-3 px-3 font-semibold text-gray-900">Итого</td>
              <td className="py-3 px-3 text-right font-semibold text-gray-900">
                {products.reduce((s, p) => s + p.qty, 0)}
              </td>
              <td className="py-3 px-3" />
              <td className="py-3 px-3" />
              <td className="py-3 px-3 text-right font-bold text-teal-700">
                {total.toLocaleString('ru-RU')} сум
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Dialog>
  );
};
