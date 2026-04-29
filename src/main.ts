/**
 * Instant Raman v2.1 — Research Workstation Engine
 * Optimized for robustness, performance, and commercial reliability.
 */
const APP_VERSION = 'v2.1.0';
import { SpectralProcessor } from './engine/processor.ts';
import { UniversalParser } from './parsers/universalParser.ts';
import { ChartRenderer } from './ui/charts.ts';
import { ReplicateEngine } from './engine/replicates.ts';
import type { ReplicateStats } from './engine/replicates.ts';
import type { NormalizedSpectrum, SpectralData, Peak, VarianceResult, NormalizationMode } from './engine/types.ts';
import * as XLSX from 'xlsx';

// ── Types ──
interface ProcessedFile {
  id: string;
  name: string;
  raw: NormalizedSpectrum;
  corrected: SpectralData;
  baseline: SpectralData;
  processed: SpectralData;
  normFactor: number;
  peaks: Peak[];
  variance: VarianceResult;
  spikesRemoved: number;
  params: { snip: number; sg: number; mode: 'auto' | 'manual'; timestamp: string; norm: NormalizationMode };
  anchors: { x: number; y: number }[];
  color: string;
}

interface AppState {
  files: Map<string, ProcessedFile>;
  activeFileId: string | null;
  comparisonIds: Set<string>;
  baselineMode: 'auto' | 'manual';
  layoutMode: 'single' | 'stacked' | 'grid2x1' | 'grid2x2' | 'replicate';
  previousLayoutMode: 'single' | 'stacked' | 'grid2x1' | 'grid2x2';
  stackOffset: number;
  hideYAxis: boolean;
  viewRange: [number, number] | null;
  replicateGroup: ReplicateStats | null;
  normalizationMode: NormalizationMode;
  normTargetX: number | null;
  showPeakAnnotations: boolean;
  ratioMode: boolean;
  ratioSelection: { p1: Peak | null; p2: Peak | null };
  exportSize: 'full' | 'single' | 'double' | 'custom';
  exportWidth: number; // in mm
  exportTransparent: boolean;
  axisFontSize: number;
  showAxisBox: boolean;
  showDirectLabels: boolean;
}

