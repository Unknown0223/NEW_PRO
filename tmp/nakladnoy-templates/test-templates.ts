#!/usr/bin/env ts-node

/**
 * SHABLON LARNI TEST QILISH
 * 
 * Barcha yaratilgan shablon larni ochib, XML strukturasini
 * va muammolarni tekshiradi
 */

import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  file: string;
  success: boolean;
  issues: string[];
  warnings: string[];
  stats: {
    worksheetCount: number;
    totalCells: number;
    mergedCells: number;
  };
}

async function testExcelFile(filePath: string): Promise<TestResult> {
  const result: TestResult = {
    file: path.basename(filePath),
    success: true,
    issues: [],
    warnings: [],
    stats: {
      worksheetCount: 0,
      totalCells: 0,
      mergedCells: 0
    }
  };
  
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);
    
    result.stats.worksheetCount = wb.worksheets.length;
    
    // Har bir worksheet ni tekshirish
    for (const ws of wb.worksheets) {
      // Cell larni tekshirish
      ws.eachRow({ includeEmpty: false }, (row) => {
        row.eachCell({ includeEmpty: false }, (cell) => {
          result.stats.totalCells++;
          
          // Cell qiymatini tekshirish
          const value = cell.value;
          if (typeof value === 'string') {
            // XML invalid belgilarni tekshirish
            if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(value)) {
              result.issues.push(`Invalid XML characters in cell ${cell.address}`);
              result.success = false;
            }
          }
        });
      });
      
      // Merged cells ni tekshirish
      const model = ws as ExcelJS.Worksheet & { model?: { merges?: string[] } };
      const merges = model.model?.merges;
      if (merges) {
        result.stats.mergedCells = merges.length;
        
        // Invalid merge larni tekshirish (C2:C2)
        for (const ref of merges) {
          const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(ref);
          if (m) {
            const c1 = m[1]!.toUpperCase();
            const r1 = m[2]!;
            const c2 = m[3]!.toUpperCase();
            const r2 = m[4]!;
            
            if (c1 === c2 && r1 === r2) {
              result.issues.push(`Invalid merge: ${ref} in ${ws.name}`);
              result.success = false;
            }
          }
        }
      }
      
      // PageSetup ni tekshirish
      const ps = ws.pageSetup;
      if (ps) {
        const m = ps as ExcelJS.PageSetup & { 
          horizontalDpi?: number; 
          verticalDpi?: number 
        };
        
        if (m.horizontalDpi === 4294967295) {
          result.warnings.push(`Bad horizontalDpi in ${ws.name}`);
        }
        if (m.verticalDpi === 4294967295) {
          result.warnings.push(`Bad verticalDpi in ${ws.name}`);
        }
      }
    }
    
  } catch (error) {
    result.success = false;
    result.issues.push(`Failed to read file: ${error}`);
  }
  
  return result;
}

async function testAllTemplates(dirPath: string) {
  console.log('🧪 Shablon larni test qilish boshlandi...\n');
  
  if (!fs.existsSync(dirPath)) {
    console.error(`❌ Papka topilmadi: ${dirPath}`);
    return;
  }
  
  const files = fs.readdirSync(dirPath)
    .filter(f => f.endsWith('.xlsx'))
    .map(f => path.join(dirPath, f));
  
  if (files.length === 0) {
    console.log('⚠️  Excel fayllari topilmadi!');
    return;
  }
  
  const results: TestResult[] = [];
  
  for (const file of files) {
    console.log(`🔍 Tekshirilmoqda: ${path.basename(file)}...`);
    const result = await testExcelFile(file);
    results.push(result);
    
    if (result.success) {
      console.log(`   ✅ Muvaffaqiyatli`);
    } else {
      console.log(`   ❌ Xatolar topildi`);
    }
    
    if (result.issues.length > 0) {
      result.issues.forEach(issue => {
        console.log(`      • ${issue}`);
      });
    }
    
    if (result.warnings.length > 0) {
      result.warnings.forEach(warning => {
        console.log(`      ⚠️  ${warning}`);
      });
    }
    
    console.log(`   📊 Stats: ${result.stats.worksheetCount} sheets, ${result.stats.totalCells} cells, ${result.stats.mergedCells} merges\n`);
  }
  
  // Umumiy natija
  console.log('\n' + '='.repeat(60));
  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;
  const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);
  
  console.log(`✅ Muvaffaqiyatli: ${successCount}/${results.length}`);
  if (failCount > 0) {
    console.log(`❌ Xatolar: ${failCount}`);
  }
  console.log(`🐛 Jami muammolar: ${totalIssues}`);
  console.log(`⚠️  Jami ogohlantirishlar: ${totalWarnings}`);
  console.log('='.repeat(60) + '\n');
  
  // JSON hisobot yaratish
  const reportPath = path.join(dirPath, 'test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`📄 Hisobot saqlandi: ${reportPath}`);
}

// Main
if (require.main === module) {
  const dirPath = process.argv[2] || path.join(__dirname, 'output');
  
  testAllTemplates(dirPath)
    .then(() => {
      console.log('\n✨ Test tugadi!\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Fatal xato:', error);
      process.exit(1);
    });
}

export { testExcelFile, testAllTemplates };
