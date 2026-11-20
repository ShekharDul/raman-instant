import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';

const base = './';
const browserErrors = new WeakMap<Page, string[]>();

async function importSpectrum(page: Page, name: string, content: string) {
  await page.locator('#file-input').setInputFiles({
    name,
    mimeType: name.endsWith('.txt') ? 'text/plain' : 'text/csv',
    buffer: Buffer.from(content),
  });
  const preview = page.getByRole('dialog', { name: 'Import spectrum data' });
  await expect(preview).toBeVisible();
  if (await preview.getByLabel('X units').inputValue() !== 'shift') {
    await preview.getByLabel('X units').selectOption('shift');
  }
  await preview.getByRole('button', { name: 'Import spectra' }).click();
  await expect(preview).toHaveCount(0);
  await expect(page.locator('.file-name-edit').filter({ hasText: name })).toHaveCount(1);
}

async function showExport(page: Page) {
  const overlay = page.locator('#analysis-drawer');
  if (!(await overlay.evaluate(el => el.classList.contains('drawer-open')))) {
    await page.locator('#btn-toggle-drawer').click();
  }
  await page.locator('#btn-tab-export').click();
}

async function download(page: Page, id: string) {
  const [file] = await Promise.all([page.waitForEvent('download'), page.locator(id).click()]);
  return readFile(await file.path());
}

async function protocol(page: Page) {
  return JSON.parse((await download(page, '#btn-export-protocol')).toString());
}

async function selectFile(page: Page, name: string) {
  await page.locator('#btn-tab-files').click();
  await page.locator('.file-name-edit').filter({ hasText: name }).click();
  await expect(page.locator('.file-item.active .file-name-edit')).toContainText(name);
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://**/*', route => route.abort());
  await page.goto(base);
});

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page)).toEqual([]);
});

test('fits, TXT protocols, and changed preprocessing keep their own provenance', async ({ page }) => {
  await page.getByRole('button', { name: 'Try sample data' }).click();
  const plot = page.locator('#workspace-container .js-plotly-plot');
  await expect(plot).toBeVisible();
  await page.locator('#btn-start-fit-mode').click();
  await expect(plot.locator('.nsewdrag')).toBeVisible();
  const centerBounds = await plot.locator('.nsewdrag').boundingBox();
  const [left, right] = await plot.evaluate((el: any) => {
    const x = el._fullLayout.xaxis;
    return [x.l2p(475), x.l2p(565)];
  });
  await page.mouse.move(centerBounds!.x + left, centerBounds!.y + 12);
  await page.mouse.down();
  await page.mouse.move(centerBounds!.x + right, centerBounds!.y + centerBounds!.height - 12, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('#fit-heading')).toContainText('Synthetic demonstration spectrum');
  await expect(page.locator('#workspace-save-status')).toHaveText('Workspace saved on this browser');
  await page.reload();
  await page.getByRole('button', { name: 'Open tool', exact: true }).click();
  await expect(page.locator('#fit-heading')).toContainText('Synthetic demonstration spectrum');

  await showExport(page);
  const fitFigure = (await download(page, '#btn-export-svg')).toString();
  expect(fitFigure).toContain('Component 1');
  expect(fitFigure).toContain('Δ (a.u.)');
  const fit = await protocol(page);
  expect(fit.source_data_record.original_filename).toBe('Synthetic demonstration spectrum.csv');
  expect(fit.fitting_record[0].fitted_center).toBeCloseTo(520, 0);

  await page.locator('#btn-exit-fit').click();
  await expect(page.locator('#fit-heading')).toHaveCount(0);
  await importSpectrum(page, 'unrelated.csv', 'Raman Shift (cm-1),Intensity\n900,10\n901,22\n902,10');
  await selectFile(page, 'unrelated.csv');
  const unrelated = await protocol(page);
  expect(unrelated.source_data_record.original_filename).toBe('unrelated.csv');
  expect(unrelated.fitting_record).toBeNull();

  await selectFile(page, 'Synthetic demonstration spectrum');
  await expect(page.locator('#fit-heading')).toHaveCount(0);
  expect((await protocol(page)).fitting_record[0].fitted_center).toBeCloseTo(520, 0);

  await importSpectrum(page, 'signed.txt', 'Instrument export\n500  -4\n501  7\n502  1');
  await selectFile(page, 'signed.txt');
  await page.locator('#btn-tab-plot').click();
  await page.getByRole('button', { name: 'Manual baseline anchor mode' }).click();
  await page.locator('#select-smoothing').selectOption('1');
  await page.locator('#check-clip-negative').uncheck();
  await expect.poll(() => plot.evaluate((el: any) => el.data[0].y[0])).toBe(-4);
  const textProtocol = await protocol(page);
  expect(textProtocol.source_data_record.file_format_detected).toBe('TXT');
  expect(textProtocol.source_data_record.import_metadata.importSettings.delimiter).toBe('whitespace');
  expect(textProtocol.processing_steps[1].parameters).toMatchObject({
    smoothing: { window: 1 }, clip_negative_corrected: false,
  });
  expect(textProtocol.fitting_record).toBeNull();

  await page.locator('#check-clip-negative').check();
  await expect.poll(() => plot.evaluate((el: any) => el.data[0].y[0])).toBe(0);
  await page.locator('#protocol-file-input').setInputFiles({
    name: 'signed.irp', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(textProtocol)),
  });
  await expect(page.locator('#protocol-hash-status')).toContainText('Matched with loaded file');
  await page.locator('#btn-apply-protocol').click();
  await expect(page.locator('#verification-report-content')).toContainText('no saved fit');
  await page.locator('#btn-close-verification').click();
  await expect(page.locator('#check-clip-negative')).not.toBeChecked();
  await expect(page.locator('#select-smoothing')).toHaveValue('1');
  await expect.poll(() => plot.evaluate((el: any) => el.data[0].y[0])).toBe(-4);

  await selectFile(page, 'Synthetic demonstration spectrum');
  expect((await protocol(page)).fitting_record).toBeNull(); // Global preprocessing changes invalidated the fit.
});

