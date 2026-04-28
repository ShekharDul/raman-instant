/**
 * RamanInstant v2.1 — Research Workstation Engine
 * Optimized for robustness, performance, and commercial reliability.
 */
const APP_VERSION = 'v2.1.0';
import { SpectralProcessor } from './engine/processor.ts';
import type { Peak, VarianceResult } from './engine/processor.ts';
import { parseSpectralFile } from './parsers/textParser.ts';
import type { ParsedSpectrum } from './parsers/textParser.ts';
import { ChartRenderer } from './ui/charts.ts';
import { ReplicateEngine } from './engine/replicates.ts';
import type { ReplicateStats } from './engine/replicates.ts';
import * as XLSX from 'xlsx';

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
  layoutMode: 'single' | 'stacked' | 'grid2x1' | 'grid2x2' | 'replicate';
  stackOffset: number;
  viewRange: [number, number] | null;
  hideYAxis: boolean;
  replicateGroup: ReplicateStats | null;
}

// ── State ──
const state: AppState = {
  files: new Map(),
  activeFileId: null,
  comparisonIds: new Set(),
  baselineMode: 'auto',
  layoutMode: 'single',
  stackOffset: 0,
  viewRange: null,
  hideYAxis: false,
  replicateGroup: null
};

const COLOR_PALETTE = ['#332288', '#88CCEE', '#44AA99', '#117733', '#999933', '#DDCC77', '#CC6677', '#882255'];

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
initCalibration();
setTimeout(() => updateUI(), 150);

