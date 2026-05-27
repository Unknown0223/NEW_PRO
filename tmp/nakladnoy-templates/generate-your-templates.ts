#!/usr/bin/env ts-node

/**
 * SIZNING NAKLADNOY SHABLON LARINGIZNI YARATISH
 * 
 * 1. Загруз зав.склада 5.1.8 - Ekspeditor uchun
 * 2. Накладные 2.1 - Mijozlar uchun (2 ta variant)
 */

import * as path from 'path';
import * as fs from 'fs';
import { createZagruzTemplate } from './template-518-zagruz';
import { createNakladnoyTemplate, createReestrTemplate } from './template-210-nakladnoy';

const OUTPUT_DIR = path.join(__dirname, 'output');

async function generateYourTemplates() {
  console.log('🎨 SIZNING NAKLADNOY SHABLON LARINGIZ');
  console.log('=' .repeat(70));
  console.log('');
  
  // Output papkani yaratish
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const results: { name: string; path: string; success: boolean }[] = [];
  
  // ========================================================================
  // 1. ЗАГРУЗ ЗАВ.СКЛАДА 5.1.8
  // ========================================================================
  console.log('📦 1. ЗАГРУЗ ЗАВ.СКЛАДА 5.1.8');
  console.log('   Ekspeditor uchun yuklash varaqasi');
  console.log('   Xususiyatlar:');
  console.log('   - Gruppalar ranglar bilan (ko\'k)');
  console.log('   - Бонусы bo\'limi (binafsha)');
  console.log('   - Возврат с полки bo\'limi');
  console.log('   - XML xavfsiz, minimal merge cells');
  console.log('');
  
  try {
    const zagruzPath = path.join(OUTPUT_DIR, '518-zagruz-template-fixed.xlsx');
    await createZagruzTemplate(zagruzPath);
    console.log('   ✅ Muvaffaqiyatli yaratildi!');
    console.log(`   📁 ${zagruzPath}`);
    results.push({ name: 'Загруз зав.склада 5.1.8', path: zagruzPath, success: true });
  } catch (error) {
    console.error('   ❌ Xato:', error);
    results.push({ name: 'Загруз зав.склада 5.1.8', path: '', success: false });
  }
  console.log('');
  
  // ========================================================================
  // 2. НАКЛАДНАЯ (BITTA MIJOZ)
  // ========================================================================
  console.log('📝 2. НАКЛАДНАЯ (Bitta mijoz uchun)');
  console.log('   Har bir mijoz uchun alohida nakladnoy');
  console.log('   Xususiyatlar:');
  console.log('   - Faqat bitta mijoz (duplikat yo\'q!)');
  console.log('   - Заказ bo\'limi (ko\'k)');
  console.log('   - Бонус bo\'limi (yashil)');
  console.log('   - Ixcham va o\'qishga qulay');
  console.log('   - XML xavfsiz, minimal merge cells');
  console.log('');
  
  try {
    const singlePath = path.join(OUTPUT_DIR, '210-nakladnoy-single-fixed.xlsx');
    await createNakladnoyTemplate(singlePath);
    console.log('   ✅ Muvaffaqiyatli yaratildi!');
    console.log(`   📁 ${singlePath}`);
    results.push({ name: 'Накладная (Single)', path: singlePath, success: true });
  } catch (error) {
    console.error('   ❌ Xato:', error);
    results.push({ name: 'Накладная (Single)', path: '', success: false });
  }
  console.log('');
  
  // ========================================================================
  // 3. РЕЕСТР НАКЛАДНЫХ (KO'P MIJOZ)
  // ========================================================================
  console.log('📋 3. РЕЕСТР НАКЛАДНЫХ (Ko\'p mijozlar uchun)');
  console.log('   Bir faylda bir nechta mijozlar');
  console.log('   Xususiyatlar:');
  console.log('   - Har bir mijoz alohida block da');
  console.log('   - Ketma-ket joylashgan');
  console.log('   - Print qilish uchun qulay');
  console.log('   - XML xavfsiz');
  console.log('');
  
  try {
    const reestrPath = path.join(OUTPUT_DIR, '210-nakladnoy-reestr-fixed.xlsx');
    await createReestrTemplate(reestrPath);
    console.log('   ✅ Muvaffaqiyatli yaratildi!');
    console.log(`   📁 ${reestrPath}`);
    results.push({ name: 'Реестр накладных', path: reestrPath, success: true });
  } catch (error) {
    console.error('   ❌ Xato:', error);
    results.push({ name: 'Реестр накладных', path: '', success: false });
  }
  console.log('');
  
  // ========================================================================
  // NATIJALAR
  // ========================================================================
  console.log('=' .repeat(70));
  console.log('📊 NATIJALAR:');
  console.log('=' .repeat(70));
  console.log('');
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;
  
  results.forEach((r, i) => {
    const icon = r.success ? '✅' : '❌';
    console.log(`${i + 1}. ${icon} ${r.name}`);
    if (r.success) {
      console.log(`   📁 ${r.path}`);
    }
  });
  
  console.log('');
  console.log(`✅ Muvaffaqiyatli: ${successCount}/${results.length}`);
  if (failCount > 0) {
    console.log(`❌ Xatolar: ${failCount}`);
  }
  console.log('');
  console.log(`📂 Barcha fayllar: ${OUTPUT_DIR}`);
  console.log('=' .repeat(70));
  console.log('');
  
  // README yaratish
  await createCustomReadme(results);
}

