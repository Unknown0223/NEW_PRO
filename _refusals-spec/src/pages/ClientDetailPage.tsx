import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User } from 'lucide-react';
import Sidebar from '../components/Sidebar';

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <Sidebar />
      <div className="flex-1 overflow-auto p-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-teal-600 hover:text-teal-700 mb-6 text-sm font-medium"
        >
          <ArrowLeft size={16} />
          Назад к отказам
        </button>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-2xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center">
              <User size={28} className="text-teal-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Клиент #{id}</h1>
              <p className="text-sm text-gray-500">Детальная информация о клиенте</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[
              ['ID', id],
              ['Статус', 'Активный'],
              ['Категория', 'VIP'],
              ['Зона', 'BOZOR'],
              ['Телефон', '+998 90 000 00 00'],
              ['Адрес', 'Ул. Навои, 12'],
            ].map(([label, value]) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className="font-medium text-gray-800">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
