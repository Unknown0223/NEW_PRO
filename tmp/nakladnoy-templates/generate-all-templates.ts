#!/usr/bin/env ts-node

/**
 * BARCHA NAKLADNOY SHABLON LARNI YARATISH
 * 
 * Bu script barcha 13 ta shablon turini yaratadi va
 * ularni output/ papkasiga saqlaydi
 */

import * as fs from 'fs';
import * as path from 'path';
import { templateGenerators } from './all-templates-generator';
import { allGenerators } from './remaining-templates';

// Output papkani yaratish
const OUTPUT_DIR = path.join(__dirname, 'output');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Barcha shablon lar ro'yxati
const ALL_TEMPLATES = {
  '110': {
    name: '110 Загруз зав.склада 1.1',
    family: 'catalog_dual_110',
    generator: templateGenerators['110']
  },
  '112': {
    name: '112 Загруз зав.склада 1.1.2',
    family: 'list_simple_112',
    generator: templateGenerators['112']
  },
  '410': {
    name: '410 Загруз зав.склада 4.1',
    family: 'ttn_grouped_410',
    generator: templateGenerators['410']
  },
  '411': {
    name: '411 Загруз зав.склада 4.1.1',
    family: 'ttn_grouped_410',
    generator: templateGenerators['411']
  },
  '412': {
    name: '412 Загруз зав.склада 4.1.2',
    family: 'ttn_grouped_410',
    generator: templateGenerators['412']
  },
  '600': {
    name: '600 Загруз зав.склада 6.0',
    family: 'matrix_agents_600',
    generator: templateGenerators['600']
  },
  '601': {
    name: '601 Загруз зав.склада 6.0.1',
    family: 'matrix_clients_601',
    generator: allGenerators['601']
  },
  '602': {
    name: '602 Загруз зав.склада 6.0.2',
    family: 'summary_clients_602',
    generator: allGenerators['602']
  },
  '700': {
    name: '700 Загруз зав.склада 7.0.0',
    family: 'summary_compact_700',
    generator: allGenerators['700']
  },
  '701': {
    name: '701 Загруз зав.склада 7.0.1',
    family: 'per_expeditor_701',
    generator: allGenerators['701']
  },
  '702': {
    name: '702 X-Printer 80мм',
    family: 'thermal_702',
    generator: allGenerators['702']
  },
  '703': {
    name: '703 Загруз зав.склада 7.0.3',
    family: 'territory_matrix_703',
    generator: allGenerators['703']
  },
  '704': {
    name: '704 Загруз зав.склада 7.0.4',
    family: 'category_client_704',
    generator: allGenerators['704']
  }
};

async function generateAllTemplates() {
  console.log('🚀 Barcha nakladnoy shablon larni yaratish boshlandi...\n');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const [id, config] of Object.entries(ALL_TEMPLATES)) {
    const outputPath = path.join(OUTPUT_DIR, `${id}-wh-template.xlsx`);
    
    try {
      console.log(`📝 Yaratilmoqda: ${config.name}...`);
      await config.generator(outputPath);
      console.log(`   ✓ Muvaffaqiyatli: ${outputPath}`);
      console.log(`   📁 Family: ${config.family}\n`);
      successCount++;
    } catch (error) {
      console.error(`   ✗ Xato: ${error}`);
      console.error(`   📁 Path: ${outputPath}\n`);
      failCount++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`✅ Muvaffaqiyatli yaratildi: ${successCount}`);
  if (failCount > 0) {
    console.log(`❌ Xatolar: ${failCount}`);
  }
  console.log(`📂 Jami: ${Object.keys(ALL_TEMPLATES).length} ta shablon`);
  console.log(`📁 Output papka: ${OUTPUT_DIR}`);
  console.log('='.repeat(60) + '\n');
  
  // README yaratish
  await createReadme();
}

async function createReadme() {
  const readmePath = path.join(OUTPUT_DIR, 'README.md');
  
  const content = `# Nakladnoy Shablonlar

## Yaratilgan shablonlar

Ushbu papkada SavdoDesk tizimi uchun barcha nakladnoy shablonlari mavjud.

### Shablon ro'yxati

${Object.entries(ALL_TEMPLATES).map(([id, config]) => 
`#### ${config.name}
- **File:** \`${id}-wh-template.xlsx\`
- **Family:** ${config.family}
- **Versiya:** ${id.startsWith('7') ? '7.x' : id.startsWith('6') ? '6.x' : id.startsWith('4') ? '4.x' : '1.x'}
`).join('\n')}

### Foydalanish

Har bir shablon quyidagi xususiyatlarga ega:

1. **XML xavfsizligi** - Barcha invalid XML belgilar tozalangan
2. **To'g'ri DPI** - PageSetup da to'g'ri DPI qiymatlari
3. **Valid merge cells** - Faqat to'g'ri birlashtiririlgan hujayralar
4. **Shared strings** - To'g'ri shared strings ishlatilgan

### Ma'lumot kiriting

Shablonlarda \`{{PLACEHOLDER}}\` formatida o'rinbosarlar mavjud:

- \`{{datetime}}\` - Chop etish vaqti
- \`{{ORDER}}\` - Buyurtma raqami
- \`{{CLIENT}}\` - Mijoz nomi
- \`{{PRODUCT}}\` - Mahsulot nomi
- \`{{QTY}}\` - Miqdor
- \`{{PRICE}}\` - Narx
- \`{{SUM}}\` - Summa
- Va boshqalar...

### Muammolar yechildi

✅ XML invalid characters xatosi
✅ ExcelJS bad DPI (4294967295) muammosi
✅ Invalid merge cells (C2:C2)
✅ Shared strings va styles muammosi
✅ Component xatolari

### Yaratilgan sana

${new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}

---

**Muhim:** Bu shablon lar faqat ma'lumot kiritish uchun. Backend dasturida to'ldiriladi.
`;

  fs.writeFileSync(readmePath, content, 'utf-8');
  console.log(`📄 README yaratildi: ${readmePath}`);
}

// Ishga tushirish
if (require.main === module) {
  generateAllTemplates()
    .then(() => {
      console.log('✨ Barcha ishlar tugadi!\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Fatal xato:', error);
      process.exit(1);
    });
}

export { generateAllTemplates };
