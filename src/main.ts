/**
 * RamanInstant v2.0 — Research Workstation Engine
 * Optimized for robustness, performance, and commercial reliability.
 */
import { SpectralProcessor } from './engine/processor.ts';
import type { Peak, VarianceResult } from './engine/processor.ts';
import { parseSpectralFile } from './parsers/textParser.ts';
import type { ParsedSpectrum } from './parsers/textParser.ts';
import { ChartRenderer } from './ui/charts.ts';
import ExcelJS from 'exceljs';

// ── Types ──
interface ProcessedFile {
  id: string;
  name: string;
  raw: ParsedSpectrum;
  cleanedY: number[];
  baselineY: number[];
  processedY: number[];
  peaks: Peak[];
  variance: VarianceResult;
  spikesRemoved: number;
  params: { snip: number; sg: number; mode: 'auto' | 'manual'; timestamp: string };
  anchors: { x: number; y: number }[];
  color: string;
}

interface AppState {
  files: Map<string, ProcessedFile>;
  activeFileId: string | null;
  comparisonIds: Set<string>;
  baselineMode: 'auto' | 'manual';
  layoutMode: 'single' | 'stacked' | 'grid2x1' | 'grid2x2';
  stackOffset: number;
  viewRange: [number, number] | null;
}

// ── State ──
const state: AppState = {
  files: new Map(),
  activeFileId: null,
  comparisonIds: new Set(),
  baselineMode: 'auto',
  layoutMode: 'single',
  stackOffset: 0,
  viewRange: null
};

const COLOR_PALETTE = ['#0f172a', '#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777', '#dc2626', '#0891b2'];

// ── Robust DOM Access ──
const UI = {
  get: (id: string) => document.getElementById(id),
  text: (id: string, val: string) => { const el = document.getElementById(id); if (el) el.textContent = val; },
  html: (id: string, val: string) => { const el = document.getElementById(id); if (el) el.innerHTML = val; },
  val: (id: string) => (document.getElementById(id) as HTMLInputElement)?.value || ''
};

// ── Initialization ──
initUpload();
initSliders();
initBaselineControls();
initLayoutControls();
UI.text('system-status', 'SYSTEM_READY');
setTimeout(() => updateUI(), 150);

function initUpload() {
  const input = UI.get('file-input') as HTMLInputElement;
  if (!input) return;
  input.addEventListener('change', () => {
    if (input.files?.length) handleFiles(input.files);
    input.value = '';
  });
}

function handleFiles(fileList: FileList) {
  const files = Array.from(fileList);
  UI.text('system-status', `INGESTING ${files.length}...`);
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = parseSpectralFile(content);
        const id = `file-${Math.random().toString(36).slice(2, 9)}`;
        processAndStore(id, file.name, parsed);
        if (state.files.size === 1) state.activeFileId = id;
        updateUI();
      } catch (err) { UI.text('system-status', 'PARSE_ERROR'); }
    };
    reader.readAsText(file);
  });
}

function processAndStore(id: string, name: string, raw: ParsedSpectrum) {
  const existing = state.files.get(id);
  const snip = parseInt(UI.val('slider-snip') || '25');
  const sg = 9;
  const mode = state.baselineMode;
  const anchors = existing?.anchors || [];

  const { cleanedY, replacedCount } = SpectralProcessor.rejectCosmicRays(raw.y);

  let baselineY: number[];
  if (mode === 'manual') {
    baselineY = SpectralProcessor.baselineManual(raw.x, cleanedY, anchors);
  } else {
    baselineY = SpectralProcessor.baselineSNIP(cleanedY, snip);
  }

  const correctedY = cleanedY.map((v, i) => Math.max(0, v - baselineY[i]));
  const processedY = SpectralProcessor.savitzkyGolay(correctedY, sg);
  const peaks = SpectralProcessor.findPeaks(raw.x, processedY);
  const variance = SpectralProcessor.calculateVariance(cleanedY, baselineY);

  state.files.set(id, {
    id, name, raw, cleanedY, baselineY, processedY, peaks, variance,
    spikesRemoved: replacedCount,
    params: { snip, sg, mode, timestamp: new Date().toISOString() },
    anchors,
    color: existing?.color || COLOR_PALETTE[state.files.size % COLOR_PALETTE.length]
  });
}

function updateUI() {
  renderFileList();
  renderPlots();
  renderAnchorList();
  renderPeakTable();

  const active = state.files.get(state.activeFileId || '');
  if (active) {
    UI.text('active-filename', active.name);
    UI.text('methods-summary', `Analysis: ${active.name} | Mode: ${active.params.mode.toUpperCase()} | ${active.peaks.length} peaks detected.`);
  }

  // Update Footer Stats
  const totalFiles = state.files.size;
  const activeCount = state.comparisonIds.size || (state.activeFileId ? 1 : 0);
  UI.text('footer-stats', `FILES: ${totalFiles} ; ACTIVE FILES: ${activeCount}`);
}

