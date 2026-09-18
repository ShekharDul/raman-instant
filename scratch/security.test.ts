import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import * as XLSX from 'xlsx';
import { UniversalParser as P } from '../src/parsers/universalParser.ts';
import { ProtocolManager } from '../src/engine/protocol.ts';
import { LIMITS, checkBatch, checkFile, checkSession } from '../src/security/limits.ts';
import { boundedWorkbookArchive } from '../src/security/workbookArchive.ts';
import { escapeHTML, scriptJSON } from '../src/security/text.ts';
import { buildReportDocument } from '../src/ui/reportDocument.ts';
import { importJob } from '../src/parsers/workerClient.ts';

const valid = () => JSON.parse(readFileSync('valid.irp', 'utf8'));
test('patched SheetJS is installed', () => assert.equal(XLSX.version, '0.20.3'));
test('reject files and batches before reading their contents', async () => {
  checkFile({ name: 'ok.csv', size: LIMITS.fileBytes });
  assert.throws(() => checkFile({ name: 'large.csv', size: LIMITS.fileBytes + 1 }));
  assert.throws(() => checkFile({ name: 'large.irp', size: LIMITS.protocolBytes + 1 }));
  assert.throws(() => checkBatch(Array.from({ length: 21 }, () => ({ name: 'a.csv', size: 1 }))));
  assert.throws(() => checkBatch(Array.from({ length: 5 }, () => ({ name: 'a.csv', size: LIMITS.fileBytes }))));
  await assert.rejects(P.inspectFile({ name: 'large.xlsx', size: LIMITS.fileBytes + 1, arrayBuffer() { assert.fail('Must reject before reading'); } } as any));
  assert.throws(() => checkSession(LIMITS.sessionPoints, 1, 3, 1));
  assert.throws(() => checkSession(0, LIMITS.sessionSeries, 3, 1));
});
test('CSV bounds cover final fields, quoted fields, rows, columns and total cells', () => {
  assert.equal(P.readCSV('a'.repeat(LIMITS.fieldChars), ',')[0][0]?.toString().length, LIMITS.fieldChars);
  for (const text of ['a'.repeat(LIMITS.fieldChars + 1), '"' + 'a'.repeat(LIMITS.fieldChars + 1) + '"', '1\n'.repeat(LIMITS.rows + 1), Array(65).fill('1').join(','), (Array(64).fill('1').join(',') + '\n').repeat(7813)]) {
    assert.throws(() => P.readCSV(text, ','), /limit|exceed/i);
  }
});
test('renamed files fail format validation', async () => {
  for (const name of ['fake.xlsx', 'fake.xls']) await assert.rejects(P.inspectFile(new File(['<html>not Excel</html>'], name)));
});
test('workbook bounds apply across sheets and to sparse ranges', async () => {
  const wb = XLSX.utils.book_new();
  for (let i = 0; i < 17; i++) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['a']]), `s${i}`);
  await assert.rejects(P.inspectFile(new File([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], 'sheets.xlsx')), /sheet limit/);
  const huge = XLSX.utils.book_new(); const ws = XLSX.utils.aoa_to_sheet([[1, 2]]); ws['!ref'] = 'A1:B1000000';
  XLSX.utils.book_append_sheet(huge, ws, 'Sparse');
  await assert.rejects(P.inspectFile(new File([XLSX.write(huge, { type: 'array', bookType: 'xlsx' })], 'sparse.xlsx')), /too large/);
});
// Small purpose-built ZIP fixture: tests actual inflation rather than trusting ZIP metadata.
function zipEntry(name: string, data: Buffer, declared = data.length): ArrayBuffer {
  const filename = Buffer.from(name), compressed = deflateRawSync(data);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
  local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(declared, 22); local.writeUInt16LE(filename.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10);
  central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(declared, 24); central.writeUInt16LE(filename.length, 28);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + filename.length, 12); end.writeUInt32LE(local.length + filename.length + compressed.length, 16);
  return Uint8Array.from(Buffer.concat([local, filename, compressed, central, filename, end])).buffer;
}
test('ZIP bombs are rejected using declared and actual expanded size', async () => {
  await assert.rejects(boundedWorkbookArchive(zipEntry('xl/workbook.xml', Buffer.from('small'), LIMITS.expandedBytes + 1)), /expanded/);
  await assert.rejects(boundedWorkbookArchive(zipEntry('xl/workbook.xml', Buffer.alloc(100_000, 65), 10)), /expanded/);
  await assert.rejects(boundedWorkbookArchive(zipEntry('xl/workbook.xml', Buffer.from('<!DOCTYPE foo>'))), /DTD/);
  await assert.rejects(boundedWorkbookArchive(zipEntry('../evil.xml', Buffer.from('x'))), /archive/);
});
test('compressed normal XLSX imports without dropping numeric data', async () => {
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Shift', 'Intensity'], [1, 3], [2, 4], [3, 5]]), 's');
  const file = new File([XLSX.write(wb, { type: 'array', bookType: 'xlsx', compression: true })], 'ok.xlsx');
  const doc = await P.inspectFile(file);
  assert.deepEqual(P.importTable(doc, doc.tables[0], P.suggest(doc.tables[0])).spectra[0].intensityData, [3, 4, 5]);
});
test('protocols reject unknown fields, unsupported algorithms, excessive work and nonfinite values', () => {
  for (const mutate of [
    (v: any) => { v.processing_steps[1].parameters.iterations = 1e9; },
    (v: any) => { v.processing_steps[1].parameters.iterations = 1.5; },
    (v: any) => { v.processing_steps[1].parameters.algorithm = 'execute'; },
    (v: any) => { v.processing_steps[0].applied = false; v.processing_steps[0].parameters = { algorithm: 'evil' }; },
    (v: any) => { v.processing_steps[1].parameters.anchors = Array(257).fill({ x: 1, y: 2 }); },
    (v: any) => { v.fitting_record = Array(13).fill(v.fitting_record[0]); },
    (v: any) => { v.source_data_record.wavenumber_spacing = Infinity; },
    (v: any) => { v.source_data_record.file_hash = '<img>'; },
    (v: any) => { v.fitting_record[0].best_fit_model = '<img>'; },
    (v: any) => { v.integration_record = [{ unknown: true }]; },
    (v: any) => { v.extra = {}; },
    (v: any) => { Object.defineProperty(v, '__proto__', { value: {}, enumerable: true }); },
  ]) { const v = valid(); mutate(v); assert.throws(() => ProtocolManager.validateSchema(v), /Invalid protocol/); }
  ProtocolManager.validateSchema(valid());
});
test('HTML text and embedded JSON preserve labels without markup', () => {
  const payload = '</script><img src=x onerror="window.pwned=1">&';
  assert.ok(!escapeHTML(payload).includes('<'));
  assert.ok(!scriptJSON({ payload }).includes('<'));
  assert.equal(JSON.parse(scriptJSON({ payload })).payload, payload);
});
test('report substitution cannot recursively inject code; CSP allows only exact script hashes', async () => {
  const payload = '</script><script>window.pwned=1</script>/* PLOTLY_INJECTION_POINT */';
  const html = await buildReportDocument({ sessionSummary: { totalFiles: 1, filenames: [payload] }, snapshots: [] }, 'window.Plotly = {};');
  assert.ok(!html.includes('<script>window.pwned=1</script>'));
  const data = html.match(/<script id="raman-data" type="application\/json">([\s\S]*?)<\/script>/)![1];
  assert.equal(JSON.parse(data).sessionSummary.filenames[0], payload);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /script-src 'sha256-/);
  for (const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) if (!m[0].includes('application/json')) new Function(m[1]);
});
test('stalled workers terminate on timeout and cancellation; successful workers are disposed', async () => {
  let terminated = 0;
  const fake = () => ({ terminate() { terminated++; }, postMessage() {}, onmessage: null, onerror: null, onmessageerror: null }) as any;
  await assert.rejects(importJob({}, undefined, fake, 5), /time limit/);
  const controller = new AbortController(); const pending = importJob({}, controller.signal, fake); controller.abort();
  await assert.rejects(pending, /cancelled/);
  const worker = fake(); worker.postMessage = () => queueMicrotask(() => worker.onmessage({ data: { result: 42 } }));
  assert.equal(await importJob({}, undefined, () => worker), 42);
  assert.equal(terminated, 3);
});
