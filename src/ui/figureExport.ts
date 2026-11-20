import Plotly from 'plotly.js-cartesian-dist-min';

const svgNamespace = 'http://www.w3.org/2000/svg';
const exportDpi = 300;

// Canvas encoders generally write 96 DPI. Record the intended print resolution.
function setPngResolution(bytes: Uint8Array<ArrayBuffer>) {
  const chunk = new Uint8Array(21);
  const header = new DataView(chunk.buffer);
  header.setUint32(0, 9);
  chunk.set([112, 72, 89, 115], 4); // pHYs
  const pixelsPerMetre = Math.round(exportDpi / 0.0254);
  header.setUint32(8, pixelsPerMetre);
  header.setUint32(12, pixelsPerMetre);
  chunk[16] = 1; // metre
  let crc = 0xffffffff;
  for (const byte of chunk.subarray(4, 17)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  header.setUint32(17, crc ^ 0xffffffff);

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts: BlobPart[] = [bytes.subarray(0, 33), chunk]; // signature and IHDR
  let start = 33;
  for (let offset = start; offset + 12 <= bytes.length;) {
    const end = offset + 12 + view.getUint32(offset);
    if (view.getUint32(offset + 4) === 0x70485973) {
      parts.push(bytes.subarray(start, offset));
      start = end;
    }
    offset = end;
  }
  parts.push(bytes.subarray(start));
  return new Blob(parts, { type: 'image/png' });
}

async function rasterize(svg: Blob, width: number, height: number) {
  const url = URL.createObjectURL(svg);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    const scale = Math.min(2, 8192 / Math.max(width, height));
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The browser could not create a PNG canvas.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The browser could not encode the PNG.')), 'image/png');
    });
    return setPngResolution(new Uint8Array(await png.arrayBuffer()));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function parsePlotSvg(url: string) {
  const comma = url.indexOf(',');
  const text = url.slice(0, comma).endsWith(';base64')
    ? new TextDecoder().decode(Uint8Array.from(atob(url.slice(comma + 1)), char => char.charCodeAt(0)))
    : decodeURIComponent(url.slice(comma + 1));
  const svg = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
  if (svg.localName !== 'svg') throw new Error('The browser could not read the plotted figure.');
  return svg;
}

export async function exportFigure(workspace: HTMLElement, format: 'svg' | 'png', transparent: boolean) {
  // Plots are scheduled for the next frame after workstation controls change.
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  const origin = workspace.getBoundingClientRect();
  const plots = [...workspace.querySelectorAll<HTMLElement>('.js-plotly-plot')].map(plot => {
    const bounds = plot.getBoundingClientRect();
    const title = plot.parentElement?.querySelector('.plot-item-title');
    return {
      plot, title, width: Math.round(bounds.width), height: Math.round(bounds.height),
      x: Math.round(bounds.left - origin.left), y: Math.round(bounds.top - origin.top)
    };
  }).filter(({ width, height }) => width > 0 && height > 0);
  if (!plots.length) throw new Error('No rendered plots are available to export.');

  const top = Math.min(...plots.map(({ title, y }) =>
    title ? Math.round(title.getBoundingClientRect().top - origin.top) : y));
  const width = Math.max(...plots.map(plot => plot.x + plot.width));
  const height = Math.max(...plots.map(plot => plot.y + plot.height)) - top;
  const svg = document.createElementNS(svgNamespace, 'svg');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  if (!transparent) {
    const background = document.createElementNS(svgNamespace, 'rect');
    background.setAttribute('width', '100%');
    background.setAttribute('height', '100%');
    background.setAttribute('fill', 'white');
    svg.append(background);
  }
  const images = plots.map(async ({ plot, x, y, width, height, title }) => {
    const graph = plot as HTMLElement & { data: unknown; layout: object };
    const source = transparent ? {
      data: graph.data,
      layout: { ...graph.layout, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)' }
    } : graph;
    const image = parsePlotSvg(await Plotly.toImage(source, { format: 'svg', width, height }));
    image.setAttribute('x', String(x));
    image.setAttribute('y', String(y - top));
    if (!title) return [image];
    const heading = document.createElementNS(svgNamespace, 'text');
    heading.setAttribute('x', String(x + 8));
    heading.setAttribute('y', String(y - top - 6));
    heading.setAttribute('font-family', 'sans-serif');
    heading.setAttribute('font-size', '12');
    heading.textContent = title.textContent;
    return [heading, image];
  });
  svg.append(...(await Promise.all(images)).flat());

  const svgBlob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' });
  const blob = format === 'png' ? await rasterize(svgBlob, width, height) : svgBlob;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Raman_Fig_${Date.now()}.${format}`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
