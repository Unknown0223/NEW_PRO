import ExcelJS from 'exceljs';
import { createSafeExcelFile } from './excel-generator-fixed';

/**
 * 110 Загруз зав.склада 1.1 (CATALOG_DUAL_110)
 * 
 * Bu shablon ikki turdagi kodlarni ko'rsatadi:
 * - SKU kod
 * - Shtrix-kod (barcode)
 * 
 * Format: Katalog ko'rinishida, gruppalar bo'yicha
 */

// Ranglar
const FILL_HEADER_GREY = {
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: 'FFD9D9D9' }
};

const FILL_GROUP = {
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: 'FFE7E6E6' }
};

// Border stil
const BORDER_ALL = {
  top: { style: 'thin' as const },
  left: { style: 'thin' as const },
  bottom: { style: 'thin' as const },
  right: { style: 'thin' as const }
};

function applyBorder(cell: ExcelJS.Cell) {
  cell.border = BORDER_ALL;
}

function applyBorderRange(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
) {
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      applyBorder(sheet.getCell(r, c));
    }
  }
}

export async function create110Template(outputPath: string) {
  await createSafeExcelFile(outputPath, async (wb) => {
    const sheet = wb.addWorksheet('Заказ 1', {
      views: [{ showGridLines: true }]
    });
    
    // Ustun kengliklari
    sheet.getColumn(1).width = 6;   // №
    sheet.getColumn(2).width = 12;  // SKU
    sheet.getColumn(3).width = 12;  // Штрих-код
    sheet.getColumn(4).width = 46;  // Продукт
    sheet.getColumn(5).width = 11;  // Кол-во
    sheet.getColumn(6).width = 11;  // Бонус
    sheet.getColumn(7).width = 13;  // Цена
    sheet.getColumn(8).width = 15;  // Сумма
    
    sheet.properties.defaultRowHeight = 18;
    
    let row = 1;
    
    // Sarlavha
    sheet.mergeCells(row, 1, row, 8);
    const title = sheet.getCell(row, 1);
    title.value = 'Загруз зав.склада 1.1 (Время печати: {{datetime}})';
    title.font = { bold: true, size: 12 };
    title.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    applyBorderRange(sheet, row, 1, row, 8);
    row++;
    
    // Meta ma'lumotlar
    const metaLabels = [
      'Дата заявки',
      'Дата отгрузки',
      'Агенты',
      'Территория',
      'Экспедитор',
      'Валюта',
      'Склад'
    ];
    
    for (const label of metaLabels) {
      sheet.mergeCells(row, 1, row, 3);
      const lc = sheet.getCell(row, 1);
      lc.value = label;
      lc.font = { bold: true };
      lc.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      
      sheet.mergeCells(row, 4, row, 8);
      const vc = sheet.getCell(row, 4);
      vc.value = `{{${label}}}`;
      vc.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
      
      applyBorderRange(sheet, row, 1, row, 8);
      row++;
    }
    
    row++; // Bo'sh qator
    
    // Header
    sheet.getCell(row, 1).value = '№';
    sheet.getCell(row, 1).font = { bold: true };
    sheet.getCell(row, 1).fill = FILL_HEADER_GREY;
    sheet.getCell(row, 1).alignment = { horizontal: 'center', vertical: 'middle' };
    
    sheet.getCell(row, 2).value = 'SKU';
    sheet.getCell(row, 2).font = { bold: true };
    sheet.getCell(row, 2).fill = FILL_HEADER_GREY;
    sheet.getCell(row, 2).alignment = { horizontal: 'center', vertical: 'middle' };
    
    sheet.getCell(row, 3).value = 'Штрих-код';
    sheet.getCell(row, 3).font = { bold: true };
    sheet.getCell(row, 3).fill = FILL_HEADER_GREY;
    sheet.getCell(row, 3).alignment = { horizontal: 'center', vertical: 'middle' };
    
    const headers = ['Продукт', 'Кол-во', 'Бонус', 'Цена', 'Сумма'];
    for (let i = 0; i < headers.length; i++) {
      const cell = sheet.getCell(row, 4 + i);
      cell.value = headers[i];
      cell.font = { bold: true };
      cell.fill = FILL_HEADER_GREY;
      cell.alignment = { 
        horizontal: i === 0 ? 'left' : 'right', 
        vertical: 'middle' 
      };
    }
    
    applyBorderRange(sheet, row, 1, row, 8);
    row++;
    
    // Namuna guruh
    sheet.mergeCells(row, 1, row, 3);
    for (let c = 1; c <= 3; c++) {
      sheet.getCell(row, c).fill = FILL_GROUP;
    }
    const gn = sheet.getCell(row, 4);
    gn.value = '{{ГРУППА_1}}';
    gn.font = { bold: true };
    gn.fill = FILL_GROUP;
    gn.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    
    sheet.getCell(row, 5).value = '{{G1_QTY}}';
    sheet.getCell(row, 6).value = '{{G1_BONUS}}';
    sheet.getCell(row, 7).value = '';
    sheet.getCell(row, 8).value = '{{G1_SUM}}';
    
    for (let c = 5; c <= 8; c++) {
      const cell = sheet.getCell(row, c);
      cell.fill = FILL_GROUP;
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    }
    applyBorderRange(sheet, row, 1, row, 8);
    row++;
    
    // Namuna mahsulotlar (3 ta)
    for (let i = 1; i <= 3; i++) {
      sheet.getCell(row, 1).value = i;
      sheet.getCell(row, 1).alignment = { horizontal: 'center', vertical: 'middle' };
      
      sheet.getCell(row, 2).value = `{{SKU_${i}}}`;
      sheet.getCell(row, 2).alignment = { vertical: 'middle', horizontal: 'left' };
      
      sheet.getCell(row, 3).value = `{{BARCODE_${i}}}`;
      sheet.getCell(row, 3).alignment = { vertical: 'middle', horizontal: 'left' };
      
      sheet.getCell(row, 4).value = `{{PRODUCT_${i}}}`;
      sheet.getCell(row, 4).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      
      sheet.getCell(row, 5).value = '{{QTY}}';
      sheet.getCell(row, 6).value = '{{BONUS}}';
      sheet.getCell(row, 7).value = '{{PRICE}}';
      sheet.getCell(row, 8).value = '{{SUM}}';
      
      for (const c of [5, 6, 7, 8]) {
        sheet.getCell(row, c).alignment = { horizontal: 'right', vertical: 'middle' };
      }
      
      applyBorderRange(sheet, row, 1, row, 8);
      row++;
    }
    
    // Jami
    sheet.mergeCells(row, 1, row, 4);
    const tot = sheet.getCell(row, 1);
    tot.value = 'Итого';
    tot.font = { bold: true };
    tot.fill = FILL_HEADER_GREY;
    tot.alignment = { horizontal: 'left', vertical: 'middle' };
    
    sheet.getCell(row, 5).value = '{{TOTAL_QTY}}';
    sheet.getCell(row, 6).value = '{{TOTAL_BONUS}}';
    sheet.getCell(row, 7).value = '{{TOTAL_PRICE}}';
    sheet.getCell(row, 8).value = '';
    
    for (let c = 5; c <= 8; c++) {
      sheet.getCell(row, c).font = { bold: true };
      sheet.getCell(row, c).fill = FILL_HEADER_GREY;
      sheet.getCell(row, c).alignment = { horizontal: 'right', vertical: 'middle' };
    }
    applyBorderRange(sheet, row, 1, row, 8);
    row += 2;
    
    // Imzo qismi
    sheet.mergeCells(row, 1, row, 3);
    sheet.getCell(row, 1).value = '___________________________';
    sheet.mergeCells(row, 6, row, 8);
    sheet.getCell(row, 6).value = '___________________________';
    row++;
    
    sheet.mergeCells(row, 1, row, 3);
    sheet.getCell(row, 1).value = 'Складчик';
    sheet.getCell(row, 1).font = { bold: true };
    
    sheet.mergeCells(row, 6, row, 8);
    sheet.getCell(row, 6).value = 'Доставщик';
    sheet.getCell(row, 6).font = { bold: true };
    
    // Print sozlamalari
    sheet.pageSetup = {
      orientation: 'portrait',
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { 
        left: 0.4, 
        right: 0.4, 
        top: 0.5, 
        bottom: 0.5, 
        header: 0.2, 
        footer: 0.2 
      }
    };
  });
}

// Agar to'g'ridan-to'g'ri ishga tushirilsa
if (require.main === module) {
  const outputPath = process.argv[2] || './110-template.xlsx';
  create110Template(outputPath)
    .then(() => console.log('✓ Shablon yaratildi!'))
    .catch(err => {
      console.error('✗ Xato:', err);
      process.exit(1);
    });
}
