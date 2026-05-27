import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, UserCheck } from 'lucide-react';
import Sidebar from '../components/Sidebar';

const agents: Record<string, { code: string; name: string; region: string; orders: number; refusals: number }> = {
  u1: { code: 'MONNOQQ01', name: 'MAMAJONOV RASULJON', region: 'BOZOR', orders: 142, refusals: 28 },
  u2: { code: 'QQLLK-04', name: 'ILYASOV XOTAM', region: 'QUQON BOZOR', orders: 98, refusals: 15 },
  u3: { code: '03-GGKK004', name: 'MADAMINOV NUMONJON', region: 'MARKAZIY', orders: 76, refusals: 12 },
  u4: { code: 'JSQQ 002', name: 'MAXKAMOV AZIZXON', region: 'SVR SHAXNOZA', orders: 115, refusals: 22 },
};

export default function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const agent = id ? agents[id] : null;

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
            <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center">
              <UserCheck size={28} className="text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {agent ? `${agent.code} - [${agent.name}]` : `Агент #${id}`}
              </h1>
              <p className="text-sm text-gray-500">Детальная информация об агенте</p>
            </div>
          </div>
          {agent && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                ['Код', agent.code],
                ['Имя', agent.name],
                ['Регион', agent.region],
                ['Заказов', String(agent.orders)],
                ['Отказов', String(agent.refusals)],
                ['Статус', 'Активный'],
              ].map(([label, value]) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">{label}</p>
                  <p className="font-medium text-gray-800">{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