test('the same traces export from overlay, grid, and replicate views and survive reload', async ({ page }) => {
  await page.getByRole('button', { name: 'Open tool', exact: true }).click();
  await importSpectrum(page, 'alpha.csv', 'Raman Shift (cm-1),Intensity\n500,1\n501,10\n502,1');
  await importSpectrum(page, 'beta.csv', 'Raman Shift (cm-1),Intensity\n500,1\n501,20\n502,1');
  await importSpectrum(page, 'shifted.csv', 'Raman Shift (cm-1),Intensity\n501,1\n502,20\n503,1');
  await page.locator('#btn-tab-files').click();
  const compare = (name: string) => page.locator('.file-item').filter({ hasText: name }).locator('.compare-checkbox');
  await compare('shifted.csv').click();
  await page.locator('#btn-tab-plot').click();

  const rejected = page.waitForEvent('dialog').then(async dialog => {
    expect(dialog.message()).toContain('identical Raman-shift grids');
    await dialog.accept();
  });
  await Promise.all([rejected, page.locator('#btn-group-replicates').click()]);
  await page.locator('#btn-tab-files').click();
  await compare('shifted.csv').click();
  await compare('beta.csv').click();

  await showExport(page);
  const svg = (await download(page, '#btn-export-svg')).toString();
  expect(svg).toContain('alpha.csv');
  expect(svg).toContain('beta.csv');
  expect(svg).not.toContain('shifted.csv');
  await page.evaluate(() => { delete (window as any).showSaveFilePicker; });
  const workbook = XLSX.read(await download(page, '#btn-export-excel'), { type: 'buffer' });
  expect(workbook.SheetNames).toEqual(['Analysis Info', 'beta.csv', 'alpha.csv']);

  await page.locator('#check-export-transparent').check();
  const png = await download(page, '#btn-export-png');
  let resolution: number[] | undefined;
  for (let offset = 8; offset < png.length; offset += png.readUInt32BE(offset) + 12) {
    if (png.toString('ascii', offset + 4, offset + 8) === 'pHYs') {
      resolution = [png.readUInt32BE(offset + 8), png.readUInt32BE(offset + 12), png[offset + 16]];
    }
  }
  expect(resolution).toEqual([11811, 11811, 1]);

  await page.locator('#btn-tab-plot').click();
  await page.locator('#select-layout').selectOption('grid2x1');
  const grid = (await download(page, '#btn-export-svg')).toString();
  expect(grid.match(/<svg\b/g)).toHaveLength(3);
  expect(grid).toContain('alpha.csv');
  expect(grid).toContain('beta.csv');

  await page.locator('#btn-group-replicates').click();
  const replicate = (await download(page, '#btn-export-svg')).toString();
  expect(replicate).toContain('Mean (Replicate Group)');
  expect(replicate).toContain('SD');

  await expect(page.locator('#workspace-save-status')).toHaveText('Workspace saved on this browser');
  await page.reload();
  await page.getByRole('button', { name: 'Open tool', exact: true }).click();
  await expect(page.locator('#workspace-save-status')).toHaveText(/Workspace (restored from|saved on) this browser/);
  await expect(page.locator('.file-name-edit')).toHaveCount(3);
  await expect(page.locator('#workspace-container .legendtext').filter({ hasText: /^Mean \(Replicate Group\)$/ })).toBeVisible();
  await expect(page.locator('#check-export-transparent')).toBeChecked();

  page.once('dialog', dialog => dialog.accept());
  await page.locator('#btn-clear-workspace').click();
  await expect(page.locator('.file-name-edit')).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Open tool', exact: true }).click();
  await expect(page.locator('#btn-clear-workspace')).toBeEnabled();
  await expect(page.locator('.file-name-edit')).toHaveCount(0);
});
