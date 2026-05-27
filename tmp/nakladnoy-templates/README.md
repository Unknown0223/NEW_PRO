# 🏢 SavdoDesk Nakladnoy Shablon Generator

Excel nakladnoy shablonlarini **XML muammolarisiz** yaratish va tuzatish tizimi.

## 🎯 Maqsad

Sizning loyihangizda Excel fayllarini generatsiya qilishda quyidagi muammolar bor edi:
- ❌ XML komponentlarida xatolar
- ❌ ExcelJS kutubxonasining DPI muammosi (4294967295)
- ❌ Noto'g'ri merge cell lar (C2:C2)
- ❌ Invalid XML belgilar

Bu tizim **barcha muammolarni hal qiladi** va 13 ta shablon turini to'g'ri yaratadi.

## 📁 Struktura

```
nakladnoy-templates/
├── excel-generator-fixed.ts         # Asosiy tuzatuvchi engine
├── all-templates-generator.ts       # 110-600 shablon generator
├── remaining-templates.ts           # 601-704 shablon generator
├── generate-all-templates.ts        # Barcha shablon larni yaratish
├── repair-existing-files.ts         # Mavjud fayllarni tuzatish
├── test-templates.ts                # Test va validatsiya
├── package.json                     # Dependencies
├── tsconfig.json                    # TypeScript config
└── output/                          # Yaratilgan shablon lar
```

## 🚀 O'rnatish

```bash
cd nakladnoy-templates
npm install
```

## 📝 Foydalanish

### 1. Barcha shablon larni yaratish

```bash
npm run generate:all
```

Bu komanda `output/` papkasida 13 ta to'g'ri shablon yaratadi:

- ✅ 110-wh-template.xlsx - Catalog Dual (SKU + Barcode)
- ✅ 112-wh-template.xlsx - List Simple
- ✅ 410-wh-template.xlsx - TTN Grouped 4.1
- ✅ 411-wh-template.xlsx - TTN Grouped 4.1.1
- ✅ 412-wh-template.xlsx - TTN Grouped 4.1.2
- ✅ 600-wh-template.xlsx - Matrix Agents
- ✅ 601-wh-template.xlsx - Matrix Clients
- ✅ 602-wh-template.xlsx - Summary Clients
- ✅ 700-wh-template.xlsx - Summary Compact
- ✅ 701-wh-template.xlsx - Per Expeditor
- ✅ 702-wh-template.xlsx - Thermal Printer (80mm)
- ✅ 703-wh-template.xlsx - Territory Matrix
- ✅ 704-wh-template.xlsx - Category Client

### 2. Bitta shablon yaratish

```bash
npm run generate:110  # 110 shablon
npm run generate:600  # 600 shablon
npm run generate:704  # 704 shablon
```

### 3. Mavjud fayllarni tuzatish

```bash
# Bitta faylni tuzatish
npm run repair -- path/to/file.xlsx

# Ko'p fayllarni tuzatish
npm run repair -- file1.xlsx file2.xlsx file3.xlsx

# Papkadagi barcha fayllarni tuzatish
npm run repair -- --dir /path/to/directory
```

### 4. Shablon larni test qilish

```bash
npm run test
```

Bu komanda:
- ✅ XML strukturasini tekshiradi
- ✅ Invalid merge cell larni topadi
- ✅ DPI muammolarini aniqlaydi
- ✅ Invalid belgilarni topadi
- 📄 JSON hisobot yaratadi

## 🛠️ Asosiy Xususiyatlar

### Excel Generator Fixed (`excel-generator-fixed.ts`)

```typescript
import { 
  createSafeExcelFile,
  repairExistingFile,
  sanitizeCellValue 
} from './excel-generator-fixed';

// Yangi fayl yaratish
await createSafeExcelFile('output.xlsx', async (wb) => {
  const ws = wb.addWorksheet('Sheet1');
  ws.getCell('A1').value = 'Hello';
  // ... boshqa kod
});

// Mavjud faylni tuzatish
await repairExistingFile('input.xlsx', 'output.xlsx');
```

### Tuzatishlar

1. **XML Invalid Characters**
   ```typescript
   sanitizeCellValue(value);
   // \x00-\x08, \x0B, \x0C, \x0E-\x1F olib tashlanadi
   ```

2. **ExcelJS Bad DPI**
   ```typescript
   stripInvalidPageSetupDpi(worksheet);
   // 4294967295 → undefined
   ```

3. **Invalid Merge Cells**
   ```typescript
   repairInvalidMerges(worksheet);
   // C2:C2 kabi merge lar olib tashlanadi
   ```

4. **Shared Strings va Styles**
   ```typescript
   await wb.xlsx.writeFile(path, {
     useStyles: true,
     useSharedStrings: true
   });
   ```

## 📊 Shablon Tiplari

### 1. Catalog Dual (110)
- **Ustunlar:** №, SKU, Штрих-код, Продукт, Кол-во, Бонус, Цена, Сумма
- **Xususiyat:** Ikki turdagi kod ko'rsatiladi
- **Layout:** Portrait