// ── State ──
const state: AppState = {
  files: new Map(),
  activeFileId: null,
  comparisonIds: new Set(),
  baselineMode: 'auto',
  layoutMode: 'single',
  previousLayoutMode: 'single',
  stackOffset: 0,
  hideYAxis: false,
  viewRange: null,
  replicateGroup: null,
  normalizationMode: 'none',
  normTargetX: null,
  showPeakAnnotations: false,
  ratioMode: false,
  ratioSelection: { p1: null, p2: null },
  exportSize: 'full',
  exportWidth: 86,
  exportTransparent: false,
  axisFontSize: 16,
  showAxisBox: true,
  showDirectLabels: false
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
initAboutModal();
initUpload();
initSliders();
initBaselineControls();
initLayoutControls();
initNormalization();
initPeakAnnotations();
initRatioCalculator();
initCalibration();
setTimeout(() => updateUI(), 150);

function initCalibration() {
  UI.get('btn-si-cal')?.addEventListener('click', () => {
    const active = state.files.get(state.activeFileId || '');
    if (!active) return;

    const result = SpectralProcessor.siliconCalibrationCheck(active.processed);
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
  files.forEach(async file => {
    try {
      const parsed = await UniversalParser.parseFile(file);
      const id = `file-${Math.random().toString(36).slice(2, 9)}`;
      processAndStore(id, file.name, parsed);
      if (state.files.size === 1) state.activeFileId = id;
      updateUI();
      UI.text('system-status', `READY`);
    } catch (err: any) {
      console.error('[Parser] Error:', err);
      UI.text('system-status', err.message || 'PARSE_ERROR');
      alert(err.message || 'Failed to parse file.');
    }
  });
}

function processAndStore(id: string, name: string, raw: NormalizedSpectrum) {
  const existing = state.files.get(id);
  const snip = parseInt(UI.val('slider-snip') || '25');
  const sg = 9;
  const mode = state.baselineMode;
  const anchors = existing?.anchors || [];

  // Cosmic Ray Rejection
  const { cleaned, replacedCount } = SpectralProcessor.rejectCosmicRays(raw);

  // Baseline Estimation
  let baseline: SpectralData;
  if (mode === 'manual') {
    baseline = SpectralProcessor.baselineManual(cleaned, anchors);
  } else {
    baseline = SpectralProcessor.baselineSNIP(cleaned, snip);
  }

  // Final Processing: Correction and Smoothing
  const corrected: SpectralData = {
    wavenumberData: raw.wavenumberData,
    intensityData: cleaned.intensityData.map((v, i) => Math.max(0, v - baseline.intensityData[i]))
  };
  
  const smoothed = SpectralProcessor.savitzkyGolay(corrected, sg);
  
  // Normalization
  let processed = smoothed;
  let normFactor = 1.0;
  const normMode = state.normalizationMode;
  
  if (normMode === 'max') {
    const res = SpectralProcessor.normalizeMax(smoothed);
    processed = res.normalized;
    normFactor = res.factor;
  } else if (normMode === 'area') {
    const res = SpectralProcessor.normalizeArea(smoothed);
    processed = res.normalized;
    normFactor = res.factor;
  } else if (normMode === 'point' && state.normTargetX !== null) {
    const res = SpectralProcessor.normalizeToPoint(smoothed, state.normTargetX);
    processed = res.normalized;
    normFactor = res.factor;
  }

  const peaks = SpectralProcessor.findPeaks(processed);
  const variance = SpectralProcessor.calculateVariance(cleaned, baseline);

  state.files.set(id, {
    id, name, raw, corrected, baseline, processed, normFactor, peaks, variance,
    spikesRemoved: replacedCount,
    params: { snip, sg, mode, timestamp: new Date().toISOString(), norm: normMode },
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

  // Collective Analysis Buttons
  const btnStats = UI.get('btn-group-replicates');
  const btnUndo = UI.get('btn-undo-replicates');
  if (state.layoutMode === 'replicate') {
    btnStats?.style.setProperty('background', 'var(--laser)', 'important');
    btnStats?.style.setProperty('color', '#000', 'important');
    btnUndo?.classList.remove('hidden');
  } else {
    btnStats?.style.setProperty('background', 'rgba(45, 212, 191, 0.05)', 'important');
    btnStats?.style.setProperty('color', 'var(--laser)', 'important');
    btnUndo?.classList.add('hidden');
  }

  // Update Footer Stats
  const totalFiles = state.files.size;
  const activeCount = state.comparisonIds.size || (state.activeFileId ? 1 : 0);
  UI.text('footer-stats', `FILES: ${totalFiles} ; ACTIVE FILES: ${activeCount}`);

  // Update Ratio Results visibility
  if (state.ratioSelection.p1 || state.ratioSelection.p2) {
    UI.get('ratio-results')?.classList.remove('hidden');
  }

  // Update Ratio Results if both p1 and p2 selected
  if (state.ratioSelection.p1 && state.ratioSelection.p2) {
    const p1 = state.ratioSelection.p1;
    const p2 = state.ratioSelection.p2;
    UI.text('ratio-p1', `${p1.x.toFixed(1)} cm⁻¹`);
    UI.text('ratio-p2', `${p2.x.toFixed(1)} cm⁻¹`);
    UI.text('val-int-ratio', (p1.y / p2.y).toFixed(3));
    UI.text('val-area-ratio', (p1.area / p2.area).toFixed(3));
  } else {
    UI.text('ratio-p1', state.ratioSelection.p1 ? `${state.ratioSelection.p1.x.toFixed(1)} cm⁻¹` : '---');
    UI.text('ratio-p2', '---');
  }
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
          <div style="font-size: 8px; opacity: 0.6;">${file.raw.metadata.pointCount} pts</div>
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
    console.log("[Instant Raman] Rendering placeholder...");
    container.innerHTML = `
      <div class="viewer-placeholder">
        <h2>Spectral Viewer</h2>
        <p>Your spectral files will be visible here.</p>
        <span>Select or upload data from the sidebar to begin analysis.</span>
      </div>
    `;
    return;
  }

  const normLabel = state.normalizationMode === 'none' ? '' : 
                    state.normalizationMode === 'max' ? 'Max Intensity' :
                    state.normalizationMode === 'area' ? 'Total Area' :
                    `Point (${state.normTargetX?.toFixed(0)})`;

  if (state.layoutMode === 'stacked' && filesToRender.length > 1) {
    const div = document.createElement('div');
    div.className = 'plot-container';
    container.appendChild(div);
    const datasets = filesToRender.map((f, i) => {
      // Use pre-processed (normalized) data, but ensure it's in 0-1 range for waterfall consistency
      // if not already normalized.
      let displayData = f.processed;
      if (state.normalizationMode === 'none') {
        displayData = SpectralProcessor.normalizeMax(f.processed).normalized;
      }
      
      const offset = i * state.stackOffset;
      const offsetData = {
        wavenumberData: displayData.wavenumberData,
        intensityData: displayData.intensityData.map(v => v + offset)
      };
      return {
        name: f.name, data: offsetData, color: f.color
      };
    });
    requestAnimationFrame(() => {
      ChartRenderer.renderOverlay(div, datasets, state.viewRange || undefined, true, state.hideYAxis, normLabel, state.showPeakAnnotations ? filesToRender[0].peaks : []);
      attachManualBaselineListener(div);
    });
  } else if (state.layoutMode === 'replicate' && state.replicateGroup) {
    const div = document.createElement('div');
    div.className = 'plot-container';
    container.appendChild(div);
    requestAnimationFrame(() => {
      ChartRenderer.renderReplicate(div, state.replicateGroup!.mean, state.replicateGroup!.sd, "Replicate Group", "#332288", state.viewRange || undefined);
    });
  } else if (state.layoutMode.startsWith('grid')) {
    const limit = state.layoutMode === 'grid2x1' ? 2 : 4;
    filesToRender.slice(0, limit).forEach((f) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'plot-item';
      wrapper.innerHTML = `<div class="plot-item-title">${f.name}</div><div class="plot-container" style="flex:1; min-height:0;"></div>`;
      container.appendChild(wrapper);
      const plotEl = wrapper.querySelector('.plot-container') as HTMLElement;

      const rawNormalized: SpectralData = {
        wavenumberData: f.raw.wavenumberData,
        intensityData: f.raw.intensityData.map(v => v * f.normFactor)
      };

      requestAnimationFrame(() => {
        ChartRenderer.renderSingle(plotEl, rawNormalized, f.processed, f.baseline, f.peaks, f.color, state.viewRange || undefined, true, state.hideYAxis, normLabel, state.showPeakAnnotations, state.ratioSelection, state.axisFontSize, state.showAxisBox);
        attachManualBaselineListener(plotEl);
      });
    });
  } else {
    const div = document.createElement('div');
    div.className = 'plot-container';
    container.appendChild(div);

    if (filesToRender.length > 1) {
      const datasets = filesToRender.map(f => ({
        name: f.name, data: f.processed, color: f.color
      }));
      requestAnimationFrame(() => {
        ChartRenderer.renderOverlay(div, datasets, state.viewRange || undefined, false, state.hideYAxis, normLabel, state.showPeakAnnotations ? filesToRender[0].peaks : [], state.ratioSelection, state.axisFontSize, state.showAxisBox, state.showDirectLabels);
        attachManualBaselineListener(div);
      });
    } else {
      const f = filesToRender[0];
      const rawNormalized: SpectralData = {
        wavenumberData: f.raw.wavenumberData,
        intensityData: f.raw.intensityData.map(v => v * f.normFactor)
      };
      requestAnimationFrame(() => {
        ChartRenderer.renderSingle(div, rawNormalized, f.processed, f.baseline, f.peaks, f.color, state.viewRange || undefined, false, state.hideYAxis, normLabel, state.showPeakAnnotations, state.ratioSelection, state.axisFontSize, state.showAxisBox);
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
      } else if (state.ratioMode) {
        const { x } = data.points[0];
        const activeFile = state.files.get(state.activeFileId || '');
        if (activeFile) {
          // Find nearest detected peak
          const nearest = activeFile.peaks.reduce((prev, curr) => 
            Math.abs(curr.x - x) < Math.abs(prev.x - x) ? curr : prev
          );
          
          if (Math.abs(nearest.x - x) < 15) { // snapped range
            if (!state.ratioSelection.p1) {
              state.ratioSelection.p1 = nearest;
            } else if (!state.ratioSelection.p2) {
              state.ratioSelection.p2 = nearest;
              state.ratioMode = false;
              const btn = UI.get('btn-ratio-mode') as HTMLButtonElement;
              btn.innerText = 'ENABLE RATIO SELECTION';
              btn.classList.remove('active-compare');
            }
            updateUI();
          }
        }
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

function initAboutModal() {
  console.log('[Instant Raman] Initializing About Modal...');
  const modal = UI.get('modal-about');
  const btn = UI.get('btn-about');
  
  if (!modal || !btn) {
    console.error('[Instant Raman] Modal or About button not found!', { modal, btn });
    return;
  }

  btn.addEventListener('click', () => {
    console.log('[Instant Raman] Opening About Modal');
    modal.classList.add('active');
  });

  UI.get('btn-close-about')?.addEventListener('click', () => {
    modal.classList.remove('active');
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });
}

function initLayoutControls() {
  UI.get('select-layout')?.addEventListener('change', (e) => {
    state.layoutMode = (e.target as HTMLSelectElement).value as any;
    if (state.layoutMode !== 'replicate') {
      state.previousLayoutMode = state.layoutMode as any;
    }
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
      return { raw: f.raw, processed: f.processed, peaks: f.peaks };
    });

    try {
      if (state.layoutMode !== 'replicate') {
        state.previousLayoutMode = state.layoutMode as any;
      }
      state.replicateGroup = ReplicateEngine.compute(datasets);
      state.layoutMode = 'replicate';
      updateUI();
    } catch (err: any) {
      alert(err.message);
    }
  });

  UI.get('btn-undo-replicates')?.addEventListener('click', () => {
    state.layoutMode = state.previousLayoutMode;
    state.replicateGroup = null;
    updateUI();
  });
}

function initNormalization() {
  UI.get('select-norm')?.addEventListener('change', (e) => {
    state.normalizationMode = (e.target as HTMLSelectElement).value as NormalizationMode;
    if (state.normalizationMode === 'point') {
      UI.get('norm-point-info')?.classList.remove('hidden');
    } else {
      UI.get('norm-point-info')?.classList.add('hidden');
      reprocessAll();
    }
    updateUI();
  });
}

function initPeakAnnotations() {
  UI.get('check-show-peaks')?.addEventListener('change', (e) => {
    state.showPeakAnnotations = (e.target as HTMLInputElement).checked;
    updateUI();
  });
}

function initRatioCalculator() {
  UI.get('btn-ratio-mode')?.addEventListener('click', () => {
    state.ratioMode = !state.ratioMode;
    const btn = UI.get('btn-ratio-mode') as HTMLButtonElement;
    if (state.ratioMode) {
      btn.innerText = 'RATIO MODE: ACTIVE (PICK 2 PEAKS)';
      btn.classList.add('active-compare');
      state.ratioSelection = { p1: null, p2: null };
      UI.get('ratio-results')?.classList.remove('hidden');
    } else {
      btn.innerText = 'ENABLE RATIO SELECTION';
      btn.classList.remove('active-compare');
    }
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
  UI.get('check-hide-y')?.addEventListener('change', (e) => {
    state.hideYAxis = (e.target as HTMLInputElement).checked;
    updateUI();
  });
  UI.get('btn-export-excel')?.addEventListener('click', exportExcel);
  UI.get('btn-export-png')?.addEventListener('click', () => exportFigure('png'));
  UI.get('btn-export-svg')?.addEventListener('click', () => exportFigure('svg'));

  UI.get('select-export-size')?.addEventListener('change', (e) => {
    state.exportSize = (e.target as HTMLSelectElement).value as any;
    const custom = UI.get('custom-width-ctrl');
    if (state.exportSize === 'custom') {
      custom?.classList.remove('hidden');
    } else {
      custom?.classList.add('hidden');
      if (state.exportSize === 'single') state.exportWidth = 86;
      if (state.exportSize === 'double') state.exportWidth = 174;
    }
  });

  UI.get('input-export-width')?.addEventListener('input', (e) => {
    state.exportWidth = parseFloat((e.target as HTMLInputElement).value) || 86;
  });

  UI.get('check-export-transparent')?.addEventListener('change', (e) => {
    state.exportTransparent = (e.target as HTMLInputElement).checked;
  });

  // Feature 5 - Caption
  UI.get('btn-gen-caption')?.addEventListener('click', generateCaption);
  UI.get('btn-copy-caption')?.addEventListener('click', () => {
    const text = (UI.get('text-caption') as HTMLTextAreaElement).value;
    navigator.clipboard.writeText(text);
    const btn = UI.get('btn-copy-caption') as HTMLButtonElement;
    btn.innerText = 'COPIED!';
    setTimeout(() => btn.innerText = 'COPY TO CLIPBOARD', 2000);
  });

  // Feature 6 - Axis Customization
  UI.get('btn-apply-range')?.addEventListener('click', () => {
    const min = parseFloat((UI.get('input-range-min') as HTMLInputElement).value);
    const max = parseFloat((UI.get('input-range-max') as HTMLInputElement).value);
    if (!isNaN(min) && !isNaN(max)) {
      state.viewRange = [min, max];
      renderPlots();
    }
  });

  UI.get('btn-reset-range')?.addEventListener('click', () => {
    state.viewRange = null;
    (UI.get('input-range-min') as HTMLInputElement).value = '';
    (UI.get('input-range-max') as HTMLInputElement).value = '';
    renderPlots();
  });

  UI.get('select-axis-font')?.addEventListener('change', (e) => {
    state.axisFontSize = parseInt((e.target as HTMLSelectElement).value);
    renderPlots();
  });

  UI.get('check-axis-box')?.addEventListener('change', (e) => {
    state.showAxisBox = (e.target as HTMLInputElement).checked;
    renderPlots();
  });

  UI.get('check-direct-labels')?.addEventListener('change', (e) => {
    state.showDirectLabels = (e.target as HTMLInputElement).checked;
    renderPlots();
  });
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

  try {
    const wb = XLSX.utils.book_new();
    const params = { snip: parseInt(UI.val('slider-snip')), sg: 9 };

    // 1. Methodology Sheet
    const summaryData = [
      ['Parameter', 'Value'],
      ['Workstation', `Instant Raman ${APP_VERSION}`],
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
        ...state.replicateGroup.mean.wavenumberData.map((x, i) => [x, state.replicateGroup!.mean.intensityData[i], state.replicateGroup!.sd[i]])
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
      
      let baseName = file.name.substring(0, 25).replace(/[\\\/\?\*\[\]]/g, '_');
      let sheetName = baseName;
      let counter = 1;
      while (sheetNames.has(sheetName)) { sheetName = `${baseName}_${counter++}`; }
      sheetNames.add(sheetName);

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
      
      const normLabel = file.params.norm === 'none' ? 'None' : 
                       file.params.norm === 'max' ? 'Max Intensity' :
                       file.params.norm === 'area' ? 'Total Area (AUC)' :
                       `Point Ref (${state.normTargetX?.toFixed(1)} cm⁻¹)`;

      spectralData.push(['Raman Shift (cm-1)', 'Raw Intensity', 'Baseline Corrected', `Normalized (${normLabel})`]);
      
      for (let i = 0; i < file.raw.wavenumberData.length; i++) {
        if (state.viewRange && (file.raw.wavenumberData[i] < state.viewRange[0] || file.raw.wavenumberData[i] > state.viewRange[1])) continue;
        spectralData.push([
          file.raw.wavenumberData[i], 
          file.raw.intensityData[i], 
          file.corrected.intensityData[i],
          file.processed.intensityData[i]
        ]);
      }

      // Add Peak Analysis Section
      spectralData.push([]);
      spectralData.push(['--- PEAK ANALYSIS ---']);
      spectralData.push(['Shift (cm-1)', 'Intensity', 'Rel Intensity (%)', 'FWHM (cm-1)', 'Area (counts*cm-1)']);
      file.peaks.forEach(p => {
        spectralData.push([p.x, p.y, p.relIntensity, p.fwhm, p.area]);
      });

      // Add Ratios if selected
      if (state.ratioSelection.p1 && state.ratioSelection.p2) {
        const p1 = state.ratioSelection.p1;
        const p2 = state.ratioSelection.p2;
        spectralData.push([]);
        spectralData.push(['--- INTENSITY RATIO ---']);
        spectralData.push([`I(${p1.x.toFixed(1)}) / I(${p2.x.toFixed(1)})`, (p1.y / p2.y).toFixed(4)]);
        spectralData.push(['--- AREA RATIO ---']);
        spectralData.push([`A(${p1.x.toFixed(1)}) / A(${p2.x.toFixed(1)})`, (p1.area / p2.area).toFixed(4)]);
      }

      const spectralSheet = XLSX.utils.aoa_to_sheet(spectralData);
      XLSX.utils.book_append_sheet(wb, spectralSheet, sheetName);
    }

    const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const defaultFilename = `raman_analysis_${Math.floor(Date.now() / 1000)}.xlsx`;

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
        return;
      } catch (e) {}
    }

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
    const normLabel = state.normalizationMode === 'none' ? '' : 
                    state.normalizationMode === 'max' ? 'Max Intensity' :
                    state.normalizationMode === 'area' ? 'Total Area' :
                    `Point (${state.normTargetX?.toFixed(0)})`;
    await ChartRenderer.exportPublicationFigure(state, filesToRender, format, normLabel, state.showPeakAnnotations, state.ratioSelection, state.axisFontSize, state.showAxisBox, state.showDirectLabels);
  } catch (err) {
    console.error('[raman — instant] Export Error:', err);
  }
}

function generateCaption() {
  const active = state.files.get(state.activeFileId || '');
  if (!active) return;

  const params = active.params;
  const snip = params.snip;
  const sg = params.sg;
  const norm = params.norm;
  const peakCount = active.peaks.length;

  let normDesc = 'no additional normalization';
  if (norm === 'max') normDesc = 'peak maximum normalization';
  if (norm === 'area') normDesc = 'total area (AUC) normalization';
  if (norm === 'point') normDesc = `normalization to the peak at ${state.normTargetX?.toFixed(1)} cm⁻¹`;

  const caption = `Figure. Raman spectrum of ${active.name}. Data was processed using the Instant Raman (v2.0) spectral workstation. Background subtraction was performed using the SNIP algorithm (${snip} iterations), followed by Savitzky-Golay smoothing (window size ${sg}). The spectrum was stabilized using ${normDesc}. Peak detection was performed using a local maxima algorithm with 3-point parabolic refinement and a 5% intensity threshold, identifying ${peakCount} distinct Raman bands. Figure generated via Instant Raman (https://raman-instant.com).`;

  const area = UI.get('text-caption') as HTMLTextAreaElement;
  if (area) area.value = caption;
  UI.get('caption-container')?.classList.remove('hidden');
}
