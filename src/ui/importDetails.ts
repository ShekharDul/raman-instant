import type { NormalizedSpectrum } from '../engine/types.ts';

export function showImportDetails(raw: NormalizedSpectrum) {
  const m = raw.metadata, s = m.importSettings;
  const lines = [
    `Source file: ${m.fileName}`, `Format: ${m.format}`,
    `Worksheet: ${m.sheetName ?? 'Not recorded'}`, `Series: ${m.seriesName ?? 'Not recorded'}`,
    `Imported points: ${m.pointCount}`,
    ...(s ? [
      `Heading row: ${s.headerRow < 0 ? 'None' : s.headerRow + 1}`,
      `Data rows: ${s.startRow + 1}–${s.endRow}`,
      `X column: ${s.xColumn + 1}; intensity column: ${s.yColumn + 1}`,
      `Original X units: ${s.unit === 'nm' ? 'Wavelength (nm)' : 'Raman shift (cm⁻¹)'}`,
      ...(s.unit === 'nm' ? [`Laser wavelength: ${s.laserWavelength} nm`] : []),
      `Decimal separator: ${s.decimal}`,
      ...(s.delimiter ? [`CSV separator: ${s.delimiter === '\t' ? 'Tab' : s.delimiter}`] : []),
      `Duplicate X policy: ${s.duplicates}`,
    ] : ['Import choices were not recorded for this spectrum.']),
    '', ...(m.importWarnings?.length ? m.importWarnings : ['No import warnings recorded.']),
  ];
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-label', 'Spectrum import details');
  dialog.style.cssText = 'max-width:min(620px,90vw);width:100%;max-height:85vh;overflow:auto;padding:24px;border:1px solid var(--border);border-radius:8px;background:var(--bg-surface);color:var(--text-primary)';
  const heading = document.createElement('h2'); heading.textContent = 'Import details';
  const body = document.createElement('p'); body.textContent = lines.join('\n'); body.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.7;margin:18px 0;font-size:14px';
  const close = document.createElement('button'); close.textContent = 'Close'; close.className = 'btn-small';
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => dialog.remove());
  dialog.append(heading, body, close); document.body.append(dialog); dialog.showModal();
}