function renderFileList() {
  const container = UI.get('file-list');
  if (!container) return;
  container.innerHTML = '';
  state.files.forEach((file, id) => {
    const isActive = id === state.activeFileId;
    const item = document.createElement('div');
    item.className = `file-item ${isActive ? 'active' : ''}`;
    item.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; flex:1;">
        <div style="width:3px; height:24px; background:${file.color}; border-radius:1px;"></div>
        <div style="flex:1;">
          <div class="file-name-edit" contenteditable="true" spellcheck="false" 
               style="font-weight:700; font-size:11px; outline:none;">${file.name}</div>
          <div style="font-size: 8px; opacity: 0.6;">${file.raw.pointCount} pts</div>
        </div>
      </div>
      <div class="file-actions">
        <button class="btn-small btn-comp ${state.comparisonIds.has(id) ? 'active-compare' : ''}">COMP</button>
        <button class="btn-small btn-del" style="border:none; color:#be123c;">✕</button>
      </div>
    `;
    const nameEl = item.querySelector('.file-name-edit') as HTMLElement;
    nameEl?.addEventListener('blur', () => {
      const newName = nameEl.textContent?.trim();
      if (newName && newName !== file.name) {
        file.name = newName;
        updateUI();
      }
    });
    nameEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
    });

    item.addEventListener('click', () => { state.activeFileId = id; updateUI(); });
    item.querySelector('.btn-comp')?.addEventListener('click', (e) => { e.stopPropagation(); toggleComp(id); });
    item.querySelector('.btn-del')?.addEventListener('click', (e) => { e.stopPropagation(); deleteFile(id); });
    container.appendChild(item);
  });
}

function toggleComp(id: string) {
  if (state.comparisonIds.has(id)) state.comparisonIds.delete(id);
  else state.comparisonIds.add(id);
  updateUI();
}

function deleteFile(id: string) {
  state.files.delete(id);
  if (state.activeFileId === id) state.activeFileId = state.files.keys().next().value || null;
  updateUI();
}

function renderPlots() {
  const container = UI.get('workspace-container');
  if (!container) return;
  container.innerHTML = '';

  let gridClass = 'grid-single';
  if (state.layoutMode === 'grid2x1') gridClass = 'grid-2x1';
  if (state.layoutMode === 'grid2x2') gridClass = 'grid-2x2';
  container.className = `workspace-grid ${gridClass}`;

  const stackGroup = UI.get('stack-ctrl-group');
  if (state.layoutMode === 'stacked' && state.comparisonIds.size > 0) {
    stackGroup?.classList.remove('hidden');
  } else {
    stackGroup?.classList.add('hidden');
  }

  // Unified Filtering: Always show active file + all comparison selections
  const fileIdsToRender = new Set(state.comparisonIds);
  if (state.activeFileId) fileIdsToRender.add(state.activeFileId);

  let filesToRender = Array.from(fileIdsToRender)
    .map(id => state.files.get(id))
    .filter(f => !!f) as ProcessedFile[];

  if (filesToRender.length === 0) {
    console.log("[RamanInstant] Rendering placeholder...");
    container.innerHTML = `
      <div class="viewer-placeholder">
        <h2>Spectral Viewer</h2>
        <p>Your spectral files will be visible here.</p>
        <span>Select or upload data from the sidebar to begin analysis.</span>
      </div>
    `;
    return;
  }

  if (state.layoutMode === 'stacked' && filesToRender.length > 1) {
    const div = document.createElement('div');
    div.className = 'plot-container';
    container.appendChild(div);
    const datasets = filesToRender.map((f, i) => {
      const { normalized } = SpectralProcessor.normalizeMax(f.processedY);
      const offset = i * state.stackOffset;
      return {
        name: f.name, x: f.raw.x, y: normalized.map(v => v + offset), color: f.color
      };
    });
    requestAnimationFrame(() => {
      ChartRenderer.renderOverlay(div, datasets, state.viewRange || undefined);
      attachManualBaselineListener(div);
    });
  } else if (state.layoutMode.startsWith('grid')) {
    const limit = state.layoutMode === 'grid2x1' ? 2 : 4;
    filesToRender.slice(0, limit).forEach((f) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'plot-item';
      wrapper.innerHTML = `<div class="plot-item-title">${f.name}</div><div class="plot-container" style="flex:1; min-height:0;"></div>`;
      container.appendChild(wrapper);
      const plotEl = wrapper.querySelector('.plot-container') as HTMLElement;

      // Double RAF to ensure layout is stable
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          ChartRenderer.renderSingle(plotEl, f.raw.x, f.raw.y, f.processedY, f.baselineY, f.peaks, f.color, state.viewRange || undefined, true);
          attachManualBaselineListener(plotEl);
        });
      });
    });
  } else {
    const div = document.createElement('div');
    div.className = 'plot-container';
    container.appendChild(div);
    
    if (filesToRender.length > 1) {
      // Overlay Mode (Active + Comparison)
      const datasets = filesToRender.map(f => ({
        name: f.name, x: f.raw.x, y: f.processedY, color: f.color
      }));
      requestAnimationFrame(() => {
        ChartRenderer.renderOverlay(div, datasets, state.viewRange || undefined);
        attachManualBaselineListener(div);
      });
    } else {
      // Pure Single Mode
      const f = filesToRender[0];
      requestAnimationFrame(() => {
        ChartRenderer.renderSingle(div, f.raw.x, f.raw.y, f.processedY, f.baselineY, f.peaks, f.color, state.viewRange || undefined);
        attachManualBaselineListener(div);
      });
    }
  }
}

function attachManualBaselineListener(el: HTMLElement) {
  const plotEl = el as any;
  if (plotEl) {
    plotEl.on('plotly_click', (data: any) => {
      if (state.baselineMode === 'manual') {
        const { x, y } = data.points[0];
        addAnchor(x, y);
      }
    });
  }
}

function addAnchor(x: number, y: number) {
  const active = state.files.get(state.activeFileId || '');
  if (active) {
    active.anchors.push({ x, y });
    reprocessActive();
  }
}

function renderAnchorList() {
  const active = state.files.get(state.activeFileId || '');
  const body = UI.get('anchor-list-body');
  if (!body) return;
  body.innerHTML = '';
  if (!active || state.baselineMode !== 'manual') return;

  active.anchors.sort((a, b) => a.x - b.x).forEach((a, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="padding:4px;">${a.x.toFixed(1)}</td>
      <td style="padding:4px;">${a.y.toFixed(1)}</td>
      <td style="padding:4px;"><button class="btn-del-anchor" data-idx="${idx}" style="background:none; border:none; cursor:pointer;">✕</button></td>
    `;
    tr.querySelector('.btn-del-anchor')?.addEventListener('click', () => {
      active.anchors.splice(idx, 1);
      reprocessActive();
    });
    body.appendChild(tr);
  });
}

