#!/usr/bin/env ts-node

/**
 * MAVJUD EXCEL FAYLLARNI TUZATISH
 * 
 * Bu script mavjud .xlsx fayllarni ochib, barcha muammolarni
 * tuzatadi va qaytadan saqlaydi
 */

import * as fs from 'fs';
import * as path from 'path';
import { repairExistingFile } from './excel-generator-fixed';

// Input fayllar ro'yxati (command line argumentlar)
const INPUT_FILES = process.argv.slice(2);

async function repairFile(inputPath: string) {
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Fayl topilmadi: ${inputPath}`);
    return false;
  }
  
  try {
    const fileName = path.basename(inputPath);
    const dirName = path.dirname(inputPath);
    const outputPath = path.join(dirName, `repaired-${fileName}`);
    
    console.log(`🔧 Tuzatilmoqda: ${fileName}...`);
    await repairExistingFile(inputPath, outputPath);
    console.log(`   ✓ Saqlandi: ${outputPath}\n`);
    
    return true;
  } catch (error) {
    console.error(`   ✗ Xato: ${error}\n`);
    return false;
  }
}

async function repairMultipleFiles(filePaths: string[]) {
  console.log(`📂 ${filePaths.length} ta fayl tuzatiladi...\n`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const filePath of filePaths) {
    const success = await repairFile(filePath);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`✅ Muvaffaqiyatli: ${successCount}`);
  console.log(`❌ Xatolar: ${failCount}`);
  console.log(`📊 Jami: ${filePaths.length}`);
  console.log('='.repeat(60) + '\n');
}

async function repairFromDirectory(dirPath: string, pattern?: RegExp) {
  if (!fs.existsSync(dirPath)) {
    console.error(`❌ Papka topilmadi: ${dirPath}`);
    return;
  }
  
  const files = fs.readdirSync(dirPath)
    .filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'))
    .filter(f => !f.startsWith('repaired-'))
    .filter(f => pattern ? pattern.test(f) : true)
    .map(f => path.join(dirPath, f));
  
  if (files.length === 0) {
    console.log('⚠️  Excel fayllari topilmadi!');
    return;
  }
  
  await repairMultipleFiles(files);
}

// Sizning fayllaringizni tuzatish
async function repairYourFiles() {
  console.log('🔧 Sizning yuklab olingan fayllaringizni tuzatish...\n');
  
  const files = [
    'C:\\Users\\botir\\Downloads\\110 Загруз зав.склада 1.1(26-05-2026) (2).xlsx',
    'C:\\Users\\botir\\Downloads\\112 Загруз зав.склада 1.1.2(26-05-2026) (1).xlsx',
    'C:\\Users\\botir\\Downloads\\410 Загруз зав.склада 4.1(26-05-2026) (1).xlsx',
    'C:\\Users\\botir\\Downloads\\411 Загруз зав.склада 4.1.1(26-05-2026) (1).xlsx',
    'C:\\Users\\botir\\Downloads\\412 Загруз зав.склада 4.1.2(26-05-2026) (1).xlsx',
    'C:\\Users\\botir\\Downloads\\600 Загруз зав.склада 6.0(26-05-2026) (1).xlsx',
    'C:\\Users\\botir\\Downloads\\601 Загруз зав.склада 6.0.1(26-05-2026) (1).xlsx',
    'C:\\Users\\botir\\Downloads\\Сводная накладная - 26.05.2026 14_52_39.xlsx',
    'C:\\Users\\botir\\Downloads\\Сводная накладная - 26.05.2026 14_52_51.xlsx',
    'C:\\Users\\botir\\Downloads\\701 Загруз зав.склада 7.0.1 - 26.05.2026 14_53_07.xlsx',
    'C:\\Users\\botir\\Downloads\\605 X-Printer 80мм - 26.05.2026 14_53_53.xlsx',
    'C:\\Users\\botir\\Downloads\\2026-05-26 отчет вторичка - 26.05.2026 14_54_14.xlsx',
    'C:\\Users\\botir\\Downloads\\704 Загруз зав.склада 7.0.4 - 26.05.2026 14_54_21.xlsx'
  ];
  
  // Windows path larni Linux format ga o'zgartirish
  const linuxPaths = files.map(f => {
    // C:\Users\... -> /mnt/c/Users/...
    if (f.startsWith('C:')) {
      return f.replace('C:\\', '/mnt/c/').replace(/\\/g, '/');
    }
    return f;
  });
  
  console.log('📋 Fayllar ro\'yxati:');
  linuxPaths.forEach((f, i) => {
    console.log(`   ${i + 1}. ${path.basename(f)}`);
  });
  console.log('');
  
  await repairMultipleFiles(linuxPaths);
}

// Main
if (require.main === module) {
  if (INPUT_FILES.length === 0) {
    console.log('📖 Foydalanish:\n');
    console.log('  Bitta faylni tuzatish:');
    console.log('  $ ts-node repair-existing-files.ts path/to/file.xlsx\n');
    console.log('  Ko\'p fayllarni tuzatish:');
    console.log('  $ ts-node repair-existing-files.ts file1.xlsx file2.xlsx file3.xlsx\n');
    console.log('  Papkadagi barcha fayllarni tuzatish:');
    console.log('  $ ts-node repair-existing-files.ts --dir /path/to/directory\n');
    console.log('  Sizning fayllaringizni tuzatish:');
    console.log('  $ ts-node repair-existing-files.ts --yours\n');
    process.exit(0);
  }
  
  // --yours flag
  if (INPUT_FILES[0] === '--yours') {
    repairYourFiles()
      .then(() => process.exit(0))
      .catch(err => {
        console.error('💥 Fatal xato:', err);
        process.exit(1);
      });
  }
  // --dir flag
  else if (INPUT_FILES[0] === '--dir') {
    const dirPath = INPUT_FILES[1] || '.';
    repairFromDirectory(dirPath)
      .then(() => process.exit(0))
      .catch(err => {
        console.error('💥 Fatal xato:', err);
        process.exit(1);
      });
  }
  // Fayl ro'yxati
  else {
    repairMultipleFiles(INPUT_FILES)
      .then(() => process.exit(0))
      .catch(err => {
        console.error('💥 Fatal xato:', err);
        process.exit(1);
      });
  }
}

export { repairFile, repairMultipleFiles, repairFromDirectory };
