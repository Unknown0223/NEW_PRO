import ExcelJS from 'exceljs';
import * as path from 'path';
import { createSafeExcelFile } from './excel-generator-fixed';

/**
 * НАКЛАДНЫЕ (РЕЕСТР) 2.1 - MUKAMMAL SHABLON
 * 
 * Xususiyatlar:
 * - Bir sahifada BITTA mijoz (ikki nusxa emas!)
 * - Заказ va Бонус bo'limlari
 * - Ixcham va o'qishga qulay
 * - XML xavfsiz
 * - Minimal merge cells
 */

const COLORS = {
  HEADER_GREY: 'FFD9D9D9',
  ORDER_BLUE: 'FFD6EAF8',
  BONUS_GREEN: 'FFD5F4E6',
  WHITE: 'FFFFFFFF'
};

const BORDER_THIN = {
  top: { style: 'thin' as const },
  left: { style: 'thin' as const },
  bottom: { style: 'thin' as const },
  right: { style: 'thin' as const }
};

function applyBorder(cell: ExcelJS.Cell) {
  cell.border = BORDER_THIN;
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

export async function createNakladnoyTemplate(outputPath: string) {
  await createSafeExcelFile(outputPath, async (wb) => {
    const sheet = wb.addWorksheet('Накладная', {
      views: [{ showGridLines: true }]
    });
    
    // Ustun kengliklari (optimallashtirilgan, bitta format)
    sheet.getColumn(1).width = 4;   // № (A)
    sheet.getColumn(2).width = 25;  // Наименование (B)
    sheet.getColumn(3).width = 8;   // Блок (C)
    sheet.getColumn(4).width = 7;   // Кол-во (D)
    sheet.getColumn(5).width = 12;  // Цена (E)
    sheet.getColumn(6).width = 14;  // Сумма (F)
    
    sheet.properties.defaultRowHeight = 16;
    
    let row = 1;
    
    // ============================================================
    // MIJOZ MA'LUMOTLARI
    // ============================================================
    
    // Клиент
    sheet.mergeCells(row, 1, row, 6);
    const client = sheet.getCell(row, 1);
    client.value = 'Клиент: {{CLIENT_NAME}}';
    client.font = { bold: true, size: 11 };
    client.alignment = { vertical: 'middle', horizontal: 'left' };
    applyBorderRange(sheet, row, 1, row, 6);
    row++;
    
    // Адрес
    sheet.mergeCells(row, 1, row, 6);
    const address = sheet.getCell(row, 1);
    address.value = 'Адрес: {{ADDRESS}}';
    address.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    applyBorderRange(sheet, row, 1, row, 6);
    row++;
    
    // Агент
    sheet.mergeCells(row, 1, row, 6);
    const agent = sheet.getCell(row, 1);
    agent.value = 'Агент: {{AGENT_NAME}} ({{AGENT_PHONE}})';
    agent.alignment = { vertical: 'middle', horizontal: 'left' };
    applyBorderRange(sheet, row, 1, row, 6);
    row++;
    
    // Экспедитор
    sheet.mergeCells(row, 1, row, 6);
    const expeditor = sheet.getCell(row, 1);
    expeditor.value = 'Экспедитор: {{EXPEDITOR_NAME}} ({{EXPEDITOR_PHONE}})';
    expeditor.alignment = { vertical: 'middle', horizontal: 'left' };
    applyBorderRange(sheet, row, 1, row, 6);
    row++;
    
    // Дата накладной
    sheet.mergeCells(row, 1, row, 6);
    const datePhone = sheet.getCell(row, 1);
    datePhone.value = 'Дата накладной / тел : {{DATE}} / {{PHONE}}';
    datePhone.alignment = { vertical: 'middle', horizontal: 'left' };
    applyBorderRange(sheet, row, 1, row, 6);
    row++;
    
    // ============================================================
    // ЗАКАЗ SECTION
    // ============================================================
    
    sheet.mergeCells(row, 1, row, 6);
    const orderHeader = sheet.getCell(row, 1);
    orderHeader.value = 'ЗАКАЗ ({{ORDER_IDS}})';
    orderHeader.font = { bold: true, size: 11 };
    orderHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.ORDER_BLUE }
    };
    orderHeader.alignment = { vertical: 'middle', horizontal: 'center' };
    applyBorderRange(sheet, row, 1, row, 6);
    row++;
    
    // Header qatori
    const orderHeaders = [
      { col: 1, text: '№' },
      { col: 2, text: 'Наименование' },
      { col: 3, text: 'Блок' },
      { col: 4, text: 'Кол-во' },
      { col: 5, text: 'Цена' },
      { col: 6, text: 'Сумма' }
    ];
    
    for (const h of orderHeaders) {
      const cell = sheet.getCell(row, h.col);
      cell.value = h.text;
      cell.font = { bold: true, size: 10 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORS.HEADER_GREY }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    }
    applyBorderRange(sheet, row, 1, row, 6);
    row++;
    
    // Mahsulotlar (10 ta namuna)
    for (let i = 1; i <= 10; i++) {
      sheet.getCell(row, 1).value = i;
      sheet.getCell(row, 1).alignment = { horizontal: 'center', vertical: 'middle' };
      
      sheet.getCell(row, 2).value = `{{PRODUCT_${i}}}`;
      sheet.getCell(row, 2).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      
      sheet.getCell(row, 3).value = '{{BLOCK}}';
      sheet.getCell(row, 3).alignment = { horizontal: 'center', vertical: 'middle' };
      
      sheet.getCell(row, 4).value = '{{QTY}}';
      sheet.getCell(row, 4).alignment = { horizontal: 'center', vertical: 'middle' };
      
      sheet.getCell(row, 5).value = '{{PRICE}}';
      sheet.getCell(row, 5).alignment = { horizontal: 'right', vertical: 'middle' };
      sheet.getCell(row, 5).numFmt = '#,##0';
      
      sheet.getCell(row, 6).value = '{{SUM}}';
      sheet.getCell(row, 6).alignment = { horizontal: 'right', vertical: 'middle' };
      sheet.getCell(row, 6).numFmt = '#,##0';
      
      applyBorderRange(sheet, row, 1, row, 6);
      row++;
    }
    
    // Заказ итого
    sheet.getCell(row, 2).value = 'Итог';
    sheet.getCell(row, 2).font = { bold: true };
    sheet.getCell(row, 2).alignment = { horizontal: 'left', vertical: 'middle' };
    
    sheet.getCell(row, 3).value = '{{TOTAL_BLOCKS}}';
    sheet.getCell(row, 3).font = { bold: true };
    sheet.getCell(row, 3).alignment = { horizontal: 'center', vertical: 'middle' };
    
    sheet.getCell(row, 4).value = '{{TOTAL_QTY}}';
    sheet.getCell(row, 4).font = { bold: true };
    sheet.getCell(row, 4).alignment = { horizontal: 'center', vertical: 'middle' };
    
    sheet.mergeCells(row, 5, row, 6);
    sheet.getCell(row, 5).value = '{{TOTAL_SUM}} сум';
    sheet.getCell(row, 5).font = { bold: true };
    sheet.getCell(row, 5).alignment = { horizontal: 'right', vertical: 'middle' };
    
    applyBorderRange(sheet, row, 1, row, 6);
    row++;
    
    row++; // Bo'sh qator
    
    // ============================================================
    // БОНУС SECTION
    // ============================================================
    
    sheet.mergeCells(row, 1, row, 6);
    const bonusHeader = sheet.getCell(row, 1);
    bonusHeader.value = 'БОНУС ({{BONUS_IDS}})';
    bonusHeader.font = { bold: true, size: 11 };
    bonusHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.BONUS_GREEN }
    };
    bonusHeader.alignment = { vertical: 'middle', horizontal: 'center' };
    applyBorderRange(sheet, row, 1, row, 6);
    row++;
    
    // Bonus mahsulotlari (5 ta namuna)
    for (let i = 1; i <= 5; i++) {
      sheet.getCell(row, 1).value = i;
      sheet.getCell(row, 1).alignment = { horizontal: 'center', vertical: 'middle' };
      
      sheet.getCell(row, 2).value = `{{BONUS_PRODUCT_${i}}}`;
      sheet.getCell(row, 2).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      
      sheet.getCell(row, 3).value = '{{BONUS_BLOCK}}';
      sheet.getCell(row, 3).alignment = { horizontal: 'center', vertical: 'middle' };
      
      sheet.getCell(row, 4).value = '{{BONUS_QTY}}';
      sheet.getCell(row, 4).alignment = { horizontal: 'center', vertical: 'middle' };
      
      sheet.getCell(row, 5).value = '—';
      sheet.getCell(row, 5).alignment = { horizontal: 'center', vertical: 'middle' };
      
      sheet.getCell(row, 6).value = '—';
      sheet.getCell(row, 6).alignment = { horizontal: 'center', vertical: 'middle' };
      
      applyBorderRange(sheet, row, 1, row, 6);
      row++;
    }
    
    // Bonus итого
    sheet.getCell(row, 2).value = 'Итог';
    sheet.getCell(row, 2).font = { bold: true };
    sheet.getCell(row, 2).alignment = { horizontal: 'left', vertical: 'middle' };
    
    sheet.getCell(row, 3).value = '{{BONUS_TOTAL_BLOCKS}}';
    sheet.getCell(row, 3).font = { bold: true };
    sheet.getCell(row, 3).alignment = { horizontal: 'center', vertical: 'middle' };
    
    sheet.getCell(row, 4).value = '{{BONUS_TOTAL_QTY}} шт.';
    sheet.getCell(row, 4).font = { bold: true };
    sheet.getCell(row, 4).alignment = { horizontal: 'center', vertical: 'middle' };
    
    applyBorderRange(sheet, row, 1, row, 6);
    row++;
    
    row++; // Bo'sh qator
    
    // ============================================================
    // IMZO QISMI
    // ============================================================
    
    sheet.mergeCells(row, 1, row, 3);
    sheet.getCell(row, 1).value = 'Отпустил: _______________';
    sheet.getCell(row, 1).alignment = { horizontal: 'center', vertical: 'middle' };
    
    sheet.mergeCells(row, 4, row, 6);
    sheet.getCell(row, 4).value = 'Принял: _________________';
    sheet.getCell(row, 4).alignment = { horizontal: 'center', vertical: 'middle' };
    
    applyBorderRange(sheet, row, 1, row, 6);
    row++;
    
    // Print sozlamalari
    sheet.pageSetup = {
      orientation: 'portrait',
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { 
        left: 0.5, 
        right: 0.5, 
        top: 0.4, 
        bottom: 0.4, 
        header: 0.2, 
        footer: 0.2 
      },
      printTitlesRow: '1:6' // Header qayta chop qilish
    };
  });
}