function renderPeakTable() {
  const active = state.files.get(state.activeFileId || '');
  const body = UI.get('peaks-list-body');
  const warning = UI.get('proximity-warning');
  if (!body) return;
  body.innerHTML = '';

  if (!active || active.peaks.length === 0) {
    warning?.classList.add('hidden');
    return;
  }

  // Smart Proximity Check
  const sortedPeaks = [...active.peaks].sort((a, b) => a.x - b.x);
  let hasProximityIssue = false;
  for (let i = 0; i < sortedPeaks.length - 1; i++) {
    if (Math.abs(sortedPeaks[i].x - sortedPeaks[i + 1].x) < 30) {
      hasProximityIssue = true;
      break;
    }
  }

  if (hasProximityIssue) warning?.classList.remove('hidden');
  else warning?.classList.add('hidden');

  sortedPeaks.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.x.toFixed(1)}</td>
      <td>${p.y.toFixed(2)}</td>
      <td>${p.fwhm.toFixed(1)}</td>
      <td></td>
    `;
    body.appendChild(tr);
  });
}

function initBaselineControls() {
  UI.get('btn-mode-snip')?.addEventListener('click', () => {
    state.baselineMode = 'auto';
    UI.get('btn-mode-snip')?.classList.add('active-compare');
    UI.get('btn-mode-manual')?.classList.remove('active-compare');
    UI.get('snip-controls')?.classList.remove('hidden');
    UI.get('manual-controls')?.classList.add('hidden');
    reprocessAll();
  });

  UI.get('btn-mode-manual')?.addEventListener('click', () => {
    state.baselineMode = 'manual';
    UI.get('btn-mode-manual')?.classList.add('active-compare');
    UI.get('btn-mode-snip')?.classList.remove('active-compare');
    UI.get('snip-controls')?.classList.add('hidden');
    UI.get('manual-controls')?.classList.remove('hidden');
    reprocessAll();
  });

  UI.get('btn-clear-anchors')?.addEventListener('click', () => {
    const active = state.files.get(state.activeFileId || '');
    if (active) {
      active.anchors = [];
      reprocessActive();
    }
  });
}

function initLayoutControls() {
  UI.get('select-layout')?.addEventListener('change', (e) => {
    state.layoutMode = (e.target as HTMLSelectElement).value as any;
    updateUI();
  });
}

function initSliders() {
  UI.get('slider-snip')?.addEventListener('input', (e) => {
    UI.text('val-snip', (e.target as HTMLInputElement).value);
    reprocessAll();
  });
  UI.get('slider-stack')?.addEventListener('input', (e) => {
    state.stackOffset = parseFloat((e.target as HTMLInputElement).value);
    UI.text('val-stack', state.stackOffset.toFixed(1));
    updateUI();
  });
  UI.get('btn-export-excel')?.addEventListener('click', exportExcel);
  UI.get('btn-export-png')?.addEventListener('click', exportPNG);
}

function reprocessActive() {
  const active = state.files.get(state.activeFileId || '');
  if (active) {
    processAndStore(active.id, active.name, active.raw);
    updateUI();
  }
}

function reprocessAll() {
  state.files.forEach((f, id) => processAndStore(id, f.name, f.raw));
  updateUI();
}

async function exportExcel() {
  const fileIds = state.comparisonIds.size > 0 ? Array.from(state.comparisonIds) : [state.activeFileId].filter(id => id) as string[];
  if (fileIds.length === 0) return;
  UI.text('system-status', 'PREPARING_EXCEL...');

  try {
    const workbook = new ExcelJS.Workbook();
    const params = { snip: parseInt(UI.val('slider-snip')), sg: 9 };

    // Methodology Sheet
    const summarySheet = workbook.addWorksheet('Analysis Info');
    summarySheet.columns = [{ header: 'Parameter', key: 'p', width: 25 }, { header: 'Value', key: 'v', width: 45 }];
    summarySheet.addRow({ p: 'Workstation', v: 'RamanInstant Professional v2.0' });
    summarySheet.addRow({ p: 'Export Date', v: new Date().toISOString() });
    summarySheet.addRow({ p: 'Baseline (SNIP)', v: params.snip + ' iterations' });
    summarySheet.addRow({ p: 'Smoothing (SG)', v: 'Window size ' + params.sg });
    if (state.viewRange) {
      summarySheet.addRow({ p: 'Spectral Window Min', v: state.viewRange[0] + ' cm-1' });
      summarySheet.addRow({ p: 'Spectral Window Max', v: state.viewRange[1] + ' cm-1' });
    }
    summarySheet.getRow(1).font = { bold: true };

    // Spectral Sheets
    const sheetNames = new Set();
    for (const id of fileIds) {
      const file = state.files.get(id)!;
      let baseName = file.name.substring(0, 28).replace(/[\\\/\?\*\[\]]/g, '_');
      let sheetName = baseName;
      let counter = 1;
      while (sheetNames.has(sheetName)) { sheetName = `${baseName}_${counter++}`; }
      sheetNames.add(sheetName);

      const sheet = workbook.addWorksheet(sheetName);
      sheet.columns = [
        { header: 'Raman Shift (cm-1)', key: 'x', width: 18 },
        { header: 'Raw Intensity', key: 'raw', width: 18 },
        { header: 'Processed Intensity', key: 'proc', width: 20 }
      ];

      for (let i = 0; i < file.raw.x.length; i++) {
        if (state.viewRange && (file.raw.x[i] < state.viewRange[0] || file.raw.x[i] > state.viewRange[1])) continue;
        sheet.addRow({ x: file.raw.x[i], raw: file.raw.y[i], proc: file.processedY[i] });
      }
      sheet.getRow(1).font = { bold: true };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `RamanInstant_Analysis_${new Date().getTime()}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);

    UI.text('system-status', 'SYSTEM_READY');
  } catch (err) {
    console.error('Export Error:', err);
    UI.text('system-status', 'EXPORT_FAILED');
  }
}

// Expose processor to window for the chart renderer's Waterfall export
(window as any).SpectralProcessor = SpectralProcessor;

async function exportPNG() {
  UI.text('system-status', 'PREPARING_ROBUST_EXPORT...');

  let filesToRender = Array.from(state.comparisonIds)
    .map(id => state.files.get(id))
    .filter(f => !!f) as ProcessedFile[];

  if (filesToRender.length === 0 && state.activeFileId) {
    const active = state.files.get(state.activeFileId);
    if (active) filesToRender = [active];
  }

  if (filesToRender.length === 0) {
    UI.text('system-status', 'NO_DATA');
    return;
  }

  try {
    await ChartRenderer.exportPublicationFigure(state, filesToRender);
    UI.text('system-status', 'FIGURE_EXPORTED');
  } catch (err) {
    console.error('[RamanInstant] Robust Export Error:', err);
    UI.text('system-status', 'EXPORT_FAILED');
  }
  setTimeout(() => UI.text('system-status', 'SYSTEM_READY'), 2000);
}
