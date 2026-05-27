import ExcelJS from 'exceljs';
import * as path from 'path';
import { createSafeExcelFile } from './excel-generator-fixed';

/**
 * ЗАГРУЗ ЗАВ.СКЛАДА 5.1.8 - MUKAMMAL SHABLON
 * 
 * Xususiyatlar:
 * - Gruppalar ranglar bilan
 * - Bonus va Возврат sections
 * - To'liq meta ma'lumot
 * - XML xavfsiz
 * - Optimal merge cells
 */

const COLORS = {
  HEADER_GREY: 'FFD9D9D9',
  GROUP_BLUE: 'FF00CCFF',      // LIPUCHKA, GIGA, etc.
  BONUS_PURPLE: 'FFCCBBCC',     // Бонусы
  RETURN_PURPLE: 'FFCCBBCC',    // Возврат с полки
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

export async function createZagruzTemplate(outputPath: string) {
  await createSafeExcelFile(outputPath, async (wb) => {
    const sheet = wb.addWorksheet('Загруз зав.склада 5.1.8', {
      views: [{ showGridLines: true }]
    });
    
    // Ustun kengliklari (optimallashtirilgan)
    sheet.getColumn(1).width = 6;   // № (A)
    sheet.getColumn(2).width = 15;  // Код/Штрих-код (B)
    sheet.getColumn(3).width = 40;  // Продукты (C)
    sheet.getColumn(4).width = 12;  // Bo'sh (D) - merge uchun
    sheet.getColumn(5).width = 14;  // Количество (E)
    sheet.getColumn(6).width = 15;  // Цена (F)
    sheet.getColumn(7).width = 15;  // Сумма (G)
    
    sheet.properties.defaultRowHeight = 18;
    
    let row = 1;
    
    // ============================================================
    // SARLAVHA
    // ============================================================
    sheet.mergeCells(row, 1, row, 5);
    const title = sheet.getCell(row, 1);
    title.value = 'Загрузочный лист';
    title.font = { bold: true, size: 14 };
    title.alignment = { vertical: 'middle', horizontal: 'center' };
    applyBorderRange(sheet, row, 1, row, 7);
    row++;
    
    // ============================================================
    // META MA'LUMOTLAR
    // ============================================================
    
    // Dата заявки va Дата отгрузки
    sheet.mergeCells(row, 1, row, 3);
    const dateOrder = sheet.getCell(row, 1);
    dateOrder.value = 'Дата заявки: {{DATE_ORDER}}';
    dateOrder.alignment = { vertical: 'middle', horizontal: 'left' };
    
    sheet.mergeCells(row, 4, row, 7);
    const dateShip = sheet.getCell(row, 4);
    dateShip.value = 'Дата отгрузки: {{DATE_SHIPMENT}}';
    dateShip.font = { bold: true };
    dateShip.alignment = { vertical: 'middle', horizontal: 'left' };
    applyBorderRange(sheet, row, 1, row, 7);
    row++;
    
    // Агенты
    sheet.mergeCells(row, 1, row, 3);
    const agentLabel = sheet.getCell(row, 1);
    agentLabel.value = 'Агенты:';
    agentLabel.alignment = { vertical: 'middle', horizontal: 'left' };
    
    sheet.mergeCells(row, 4, row, 7);
    const agentValue = sheet.getCell(row, 4);
    agentValue.value = '{{AGENTS}}';
    agentValue.font = { bold: true };
    agentValue.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    applyBorderRange(sheet, row, 1, row, 7);
    row++;
    
    // Территория
    sheet.mergeCells(row, 1, row, 3);
    const terrLabel = sheet.getCell(row, 1);
    terrLabel.value = 'Территория:';
    terrLabel.alignment = { vertical: 'middle', horizontal: 'left' };
    
    sheet.mergeCells(row, 4, row, 7);
    const terrValue = sheet.getCell(row, 4);
    terrValue.value = '{{TERRITORY}}';
    terrValue.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    applyBorderRange(sheet, row, 1, row, 7);
    row++;
    
    // Телефон агента
    sheet.mergeCells(row, 1, row, 3);
    const phoneLabel = sheet.getCell(row, 1);
    phoneLabel.value = 'Телефон агента:';
    phoneLabel.alignment = { vertical: 'middle', horizontal: 'left' };
    
    sheet.mergeCells(row, 4, row, 7);
    const phoneValue = sheet.getCell(row, 4);
    phoneValue.value = '{{AGENT_PHONES}}';
    phoneValue.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    applyBorderRange(sheet, row, 1, row, 7);
    row++;
    
    // Экспедитор
    sheet.mergeCells(row, 1, row, 3);
    const expLabel = sheet.getCell(row, 1);
    expLabel.value = 'Экспедитор';
    expLabel.alignment = { vertical: 'middle', horizontal: 'left' };
    
    sheet.mergeCells(row, 4, row, 7);
    const expValue = sheet.getCell(row, 4);
    expValue.value = '{{EXPEDITOR}}';
    expValue.alignment = { vertical: 'middle', horizontal: 'left' };
    applyBorderRange(sheet, row, 1, row, 7);
    row++;
    
    row++; // Bo'sh qator
    
    // ============================================================
    // HEADER
    // ============================================================
    const headers = [
      { col: 1, text: '№', width: 6 },
      { col: 2, text: 'Штрих код', width: 15 },
      { col: 3, text: 'Продукты', width: 40 },
      { col: 5, text: 'Количество', width: 14 },
      { col: 6, text: 'Цена', width: 15 },
      { col: 7, text: 'Сумма', width: 15 }
    ];
    
    for (const h of headers) {
      const cell = sheet.getCell(row, h.col);
      cell.value = h.text;
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORS.HEADER_GREY }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    }
    applyBorderRange(sheet, row, 1, row, 7);
    row++;
    
    // ============================================================
    // GRUPPALAR VA MAHSULOTLAR (NAMUNA)
    // ============================================================
    
    // Guruh 1: LIPUCHKA
    sheet.mergeCells(row, 3, row, 4);
    const group1 = sheet.getCell(row, 3);
    group1.value = '{{GROUP_NAME_1}}'; // LIPUCHKA
    group1.font = { bold: true };
    group1.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.GROUP_BLUE }
    };
    group1.alignment = { vertical: 'middle', horizontal: 'left' };
    
    sheet.getCell(row, 5).value = '{{GROUP_QTY_1}}';
    sheet.getCell(row, 5).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.GROUP_BLUE }
    };
    
    sheet.getCell(row, 7).value = '{{GROUP_SUM_1}}';
    sheet.getCell(row, 7).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.GROUP_BLUE }
    };
    
    applyBorderRange(sheet, row, 1, row, 7);
    row++;
    
    // Mahsulotlar (3 ta namuna)
    for (let i = 1; i <= 3; i++) {
      sheet.getCell(row, 1).value = i;
      sheet.getCell(row, 2).value = '{{BARCODE}}';
      sheet.mergeCells(row, 3, row, 4);
      sheet.getCell(row, 3).value = `{{PRODUCT_${i}}}`;
      sheet.getCell(row, 5).value = '{{QTY}}';
      sheet.getCell(row, 6).value = '{{PRICE}}';
      sheet.getCell(row, 7).value = '{{SUM}}';
      
      // Alignment
      sheet.getCell(row, 1).alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getCell(row, 5).alignment = { horizontal: 'right', vertical: 'middle' };
      sheet.getCell(row, 6).alignment = { horizontal: 'right', vertical: 'middle' };
      sheet.getCell(row, 7).alignment = { horizontal: 'right', vertical: 'middle' };
      
      applyBorderRange(sheet, row, 1, row, 7);
      row++;
    }
    
    // Guruh 2: GIGA (qo'shimcha namuna)
    sheet.mergeCells(row, 3, row, 4);
    const group2 = sheet.getCell(row, 3);
    group2.value = '{{GROUP_NAME_2}}';
    group2.font = { bold: true };
    group2.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.GROUP_BLUE }
    };
    
    sheet.getCell(row, 5).value = '{{GROUP_QTY_2}}';
    sheet.getCell(row, 5).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.GROUP_BLUE }
    };
    
    sheet.getCell(row, 7).value = '{{GROUP_SUM_2}}';
    sheet.getCell(row, 7).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.GROUP_BLUE }
    };
    
    applyBorderRange(sheet, row, 1, row, 7);
    row++;
    
    // 2 ta mahsulot
    for (let i = 4; i <= 5; i++) {
      sheet.getCell(row, 1).value = i;
      sheet.mergeCells(row, 3, row, 4);
      sheet.getCell(row, 3).value = `{{PRODUCT_${i}}}`;
      sheet.getCell(row, 5).value = '{{QTY}}';
      sheet.getCell(row, 6).value = '{{PRICE}}';
      sheet.getCell(row, 7).value = '{{SUM}}';
      
      sheet.getCell(row, 1).alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getCell(row, 5).alignment = { horizontal: 'right', vertical: 'middle' };
      sheet.getCell(row, 6).alignment = { horizontal: 'right', vertical: 'middle' };
      sheet.getCell(row, 7).alignment = { horizontal: 'right', vertical: 'middle' };
      
      applyBorderRange(sheet, row, 1, row, 7);
      row++;
    }
    
    // ============================================================
    // БОНУСЫ
    // ============================================================
    row++;
    sheet.mergeCells(row, 3, row, 4);
    const bonusHeader = sheet.getCell(row, 3);
    bonusHeader.value = 'Бонусы';
    bonusHeader.font = { bold: true };
    bonusHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.BONUS_PURPLE }
    };
    bonusHeader.alignment = { vertical: 'middle', horizontal: 'left' };
    
    sheet.getCell(row, 5).value = '{{BONUS_TOTAL_QTY}}';
    sheet.getCell(row, 5).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.BONUS_PURPLE }
    };
    
    applyBorderRange(sheet, row, 1, row, 7);
    row++;
    
    // Bonus mahsulotlar (5 ta namuna)
    for (let i = 1; i <= 5; i++) {
      sheet.getCell(row, 1).value = i;
      sheet.mergeCells(row, 3, row, 4);
      sheet.getCell(row, 3).value = `{{BONUS_PRODUCT_${i}}}`;
      sheet.getCell(row, 5).value = '{{BONUS_QTY}}';
      sheet.getCell(row, 6).value = '{{PRICE}}';
      
      sheet.getCell(row, 1).alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getCell(row, 5).alignment = { horizontal: 'right', vertical: 'middle' };
      sheet.getCell(row, 6).alignment = { horizontal: 'right', vertical: 'middle' };
      
      applyBorderRange(sheet, row, 1, row, 7);
      row++;
    }
    
    // ============================================================
    // JAMI
    // ============================================================
    row++;
    sheet.mergeCells(row, 1, row, 4);
    const totalLabel = sheet.getCell(row, 1);
    totalLabel.value = 'Общая сумма';
    totalLabel.font = { bold: true };
    totalLabel.alignment = { vertical: 'middle', horizontal: 'left' };
    
    sheet.getCell(row, 5).value = '{{TOTAL_QTY}}';
    sheet.getCell(row, 5).font = { bold: true };
    sheet.getCell(row, 5).alignment = { horizontal: 'right', vertical: 'middle' };
    
    sheet.getCell(row, 6).value = '{{TOTAL_SUM}}';
    sheet.getCell(row, 6).font = { bold: true };
    sheet.getCell(row, 6).alignment = { horizontal: 'right', vertical: 'middle' };
    
    applyBorderRange(sheet, row, 1, row, 7);
    row++;
    
    sheet.mergeCells(row, 1, row, 4);
    sheet.getCell(row, 1).value = 'Общее(вес)';
    sheet.getCell(row, 1).font = { bold: true };
    applyBorderRange(sheet, row, 1, row, 7);
    row++;
    
    // ============================================================
    // ВОЗВРАТ С ПОЛКИ
    // ============================================================
    row++;
    sheet.mergeCells(row, 3, row, 4);
    const returnHeader = sheet.getCell(row, 3);
    returnHeader.value = 'Возврат с полки';
    returnHeader.font = { bold: true };
    returnHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.RETURN_PURPLE }
    };
    returnHeader.alignment = { vertical: 'middle', horizontal: 'left' };
    applyBorderRange(sheet, row, 1, row, 7);
    row++;
    
    // Возврат mahsulotlari (3 ta namuna)
    for (let i = 1; i <= 3; i++) {
      sheet.getCell(row, 1).value = i;
      sheet.mergeCells(row, 3, row, 4);
      sheet.getCell(row, 3).value = `{{RETURN_PRODUCT_${i}}}`;
      sheet.getCell(row, 5).value = '{{RETURN_QTY}}';
      sheet.getCell(row, 6).value = '{{PRICE}}';
      sheet.getCell(row, 7).value = '{{RETURN_SUM}}';
      
      sheet.getCell(row, 1).alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getCell(row, 5).alignment = { horizontal: 'right', vertical: 'middle' };
      sheet.getCell(row, 6).alignment = { horizontal: 'right', vertical: 'middle' };
      sheet.getCell(row, 7).alignment = { horizontal: 'right', vertical: 'middle' };
      
      applyBorderRange(sheet, row, 1, row, 7);
      row++;
    }
    
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
      },
      printTitlesRow: '1:8' // Header qayta chop qilish
    };
  });
}

// CLI
if (require.main === module) {
  const outputPath = process.argv[2] || './518-zagruz-template-fixed.xlsx';
  createZagruzTemplate(outputPath)
    .then(() => console.log(`✓ Shablon yaratildi: ${outputPath}`))
    .catch(err => {
      console.error('✗ Xato:', err);
      process.exit(1);
    });
}