/**
 * РЕЕСТР (KO'P MIJOZLI) SHABLON
 * 
 * Bir faylda bir nechta mijozlar uchun nakladnoy
 */
export async function createReestrTemplate(outputPath: string) {
  await createSafeExcelFile(outputPath, async (wb) => {
    const sheet = wb.addWorksheet('Реестр накладных', {
      views: [{ showGridLines: true }]
    });
    
    // Ustun kengliklari
    sheet.getColumn(1).width = 4;
    sheet.getColumn(2).width = 25;
    sheet.getColumn(3).width = 8;
    sheet.getColumn(4).width = 7;
    sheet.getColumn(5).width = 12;
    sheet.getColumn(6).width = 14;
    
    sheet.properties.defaultRowHeight = 16;
    
    // Birinchi mijoz uchun namuna
    let startRow = 1;
    
    // Bu funksiya har bir mijoz uchun block yaratadi
    const createClientBlock = (row: number, clientNum: number) => {
      let currentRow = row;
      
      // Mijoz ma'lumotlari
      sheet.mergeCells(currentRow, 1, currentRow, 6);
      const client = sheet.getCell(currentRow, 1);
      client.value = `Клиент: {{CLIENT_${clientNum}_NAME}}`;
      client.font = { bold: true, size: 11 };
      client.alignment = { vertical: 'middle', horizontal: 'left' };
      applyBorderRange(sheet, currentRow, 1, currentRow, 6);
      currentRow++;
      
      // Adres
      sheet.mergeCells(currentRow, 1, currentRow, 6);
      sheet.getCell(currentRow, 1).value = `Адрес: {{CLIENT_${clientNum}_ADDRESS}}`;
      applyBorderRange(sheet, currentRow, 1, currentRow, 6);
      currentRow++;
      
      // Agent
      sheet.mergeCells(currentRow, 1, currentRow, 6);
      sheet.getCell(currentRow, 1).value = `Агент: {{AGENT}}`;
      applyBorderRange(sheet, currentRow, 1, currentRow, 6);
      currentRow++;
      
      // Expeditor
      sheet.mergeCells(currentRow, 1, currentRow, 6);
      sheet.getCell(currentRow, 1).value = `Экспедитор: {{EXPEDITOR}}`;
      applyBorderRange(sheet, currentRow, 1, currentRow, 6);
      currentRow++;
      
      // Sana
      sheet.mergeCells(currentRow, 1, currentRow, 6);
      sheet.getCell(currentRow, 1).value = `Дата накладной: {{DATE}}`;
      applyBorderRange(sheet, currentRow, 1, currentRow, 6);
      currentRow++;
      
      // ZAКАЗ
      sheet.mergeCells(currentRow, 1, currentRow, 6);
      const orderH = sheet.getCell(currentRow, 1);
      orderH.value = `ЗАКАЗ ({{ORDER_IDS_${clientNum}}})`;
      orderH.font = { bold: true };
      orderH.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORS.ORDER_BLUE }
      };
      orderH.alignment = { horizontal: 'center', vertical: 'middle' };
      applyBorderRange(sheet, currentRow, 1, currentRow, 6);
      currentRow++;
      
      // Headers
      const headers = ['№', 'Наименование', 'Блок', 'Кол-во', 'Цена', 'Сумма'];
      for (let i = 0; i < headers.length; i++) {
        const cell = sheet.getCell(currentRow, i + 1);
        cell.value = headers[i];
        cell.font = { bold: true, size: 9 };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLORS.HEADER_GREY }
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      applyBorderRange(sheet, currentRow, 1, currentRow, 6);
      currentRow++;
      
      // 3 ta mahsulot namunasi
      for (let i = 1; i <= 3; i++) {
        sheet.getCell(currentRow, 1).value = i;
        sheet.getCell(currentRow, 2).value = '{{PRODUCT}}';
        sheet.getCell(currentRow, 3).value = '{{BLOCK}}';
        sheet.getCell(currentRow, 4).value = '{{QTY}}';
        sheet.getCell(currentRow, 5).value = '{{PRICE}}';
        sheet.getCell(currentRow, 6).value = '{{SUM}}';
        applyBorderRange(sheet, currentRow, 1, currentRow, 6);
        currentRow++;
      }
      
      // Jami
      sheet.getCell(currentRow, 2).value = 'Итог';
      sheet.getCell(currentRow, 2).font = { bold: true };
      sheet.mergeCells(currentRow, 5, currentRow, 6);
      sheet.getCell(currentRow, 5).value = '{{TOTAL}} сум';
      sheet.getCell(currentRow, 5).font = { bold: true };
      applyBorderRange(sheet, currentRow, 1, currentRow, 6);
      currentRow++;
      
      // Imzo
      currentRow++;
      sheet.mergeCells(currentRow, 1, currentRow, 3);
      sheet.getCell(currentRow, 1).value = 'Отпустил: _______________';
      sheet.mergeCells(currentRow, 4, currentRow, 6);
      sheet.getCell(currentRow, 4).value = 'Принял: _________________';
      applyBorderRange(sheet, currentRow, 1, currentRow, 6);
      currentRow++;
      
      // Bo'sh qator (keyingi mijoz uchun)
      currentRow += 2;
      
      return currentRow;
    };
    
    // 3 ta mijoz uchun namuna
    startRow = createClientBlock(startRow, 1);
    startRow = createClientBlock(startRow, 2);
    startRow = createClientBlock(startRow, 3);
    
    // Print sozlamalari
    sheet.pageSetup = {
      orientation: 'portrait',
      paperSize: 9,
      fitToPage: false,
      fitToWidth: 1,
      margins: { 
        left: 0.4, 
        right: 0.4, 
        top: 0.4, 
        bottom: 0.4, 
        header: 0.2, 
        footer: 0.2 
      }
    };
  });
}

// CLI
if (require.main === module) {
  const type = process.argv[2] || 'single'; // 'single' yoki 'reestr'
  const outputPath = process.argv[3] || `./210-nakladnoy-${type}-fixed.xlsx`;
  
  if (type === 'reestr') {
    createReestrTemplate(outputPath)
      .then(() => console.log(`✓ Реестр shablon yaratildi: ${outputPath}`))
      .catch(err => {
        console.error('✗ Xato:', err);
        process.exit(1);
      });
  } else {
    createNakladnoyTemplate(outputPath)
      .then(() => console.log(`✓ Накладная shablon yaratildi: ${outputPath}`))
      .catch(err => {
        console.error('✗ Xato:', err);
        process.exit(1);
      });
  }
}
