import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../utils/cn';
import { fmtUZS } from '../utils/format';

interface Props {
  totalDebt: number;
  totalPayment: number;
  netBalance: number;
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="text-[12px] text-gray-500 mb-1">{label}</div>
      <div className={cn('text-[22px] font-bold tabular', color)}>{fmtUZS(value)}</div>
    </div>
  );
}

export default function ReportFooter({ totalDebt, totalPayment, netBalance }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
      >
        <span className={cn(
          'w-7 h-7 rounded-md border border-gray-200 flex items-center justify-center text-gray-400 transition-transform',
          open && 'rotate-180'
        )}>
          <ChevronDown size={15} />
        </span>
        <span className="text-[20px] font-bold text-gray-800">Отчет по дебиторской и кредиторской задолженности</span>
      </button>
      {open && (
        <div className="px-5 pb-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Stat label="Итого долг (дебет)" value={totalDebt} color="text-red-600" />
            <Stat label="Итого оплата (кредит)" value={totalPayment} color="text-green-600" />
            <Stat label="Чистый баланс (нетто)" value={netBalance} color={netBalance < 0 ? 'text-red-600' : 'text-green-700'} />
          </div>
          <div className="mt-3 text-[12px] text-gray-400">
            Расчёт: Чистый баланс = Σ Долг + Σ Оплата по текущему набору фильтров. Отрицательное значение — дебиторская задолженность клиента.
          </div>
        </div>
      )}
    </div>
  );
}
