import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';

const attack = '<img src=x onerror="window.uploadPwned=1">';
test.beforeEach(async ({ page }) => {
  // Tests do not send usage events or fetch external fonts.
  await page.route('https://**/*', route => route.abort());
  await page.goto('./');
  await page.getByRole('button', { name: 'Open tool', exact: true }).click();
});

test('malicious Excel headings stay text in preview, grids, peak tables and exported reports', async ({ page, context }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Raman Shift', 'Intensity ' + attack],
    ...Array.from({ length: 101 }, (_, i) => [500 + i, 10 + 100 * Math.exp(-(((i - 50) / 10) ** 2))]),
  ]), 'Data');
  await page.locator('#file-input').setInputFiles({ name: 'safe.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', compression: true }) });
  const dialog = page.getByRole('dialog', { name: 'Import spectrum data' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('img')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Import spectra' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Import spectra' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.file-name-edit')).toContainText(attack);
  await page.locator('#select-layout').selectOption('grid2x1');
  await expect(page.locator('.plot-item-title')).toContainText(attack);
  await expect(page.locator('.plot-item-title img')).toHaveCount(0);
  await page.locator('#btn-tab-files').click();
  await page.locator('.btn-view-table').click();
  await expect(page.locator('#peak-data-grid')).toContainText(attack);
  await expect(page.locator('#peak-data-grid img')).toHaveCount(0);
  await page.locator('#btn-close-data-grid').click();
  // Navigate through the actual tab controls before exporting a snapshot.
  await page.locator('#btn-toggle-drawer').click();
  await page.locator('#btn-tab-analysis').click();
  await page.locator('#btn-capture-snapshot').click();
  await page.locator('#input-snapshot-title').fill('</script><script>window.uploadPwned=2</script>' + attack);
  await page.locator('#btn-confirm-snapshot').click();
  await expect(page.locator('#snapshot-count')).toHaveText('1');
  await page.locator('#btn-tab-export').click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#btn-export-report').click();
  const download = await downloadPromise;
  const html = readFileSync((await download.path())!, 'utf8');
  const report = await context.newPage();
  await report.route('**/raman-instant/security-report.html', route => route.fulfill({ contentType: 'text/html', body: html }));
  const reportErrors: string[] = []; report.on('pageerror', e => reportErrors.push(e.message));
  await report.goto('http://127.0.0.1:4173/raman-instant/security-report.html');
  await expect(report.locator('.snapshot-title')).toContainText('</script>');
  await expect(report.locator('.snapshot-title img')).toHaveCount(0);
  await expect(report.locator('.js-plotly-plot')).toHaveCount(1);
  expect(await report.evaluate(() => (window as any).uploadPwned)).toBeUndefined();
  expect(await page.evaluate(() => (window as any).uploadPwned)).toBeUndefined();
  expect(errors).toEqual([]); expect(reportErrors).toEqual([]);
  expect(await page.evaluate(() => JSON.stringify((window as any).dataLayer))).not.toContain('safe.xlsx');
});

test('protocol metadata is displayed safely and dangerous iteration counts fail before preview', async ({ page }) => {
  const protocol = JSON.parse(readFileSync('valid.irp', 'utf8'));
  protocol.protocol_metadata.created_by = attack;
  protocol.source_data_record.original_filename = attack;
  protocol.processing_steps[1].step_name = attack;
  await page.locator('#protocol-file-input').setInputFiles({ name: 'safe.irp', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(protocol)) });
  await expect(page.locator('#protocol-summary-content')).toContainText(attack);
  await expect(page.locator('#protocol-summary-content img')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).uploadPwned)).toBeUndefined();
  protocol.processing_steps[1].parameters.iterations = 1e9;
  const alertPromise = page.waitForEvent('dialog').then(async dialog => { const message = dialog.message(); await dialog.dismiss(); return message; });
  await page.locator('#protocol-file-input').setInputFiles({ name: 'bad.irp', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(protocol)) });
  expect(await alertPromise).toContain('iterations');
});

test('production CSP blocks injected inline handlers', async ({ page }) => {
  const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(policy).toContain("script-src-attr 'none'");
  await page.evaluate(() => {
    const button = document.createElement('button'); button.setAttribute('onclick', 'window.uploadPwned=3'); document.body.append(button); button.click();
  });
  expect(await page.evaluate(() => (window as any).uploadPwned)).toBeUndefined();
});
