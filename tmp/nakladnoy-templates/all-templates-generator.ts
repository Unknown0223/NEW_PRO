import ExcelJS from 'exceljs';
import * as path from 'path';
import { createSafeExcelFile } from './excel-generator-fixed';

/**
 * NAKLADNOY SHABLON TIPLARI
 * 
 * 1. catalog_dual_110 (1.1) - Katalog, SKU + Barcode
 * 2. list_simple_112 (1.1.2) - Oddiy ro'yxat
 * 3. ttn_grouped_410 (4.1, 4.1.1, 4.1.2) - TTN gruppalar bilan
 * 4. matrix_agents_600 (6.0) - Agent bo'yicha matritsa
 * 5. matrix_clients_601 (6.0.1) - Mijoz bo'yicha matritsa
 * 6. summary_clients_602 (6.0.2) - Mijozlar yig'indisi
 * 7. summary_compact_700 (7.0.0) - Ixcham yig'indi
 * 8. per_expeditor_701 (7.0.1) - Ekspeditor bo'yicha
 * 9. thermal_702 (X-Printer) - Termal printer 80mm
 * 10. territory_matrix_703 (7.0.3) - Hudud matritsasi
 * 11. category_client_704 (7.0.4) - Kategoriya + Mijoz
 */

// Umumiy ranglar va stillar
const STYLES = {
  FILL_HEADER_GREY: {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: 'FFD9D9D9' }
  },
  FILL_GROUP: {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: 'FFE7E6E6' }
  },
  FILL_HEADER_BLUE: {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: 'FF4472C4' }
  },
  BORDER_ALL: {
    top: { style: 'thin' as const },
    left: { style: 'thin' as const },
    bottom: { style: 'thin' as const },
    right: { style: 'thin' as const }
  },
  FONT_BOLD: { bold: true },
  FONT_BOLD_WHITE: { bold: true, color: { argb: 'FFFFFFFF' } },
  ALIGN_CENTER: { horizontal: 'center' as const, vertical: 'middle' as const },
  ALIGN_LEFT: { horizontal: 'left' as const, vertical: 'middle' as const },
  ALIGN_RIGHT: { horizontal: 'right' as const, vertical: 'middle' as const }
};

function applyBorder(cell: ExcelJS.Cell) {
  cell.border = STYLES.BORDER_ALL;
}

