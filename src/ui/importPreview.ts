import { importJob } from '../parsers/workerClient.ts';
import type { Cell } from '../parsers/universalParser.ts';
import { UniversalParser, type ImportDocument, type ImportResult } from '../parsers/universalParser.ts';

/** A local, accessible preview; file content is only inserted as text. */
export function previewImport(documentData: ImportDocument): Promise<ImportResult | null> {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-label', 'Import spectrum data');
    dialog.style.cssText = 'width:min(920px,94vw);max-height:90vh;overflow:auto;background:#151923;color:#f1f5f9;border:1px solid #64748b;border-radius:12px;padding:24px;';
    const title = document.createElement('h2'); title.textContent = `Import ${documentData.fileName}`; dialog.append(title);
    const intro = document.createElement('p'); intro.textContent = 'Check the suggested columns and units. Zero and negative intensities are preserved. Numbers must not contain thousands separators.'; dialog.append(intro);
    const controls = document.createElement('div'); controls.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px'; dialog.append(controls);
    function field<T extends HTMLInputElement | HTMLSelectElement>(labelText: string, input: T): T {
      const label = document.createElement('label'); label.textContent = labelText;
      input.style.cssText = 'display:block;width:100%;background:#252c3b;color:#fff;padding:8px;border:1px solid #64748b;border-radius:4px;margin-top:4px';
      label.append(input); controls.append(label); return input;
    }
    function select(label: string, values: [string, string][]) {
      const input = document.createElement('select');
      for (const [value, text] of values) input.add(new Option(text, value));
      return field(label, input);
    }
    function number(label: string, min: string) {
      const input = document.createElement('input'); input.type = 'number'; input.min = min; input.step = '1'; return field(label, input);
    }
    const sheet = select('Worksheet', documentData.tables.map((t, i) => [String(i), t.name]));
    const delimiter = select('CSV separator', [[',', 'Comma'], [';', 'Semicolon'], ['\t', 'Tab'], ['|', 'Pipe']]);
    delimiter.value = documentData.delimiter || ','; delimiter.disabled = documentData.csvText === undefined;
    const header = number('Heading row (0 = none)', '0');
    const start = number('First data row', '1');
    const end = number('Last data row', '1');
    const x = select('X column', []);
    const y = select('Intensity columns (Ctrl/Cmd to select several)', []); y.multiple = true; y.size = 4;
    const unit = select('X units', [['', 'Choose units…'], ['shift', 'Raman shift (cm⁻¹)'], ['nm', 'Wavelength (nm)']]);
    const decimal = select('Decimal separator', [['.', 'Dot (1234.56)'], [',', 'Comma (1234,56)']]);
    const laser = number('Laser wavelength (nm)', '0.000001'); laser.step = 'any';
    const duplicates = select('Duplicate X values', [['keep', 'Keep all'], ['mean', 'Average intensities'], ['error', 'Reject duplicates']]);
    const sample = document.createElement('div'); sample.style.cssText = 'overflow:auto;margin:18px 0;max-height:260px'; dialog.append(sample);
    const status = document.createElement('div'); status.setAttribute('role', 'status'); status.style.whiteSpace = 'pre-wrap'; dialog.append(status);
    const actions = document.createElement('div'); actions.style.cssText = 'display:flex;gap:12px;justify-content:flex-end;margin-top:18px'; dialog.append(actions);
    const cancel = document.createElement('button'); cancel.textContent = 'Cancel';
    const confirm = document.createElement('button'); confirm.textContent = 'Import spectra';
    for (const button of [cancel, confirm]) { button.type = 'button'; button.style.cssText = 'padding:10px 18px;border:1px solid #64748b;border-radius:6px;background:#27364e;color:white;cursor:pointer'; actions.append(button); }
    let result: ImportResult | null = null;
    let revision = 0, closed = false, job: AbortController | undefined;
    const current = () => documentData.tables[Number(sheet.value)];
    function populateColumns() {
      const oldX = x.value, oldY = Array.from(y.selectedOptions).map(o => o.value);
      const table = current();
      const width = table.rows.reduce((max, row) => Math.max(max, row.length), 0);
      x.replaceChildren(); y.replaceChildren();
      for (let c = 0; c < width; c++) {
        const heading = table.rows[Number(header.value) - 1]?.[c];
        const label = `${c + 1}: ${heading === null || heading === undefined || heading === '' ? 'Untitled' : String(heading)}`;
        x.add(new Option(label, String(c))); y.add(new Option(label, String(c)));
      }
      x.value = oldX || '0';
      for (const option of y.options) option.selected = oldY.includes(option.value);
    }
    async function refresh() {
      const requestRevision = ++revision;
      job?.abort(); job = new AbortController();
      result = null; confirm.disabled = true; confirm.style.opacity = '0.45';
      laser.disabled = unit.value !== 'nm';
      const table = current();
      sample.replaceChildren();
      const grid = document.createElement('table'); grid.style.cssText = 'border-collapse:collapse;width:100%;font-size:13px';
      const appendRow = (cells: string[], heading = false) => {
        const tr = document.createElement('tr');
        for (const value of cells) { const td = document.createElement(heading ? 'th' : 'td'); td.textContent = value; td.style.cssText = 'border:1px solid #475569;padding:6px;text-align:left;white-space:pre-wrap'; tr.append(td); }
        grid.append(tr);
      };
      const columns = [Number(x.value), ...Array.from(y.selectedOptions).map(o => Number(o.value))];
      appendRow(['File row', ...columns.map(c => `${c + 1}: ${table.rows[Number(header.value) - 1]?.[c] || 'Untitled'}`)], true);
      const first = Math.max(0, Number(start.value) - 1);
      table.rows.slice(first, Math.min(first + 8, Number(end.value))).forEach((row, i) => appendRow([String(first + i + 1), ...columns.map(c => String(row[c] ?? ''))]));
      sample.append(grid);
      try {
        if (!Number.isInteger(Number(header.value)) || Number(header.value) < 0 || Number(header.value) > table.rows.length) throw new Error('Choose a valid heading row.');
        if (Number(start.value) <= Number(header.value)) throw new Error('The first data row must follow the heading row.');
        const parsed = await importJob<ImportResult>({ operation: 'import', document: { ...documentData, tables: [], csvText: undefined }, table, options: {
          headerRow: Number(header.value) - 1, startRow: Number(start.value) - 1, endRow: Number(end.value),
          xColumn: Number(x.value), yColumns: Array.from(y.selectedOptions).map(o => Number(o.value)),
          unit: unit.value as 'shift' | 'nm' | '', decimal: decimal.value as '.' | ',',
          laserWavelength: Number(laser.value), duplicates: duplicates.value as 'keep' | 'mean' | 'error',
        } }, job.signal);
        if (closed || requestRevision !== revision) return;
        result = parsed;
        status.textContent = result.spectra.map(s => `${s.metadata.seriesName}: ${s.metadata.pointCount} points; X ${s.wavenumberData[0].toFixed(2)} to ${s.wavenumberData.at(-1)!.toFixed(2)} cm⁻¹`).join('\n') +
          (result.warnings.length ? '\n\n' + result.warnings.join('\n') : '\nNo invalid data rows found.');
        confirm.disabled = false; confirm.style.opacity = '1';
      } catch (error) { if (!closed && requestRevision === revision) status.textContent = error instanceof Error ? error.message : String(error); }
    }
    function reset() {
      const options = UniversalParser.suggest(current());
      header.value = String(options.headerRow + 1); start.value = String(options.startRow + 1);
      end.value = String(options.endRow);
      populateColumns(); x.value = String(options.xColumn);
      for (const option of y.options) option.selected = options.yColumns.includes(Number(option.value));
      unit.value = options.unit; decimal.value = options.decimal; laser.value = String(options.laserWavelength); duplicates.value = options.duplicates;
      refresh();
    }
    sheet.addEventListener('change', reset);
    delimiter.addEventListener('change', async () => {
      const requestRevision = ++revision; job?.abort(); job = new AbortController();
      result = null; confirm.disabled = true;
      try {
        const value = delimiter.value;
        const rows = await importJob<Cell[][]>({ operation: 'csv', text: documentData.csvText!, delimiter: value }, job.signal);
        if (closed || requestRevision !== revision) return;
        current().rows = rows; documentData.delimiter = value; reset();
      }
      catch (error) { if (!closed && requestRevision === revision) { result = null; confirm.disabled = true; status.textContent = String(error); } }
    });
    header.addEventListener('input', () => { populateColumns(); refresh(); });
    for (const input of [start, end, x, y, unit, decimal, laser, duplicates]) input.addEventListener('input', refresh);
    function finish(value: ImportResult | null) { closed = true; revision++; job?.abort(); dialog.close(); dialog.remove(); resolve(value); }
    cancel.addEventListener('click', () => finish(null));
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(null); });
    confirm.addEventListener('click', async () => { await refresh(); if (!closed && result) finish(result); });
    document.body.append(dialog); reset(); dialog.showModal();
  });
}
