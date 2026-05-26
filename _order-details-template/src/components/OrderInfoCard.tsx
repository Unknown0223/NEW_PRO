import { 
  User, 
  Truck, 
  Package, 
  MapPin, 
  Calendar, 
  Tag, 
  Percent, 
  Gift, 
  MessageSquare,
  Edit2,
  ExternalLink,
  ToggleLeft
} from 'lucide-react';

interface OrderInfoCardProps {
  order: {
    id: string;
    agent: { id: string; name: string; code: string };
    expeditor: { id: string; name: string };
    warehouse: { id: string; name: string };
    createdAt: string;
    shippedAt: string;
    returnDate?: string;
    tradeDirection: string;
    isConsignation: boolean;
    priceType: string;
    discount: string;
    location: { lat: number; lng: number };
    bonus: string;
    comment: string;
  };
  editable?: boolean;
  onEdit?: (field: string, value: any) => void;
}

export default function OrderInfoCard({ order, editable = false, onEdit }: OrderInfoCardProps) {
  const mapLink = `https://maps.google.com/?q=${order.location.lat},${order.location.lng}`;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Информация о заявке</h2>
      
      <div className="grid grid-cols-2 gap-x-8 gap-y-4">
        {/* Agent */}
        <div className="flex items-center gap-3">
          <User className="w-5 h-5 text-teal-500" />
          <span className="text-sm text-gray-500">Агент</span>
          <a
            href={`/users/${order.agent.id}`}
            className="flex-1 flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <span className="text-sm font-medium text-gray-900 truncate">
              {order.agent.code} [{order.agent.name}]
            </span>
            <ExternalLink className="w-4 h-4 text-gray-400" />
          </a>
        </div>

        {/* Created Date */}
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-teal-500" />
          <span className="text-sm text-gray-500">Дата создания</span>
          <div className="flex-1 px-3 py-1.5 bg-gray-50 rounded-lg text-right">
            <span className="text-sm text-gray-900">{order.createdAt}</span>
          </div>
        </div>

        {/* Expeditor */}
        <div className="flex items-center gap-3">
          <Truck className="w-5 h-5 text-teal-500" />
          <span className="text-sm text-gray-500">Экспедитор</span>
          <a
            href={`/users/${order.expeditor.id}`}
            className="flex-1 flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <span className="text-sm font-medium text-gray-900">{order.expeditor.name}</span>
            <ExternalLink className="w-4 h-4 text-gray-400" />
          </a>
        </div>

        {/* Shipped Date */}
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-teal-500" />
          <span className="text-sm text-gray-500">Дата отгрузки</span>
          {editable ? (
            <div className="flex-1 flex items-center gap-2">
              <input
                type="datetime-local"
                defaultValue={order.shippedAt}
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                onChange={(e) => onEdit?.('shippedAt', e.target.value)}
              />
            </div>
          ) : (
            <div className="flex-1 px-3 py-1.5 bg-gray-50 rounded-lg text-right">
              <span className="text-sm text-gray-900">{order.shippedAt}</span>
            </div>
          )}
        </div>

        {/* Warehouse */}
        <div className="flex items-center gap-3">
          <Package className="w-5 h-5 text-teal-500" />
          <span className="text-sm text-gray-500">Склад</span>
          <a
            href={`/warehouse/${order.warehouse.id}`}
            className="flex-1 flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <span className="text-sm font-medium text-gray-900">{order.warehouse.name}</span>
            <ExternalLink className="w-4 h-4 text-gray-400" />
          </a>
        </div>

        {/* Return Date */}
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-teal-500" />
          <span className="text-sm text-gray-500">Дата возврата</span>
          {editable ? (
            <div className="flex-1 flex items-center gap-2">
              <input
                type="date"
                defaultValue={order.returnDate}
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                onChange={(e) => onEdit?.('returnDate', e.target.value)}
              />
            </div>
          ) : (
            <div className="flex-1 px-3 py-1.5 bg-gray-50 rounded-lg text-right">
              <span className="text-sm text-gray-900">{order.returnDate || '-'}</span>
            </div>
          )}
        </div>

        {/* Trade Direction */}
        <div className="flex items-center gap-3">
          <Tag className="w-5 h-5 text-teal-500" />
          <span className="text-sm text-gray-500">Направление торговли</span>
          {editable ? (
            <select
              defaultValue={order.tradeDirection}
              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              onChange={(e) => onEdit?.('tradeDirection', e.target.value)}
            >
              <option value="DIELUX">DIELUX</option>
              <option value="OTHER">OTHER</option>
            </select>
          ) : (
            <div className="flex-1 px-3 py-1.5 bg-gray-50 rounded-lg text-right">
              <span className="text-sm text-gray-900">{order.tradeDirection}</span>
            </div>
          )}
        </div>

        {/* Consignation */}
        <div className="flex items-center gap-3">
          <ToggleLeft className="w-5 h-5 text-teal-500" />
          <span className="text-sm text-gray-500">Консигнация</span>
          {editable ? (
            <div className="flex-1 flex items-center gap-2">
              <button
                onClick={() => onEdit?.('isConsignation', !order.isConsignation)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  order.isConsignation 
                    ? 'bg-teal-100 text-teal-700' 
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {order.isConsignation ? 'Да' : 'Нет'}
              </button>
            </div>
          ) : (
            <div className="flex-1 px-3 py-1.5 bg-gray-50 rounded-lg text-right">
              <span className={`text-sm font-medium ${order.isConsignation ? 'text-teal-600' : 'text-gray-600'}`}>
                {order.isConsignation ? 'Да' : 'Нет'}
              </span>
            </div>
          )}
        </div>

        {/* Price Type */}
        <div className="flex items-center gap-3">
          <Tag className="w-5 h-5 text-teal-500" />
          <span className="text-sm text-gray-500">Тип цены</span>
          {editable ? (
            <select
              defaultValue={order.priceType}
              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              onChange={(e) => onEdit?.('priceType', e.target.value)}
            >
              <option value="NAQD PUL">NAQD PUL</option>
              <option value="KREDIT">KREDIT</option>
            </select>
          ) : (
            <div className="flex-1 px-3 py-1.5 bg-gray-50 rounded-lg text-right">
              <span className="text-sm text-gray-900">{order.priceType}</span>
            </div>
          )}
        </div>

        {/* Discount */}
        <div className="flex items-center gap-3">
          <Percent className="w-5 h-5 text-teal-500" />
          <span className="text-sm text-gray-500">Скидка</span>
          {editable ? (
            <select
              defaultValue={order.discount}
              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              onChange={(e) => onEdit?.('discount', e.target.value)}
            >
              <option value="Без скидки">Без скидки</option>
              <option value="5%">5%</option>
              <option value="10%">10%</option>
              <option value="15%">15%</option>
            </select>
          ) : (
            <div className="flex-1 px-3 py-1.5 bg-gray-50 rounded-lg text-right">
              <span className="text-sm text-gray-900">{order.discount}</span>
            </div>
          )}
        </div>

        {/* Location */}
        <div className="flex items-center gap-3">
          <MapPin className="w-5 h-5 text-teal-500" />
          <span className="text-sm text-gray-500">Локация</span>
          <a
            href={mapLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <span className="text-sm font-medium text-teal-600">
              {order.location.lat}, {order.location.lng}
            </span>
            <ExternalLink className="w-4 h-4 text-teal-500" />
          </a>
        </div>

        {/* Bonus */}
        <div className="flex items-center gap-3">
          <Gift className="w-5 h-5 text-teal-500" />
          <span className="text-sm text-gray-500">Бонус</span>
          <div className="flex-1 px-3 py-1.5 bg-gray-50 rounded-lg text-right">
            <span className="inline-flex px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
              {order.bonus}
            </span>
          </div>
        </div>

        {/* Comment */}
        <div className="flex items-center gap-3 col-span-2">
          <MessageSquare className="w-5 h-5 text-teal-500 flex-shrink-0" />
          <span className="text-sm text-gray-500">Комментарий</span>
          {editable ? (
            <textarea
              defaultValue={order.comment}
              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              rows={2}
              onChange={(e) => onEdit?.('comment', e.target.value)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-900">{order.comment}</span>
              {editable && <Edit2 className="w-4 h-4 text-gray-400 cursor-pointer" />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
