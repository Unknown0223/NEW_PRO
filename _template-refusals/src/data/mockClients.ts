export interface Client {
  id: string;
  name: string;
  companyName: string;
  phone: string;
  agents: string[];
  format: string;
  days: string[];
  region: string;
  city: string;
  zone: string;
  address: string;
  category: string;
  landmark: string;
  active: boolean;
  location?: string;
  code?: string;
  qtyOrders?: number;
  qtyPurchase?: number;
  expeditors: string[];
  inn?: string;
  contactPerson?: string;
  priceType?: string;
  balance?: number;
  allowConsignment?: string;
  allowDebt?: string;
  barcode?: string;
  mfo?: string;
  comment?: string;
  typeTT?: string;
  salesChannel?: string;
  contractNo?: number;
  pinfl?: string;
  createdAt?: string;
  createdBy?: string;
}

export const MOCK_CLIENTS: Client[] = [
  {
    id: 'oq_22140',
    name: '0002 OZIQ OVQAT',
    companyName: '0002 OZIQ OVQAT',
    phone: '+998 (90) 020-00-04',
    agents: [
      'JSFA S 003 [XALMATOVA OYDIN](TOSHLOQ) SVR SHOXRUX LLLL 01.04.2026 (Чт)',
      'FALLK (U) TP - 03 [GULOMOV SHOXRUXBEK] 01.05.2026 (Вт)',
      '04 - OGFA007 - [ERGASHEV OYBEK] 08/08 (Чт, Пт)',
      'JYFA-005 [VACANT] (Сб)',
      'ECARFA [ABDUSATTOROV ABDULBOSIT] LLLL 06.12.2025 (Вт)',
      'SUVFA 06 [VAKANT] LLLL (Вт)',
      'LMJFA S [ABDUQAXXOROVA NAROIZAXON] (Чт)',
      'MONNOFA01 - [ABDULKAYEV AZAMJON] 04/02/26 (Пн, Вт, Ср, Чт, Пт, Сб)',
    ],
    format: 'Superettes',
    days: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
    region: 'FARGONA VILOYATI',
    city: 'TOSHLOQ',
    zone: 'FV',
    address: 'QODIROV MIRJALOL',
    category: 'C',
    landmark: 'SOMON BOZORI OLDI',
    active: true,
    location: '📍',
    code: '85',
    qtyOrders: 85,
    qtyPurchase: 93,
    expeditors: ['TILAVOLDIYEV FAR RAHMIDDIN', 'TILAVOLDIYEV FAR RAHMIDDIN', 'ещё 6'],
    inn: '305 843 008',
    contactPerson: '+998 (90) 584-00-02',
    priceType: '',
    balance: 5000,
    allowConsignment: 'Есть',
    allowDebt: 'Есть',
    barcode: '',
    mfo: '',
    comment: '',
    typeTT: 'FOOD-HPC',
    salesChannel: 'TRAD TRADE',
    contractNo: 0,
    pinfl: '',
    createdAt: '07.10.2024 14:31',
    createdBy: 'Botirov Anvar',
  },
  {
    id: 'ss_22085',
    name: '0004 ZIKIRILLO',
    companyName: 'SOTVOLDIYEV ZIKIRILLO YATT',
    phone: '+998 (90) 020-00-04',
    agents: [
      'JSFA N 002 [MIRZAYEVA AQIDAXON] 08.07 (FAR 3, BOZOR) SVR NIGORA LLLL (Пн, Вт, Ср, Чт, Пт, Сб)',
      'FALLK (U) TRZ-KOMBINAT [XOLMATOV MUHAMMADYUNUS] 01.05.2026 (Пн, Вт, Ср, Чт, Пт, Сб)',
      '01 - MRBZ001 - [MARG\'ILON KOMBINAT] OG (Пн, Вт, Ср, Чт, Пт, Сб)',
      'JYFA -004 [VACANT] (Пн, Вт, Ср, Чт, Пт, Сб)',
      'ECARFA [HAMRALIEV ABDUSHUKUR] LLLL (Пн, Вт, Ср, Чт, Пт, Сб)',
      'SUVFA 06 [VAKANT] LLLL (Пн, Вт, Ср, Чт, Пт, Сб)',
      'LMJFA N [MASHRABJONOVA DILAFRUZ] (Пн, Вт, Ср, Чт, Пт, Сб)',
      'MONNOFA02 - [UMURZAKOVA ZEBO] 11/05/26 (Пн, Вт, Ср, Чт, Пт)',
    ],
    format: 'Perfumery',
    days: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
    region: 'FARGONA VILOYATI',
    city: 'MARGLON TRZ',
    zone: 'FV',
    address: 'HIYOBON KOCHA 194',
    category: 'C',
    landmark: 'TIM ICHI',
    active: true,
    location: '📍',
    code: '90',
    qtyOrders: 90,
    qtyPurchase: 104,
    expeditors: ['YOLDOSHEV JAVHAR', 'YUSUFALIYEV FAR ABDULLOH', 'ещё 6'],
    inn: '948 856 334',
    contactPerson: '',
    priceType: '',
    balance: 0,
    allowConsignment: 'Есть',
    allowDebt: 'Есть',
    barcode: '',
    mfo: '',
    comment: '',
    typeTT: 'FOOD-HPC',
    salesChannel: 'TRAD TRADE',
    contractNo: 0,
    pinfl: '',
    createdAt: '05.10.2024 15:33',
    createdBy: 'Botirov Anvar',
  },
  {
    id: 'ht_19089',
    name: '000 ISTEMTUR',
    companyName: '000 ISTEMTUR',
    phone: '+998 (90) 132-40-44',
    agents: [
      'JSTSH S [SOIPOVA MUSHTARIY] ЯНГИ ЙУЛ SVR SALOXIDDIN LLLL 01.04.2026 (Сб)',
      '05 (ELDAR) OGTO103 - [JORAXOJAYEV JAVOXIRXOJA] [ZANGIOTA/YANGIYO\'L] 04/12 (Ср)',
      'LMJTSH M [TULAGANOVA NASIBA] 21/07 [YANGI YO\'L] (Пт)',
      'TSH-1 SARDORBEK AGENT - 05 [NOZIMOV XONDAMIR] YANGI YO\'L 02.03.2026 (Ср)',
      'MONNOT006 [MIJDABAYEVA SAULE] [YANGI YUL TUMANI] SRG 02/03/26 (Сб)',
    ],
    format: 'Supermarket',
    days: ['Ср', 'Пт', 'Сб'],
    region: 'SERGELI FILIAL',
    city: 'YANGI YUL',
    zone: 'TOSHKENT',
    address: 'YANGIYUL',
    category: 'C',
    landmark: 'Masiv sherzod marketga etmasdan',
    active: true,
    location: '📍',
    code: '23',
    qtyOrders: 23,
    qtyPurchase: 23,
    expeditors: ['05-BLOK XIDIROV JONIBEK (YANGIYO\'L)', '05-BLOK XIDIROV JONIBEK (YANGIYO\'L)', 'ещё 3'],
    inn: '204 611 995',
    contactPerson: '',
    priceType: '',
    balance: 0,
    allowConsignment: 'Есть',
    allowDebt: 'Есть',
    barcode: '',
    mfo: '',
    comment: '',
    typeTT: 'FOOD-HPC',
    salesChannel: 'TRAD TRADE',
    contractNo: 0,
    pinfl: '',
    createdAt: '14.09.2024 12:12',
    createdBy: 'Botirov Anvar',
  },
];
