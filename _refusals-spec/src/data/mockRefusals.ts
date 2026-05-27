import { Refusal } from '../types/refusal';

export const REFUSAL_REASON_LABELS: Record<string, string> = {
  stock_enough: 'Лалаку махсулоти етарлик даражада бор',
  client_closed: 'Клиент ёпиқ',
  no_money: 'Пул йўқ',
  competitor: 'Конкурент товар олган',
  later: 'Кейинроқ олади',
};

export const REFUSAL_REASON_COLORS: Record<string, string> = {
  stock_enough: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  client_closed: 'bg-gray-100 text-gray-700 border-gray-200',
  no_money: 'bg-red-100 text-red-700 border-red-200',
  competitor: 'bg-orange-100 text-orange-700 border-orange-200',
  later: 'bg-blue-100 text-blue-700 border-blue-200',
};

export const mockRefusals: Refusal[] = [
  {
    id: '1',
    client: { id: 'c1', name: 'ABOBA' },
    agent: { id: 'u1', code: 'MONNOQQ01', name: 'MAMAJONOV RASULJON' },
    reason: 'stock_enough',
    territory: 'BOZOR',
    createdAt: '2026-05-26',
  },
  {
    id: '2',
    client: { id: 'c2', name: 'MAXLIYO APA' },
    agent: { id: 'u1', code: 'MONNOQQ01', name: 'MAMAJONOV RASULJON' },
    reason: 'stock_enough',
    territory: 'BOZOR',
    createdAt: '2026-05-26',
  },
  {
    id: '3',
    client: { id: 'c3', name: 'SALOHIDDIN' },
    agent: { id: 'u1', code: 'MONNOQQ01', name: 'MAMAJONOV RASULJON' },
    reason: 'stock_enough',
    territory: 'BOZOR',
    createdAt: '2026-05-26',
  },
  {
    id: '4',
    client: { id: 'c4', name: 'ABDULATIF AKA NAMANGAN PETE YONI' },
    agent: { id: 'u2', code: 'QQLLK-04', name: 'ILYASOV XOTAM QUQON BOZOR 14/10' },
    reason: 'stock_enough',
    territory: 'BOZOR',
    createdAt: '2026-05-26',
  },
  {
    id: '5',
    client: { id: 'c4', name: 'ABDULATIF AKA NAMANGAN PETE YONI' },
    agent: { id: 'u3', code: '03-GGKK004', name: 'MADAMINOV NUMONJON 20/08' },
    reason: 'stock_enough',
    territory: 'BOZOR',
    createdAt: '2026-05-26',
  },
  {
    id: '6',
    client: { id: 'c5', name: 'MUZAFFAR SAVDO MAHALLA 16-DUKON' },
    agent: { id: 'u1', code: 'MONNOQQ01', name: 'MAMAJONOV RASULJON' },
    reason: 'client_closed',
    territory: 'BOZOR',
    createdAt: '2026-05-26',
  },
  {
    id: '7',
    client: { id: 'c6', name: 'IPAK YULI 24-2' },
    agent: { id: 'u4', code: 'JSQQ 002', name: 'MAXKAMOV AZIZXON (BOZOR) SVR SHAXNOZA LLLL 01.05.2026' },
    reason: 'no_money',
    territory: 'BOZOR',
    createdAt: '2026-05-26',
  },
  {
    id: '8',
    client: { id: 'c7', name: 'IPAK YOLI 24-1' },
    agent: { id: 'u4', code: 'JSQQ 002', name: 'MAXKAMOV AZIZXON (BOZOR) SVR SHAXNOZA LLLL 01.05.2026' },
    reason: 'competitor',
    territory: 'BOZOR',
    createdAt: '2026-05-26',
  },
  {
    id: '9',
    client: { id: 'c8', name: 'OZBEGIM' },
    agent: { id: 'u4', code: 'JSQQ 002', name: 'MAXKAMOV AZIZXON (BOZOR) SVR SHAXNOZA LLLL 01.05.2026' },
    reason: 'later',
    territory: 'BOZOR',
    createdAt: '2026-05-26',
  },
  {
    id: '10',
    client: { id: 'c9', name: 'IPAK YOLI 18-12' },
    agent: { id: 'u4', code: 'JSQQ 002', name: 'MAXKAMOV AZIZXON (BOZOR) SVR SHAXNOZA LLLL 01.05.2026' },
    reason: 'stock_enough',
    territory: 'BOZOR',
    createdAt: '2026-05-26',
  },
  {
    id: '11',
    client: { id: 'c10', name: 'ANVAR BOZOR' },
    agent: { id: 'u1', code: 'MONNOQQ01', name: 'MAMAJONOV RASULJON' },
    reason: 'no_money',
    territory: 'YANGI BOZOR',
    createdAt: '2026-05-25',
  },
  {
    id: '12',
    client: { id: 'c11', name: 'GULNORA SHOP' },
    agent: { id: 'u2', code: 'QQLLK-04', name: 'ILYASOV XOTAM QUQON BOZOR 14/10' },
    reason: 'competitor',
    territory: 'MARKAZIY',
    createdAt: '2026-05-25',
  },
  {
    id: '13',
    client: { id: 'c12', name: 'SARVAR SAVDO' },
    agent: { id: 'u3', code: '03-GGKK004', name: 'MADAMINOV NUMONJON 20/08' },
    reason: 'client_closed',
    territory: 'SHIMOL',
    createdAt: '2026-05-25',
  },
  {
    id: '14',
    client: { id: 'c13', name: 'HAMID DUKON' },
    agent: { id: 'u1', code: 'MONNOQQ01', name: 'MAMAJONOV RASULJON' },
    reason: 'later',
    territory: 'BOZOR',
    createdAt: '2026-05-24',
  },
  {
    id: '15',
    client: { id: 'c14', name: 'NARGIZA MARKET' },
    agent: { id: 'u4', code: 'JSQQ 002', name: 'MAXKAMOV AZIZXON (BOZOR) SVR SHAXNOZA LLLL 01.05.2026' },
    reason: 'stock_enough',
    territory: 'JANUB',
    createdAt: '2026-05-24',
  },
  // More entries to reach 154 total (simulated)
  ...Array.from({ length: 139 }, (_, i) => ({
    id: String(i + 16),
    client: {
      id: `c${i + 15}`,
      name: ['ALIBEK DUKON', 'ZULFIYA MARKET', 'OTABEK SAVDO', 'FERUZA SHOP', 'BAHODIR BOZOR'][i % 5],
    },
    agent: {
      id: `u${(i % 4) + 1}`,
      code: ['MONNOQQ01', 'QQLLK-04', '03-GGKK004', 'JSQQ 002'][i % 4],
      name: [
        'MAMAJONOV RASULJON',
        'ILYASOV XOTAM QUQON BOZOR 14/10',
        'MADAMINOV NUMONJON 20/08',
        'MAXKAMOV AZIZXON (BOZOR) SVR SHAXNOZA LLLL 01.05.2026',
      ][i % 4],
    },
    reason: (['stock_enough', 'client_closed', 'no_money', 'competitor', 'later'] as const)[i % 5],
    territory: ['BOZOR', 'YANGI BOZOR', 'MARKAZIY', 'SHIMOL', 'JANUB'][i % 5],
    createdAt: `2026-05-${String(Math.max(1, 26 - Math.floor(i / 10))).padStart(2, '0')}`,
  })),
];

