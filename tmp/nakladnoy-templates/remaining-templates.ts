import ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';
import { createSafeExcelFile } from './excel-generator-fixed';

/**
 * QOLGAN BARCHA SHABLON GENERATORLARI
 */

// Umumiy stillar va funksiyalar
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

function setPageSetup(sheet: ExcelJS.Worksheet, orientation: 'portrait' | 'landscape' = 'portrait') {
  sheet.pageSetup = {
    orientation,
    paperSize: 9,
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

function addSignatureSection(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  cols: number = 8
): number {
  let row = startRow + 1;
  
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

// 5. Matrix Clients (601)
export async function createTemplate601(outputPath: string) {
  await createSafeExcelFile(outputPath, async (wb) => {
    const sheet = wb.addWorksheet('Матрица Клиенты', { views: [{ showGridLines: true }] });
    
    sheet.getColumn(1).width = 46;
    sheet.getColumn(2).width = 11;
    for (let i = 3; i <= 10; i++) {
      sheet.getColumn(i).width = 14;
    }
    
    let row = 1;
    sheet.mergeCells(row, 1, row, 10);
    const title = sheet.getCell(row, 1);
    title.value = 'Загруз зав.склада 6.0.1 - Матрица по клиентам (Время печати: {{datetime}})';
    title.font = { ...STYLES.FONT_BOLD, size: 12 };
    title.alignment = { ...STYLES.ALIGN_CENTER, wrapText: true };
    applyBorderRange(sheet, row, 1, row, 10);
    row += 2;
    
    // Header
    sheet.getCell(row, 1).value = 'Продукт';
    sheet.getCell(row, 2).value = 'Цена';
    for (let i = 3; i <= 10; i++) {
      sheet.getCell(row, i).value = `{{CLIENT_${i - 2}}}`;
    }
    for (let i = 1; i <= 10; i++) {
      const cell = sheet.getCell(row, i);
      cell.font = STYLES.FONT_BOLD_WHITE;
      cell.fill = STYLES.FILL_HEADER_BLUE;
      cell.alignment = i === 1 ? STYLES.ALIGN_LEFT : STYLES.ALIGN_CENTER;
    }
    applyBorderRange(sheet, row, 1, row, 10);
    row++;
    
    // Mahsulotlar
    for (let i = 1; i <= 15; i++) {
      sheet.getCell(row, 1).value = `{{PRODUCT}}`;
      sheet.getCell(row, 2).value = '{{PRICE}}';
      for (let j = 3; j <= 10; j++) {
        sheet.getCell(row, j).value = '';
        sheet.getCell(row, j).alignment = STYLES.ALIGN_CENTER;
      }
      applyBorderRange(sheet, row, 1, row, 10);
      row++;
    }
    
    // Jami
    sheet.getCell(row, 1).value = 'ИТОГО';
    sheet.getCell(row, 1).font = STYLES.FONT_BOLD;
    sheet.getCell(row, 1).fill = STYLES.FILL_HEADER_GREY;
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

// 6. Summary Clients (602)
export async function createTemplate602(outputPath: string) {
  await createSafeExcelFile(outputPath, async (wb) => {
    const sheet = wb.addWorksheet('Сводная', { views: [{ showGridLines: true }] });
    
    [6, 30, 16, 11, 11, 13, 15].forEach((w, i) => {
      sheet.getColumn(i + 1).width = w;
    });
    
    let row = 1;
    sheet.mergeCells(row, 1, row, 7);
    const title = sheet.getCell(row, 1);
    title.value = 'Сводная накладная 6.0.2 (Время печати: {{datetime}})';
    title.font = { ...STYLES.FONT_BOLD, size: 12 };
    title.alignment = STYLES.ALIGN_CENTER;
    applyBorderRange(sheet, row, 1, row, 7);
    row++;
    
    row = addMetaSection(sheet, row, 7);
    row++;
    
    // Header
    const headers = ['№', 'Клиент', 'Телефон', 'Кол-во', 'Бонус', 'Цена', 'Сумма'];
    headers.forEach((h, i) => {
      const cell = sheet.getCell(row, i + 1);
      cell.value = h;
      cell.font = STYLES.FONT_BOLD;
      cell.fill = STYLES.FILL_HEADER_GREY;
      cell.alignment = i === 1 ? STYLES.ALIGN_LEFT : STYLES.ALIGN_CENTER;
    });
    applyBorderRange(sheet, row, 1, row, 7);
    row++;
    
    // Mijozlar
    for (let i = 1; i <= 10; i++) {
      sheet.getCell(row, 1).value = i;
      sheet.getCell(row, 2).value = '{{CLIENT}}';
      sheet.getCell(row, 3).value = '{{PHONE}}';
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
    tot.value = 'ИТОГО';
    tot.font = STYLES.FONT_BOLD;
    tot.fill = STYLES.FILL_HEADER_GREY;
    
    [4, 5, 6, 7].forEach(c => {
      sheet.getCell(row, c).value = '{{TOTAL}}';
      sheet.getCell(row, c).font = STYLES.FONT_BOLD;
      sheet.getCell(row, c).fill = STYLES.FILL_HEADER_GREY;
      sheet.getCell(row, c).alignment = STYLES.ALIGN_RIGHT;
    });
    applyBorderRange(sheet, row, 1, row, 7);
    
    setPageSetup(sheet, 'portrait');
  });
}

// 7. Summary Compact (700)
export async function createTemplate700(outputPath: string) {
  await createSafeExcelFile(outputPath, async (wb) => {
    const sheet = wb.addWorksheet('Сводная', { views: [{ showGridLines: true }] });
    
    [6, 12, 40, 11, 11, 15].forEach((w, i) => {
      sheet.getColumn(i + 1).width = w;
    });
    
    let row = 1;
    sheet.mergeCells(row, 1, row, 6);
    const title = sheet.getCell(row, 1);
    title.value = 'Сводная накладная 7.0.0 - Компактная (Время печати: {{datetime}})';
    title.font = { ...STYLES.FONT_BOLD, size: 12 };
    title.alignment = STYLES.ALIGN_CENTER;
    applyBorderRange(sheet, row, 1, row, 6);
    row++;
    
    row = addMetaSection(sheet, row, 6);
    row++;
    
    // Header
    const headers = ['№', 'Код', 'Продукт', 'Кол-во', 'Цена', 'Сумма'];
    headers.forEach((h, i) => {
      const cell = sheet.getCell(row, i + 1);
      cell.value = h;
      cell.font = STYLES.FONT_BOLD;
      cell.fill = STYLES.FILL_HEADER_GREY;
      cell.alignment = i === 2 ? STYLES.ALIGN_LEFT : STYLES.ALIGN_CENTER;
    });
    applyBorderRange(sheet, row, 1, row, 6);
    row++;
    
    // Mahsulotlar
    for (let i = 1; i <= 15; i++) {
      sheet.getCell(row, 1).value = i;
      sheet.getCell(row, 2).value = '{{CODE}}';
      sheet.getCell(row, 3).value = '{{PRODUCT}}';
      [4, 5, 6].forEach(c => {
        sheet.getCell(row, c).value = '{{VALUE}}';
        sheet.getCell(row, c).alignment = STYLES.ALIGN_RIGHT;
      });
      applyBorderRange(sheet, row, 1, row, 6);
      row++;
    }
    
    // Jami
    sheet.mergeCells(row, 1, row, 3);
    const tot = sheet.getCell(row, 1);
    tot.value = 'ИТОГО';
    tot.font = STYLES.FONT_BOLD;
    tot.fill = STYLES.FILL_HEADER_GREY;
    
    [4, 5, 6].forEach(c => {
      sheet.getCell(row, c).value = '{{TOTAL}}';
      sheet.getCell(row, c).font = STYLES.FONT_BOLD;
      sheet.getCell(row, c).fill = STYLES.FILL_HEADER_GREY;
      sheet.getCell(row, c).alignment = STYLES.ALIGN_RIGHT;
    });
    applyBorderRange(sheet, row, 1, row, 6);
    
    addSignatureSection(sheet, row, 6);
    setPageSetup(sheet, 'portrait');
  });
}

// 8. Per Expeditor (701)
export async function createTemplate701(outputPath: string) {
  await createSafeExcelFile(outputPath, async (wb) => {
    const sheet = wb.addWorksheet('Экспедитор', { views: [{ showGridLines: true }] });
    
    [6, 12, 40, 11, 11, 13, 15].forEach((w, i) => {
      sheet.getColumn(i + 1).width = w;
    });
    
    let row = 1;
    sheet.mergeCells(row, 1, row, 7);
    const title = sheet.getCell(row, 1);
    title.value = 'Загруз по экспедитору 7.0.1 (Время печати: {{datetime}})';
    title.font = { ...STYLES.FONT_BOLD, size: 12 };
    title.alignment = STYLES.ALIGN_CENTER;
    applyBorderRange(sheet, row, 1, row, 7);
    row++;
    
    // Ekspeditor
    sheet.mergeCells(row, 1, row, 2);
    sheet.getCell(row, 1).value = 'Экспедитор';
    sheet.getCell(row, 1).font = STYLES.FONT_BOLD;
    sheet.mergeCells(row, 3, row, 7);
    sheet.getCell(row, 3).value = '{{ЭКСПЕДИТОР}}';
    applyBorderRange(sheet, row, 1, row, 7);
    row++;
    
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
    
    // Mahsulotlar
    for (let i = 1; i <= 10; i++) {
      sheet.getCell(row, 1).value = i;
      sheet.getCell(row, 2).value = '{{CODE}}';
      sheet.getCell(row, 3).value = '{{PRODUCT}}';
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
    tot.value = 'ИТОГО';
    tot.font = STYLES.FONT_BOLD;
    tot.fill = STYLES.FILL_HEADER_GREY;
    
    [4, 5, 6, 7].forEach(c => {
      sheet.getCell(row, c).value = '{{TOTAL}}';
      sheet.getCell(row, c).font = STYLES.FONT_BOLD;
      sheet.getCell(row, c).fill = STYLES.FILL_HEADER_GREY;
      sheet.getCell(row, c).alignment = STYLES.ALIGN_RIGHT;
    });
    applyBorderRange(sheet, row, 1, row, 7);
    
    addSignatureSection(sheet, row, 7);
    setPageSetup(sheet, 'portrait');
  });
}

// 9. Thermal Printer (702)
export async function createTemplate702(outputPath: string) {
  await createSafeExcelFile(outputPath, async (wb) => {
    const sheet = wb.addWorksheet('Чек', { views: [{ showGridLines: false }] });
    
    // Tor format - 80mm printer
    sheet.getColumn(1).width = 4;
    sheet.getColumn(2).width = 24;
    sheet.getColumn(3).width = 6;
    sheet.getColumn(4).width = 10;
    
    sheet.properties.defaultRowHeight = 15;
    
    let row = 1;
    
    // Sarlavha
    sheet.mergeCells(row, 1, row, 4);
    const title = sheet.getCell(row, 1);
    title.value = 'X-Printer 80мм';
    title.font = { ...STYLES.FONT_BOLD, size: 10 };
    title.alignment = STYLES.ALIGN_CENTER;
    row++;
    
    sheet.mergeCells(row, 1, row, 4);
    sheet.getCell(row, 1).value = '========================';
    sheet.getCell(row, 1).alignment = STYLES.ALIGN_CENTER;
    row++;
    
    // Umumiy ma'lumot
    const info = [
      ['Заказ', '{{ORDER}}'],
      ['Дата', '{{DATE}}'],
      ['Клиент', '{{CLIENT}}']
    ];
    
    for (const [label, value] of info) {
      sheet.mergeCells(row, 1, row, 2);
      sheet.getCell(row, 1).value = label;
      sheet.getCell(row, 1).font = { bold: true, size: 9 };
      sheet.mergeCells(row, 3, row, 4);
      sheet.getCell(row, 3).value = value;
      sheet.getCell(row, 3).font = { size: 9 };
      sheet.getCell(row, 3).alignment = STYLES.ALIGN_RIGHT;
      row++;
    }
    
    sheet.mergeCells(row, 1, row, 4);
    sheet.getCell(row, 1).value = '------------------------';
    sheet.getCell(row, 1).alignment = STYLES.ALIGN_CENTER;
    row++;
    
    // Mahsulotlar
    for (let i = 1; i <= 10; i++) {
      sheet.getCell(row, 1).value = i;
      sheet.getCell(row, 1).font = { size: 8 };
      sheet.getCell(row, 2).value = '{{PRODUCT}}';
      sheet.getCell(row, 2).font = { size: 8 };
      sheet.getCell(row, 2).alignment = { wrapText: true };
      sheet.getCell(row, 3).value = '{{QTY}}';
      sheet.getCell(row, 3).font = { size: 8 };
      sheet.getCell(row, 3).alignment = STYLES.ALIGN_CENTER;
      sheet.getCell(row, 4).value = '{{SUM}}';
      sheet.getCell(row, 4).font = { size: 8 };
      sheet.getCell(row, 4).alignment = STYLES.ALIGN_RIGHT;
      row++;
    }
    
    sheet.mergeCells(row, 1, row, 4);
    sheet.getCell(row, 1).value = '========================';
    sheet.getCell(row, 1).alignment = STYLES.ALIGN_CENTER;
    row++;
    
    // Jami
    sheet.mergeCells(row, 1, row, 3);
    sheet.getCell(row, 1).value = 'ИТОГО:';
    sheet.getCell(row, 1).font = { bold: true, size: 10 };
    sheet.getCell(row, 4).value = '{{TOTAL}}';
    sheet.getCell(row, 4).font = { bold: true, size: 10 };
    sheet.getCell(row, 4).alignment = STYLES.ALIGN_RIGHT;
    
    // Thermal uchun maxsus sozlamalar
    sheet.pageSetup = {
      orientation: 'portrait',
      paperSize: undefined, // Custom
      fitToPage: false,
      margins: { 
        left: 0.1, 
        right: 0.1, 
        top: 0.2, 
        bottom: 0.2, 
        header: 0, 
        footer: 0 
      }
    };
  });
}

// 10. Territory Matrix (703)
export async function createTemplate703(outputPath: string) {
  await createSafeExcelFile(outputPath, async (wb) => {
    const sheet = wb.addWorksheet('Территория', { views: [{ showGridLines: true }] });
    
    sheet.getColumn(1).width = 40;
    for (let i = 2; i <= 12; i++) {
      sheet.getColumn(i).width = 11;
    }
    
    let row = 1;
    sheet.mergeCells(row, 1, row, 12);
    const title = sheet.getCell(row, 1);
    title.value = 'Загруз зав.склада 7.0.3 - Матрица по территориям (Время печати: {{datetime}})';
    title.font = { ...STYLES.FONT_BOLD, size: 12 };
    title.alignment = STYLES.ALIGN_CENTER;
    applyBorderRange(sheet, row, 1, row, 12);
    row += 2;
    
    // Header
    sheet.getCell(row, 1).value = 'Продукт';
    for (let i = 2; i <= 12; i++) {
      sheet.getCell(row, i).value = `{{TERR_${i - 1}}}`;
    }
    for (let i = 1; i <= 12; i++) {
      const cell = sheet.getCell(row, i);
      cell.font = STYLES.FONT_BOLD_WHITE;
      cell.fill = STYLES.FILL_HEADER_BLUE;
      cell.alignment = i === 1 ? STYLES.ALIGN_LEFT : STYLES.ALIGN_CENTER;
    }
    applyBorderRange(sheet, row, 1, row, 12);
    row++;
    
    // Mahsulotlar
    for (let i = 1; i <= 20; i++) {
      sheet.getCell(row, 1).value = `{{PRODUCT}}`;
      for (let j = 2; j <= 12; j++) {
        sheet.getCell(row, j).value = '';
        sheet.getCell(row, j).alignment = STYLES.ALIGN_CENTER;
      }
      applyBorderRange(sheet, row, 1, row, 12);
      row++;
    }
    
    // Jami
    sheet.getCell(row, 1).value = 'ИТОГО';
    sheet.getCell(row, 1).font = STYLES.FONT_BOLD;
    sheet.getCell(row, 1).fill = STYLES.FILL_HEADER_GREY;
    for (let i = 2; i <= 12; i++) {
      sheet.getCell(row, i).value = '{{TOTAL}}';
      sheet.getCell(row, i).font = STYLES.FONT_BOLD;
      sheet.getCell(row, i).fill = STYLES.FILL_HEADER_GREY;
      sheet.getCell(row, i).alignment = STYLES.ALIGN_CENTER;
    }
    applyBorderRange(sheet, row, 1, row, 12);
    
    setPageSetup(sheet, 'landscape');
  });
}

// 11. Category Client (704)
export async function createTemplate704(outputPath: string) {
  await createSafeExcelFile(outputPath, async (wb) => {
    const sheet = wb.addWorksheet('Категория-Клиент', { views: [{ showGridLines: true }] });
    
    [6, 12, 40, 20, 11, 11, 13, 15].forEach((w, i) => {
      sheet.getColumn(i + 1).width = w;
    });
    
    let row = 1;
    sheet.mergeCells(row, 1, row, 8);
    const title = sheet.getCell(row, 1);
    title.value = 'Загруз зав.склада 7.0.4 - По категориям и клиентам (Время печати: {{datetime}})';
    title.font = { ...STYLES.FONT_BOLD, size: 12 };
    title.alignment = STYLES.ALIGN_CENTER;
    applyBorderRange(sheet, row, 1, row, 8);
    row++;
    
    row = addMetaSection(sheet, row, 8);
    row++;
    
    // Header
    const headers = ['№', 'Код', 'Продукт', 'Клиент', 'Кол-во', 'Бонус', 'Цена', 'Сумма'];
    headers.forEach((h, i) => {
      const cell = sheet.getCell(row, i + 1);
      cell.value = h;
      cell.font = STYLES.FONT_BOLD;
      cell.fill = STYLES.FILL_HEADER_GREY;
      cell.alignment = [2, 3].includes(i) ? STYLES.ALIGN_LEFT : STYLES.ALIGN_CENTER;
    });
    applyBorderRange(sheet, row, 1, row, 8);
    row++;
    
    // Kategoriya
    sheet.mergeCells(row, 1, row, 3);
    [1, 2, 3].forEach(c => { sheet.getCell(row, c).fill = STYLES.FILL_GROUP; });
    const cat = sheet.getCell(row, 4);
    cat.value = '{{КАТЕГОРИЯ}}';
    cat.font = STYLES.FONT_BOLD;
    cat.fill = STYLES.FILL_GROUP;
    [5, 6, 7, 8].forEach(c => {
      sheet.getCell(row, c).fill = STYLES.FILL_GROUP;
      sheet.getCell(row, c).font = STYLES.FONT_BOLD;
      sheet.getCell(row, c).alignment = STYLES.ALIGN_RIGHT;
    });
    applyBorderRange(sheet, row, 1, row, 8);
    row++;
    
    // Mahsulotlar
    for (let i = 1; i <= 10; i++) {
      sheet.getCell(row, 1).value = i;
      sheet.getCell(row, 2).value = '{{CODE}}';
      sheet.getCell(row, 3).value = '{{PRODUCT}}';
      sheet.getCell(row, 4).value = '{{CLIENT}}';
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
    tot.value = 'ИТОГО';
    tot.font = STYLES.FONT_BOLD;
    tot.fill = STYLES.FILL_HEADER_GREY;
    
    [5, 6, 7, 8].forEach(c => {
      sheet.getCell(row, c).value = '{{TOTAL}}';
      sheet.getCell(row, c).font = STYLES.FONT_BOLD;
      sheet.getCell(row, c).fill = STYLES.FILL_HEADER_GREY;
      sheet.getCell(row, c).alignment = STYLES.ALIGN_RIGHT;
    });
    applyBorderRange(sheet, row, 1, row, 8);
    
    addSignatureSection(sheet, row, 8);
    setPageSetup(sheet, 'portrait');
  });
}

// Barcha generator larni export qilish
export const allGenerators = {
  '601': createTemplate601,
  '602': createTemplate602,
  '700': createTemplate700,
  '701': createTemplate701,
  '702': createTemplate702,
  '703': createTemplate703,
  '704': createTemplate704
};
