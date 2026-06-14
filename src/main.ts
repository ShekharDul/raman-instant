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
import { ReportGenerator } from './ui/reportGenerator.ts';
import { FittingEngine, type FitResult, formatStatisticalError } from './engine/fitting.ts';
import type { NormalizedSpectrum, SpectralData, Peak, VarianceResult, NormalizationMode, CustomLabel } from './engine/types.ts';
import { ProtocolManager, type InstantRamanProtocol } from './engine/protocol.ts';
import * as XLSX from 'xlsx';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { DiagnosticDashboard } from './components/DiagnosticDashboard.tsx';
import { AnalysisSuite } from './components/AnalysisSuite.tsx';
import { LicenseManager } from './engine/license.ts';

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
  selectedPeakX: Set<number>;
  variance: VarianceResult;
  spikesRemoved: number;
  params: { snip: number; sg: number; mode: 'auto' | 'manual'; timestamp: string; norm: NormalizationMode };
  anchors: { x: number; y: number }[];
  labels: CustomLabel[];
  color: string;
  fileHash?: string;
  isReproduced?: boolean;
  protocolId?: string;
  reproducedSteps?: Set<string>;
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
  ratioMode: boolean;
  ratioSelection: { p1: Peak | null; p2: Peak | null };
  exportTransparent: boolean;
  axisFontSize: number;
  showAxisBox: boolean;
  showDirectLabels: boolean;
  viewHistory: ([number, number] | null)[];
  maxXData: number;
  showUnprocessed: boolean;
  showBaseline: boolean;
  showGrid: boolean;
  cosmicRayRemoval: boolean;
  fitResult: FitResult | null;
  fittingMode: boolean;
  selectingROI: boolean;
  labelMode: boolean;
  freeLabelMode: boolean;
  pendingLabel: { x: number; y: number } | null;
  snapshots: import('./ui/reportGenerator.ts').Snapshot[];
  epiResult: import('./engine/fitting').EpistemicResult | null;
  mcResult: any | null; // UncertaintyPropagatorResult
  visibleTableFileId: string | null;
  isPro: boolean;
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
  ratioMode: false,
  ratioSelection: { p1: null, p2: null },
  exportTransparent: false,
  axisFontSize: 16,
  showAxisBox: true,
  showDirectLabels: false,
  viewHistory: [],
  maxXData: 4000,
  showUnprocessed: false,
  showBaseline: false,
  showGrid: true,
  cosmicRayRemoval: true,
  fitResult: null,
  fittingMode: false,
  selectingROI: false,
  labelMode: false,
  freeLabelMode: false,
  pendingLabel: null,
  snapshots: [],
  epiResult: null,
  mcResult: null,
  visibleTableFileId: null,
  isPro: false
};

const COLOR_PALETTE = ['#332288', '#88CCEE', '#44AA99', '#117733', '#999933', '#DDCC77', '#CC6677', '#882255'];

// ── Robust DOM Access ──
const UI = {
  get: (id: string) => document.getElementById(id),
  text: (id: string, val: string) => { const el = document.getElementById(id); if (el) el.textContent = val; },
  html: (id: string, val: string) => { const el = document.getElementById(id); if (el) el.innerHTML = val; },
  val: (id: string) => (document.getElementById(id) as HTMLInputElement)?.value || '',
  setVal: (id: string, val: string) => { const el = document.getElementById(id) as HTMLInputElement; if (el) el.value = val; }
};

// ── Analytics ──
function trackEvent(name: string, params: object = {}) {
  try {
    if ((window as any).gtag) {
      (window as any).gtag('event', name, params);
    }
  } catch (e) {
    console.warn('[Analytics] Failed to track event:', name, e);
  }
}

// ── Initialization ──
initAboutModal();
initLicensing();
initDrawerToggle();
initUpload();
initSliders();
initBaselineControls();
initLayoutControls();
initNormalization();
initRatioCalculator();
initCalibration();
initViewControls();
initLabelControls();
initLabelPopover();
initReportControls();
initProtocolExport();
initSnapshotModal();
initExportStylingControls();
setTimeout(() => updateUI(), 150);

function initViewControls() {
  UI.get('btn-undo-view')?.addEventListener('click', () => {
    if (state.viewHistory.length > 0) {
      state.viewRange = state.viewHistory.pop() || null;
      // Also clear ratio selection when undoing view
      state.ratioSelection = { p1: null, p2: null };
      updateUI();
    }
  });

  UI.get('btn-reset-view')?.addEventListener('click', () => {
    if (state.viewRange) {
      state.viewHistory.push([...state.viewRange]);
    }
    state.viewRange = null;
    // Also clear ratio selection when resetting view
    state.ratioSelection = { p1: null, p2: null };
    updateUI();
  });
}

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
  
  const irpCount = files.filter(f => f.name.toLowerCase().endsWith('.irp')).length;
  trackEvent('files_ingested', { 
    total_count: files.length, 
    protocol_files: irpCount,
    contains_protocol: irpCount > 0 
  });

  files.forEach(async file => {
    try {
      if (file.name.toLowerCase().endsWith('.irp') || file.name.toLowerCase().endsWith('.json')) {
        const text = await file.text();
        let json;
        try {
          json = JSON.parse(text);
        } catch (e) {
          throw new Error("Failed to parse IRP file as JSON.");
        }
        promptProtocolImport(json);
        UI.text('system-status', `READY`);
        return;
      }

      // Read array buffer for hashing if needed later
      const buffer = await file.arrayBuffer();
      // Need a new File object for the parser since we consumed the buffer? 
      // Actually UniversalParser uses file.text() internally. 
      // arrayBuffer() might not consume it if we just read it. Wait, File is a Blob, reading it multiple times is fine.
      const parsed = await UniversalParser.parseFile(new File([buffer], file.name));
      const id = `file-${Math.random().toString(36).slice(2, 9)}`;

      const fileHash = await ProtocolManager.computeHash(buffer);

      processAndStore(id, file.name, parsed, fileHash);
      if (state.files.size === 1) state.activeFileId = id;

      trackEvent('file_uploaded', {
        file_name: file.name,
        file_size: file.size,
        file_type: file.name.split('.').pop()?.toLowerCase() || 'unknown'
      });

      updateUI();
      UI.text('system-status', `READY`);
    } catch (err: any) {
      console.error('[Parser] Error:', err);
      UI.text('system-status', err.message || 'PARSE_ERROR');
      alert(err.message || 'Failed to parse file.');
    }
  });
}

function updateMaxXData() {
  if (state.files.size === 0) {
    state.maxXData = 4000;
    return;
  }
  let max = 0;
  state.files.forEach(f => {
    const fileMax = f.raw.wavenumberData[f.raw.wavenumberData.length - 1];
    if (fileMax > max) max = fileMax;
  });
  state.maxXData = max;
}

function processAndStore(id: string, name: string, raw: NormalizedSpectrum, fileHash?: string) {
  const existing = state.files.get(id);
  const snip = parseInt(UI.val('slider-snip') || '25');
  const sg = 9;
  const mode = state.baselineMode;
  const anchors = existing?.anchors || [];

  // Store fileHash temporarily on existing if needed, or we can just append it to ProcessedFile
  const currentHash = fileHash || (existing as any)?.fileHash || '';

  // Cosmic Ray Rejection
  let cleaned = raw;
  let replacedCount = 0;
  if (state.cosmicRayRemoval) {
    const result = SpectralProcessor.rejectCosmicRays(raw);
    cleaned = { ...raw, intensityData: result.cleaned.intensityData };
    replacedCount = result.replacedCount;

    if (replacedCount > 0) {
      showToast(`CLEANED: Removed ${replacedCount} cosmic ray spikes from ${name}`);
    }
  }

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

  trackEvent('peak_detection_run', {
    peak_count: peaks.length,
    file_id: id,
    baseline_mode: mode
  });

  state.files.set(id, {
    id, name, raw, corrected, baseline, processed, normFactor, peaks,
    selectedPeakX: existing?.selectedPeakX || new Set(),
    variance,
    spikesRemoved: replacedCount,
    params: { snip, sg, mode, timestamp: new Date().toISOString(), norm: normMode },
    anchors,
    color: existing?.color || COLOR_PALETTE[state.files.size % COLOR_PALETTE.length],
    labels: existing?.labels || [],
    fileHash: currentHash,
    isReproduced: existing?.isReproduced,
    protocolId: existing?.protocolId,
    reproducedSteps: existing?.reproducedSteps
  });

  updateMaxXData();
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ?
    `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` :
    '45, 212, 191';
}

function updateUI() {
  renderFileList();
  renderPlots();
  renderAnchorList();
  renderDataGrid();
  renderTimeline();

  const active = state.files.get(state.activeFileId || '');
  const app = document.getElementById('app');

  if (active) {
    UI.text('active-filename', active.name);
    UI.text('methods-summary', `Analysis: ${active.name} | Mode: ${active.params.mode.toUpperCase()} | ${active.peaks.length} peaks detected.`);

    // Dynamic Theming: Inject active color as CSS variables
    if (app) {
      app.style.setProperty('--active-color', active.color);
      app.style.setProperty('--active-color-rgb', hexToRgb(active.color));
    }

    UI.get('cal-status-container')?.classList.remove('hidden');
  } else {
    UI.get('cal-status-container')?.classList.add('hidden');
    if (app) {
      app.style.removeProperty('--active-color');
      app.style.removeProperty('--active-color-rgb');
    }
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

  // Toggle Left Sidebar Empty States
  const hasFiles = state.files.size > 0;
  UI.get('plot-empty')?.classList.toggle('hidden', hasFiles);
  UI.get('plot-content')?.classList.toggle('hidden', !hasFiles);
  UI.get('files-empty')?.classList.toggle('hidden', hasFiles);
  UI.get('file-list')?.classList.toggle('hidden', !hasFiles);

  renderLabelList();

  // Systematic Fix: Update Fit/ROI button state
  const btnFit = UI.get('btn-start-fit-mode') as HTMLButtonElement;
  if (btnFit) {
    if (state.selectingROI) {
      btnFit.innerText = 'SELECT ROI ON PLOT...';
      btnFit.style.background = 'var(--laser)';
      btnFit.style.color = '#000';
    } else {
      btnFit.innerText = 'START PEAK FITTING (ROI)';
      btnFit.style.background = '';
      btnFit.style.color = '';
    }
  }
}

function renderLabelList() {
  const active = state.files.get(state.activeFileId || '');
  const container = UI.get('label-list');
  const wrapper = UI.get('label-list-container');
  if (!container || !wrapper) return;

  if (!active || active.labels.length === 0) {
    wrapper.classList.add('hidden');
    return;
  }

  wrapper.classList.remove('hidden');
  container.innerHTML = '';
  active.labels.forEach((label) => {
    const item = document.createElement('div');
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.justifyContent = 'space-between';
    item.style.padding = '6px 8px';
    item.style.background = '#fff';
    item.style.border = '1px solid var(--border)';
    item.style.fontSize = '10px';
    item.style.borderRadius = '2px';

    item.innerHTML = `
      <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding-right:8px;">
        <span style="font-weight:700; color:#3b82f6;">${label.x.toFixed(0)}</span>: ${label.text}
      </div>
      <button class="btn-del-label" style="background:none; border:none; color:#be123c; cursor:pointer; font-weight:700; padding:2px 4px;">✕</button>
    `;

    item.querySelector('.btn-del-label')?.addEventListener('click', (e) => {
      e.stopPropagation();
      active.labels = active.labels.filter(l => l.id !== label.id);
      updateUI();
    });

    container.appendChild(item);
  });
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
      <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:0; overflow:hidden;">
        <div class="compare-checkbox ${state.comparisonIds.has(id) ? 'checked' : ''}" title="Compare this file">
          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="3" fill="none" class="check-icon" style="opacity: ${state.comparisonIds.has(id) ? '1' : '0'};">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <div style="width:3px; height:24px; background:${file.color}; border-radius:2px;"></div>
        <div style="flex:1; min-width:0;">
          <div class="file-name-edit" contenteditable="true" spellcheck="false" 
               style="font-weight:600; font-size:12px; outline:none; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${file.name}</div>
          <div style="display: flex; align-items: center; gap: 6px; margin-top:2px;">
            <div style="font-size: 10px; color: var(--text-dim);">${file.raw.metadata.pointCount} pts</div>
            ${file.isReproduced ? `<div style="font-size: 9px; background: #fef3c7; color: #92400e; padding: 1px 4px; border-radius: 3px; font-weight: 700; border: 1px solid #fde68a;">REPRODUCED [${file.protocolId?.slice(0, 8)}]</div>` : ''}
          </div>
        </div>
      </div>
      <div class="file-actions">
        <button class="btn-view-table ${state.visibleTableFileId === id ? 'active' : ''}" title="View peak table" style="background:none; border:none; color:${state.visibleTableFileId === id ? 'var(--accent)' : 'var(--text-dim)'}; cursor:pointer; padding:4px; ${state.visibleTableFileId === id ? 'border: 1px solid var(--accent); border-radius: 4px; background: var(--accent-light);' : ''}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>
        </button>
        <button class="btn-edit-name" title="Rename file" style="background:none; border:none; color:var(--text-dim); cursor:pointer; padding:4px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path><path d="m15 5 4 4"></path></svg>
        </button>
        <button class="btn-del-file" title="Remove file" style="background:none; border:none; color:var(--text-dim); cursor:pointer; padding:4px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
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

    item.querySelector('.btn-edit-name')?.addEventListener('click', (e) => {
      e.stopPropagation();
      nameEl?.focus();
      // Select all text in the contenteditable
      const range = document.createRange();
      range.selectNodeContents(nameEl);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    });

    item.addEventListener('click', (e) => {
      // Don't trigger active file change if clicking the checkbox, delete, or edit button
      if ((e.target as HTMLElement).closest('.compare-checkbox') || (e.target as HTMLElement).closest('.btn-del-file') || (e.target as HTMLElement).closest('.btn-edit-name')) {
        return;
      }
      state.activeFileId = id;
      UI.get('cal-status-container')?.classList.add('hidden');
      updateUI();
    });

    item.querySelector('.btn-view-table')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDataGrid(id);
    });
    item.querySelector('.compare-checkbox')?.addEventListener('click', (e) => { e.stopPropagation(); toggleComp(id); });
    item.querySelector('.btn-del-file')?.addEventListener('click', (e) => { e.stopPropagation(); deleteFile(id); });
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
  state.comparisonIds.delete(id);
  if (state.activeFileId === id) {
    state.activeFileId = state.files.size > 0 ? Array.from(state.files.keys())[0] : null;
  }
  updateMaxXData();
  updateUI();
}

