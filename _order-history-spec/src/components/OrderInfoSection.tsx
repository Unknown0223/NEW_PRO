import type { OrderVersion, ProductItem } from '../data/mockData';
import StatusBadge from './StatusBadge';

interface OrderInfoSectionProps {
  data: OrderVersion[];
  products: ProductItem[];
}

interface RowDef {
  label: string;
  key: keyof OrderVersion;
  isLink?: boolean;
  isStatus?: boolean;
  isDate?: boolean;
  isMultiLine?: boolean;
}

const rows: RowDef[] = [
  { label: 'Дата', key: 'date', isDate: true },
  { label: 'Клиенты', key: 'client', isLink: true },
  { label: 'Агент', key: 'agent', isLink: true, isMultiLine: true },
  { label: 'Экспедитор', key: 'expediter', isLink: true },
  { label: 'Дата отгрузки', key: 'shipDate' },
  { label: 'Дата доставки', key: 'deliveryDate' },
  { label: 'Консигнация', key: 'consignation' },
  { label: 'Консигнация (срок)', key: 'consignationDeadline' },
  { label: 'Статус', key: 'status', isStatus: true },
  { label: 'Тип цены', key: 'priceType' },
  { label: 'Кол-во', key: 'quantity' },
  { label: 'Объем', key: 'volume' },
  { label: 'Сумма', key: 'sum' },
  { label: 'Склад', key: 'warehouse', isLink: true },
  { label: 'Направление торговли', key: 'tradeDirection' },
  { label: 'Дата возврата', key: 'returnDate' },
  { label: 'Комментарий', key: 'comment' },
  { label: 'Кто создал', key: 'createdBy', isLink: true, isMultiLine: true },
  { label: 'Кто изменил', key: 'updatedBy', isLink: true, isMultiLine: true },
];

function renderValue(value: string, isMultiLine?: boolean) {
  if (isMultiLine && value.includes('\n')) {
    return (
      <>
        {value.split('\n').map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </>
    );
  }
  return value;
}

export default function OrderInfoSection({ data, products }: OrderInfoSectionProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full border-collapse text-[13px]">
        <tbody>
          {/* Main rows */}
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-gray-100 last:border-b-0">
              <td className="w-52 whitespace-nowrap bg-gray-50/50 px-4 py-[7px] text-xs font-medium text-gray-500">
                {row.label}
              </td>

              {data.map((version, idx) => {
                const value = version[row.key] as string;
                const hasValue = value && value.trim().length > 0;

                return (
                  <td
                    key={idx}
                    className="min-w-[220px] border-l border-gray-100 px-4 py-[7px] align-top text-gray-700"
                  >
                    {row.isStatus && hasValue ? (
                      <StatusBadge status={version.status} statusKey={version.statusKey} />
                    ) : row.isLink && hasValue ? (
                      <a
                        href="#"
                        className="text-teal-600 hover:text-teal-700 hover:underline whitespace-pre-line break-words"
                      >
                        {renderValue(value, row.isMultiLine)}
                      </a>
                    ) : row.isDate && hasValue ? (
                      <span className="font-semibold text-teal-600">{value}</span>
                    ) : hasValue ? (
                      <span className="whitespace-pre-line break-words">
                        {renderValue(value, row.isMultiLine)}
                      </span>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}

          {/* Состав separator row */}
          <tr>
            <td
              colSpan={data.length + 1}
              className="bg-gray-50/50 px-4 py-3 text-base font-bold text-gray-800"
            >
              Состав
            </td>
          </tr>

          {/* Products rows */}
          {products.map((product, pIdx) => (
            <tr
              key={product.id}
              className={`border-b border-gray-100 last:border-b-0 ${
                pIdx % 2 === 1 ? 'bg-gray-50/50' : ''
              }`}
            >
              <td className="w-52 whitespace-nowrap bg-gray-50/50 px-4 py-[7px]" />
              {data.map((_, idx) => (
                <td
                  key={idx}
                  className={`min-w-[220px] border-l border-gray-100 px-4 py-[7px] align-top text-gray-700 ${
                    idx < 2 ? 'w-1/2' : ''
                  }`}
                >
                  {idx === 0 ? (
                    <>
                      <div className="text-[13px] text-gray-700">{product.name}</div>
                      <div className="mt-0.5 text-xs font-semibold text-teal-600">Заказ</div>
                    </>
                  ) : idx === 1 ? (
                    <div>
                      <div className="text-xs text-gray-600">
                        Кол-во:{' '}
                        <span className="font-semibold text-gray-800">{product.quantity} шт</span>
                      </div>
                      <div className="text-xs text-gray-600">
                        Цена:{' '}
                        <span className="font-semibold text-gray-800">
                          {product.price.toLocaleString('ru-RU')}сум
                        </span>
                      </div>
                      <div className="text-xs text-gray-600">
                        Объем: <span className="font-semibold text-gray-800">{product.volume}</span>
                      </div>
                      <div className="text-xs text-gray-600">
                        Сумма:{' '}
                        <span className="font-semibold text-gray-800">
                          {product.total.toLocaleString('ru-RU')}сум
                        </span>
                      </div>
                    </div>
                  ) : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
