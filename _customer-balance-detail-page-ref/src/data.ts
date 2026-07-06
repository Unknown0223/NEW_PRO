import type { BalanceCard, Customer, DebtTransaction, PaymentMethod, TransactionType } from './types';

export const customer: Customer = {
  id: 1,
  name: 'KARZINKA',
  phone: '',
  territory: 'SERGELI',
};

export const agents = ['SET (XOTAM AKA) OTCHET', 'TOSH SET (SHAXLO) OTCHET'];
export const expeditors = ['Dastavka Set', 'Dastavka Tosh'];
export const cashboxes = ['Основная касса', 'Касса Sergeli'];
export const creators = ['ADMIN SKLAD', 'Dastavka Set', 'KASSIR 1'];

export const balanceCards: BalanceCard[] = [
  { id: 'main', title: 'KARZINKA', amount: 0, oldDebtIncome: 0, cash: 0, transfer: 0, terminal: 0 },
  { id: 'agent-set', title: 'SET (XOTAM AKA) OTCHET', amount: -11_462_331_143, oldDebtIncome: 0, cash: 0, transfer: 0, terminal: -11_462_331_143 },
  { id: 'agent-tosh', title: 'TOSH SET (SHAXLO) OTCHET', amount: 0, oldDebtIncome: 0, cash: 0, transfer: 0, terminal: 0 },
];

// Deterministic PRNG (mulberry32) so dataset is stable between renders
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Seed {
  doc: number;
  date: string;
  debt: number;
  payment: number;
  method: PaymentMethod;
  type: TransactionType;
  typeLabel: string;
  opName: string;
  orderType: string;
  exp: string;
  comment: string;
  txComment: string;
  createdBy: string;
}

// First 10 rows — exact match with the reference screenshots
const pinned: Seed[] = [
  { doc: 1498076, date: '2026-06-30T10:57:00', debt: -209_760, payment: 0, method: 'terminal', type: 'order', typeLabel: 'Заказ', opName: 'Блокировка заказа', orderType: 'Заказ', exp: '', comment: '29,06,2026 Reverem Korzinka Go- Elbek', txComment: 'Удержание долга по заказу', createdBy: 'ADMIN SKLAD' },
  { doc: 1498080, date: '2026-06-30T10:57:00', debt: -456_000, payment: 0, method: 'terminal', type: 'order', typeLabel: 'Заказ', opName: 'Блокировка заказа', orderType: 'Заказ', exp: '', comment: '29,06,2026 Reverem Korzinka Go- Uchtepa', txComment: 'Удержание долга по заказу', createdBy: 'ADMIN SKLAD' },
  { doc: 1498075, date: '2026-06-30T10:57:00', debt: -344_280, payment: 0, method: 'terminal', type: 'order', typeLabel: 'Заказ', opName: 'Блокировка заказа', orderType: 'Заказ', exp: '', comment: '29,06,2026 Reverem Korzinka Go- Almazar', txComment: 'Удержание долга по заказу', createdBy: 'ADMIN SKLAD' },
  { doc: 1498070, date: '2026-06-30T10:57:00', debt: -449_160, payment: 0, method: 'terminal', type: 'order', typeLabel: 'Заказ', opName: 'Блокировка заказа', orderType: 'Заказ', exp: '', comment: '29,06,2026 Reverem Korzinka Go- Bashlyk', txComment: 'Удержание долга по заказу', createdBy: 'ADMIN SKLAD' },
  { doc: 1497929, date: '2026-06-30T10:20:00', debt: -560_880, payment: 0, method: 'terminal', type: 'order', typeLabel: 'Заказ', opName: 'Блокировка заказа', orderType: 'Заказ', exp: '', comment: '15.06.2026 Korzinka Go-Almazar zakaz', txComment: 'Удержание долга по заказу', createdBy: 'ADMIN SKLAD' },
  { doc: 1497922, date: '2026-06-30T10:20:00', debt: -711_360, payment: 0, method: 'terminal', type: 'order', typeLabel: 'Заказ', opName: 'Блокировка заказа', orderType: 'Заказ', exp: '', comment: '15.06.2026 Korzinka Go-Uchtepa zakaz', txComment: 'Удержание долга по заказу', createdBy: 'ADMIN SKLAD' },
  { doc: 1497926, date: '2026-06-30T10:20:00', debt: -665_760, payment: 0, method: 'terminal', type: 'order', typeLabel: 'Заказ', opName: 'Блокировка заказа', orderType: 'Заказ', exp: '', comment: '15.06.2026 Korzinka Go-Bashlyk zakaz', txComment: 'Удержание долга по заказу', createdBy: 'ADMIN SKLAD' },
  { doc: 1497935, date: '2026-06-30T10:20:00', debt: -528_960, payment: 0, method: 'terminal', type: 'order', typeLabel: 'Заказ', opName: 'Блокировка заказа', orderType: 'Заказ', exp: '', comment: '15.06.2026 Korzinka reverem Go-Elbek zakaz', txComment: 'Удержание долга по заказу', createdBy: 'ADMIN SKLAD' },
  { doc: 1495667, date: '2026-06-29T17:29:00', debt: -5_011_500, payment: 0, method: 'terminal', type: 'order', typeLabel: 'Заказ', opName: 'Блокировка заказа', orderType: 'Заказ', exp: 'Dastavka Set', comment: 'Karzinka Go Bashlyk', txComment: 'Karzinka Go Bashlyk', createdBy: 'ADMIN SKLAD' },
  { doc: 1495660, date: '2026-06-29T17:29:00', debt: -2_638_536, payment: 0, method: 'terminal', type: 'order', typeLabel: 'Заказ', opName: 'Блокировка заказа', orderType: 'Заказ', exp: 'Dastavka Set', comment: 'Karzinka Go Uchtepa', txComment: 'Karzinka Go Uchtepa', createdBy: 'ADMIN SKLAD' },
];

