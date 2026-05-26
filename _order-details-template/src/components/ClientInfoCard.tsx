import { CreditCard, ExternalLink, Phone, Store, User, Wallet } from 'lucide-react';

interface ClientInfoCardProps {
  client: {
    id: string;
    name: string;
    code: string;
    contactPerson: string;
    territory: string;
    category: string;
    debt: number;
    balance: number;
    image?: string;
  };
}

export default function ClientInfoCard({ client }: ClientInfoCardProps) {
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('ru-RU').format(Math.abs(amount)) + " So'm";
  };

  const clientUrl = `/llkt/clients/about-clients/${client.id}`;

  const details = [
    { label: 'Контактное лицо', value: client.contactPerson, icon: Phone },
    { label: 'Территория', value: client.territory, icon: Store, badge: true },
    { label: 'Категория', value: client.category, icon: User, badge: true },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Информация о клиенте</h2>
        <a
          href={clientUrl}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700"
        >
          Профиль
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      <div className="flex gap-4 rounded-xl bg-slate-50/80 p-4 ring-1 ring-slate-100">
        <a href={clientUrl} className="flex-shrink-0">
          <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-slate-200 bg-white transition-colors hover:border-teal-300">
            {client.image ? (
              <img src={client.image} alt={client.name} className="h-full w-full rounded-xl object-cover" />
            ) : (
              <div className="text-center">
                <User className="mx-auto h-8 w-8 text-slate-400" />
                <span className="mt-1 block text-[11px] leading-tight text-slate-400">Фото отсутствует</span>
              </div>
            )}
          </div>
        </a>

        <div className="min-w-0 flex-1">
          <a
            href={clientUrl}
            className="group inline-flex max-w-full items-center gap-2"
          >
            <h3 className="truncate text-base font-semibold text-gray-950 group-hover:text-teal-700">
              {client.name}
            </h3>
            <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-slate-400 group-hover:text-teal-600" />
          </a>
          <p className="mt-0.5 text-sm text-slate-500">{client.contactPerson}</p>
          <a
            href={clientUrl}
            className="mt-1 inline-flex rounded-md bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-100"
          >
            {client.code}
          </a>
        </div>
      </div>

      <div className="mt-5 divide-y divide-slate-100">
        {details.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-4 py-3">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <item.icon className="h-4 w-4 text-teal-500" />
              <span>{item.label}</span>
            </div>
            {item.badge ? (
              <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                {item.value}
              </span>
            ) : (
              <span className="text-sm font-medium text-slate-900">{item.value}</span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
            <Wallet className="h-4 w-4 text-teal-500" />
            <span>Долг по заказу</span>
          </div>
          <p className="text-base font-semibold text-slate-950">{formatMoney(client.debt)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
            <CreditCard className="h-4 w-4 text-teal-500" />
            <span>Баланс</span>
          </div>
          <p className={`text-base font-semibold ${client.balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
            {client.balance < 0 ? '-' : ''}{formatMoney(client.balance)}
          </p>
        </div>
      </div>
    </div>
  );
}
