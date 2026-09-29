import { test, expect } from '@playwright/test';

test('text Raman data passes the picker, worker, preview and workstation import', async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
  await page.goto('./');
  await page.getByRole('button', { name: 'Open tool', exact: true }).click();
  await expect(page.locator('#file-input')).toHaveAttribute('accept', /\.txt/);
  await page.locator('#file-input').setInputFiles({
    name: 'raman.txt', mimeType: 'text/plain',
    buffer: Buffer.from('Instrument export\n500  0\n501  -2\n502  100'),
  });
  const dialog = page.getByRole('dialog', { name: 'Import spectrum data' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Text separator')).toHaveValue('whitespace');
  await dialog.getByLabel('X units').selectOption('shift');
  await expect(dialog.getByRole('status')).toContainText('3 points');
  await dialog.getByRole('button', { name: 'Import spectra' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.file-name-edit')).toContainText('raman');
});