const branches = ['Elbek', 'Uchtepa', 'Almazar', 'Bashlyk', 'Sergeli', 'Chilanzar'];

function generateSeeds(): Seed[] {
  const rnd = mulberry32(20260630);
  const seeds: Seed[] = [...pinned];
  let doc = 1495650;
  let day = new Date('2026-06-29T15:00:00');

  for (let i = 0; i < 168; i++) {
    // step time backwards 2-9 hours
    day = new Date(day.getTime() - (2 + Math.floor(rnd() * 8)) * 3600_000);
    doc -= 1 + Math.floor(rnd() * 14);
    const branch = branches[Math.floor(rnd() * branches.length)];
    const r = rnd();

    if (r < 0.68) {
      // Order (debt)
      seeds.push({
        doc,
        date: day.toISOString().slice(0, 19),
        debt: -Math.round((150 + rnd() * 6000)) * 1000,
        payment: 0,
        method: 'terminal',
        type: 'order',
        typeLabel: 'Заказ',
        opName: 'Блокировка заказа',
        orderType: 'Заказ',
        exp: rnd() < 0.35 ? expeditors[Math.floor(rnd() * expeditors.length)] : '',
        comment: `Korzinka Go-${branch} zakaz`,
        txComment: 'Удержание долга по заказу',
        createdBy: 'ADMIN SKLAD',
      });
    } else if (r < 0.86) {
      // Payment
      const method: PaymentMethod = rnd() < 0.5 ? 'cash' : rnd() < 0.6 ? 'transfer' : 'mixed';
      seeds.push({
        doc,
        date: day.toISOString().slice(0, 19),
        debt: 0,
        payment: Math.round((200 + rnd() * 4500)) * 1000,
        method,
        type: 'payment',
        typeLabel: 'Оплата',
        opName: 'Приём оплаты',
        orderType: 'Оплата',
        exp: '',
        comment: `Оплата долга Korzinka Go-${branch}`,
        txComment: 'Приход в кассу',
        createdBy: rnd() < 0.6 ? 'KASSIR 1' : 'ADMIN SKLAD',
      });
    } else if (r < 0.95) {
      // Return
      seeds.push({
        doc,
        date: day.toISOString().slice(0, 19),
        debt: 0,
        payment: Math.round((50 + rnd() * 900)) * 1000,
        method: 'terminal',
        type: 'return',
        typeLabel: 'Возврат',
        opName: 'Возврат товара',
        orderType: 'Возврат',
        exp: expeditors[Math.floor(rnd() * expeditors.length)],
        comment: `Vozvrat Korzinka Go-${branch}`,
        txComment: 'Возврат по накладной',
        createdBy: 'Dastavka Set',
      });
    } else {
      // Correction / debt adjustment
      const isAdj = rnd() < 0.5;
      const amt = Math.round((30 + rnd() * 600)) * 1000 * (rnd() < 0.5 ? -1 : 1);
      seeds.push({
        doc,
        date: day.toISOString().slice(0, 19),
        debt: amt < 0 ? amt : 0,
        payment: amt > 0 ? amt : 0,
        method: 'transfer',
        type: isAdj ? 'debt_adjustment' : 'correction',
        typeLabel: isAdj ? 'Корр. долга' : 'Корректировка',
        opName: isAdj ? 'Корректировка долга' : 'Ручная корректировка',
        orderType: 'Корректировка',
        exp: '',
        comment: `Корректировка баланса ${branch}`,
        txComment: 'Согласовано с бухгалтерией',
        createdBy: 'ADMIN SKLAD',
      });
    }
  }
  return seeds;
}

function buildTransactions(): DebtTransaction[] {
  const seeds = generateSeeds();
  const rnd = mulberry32(777);
  // running balance: newest row balance = -11 462 331 143
  let balance = -11_462_331_143;
  const list: DebtTransaction[] = [];

  seeds.forEach((s, i) => {
    const tx: DebtTransaction = {
      id: 178 - i,
      docNumber: s.doc,
      createdAt: s.date,
      type: s.type,
      typeLabel: s.typeLabel,
      operationName: s.opName,
      orderType: s.orderType,
      consignment: s.type === 'order' ? rnd() < 0.08 && i > 9 : false,
      debt: s.debt,
      payment: s.payment,
      balanceAfter: balance,
      paymentMethod: s.method,
      agent: 'SET (XOTAM AKA) OTCHET',
      expeditor: s.exp,
      cashbox: s.type === 'payment' ? cashboxes[Math.floor(rnd() * cashboxes.length)] : '',
      comment: s.comment,
      txComment: s.txComment,
      createdBy: s.createdBy,
      isSystem: s.type === 'correction' || s.type === 'debt_adjustment',
      audit: [
        { at: s.date, user: s.createdBy, action: 'Создание записи' },
        { at: s.date, user: 'SYSTEM', action: 'Пересчёт баланса клиента' },
        { at: s.date, user: 'SYSTEM', action: 'Проводка в главную книгу (GL)' },
      ],
    };
    list.push(tx);
    // balance before this row = balance - debt - payment
    balance = balance - s.debt - s.payment;
  });

  return list;
}

export const allTransactions: DebtTransaction[] = buildTransactions();