export function applyBorderRange(
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

function setPageSetup(sheet: ExcelJS.Worksheet, orientation: 'portrait' | 'landscape' = 'portrait') {
  sheet.pageSetup = {
    orientation,
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
}

/**
 * Meta ma'lumotlar qo'shish (barcha shablonlar uchun umumiy)
 */
function addMetaSection(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  cols: number = 8
): number {
  let row = startRow;
  
  const metaLabels = [
    'Дата заявки',
    'Дата отгрузки',
    'Агенты',
    'Территория',
    'Экспедитор',
    'Валюта',
    'Склад'
  ];
  
  const labelCols = Math.floor(cols / 3);
  const valueCols = cols - labelCols;
  
  for (const label of metaLabels) {
    sheet.mergeCells(row, 1, row, labelCols);
    const lc = sheet.getCell(row, 1);
    lc.value = label;
    lc.font = STYLES.FONT_BOLD;
    lc.alignment = STYLES.ALIGN_LEFT;
    
    sheet.mergeCells(row, labelCols + 1, row, cols);
    const vc = sheet.getCell(row, labelCols + 1);
    vc.value = `{{${label}}}`;
    vc.alignment = STYLES.ALIGN_RIGHT;
    
    applyBorderRange(sheet, row, 1, row, cols);
    row++;
  }
  
  return row;
}

/**
 * Imzo qismini qo'shish
 */
function addSignatureSection(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  cols: number = 8
): number {
  let row = startRow + 1; // Bo'sh qator
  
  const midCol = Math.floor(cols / 2);
  
  sheet.mergeCells(row, 1, row, midCol - 1);
  sheet.getCell(row, 1).value = '___________________________';
  sheet.mergeCells(row, midCol + 1, row, cols);
  sheet.getCell(row, midCol + 1).value = '___________________________';
  row++;
  
  sheet.mergeCells(row, 1, row, midCol - 1);
  const sc = sheet.getCell(row, 1);
  sc.value = 'Складчик';
  sc.font = STYLES.FONT_BOLD;
  
  sheet.mergeCells(row, midCol + 1, row, cols);
  const dc = sheet.getCell(row, midCol + 1);
  dc.value = 'Доставщик';
  dc.font = STYLES.FONT_BOLD;
  
  return row + 1;
}

/**
 * SHABLON YARATUVCHILAR
 */

// 1. Catalog Dual (110) - SKU + Barcode
export async function createTemplate110(outputPath: string) {
  await createSafeExcelFile(outputPath, async (wb) => {
    const sheet = wb.addWorksheet('Заказ 1', { views: [{ showGridLines: true }] });
    
    // Ustun kengliklari
    [6, 12, 12, 46, 11, 11, 13, 15].forEach((w, i) => {
      sheet.getColumn(i + 1).width = w;
    });
    sheet.properties.defaultRowHeight = 18;
    
    let row = 1;
    
    // Sarlavha
    sheet.mergeCells(row, 1, row, 8);
    const title = sheet.getCell(row, 1);
    title.value = 'Загруз зав.склада 1.1 (Время печати: {{datetime}})';
    title.font = { ...STYLES.FONT_BOLD, size: 12 };
    title.alignment = { ...STYLES.ALIGN_CENTER, wrapText: true };
    applyBorderRange(sheet, row, 1, row, 8);
    row++;
    
    // Meta
    row = addMetaSection(sheet, row, 8);
    row++;
    
    // Header
    const headers = ['№', 'SKU', 'Штрих-код', 'Продукт', 'Кол-во', 'Бонус', 'Цена', 'Сумма'];
    headers.forEach((h, i) => {
      const cell = sheet.getCell(row, i + 1);
      cell.value = h;
      cell.font = STYLES.FONT_BOLD;
      cell.fill = STYLES.FILL_HEADER_GREY;
      cell.alignment = i === 3 ? STYLES.ALIGN_LEFT : STYLES.ALIGN_CENTER;
    });
    applyBorderRange(sheet, row, 1, row, 8);
    row++;
    
    // Guruh namunasi
    sheet.mergeCells(row, 1, row, 3);
    [1, 2, 3].forEach(c => { sheet.getCell(row, c).fill = STYLES.FILL_GROUP; });
    const gn = sheet.getCell(row, 4);
    gn.value = '{{ГРУППА}}';
    gn.font = STYLES.FONT_BOLD;
    gn.fill = STYLES.FILL_GROUP;
    gn.alignment = STYLES.ALIGN_LEFT;
    
    [5, 6, 7, 8].forEach(c => {
      const cell = sheet.getCell(row, c);
      cell.fill = STYLES.FILL_GROUP;
      cell.font = STYLES.FONT_BOLD;
      cell.alignment = STYLES.ALIGN_RIGHT;
    });
    applyBorderRange(sheet, row, 1, row, 8);
    row++;
    
    // Mahsulot qatorlari (3 ta namuna)
    for (let i = 1; i <= 3; i++) {
      sheet.getCell(row, 1).value = i;
      sheet.getCell(row, 2).value = `{{SKU}}`;
      sheet.getCell(row, 3).value = `{{BARCODE}}`;
      sheet.getCell(row, 4).value = `{{PRODUCT}}`;
      [5, 6, 7, 8].forEach(c => {
        sheet.getCell(row, c).value = '{{VALUE}}';
        sheet.getCell(row, c).alignment = STYLES.ALIGN_RIGHT;
      });
      applyBorderRange(sheet, row, 1, row, 8);
      row++;
    }
    
    // Jami
    sheet.mergeCells(row, 1, row, 4);
    const tot = sheet.getCell(row, 1);
    tot.value = 'Итого';
    tot.font = STYLES.FONT_BOLD;
    tot.fill = STYLES.FILL_HEADER_GREY;
    tot.alignment = STYLES.ALIGN_LEFT;
    
    [5, 6, 7, 8].forEach(c => {
      const cell = sheet.getCell(row, c);
      cell.value = '{{TOTAL}}';
      cell.font = STYLES.FONT_BOLD;
      cell.fill = STYLES.FILL_HEADER_GREY;
      cell.alignment = STYLES.ALIGN_RIGHT;
    });
    applyBorderRange(sheet, row, 1, row, 8);
    row++;
    
    // Imzo
    addSignatureSection(sheet, row, 8);
    setPageSetup(sheet, 'portrait');
  });
}

// 2. List Simple (112)
export async function createTemplate112(outputPath: string) {
  await createSafeExcelFile(outputPath, async (wb) => {
    const sheet = wb.addWorksheet('Заказ 1', { views: [{ showGridLines: true }] });
    
    [6, 12, 46, 11, 11, 13, 15].forEach((w, i) => {
      sheet.getColumn(i + 1).width = w;
    });
    sheet.properties.defaultRowHeight = 18;
    
    let row = 1;
    
    // Sarlavha
    sheet.mergeCells(row, 1, row, 7);
    const title = sheet.getCell(row, 1);
    title.value = 'Загруз зав.склада 1.1.2 (Время печати: {{datetime}})';
    title.font = { ...STYLES.FONT_BOLD, size: 12 };
    title.alignment = { ...STYLES.ALIGN_CENTER, wrapText: true };
    applyBorderRange(sheet, row, 1, row, 7);
    row++;
    
    // Meta
    row = addMetaSection(sheet, row, 7);
    row++;
    
    // Header
    const headers = ['№', 'Код', 'Продукт', 'Кол-во', 'Бонус', 'Цена', 'Сумма'];
    headers.forEach((h, i) => {
      const cell = sheet.getCell(row, i + 1);
      cell.value = h;
      cell.font = STYLES.FONT_BOLD;
      cell.fill = STYLES.FILL_HEADER_GREY;
      cell.alignment = i === 2 ? STYLES.ALIGN_LEFT : STYLES.ALIGN_CENTER;
    });
    applyBorderRange(sheet, row, 1, row, 7);
    row++;
    
    // Mahsulot qatorlari
    for (let i = 1; i <= 5; i++) {
      sheet.getCell(row, 1).value = i;
      sheet.getCell(row, 2).value = `{{CODE}}`;
      sheet.getCell(row, 3).value = `{{PRODUCT}}`;
      [4, 5, 6, 7].forEach(c => {
        sheet.getCell(row, c).value = '{{VALUE}}';
        sheet.getCell(row, c).alignment = STYLES.ALIGN_RIGHT;
      });
      applyBorderRange(sheet, row, 1, row, 7);
      row++;
    }
    
    // Jami
    sheet.mergeCells(row, 1, row, 3);
    const tot = sheet.getCell(row, 1);
    tot.value = 'Итого';
    tot.font = STYLES.FONT_BOLD;
    tot.fill = STYLES.FILL_HEADER_GREY;
    tot.alignment = STYLES.ALIGN_LEFT;
    
    [4, 5, 6, 7].forEach(c => {
      const cell = sheet.getCell(row, c);
      cell.value = '{{TOTAL}}';
      cell.font = STYLES.FONT_BOLD;
      cell.fill = STYLES.FILL_HEADER_GREY;
      cell.alignment = STYLES.ALIGN_RIGHT;
    });
    applyBorderRange(sheet, row, 1, row, 7);
    row++;
    
    addSignatureSection(sheet, row, 7);
    setPageSetup(sheet, 'portrait');
  });
}

// 3. TTN Grouped (410, 411, 412)
export async function createTemplate410(outputPath: string, version: string = '4.1') {
  await createSafeExcelFile(outputPath, async (wb) => {
    const sheet = wb.addWorksheet('ТТН', { views: [{ showGridLines: true }] });
    
    [6, 12, 46, 11, 11, 13, 15].forEach((w, i) => {
      sheet.getColumn(i + 1).width = w;
    });
    sheet.properties.defaultRowHeight = 18;
    
    let row = 1;
    
    // Sarlavha
    sheet.mergeCells(row, 1, row, 7);
    const title = sheet.getCell(row, 1);
    title.value = `Загруз зав.склада ${version} (Время печати: {{datetime}})`;
    title.font = { ...STYLES.FONT_BOLD, size: 12 };
    title.alignment = { ...STYLES.ALIGN_CENTER, wrapText: true };
    applyBorderRange(sheet, row, 1, row, 7);
    row++;
    
    // TTN nomeri
    sheet.mergeCells(row, 1, row, 3);
    sheet.getCell(row, 1).value = 'Номер ТТН';
    sheet.getCell(row, 1).font = STYLES.FONT_BOLD;
    sheet.mergeCells(row, 4, row, 7);
    sheet.getCell(row, 4).value = '{{TTN_NUMBER}}';
    applyBorderRange(sheet, row, 1, row, 7);
    row++;
    
    // Meta
    row = addMetaSection(sheet, row, 7);
    row++;
    
    // Header
    const headers = ['№', 'Код', 'Продукт', 'Кол-во', 'Бонус', 'Цена', 'Сумма'];
    headers.forEach((h, i) => {
      const cell = sheet.getCell(row, i + 1);
      cell.value = h;
      cell.font = STYLES.FONT_BOLD;
      cell.fill = STYLES.FILL_HEADER_GREY;
      cell.alignment = i === 2 ? STYLES.ALIGN_LEFT : STYLES.ALIGN_CENTER;
    });
    applyBorderRange(sheet, row, 1, row, 7);
    row++;
    
    // Guruh
    sheet.mergeCells(row, 1, row, 2);
    [1, 2].forEach(c => { sheet.getCell(row, c).fill = STYLES.FILL_GROUP; });
    const gn = sheet.getCell(row, 3);
    gn.value = '{{ГРУППА}}';
    gn.font = STYLES.FONT_BOLD;
    gn.fill = STYLES.FILL_GROUP;
    [4, 5, 6, 7].forEach(c => {
      sheet.getCell(row, c).fill = STYLES.FILL_GROUP;
      sheet.getCell(row, c).font = STYLES.FONT_BOLD;
      sheet.getCell(row, c).alignment = STYLES.ALIGN_RIGHT;
    });
    applyBorderRange(sheet, row, 1, row, 7);
    row++;
    
    // Mahsulotlar
    for (let i = 1; i <= 5; i++) {
      sheet.getCell(row, 1).value = i;
      sheet.getCell(row, 2).value = `{{CODE}}`;
      sheet.getCell(row, 3).value = `{{PRODUCT}}`;
      [4, 5, 6, 7].forEach(c => {
        sheet.getCell(row, c).value = '{{VALUE}}';
        sheet.getCell(row, c).alignment = STYLES.ALIGN_RIGHT;
      });
      applyBorderRange(sheet, row, 1, row, 7);
      row++;
    }
    
    // Jami
    sheet.mergeCells(row, 1, row, 3);
    const tot = sheet.getCell(row, 1);
    tot.value = 'Итого';
    tot.font = STYLES.FONT_BOLD;
    tot.fill = STYLES.FILL_HEADER_GREY;
    
    [4, 5, 6, 7].forEach(c => {
      sheet.getCell(row, c).value = '{{TOTAL}}';
      sheet.getCell(row, c).font = STYLES.FONT_BOLD;
      sheet.getCell(row, c).fill = STYLES.FILL_HEADER_GREY;
      sheet.getCell(row, c).alignment = STYLES.ALIGN_RIGHT;
    });
    applyBorderRange(sheet, row, 1, row, 7);
    row++;
    
    addSignatureSection(sheet, row, 7);
    setPageSetup(sheet, 'portrait');
  });
}

// 4. Matrix Agents (600)
export async function createTemplate600(outputPath: string) {
  await createSafeExcelFile(outputPath, async (wb) => {
    const sheet = wb.addWorksheet('Матрица', { views: [{ showGridLines: true }] });
    
    sheet.getColumn(1).width = 46; // Продукт
    sheet.getColumn(2).width = 11; // Цена
    for (let i = 3; i <= 10; i++) {
      sheet.getColumn(i).width = 12; // Agent ustunlari
    }
    sheet.properties.defaultRowHeight = 18;
    
    let row = 1;
    
    // Sarlavha
    sheet.mergeCells(row, 1, row, 10);
    const title = sheet.getCell(row, 1);
    title.value = 'Загруз зав.склада 6.0 - Матрица по агентам (Время печати: {{datetime}})';
    title.font = { ...STYLES.FONT_BOLD, size: 12 };
    title.alignment = { ...STYLES.ALIGN_CENTER, wrapText: true };
    applyBorderRange(sheet, row, 1, row, 10);
    row++;
    
    // Meta (qisqartirilgan)
    const metaLabels = ['Дата заявки', 'Дата отгрузки', 'Территория'];
    for (const label of metaLabels) {
      sheet.mergeCells(row, 1, row, 2);
      sheet.getCell(row, 1).value = label;
      sheet.getCell(row, 1).font = STYLES.FONT_BOLD;
      sheet.mergeCells(row, 3, row, 10);
      sheet.getCell(row, 3).value = `{{${label}}}`;
      applyBorderRange(sheet, row, 1, row, 10);
      row++;
    }
    row++;
    
    // Header
    sheet.getCell(row, 1).value = 'Продукт';
    sheet.getCell(row, 2).value = 'Цена';
    for (let i = 3; i <= 10; i++) {
      sheet.getCell(row, i).value = `{{AGENT_${i - 2}}}`;
    }
    for (let i = 1; i <= 10; i++) {
      const cell = sheet.getCell(row, i);
      cell.font = STYLES.FONT_BOLD;
      cell.fill = STYLES.FILL_HEADER_BLUE;
      cell.font = STYLES.FONT_BOLD_WHITE;
      cell.alignment = i === 1 ? STYLES.ALIGN_LEFT : STYLES.ALIGN_CENTER;
    }
    applyBorderRange(sheet, row, 1, row, 10);
    row++;
    
    // Mahsulot qatorlari
    for (let i = 1; i <= 10; i++) {
      sheet.getCell(row, 1).value = `{{PRODUCT_${i}}}`;
      sheet.getCell(row, 2).value = '{{PRICE}}';
      for (let j = 3; j <= 10; j++) {
        sheet.getCell(row, j).value = '{{QTY}}';
        sheet.getCell(row, j).alignment = STYLES.ALIGN_CENTER;
      }
      applyBorderRange(sheet, row, 1, row, 10);
      row++;
    }
    
    // Jami
    sheet.getCell(row, 1).value = 'ИТОГО';
    sheet.getCell(row, 1).font = STYLES.FONT_BOLD;
    sheet.getCell(row, 1).fill = STYLES.FILL_HEADER_GREY;
    sheet.getCell(row, 2).value = '';
    sheet.getCell(row, 2).fill = STYLES.FILL_HEADER_GREY;
    for (let i = 3; i <= 10; i++) {
      sheet.getCell(row, i).value = '{{TOTAL}}';
      sheet.getCell(row, i).font = STYLES.FONT_BOLD;
      sheet.getCell(row, i).fill = STYLES.FILL_HEADER_GREY;
      sheet.getCell(row, i).alignment = STYLES.ALIGN_CENTER;
    }
    applyBorderRange(sheet, row, 1, row, 10);
    
    setPageSetup(sheet, 'landscape');
  });
}

// Export barcha funksiyalar
export const templateGenerators = {
  '110': createTemplate110,
  '112': createTemplate112,
  '410': createTemplate410,
  '411': (p: string) => createTemplate410(p, '4.1.1'),
  '412': (p: string) => createTemplate410(p, '4.1.2'),
  '600': createTemplate600
};

// CLI interface
if (require.main === module) {
  const templateId = process.argv[2];
  const outputPath = process.argv[3] || `./template-${templateId}.xlsx`;
  
  const generator = templateGenerators[templateId as keyof typeof templateGenerators];
  
  if (!generator) {
    console.error('Noma\'lum shablon ID:', templateId);
    console.log('Mavjud shablonlar:', Object.keys(templateGenerators).join(', '));
    process.exit(1);
  }
  
  generator(outputPath)
    .then(() => console.log(`✓ Shablon yaratildi: ${outputPath}`))
    .catch(err => {
      console.error('✗ Xato:', err);
      process.exit(1);
    });
}
