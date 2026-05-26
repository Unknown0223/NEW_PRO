export interface OrderVersion {
  date: string;
  client: string;
  agent: string;
  expediter: string;
  shipDate: string;
  deliveryDate: string;
  consignation: string;
  consignationDeadline: string;
  priceType: string;
  quantity: string;
  volume: string;
  sum: string;
  warehouse: string;
  tradeDirection: string;
  returnDate: string;
  comment: string;
  createdBy: string;
  updatedBy: string;
  status: string;
  statusKey: 'NEW' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED';
}

export interface ProductItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  volume: number;
  total: number;
}

export interface BonusEntry {
  id: string;
  date: string;
  bonusName: string;
  product: string;
  quantity: number;
  action: 'Создано' | 'Изменено' | 'Удалено';
  user: string;
}

export const orderId = '1419859';

// 4 versions (4 columns in the table)
export const orderVersions: OrderVersion[] = [
  {
    date: '25.05.2026 15:55:24',
    client: '4-101 Boriboyev R.S',
    agent: "O'RIKZOR DILLER MONNO\n[MAXAMADALIYEV ABDUQODIR]\n07/04/26",
    expediter: '',
    shipDate: '',
    deliveryDate: '',
    consignation: 'Нет',
    consignationDeadline: '',
    priceType: 'NAQD PUL',
    quantity: '28',
    volume: '0',
    sum: '3 696 000',
    warehouse: 'Monno Diller',
    tradeDirection: 'UMUMIY',
    returnDate: '',
    comment: '',
    createdBy: "O'RIKZOR DILLER MONNO\n[MAXAMADALIYEV ABDUQODIR]\n07/04/26",
    updatedBy: "O'RIKZOR DILLER MONNO\n[MAXAMADALIYEV ABDUQODIR]\n07/04/26",
    status: 'Новый',
    statusKey: 'NEW',
  },
  {
    date: '26.05.2026 09:46:43',
    client: '',
    agent: '',
    expediter: '',
    shipDate: '',
    deliveryDate: '',
    consignation: '',
    consignationDeadline: '',
    priceType: '',
    quantity: '',
    volume: '',
    sum: '',
    warehouse: '',
    tradeDirection: '',
    returnDate: '',
    comment: '',
    createdBy: '',
    updatedBy: 'OPERATOR Monno Dller',
    status: 'Подтвержден к отгрузке',
    statusKey: 'CONFIRMED',
  },
  {
    date: '26.05.2026 09:46:50',
    client: '',
    agent: '',
    expediter: '',
    shipDate: '26.05.2026 09:46:00',
    deliveryDate: '',
    consignation: '',
    consignationDeadline: '',
    priceType: '',
    quantity: '',
    volume: '',
    sum: '',
    warehouse: '',
    tradeDirection: '',
    returnDate: '',
    comment: '',
    createdBy: '',
    updatedBy: 'OPERATOR Monno Dller',
    status: 'Отгружен',
    statusKey: 'SHIPPED',
  },
  {
    date: '26.05.2026 09:46:59',
    client: '',
    agent: '',
    expediter: '',
    shipDate: '',
    deliveryDate: '26.05.2026 09:47:00',
    consignation: '',
    consignationDeadline: '',
    priceType: '',
    quantity: '',
    volume: '',
    sum: '',
    warehouse: '',
    tradeDirection: '',
    returnDate: '',
    comment: '',
    createdBy: '',
    updatedBy: 'OPERATOR Monno Dller',
    status: 'Доставлен',
    statusKey: 'DELIVERED',
  },
];

export const products: ProductItem[] = [
  {
    id: 'p1',
    name: 'Monno trusik mega N4.(70)',
    quantity: 6,
    price: 132000,
    volume: 0,
    total: 792000,
  },
  {
    id: 'p2',
    name: 'Monno trusik mega N6.(56)',
    quantity: 11,
    price: 132000,
    volume: 0,
    total: 1452000,
  },
  {
    id: 'p3',
    name: 'Monno trusik mega N5.(60)',
    quantity: 11,
    price: 132000,
    volume: 0,
    total: 1452000,
  },
];

export const bonusHistory: BonusEntry[] = [
  {
    id: 'b1',
    date: '2026.05.25 03:55',
    bonusName: '4+1 Monno Mega',
    product: 'Monno trusik mega N5.(60)',
    quantity: 3,
    action: 'Создано',
    user: "O'RIKZOR DILLER MONNO [MAXAMADALIYEV ABDUQODIR] 07/04/26",
  },
  {
    id: 'b2',
    date: '2026.05.25 03:55',
    bonusName: '4+1 Monno Mega',
    product: 'Monno trusik mega N6.(56)',
    quantity: 4,
    action: 'Создано',
    user: "O'RIKZOR DILLER MONNO [MAXAMADALIYEV ABDUQODIR] 07/04/26",
  },
];