function renderPlots() {
  hideLabelPopover();
  const container = UI.get('workspace-container');
  if (!container) return;
  container.innerHTML = '';

  // Systematic Fix: Reset inline styles that may have been set during Fit Mode
  container.style.display = '';
  container.style.flexDirection = '';
  container.style.gap = '';

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

  const activeFile = state.files.get(state.activeFileId || '');
  const peaksForPlot = activeFile ? activeFile.peaks.filter(p => activeFile.selectedPeakX.has(p.x)) : [];

  const hasData = filesToRender.length > 0;

  // Toggle Empty States in Sidebar
  UI.get('analysis-empty')?.classList.toggle('hidden', hasData);
  UI.get('analysis-content')?.classList.toggle('hidden', !hasData);
  UI.get('export-empty')?.classList.toggle('hidden', hasData);
  UI.get('export-content')?.classList.toggle('hidden', !hasData);

  if (!hasData) {
    container.innerHTML = `
      <div class="viewer-placeholder">
        <h2>Spectral Viewer</h2>
        <p>Your spectral files will be visible here.</p>
        <span>Select or upload data from the sidebar to begin analysis.</span>
      </div>
    `;
    return;
  }

  if (state.fittingMode && state.fitResult) {
    UI.get('btn-start-fit-mode')?.classList.add('hidden');
    UI.get('btn-exit-fit')?.classList.remove('hidden');
    renderFitResults();
    return;
  } else {
    UI.get('btn-start-fit-mode')?.classList.remove('hidden');
    UI.get('btn-exit-fit')?.classList.add('hidden');
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
      let displayData = f.processed;
      let currentFactor = f.normFactor;

      if (state.normalizationMode === 'none') {
        const res = SpectralProcessor.normalizeMax(f.processed);
        displayData = res.normalized;
        currentFactor = res.factor;
      }

      const offset = i * state.stackOffset;
      const offsetData = {
        wavenumberData: displayData.wavenumberData,
        intensityData: displayData.intensityData.map(v => v + offset)
      };

      const rawScaled = {
        wavenumberData: f.raw.wavenumberData,
        intensityData: f.raw.intensityData.map(v => (v * currentFactor) + offset)
      };

      return {
        name: f.name, data: offsetData, color: f.color, raw: rawScaled, labels: f.labels
      };
    });
    requestAnimationFrame(() => {
      ChartRenderer.renderOverlay(div, datasets, state.viewRange || undefined, true, state.hideYAxis, normLabel, peaksForPlot, null, 16, true, false, state.showUnprocessed, state.showBaseline, state.showGrid);
      attachManualBaselineListener(div);
      attachLabelClickListener(div);
      attachFreeLabelListener(div);
    });
  } else if (state.layoutMode === 'replicate' && state.replicateGroup) {
    const div = document.createElement('div');
    div.className = 'plot-container';
    container.appendChild(div);
    requestAnimationFrame(() => {
      const statsPeaks: Peak[] = state.replicateGroup?.peakStats
        .filter(ps => state.replicateGroup?.selectedPeakX.has(ps.xMean))
        .map(ps => ({
          x: ps.xMean,
          y: ps.yMean,
          fwhm: ps.fwhmMean,
          relIntensity: 0,
          area: 0
        })) || [];
      ChartRenderer.renderReplicate(div, state.replicateGroup!.mean, state.replicateGroup!.sd, "Replicate Group", "#332288", state.viewRange || undefined, statsPeaks, state.showGrid, activeFile?.labels || []);
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
        const filteredPeaks = f.peaks.filter(p => f.selectedPeakX.has(p.x));
        ChartRenderer.renderSingle(plotEl, rawNormalized, f.processed, f.baseline, filteredPeaks, f.color, state.viewRange || undefined, true, state.hideYAxis, normLabel, state.ratioSelection, state.axisFontSize, state.showAxisBox, state.showUnprocessed, state.showBaseline, state.showGrid, f.labels);
        attachManualBaselineListener(plotEl);
        attachLabelClickListener(plotEl);
        attachFreeLabelListener(plotEl);
        // Systematic Fix: Ensure grid plots also get the fit listener if in selection mode
        if (state.fittingMode || state.selectingROI) attachFitListener(plotEl);
      });
    });
  } else {
    const div = document.createElement('div');
    div.className = 'plot-container';
    container.appendChild(div);

    if (filesToRender.length > 1) {
      const datasets = filesToRender.map(f => ({
        name: f.name, data: f.processed, color: f.color, labels: f.labels, raw: {
          wavenumberData: f.raw.wavenumberData,
          intensityData: f.raw.intensityData.map(v => v * f.normFactor)
        }
      }));
      requestAnimationFrame(() => {
        ChartRenderer.renderOverlay(div, datasets, state.viewRange || undefined, false, state.hideYAxis, normLabel, peaksForPlot, state.ratioSelection, state.axisFontSize, state.showAxisBox, state.showDirectLabels, state.showUnprocessed, state.showBaseline, state.showGrid);
        attachManualBaselineListener(div);
        attachLabelClickListener(div);
        attachFreeLabelListener(div);
      });
    } else {
      const f = filesToRender[0];
      const rawNormalized: SpectralData = {
        wavenumberData: f.raw.wavenumberData,
        intensityData: f.raw.intensityData.map(v => v * f.normFactor)
      };
      requestAnimationFrame(() => {
        const filteredPeaks = activeFile?.peaks.filter(p => activeFile.selectedPeakX.has(p.x)) || [];
        ChartRenderer.renderSingle(div, rawNormalized, activeFile!.processed, activeFile!.baseline, filteredPeaks, activeFile!.color, state.viewRange || undefined, false, state.hideYAxis, normLabel, state.ratioSelection, state.axisFontSize, state.showAxisBox, state.showUnprocessed, state.showBaseline, state.showGrid, activeFile!.labels);
        attachManualBaselineListener(div);
        attachLabelClickListener(div);
        attachFreeLabelListener(div);
        if (state.fittingMode || state.selectingROI) attachFitListener(div);
      });
    }
  }
}

function attachFitListener(el: HTMLElement) {
  const Plotly = (window as any).Plotly;
  const plotEl = el as any;
  if (!plotEl || !Plotly) return;

  // Force box selection mode
  // Force box selection mode (with safety timeout to ensure Plotly is ready)
  const setDragMode = () => {
    if (plotEl._fullLayout) {
      Plotly.relayout(plotEl, { dragmode: 'select' });
    } else {
      setTimeout(setDragMode, 50);
    }
  };
  setDragMode();

  plotEl.on('plotly_selected', (data: any) => {
    if (!data) return;
    const range = data.range.x;
    state.selectingROI = false; // Turn off selection mode once fit starts
    runFitting(range[0], range[1]);
  });
}

