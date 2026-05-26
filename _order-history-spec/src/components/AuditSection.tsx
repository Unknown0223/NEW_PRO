import type { OrderVersion } from '../data/mockData';
import { User, Edit, Clock } from 'lucide-react';

interface AuditSectionProps {
  data: OrderVersion[];
}

export default function AuditSection({ data }: AuditSectionProps) {
  const firstVersion = data[0];
  const lastVersion = data[data.length - 1];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h3 className="mb-4 text-base font-bold text-gray-800">Аудит</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-sky-50">
            <User size={14} className="text-sky-600" />
          </div>
          <div>
            <div className="text-xs text-gray-500">Кто создал</div>
            <div className="mt-0.5 text-sm font-medium text-gray-700">
              {firstVersion?.createdBy || '—'}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-50">
            <Edit size={14} className="text-amber-600" />
          </div>
          <div>
            <div className="text-xs text-gray-500">Кто изменил</div>
            <div className="mt-0.5 text-sm font-medium text-gray-700">
              {lastVersion?.updatedBy || '—'}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50">
            <Clock size={14} className="text-emerald-600" />
          </div>
          <div>
            <div className="text-xs text-gray-500">Последнее изменение</div>
            <div className="mt-0.5 text-sm font-medium text-gray-700">
              {lastVersion?.date || '—'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
