import { LIMITS, checkFile } from '../security/limits.ts';
import { boundedWorkbookArchive } from '../security/workbookArchive.ts';
import * as XLSX from 'xlsx';
import type { NormalizedSpectrum } from '../engine/types.ts';

export type Cell = string | number | null;
export type AxisUnit = 'shift' | 'nm';
export interface ImportTable { name: string; rows: Cell[][]; notes: string[] }
export interface ImportDocument { fileName: string; format: string; tables: ImportTable[]; csvText?: string; delimiter?: string }
export interface ImportOptions {
  headerRow: number; // -1 means no headings
  startRow: number;
  endRow?: number; // exclusive; omitted means end of worksheet
  xColumn: number;
  yColumns: number[];
  unit: AxisUnit | '';
  decimal: '.' | ',';
  laserWavelength: number;
  duplicates: 'keep' | 'mean' | 'error';
}
export interface ImportResult { spectra: NormalizedSpectrum[]; warnings: string[] }

/** CSV and Excel reader. Cell boundaries and explicit units survive every stage. */
export class UniversalParser {
  static readCSV(text: string, delimiter: string): Cell[][] {
    if (![',', ';', '\t', '|'].includes(delimiter)) throw new Error('Unsupported CSV delimiter.');
    if (text.length > LIMITS.fileBytes) throw new Error('CSV text exceeds the import limit.');
    const rows: Cell[][] = [];
    let cellCount = 0;
    const pushCell = () => {
      if (++cellCount > LIMITS.cells || row.length >= LIMITS.columns || cell.length > LIMITS.fieldChars) throw new Error('CSV exceeds cell, column, or field-length limits.');
      row.push(cell);
    };
    const pushRow = () => {
      if (rows.length >= LIMITS.rows) throw new Error('CSV exceeds the row limit.');
      rows.push(row);
    };
    let row: Cell[] = [], cell = '', quoted = false, closed = false;
    text = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
      if (cell.length > LIMITS.fieldChars) throw new Error('CSV field exceeds 4096 characters.');
      const ch = text[i];
      if (quoted) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; }
          else { quoted = false; closed = true; }
        } else cell += ch;
      } else if (ch === delimiter || ch === '\n' || ch === '\r') {
        pushCell(); cell = ''; closed = false;
        if (ch !== delimiter) {
          pushRow(); row = [];
          if (ch === '\r' && text[i + 1] === '\n') i++;
        }
      } else if (ch === '"') {
        if (cell.trim() || closed) throw new Error('Invalid CSV quoting. Check the delimiter and quoted fields.');
        cell = ''; quoted = true;
      } else {
        if (closed && !/\s/.test(ch)) throw new Error('Unexpected text after a quoted CSV field.');
        if (!closed) cell += ch;
      }
    }
    if (quoted) throw new Error('CSV contains an unclosed quoted field.');
    if (cell || row.length || closed) { pushCell(); pushRow(); }
    return rows;
  }

  static detectDelimiter(text: string): string {
    let best = ',', bestScore = -1;
    for (const delimiter of [',', ';', '\t', '|']) {
      try {
        const rows = this.readCSV(text, delimiter).filter(r => r.some(c => String(c).trim())).slice(0, 100);
        const counts = new Map<number, number>();
        for (const row of rows) if (row.length > 1) counts.set(row.length, (counts.get(row.length) || 0) + 1);
        const cells = rows.filter(r => r.length > 1).flat();
        const numericFraction = cells.filter(c => this.number(c, '.') !== null || this.number(c, ',') !== null).length / (cells.length || 1);
        const score = Math.max(0, ...counts.values()) + numericFraction * 0.5;
        if (score > bestScore) { bestScore = score; best = delimiter; }
      } catch { /* another delimiter may correctly explain quoted fields */ }
    }
    return best;
  }

  static number(cell: Cell | undefined, decimal: '.' | ','): number | null {
    if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null;
    if (typeof cell !== 'string') return null;
    let value = cell.trim().replace(/\u2212/g, '-');
    // Thousands separators are deliberately not guessed.
    if (decimal === ',') {
      if (value.includes('.')) return null;
      value = value.replace(',', '.');
    }
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) return null;
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
  }

  static async inspectFile(file: File): Promise<ImportDocument> {
    checkFile(file);
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(extension || '')) throw new Error('Please select a CSV or Excel (.xlsx, .xls) data file.');
    const buffer = await file.arrayBuffer();
    if (extension === 'csv') {
      const bytes = new Uint8Array(buffer);
      const encoding = bytes[0] === 255 && bytes[1] === 254 ? 'utf-16le' : bytes[0] === 254 && bytes[1] === 255 ? 'utf-16be' : 'utf-8';
      let text = new TextDecoder(encoding, { fatal: true }).decode(buffer).replace(/^\uFEFF/, '');
      const directive = text.match(/^sep=([,;\t|])\r?\n/i);
      if (directive) text = text.slice(directive[0].length);
      const delimiter = directive?.[1] || this.detectDelimiter(text);
      return { fileName: file.name, format: 'CSV', csvText: text, delimiter,
        tables: [{ name: 'CSV', rows: this.readCSV(text, delimiter), notes: [] }] };
    }
    let input: ArrayBuffer | Uint8Array = buffer;
    if (extension === 'xlsx') input = await boundedWorkbookArchive(buffer);
    else {
      const signature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
      if (!signature.every((v, i) => new Uint8Array(buffer)[i] === v)) throw new Error('Invalid XLS file signature. Export a standard Excel workbook or CSV.');
    }
    const workbook = XLSX.read(input, { type: 'array', cellDates: true, cellFormula: true, cellHTML: false, cellStyles: false, bookVBA: false, sheetRows: LIMITS.rows + 1 });
    if (workbook.SheetNames.length > LIMITS.sheets) throw new Error('Workbook exceeds the 16-sheet limit.');
    let totalCells = 0;
    const tables: ImportTable[] = workbook.SheetNames.map(name => {
      const sheet = workbook.Sheets[name];
      const notes = ['All worksheet rows are included, including hidden and filtered rows.'];
      const rows: Cell[][] = [];
      if (!sheet['!ref']) return { name, rows, notes };
      const range = XLSX.utils.decode_range(sheet['!fullref'] || sheet['!ref']);
      totalCells += (range.e.r + 1) * (range.e.c + 1);
      if (!Number.isSafeInteger(totalCells) || range.e.r >= LIMITS.rows || range.e.c >= LIMITS.columns || totalCells > LIMITS.cells) throw new Error(`Worksheet ${name} is too large. Export just the data table.`);
      let formulas = false, missing = false;
      for (let r = 0; r <= range.e.r; r++) {
        const row: Cell[] = [];
        for (let c = 0; c <= range.e.c; c++) {
          const cell = sheet[XLSX.utils.encode_cell({ r, c })];
          if (typeof cell?.v === 'string' && cell.v.length > LIMITS.fieldChars) throw new Error('Workbook field exceeds 4096 characters.');
          if (cell?.f) { formulas = true; if (cell.v === undefined) missing = true; }
          row.push(!cell ? null : cell.t === 'n' ? cell.v : cell.t === 's' ? String(cell.v ?? '') :
            cell.t === 'd' ? '[date]' : cell.t === 'e' ? '[spreadsheet error]' : cell.f && cell.v === undefined ? '[formula without result]' : null);
        }
        rows.push(row);
      }
      if (formulas) notes.push('Formula cells use saved results; formulas are not recalculated during import.');
      if (missing) notes.push('Some formulas have no saved result. Recalculate and save the workbook in Excel.');
      return { name, rows, notes };
    }).filter(t => t.rows.some(r => r.some(c => c !== null && c !== '')));
    if (!tables.length) throw new Error('The workbook has no nonempty worksheets.');
    return { fileName: file.name, format: extension!.toUpperCase(), tables };
  }

  static suggest(table: ImportTable): ImportOptions {
    const isX = (v: Cell) => /raman|wave\s*number|wellenzahl|shift|wavelength|cm\s*(?:\^?\s*-\s*1|⁻¹)|\bnm\b/i.test(String(v ?? ''));
    const isY = (v: Cell) => /intens|counts?|signal|absorbance/i.test(String(v ?? ''));
    let headerRow = -1, xColumn = 0, yColumns = [1], unit: AxisUnit | '' = '';
    for (let i = 0; i < Math.min(100, table.rows.length); i++) {
      const row = table.rows[i];
      const x = row.map((v, c) => isX(v) ? c : -1).filter(c => c >= 0);
      const y = row.map((v, c) => isY(v) ? c : -1).filter(c => c >= 0);
      if (x.length === 1 && y.some(c => c !== x[0])) {
        headerRow = i; xColumn = x[0]; yColumns = y.filter(c => c !== xColumn);
        const heading = String(row[xColumn]);
        unit = /\bnm\b/i.test(heading) ? 'nm' : /shift|wave\s*number|wellenzahl|cm/i.test(heading) ? 'shift' : '';
        break;
      }
    }
    const sample = table.rows.slice(headerRow + 1, headerRow + 101).flatMap(r => [r[xColumn], ...yColumns.map(c => r[c])]);
    const commas = sample.filter(v => typeof v === 'string' && /^[+-]?\d+,\d+(?:e[+-]?\d+)?$/i.test(v.trim())).length;
    const dots = sample.filter(v => typeof v === 'string' && /\d\.\d/.test(v)).length;
    const decimal = commas > 0 && dots === 0 ? ',' : '.';
    const firstNumeric = table.rows.findIndex(r => this.number(r[xColumn], decimal) !== null && yColumns.some(c => this.number(r[c], decimal) !== null));
    if (headerRow < 0 && firstNumeric > 0) {
      const previous = table.rows[firstNumeric - 1];
      if (previous.filter(v => typeof v === 'string' && v.trim()).length >= 2) headerRow = firstNumeric - 1;
    }
    const startRow = headerRow >= 0 ? headerRow + 1 : Math.max(0, firstNumeric);
    let endRow = table.rows.length;
    for (let r = startRow; r < table.rows.length; r++) {
      // A repeated spectral heading marks another table, not more rows of this spectrum.
      if (isX(table.rows[r][xColumn]) && yColumns.some(c => isY(table.rows[r][c]))) { endRow = r; break; }
    }
    return { headerRow, startRow, endRow, xColumn, yColumns, unit, decimal,
      laserWavelength: 785, duplicates: 'keep' };
  }

  static importTable(document: ImportDocument, table: ImportTable, options: ImportOptions): ImportResult {
    const o = options;
    if (!['shift', 'nm'].includes(o.unit)) throw new Error('Choose the X-axis units before importing.');
    if (!Number.isInteger(o.startRow) || o.startRow < 0 || o.startRow >= table.rows.length) throw new Error('Choose a valid first data row.');
    const endRow = o.endRow ?? table.rows.length;
    if (!Number.isInteger(endRow) || endRow <= o.startRow || endRow > table.rows.length) throw new Error('Choose a valid last data row.');
    const width = Math.max(0, ...table.rows.slice(0, 100).map(r => r.length), ...table.rows.slice(o.startRow, o.startRow + 100).map(r => r.length));
    if (!Number.isInteger(o.xColumn) || o.xColumn < 0 || o.xColumn >= width || !o.yColumns.length || o.yColumns.some(c => !Number.isInteger(c) || c < 0 || c >= width || c === o.xColumn) || new Set(o.yColumns).size !== o.yColumns.length) throw new Error('Select one X column and distinct intensity columns.');
    if (o.unit === 'nm' && (!Number.isFinite(o.laserWavelength) || o.laserWavelength <= 0)) throw new Error('Enter the positive laser wavelength in nm.');
    if (endRow - o.startRow > LIMITS.points || o.yColumns.length > LIMITS.series || (endRow - o.startRow) * o.yColumns.length > LIMITS.sessionPoints) throw new Error('Import at most 25,000 rows per spectrum, 16 spectra, and 200,000 points.');
    const warnings = [...table.notes];
    const spectra = o.yColumns.map(column => {
      const pairs: { x: number; y: number }[] = [];
      const skipped: number[] = [];
      for (let r = o.startRow; r < endRow; r++) {
        const row = table.rows[r];
        if (row.every(v => v === null || String(v).trim() === '')) continue;
        let x = this.number(row[o.xColumn], o.decimal);
        const y = this.number(row[column], o.decimal);
        if (x === null || y === null || (o.unit === 'nm' && x <= 0)) { skipped.push(r + 1); continue; }
        if (o.unit === 'nm') x = (1 / o.laserWavelength - 1 / x) * 1e7;
        if (!Number.isFinite(x)) { skipped.push(r + 1); continue; }
        if (Math.abs(x) > 1e7 || Math.abs(y) > 1e100) throw new Error('Data values exceed the supported numerical range.');
        pairs.push({ x, y });
      }
      const label = String(table.rows[o.headerRow]?.[column] || `Column ${column + 1}`);
      if (pairs.length < 3) throw new Error(`${label}: at least three valid X/intensity pairs are required.`);
      pairs.sort((a, b) => a.x - b.x);
      const unique: { x: number; y: number; count: number }[] = [];
      let duplicates = 0;
      for (const p of pairs) {
        const last = unique.at(-1);
        if (last && last.x === p.x) { duplicates++; last.count++; last.y += (p.y - last.y) / last.count; }
        else unique.push({ ...p, count: 1 });
      }
      if (unique.length < 3) throw new Error(`${label}: at least three distinct X values are required.`);
      if (duplicates && o.duplicates === 'error') throw new Error(`${label}: ${duplicates} duplicate X values. Choose keep or average to continue.`);
      if (duplicates) warnings.push(`${label}: ${duplicates} duplicate X values ${o.duplicates === 'mean' ? 'averaged' : 'kept'}.`);
      if (skipped.length) warnings.push(`${label}: skipped ${skipped.length} rows with missing, nonnumeric, or invalid X/intensity cells (rows ${skipped.slice(0, 20).join(', ')}${skipped.length > 20 ? ', …' : ''}).`);
      const selected = o.duplicates === 'mean' ? unique : pairs;
      return { wavenumberData: selected.map(p => p.x), intensityData: selected.map(p => p.y), metadata: {
        format: document.format, fileName: document.fileName, pointCount: selected.length,
        ...(o.unit === 'nm' ? { laserWavelength: o.laserWavelength } : {}),
        sheetName: table.name, seriesName: label,
        importSettings: { headerRow: o.headerRow, startRow: o.startRow, endRow,
          xColumn: o.xColumn, yColumn: column, unit: o.unit as AxisUnit,
          decimal: o.decimal, laserWavelength: o.unit === 'nm' ? o.laserWavelength : null,
          duplicates: o.duplicates, delimiter: document.delimiter ?? null },
        importWarnings: warnings,
      } };
    });
    return { spectra, warnings };
  }

  static async parseFile(file: File, laserWavelength = 785): Promise<NormalizedSpectrum> {
    const document = await this.inspectFile(file);
    if (document.tables.length !== 1) throw new Error('Select a worksheet using the import preview.');
    const table = document.tables[0], options = this.suggest(table);
    options.laserWavelength = laserWavelength;
    if (options.yColumns.length !== 1) throw new Error('Select spectra using the import preview.');
    return this.importTable(document, table, options).spectra[0];
  }

  /** CSV-only convenience API. Headerless data requires an explicit unit. */
  static parseText(content: string, fileName: string, laserWavelength = 785, unit?: AxisUnit): NormalizedSpectrum {
    if (!fileName.toLowerCase().endsWith('.csv')) throw new Error('Text import supports .csv files only.');
    const table = { name: 'CSV', rows: this.readCSV(content, this.detectDelimiter(content)), notes: [] };
    const options = this.suggest(table);
    if (unit) options.unit = unit;
    options.laserWavelength = laserWavelength;
    return this.importTable({ fileName, format: 'CSV', tables: [table] }, table, options).spectra[0];
  }
}
