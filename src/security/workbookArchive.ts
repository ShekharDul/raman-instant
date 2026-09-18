import { LIMITS } from './limits.ts';

/** Validate ZIP structure and actual inflation output, then rebuild a stored-only
 * archive. The spreadsheet parser never sees attacker-controlled compression or
 * conflicting local/central directory metadata. ZIP64/encryption are unsupported. */
export async function boundedWorkbookArchive(buffer: ArrayBuffer): Promise<Uint8Array> {
  const bytes = new Uint8Array(buffer), view = new DataView(buffer);
  const fail = (): never => { throw new Error('Invalid or unsupported XLSX archive.'); };
  const fits = (p: number, n: number) => p >= 0 && n >= 0 && p + n <= bytes.length;
  const u16 = (p: number) => fits(p, 2) ? view.getUint16(p, true) : fail();
  const u32 = (p: number) => fits(p, 4) ? view.getUint32(p, true) : fail();
  let end = bytes.length - 22;
  const min = Math.max(0, end - 65535);
  while (end >= min && (u32(end) !== 0x06054b50 || end + 22 + u16(end + 20) !== bytes.length)) end--;
  if (end < min) fail();
  const count = u16(end + 10), directory = u32(end + 16), directorySize = u32(end + 12);
  if (u16(end + 4) || u16(end + 6) || count !== u16(end + 8) || count < 1 || count > LIMITS.zipEntries || directory + directorySize !== end) fail();
  const entries: { name: Uint8Array; data: Uint8Array; crc: number }[] = [];
  const names = new Set<string>(), intervals: [number, number][] = [];
  let pos = directory, expanded = 0;
  for (let i = 0; i < count; i++) {
    if (u32(pos) !== 0x02014b50) fail();
    const flags = u16(pos + 8), method = u16(pos + 10), crc = u32(pos + 16);
    const compressed = u32(pos + 20), size = u32(pos + 24);
    const nameLength = u16(pos + 28), extraLength = u16(pos + 30), commentLength = u16(pos + 32), local = u32(pos + 42);
    if ((flags & ~0x0808) || ![0, 8].includes(method) || u16(pos + 34) || size === 0xffffffff || compressed === 0xffffffff || local >= directory) fail();
    if (!fits(pos + 46, nameLength + extraLength + commentLength) || nameLength > 512) fail();
    const nameBytes = bytes.slice(pos + 46, pos + 46 + nameLength);
    const name = new TextDecoder('utf-8', { fatal: true }).decode(nameBytes);
    if (!name || names.has(name) || name.startsWith('/') || name.includes('\\') || name.split('/').includes('..') || /[\x00-\x1f]/.test(name)) fail();
    names.add(name);
    if (u32(local) !== 0x04034b50 || u16(local + 6) !== flags || u16(local + 8) !== method || u16(local + 26) !== nameLength) fail();
    for (let j = 0; j < nameLength; j++) if (bytes[local + 30 + j] !== nameBytes[j]) fail();
    const start = local + 30 + nameLength + u16(local + 28), stop = start + compressed;
    if (!fits(start, compressed) || stop > directory || intervals.some(([a, b]) => local < b && stop > a)) fail();
    intervals.push([local, stop]);
    if (!(flags & 8) && (u32(local + 18) !== compressed || u32(local + 22) !== size || u32(local + 14) !== crc)) fail();
    if (size > LIMITS.expandedBytes - expanded) throw new Error('Workbook exceeds the 32 MiB expanded-data limit.');
    let data: Uint8Array;
    if (method === 0) {
      if (size !== compressed) fail();
      data = bytes.slice(start, stop);
    } else {
      const stream = new Blob([bytes.slice(start, stop)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      const reader = stream.getReader(), chunks: Uint8Array[] = [];
      let length = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          length += part.value.length;
          if (length > size || length > LIMITS.expandedBytes - expanded) throw new Error('Workbook exceeds its declared or allowed expanded size.');
          chunks.push(part.value);
        }
      } catch (error) { await reader.cancel().catch(() => {}); throw error; }
      if (length !== size) fail();
      data = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
    }
    expanded += data.length;
    // OOXML does not need DTDs or custom entities. Reject them before XML parsing.
    if (/\.(xml|rels)$/i.test(name)) {
      const xml = new TextDecoder('utf-8', { fatal: true }).decode(data);
      if (xml.includes('\0') || /<!\s*(?:DOCTYPE|ENTITY)/i.test(xml)) throw new Error('Workbook XML entities and DTDs are not supported.');
    }
    entries.push({ name: nameBytes, data, crc });
    pos += 46 + nameLength + extraLength + commentLength;
  }
  if (pos !== end || !names.has('[Content_Types].xml') || !names.has('xl/workbook.xml')) fail();
  const localSize = entries.reduce((n, e) => n + 30 + e.name.length + e.data.length, 0);
  const centralSize = entries.reduce((n, e) => n + 46 + e.name.length, 0);
  const output = new Uint8Array(localSize + centralSize + 22), out = new DataView(output.buffer);
  const w16 = (p: number, v: number) => out.setUint16(p, v, true);
  const w32 = (p: number, v: number) => out.setUint32(p, v, true);
  let l = 0, c = localSize;
  for (const e of entries) {
    w32(l, 0x04034b50); w16(l + 4, 20); w16(l + 6, 0x0800); w32(l + 14, e.crc);
    w32(l + 18, e.data.length); w32(l + 22, e.data.length); w16(l + 26, e.name.length);
    output.set(e.name, l + 30); output.set(e.data, l + 30 + e.name.length);
    w32(c, 0x02014b50); w16(c + 4, 20); w16(c + 6, 20); w16(c + 8, 0x0800); w32(c + 16, e.crc);
    w32(c + 20, e.data.length); w32(c + 24, e.data.length); w16(c + 28, e.name.length); w32(c + 42, l);
    output.set(e.name, c + 46);
    l += 30 + e.name.length + e.data.length; c += 46 + e.name.length;
  }
  w32(c, 0x06054b50); w16(c + 8, count); w16(c + 10, count); w32(c + 12, centralSize); w32(c + 16, localSize);
  return output;
}
