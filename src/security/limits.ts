export const LIMITS = Object.freeze({
  fileBytes: 10 * 1024 * 1024, protocolBytes: 1024 * 1024,
  batchBytes: 40 * 1024 * 1024, files: 20, sheets: 16,
  rows: 50_000, columns: 64, cells: 500_000, fieldChars: 4096,
  points: 25_000, series: 16, sessionPoints: 200_000, sessionSeries: 40,
  expandedBytes: 32 * 1024 * 1024, zipEntries: 256, timeoutMs: 15_000,
  iterations: 50, anchors: 256, fitPeaks: 12,
});

export function checkFile(file: Pick<File, 'name' | 'size'>): void {
  const protocol = /\.(irp|json)$/i.test(file.name);
  if (file.name.length > 255) throw new Error('File name exceeds 255 characters.');
  if (!/\.(csv|xlsx|xls|irp|json)$/i.test(file.name)) throw new Error('Please select a CSV or Excel (.xlsx, .xls) data file, or an IRP protocol.');
  if (file.size > (protocol ? LIMITS.protocolBytes : LIMITS.fileBytes)) throw new Error(protocol ? 'Protocol exceeds the 1 MiB limit.' : 'Data file exceeds the 10 MiB limit.');
}

export function checkBatch(files: Pick<File, 'name' | 'size'>[]): void {
  if (files.length > LIMITS.files || files.reduce((n, f) => n + f.size, 0) > LIMITS.batchBytes) throw new Error('Import at most 20 files and 40 MiB per batch.');
  files.forEach(checkFile);
}

export function checkSession(currentPoints: number, currentSeries: number, points: number, series: number): void {
  if (currentPoints + points > LIMITS.sessionPoints || currentSeries + series > LIMITS.sessionSeries) throw new Error('Session limit reached (200,000 points / 40 spectra). Remove spectra before importing more.');
}