async function createCustomReadme(results: { name: string; path: string; success: boolean }[]) {
  const readmePath = path.join(OUTPUT_DIR, 'README.md');
  
  const content = `# Sizning Nakladnoy Shablonlaringiz

## Yaratilgan sana
${new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}

## Shablon lar

${results.map((r, i) => `
### ${i + 1}. ${r.name}

${r.success ? `
**Fayl:** \`${path.basename(r.path)}\`

#### Tavsif:
${getTemplateDescription(r.name)}

#### Xususiyatlar:
${getTemplateFeatures(r.name)}

#### Qo'llash:
\`\`\`typescript
// Backend da ishlatish
import { buildNakladnoy } from './nakladnoy-builder';

const buffer = await buildNakladnoy('${r.name}', orders, options);
\`\`\`
` : '❌ Yaratilmadi - xato yuz berdi'}

---
`).join('\n')}

## Muammolar hal qilindi

✅ **XML xatolar** - Barcha invalid belgilar tozalangan
✅ **DPI muammosi** - ExcelJS bad DPI (4294967295) to'g'rilangan
✅ **Merge cells** - Faqat kerakli merge lar, invalid (C2:C2) merge lar yo'q
✅ **Shared strings** - To'g'ri yozish parametrlari
✅ **Duplikat format** - Накладные da ikki nusxa o'rniga bitta

## Placeholderlar

Barcha shablonlarda \`{{PLACEHOLDER}}\` formatida o'rinbosarlar mavjud:

### Umumiy
- \`{{DATE}}\` - Sana
- \`{{CLIENT_NAME}}\` - Mijoz nomi
- \`{{ADDRESS}}\` - Manzil
- \`{{AGENT_NAME}}\` - Agent ismi
- \`{{EXPEDITOR_NAME}}\` - Ekspeditor ismi

### Mahsulot
- \`{{PRODUCT}}\` - Mahsulot nomi
- \`{{QTY}}\` - Miqdor
- \`{{PRICE}}\` - Narx
- \`{{SUM}}\` - Summa
- \`{{BLOCK}}\` - Blok

### Gruppalar
- \`{{GROUP_NAME}}\` - Guruh nomi (LIPUCHKA, GIGA, etc.)
- \`{{GROUP_QTY}}\` - Guruh miqdori
- \`{{GROUP_SUM}}\` - Guruh summasi

## Keyingi qadamlar

1. **Backend ga integratsiya** - \`order-nakladnoy-xlsx.ts\` da ishlatish
2. **Ma'lumot to'ldirish** - Placeholder larni real ma'lumot bilan almashtirish
3. **Test qilish** - Turli xil ma'lumotlar bilan test qilish
4. **Deploy** - Production ga chiqarish

## Yordam

Muammolar bo'lsa:
- README.md ni o'qing
- Test report ni tekshiring (\`test-report.json\`)
- Backend log larni ko'ring

---

**Muhim:** Bu shablon lar maxsus sizning fayllaringizdan yaratildi va optimallashtirildi!
`;

  fs.writeFileSync(readmePath, content, 'utf-8');
  console.log(`📄 README yaratildi: ${readmePath}`);
}

function getTemplateDescription(name: string): string {
  if (name.includes('Загруз')) {
    return 'Ekspeditor uchun yuklash varaqasi. Barcha mahsulotlar gruppalar bo\'yicha, bonus va возврат bo\'limlari bilan.';
  } else if (name.includes('Single')) {
    return 'Bitta mijoz uchun nakladnoy. Заказ va Бонус bo\'limlari alohida ranglar bilan ajratilgan.';
  } else if (name.includes('Реестр')) {
    return 'Ko\'p mijozlar uchun reestr. Har bir mijoz alohida block da ketma-ket joylashgan.';
  }
  return '';
}

function getTemplateFeatures(name: string): string {
  if (name.includes('Загруз')) {
    return `- Gruppalar ranglar bilan (ko'k - LIPUCHKA, GIGA, etc.)
- Бонусы bo'limi (binafsha)
- Возврат с полки bo'limi (binafsha)
- Meta ma'lumotlar: Agent, Ekspeditor, Территория, etc.
- Ixcham format, A4 portrait
- XML xavfsiz, minimal merge cells`;
  } else if (name.includes('Single')) {
    return `- Faqat bitta mijoz (duplikat yo'q!)
- Заказ bo'limi (ko'k rang)
- Бонус bo'limi (yashil rang)
- Mijoz to'liq ma'lumotlari
- Imzo qismi
- XML xavfsiz, minimal merge cells`;
  } else if (name.includes('Реестр')) {
    return `- Bir nechta mijozlar ketma-ket
- Har bir mijoz alohida block
- Minimal format
- Print uchun qulay
- XML xavfsiz`;
  }
  return '';
}

// Main
if (require.main === module) {
  generateYourTemplates()
    .then(() => {
      console.log('✨ Barcha ishlar tugadi!\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Fatal xato:', error);
      process.exit(1);
    });
}

export { generateYourTemplates };
