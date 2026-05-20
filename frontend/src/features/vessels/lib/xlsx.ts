import ExcelJS from 'exceljs';

export interface SectionSpec {
  title: string;
  columns: readonly string[];
  rows: Record<string, string>[];
}

export interface WorkbookSpec {
  sheetName: string;
  sections: SectionSpec[];
}

const TBC = 'TBC';
const BLANK_ROWS_BETWEEN_SECTIONS = 2;
const HEADER_FILL_ARGB = 'FF1F2A5C';
const BORDER_ARGB = 'FFBFBFBF';

/**
 * Build a one-sheet workbook with multiple stacked sections (Expected Arrivals,
 * Berth/Anchored, Departures). Each section is title row → header row → data
 * rows, separated from the next by `BLANK_ROWS_BETWEEN_SECTIONS` empty rows.
 * Empty cells are filled with "TBC" so brokers can spot what still needs input.
 */
export async function buildLineupWorkbook(spec: WorkbookSpec): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Portlog';
  wb.created = new Date();

  const ws = wb.addWorksheet(spec.sheetName);
  // Column widths are computed across all sections so the sheet feels uniform.
  const widthByCol = new Map<number, number>();

  let cursor = 1; // 1-indexed row

  for (let s = 0; s < spec.sections.length; s++) {
    const section = spec.sections[s]!;
    const colCount = section.columns.length;
    const lastCol = columnLetter(colCount);

    // Title row (merged across columns)
    ws.mergeCells(`A${cursor}:${lastCol}${cursor}`);
    const titleCell = ws.getCell(`A${cursor}`);
    titleCell.value = section.title;
    titleCell.font = { name: 'Calibri', bold: true, italic: true, size: 12 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(cursor).height = 22;
    cursor++;

    // Header row
    const headerRow = ws.getRow(cursor);
    section.columns.forEach((col, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = col;
      cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: HEADER_FILL_ARGB },
      };
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      };
      cell.border = thinBorder();
      trackWidth(widthByCol, i + 1, col.length);
    });
    headerRow.height = 28;
    cursor++;

    // Data rows
    section.rows.forEach((row) => {
      const excelRow = ws.getRow(cursor);
      section.columns.forEach((col, cIdx) => {
        const cell = excelRow.getCell(cIdx + 1);
        const raw = row[col];
        const value = raw && raw.trim() ? raw : TBC;
        cell.value = value;
        cell.font = { name: 'Calibri', size: 10 };
        cell.alignment = {
          horizontal: 'center',
          vertical: 'middle',
          wrapText: true,
        };
        cell.border = thinBorder();
        trackWidth(widthByCol, cIdx + 1, value.length);
      });
      cursor++;
    });

    // Blank rows between sections (none after the last one)
    if (s < spec.sections.length - 1) {
      cursor += BLANK_ROWS_BETWEEN_SECTIONS;
    }
  }

  // Apply computed widths
  for (const [colIdx, len] of widthByCol) {
    ws.getColumn(colIdx).width = Math.min(Math.max(len + 2, 10), 42);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function downloadBlob(filename: string, blob: Blob): void {
  if (typeof window === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function trackWidth(map: Map<number, number>, col: number, len: number): void {
  const prev = map.get(col) ?? 0;
  if (len > prev) map.set(col, len);
}

function columnLetter(n: number): string {
  let s = '';
  let num = n;
  while (num > 0) {
    const m = (num - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    num = Math.floor((num - 1) / 26);
  }
  return s;
}

function thinBorder(): ExcelJS.Borders {
  const style: ExcelJS.Border = { style: 'thin', color: { argb: BORDER_ARGB } };
  return {
    top: style,
    left: style,
    bottom: style,
    right: style,
  } as ExcelJS.Borders;
}
