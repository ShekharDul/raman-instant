/** Deterministic demonstration data, not an experimental measurement or reference standard. */
export function createSampleSpectrumFile(): File {
  const rows = ['Raman Shift (cm-1),Intensity'];
  const peaks = [
    { center: 520, height: 650, width: 12 },
    { center: 1000, height: 380, width: 20 },
    { center: 1340, height: 280, width: 25 },
    { center: 1450, height: 430, width: 18 },
  ];
  for (let x = 200; x <= 1800; x += 2) {
    const baseline = 70 + 0.045 * (x - 200) + 35 * Math.exp(-(x - 200) / 600);
    const intensity = peaks.reduce((sum, p) => sum + p.height / (1 + ((x - p.center) / p.width) ** 2), baseline);
    rows.push(`${x},${intensity.toFixed(6)}`);
  }
  return new File([rows.join('\n')], 'Synthetic demonstration spectrum.csv', { type: 'text/csv' });
}