export const agentOptions = [
  { value: 'u1', label: 'MONNOQQ01 - MAMAJONOV RASULJON' },
  { value: 'u2', label: 'QQLLK-04 - ILYASOV XOTAM' },
  { value: 'u3', label: '03-GGKK004 - MADAMINOV NUMONJON' },
  { value: 'u4', label: 'JSQQ 002 - MAXKAMOV AZIZXON' },
];

export const reasonOptions = [
  { value: 'stock_enough', label: 'Лалаку махсулоти етарлик даражада бор' },
  { value: 'client_closed', label: 'Клиент ёпиқ' },
  { value: 'no_money', label: 'Пул йўқ' },
  { value: 'competitor', label: 'Конкурент товар олган' },
  { value: 'later', label: 'Кейинроқ олади' },
];

export const clientCategoryOptions = [
  { value: 'vip', label: 'VIP' },
  { value: 'regular', label: 'Обычный' },
  { value: 'new', label: 'Новый' },
  { value: 'inactive', label: 'Неактивный' },
];

export const zoneOptions = [
  { value: 'bozor', label: 'BOZOR' },
  { value: 'yangi_bozor', label: 'YANGI BOZOR' },
  { value: 'markaziy', label: 'MARKAZIY' },
  { value: 'shimol', label: 'SHIMOL' },
  { value: 'janub', label: 'JANUB' },
];

export const regionOptions = [
  { value: 'andijan', label: 'Андижанская' },
  { value: 'fergana', label: 'Ферганская' },
  { value: 'namangan', label: 'Наманганская' },
  { value: 'tashkent', label: 'Ташкентская' },
];

export const cityOptions = [
  { value: 'andijan', label: 'Андижан' },
  { value: 'fergana', label: 'Фергана' },
  { value: 'namangan', label: 'Наманган' },
  { value: 'tashkent', label: 'Ташкент' },
  { value: 'quqon', label: 'Қўқон' },
];