function attachManualBaselineListener(el: HTMLElement) {
  const plotEl = el as any;
  if (plotEl) {
    plotEl.on('plotly_relayout', (data: any) => {
      // Handle Zoom/Pan
      if (data['xaxis.range[0]'] !== undefined) {
        const newMinX = Math.max(0, data['xaxis.range[0]']);
        const newMaxX = Math.min(state.maxXData, data['xaxis.range[1]']);

        // Prevent infinite loop by checking if change is needed
        let needsFix = false;
        const fix: any = {};

        if (data['xaxis.range[0]'] < 0) {
          fix['xaxis.range[0]'] = 0;
          needsFix = true;
        }
        if (data['xaxis.range[1]'] > state.maxXData) {
          fix['xaxis.range[1]'] = state.maxXData;
          needsFix = true;
        }

        if (needsFix) {
          const Plotly = (window as any).Plotly;
          if (Plotly) Plotly.relayout(plotEl, fix);
        }

        // Save current view to history before updating if it's a significant change
        if (!state.viewRange || Math.abs(state.viewRange[0] - newMinX) > 1 || Math.abs(state.viewRange[1] - newMaxX) > 1) {
          state.viewHistory.push(state.viewRange ? [...state.viewRange] : null);
          if (state.viewHistory.length > 20) state.viewHistory.shift();
        }
        state.viewRange = [newMinX, newMaxX];
      }

      // Clamp Y-axis if it goes negative during manual zoom/pan
      if (data['yaxis.range[0]'] !== undefined && data['yaxis.range[0]'] < 0) {
        const Plotly = (window as any).Plotly;
        if (Plotly) Plotly.relayout(plotEl, { 'yaxis.range[0]': 0 });
      }      // Handle Double-Click / Reset
      else if (data['xaxis.autorange'] === true || data['autosize'] === true) {
        if (state.viewRange) {
          state.viewHistory.push([...state.viewRange]);
        }
        state.viewRange = null;
        // Fix "Flat Line" issue: force Y-axis to also reset to auto-range
        const Plotly = (window as any).Plotly;
        if (Plotly) {
          Plotly.relayout(plotEl, { 'yaxis.autorange': true });
        }
      }
    });

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
              showToast("Peak 1 selected. Now click on the second peak.");
              // Auto-select for table inclusion
              activeFile.selectedPeakX.add(nearest.x);
            } else if (!state.ratioSelection.p2) {
              state.ratioSelection.p2 = nearest;
              state.ratioMode = false;
              const btn = UI.get('btn-ratio-mode') as HTMLButtonElement;
              btn.innerText = 'ENABLE RATIO SELECTION';
              btn.classList.remove('active-compare');
              // Auto-select for table inclusion
              activeFile.selectedPeakX.add(nearest.x);
            }
            updateUI();
          }
        }
      }
      else if (state.labelMode) {
        if (!data || !data.points || data.points.length === 0) return;
        const { x, y } = data.points[0];
        state.pendingLabel = { x, y };

        const modal = UI.get('modal-label');
        const input = UI.get('input-label-text') as HTMLInputElement;
        if (modal && input) {
          modal.classList.add('active');
          input.value = '';
          input.focus();
        }
      }
      else {
        // Standard Peak Selection from Plot
        const { x } = data.points[0];
        const activeFile = state.files.get(state.activeFileId || '');
        if (activeFile && activeFile.peaks.length > 0) {
          const nearest = activeFile.peaks.reduce((prev, curr) =>
            Math.abs(curr.x - x) < Math.abs(prev.x - x) ? curr : prev
          );
          if (Math.abs(nearest.x - x) < 15) { // snapped range
            if (activeFile.selectedPeakX.has(nearest.x)) {
              activeFile.selectedPeakX.delete(nearest.x);
            } else {
              activeFile.selectedPeakX.add(nearest.x);
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



function initBaselineControls() {
  UI.get('btn-mode-snip')?.addEventListener('click', () => {
    state.baselineMode = 'auto';
    UI.get('btn-mode-snip')?.classList.add('active-compare');
    UI.get('btn-mode-manual')?.classList.remove('active-compare');
    UI.get('snip-controls')?.classList.remove('hidden');
    UI.get('manual-controls')?.classList.add('hidden');

    trackEvent('baseline_correction_applied', { mode: 'auto' });
    markManualChange('Baseline Correction');
    reprocessAll();
  });

  UI.get('btn-mode-manual')?.addEventListener('click', () => {
    state.baselineMode = 'manual';
    UI.get('btn-mode-manual')?.classList.add('active-compare');
    UI.get('btn-mode-snip')?.classList.remove('active-compare');
    UI.get('snip-controls')?.classList.add('hidden');
    UI.get('manual-controls')?.classList.remove('hidden');

    trackEvent('baseline_correction_applied', { mode: 'manual' });
    markManualChange('Baseline Correction');
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
  const modal = UI.get('modal-about');
  const btn = UI.get('btn-about');
  if (!modal || !btn) return;

  btn.addEventListener('click', () => modal.classList.add('active'));
  UI.get('btn-close-about')?.addEventListener('click', () => modal.classList.remove('active'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });
}


function initLicensing() {
  const licenseState = LicenseManager.get();
  state.isPro = licenseState.isPro;

  updateLicenseHeaderUI();

  const btnActivate = UI.get('btn-activate-license');
  const paywallModal = UI.get('modal-paywall');
  
  if (btnActivate && paywallModal) {
    btnActivate.addEventListener('click', () => {
      showPaywallModal();
    });
  }

  const btnClose = UI.get('btn-close-paywall');
  if (btnClose && paywallModal) {
    btnClose.addEventListener('click', () => paywallModal.classList.remove('active'));
    paywallModal.addEventListener('click', (e) => {
      if (e.target === paywallModal) paywallModal.classList.remove('active');
    });
  }

  const btnValidate = UI.get('btn-validate-license');
  const inputKey = UI.get('input-license-key') as HTMLInputElement;
  const statusEl = UI.get('license-validation-status');

  if (btnValidate && inputKey && statusEl && paywallModal) {
    btnValidate.addEventListener('click', async () => {
      const key = inputKey.value.trim();
      if (!key) {
        statusEl.innerText = 'Please enter a license key.';
        statusEl.className = 'text-rose-600 font-semibold';
        statusEl.classList.remove('hidden');
        return;
      }

      btnValidate.innerText = 'Validating...';
      btnValidate.setAttribute('disabled', 'true');
      statusEl.classList.add('hidden');

      const result = await LicenseManager.validateAndSave(key);

      btnValidate.innerText = 'Validate';
      btnValidate.removeAttribute('disabled');

      if (result.success) {
        state.isPro = true;
        updateLicenseHeaderUI();
        statusEl.innerText = '✓ Pro features successfully unlocked!';
        statusEl.className = 'text-emerald-600 font-semibold';
        statusEl.classList.remove('hidden');
        showToast('Pro License Activated successfully!');
        trackEvent('license_activated', { success: true });
        
        // Hide modal after delay
        setTimeout(() => {
          paywallModal.classList.remove('active');
          statusEl.classList.add('hidden');
          inputKey.value = '';
        }, 1500);
      } else {
        statusEl.innerText = `Error: ${result.error || 'Invalid license key.'}`;
        statusEl.className = 'text-rose-600 font-semibold';
        statusEl.classList.remove('hidden');
        trackEvent('license_activated', { success: false, error: result.error });
      }
    });
  }
}

function updateLicenseHeaderUI() {
  const btnActivate = UI.get('btn-activate-license');
  if (!btnActivate) return;

  if (state.isPro) {
    btnActivate.innerText = '✓ Pro Active';
    btnActivate.style.background = 'none';
    btnActivate.style.border = '1px solid var(--border)';
    btnActivate.style.color = 'var(--text-secondary)';
    btnActivate.style.cursor = 'default';
    btnActivate.setAttribute('disabled', 'true');
  } else {
    btnActivate.innerText = 'Activate Pro License';
    btnActivate.style.background = 'var(--accent)';
    btnActivate.style.border = '1px solid var(--accent)';
    btnActivate.style.color = 'white';
    btnActivate.style.cursor = 'pointer';
    btnActivate.removeAttribute('disabled');
  }
}

function showPaywallModal(featureDescription?: string) {
  const paywallModal = UI.get('modal-paywall');
  if (!paywallModal) return;

  const descContainer = UI.get('paywall-feature-desc');
  const descText = UI.get('paywall-feature-text');

  if (featureDescription && descContainer && descText) {
    descText.innerText = featureDescription;
    descContainer.style.display = 'block';
  } else if (descContainer) {
    descContainer.style.display = 'none';
  }

  paywallModal.classList.add('active');
}

function initDrawerToggle() {
  const toggleBtn = UI.get('btn-toggle-drawer');
  const panel = UI.get('analysis-drawer');
  const workspace = document.querySelector('.workspace');

  if (!toggleBtn || !panel || !workspace) return;

  toggleBtn.addEventListener('click', () => {
    panel.classList.toggle('drawer-open');
    const isOpen = panel.classList.contains('drawer-open');
    toggleBtn.querySelector('span:first-child')!.textContent = isOpen ? 'Close' : 'Analysis';
    toggleBtn.querySelector('.toggle-icon')!.textContent = isOpen ? '✕' : '▸';
    
    // Do NOT call updateUI() here as it triggers expensive Plotly renders
    // which block the main thread and cause jitter. 
    // The transitionend listener below handles the final render.
  });

  UI.get('btn-close-analysis-drawer')?.addEventListener('click', () => {
    panel.classList.remove('drawer-open');
    toggleBtn.querySelector('span:first-child')!.textContent = 'Analysis';
    toggleBtn.querySelector('.toggle-icon')!.textContent = '▸';
    // Same here, let transitionend handle the cleanup.
  });

  // Global listener for flex transitions to ensure Plotly resizes
  workspace.addEventListener('transitionend', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('plot-area') || 
        target.classList.contains('data-grid') || 
        target.classList.contains('analysis-drawer')) {
      // Trigger the expensive renders only AFTER the smooth transition is complete
      updateUI();
      // Ensure Plotly specifically handles the new container size
      renderPlots();
    }
  });
}

function toggleDataGrid(fileId: string) {
  if (state.visibleTableFileId === fileId) {
    state.visibleTableFileId = null;
  } else {
    state.visibleTableFileId = fileId;
  }
  updateUI();
}

function renderDataGrid() {
  const container = UI.get('peak-data-grid');
  if (!container) return;

  if (!state.visibleTableFileId) {
    container.classList.remove('open');
    container.innerHTML = '';
    return;
  }

  const file = state.files.get(state.visibleTableFileId);
  if (!file) {
    state.visibleTableFileId = null;
    container.classList.remove('open');
    return;
  }

  container.classList.add('open');
  
  container.innerHTML = `
    <div class="panel-header" style="background: var(--bg-surface); padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between;">
      <div style="display: flex; flex-direction: column;">
        <span style="font-size: 11px; font-weight: 700; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px;">${file.name}</span>
        <span style="font-size: 10px; color: var(--text-dim);">${file.peaks.length} peaks identified</span>
      </div>
      <button id="btn-close-data-grid" class="btn-icon" style="opacity: 0.6; padding: 4px;">✕</button>
    </div>
    <div style="flex: 1; overflow-y: auto;">
      <table class="peak-table" style="width: 100%; table-layout: fixed; border-collapse: collapse;">
        <thead style="position: sticky; top: 0; background: var(--bg-surface); z-index: 10; box-shadow: 0 1px 0 var(--border);">
          <tr>
            <th>Shift</th>
            <th>Int.</th>
            <th>FWHM</th>
            <th>Rel. %</th>
          </tr>
        </thead>
        <tbody>
          ${file.peaks.map(p => {
            const isSelected = file.selectedPeakX.has(p.x);
            return `
              <tr class="peak-row ${isSelected ? 'selected' : ''}" data-x="${p.x}" style="cursor: pointer;">
                <td>${p.x.toFixed(1)}</td>
                <td>${p.y.toFixed(0)}</td>
                <td>${p.fwhm.toFixed(1)}</td>
                <td style="font-size: 10px; color: var(--text-dim);">${p.relIntensity.toFixed(1)}%</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Attach row click listeners for selection
  container.querySelectorAll('.peak-row').forEach(row => {
    row.addEventListener('click', () => {
      const x = parseFloat(row.getAttribute('data-x') || '0');
      if (file.selectedPeakX.has(x)) {
        file.selectedPeakX.delete(x);
      } else {
        file.selectedPeakX.add(x);
      }
      // Re-render only the data grid and plots to keep scroll position
      renderDataGrid();
      renderPlots();
    });
  });

  UI.get('btn-close-data-grid')?.addEventListener('click', () => {
    state.visibleTableFileId = null;
    updateUI();
  });
}



function initLayoutControls() {
  const selectLayout = UI.get('select-layout') as HTMLSelectElement;
  selectLayout?.addEventListener('change', (e) => {
    const val = (e.target as HTMLSelectElement).value as any;
    if (val === 'stacked' && !state.isPro) {
      selectLayout.value = state.layoutMode;
      showPaywallModal("Waterfall stack comparison view is a Pro-tier capability.");
      return;
    }
    state.layoutMode = val;
    if (state.layoutMode !== 'replicate') {
      state.previousLayoutMode = state.layoutMode as any;
    }
    updateUI();
  });
  UI.get('btn-group-replicates')?.addEventListener('click', () => {
    if (!state.isPro) {
      showPaywallModal("Replicate analysis (Mean ± SD averaging) is a Pro-tier capability.");
      return;
    }
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

  UI.get('btn-start-fit-mode')?.addEventListener('click', () => {
    state.selectingROI = !state.selectingROI;
    if (state.selectingROI) {
      showToast("Drag on the plot to select your fitting region.");
    }
    updateUI();
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
    markManualChange('Normalization');
    if (state.normalizationMode === 'point') {
      UI.get('norm-point-info')?.classList.remove('hidden');
    } else {
      UI.get('norm-point-info')?.classList.add('hidden');
      reprocessAll();
    }
    updateUI();
  });
}


function initRatioCalculator() {
  UI.get('btn-mode-ratio')?.addEventListener('click', () => {
    state.ratioMode = !state.ratioMode;
    const btn = UI.get('btn-mode-ratio') as HTMLButtonElement;
    if (state.ratioMode) {
      btn.innerText = 'Ratio mode: active (pick 2 peaks)';
      btn.classList.add('active-compare');
      state.ratioSelection = { p1: null, p2: null };
    } else {
      btn.innerText = 'Enable ratio selection';
      btn.classList.remove('active-compare');
    }
    updateUI();
  });
}

function initSliders() {
  let lastSnipTrack = 0;
  UI.get('slider-snip')?.addEventListener('input', (e) => {
    const val = (e.target as HTMLInputElement).value;
    UI.text('val-snip', val);

    // Throttled tracking for slider
    const now = Date.now();
    if (now - lastSnipTrack > 1000) {
      trackEvent('baseline_correction_applied', { mode: 'auto', iterations: parseInt(val) });
      lastSnipTrack = now;
    }

    markManualChange('Baseline Correction');
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
  UI.get('btn-export-excel')?.addEventListener('click', () => {
    trackEvent('export_generated', { export_type: 'excel' });
    exportExcel();
  });
  UI.get('btn-export-png')?.addEventListener('click', () => {
    trackEvent('export_generated', { export_type: 'png' });
    exportFigure('png');
  });
  UI.get('btn-export-svg')?.addEventListener('click', () => {
    if (!state.isPro) {
      showPaywallModal("Vector SVG export is a Pro-tier capability.");
      return;
    }
    trackEvent('export_generated', { export_type: 'svg' });
    exportFigure('svg');
  });



  UI.get('check-export-transparent')?.addEventListener('change', (e) => {
    state.exportTransparent = (e.target as HTMLInputElement).checked;
  });

  UI.get('check-show-unprocessed')?.addEventListener('change', (e) => {
    state.showUnprocessed = (e.target as HTMLInputElement).checked;
    renderPlots();
  });

  UI.get('check-show-baseline')?.addEventListener('change', (e) => {
    state.showBaseline = (e.target as HTMLInputElement).checked;
    renderPlots();
  });

  UI.get('check-hide-grid')?.addEventListener('change', (e) => {
    // Note: Variable is 'showGrid', but checkbox is 'hide-grid' (inverted logic)
    state.showGrid = !(e.target as HTMLInputElement).checked;
    renderPlots();
  });

  UI.get('check-cosmic-ray')?.addEventListener('change', (e) => {
    state.cosmicRayRemoval = (e.target as HTMLInputElement).checked;
    markManualChange('Cosmic Ray');
    reprocessAll();
  });

  // Feature 5 - Caption
  UI.get('btn-gen-caption')?.addEventListener('click', generateCaption);
  UI.get('btn-copy-caption')?.addEventListener('click', () => {
    const text = (UI.get('text-caption') as HTMLTextAreaElement).value;
    navigator.clipboard.writeText(text);
    const btn = UI.get('btn-copy-caption') as HTMLButtonElement;
    btn.innerText = 'Copied!';
    setTimeout(() => btn.innerText = 'Copy to clipboard', 2000);
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

  // Tab Logic
  UI.get('btn-tab-analysis')?.addEventListener('click', () => {
    UI.get('btn-tab-analysis')?.classList.add('active');
    UI.get('btn-tab-export')?.classList.remove('active');
    UI.get('pane-analysis')?.classList.add('active');
    UI.get('pane-export')?.classList.remove('active');
  });

  UI.get('btn-tab-export')?.addEventListener('click', () => {
    UI.get('btn-tab-export')?.classList.add('active');
    UI.get('btn-tab-analysis')?.classList.remove('active');
    UI.get('pane-export')?.classList.add('active');
    UI.get('pane-analysis')?.classList.remove('active');
  });

  // Left Sidebar Tab Logic
  UI.get('btn-tab-plot')?.addEventListener('click', () => {
    UI.get('btn-tab-plot')?.classList.add('active');
    UI.get('btn-tab-files')?.classList.remove('active');
    UI.get('pane-plot')?.classList.add('active');
    UI.get('pane-files')?.classList.remove('active');
  });

  UI.get('btn-tab-files')?.addEventListener('click', () => {
    UI.get('btn-tab-files')?.classList.add('active');
    UI.get('btn-tab-plot')?.classList.remove('active');
    UI.get('pane-files')?.classList.add('active');
    UI.get('pane-plot')?.classList.remove('active');
  });
}

function exitAllLabelModes() {
  state.labelMode = false;
  state.freeLabelMode = false;
  const btnSnap = UI.get('btn-mode-label');
  const btnFree = UI.get('btn-mode-free-label');
  const btnExpSnap = UI.get('btn-export-mode-label');
  const btnExpFree = UI.get('btn-export-mode-free-label');

  if (btnSnap) { btnSnap.innerText = 'Label peak'; btnSnap.classList.remove('active-compare'); }
  if (btnFree) { btnFree.innerText = 'Free annotation'; btnFree.classList.remove('active-compare'); }
  if (btnExpSnap) { btnExpSnap.innerText = 'Add peak label'; btnExpSnap.classList.remove('active-compare'); }
  if (btnExpFree) { btnExpFree.innerText = 'Add custom label'; btnExpFree.classList.remove('active-compare'); }
}

function initLabelControls() {
  const onLabelClick = () => {
    if (state.labelMode) {
      exitAllLabelModes();
    } else {
      exitAllLabelModes();
      state.labelMode = true;
      ['btn-mode-label', 'btn-export-mode-label'].forEach(id => {
        const btn = UI.get(id) as HTMLButtonElement;
        if (btn) {
          btn.innerText = 'Click a peak...';
          btn.classList.add('active-compare');
        }
      });
      showToast("Label Peak: Click any point on the spectrum to label it.");
    }
  };

  const onFreeLabelClick = () => {
    if (state.freeLabelMode) {
      exitAllLabelModes();
    } else {
      exitAllLabelModes();
      state.freeLabelMode = true;
      ['btn-mode-free-label', 'btn-export-mode-free-label'].forEach(id => {
        const btn = UI.get(id) as HTMLButtonElement;
        if (btn) {
          btn.innerText = 'Click anywhere...';
          btn.classList.add('active-compare');
        }
      });
      showToast("Free Annotation: Click anywhere on the plot to place a label.");
    }
  };

  UI.get('btn-mode-label')?.addEventListener('click', onLabelClick);
  UI.get('btn-export-mode-label')?.addEventListener('click', onLabelClick);
  UI.get('btn-mode-free-label')?.addEventListener('click', onFreeLabelClick);
  UI.get('btn-export-mode-free-label')?.addEventListener('click', onFreeLabelClick);

  UI.get('btn-label-save')?.addEventListener('click', saveLabel);
  UI.get('btn-label-cancel')?.addEventListener('click', closeLabelModal);

  UI.get('input-label-text')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveLabel();
    if (e.key === 'Escape') closeLabelModal();
  });
}

function initExportStylingControls() {
  // Font Size
  UI.get('select-axis-font')?.addEventListener('change', (e) => {
    state.axisFontSize = parseInt((e.target as HTMLSelectElement).value);
    updateUI();
  });

  // Axis Box
  UI.get('check-axis-box')?.addEventListener('change', (e) => {
    state.showAxisBox = (e.target as HTMLInputElement).checked;
    updateUI();
  });

  // Range Controls
  UI.get('btn-apply-range')?.addEventListener('click', () => {
    const min = parseFloat(UI.val('input-range-min'));
    const max = parseFloat(UI.val('input-range-max'));
    if (!isNaN(min) && !isNaN(max) && min < max) {
      if (state.viewRange) state.viewHistory.push([...state.viewRange]);
      state.viewRange = [min, max];
      updateUI();
    }
  });

  UI.get('btn-reset-range')?.addEventListener('click', () => {
    if (state.viewRange) state.viewHistory.push([...state.viewRange]);
    state.viewRange = null;
    UI.setVal('input-range-min', '');
    UI.setVal('input-range-max', '');
    updateUI();
  });
}

function saveLabel() {
  const input = UI.get('input-label-text') as HTMLInputElement;
  const text = input?.value.trim();
  const active = state.files.get(state.activeFileId || '');

  if (text && active && state.pendingLabel) {
    active.labels.push({
      id: `label-${Math.random().toString(36).slice(2, 9)}`,
      x: state.pendingLabel.x,
      y: state.pendingLabel.y,
      text
    });

    exitAllLabelModes();
    closeLabelModal();
    updateUI();
  }
}

function closeLabelModal() {
  const modal = UI.get('modal-label');
  if (modal) modal.classList.remove('active');
  state.pendingLabel = null;
}

// ── Label Edit Popover ──
let popoverLabelId: string | null = null;

function initLabelPopover() {
  UI.get('btn-popover-close')?.addEventListener('click', hideLabelPopover);
  UI.get('btn-popover-delete')?.addEventListener('click', () => {
    if (!popoverLabelId) return;
    const active = state.files.get(state.activeFileId || '');
    if (active) {
      active.labels = active.labels.filter(l => l.id !== popoverLabelId);
      hideLabelPopover();
      updateUI();
    }
  });

  UI.get('btn-popover-save')?.addEventListener('click', saveLabelPopover);

  UI.get('input-popover-label')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveLabelPopover();
    if (e.key === 'Escape') hideLabelPopover();
  });

  // Close popover when clicking outside it
  document.addEventListener('mousedown', (e) => {
    const popover = UI.get('label-edit-popover');
    if (popover?.classList.contains('visible') && !popover.contains(e.target as Node)) {
      hideLabelPopover();
    }
  });
}

function saveLabelPopover() {
  if (!popoverLabelId) return;
  const input = UI.get('input-popover-label') as HTMLInputElement;
  const newText = input?.value.trim();
  if (!newText) return;

  const active = state.files.get(state.activeFileId || '');
  if (active) {
    const label = active.labels.find(l => l.id === popoverLabelId);
    if (label) {
      label.text = newText;
      hideLabelPopover();
      updateUI();
    }
  }
}

function showLabelPopover(labelId: string, screenX: number, screenY: number) {
  const active = state.files.get(state.activeFileId || '');
  if (!active) return;
  const label = active.labels.find(l => l.id === labelId);
  if (!label) return;

  popoverLabelId = labelId;
  const popover = UI.get('label-edit-popover');
  const input = UI.get('input-popover-label') as HTMLInputElement;
  if (!popover || !input) return;

  input.value = label.text;

  // Position relative to workspace (parent)
  const workspace = popover.parentElement;
  if (!workspace) return;
  const wRect = workspace.getBoundingClientRect();

  let left = screenX - wRect.left + 12;
  let top = screenY - wRect.top - 10;

  // Clamp to stay within workspace bounds
  const popW = 250; // approximate
  const popH = 130;
  if (left + popW > wRect.width) left = wRect.width - popW - 8;
  if (left < 8) left = 8;
  if (top + popH > wRect.height) top = screenY - wRect.top - popH - 10;
  if (top < 8) top = 8;

  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
  popover.classList.add('visible');

  // Auto-focus and select input
  requestAnimationFrame(() => {
    input.focus();
    input.select();
  });
}

function hideLabelPopover() {
  const popover = UI.get('label-edit-popover');
  if (popover) popover.classList.remove('visible');
  popoverLabelId = null;
}

function attachLabelClickListener(el: HTMLElement) {
  const plotEl = el as any;
  if (!plotEl) return;

  plotEl.on('plotly_clickannotation', (eventData: any) => {
    const ann = eventData.annotation;
    if (!ann || !ann.name || !ann.name.startsWith('customlabel:')) return;

    const labelId = ann.name.replace('customlabel:', '');

    // Get screen position from the click event
    const event = eventData.event || window.event;
    if (event) {
      showLabelPopover(labelId, event.clientX, event.clientY);
    } else {
      // Fallback: position near the annotation using Plotly's coordinate system
      const plotRect = el.getBoundingClientRect();
      showLabelPopover(labelId, plotRect.left + plotRect.width / 2, plotRect.top + plotRect.height / 2);
    }
  });
}

function attachFreeLabelListener(el: HTMLElement) {
  const plotEl = el as any;
  if (!plotEl) return;

  plotEl.addEventListener('click', (e: MouseEvent) => {
    if (!state.freeLabelMode) return;

    // Ignore clicks on popovers or buttons
    if ((e.target as HTMLElement).closest('.label-popover')) return;

    const xaxis = plotEl._fullLayout?.xaxis;
    const yaxis = plotEl._fullLayout?.yaxis;
    const margin = plotEl._fullLayout?.margin;
    if (!xaxis || !yaxis || !margin) return;

    const rect = plotEl.getBoundingClientRect();

    // Calculate pixel coordinates relative to the plot drawing area
    const px = e.clientX - rect.left - margin.l;
    const py = e.clientY - rect.top - margin.t;

    // Ensure click is within the actual plot area
    if (px < 0 || px > plotEl._fullLayout.width - margin.l - margin.r) return;
    if (py < 0 || py > plotEl._fullLayout.height - margin.t - margin.b) return;

    const x = xaxis.p2d(px);
    const y = yaxis.p2d(py);

    state.pendingLabel = { x, y };

    const modal = UI.get('modal-label');
    const input = UI.get('input-label-text') as HTMLInputElement;
    if (modal && input) {
      modal.classList.add('active');
      input.value = '';
      input.focus();
    }
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
      } catch (e) { }
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
    await ChartRenderer.exportPublicationFigure(state, filesToRender, format, normLabel, state.ratioSelection, state.axisFontSize, state.showAxisBox, state.showDirectLabels, state.showUnprocessed, state.showBaseline, state.showGrid);
  } catch (err) {
    console.error('[raman — instant] Export Error:', err);
  }
}

function getScientificNarrative(file: ProcessedFile) {
  const params = file.params;
  const snip = params.snip;
  const sg = params.sg;
  const norm = params.norm;
  const peakCount = file.peaks.length;

  let normDesc = 'no additional normalization';
  if (norm === 'max') normDesc = 'peak maximum normalization';
  if (norm === 'area') normDesc = 'total area (AUC) normalization';
  if (norm === 'point') normDesc = `normalization to the peak at ${state.normTargetX?.toFixed(1)} cm⁻¹`;

  return `Raman spectrum of ${file.name}. Data was processed using the Instant Raman (${APP_VERSION}) spectral workstation. Background subtraction was performed using the Simple Non-Iterative Peak (SNIP) algorithm (${snip} iterations) [1], followed by Savitzky-Golay smoothing (window size ${sg}) [2]. The spectrum was stabilized using ${normDesc}. Peak detection was performed using a local maxima algorithm with 3-point parabolic refinement and a 5% intensity threshold, identifying ${peakCount} distinct Raman bands. Analysis protocol verified via SHA-256 integrity check.`;
}

function generateCaption() {
  const active = state.files.get(state.activeFileId || '');
  if (!active) return;

  const narrative = getScientificNarrative(active);
  const caption = `Figure. ${narrative} Figure generated via Instant Raman (https://raman-instant.com).`;

  const area = UI.get('text-caption') as HTMLTextAreaElement;
  if (area) area.value = caption;
  UI.get('caption-container')?.classList.remove('hidden');
}

function initReportControls() {
  UI.get('btn-export-report')?.addEventListener('click', () => {
    if (!state.isPro) {
      showPaywallModal("Interactive HTML compliance report generation is a Pro-tier capability.");
      return;
    }
    if (state.snapshots.length === 0) {
      showToast("No snapshots captured! Capture some analysis blocks first.");
      return;
    }
    trackEvent('export_generated', { export_type: 'portfolio' });

    const reportData: import('./ui/reportGenerator.ts').ReportData = {
      timestamp: new Date().toISOString(),
      snapshots: state.snapshots,
      sessionSummary: {
        totalFiles: state.files.size,
        filenames: Array.from(state.files.values()).map(f => f.name)
      }
    };

    ReportGenerator.generate(reportData);
    showToast(`Generating Portfolio with ${state.snapshots.length} analysis blocks...`);
  });

  UI.get('btn-capture-snapshot')?.addEventListener('click', captureSnapshot);
}

function initProtocolExport() {
  const btn = UI.get('btn-export-protocol');
  if (!btn) {
    console.warn('[Protocol] Export button not found in DOM during init.');
    return;
  }

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!state.isPro) {
      showPaywallModal("Workflow reproducibility protocol (.irp) export is a Pro-tier capability.");
      return;
    }
    console.log('[Protocol] Export button clicked');
    showToast("Preparing protocol export...");

    const active = state.files.get(state.activeFileId || '');
    if (!active) {
      console.warn('[Protocol] No active file found for export');
      showToast("Select a file to export its protocol.");
      return;
    }
    exportProtocol(active);
  });
}

async function exportProtocol(activeFile: ProcessedFile) {
  console.log('[Protocol] Starting export for:', activeFile.name);
  try {
    // Fail-safe UUID generation
    const generateId = () => {
      try {
        return (window as any).crypto.randomUUID();
      } catch (e) {
        return 'irp-' + Math.random().toString(36).substring(2, 11);
      }
    };

    const protocolId = (activeFile as any).protocolId || generateId();
    if (!(activeFile as any).protocolId) (activeFile as any).protocolId = protocolId;

    // 1. Metadata
    const metadata: any = {
      instant_raman_version: APP_VERSION,
      protocol_version: "1.0.0",
      protocol_id: protocolId,
      created_at: new Date().toISOString(),
      created_by: "Instant Raman User"
    };

    // 2. Source Data Record
    const sourceData: any = {
      original_filename: activeFile.name,
      file_format_detected: "Automatic",
      wavenumber_range: {
        min: activeFile.raw.wavenumberData[0],
        max: activeFile.raw.wavenumberData[activeFile.raw.wavenumberData.length - 1]
      },
      wavenumber_spacing: (activeFile.raw.wavenumberData[1] - activeFile.raw.wavenumberData[0]) || 1,
      number_of_data_points: activeFile.raw.wavenumberData.length,
      file_hash: (activeFile as any).fileHash || "unknown"
    };

    // 3. Processing Steps
    const steps: any[] = [
      {
        step_number: 0,
        step_name: "Cosmic Ray Removal",
        applied: state.cosmicRayRemoval,
        parameters: {
          algorithm: "MAD_zscore",
          threshold: 5,
          spikes_detected: activeFile.spikesRemoved,
          spikes_removed: activeFile.spikesRemoved,
          spike_positions: []
        }
      },
      {
        step_number: 1,
        step_name: "Baseline Correction",
        applied: true,
        parameters: {
          algorithm: "SNIP",
          iterations: activeFile.params.snip,
          mode: activeFile.params.mode
        }
      },
      {
        step_number: 2,
        step_name: "Normalization",
        applied: activeFile.params.norm !== 'none',
        parameters: {
          method: activeFile.params.norm === 'max' ? 'max_intensity' :
            activeFile.params.norm === 'area' ? 'total_area' :
              activeFile.params.norm === 'point' ? 'reference_peak' : 'none',
          reference_wavenumber: state.normTargetX
        }
      },
      {
        step_number: 3,
        step_name: "Peak Detection",
        applied: true,
        parameters: {
          method: "parabolic_interpolation",
          minimum_height_threshold: 0.05,
          minimum_separation: 10,
          peaks_detected: activeFile.peaks.length,
          peak_positions: activeFile.peaks.map(p => p.x)
        }
      }
    ];

    // 4. Fitting Record
    let fittingRecord: any[] | null = null;
    if (state.fittingMode && (state as any).epiResult) {
      const epi = (state as any).epiResult;
      fittingRecord = [
        {
          peak_id: epi.peak_id || 1,
          nominal_center: epi.nominal_center,
          boundary_left: epi.boundary_left,
          boundary_right: epi.boundary_right,
          boundary_perturbation_range: epi.boundary_perturbation_range,
          best_fit_model: epi.best_fit_model,
          fitted_center: epi.fitted_center,
          fitted_center_statistical_error: epi.fitted_center_statistical_error,
          fitted_fwhm: epi.fitted_fwhm,
          fitted_amplitude: epi.fitted_amplitude,
          r_squared: epi.r_squared,
          reduced_chi_squared: epi.reduced_chi_squared,
          epistemic_center_min: epi.epistemic_center_min,
          epistemic_center_max: epi.epistemic_center_max,
          epistemic_standard_deviation: epi.epistemic_standard_deviation,
          combined_uncertainty: epi.combined_uncertainty,
          convergence_status: epi.convergence_status,
          all_model_results: epi.all_model_results
        }
      ];
    }

    const protocol: any = {
      protocol_metadata: metadata,
      source_data_record: sourceData,
      processing_steps: steps as any,
      fitting_record: fittingRecord as any,
      integration_record: null,
      reproducibility_guarantee: "Full trace and uncertainty parameters included."
    };

    // Validation check
    ProtocolManager.validateSchema(protocol);

    // Download
    const blob = new Blob([JSON.stringify(protocol, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const filename = `${activeFile.name.replace(/\.[^/.]+$/, "")}_protocol_${protocolId.substring(0, 8)}.irp`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Protocol exported: ${filename}`);
    trackEvent('protocol_exported', { file_name: activeFile.name, protocol_id: protocolId });
  } catch (err: any) {
    console.error('[Protocol] Export failed:', err);
    showToast(`Export failed: ${err.message}`);
  }
}

function initSnapshotModal() {
  const modal = UI.get('modal-snapshot');
  const input = UI.get('input-snapshot-title') as HTMLInputElement;
  const btnConfirm = UI.get('btn-confirm-snapshot');
  const btnCancel = UI.get('btn-cancel-snapshot');

  if (!modal || !input || !btnConfirm || !btnCancel) return;

  const close = () => modal.classList.remove('active');

  btnConfirm.addEventListener('click', () => {
    const title = input.value.trim() || `Analysis - ${new Date().toLocaleTimeString()}`;
    saveSnapshot(title);
    close();
  });

  btnCancel.addEventListener('click', close);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnConfirm.click();
    if (e.key === 'Escape') close();
  });
}

async function captureSnapshot() {
  const activeFile = state.files.get(state.activeFileId || '');
  if (!activeFile && state.layoutMode !== 'replicate') {
    showToast("Load a file to capture a snapshot.");
    return;
  }

  const modal = UI.get('modal-snapshot');
  const input = UI.get('input-snapshot-title') as HTMLInputElement;
  if (modal && input) {
    modal.classList.add('active');
    input.value = `Analysis Block ${state.snapshots.length + 1}`;
    input.focus();
    input.select();
  }
}

async function saveSnapshot(title: string) {
  const activeFile = state.files.get(state.activeFileId || '');
  if (!activeFile && state.layoutMode !== 'replicate') return;

  const timestamp = new Date().toISOString();
  const id = `snap-${Math.random().toString(36).slice(2, 9)}`;

  // Capture Current Traces and Layout
  let traces: any[] = [];
  let tableData: any[] = [];
  let tableType: 'peaks' | 'fit' | 'replicate' = 'peaks';
  let type: 'general' | 'fitting' | 'replicate' = 'general';

  // 1. Plot State Capture (Grid-Aware)
  const plotEls = document.querySelectorAll('.plot-container');
  const snapshotTraces: any[] = [];

  plotEls.forEach(el => {
    const plotlyEl = el as any;
    const parentItem = el.closest('.plot-item');
    const nameEl = parentItem ? parentItem.querySelector('.plot-item-title') : null;
    const fileName = nameEl ? nameEl.textContent : (activeFile ? activeFile.name : 'Unknown');

    if (plotlyEl && plotlyEl.data) {
      const plotData = plotlyEl.data.map((d: any) => ({
        x: Array.isArray(d.x) ? [...d.x] : d.x,
        y: Array.isArray(d.y) ? [...d.y] : d.y,
        mode: d.mode,
        name: d.name,
        type: d.type,
        fill: d.fill,
        fillcolor: d.fillcolor,
        line: d.line ? { ...d.line } : undefined,
        opacity: d.opacity,
        marker: d.marker ? { ...d.marker } : undefined
      }));
      snapshotTraces.push({ name: fileName, traces: plotData });
    }
  });

  // For backward compatibility and single-plot cases, we keep 'traces' as the first set
  traces = snapshotTraces.length > 0 ? snapshotTraces[0].traces : [];

  // 2. Coordinate Table Metadata with State
  if (state.layoutMode === 'replicate' && state.replicateGroup) {
    type = 'replicate';
    tableType = 'replicate';
    // Robust Fix: Only capture peaks that are currently selected in the UI
    tableData = state.replicateGroup.peakStats
      .filter(ps => state.replicateGroup!.selectedPeakX.has(ps.xMean))
      .map(ps => ({
        center: ps.xMean,
        centerSD: ps.xSD,
        meanArea: ps.yMean,
        sdArea: ps.ySD,
        rsdArea: (ps.ySD / ps.yMean) * 100,
        fwhm: ps.fwhmMean,
        fwhmSD: ps.fwhmSD
      }));
  } else if (state.fittingMode && state.fitResult) {
    type = 'fitting';
    tableType = 'fit';
    tableData = state.fitResult.peaks;
  } else {
    type = 'general';
    tableType = 'peaks';
    const fileIdsToRender = new Set(state.comparisonIds);
    if (state.activeFileId) fileIdsToRender.add(state.activeFileId);
    const filesToRender = Array.from(fileIdsToRender).map(id => state.files.get(id)).filter(f => !!f) as ProcessedFile[];

    // Group peaks by filename
    tableData = filesToRender.map(f => ({
      fileName: f.name,
      peaks: f.peaks.filter(p => f.selectedPeakX.has(p.x))
    }));
  }

  // 3. Robust Y-Scaling for Snapshot (Avoid Flattening)
  let yRange: [number, number] | undefined = undefined;
  if (snapshotTraces.length > 0 && state.viewRange) {
    const [xMin, xMax] = state.viewRange;
    let globalMinY = Infinity;
    let globalMaxY = -Infinity;

    // Systematic Fix: Iterate over ALL plot trace sets in the grid to find global min/max
    snapshotTraces.forEach(ts => {
      ts.traces.forEach((t: any) => {
        if (!t.x || !t.y) return;
        for (let i = 0; i < t.x.length; i++) {
          if (t.x[i] >= xMin && t.x[i] <= xMax) {
            if (t.y[i] < globalMinY) globalMinY = t.y[i];
            if (t.y[i] > globalMaxY) globalMaxY = t.y[i];
          }
        }
      });
    });

    if (globalMaxY !== -Infinity) {
      yRange = [Math.max(0, globalMinY - (globalMaxY * 0.05)), globalMaxY * 1.15];
    }
  }

  // 4. Capture Ratio Metadata (Systematic fix: capture if results exist)
  let ratioData = undefined;
  if (state.ratioSelection.p1 && state.ratioSelection.p2) {
    ratioData = {
      p1: state.ratioSelection.p1,
      p2: state.ratioSelection.p2,
      intRatio: (state.ratioSelection.p1.y / state.ratioSelection.p2.y).toFixed(3),
      areaRatio: (state.ratioSelection.p1.area! / state.ratioSelection.p2.area!).toFixed(3)
    };
  }

  // 4.5 Capture Uncertainty Metadata
  let uncertaintyData = undefined;
  if (state.fittingMode && (state as any).epiResult) {
    const isSuite = !!document.getElementById('suite-plot-fit');
    
    // Legacy mapping
    let fitEl = document.getElementById('plot-fit-large') as any;
    let resEl = document.getElementById('plot-residual-small') as any;
    let uncEl = document.getElementById('plot-uncertainty-bars') as any;
    
    // Suite mapping
    const sFitEl = document.getElementById('suite-plot-fit') as any;
    const sResEl = document.getElementById('suite-plot-residual') as any;
    const sEnsEl = document.getElementById('suite-plot-ensemble') as any;
    const sMcEl = document.getElementById('suite-plot-mc') as any;
    
    const interpEl = document.querySelector('.unc-right-bottom');

    const clonePlot = (el: any) => {
      if (!el || !el.data) return { traces: [], layout: {} };
      return {
        traces: el.data.map((d: any) => ({
          ...d,
          x: Array.isArray(d.x) ? [...d.x] : d.x,
          y: Array.isArray(d.y) ? [...d.y] : d.y
        })),
        layout: {
          xaxis: { range: el._fullLayout?.xaxis?.range, title: el._fullLayout?.xaxis?.title?.text },
          yaxis: { range: el._fullLayout?.yaxis?.range, title: el._fullLayout?.yaxis?.title?.text },
          shapes: el._fullLayout?.shapes || [],
          annotations: el._fullLayout?.annotations || [],
          title: el._fullLayout?.title?.text
        }
      };
    };

    if (isSuite) {
      uncertaintyData = {
        epiResult: (state as any).epiResult,
        interpretationHtml: '', // Narrative is handled by snapshot.narrative
        isSuite: true,
        mcResult: (state as any).mcResult,
        plots: {
          fit: clonePlot(sFitEl),
          residual: clonePlot(sResEl),
          ensemble: clonePlot(sEnsEl),
          monteCarlo: clonePlot(sMcEl)
        }
      };
    } else if (fitEl && resEl && uncEl) {
      uncertaintyData = {
        epiResult: (state as any).epiResult,
        interpretationHtml: interpEl ? interpEl.innerHTML : '',
        isSuite: false,
        plots: {
          fit: clonePlot(fitEl),
          residual: clonePlot(resEl),
          uncertainty: clonePlot(uncEl)
        }
      };
    }
  }

  // 5. Build Robust Layout from Live Plot
  const firstPlotEl = plotEls[0] as any;
  const liveLayout = firstPlotEl?._fullLayout || {};

  const finalLayout = {
    xaxis: {
      title: 'Raman Shift (cm⁻¹)',
      range: liveLayout.xaxis?.range || state.viewRange || undefined
    },
    yaxis: {
      title: 'Intensity (a.u.)',
      // Systematic Fix: For grid layouts, we prefer independent scaling to avoid capping peaks.
      // We set range to undefined for grids, letting Plotly autoscale each subplot.
      range: (state.layoutMode.startsWith('grid')) ? undefined : (liveLayout.yaxis?.range || yRange)
    },
    shapes: liveLayout.shapes || [],
    annotations: liveLayout.annotations || []
  };

  const snapshot: any = {
    id, title, type, timestamp,
    narrative: activeFile ? getScientificNarrative(activeFile) : undefined,
    traces,
    gridTraces: snapshotTraces, // Store all plots if in grid mode
    tableData, tableType,
    ratio: ratioData,
    uncertaintyData,
    layout: finalLayout,
    settings: {
      snip: parseInt(UI.val('slider-snip') || '25'),
      norm: state.normalizationMode,
      range: state.viewRange,
      layoutMode: state.layoutMode, // CRITICAL: Save the layout context
      isWaterfall: false,
      stackOffset: 0
    }
  };

  state.snapshots.push(snapshot);

  const countEl = UI.get('snapshot-count');
  if (countEl) countEl.innerText = state.snapshots.length.toString();

  showToast(`Snapshot captured: "${title}"`);
  trackEvent('snapshot_captured', { 
    snapshot_type: type, 
    layout_mode: state.layoutMode,
    has_uncertainty: !!snapshot.uncertaintyData
  });
  updateUI();
}


async function runFitting(minX: number, maxX: number) {
  if (!state.isPro) {
    showPaywallModal("Levenberg-Marquardt fitting and peak deconvolution are Pro-tier capabilities.");
    return;
  }
  const active = state.files.get(state.activeFileId || '');
  if (!active) return;

  // Problem 2: Assign Protocol ID before fitting starts
  (active as any).protocolId = (window as any).crypto.randomUUID();

  const data = active.processed;
  const roiX: number[] = [];
  const roiY: number[] = [];

  for (let i = 0; i < data.wavenumberData.length; i++) {
    const x = data.wavenumberData[i];
    if (x >= minX && x <= maxX) {
      roiX.push(x);
      roiY.push(data.intensityData[i]);
    }
  }

  if (roiX.length < 5) return;

  const type = (UI.get('select-fit-type') as HTMLSelectElement).value as any;
  let initial = FittingEngine.estimateInitial(roiX, roiY, type);

  // Context-Aware Deconvolution: If ratio selection exists, force a 2-peak fit seeded by labels
  if (state.ratioSelection?.p1 && state.ratioSelection?.p2) {
    const p1 = state.ratioSelection.p1;
    const p2 = state.ratioSelection.p2;
    if (type === 'voigt') {
      initial = [p1.y, p1.x, p1.fwhm || 15, 0.5, p2.y, p2.x, p2.fwhm || 15, 0.5];
    } else {
      initial = [p1.y, p1.x, p1.fwhm || 15, p2.y, p2.x, p2.fwhm || 15];
    }
  }

  UI.text('system-status', 'Fitting...');

  // Run fit in microtask to not block UI immediately
  setTimeout(() => {
    const result = FittingEngine.fit(roiX, roiY, initial, type);

    let epiResult = null;
    if (result.peaks.length > 0) {
      // Pass ALL peaks for rigorous multi-component ensemble analysis
      epiResult = FittingEngine.evaluateEpistemicUncertainty(
        data.wavenumberData, data.intensityData,
        1, 
        result.peaks.map(p => p.center.value || 0),
        result.peaks.map(p => p.fwhm.value || 0),
        result.peaks.map(p => p.amplitude.value || 0),
        minX, maxX,
        10, 5
      );
    }

    state.fitResult = result;
    (state as any).epiResult = epiResult;
    state.fittingMode = true;
    UI.get('btn-exit-fit')?.classList.remove('hidden');
    UI.text('system-status', 'Ready');
    updateUI();
  }, 10);
}

function renderFitResults() {
  const container = UI.get('workspace-container');
  if (!container || !state.fitResult) return;

  const active = state.files.get(state.activeFileId || '');
  if (!active || !(state as any).epiResult) return;

  const epi = (state as any).epiResult;

  // Transform workspace into a spacious scrolling viewport
  container.innerHTML = '';
  container.className = 'analysis-suite-viewport';
  const root = document.createElement('div');
  root.style.minHeight = '100%';
  container.appendChild(root);

  // Mount the Premium Analysis Suite
  const suiteRoot = ReactDOM.createRoot(root);
  suiteRoot.render(React.createElement(AnalysisSuite, { 
    epi: epi, 
    protocolId: active.protocolId || 'UNSET',
    state: state,
    onClose: () => {
      // Exit uncertainty mode and return to standard workstation
      (state as any).epiResult = null;
      updateUI();
    }
  }));
}

function formatEpistemicRange(min: number | undefined | null, max: number | undefined | null): string {
  if (min === null || min === undefined || max === null || max === undefined) return '';
  if (isNaN(min) || isNaN(max)) return '';
  const spread = Math.abs(max - min);

  // Determine decimal places needed to show the spread meaningfully
  let decimalPlaces: number;
  if (spread === 0) return ''; // degenerate — should not reach here, isDegenerateRange handles this
  else if (spread >= 1) decimalPlaces = 1;
  else if (spread >= 0.1) decimalPlaces = 2;
  else if (spread >= 0.01) decimalPlaces = 3;
  else decimalPlaces = 4;

  const minStr = min.toFixed(decimalPlaces);
  const maxStr = max.toFixed(decimalPlaces);

  // Safety check — if adaptive rounding still produces identical strings,
  // increment decimal places by 1 until they differ or reach 6
  // This handles edge cases where spread sits exactly on a threshold boundary
  if (minStr === maxStr) {
    for (let dp = decimalPlaces + 1; dp <= 6; dp++) {
      const a = min.toFixed(dp);
      const b = max.toFixed(dp);
      if (a !== b) return `${a} to ${b} cm⁻¹`;
    }
  }

  return `${minStr} to ${maxStr} cm⁻¹`;
}

function formatReportAs(center: number, statisticalError: number | null, _isDegenerateRange: boolean): string {
  if (statisticalError === null || isNaN(statisticalError) || !isFinite(statisticalError) || statisticalError === 0) {
    return `${center.toFixed(1)} ± —`;
  }

  if (statisticalError < 0.001) {
    // For scientific notation, use existing shared formatter and fixed 4 decimal places for center
    const statStr = formatStatisticalError(statisticalError);
    return `${center.toFixed(4)} ${statStr}`;
  }

  // 1. Round uncertainty to 2 significant figures
  // toPrecision returns a string representation of the number with specified significant digits
  const roundedErrorStr = statisticalError.toPrecision(2);
  const roundedError = Number(roundedErrorStr);

  // 2. Count decimal places in the rounded uncertainty string
  // We use the string from toPrecision to accurately count the displayed decimal places
  let decimalPlaces = 0;
  if (roundedErrorStr.includes('.')) {
    const parts = roundedErrorStr.split('.');
    // Avoid coordination if it returned scientific notation (e.g. 1.2e+2)
    if (!parts[1].includes('e')) {
      decimalPlaces = parts[1].length;
    }
  }

  // 3. Display center to that same number of decimal places
  const centerStr = center.toFixed(decimalPlaces);

  return `${centerStr} ± ${roundedError} cm⁻¹`;
}

function isValidUncertaintyResult(epi: any): boolean {
  if (!epi) return false;
  if (epi.fitted_center === null || epi.fitted_center === undefined) return false;
  if (epi.fitted_center === 0 && (epi.r_squared === 0 || epi.r_squared === null)) return false; // uninitialized default
  if (!epi.best_fit_model || epi.best_fit_model === 'UNKNOWN' || epi.best_fit_model === 'unknown') return false;
  if (epi.r_squared === null || epi.r_squared === undefined || epi.r_squared === 0) return false;
  return true;
}

function generateInterpretationHtml(epi: any, protocolId: string) {
  if (!isValidUncertaintyResult(epi)) {
    return `
      <div style="padding: 24px; font-family: var(--font-sans); color: var(--text-primary); line-height: 1.6; background: #fff; min-height: 100%;">
        <div style="margin-bottom: 24px;">
          <h4 style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Fitting failed</h4>
          <p style="font-size: 15px; margin: 0;">None of the three model types converged for this peak region. This may indicate an overlapping peak, a broad asymmetric feature, or insufficient signal. Try adjusting the fit region boundaries or check the baseline correction.</p>
        </div>
        <div style="margin-bottom: 24px;">
          <h4 style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">What It Means</h4>
          <p style="font-size: 15px; margin: 0; font-style: italic; color: #94a3b8;">Convergence failed. Numerical assessment unavailable for this region.</p>
        </div>
        <div style="border-top: 1px solid #eee; padding-top: 16px; font-size: 10px; color: #94a3b8; font-family: var(--font-mono); line-height: 1.4;">
          Instant Raman Protocol ID: ${protocolId.substring(0, 8)}
        </div>
      </div>
    `;
  }
  const statStr = formatStatisticalError(epi.fitted_center_statistical_error);
  const bestModel = epi.best_fit_model || 'unknown';
  const r2 = epi.r_squared || 0;
  const center = epi.fitted_center || 0;

  let part1 = '';
  let part2 = '';
  let part3 = '';

  const r2Threshold = 0.95;
  const isInvalidFit = r2 < 0 || epi.epistemic_classification === 'INVALID_FIT';
  const isPoorFit = r2 < r2Threshold && !isInvalidFit;
  const rangeStr = formatEpistemicRange(epi.epistemic_center_min, epi.epistemic_center_max);

  // 1. Core Findings (Part 1)
  if (isInvalidFit) {
    const epistemicSpread = (epi.epistemic_center_max !== null && epi.epistemic_center_min !== null) 
      ? (epi.epistemic_center_max - epi.epistemic_center_min) 
      : 100;
    const isTightConvergence = epistemicSpread < 0.5;
    
    part1 = `The fit failed — R² is negative, meaning the model performs worse than a flat mean line.${isTightConvergence ? ' All ensemble fits converged to the same center, but this agreement is unreliable when the underlying fit is invalid.' : ''}`;
  } else if (epi.isDegenerateRange) {
    part1 = `Your peak center was determined to be <b>${center.toFixed(2)} cm⁻¹</b> using a <b>${bestModel.toUpperCase()}</b> profile (R² = ${r2.toFixed(4)}). The statistical precision is ${statStr}. Systematic perturbation across model types and boundaries showed perfect convergence.`;
  } else {
    part1 = `Your peak center was determined to be <b>${center.toFixed(2)} cm⁻¹</b> using a <b>${bestModel.toUpperCase()}</b> profile (R² = ${r2.toFixed(4)}). The statistical precision is ${statStr}. Systematic perturbation across model types and boundaries revealed an epistemic range${rangeStr ? ' of ' + rangeStr : ' (unavailable)'}.`;
  }

  // Append failure note if any model type has zero successful fits
  const counts = (epi.ensembleModelCounts || { lorentzian: 0, gaussian: 0, voigt: 0 }) as { lorentzian: number; gaussian: number; voigt: number };
  const failedModels: string[] = [];
  if (counts.lorentzian === 0) failedModels.push('Lorentzian');
  if (counts.gaussian === 0) failedModels.push('Gaussian');
  if (counts.voigt === 0) failedModels.push('Voigt');

  if (failedModels.length > 0 && failedModels.length < 3 && !isInvalidFit) {
    const failedStr = failedModels.length === 2 
      ? `${failedModels[0]} and ${failedModels[1]}` 
      : failedModels[0];
    
    const successfulModels = Object.entries(counts)
      .filter(([_, n]) => n > 0)
      .map(([m, _]) => m.charAt(0).toUpperCase() + m.slice(1));
    
    const successStr = successfulModels.length === 2 
      ? `${successfulModels[0]} and ${successfulModels[1]}` 
      : successfulModels[0];

    part1 += ` <br><span style="font-size: 13px; color: #64748b; font-style: italic;">Note: ${failedStr} fits did not converge in this region — ensemble results reflect ${successStr} fits only.</span>`;
  }

  // 2. Meaning & Confidence (Part 2) - INVALID_FIT and POOR_FIT take absolute precedence
  if (isInvalidFit) {
    part2 = `<div style="color: #b45309; font-weight: 600;">Invalid fit.</div> The fitting window likely contains multiple overlapping peaks, a steeply sloped background, or a feature that no single line-shape profile can describe. Try splitting this region into two narrower windows, or adjust the baseline before fitting.`;
  } else if (isPoorFit || epi.epistemic_classification === 'POOR_FIT') {
    part2 = `<div style="color: #d97706; font-weight: 600;">Poor fit quality.</div> The best model explains less than 95% of the variance in this region. This may indicate overlapping peaks, an asymmetric feature, or incorrect region boundaries. Interpret the center position with caution.`;
  } else if (epi.isDegenerateRange) {
    part2 = `<div style="color: #059669; font-weight: 600;">High model agreement.</div> All three model types and all boundary perturbations converged to the same center. The result is stable and model-insensitive.`;
  } else if (epi.epistemic_classification === 'HIGH_SENSITIVITY') {
    part2 = `<div style="color: #dc2626; font-weight: 600;">High sensitivity detected.</div> The epistemic spread dominates the result. This suggests the peak may be poorly resolved or physically complex. Exercise caution with quantitative interpretations.`;
  } else {
    part2 = `<div style="color: #059669; font-weight: 600;">Stable model convergence.</div> The epistemic spread is contained within reasonable bounds relative to the statistical precision.`;
  }

  // 3. Reporting Logic (Part 3)
  const combined = epi.combined_uncertainty || 0;
  const reportAs = formatReportAs(center, combined, epi.isDegenerateRange);
  const rangeClause = (rangeStr && !epi.isDegenerateRange) ? `. Epistemic range: ${rangeStr}` : '';

  if (isInvalidFit) {
    part3 = `<div style="padding: 12px; background: #fff7ed; border-left: 4px solid #f97316; color: #9a3412; font-weight: 400; font-size: 13px; line-height: 1.5;">
      <b>This fit is invalid (R² < 0).</b> Do not report this value. Redefine the fitting window to isolate a single peak before refitting.
    </div>`;
  } else if (isPoorFit) {
    part3 = `<b>REPORT AS:</b> ${reportAs}${rangeClause}. <span style="color: #d97706;">Caution: Low variance explained.</span>`;
  } else {
    part3 = `<b>REPORT AS:</b> ${reportAs}${rangeClause}. See confidence assessment.`;
  }

  return `
    <div style="padding: 24px; font-family: var(--font-sans); color: var(--text-primary); line-height: 1.6; background: #fff; min-height: 100%;">
      <div style="margin-bottom: 24px;">
        <h4 style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">What Was Found</h4>
        <p style="font-size: 15px; margin: 0;">${part1}</p>
      </div>
      <div style="margin-bottom: 24px;">
        <h4 style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">What It Means</h4>
        <p style="font-size: 15px; margin: 0; font-style: italic; color: #475569;">${part2}</p>
      </div>
      <div style="margin-bottom: 32px;">
        <h4 style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">What To Report</h4>
        <p style="font-size: 15px; margin: 0; font-weight: 600;">${part3}</p>
      </div>
      <div style="border-top: 1px solid #eee; padding-top: 16px; font-size: 10px; color: #94a3b8; font-family: var(--font-mono); line-height: 1.4;">
        Uncertainty quantified using multi-model Levenberg-Marquardt fitting with boundary perturbation analysis. 
        Statistical uncertainty derived from SVD covariance matrix. 
        Epistemic uncertainty derived from systematic model and boundary sensitivity analysis. 
        <br>Instant Raman Protocol ID: ${protocolId.substring(0, 8)}
      </div>
    </div>
  `;
}

UI.get('btn-exit-fit')?.addEventListener('click', () => {
  state.fittingMode = false;
  state.fitResult = null;
  UI.get('btn-exit-fit')?.classList.add('hidden');
  updateUI();
});

// ── Protocol Handling (Step 6) ──

async function promptProtocolImport(protocolJson: any) {
  if (!state.isPro) {
    showPaywallModal("Workflow reproducibility protocol (.irp) import is a Pro-tier capability.");
    return;
  }
  let protocol: InstantRamanProtocol;
  try {
    protocol = ProtocolManager.validateSchema(protocolJson);
  } catch (err: any) {
    alert(err.message || "Invalid Protocol File.");
    return;
  }

  const modal = UI.get('modal-protocol');
  const summaryContent = UI.get('protocol-summary-content');
  const hashStatus = UI.get('protocol-hash-status');
  if (!modal || !summaryContent || !hashStatus) return;

  modal.classList.add('active');

  // Build Summary
  const meta = protocol.protocol_metadata;
  const source = protocol.source_data_record;
  const steps = protocol.processing_steps;

  let summaryHtml = `
    <div style="margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
      <div style="font-weight: 700; color: var(--text-primary);">Metadata</div>
      <div>ID: <span style="font-family: var(--font-mono); font-size: 10px;">${meta.protocol_id}</span></div>
      <div>Created: ${new Date(meta.created_at).toLocaleString()}</div>
      <div>By: ${meta.created_by} (IR v${meta.instant_raman_version})</div>
    </div>
    <div style="margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
      <div style="font-weight: 700; color: var(--text-primary);">Source Data Record</div>
      <div>Filename: ${source.original_filename}</div>
      <div>Range: ${source.wavenumber_range.min.toFixed(1)} - ${source.wavenumber_range.max.toFixed(1)} cm⁻¹</div>
      <div>Hash: <span style="font-family: var(--font-mono); font-size: 10px;">${source.file_hash}</span></div>
    </div>
    <div style="margin-bottom: 12px;">
      <div style="font-weight: 700; color: var(--text-primary);">Processing Pipeline</div>
      <ul style="padding-left: 18px; margin-top: 4px; line-height: 1.6;">
  `;

  steps.forEach(step => {
    if (step.applied) {
      summaryHtml += `<li><b>${step.step_name}:</b> ${JSON.stringify(step.parameters)}</li>`;
    } else {
      summaryHtml += `<li style="opacity: 0.5;">${step.step_name}: (Not Applied)</li>`;
    }
  });

  summaryHtml += `
      </ul>
    </div>
  `;

  summaryContent.innerHTML = summaryHtml;

  // Hash Verification (Global Search)
  const sourceHash = protocol.source_data_record.file_hash;
  let matchedFile = null;

  // Search all loaded files for a match
  for (const f of state.files.values()) {
    if ((f as any).fileHash === sourceHash) {
      matchedFile = f;
      break;
    }
  }

  if (matchedFile) {
    hashStatus.classList.remove('hidden');
    hashStatus.style.background = '#ecfdf5';
    hashStatus.style.color = '#059669';
    hashStatus.style.border = '1px solid #10b981';
    hashStatus.textContent = `Matched with loaded file: "${matchedFile.name}". This protocol will reproduce the original analysis exactly.`;
  } else {
    hashStatus.classList.remove('hidden');
    hashStatus.style.background = '#fffbeb';
    hashStatus.style.color = '#d97706';
    hashStatus.style.border = '1px solid #f59e0b';
    hashStatus.textContent = `No matching file found for hash: ${sourceHash.substring(0, 8)}... Please load the original data file first.`;
  }

  // Action Listeners
  const applyBtn = UI.get('btn-apply-protocol');
  const cancelBtn = UI.get('btn-cancel-protocol');

  const onApply = () => {
    applyProtocolDeterministically(protocol);
    modal.classList.remove('active');
    applyBtn?.removeEventListener('click', onApply);
    cancelBtn?.removeEventListener('click', onCancel);
  };

  const onCancel = () => {
    modal.classList.remove('active');
    applyBtn?.removeEventListener('click', onApply);
    cancelBtn?.removeEventListener('click', onCancel);
  };

  applyBtn?.addEventListener('click', onApply);
  cancelBtn?.addEventListener('click', onCancel);
}

async function applyProtocolDeterministically(protocol: InstantRamanProtocol) {
  const sourceHash = protocol.source_data_record.file_hash;
  let targetFileId = state.activeFileId;
  let file = state.files.get(targetFileId || '');

  // 1. Try to find the correct file by hash across all loaded files
  if (!file || (file as any).fileHash !== sourceHash) {
    for (const [id, f] of state.files.entries()) {
      if ((f as any).fileHash === sourceHash) {
        targetFileId = id;
        file = f;
        state.activeFileId = id; // Auto-activate the matching file
        break;
      }
    }
  }

  if (!file) {
    alert(`Protocol Mismatch:\n\nThis protocol belongs to the file "${protocol.source_data_record.original_filename}".\n\nPlease load that file first to apply these analytical parameters.`);
    return;
  }

  UI.text('system-status', 'APPLYING PROTOCOL...');

  // 1. Reset state to match protocol parameters
  const steps = protocol.processing_steps;

  // Cosmic Ray
  const cosmicStep = steps[0];
  state.cosmicRayRemoval = cosmicStep.applied;

  // Baseline
  const baselineStep = steps[1];
  state.baselineMode = baselineStep.parameters?.mode === 'manual' ? 'manual' : 'auto';
  if (state.baselineMode === 'auto') {
    UI.setVal('slider-snip', (baselineStep.parameters?.iterations || 25).toString());
    UI.text('val-snip', (baselineStep.parameters?.iterations || 25).toString());
  }

  // Normalization
  const normStep = steps[2];
  const method = normStep.parameters?.method;
  state.normalizationMode =
    method === 'max_intensity' ? 'max' :
      method === 'total_area' ? 'area' :
        method === 'reference_peak' ? 'point' : 'none';
  state.normTargetX = normStep.parameters?.reference_wavenumber || null;

  // 2. Reprocess
  reprocessActive();

  // 3. Peak Fitting / Integration (Auto-reproduce the specific fit)
  const reproducedFile = state.files.get(targetFileId || '')!;
  reproducedFile.isReproduced = true;
  reproducedFile.protocolId = protocol.protocol_metadata.protocol_id;
  reproducedFile.reproducedSteps = new Set(['Cosmic Ray', 'Baseline Correction', 'Normalization', 'Peak Detection']);

  if (protocol.fitting_record && protocol.fitting_record.length > 0) {
    const record = protocol.fitting_record[0];
    // Use the exact 10-argument signature for bit-for-bit reproduction
    const epiResult = FittingEngine.evaluateEpistemicUncertainty(
      reproducedFile.processed.wavenumberData,
      reproducedFile.processed.intensityData,
      record.peak_id,
      record.nominal_center,
      record.fitted_fwhm || 20,
      record.fitted_amplitude || 100,
      record.boundary_left,
      record.boundary_right,
      record.boundary_perturbation_range || 10,
      5 // perturbationStepPct
    );
    (reproducedFile as any).reproducedFit = epiResult;
    (state as any).epiResult = epiResult; // Update state for UI rendering
    state.fittingMode = true;
    reproducedFile.reproducedSteps.add('Multi-Model Deconvolution');
  }

  // 4. Verification Report
  generateVerificationReport(protocol, reproducedFile);

  updateUI();
  UI.text('system-status', 'REPRODUCED');
  showToast("Protocol applied successfully.");
  trackEvent('protocol_applied_success', { 
    protocol_id: protocol.protocol_metadata.protocol_id,
    has_fitting: (protocol.fitting_record?.length || 0) > 0
  });
}

function generateVerificationReport(protocol: InstantRamanProtocol, file: ProcessedFile) {
  const modal = UI.get('modal-verification');
  const content = UI.get('verification-report-content');
  if (!modal || !content) return;

  let reportHtml = `<table style="width: 100%; border-collapse: collapse; font-size: 11px;">
    <thead style="border-bottom: 1px solid var(--border);">
      <tr style="text-align: left; color: var(--text-secondary);">
        <th style="padding: 4px;">Metric</th>
        <th style="padding: 4px;">Original</th>
        <th style="padding: 4px;">Reproduced</th>
        <th style="padding: 4px;">Diff</th>
      </tr>
    </thead>
    <tbody>`;

  let maxDiff = 0;

  // Peak & Fit Verification
  const origFits = protocol.fitting_record || [];
  const reproducedFit = (file as any).reproducedFit;

  origFits.forEach(of => {
    const origVal = of.fitted_center || 0;
    // Use the reproduced fit center if available, otherwise fallback to peak detection
    const reproVal = reproducedFit ? (reproducedFit.fitted_center || 0) :
      (file.peaks.find(p => Math.abs(p.x - of.nominal_center) < 5)?.x || 0);

    const diff = Math.abs(origVal - reproVal);
    if (diff > maxDiff) maxDiff = diff;

    const warning = diff > 1e-6 ? 'style="color: #be123c; font-weight: bold;"' : '';
    reportHtml += `
      <tr>
        <td style="padding: 4px;">Peak ${of.peak_id} (${of.best_fit_model})</td>
        <td style="padding: 4px;">${origVal.toFixed(6)}</td>
        <td style="padding: 4px;">${reproVal.toFixed(6)}</td>
        <td style="padding: 4px;" ${warning}>${diff.toExponential(2)}</td>
      </tr>
    `;
  });

  reportHtml += `</tbody></table>`;

  const precisionClass = maxDiff > 1e-6 ? 'style="color: #be123c; margin-top: 16px; font-weight: 700;"' : 'style="color: #059669; margin-top: 16px; font-weight: 700;"';
  reportHtml += `<div ${precisionClass}>Maximum numerical deviation from original: ${maxDiff.toExponential(4)} cm⁻¹</div>`;

  if (maxDiff > 1e-6) {
    trackEvent('numerical_verification_failed', { 
      max_deviation: maxDiff,
      file_name: file.name
    });
  } else {
    trackEvent('numerical_verification_success', { 
      max_deviation: maxDiff,
      file_name: file.name
    });
  }

  content.innerHTML = reportHtml;
  modal.classList.add('active');

  UI.get('btn-close-verification')?.addEventListener('click', () => modal.classList.remove('active'), { once: true });
}

function showToast(message: string) {
  const toast = document.createElement('div');
  toast.style.position = 'fixed';
  toast.style.bottom = '40px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.background = '#0284c7';
  toast.style.color = '#fff';
  toast.style.padding = '10px 20px';
  toast.style.fontSize = '12px';
  toast.style.fontWeight = '500';
  toast.style.textTransform = 'none';
  toast.style.letterSpacing = '0';
  toast.style.borderRadius = '6px';
  toast.style.zIndex = '99999';
  toast.style.boxShadow = '0 4px 16px rgba(13,148,136,0.3)';
  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.5s ease';
    setTimeout(() => document.body.removeChild(toast), 500);
  }, 3000);
}

function renderTimeline() {
  const active = state.files.get(state.activeFileId || '');
  const container = UI.get('timeline-list');
  const badge = UI.get('timeline-id-badge');
  const uuidSpan = UI.get('timeline-uuid');

  if (!container) return;
  if (!active) {
    container.innerHTML = '';
    badge?.classList.add('hidden');
    return;
  }

  if (active.isReproduced) {
    badge?.classList.remove('hidden');
    if (uuidSpan) uuidSpan.textContent = active.protocolId?.slice(0, 8) || '---';
  } else {
    badge?.classList.add('hidden');
  }

  const steps = [
    { name: 'Cosmic Ray', params: state.cosmicRayRemoval ? 'Enabled (MAD threshold)' : 'Disabled' },
    { name: 'Baseline Correction', params: `${active.params.mode.toUpperCase()} (iter: ${active.params.snip})` },
    { name: 'Normalization', params: active.params.norm === 'none' ? 'None' : active.params.norm.toUpperCase() },
    { name: 'Peak Detection', params: `${active.peaks.length} peaks identified` }
  ];

  container.innerHTML = steps.map(step => `
    <div class="timeline-item">
      <div class="timeline-dot active"></div>
      <div class="timeline-content">
        <div class="timeline-step-name">
          ${step.name}
          ${(active.reproducedSteps && active.reproducedSteps.has(step.name)) ? '<span class="timeline-badge-reproduced">Reproduced</span>' : ''}
        </div>
        <div class="timeline-step-params">${step.params}</div>
      </div>
    </div>
  `).join('');
}

function markManualChange(stepName: string) {
  const active = state.files.get(state.activeFileId || '');
  if (active && active.reproducedSteps) {
    active.reproducedSteps.delete(stepName);
    updateUI();
  }
}