### 2. List Simple (112)
- **Ustunlar:** №, Код, Продукт, Кол-во, Бонус, Цена, Сумма
- **Xususiyat:** Oddiy ro'yxat
- **Layout:** Portrait

### 3. TTN Grouped (410, 411, 412)
- **Ustunlar:** №, Код, Продукт, Кол-во, Бонус, Цена, Сумма
- **Xususiyat:** TTN nomeri va gruppalar
- **Layout:** Portrait

### 4. Matrix Agents (600)
- **Ustunlar:** Продукт, Цена, Agent1, Agent2, ...
- **Xususiyat:** Agent bo'yicha matritsa
- **Layout:** Landscape

### 5. Matrix Clients (601)
- **Ustunlar:** Продукт, Цена, Client1, Client2, ...
- **Xususiyat:** Mijoz bo'yicha matritsa
- **Layout:** Landscape

### 6. Summary Clients (602)
- **Ustunlar:** №, Клиент, Телефон, Кол-во, Бонус, Цена, Сумма
- **Xususiyat:** Mijozlar yig'indisi
- **Layout:** Portrait

### 7. Summary Compact (700)
- **Ustunlar:** №, Код, Продукт, Кол-во, Цена, Сумма
- **Xususiyat:** Ixcham format
- **Layout:** Portrait

### 8. Per Expeditor (701)
- **Ustunlar:** №, Код, Продукт, Кол-во, Бонус, Цена, Сумма
- **Xususiyat:** Ekspeditor bo'yicha
- **Layout:** Portrait

### 9. Thermal Printer (702)
- **Ustunlar:** №, Продукт, Кол-во, Сумма
- **Xususiyat:** 80mm termal printer uchun
- **Layout:** Custom (narrow)

### 10. Territory Matrix (703)
- **Ustunlar:** Продукт, Terr1, Terr2, ...
- **Xususiyat:** Hudud bo'yicha matritsa
- **Layout:** Landscape

### 11. Category Client (704)
- **Ustunlar:** №, Код, Продукт, Клиент, Кол-во, Бонус, Цена, Сумма
- **Xususiyat:** Kategoriya + Mijoz
- **Layout:** Portrait

## 🔧 Loyihangizga integratsiya

### Backend ga qo'shish

1. Tuzatilgan fayllarni backend ga ko'chirish:
```bash
cp excel-generator-fixed.ts ../backend/src/modules/orders/
```

2. Mavjud kodni yangilash:
```typescript
// Eski
import { buildNakladnoyXlsx } from './order-nakladnoy-xlsx';

// Yangi
import { createSafeExcelFile } from './excel-generator-fixed';
import { buildLoadingSheetWorkbook } from './order-nakladnoy-xlsx.loading';

// Xavfsiz generatsiya
const buffer = await createSafeExcelFile(outputPath, async (wb) => {
  await buildLoadingSheetWorkbook(wb, orders, options);
});
```

3. Shablon larni assets ga ko'chirish:
```bash
cp output/*.xlsx ../backend/assets/nakladnoy/warehouse/
```

## 📋 To-Do List

### Bajarilgan ✅
- [x] XML muammolarini hal qilish
- [x] ExcelJS DPI muammosini tuzatish
- [x] Invalid merge cell larni to'g'rilash
- [x] 13 ta shablon yaratish
- [x] Test tizimi
- [x] Repair tool
- [x] Dokumentatsiya

### Keyingi qadamlar 🚀
- [ ] Backend ga integratsiya
- [ ] Ma'lumot to'ldirish funksiyalari
- [ ] Dynamic template selection
- [ ] PDF eksport qo'shish
- [ ] Email yuborish
- [ ] Bulk generation

## 🐛 Xatoliklar va Muammolar

Agar muammo topsangiz:

1. **XML xatosi:**
   - `repair-existing-files.ts` dan foydalaning
   - Cell value larni sanitize qiling

2. **DPI muammosi:**
   - `stripInvalidPageSetupDpi()` ishlayotganini tekshiring
   - PageSetup ni to'g'ri sozlang

3. **Merge cell xatosi:**
   - `repairInvalidMerges()` chaqiring
   - Faqat har xil hujaylarni merge qiling

## 📞 Yordam

Savollar bo'lsa:
- 📧 Email: [sizning email]
- 💬 Telegram: @[sizning_username]

## 📄 Litsenziya

MIT

---

**Muhim:** Bu tizim SavdoDesk loyihasi uchun maxsus yaratilgan. Barcha shablon lar Uzbekiston nakladnoy formatiga moslashtirilgan.

## 🎉 Natija

Ushbu tizim yordamida:
- ✅ Barcha XML muammolar hal qilindi
- ✅ 13 ta to'g'ri shablon yaratildi
- ✅ Mavjud fayllarni tuzatish mumkin
- ✅ Test va validatsiya mavjud
- ✅ Backend ga integratsiya oson

**Loyihangiz endi muammosiz ishlaydi! 🚀**