function initCalibration() {
  UI.get('btn-si-cal')?.addEventListener('click', () => {
    const active = state.files.get(state.activeFileId || '');
    if (!active) return;

    const result = SpectralProcessor.siliconCalibrationCheck(active.raw.x, active.processedY);
    const container = UI.get('cal-status-container');
    const badge = UI.get('cal-badge');

    if (container && badge) {
      container.classList.remove('hidden');
      UI.text('cal-measured', result.measuredPeak > 0 ? `${result.measuredPeak} cm⁻¹` : 'N/A');
      UI.text('cal-offset', result.measuredPeak > 0 ? `${result.offset > 0 ? '+' : ''}${result.offset} cm⁻¹` : '---');

      badge.style.background = result.status === 'OK' ? '#059669' : result.status === 'DRIFTED' ? '#d97706' : '#be123c';
      badge.style.color = '#fff';
      badge.textContent = result.status === 'OK' ? 'CALIBRATED' : result.status === 'DRIFTED' ? `DRIFTED (${result.offset})` : 'NO Si PEAK';
    }
  });
}

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
  } else {
    UI.get('cal-status-container')?.classList.add('hidden');
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

    item.addEventListener('click', () => { 
      state.activeFileId = id; 
      UI.get('cal-status-container')?.classList.add('hidden');
      updateUI(); 
    });
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
      ChartRenderer.renderOverlay(div, datasets, state.viewRange || undefined, true, state.hideYAxis);
      attachManualBaselineListener(div);
    });
  } else if (state.layoutMode === 'replicate' && state.replicateGroup) {
    const div = document.createElement('div');
    div.className = 'plot-container';
    container.appendChild(div);
    requestAnimationFrame(() => {
      ChartRenderer.renderReplicate(div, state.replicateGroup!.x, state.replicateGroup!.mean, state.replicateGroup!.sd, "Replicate Group", "#332288", state.viewRange || undefined);
    });
  } else if (state.layoutMode.startsWith('grid')) {
    const limit = state.layoutMode === 'grid2x1' ? 2 : 4;
    filesToRender.slice(0, limit).forEach((f) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'plot-item';
      wrapper.innerHTML = `<div class="plot-item-title">${f.name}</div><div class="plot-container" style="flex:1; min-height:0;"></div>`;
      container.appendChild(wrapper);
      const plotEl = wrapper.querySelector('.plot-container') as HTMLElement;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          ChartRenderer.renderSingle(plotEl, f.raw.x, f.raw.y, f.processedY, f.baselineY, f.peaks, f.color, state.viewRange || undefined, true, state.hideYAxis);
          attachManualBaselineListener(plotEl);
        });
      });
    });
  } else {
    const div = document.createElement('div');
    div.className = 'plot-container';
    container.appendChild(div);
    
    if (filesToRender.length > 1) {
      const datasets = filesToRender.map(f => ({
        name: f.name, x: f.raw.x, y: f.processedY, color: f.color
      }));
      requestAnimationFrame(() => {
        ChartRenderer.renderOverlay(div, datasets, state.viewRange || undefined, false, state.hideYAxis);
        attachManualBaselineListener(div);
      });
    } else {
      const f = filesToRender[0];
      requestAnimationFrame(() => {
        ChartRenderer.renderSingle(div, f.raw.x, f.raw.y, f.processedY, f.baselineY, f.peaks, f.color, state.viewRange || undefined, false, state.hideYAxis);
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
  const title = UI.get('peak-panel-title');
  if (!body) return;
  body.innerHTML = '';

  if (state.layoutMode === 'replicate' && state.replicateGroup) {
    if (title) title.textContent = "Statistical Peak Analysis (Mean ± SD)";
    warning?.classList.add('hidden');
    
    state.replicateGroup.peakStats.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.xMean.toFixed(1)} ± ${p.xSD.toFixed(2)}</td>
        <td>${p.yMean.toFixed(3)} ± ${p.ySD.toFixed(4)}</td>
        <td>${p.fwhmMean.toFixed(1)} ± ${p.fwhmSD.toFixed(2)}</td>
        <td></td>
      `;
      body.appendChild(tr);
    });
    return;
  }

  if (title) title.textContent = "Peak Analysis";
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
  UI.get('btn-group-replicates')?.addEventListener('click', () => {
    const selectedIds = Array.from(state.comparisonIds);
    if (state.activeFileId) selectedIds.push(state.activeFileId);
    
    const uniqueIds = Array.from(new Set(selectedIds));
    if (uniqueIds.length < 2) {
      alert("Please select at least 2 files (using COMP buttons) to calculate a statistical average.");
      return;
    }

    const datasets = uniqueIds.map(id => {
      const f = state.files.get(id)!;
      return { x: f.raw.x, y: f.processedY, peaks: f.peaks };
    });

    try {
      state.replicateGroup = ReplicateEngine.compute(datasets);
      state.layoutMode = 'replicate';
      updateUI();
    } catch (err: any) {
      alert(err.message);
    }
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
  UI.get('check-hide-y')?.addEventListener('change', (e) => {
    state.hideYAxis = (e.target as HTMLInputElement).checked;
    updateUI();
  });
  UI.get('btn-export-excel')?.addEventListener('click', exportExcel);
  UI.get('btn-export-png')?.addEventListener('click', () => exportFigure('png'));
  UI.get('btn-export-svg')?.addEventListener('click', () => exportFigure('svg'));
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

  // Diagnostic Logs for Claude
  console.log('XLSX object:', XLSX);
  console.log('writeFile type:', typeof XLSX.writeFile);
  console.log('utils type:', typeof XLSX.utils);

  try {
    const wb = XLSX.utils.book_new();
    const params = { snip: parseInt(UI.val('slider-snip')), sg: 9 };

    // 1. Methodology Sheet
    const summaryData = [
      ['Parameter', 'Value'],
      ['Workstation', `RamanInstant ${APP_VERSION}`],
      ['Export Date', new Date().toISOString()],
      ['Global Baseline (SNIP)', params.snip + ' iterations'],
      ['Global Smoothing (SG)', 'Window size ' + params.sg],
      ['Peak Detection Threshold', '5% of Max Intensity'],
      ['Software', 'raman-instant.com']
    ];
    if (state.viewRange) {
      summaryData.push(['Spectral Window Min', state.viewRange[0] + ' cm-1']);
      summaryData.push(['Spectral Window Max', state.viewRange[1] + ' cm-1']);
    }
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Analysis Info');

    // 1.1 Statistical Summary (If Replicate Mode)
    if (state.replicateGroup) {
      const statsData = [
        ['Raman Shift (cm-1)', 'Mean Intensity', 'Std Dev (SD)'],
        ...state.replicateGroup.x.map((x, i) => [x, state.replicateGroup!.mean[i], state.replicateGroup!.sd[i]])
      ];
      const statsWs = XLSX.utils.aoa_to_sheet(statsData);
      XLSX.utils.book_append_sheet(wb, statsWs, 'Statistical Summary');

      const peakStatsData = [
        ['Peak Center (Mean)', 'Shift SD', 'Intensity (Mean)', 'Intensity SD', 'FWHM (Mean)', 'FWHM SD'],
        ...state.replicateGroup.peakStats.map(p => [p.xMean, p.xSD, p.yMean, p.ySD, p.fwhmMean, p.fwhmSD])
      ];
      const peakStatsWs = XLSX.utils.aoa_to_sheet(peakStatsData);
      XLSX.utils.book_append_sheet(wb, peakStatsWs, 'Peak Stats (Mean±SD)');
    }

    // 2. Spectral Data Sheets
    const sheetNames = new Set();
    for (const id of fileIds) {
      const file = state.files.get(id)!;
      
      // Clean sheet name
      let baseName = file.name.substring(0, 25).replace(/[\\\/\?\*\[\]]/g, '_');
      let sheetName = baseName;
      let counter = 1;
      while (sheetNames.has(sheetName)) { sheetName = `${baseName}_${counter++}`; }
      sheetNames.add(sheetName);

      // Per-file Metadata Header
      const spectralData: any[][] = [
        ['File Name', file.name],
        ['Baseline Mode', file.params.mode.toUpperCase()],
        ['Cosmic Ray Spikes Removed', file.spikesRemoved],
        ['SNIP Iterations', file.params.mode === 'auto' ? file.params.snip : 'N/A'],
        ['Manual Anchors Count', file.params.mode === 'manual' ? file.anchors.length : 0]
      ];

      if (file.params.mode === 'manual' && file.anchors.length > 0) {
        spectralData.push(['Manual Anchor Points (X,Y)', file.anchors.map(a => `(${a.x.toFixed(1)}, ${a.y.toFixed(1)})`).join('; ')]);
      }

      spectralData.push([]); // Spacer
      spectralData.push(['Raman Shift (cm-1)', 'Raw Intensity', 'Processed Intensity']);
      
      for (let i = 0; i < file.raw.x.length; i++) {
        if (state.viewRange && (file.raw.x[i] < state.viewRange[0] || file.raw.x[i] > state.viewRange[1])) continue;
        spectralData.push([file.raw.x[i], file.raw.y[i], file.processedY[i]]);
      }

      const spectralSheet = XLSX.utils.aoa_to_sheet(spectralData);
      XLSX.utils.book_append_sheet(wb, spectralSheet, sheetName);
    }

    // 3. Advanced Binary Generation
    const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const defaultFilename = `raman_analysis_${Math.floor(Date.now() / 1000)}.xlsx`;

    // 4. Trigger Windows "Save As" Dialog (if supported)
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: defaultFilename,
          types: [{
            description: 'Excel Spreadsheet',
            accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        console.log('[raman — instant] File saved successfully via System Picker.');
        return;
      } catch (e) {
        console.warn('[raman — instant] System Picker cancelled, falling back to standard download.');
      }
    }

    // 5. Standard Fallback (for older browsers)
    XLSX.writeFile(wb, defaultFilename);
  } catch (err) {
    console.error('[raman — instant] SheetJS Export Error:', err);
  }
}

// Expose processor to window for the chart renderer's Waterfall export
(window as any).SpectralProcessor = SpectralProcessor;

async function exportFigure(format: 'png' | 'svg') {
  let filesToRender = Array.from(state.comparisonIds)
    .map(id => state.files.get(id))
    .filter(f => !!f) as ProcessedFile[];

  if (filesToRender.length === 0 && state.activeFileId) {
    const active = state.files.get(state.activeFileId);
    if (active) filesToRender = [active];
  }

  if (filesToRender.length === 0) return;

  try {
    await ChartRenderer.exportPublicationFigure(state, filesToRender, format);
  } catch (err) {
    console.error('[raman — instant] Export Error:', err);
  }
}
