import { importJob } from './parsers/workerClient.ts';
import type { ImportDocument } from './parsers/universalParser.ts';
import { LIMITS, checkBatch, checkSession } from './security/limits.ts';
import { escapeHTML } from './security/text.ts';
/**
 * Instant Raman v2.1 — Research Workstation Engine
 * Optimized for robustness, performance, and commercial reliability.
 */
const APP_VERSION = 'v2.2.0';
import { SpectralProcessor } from './engine/processor.ts';
import { UniversalParser } from './parsers/universalParser.ts';
import { createSampleSpectrumFile } from './engine/sampleSpectrum.ts';
import { previewImport } from './ui/importPreview.ts';
import { showImportDetails } from './ui/importDetails.ts';
import { ChartRenderer } from './ui/charts.ts';
import { exportFigure as exportRenderedFigure } from './ui/figureExport.ts';
import { WorkspaceStorage } from './ui/workspaceStorage.ts';
import { ReplicateEngine } from './engine/replicates.ts';
import type { ReplicateStats } from './engine/replicates.ts';
import { ReportGenerator } from './ui/reportGenerator.ts';
import { FittingEngine, type FitResult } from './engine/fitting.ts';
import type { NormalizedSpectrum, SpectralData, Peak, VarianceResult, NormalizationMode, CustomLabel } from './engine/types.ts';
import { ProtocolManager, type InstantRamanProtocol } from './engine/protocol.ts';
import * as XLSX from 'xlsx';

// ── Types ──
interface ProcessingSettings {
  snip: number;
  sg: number;
  clipNegative: boolean;
  mode: 'auto' | 'manual';
  norm: NormalizationMode;
  cosmic: boolean;
  normTarget: number | null;
}

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
  params: ProcessingSettings;
  anchors: { x: number; y: number }[];
  labels: CustomLabel[];
  color: string;
  fileHash?: string;
  isReproduced?: boolean;
  protocolId?: string;
  reproducedSteps?: Set<string>;
  fit?: FitResult;
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
  showUnprocessed: boolean;
  showBaseline: boolean;
  showGrid: boolean;
  cosmicRayRemoval: boolean;
  fitViewFileId: string | null;
  selectingROI: boolean;
  labelMode: boolean;
  freeLabelMode: boolean;
  pendingLabel: { x: number; y: number } | null;
  snapshots: import('./ui/reportGenerator.ts').Snapshot[];
  visibleTableFileId: string | null;
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
  showUnprocessed: false,
  showBaseline: false,
  showGrid: true,
  cosmicRayRemoval: true,
  fitViewFileId: null,
  selectingROI: false,
  labelMode: false,
  freeLabelMode: false,
  pendingLabel: null,
  snapshots: [],
  visibleTableFileId: null,
};

const emptyWorkspace = structuredClone(state);
let workspaceStorage: WorkspaceStorage<AppState> | undefined;
let workspaceWrites = Promise.resolve();
let workspaceSaveQueued = false;
let workspaceClearing = false;

const COLOR_PALETTE = ['#332288', '#88CCEE', '#44AA99', '#117733', '#999933', '#DDCC77', '#CC6677', '#882255'];

// ── Robust DOM Access ──
const UI = {
  get: (id: string) => document.getElementById(id),
  text: (id: string, val: string) => { const el = document.getElementById(id); if (el) el.textContent = val; },
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
initNavigation();
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

    const result = SpectralProcessor.siliconCalibrationCheck(active.raw);
    const container = UI.get('cal-status-container');
    const badge = UI.get('cal-badge');

    if (container && badge) {
      container.classList.remove('hidden');
      UI.text('cal-measured', result.measuredPeak > 0 ? `${result.measuredPeak} cm⁻¹` : 'N/A');
      UI.text('cal-offset', result.measuredPeak > 0 ? `${result.offset > 0 ? '+' : ''}${result.offset} cm⁻¹` : '---');

      badge.style.background = result.status === 'OK' ? '#059669' : result.status === 'DRIFTED' ? '#d97706' : '#be123c';
      badge.style.color = '#fff';
      badge.textContent = result.status === 'OK' ? 'WITHIN TOLERANCE' : result.status === 'DRIFTED' ? `OFFSET (${result.offset})` : 'NO Si PEAK';
    }
  });
}

function initUpload() {
  const protocolInput = UI.get('protocol-file-input') as HTMLInputElement | null;
  UI.get('btn-import-protocol')?.addEventListener('click', () => protocolInput?.click());
  protocolInput?.addEventListener('change', () => {
    if (protocolInput.files?.length) handleFiles(protocolInput.files);
    protocolInput.value = '';
  });
  window.addEventListener('sample-spectrum-requested', () => {
    if (workspaceClearing) return;
    importQueue = importQueue.then(async () => {
      try {
        const id = 'synthetic-demo-spectrum';
        if (!state.files.has(id)) {
          const file = createSampleSpectrumFile();
          const raw = await UniversalParser.parseFile(file);
          checkSession([...state.files.values()].reduce((n, f) => n + f.raw.wavenumberData.length, 0), state.files.size, raw.wavenumberData.length, 1);
          const hash = await ProtocolManager.computeHash(await file.arrayBuffer());
          storeProcessedSpectra([processSpectrum({ id, name: file.name, raw, fileHash: hash }, processingSettings())]);
        }
        selectSpectrum(id);
        updateUI();
        UI.text('system-status', 'READY');
        showToast('Synthetic demonstration spectrum loaded. This is not an experimental measurement.');
      } catch (error) {
        console.error('[Sample]', error);
        UI.text('system-status', 'SAMPLE_ERROR');
        showToast('Could not load sample data. Please try again.');
      }
    });
  });
  const input = UI.get('file-input') as HTMLInputElement;
  if (!input) return;
  input.addEventListener('change', () => {
    if (input.files?.length) handleFiles(input.files);
    input.value = '';
  });
}

let importQueue: Promise<void> = Promise.resolve();
let queuedFiles = 0, queuedBytes = 0;
function handleFiles(fileList: FileList) {
  if (workspaceClearing) {
    showToast('Wait for the workspace to finish clearing before importing.');
    return;
  }
  const files = Array.from(fileList);
  const bytes = files.reduce((n, file) => n + file.size, 0);
  try {
    checkBatch(files);
    if (queuedFiles + files.length > LIMITS.files || queuedBytes + bytes > LIMITS.batchBytes) throw new Error('Finish the current import before adding more files.');
  } catch (error) { alert((error as Error).message); return; }
  queuedFiles += files.length; queuedBytes += bytes;
  importQueue = importQueue.then(() => importFiles(files)).finally(() => { queuedFiles -= files.length; queuedBytes -= bytes; });
}

async function importFiles(files: File[]) {
  try { checkBatch(files); } catch (error) { alert((error as Error).message); return; }
  UI.text('system-status', `INGESTING ${files.length}...`);
  
  const irpCount = files.filter(f => f.name.toLowerCase().endsWith('.irp')).length;
  trackEvent('files_ingested', { 
    total_count: files.length, 
    protocol_files: irpCount,
    contains_protocol: irpCount > 0 
  });

  for (const file of files) {
    try {
      if (file.name.toLowerCase().endsWith('.irp') || file.name.toLowerCase().endsWith('.json')) {
        const json = await importJob<InstantRamanProtocol>({ operation: 'protocol', file });
        await promptProtocolImport(json);
        UI.text('system-status', `READY`);
        continue;
      }

      const buffer = await file.arrayBuffer();
      const document = await importJob<ImportDocument>({ operation: 'inspect', file });
      const imported = await previewImport(document);
      if (!imported) { UI.text('system-status', 'READY'); continue; }
      checkSession([...state.files.values()].reduce((n, f) => n + f.raw.wavenumberData.length, 0), state.files.size,
        imported.spectra.reduce((n, s) => n + s.wavenumberData.length, 0), imported.spectra.length);
      const fileHash = await ProtocolManager.computeHash(buffer);
      const settings = processingSettings();
      const processed = imported.spectra.map(raw => {
        const id = crypto.randomUUID();
        const name = imported.spectra.length > 1 || document.format !== 'CSV'
          ? [file.name, raw.metadata.sheetName, raw.metadata.seriesName].filter(Boolean).join(' — ') : file.name;
        return processSpectrum({ id, name, raw, fileHash }, settings);
      });
      storeProcessedSpectra(processed);
      if (!state.activeFileId) selectSpectrum(processed[0]?.id ?? null);

      trackEvent('file_uploaded', {
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
  }
}

function processingSettings(): ProcessingSettings {
  const norm = state.normalizationMode === 'point' && state.normTargetX === null ? 'none' : state.normalizationMode;
  return {
    snip: Number(UI.val('slider-snip')), sg: Number(UI.val('select-smoothing')),
    clipNegative: (UI.get('check-clip-negative') as HTMLInputElement).checked,
    mode: state.baselineMode, cosmic: state.cosmicRayRemoval, norm, normTarget: state.normTargetX
  };
}

type SpectrumInput = Pick<ProcessedFile, 'id' | 'name' | 'raw' | 'fileHash'> &
  Partial<Pick<ProcessedFile, 'anchors' | 'selectedPeakX' | 'labels' | 'color'>>;

function processSpectrum(input: SpectrumInput, params: ProcessingSettings): ProcessedFile {
  const { id, name, raw, fileHash, anchors = [], labels = [] } = input;
  const { snip, sg, clipNegative, mode, norm, normTarget } = params;
  const { cleaned, replacedCount } = params.cosmic
    ? SpectralProcessor.rejectCosmicRays(raw) : { cleaned: raw, replacedCount: 0 };
  const baseline = mode === 'manual'
    ? SpectralProcessor.baselineManual(cleaned, anchors) : SpectralProcessor.baselineSNIP(cleaned, snip);
  const corrected = {
    wavenumberData: raw.wavenumberData,
    intensityData: cleaned.intensityData.map((v, i) => {
      const value = v - baseline.intensityData[i];
      return clipNegative ? Math.max(0, value) : value;
    })
  };
  const smoothed = sg === 1 ? corrected : SpectralProcessor.movingAverage(corrected, sg);
  let normalization = { normalized: smoothed, factor: 1 };
  if (norm === 'max') normalization = SpectralProcessor.normalizeMax(smoothed);
  else if (norm === 'area') normalization = SpectralProcessor.normalizeArea(smoothed);
  else if (norm === 'point' && normTarget !== null) normalization = SpectralProcessor.normalizeToPoint(smoothed, normTarget);

  const { normalized: processed, factor: normFactor } = normalization;
  const variance = SpectralProcessor.calculateVariance(cleaned, baseline);
  if (!processed.intensityData.every(Number.isFinite) || !baseline.intensityData.every(Number.isFinite) ||
    ![normFactor, variance.sigPct, variance.bslPct].every(Number.isFinite)) {
    throw new Error('These data and processing settings exceed the supported numerical range.');
  }
  const peaks = SpectralProcessor.findPeaks(processed);
  return {
    id, name, raw, fileHash, corrected, baseline, processed, normFactor, peaks,
    selectedPeakX: new Set(peaks.filter(p => input.selectedPeakX?.has(p.x)).map(p => p.x)),
    variance, spikesRemoved: replacedCount, params, anchors, labels, color: input.color ?? ''
  };
}

function storeProcessedSpectra(spectra: ProcessedFile[]) {
  for (const file of spectra) {
    if (state.activeFileId === file.id && state.files.has(file.id)) {
      resetFitView();
      state.ratioMode = false;
      state.ratioSelection = { p1: null, p2: null };
    }
    if (!file.color) file.color = COLOR_PALETTE[state.files.size % COLOR_PALETTE.length];
    state.files.set(file.id, file);
    trackEvent('peak_detection_run', { peak_count: file.peaks.length, baseline_mode: file.params.mode });
  }
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ?
    `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` :
    '45, 212, 191';
}

function updateUI(save = true) {
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
  const activeCount = plottedSpectra().length;
  UI.text('footer-stats', `SPECTRA: ${totalFiles} ; ACTIVE SPECTRA: ${activeCount}`);

  // Update Ratio Results visibility
  UI.get('ratio-results')?.classList.toggle('hidden', !state.ratioSelection.p1 && !state.ratioSelection.p2);
  UI.text('btn-mode-ratio', state.ratioMode ? 'Ratio mode: active (pick 2 peaks)' : 'Enable ratio selection');
  UI.get('btn-mode-ratio')?.classList.toggle('active-compare', state.ratioMode);

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
  if (save) scheduleWorkspaceSave();
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
        <span style="font-weight:700; color:#3b82f6;">${label.x.toFixed(0)}</span>: ${escapeHTML(label.text)}
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
          <div class="file-name-edit" contenteditable="plaintext-only" spellcheck="false"
               style="font-weight:600; font-size:12px; outline:none; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"></div>
          <div style="display: flex; align-items: center; gap: 6px; margin-top:2px;">
            <div style="font-size: 10px; color: var(--text-dim);">${file.raw.metadata.pointCount} pts</div>
            ${file.isReproduced ? `<div style="font-size: 9px; background: #fef3c7; color: #92400e; padding: 1px 4px; border-radius: 3px; font-weight: 700; border: 1px solid #fde68a;">REPRODUCED [${escapeHTML(file.protocolId?.slice(0, 8))}]</div>` : ''}
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
    nameEl.textContent = file.name;
    const importButton = document.createElement('button');
    importButton.className = 'btn-small';
    importButton.textContent = 'Import details';
    importButton.addEventListener('click', event => { event.stopPropagation(); showImportDetails(file.raw); });
    const sourceLabel = document.createElement('div');
    sourceLabel.style.cssText = 'font-size:11px;color:var(--text-secondary);overflow-wrap:anywhere';
    sourceLabel.textContent = [file.raw.metadata.fileName, file.raw.metadata.sheetName, file.raw.metadata.seriesName].filter(Boolean).join(' · ');
    nameEl.after(sourceLabel);
    item.querySelector('.file-actions')?.prepend(importButton);
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
      selectSpectrum(id);
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
  clearReplicates();
  updateUI();
}

function plottedSpectra() {
  const ids = new Set(state.comparisonIds);
  if (state.activeFileId) ids.add(state.activeFileId);
  return [...ids].flatMap(id => {
    const file = state.files.get(id);
    return file ? [file] : [];
  });
}

function visibleFit() {
  return state.fitViewFileId && state.fitViewFileId === state.activeFileId
    ? state.files.get(state.fitViewFileId)?.fit : undefined;
}

function spectrumNormalizationLabel(params?: ProcessedFile['params']) {
  if (params?.norm === 'max') return 'Max Intensity';
  if (params?.norm === 'area') return 'Total Area';
  if (params?.norm === 'point') return `Point (${params.normTarget?.toFixed(1)} cm⁻¹)`;
  return '';
}

let pendingFit: ReturnType<typeof setTimeout> | undefined;

function resetFitView() {
  clearTimeout(pendingFit);
  pendingFit = undefined;
  state.selectingROI = false;
  state.fitViewFileId = null;
}

function clearReplicates() {
  if (state.layoutMode === 'replicate') state.layoutMode = state.previousLayoutMode;
  state.replicateGroup = null;
}

function applyProcessingControls(params: ProcessedFile['params']) {
  state.baselineMode = params.mode;
  state.cosmicRayRemoval = params.cosmic;
  state.normalizationMode = params.norm;
  state.normTargetX = params.normTarget;
  (UI.get('check-cosmic-ray') as HTMLInputElement).checked = params.cosmic;
  (UI.get('check-clip-negative') as HTMLInputElement).checked = params.clipNegative;
  UI.setVal('select-smoothing', String(params.sg));
  UI.setVal('slider-snip', String(params.snip));
  UI.text('val-snip', String(params.snip));
  UI.setVal('select-norm', params.norm);
  UI.setVal('input-norm-target', params.normTarget?.toString() ?? '');
  UI.get('norm-point-info')?.classList.toggle('hidden', params.norm !== 'point');
  UI.text('norm-target-display', params.normTarget === null ? 'Ref: --- cm⁻¹' : `Ref: ${params.normTarget.toFixed(1)} cm⁻¹`);
  UI.get('snip-controls')?.classList.toggle('hidden', params.mode !== 'auto');
  UI.get('manual-controls')?.classList.toggle('hidden', params.mode !== 'manual');
  UI.get('btn-mode-snip')?.classList.toggle('active-compare', params.mode === 'auto');
  UI.get('btn-mode-manual')?.classList.toggle('active-compare', params.mode === 'manual');
}

function selectSpectrum(id: string | null) {
  if (id === state.activeFileId) return;
  state.activeFileId = id;
  resetFitView();
  clearReplicates();
  state.ratioMode = false;
  state.ratioSelection = { p1: null, p2: null };
  UI.get('cal-status-container')?.classList.add('hidden');
  const selected = id === null ? undefined : state.files.get(id);
  if (selected) applyProcessingControls(selected.params);
}

function deleteFile(id: string) {
  state.files.delete(id);
  state.comparisonIds.delete(id);
  clearReplicates();
  if (state.activeFileId === id) {
    selectSpectrum(state.files.keys().next().value ?? null);
  }
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
  const filesToRender = plottedSpectra();

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

  const fit = visibleFit();
  UI.setVal('select-layout', state.layoutMode === 'replicate' ? state.previousLayoutMode : state.layoutMode);
  UI.get('btn-view-fit')?.classList.toggle('hidden', !!fit || !activeFile?.fit);
  if (fit) {
    UI.get('btn-start-fit-mode')?.classList.add('hidden');
    UI.get('btn-exit-fit')?.classList.remove('hidden');
    renderFitResults(fit);
    return;
  } else {
    UI.get('btn-start-fit-mode')?.classList.remove('hidden');
    UI.get('btn-exit-fit')?.classList.add('hidden');
  }

  const normLabel = spectrumNormalizationLabel(activeFile?.params);

  if (state.layoutMode === 'stacked' && filesToRender.length > 1) {
    const div = document.createElement('div');
    div.className = 'plot-container';
    container.appendChild(div);
    const datasets = filesToRender.map((f, i) => {
      let displayData = f.processed;
      let currentFactor = f.normFactor;

      if (f.params.norm === 'none') {
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
      const baselineScaled = {
        wavenumberData: f.baseline.wavenumberData,
        intensityData: f.baseline.intensityData.map(v => v * currentFactor + offset)
      };

      return {
        name: f.name, data: offsetData, color: f.color, raw: rawScaled, baseline: baselineScaled,
        labels: f.labels.map(label => ({ ...label, y: label.y * (f.params.norm === 'none' ? currentFactor : 1) + offset }))
      };
    });
    requestAnimationFrame(() => {
      if (!div.isConnected) return;
      const waterfallLabels = new Set(filesToRender.map(f => spectrumNormalizationLabel(f.params) || 'Max Intensity'));
      const waterfallNorm = waterfallLabels.size === 1 ? [...waterfallLabels][0] : 'Mixed normalization';
      ChartRenderer.renderOverlay(div, datasets, state.viewRange || undefined, true, state.hideYAxis, waterfallNorm, peaksForPlot, null, state.axisFontSize, state.showAxisBox, state.showDirectLabels, state.showUnprocessed, state.showBaseline, state.showGrid);
      attachManualBaselineListener(div);
      attachLabelClickListener(div);
      attachFreeLabelListener(div);
    });
  } else if (state.layoutMode === 'replicate' && state.replicateGroup) {
    const group = state.replicateGroup;
    const div = document.createElement('div');
    div.className = 'plot-container';
    container.appendChild(div);
    requestAnimationFrame(() => {
      if (!div.isConnected) return;
      const statsPeaks: Peak[] = group.peakStats
        .filter(ps => group.selectedPeakX.has(ps.xMean))
        .map(ps => ({
          x: ps.xMean,
          y: ps.yMean,
          fwhm: ps.fwhmMean,
          relIntensity: 0,
          area: 0
        })) || [];
      ChartRenderer.renderReplicate(div, group.mean, group.sd, "Replicate Group", "#332288", state.viewRange || undefined, statsPeaks, state.showGrid);
    });
  } else if (state.layoutMode.startsWith('grid')) {
    const limit = state.layoutMode === 'grid2x1' ? 2 : 4;
    const panelFiles = activeFile && !filesToRender.slice(0, limit).includes(activeFile)
      ? [...filesToRender.slice(0, limit - 1), activeFile] : filesToRender.slice(0, limit);
    panelFiles.forEach((f) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'plot-item';
      wrapper.innerHTML = `<div class="plot-item-title">${escapeHTML(f.name)}</div><div class="plot-container" style="flex:1; min-height:0;"></div>`;
      container.appendChild(wrapper);
      const plotEl = wrapper.querySelector('.plot-container') as HTMLElement;

      const rawNormalized: SpectralData = {
        wavenumberData: f.raw.wavenumberData,
        intensityData: f.raw.intensityData.map(v => v * f.normFactor)
      };

      requestAnimationFrame(() => {
        if (!plotEl.isConnected) return;
        const filteredPeaks = f.peaks.filter(p => f.selectedPeakX.has(p.x));
        const baseline = { wavenumberData: f.baseline.wavenumberData, intensityData: f.baseline.intensityData.map(y => y * f.normFactor) };
        ChartRenderer.renderSingle(plotEl, rawNormalized, f.processed, baseline, filteredPeaks, f.color, state.viewRange || undefined, true, state.hideYAxis, spectrumNormalizationLabel(f.params), f.id === state.activeFileId ? state.ratioSelection : null, state.axisFontSize, state.showAxisBox, state.showUnprocessed, state.showBaseline, state.showGrid, f.labels);
        attachManualBaselineListener(plotEl);
        attachLabelClickListener(plotEl);
        attachFreeLabelListener(plotEl);
        // Systematic Fix: Ensure grid plots also get the fit listener if in selection mode
        if (state.selectingROI && f.id === state.activeFileId) attachFitListener(plotEl, f.id);
      });
    });
  } else {
    const div = document.createElement('div');
    div.className = 'plot-container';
    container.appendChild(div);

    if (filesToRender.length > 1) {
      const datasets = filesToRender.map(f => ({
        name: f.name, data: f.processed, color: f.color, labels: f.labels,
        baseline: { wavenumberData: f.baseline.wavenumberData, intensityData: f.baseline.intensityData.map(y => y * f.normFactor) },
        raw: {
          wavenumberData: f.raw.wavenumberData,
          intensityData: f.raw.intensityData.map(v => v * f.normFactor)
        }
      }));
      requestAnimationFrame(() => {
        if (!div.isConnected) return;
        const labels = new Set(filesToRender.map(f => spectrumNormalizationLabel(f.params)));
        ChartRenderer.renderOverlay(div, datasets, state.viewRange || undefined, false, state.hideYAxis, labels.size === 1 ? normLabel : 'Mixed normalization', peaksForPlot, state.ratioSelection, state.axisFontSize, state.showAxisBox, state.showDirectLabels, state.showUnprocessed, state.showBaseline, state.showGrid);
        attachManualBaselineListener(div);
        attachLabelClickListener(div);
        attachFreeLabelListener(div);
        if (state.selectingROI && activeFile) attachFitListener(div, activeFile.id);
      });
    } else {
      const f = filesToRender[0];
      const rawNormalized: SpectralData = {
        wavenumberData: f.raw.wavenumberData,
        intensityData: f.raw.intensityData.map(v => v * f.normFactor)
      };
      requestAnimationFrame(() => {
        if (!div.isConnected) return;
        const filteredPeaks = activeFile?.peaks.filter(p => activeFile.selectedPeakX.has(p.x)) || [];
        const baseline = { wavenumberData: f.baseline.wavenumberData, intensityData: f.baseline.intensityData.map(y => y * f.normFactor) };
        ChartRenderer.renderSingle(div, rawNormalized, f.processed, baseline, filteredPeaks, f.color, state.viewRange || undefined, false, state.hideYAxis, normLabel, state.ratioSelection, state.axisFontSize, state.showAxisBox, state.showUnprocessed, state.showBaseline, state.showGrid, f.labels);
        attachManualBaselineListener(div);
        attachLabelClickListener(div);
        attachFreeLabelListener(div);
        if (state.selectingROI) attachFitListener(div, f.id);
      });
    }
  }
}

function attachFitListener(el: HTMLElement, fileId: string) {
  const Plotly = (window as any).Plotly;
  const plotEl = el as any;
  if (!plotEl || !Plotly) return;

  // Force box selection mode
  // Force box selection mode (with safety timeout to ensure Plotly is ready)
  const setDragMode = () => {
    if (!el.isConnected || !state.selectingROI) return;
    if (plotEl._fullLayout) {
      Plotly.relayout(plotEl, { dragmode: 'select' });
    } else {
      setTimeout(setDragMode, 50);
    }
  };
  setDragMode();

  plotEl.on('plotly_selected', (data: any) => {
    const range = data?.range?.x;
    if (!range || !el.isConnected || !state.selectingROI || state.activeFileId !== fileId) return;
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
        const newMinX = data['xaxis.range[0]'];
        const newMaxX = data['xaxis.range[1]'];
        if (!Number.isFinite(newMinX) || !Number.isFinite(newMaxX)) return;

        // Save current view to history before updating if it's a significant change
        if (!state.viewRange || Math.abs(state.viewRange[0] - newMinX) > 1 || Math.abs(state.viewRange[1] - newMaxX) > 1) {
          state.viewHistory.push(state.viewRange ? [...state.viewRange] : null);
          if (state.viewHistory.length > 20) state.viewHistory.shift();
        }
        state.viewRange = [newMinX, newMaxX];
        scheduleWorkspaceSave();
      }

      if (data['xaxis.autorange'] === true && state.viewRange) {
        if (state.viewRange) {
          state.viewHistory.push([...state.viewRange]);
        }
        state.viewRange = null;
        scheduleWorkspaceSave();
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
          if (activeFile.peaks.length === 0) {
            showToast("No peaks detected in this spectrum to select.");
            return;
          }
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
    if (active.anchors.length >= LIMITS.anchors) { showToast('Maximum 256 baseline anchors reached.'); return; }
    reprocessActive([...active.anchors, { x, y }]);
  }
}

function renderAnchorList() {
  const active = state.files.get(state.activeFileId || '');
  const body = UI.get('anchor-list-body');
  if (!body) return;
  body.innerHTML = '';
  if (!active || state.baselineMode !== 'manual') return;

  [...active.anchors].sort((a, b) => a.x - b.x).forEach((a, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="padding:4px;">${a.x.toFixed(1)}</td>
      <td style="padding:4px;">${a.y.toFixed(1)}</td>
      <td style="padding:4px;"><button class="btn-del-anchor" data-idx="${idx}" style="background:none; border:none; cursor:pointer;">✕</button></td>
    `;
    tr.querySelector('.btn-del-anchor')?.addEventListener('click', () => {
      reprocessActive(active.anchors.filter(anchor => anchor !== a));
    });
    body.appendChild(tr);
  });
}



function initBaselineControls() {
  const smoothing = UI.get('select-smoothing') as HTMLSelectElement;
  const defaultWindow = smoothing.options[1];
  for (let points = 3; points <= 51; points += 2) {
    if (points !== 9) smoothing.add(new Option(String(points), String(points)), points < 9 ? defaultWindow : null);
  }
  for (const id of ['select-smoothing', 'check-clip-negative']) {
    UI.get(id)?.addEventListener('change', reprocessAll);
  }
  UI.get('btn-mode-snip')?.addEventListener('click', () => {
    state.baselineMode = 'auto';
    UI.get('btn-mode-snip')?.classList.add('active-compare');
    UI.get('btn-mode-manual')?.classList.remove('active-compare');
    UI.get('snip-controls')?.classList.remove('hidden');
    UI.get('manual-controls')?.classList.add('hidden');

    trackEvent('baseline_correction_applied', { mode: 'auto' });
    reprocessAll();
  });

  UI.get('btn-mode-manual')?.addEventListener('click', () => {
    state.baselineMode = 'manual';
    UI.get('btn-mode-manual')?.classList.add('active-compare');
    UI.get('btn-mode-snip')?.classList.remove('active-compare');
    UI.get('snip-controls')?.classList.add('hidden');
    UI.get('manual-controls')?.classList.remove('hidden');

    trackEvent('baseline_correction_applied', { mode: 'manual' });
    reprocessAll();
  });

  UI.get('btn-clear-anchors')?.addEventListener('click', () => {
    const active = state.files.get(state.activeFileId || '');
    if (active) {
      reprocessActive([]);
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

function initNavigation() {
  const handleExitWorkstation = () => {
    document.body.classList.remove('workstation-active');
    window.scrollTo(0, 0);
  };

  UI.get('workstation-brand-logo')?.addEventListener('click', handleExitWorkstation);
  UI.get('btn-back-to-landing')?.addEventListener('click', handleExitWorkstation);
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
      updateUI(false);
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
        <span style="font-size: 11px; font-weight: 700; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px;">${escapeHTML(file.name)}</span>
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
    resetFitView();
    clearReplicates();
    state.layoutMode = state.previousLayoutMode = (e.target as HTMLSelectElement).value as AppState['previousLayoutMode'];
    updateUI();
  });
  UI.get('btn-group-replicates')?.addEventListener('click', () => {
    try {
      state.replicateGroup = calculateReplicates();
      resetFitView();
      state.layoutMode = 'replicate';
      updateUI();
    } catch (err: any) {
      alert(err.message);
    }
  });

  UI.get('btn-start-fit-mode')?.addEventListener('click', () => {
    const selecting = !state.selectingROI;
    clearReplicates();
    if (state.layoutMode === 'stacked') state.layoutMode = state.previousLayoutMode = 'single';
    state.selectingROI = selecting;
    if (state.selectingROI) {
      showToast("Drag on the active spectrum's plot to select your fitting region.");
    }
    updateUI();
  });

  UI.get('btn-view-fit')?.addEventListener('click', () => {
    resetFitView();
    clearReplicates();
    state.fitViewFileId = state.activeFileId;
    updateUI();
  });
  UI.get('btn-exit-fit')?.addEventListener('click', () => {
    resetFitView();
    updateUI();
  });

  UI.get('btn-undo-replicates')?.addEventListener('click', () => {
    clearReplicates();
    updateUI();
  });
}

function calculateReplicates() {
  const spectra = plottedSpectra();
  if (spectra.length < 2) throw new Error('Check a second spectrum in the Spectra tab to group replicates.');
  const first = spectra[0].params;
  if (spectra.some(({ params }) => params.norm !== first.norm ||
    (params.norm === 'point' && params.normTarget !== first.normTarget))) {
    throw new Error('Replicates must use the same normalization settings.');
  }
  return ReplicateEngine.compute(spectra);
}

function refreshReplicates() {
  if (state.layoutMode !== 'replicate') return;
  try {
    const selected = state.replicateGroup?.selectedPeakX;
    const group = calculateReplicates();
    group.selectedPeakX = new Set(group.peakStats.filter(peak => selected?.has(peak.xMean)).map(peak => peak.xMean));
    state.replicateGroup = group;
  } catch (error) {
    clearReplicates();
    showToast((error as Error).message);
  }
}

function initNormalization() {
  const target = UI.get('input-norm-target') as HTMLInputElement;
  const setTarget = () => {
    state.normTargetX = Number.isFinite(target.valueAsNumber) && target.validity.valid ? target.valueAsNumber : null;
    UI.text('norm-target-display', state.normTargetX === null ? 'Ref: --- cm⁻¹' : `Ref: ${state.normTargetX.toFixed(1)} cm⁻¹`);
  };
  target.addEventListener('change', () => {
    if (state.normalizationMode !== 'point') return;
    setTarget();
    reprocessAll();
  });
  UI.get('select-norm')?.addEventListener('change', (e) => {
    state.normalizationMode = (e.target as HTMLSelectElement).value as NormalizationMode;
    UI.get('norm-point-info')?.classList.toggle('hidden', state.normalizationMode !== 'point');
    if (state.normalizationMode === 'point') setTarget();
    if (state.normalizationMode !== 'point' || state.normTargetX !== null) reprocessAll();
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
    trackEvent('export_generated', { export_type: 'svg' });
    exportFigure('svg');
  });



  UI.get('check-export-transparent')?.addEventListener('change', (e) => {
    state.exportTransparent = (e.target as HTMLInputElement).checked;
    scheduleWorkspaceSave();
  });

  UI.get('check-show-unprocessed')?.addEventListener('change', (e) => {
    state.showUnprocessed = (e.target as HTMLInputElement).checked;
    updateUI();
  });

  UI.get('check-show-baseline')?.addEventListener('change', (e) => {
    state.showBaseline = (e.target as HTMLInputElement).checked;
    updateUI();
  });

  UI.get('check-hide-grid')?.addEventListener('change', (e) => {
    // Note: Variable is 'showGrid', but checkbox is 'hide-grid' (inverted logic)
    state.showGrid = !(e.target as HTMLInputElement).checked;
    updateUI();
  });

  UI.get('check-cosmic-ray')?.addEventListener('change', (e) => {
    state.cosmicRayRemoval = (e.target as HTMLInputElement).checked;
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

function reprocessActive(anchors?: ProcessedFile['anchors']) {
  const active = state.files.get(state.activeFileId || '');
  if (!active) return;
  try {
    const file = processSpectrum({ ...active, anchors: anchors ?? active.anchors }, processingSettings());
    storeProcessedSpectra([file]);
    refreshReplicates();
    updateUI();
  } catch (error) {
    applyProcessingControls(active.params);
    showToast((error as Error).message);
  }
}

function reprocessAll() {
  try {
    const settings = processingSettings();
    storeProcessedSpectra([...state.files.values()].map(file => processSpectrum(file, settings)));
    refreshReplicates();
    updateUI();
  } catch (error) {
    const active = state.files.get(state.activeFileId || '');
    if (active) applyProcessingControls(active.params);
    showToast((error as Error).message);
  }
}

async function exportExcel() {
  const files = plottedSpectra();
  if (files.length === 0) return;

  try {
    const wb = XLSX.utils.book_new();

    // 1. Methodology Sheet
    const summaryData = [
      ['Parameter', 'Value'],
      ['Workstation', `Instant Raman ${APP_VERSION}`],
      ['Export Date', new Date().toISOString()],
      ['Baseline', 'See each spectrum sheet for mode and settings'],
      ['Smoothing and clipping', 'See each spectrum sheet'],
      ['Peak Detection Threshold', '2% of maximum processed intensity'],
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
    const sheetNames = new Set(wb.SheetNames.map(name => name.toLowerCase()));
    for (const file of files) {
      const baseName = file.name.substring(0, 25).replace(/[\\/:?*\[\]]/g, '_');
      let sheetName = baseName;
      let counter = 1;
      while (sheetNames.has(sheetName.toLowerCase())) { sheetName = `${baseName}_${counter++}`; }
      sheetNames.add(sheetName.toLowerCase());

      const spectralData: any[][] = [
        ['File Name', file.name],
        ['Source File', file.raw.metadata.fileName],
        ['Worksheet', file.raw.metadata.sheetName ?? ''],
        ['Series', file.raw.metadata.seriesName ?? ''],
        ['Import Settings (zero-based indices)', JSON.stringify(file.raw.metadata.importSettings ?? {})],
        ['Import Notes', (file.raw.metadata.importWarnings ?? []).join('\n')],
        ['Baseline Mode', file.params.mode.toUpperCase()],
        ['Cosmic Ray Spikes Removed', file.spikesRemoved],
        ['SNIP Iterations', file.params.mode === 'auto' ? file.params.snip : 'N/A'],
        ['Moving average (points)', file.params.sg === 1 ? 'Off' : file.params.sg],
        ['Negative corrected intensities', file.params.clipNegative ? 'Clipped to zero' : 'Retained'],
        ['Manual Anchors Count', file.params.mode === 'manual' ? file.anchors.length : 0]
      ];

      if (file.params.mode === 'manual' && file.anchors.length > 0) {
        spectralData.push(['Manual Anchor Points (X,Y)', file.anchors.map(a => `(${a.x.toFixed(1)}, ${a.y.toFixed(1)})`).join('; ')]);
      }

      spectralData.push([]); // Spacer

      const normLabel = file.params.norm === 'none' ? 'None' :
        file.params.norm === 'max' ? 'Max Intensity' :
          file.params.norm === 'area' ? 'Total Area (AUC)' :
            `Point Ref (${file.params.normTarget?.toFixed(1)} cm⁻¹)`;

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
      if (file.id === state.activeFileId && state.ratioSelection.p1 && state.ratioSelection.p2) {
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


async function exportFigure(format: 'png' | 'svg') {
  const workspace = UI.get('workspace-container');
  if (!workspace) return;
  try {
    await exportRenderedFigure(workspace, format, format === 'png' && state.exportTransparent);
  } catch (error) {
    showToast('Figure export failed: ' + (error as Error).message);
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
  if (norm === 'point') normDesc = `normalization to the selected point at ${params.normTarget?.toFixed(1)} cm⁻¹`;

  const baselineDescription = params.mode === 'manual' ? `linear interpolation between ${file.anchors.length} manual anchors` : `iterative clipping (SNIP, ${snip} iterations) [1]`;
  const clipping = params.clipNegative ? 'set to zero' : 'retained';
  const smoothing = sg === 1 ? 'Smoothing was disabled' : 'A ' + sg + '-point moving average [2] was applied';
  return `Raman spectrum of ${file.name}. Processed using Instant Raman (${APP_VERSION}). ${params.cosmic ? `Median-based spike removal replaced ${file.spikesRemoved} points.` : 'Spike removal was disabled.'} Baseline subtraction used ${baselineDescription}. Negative corrected intensities were ${clipping}. ${smoothing}, with ${normDesc}. Local maxima detection with three-point parabolic refinement and a 2% threshold of maximum processed intensity identified ${peakCount} candidate peaks. Keep the original data file and import settings with the exported protocol.`;
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
    console.log('[Protocol] Export button clicked');
    showToast("Preparing protocol export...");

    const active = state.files.get(state.activeFileId || '');
    if (!active) {
      console.warn('[Protocol] No active file found for export');
      showToast("Select a spectrum to export its protocol.");
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

    const protocolId = activeFile.protocolId || generateId();

    // 1. Metadata
    const metadata: any = {
      instant_raman_version: APP_VERSION,
      protocol_version: "1.2.0",
      protocol_id: protocolId,
      created_at: new Date().toISOString(),
      created_by: "Instant Raman User"
    };

    // 2. Source Data Record
    const sourceData: any = {
      original_filename: activeFile.raw.metadata.fileName,
      file_format_detected: activeFile.raw.metadata.format,
      spectrum_hash: await ProtocolManager.spectrumHash(activeFile.raw),
      import_metadata: activeFile.raw.metadata,
      wavenumber_range: {
        min: activeFile.raw.wavenumberData[0],
        max: activeFile.raw.wavenumberData[activeFile.raw.wavenumberData.length - 1]
      },
      wavenumber_spacing: (activeFile.raw.wavenumberData[1] - activeFile.raw.wavenumberData[0]) || 1,
      number_of_data_points: activeFile.raw.wavenumberData.length,
      file_hash: activeFile.fileHash
    };

    // 3. Processing Steps
    const steps: any[] = [
      {
        step_number: 0,
        step_name: "Cosmic Ray Removal",
        applied: activeFile.params.cosmic,
        parameters: {
          algorithm: "MAD_zscore",
          threshold: 6,
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
          algorithm: activeFile.params.mode === 'manual' ? 'linear_anchor_interpolation' : 'SNIP',
          anchors: activeFile.anchors,
          smoothing: { algorithm: 'moving_average', window: activeFile.params.sg },
          clip_negative_corrected: activeFile.params.clipNegative,
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
          reference_wavenumber: activeFile.params.normTarget
        }
      },
      {
        step_number: 3,
        step_name: "Peak Detection",
        applied: true,
        parameters: {
          method: "parabolic_interpolation",
          minimum_height_threshold: 0.02,
          minimum_separation: 2.5,
          peaks_detected: activeFile.peaks.length,
          peak_positions: activeFile.peaks.map(p => p.x)
        }
      }
    ];

    // 4. Fitting Record
    const fit = activeFile.fit;
    const fittingRecord = fit?.peaks.map((p, i) => ({
      peak_id: i + 1, nominal_center: p.center.value,
      boundary_left: fit.fitX[0], boundary_right: fit.fitX.at(-1),
      best_fit_model: p.type, fitted_center: p.center.value,
      fitted_fwhm: p.fwhm.value, fitted_amplitude: p.amplitude.value,
      fitted_shape: p.shape?.value ?? null,
      fitted_center_statistical_error: p.center.error,
      r_squared: fit.r2, convergence_status: fit.convergence_status
    })) ?? null;

    const protocol: any = {
      protocol_metadata: metadata,
      source_data_record: sourceData,
      processing_steps: steps as any,
      fitting_record: fittingRecord as any,
      integration_record: null,
      reproducibility_guarantee: "Processing parameters and source-file hash included; keep the original data file."
    };

    // Validation check
    ProtocolManager.validateSchema(protocol);
    activeFile.protocolId = protocolId;

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
    trackEvent('protocol_exported', {});
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
  const fit = visibleFit();
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
  } else if (fit) {
    type = 'fitting';
    tableType = 'fit';
    tableData = fit.peaks;
    const residualPlot = UI.get("fit-residual") as any;
    if (residualPlot?.data) traces = [...traces, ...residualPlot.data.map((t: any) => ({ ...t, yaxis: "y2" }))];
  } else {
    type = 'general';
    tableType = 'peaks';
    const filesToRender = plottedSpectra();

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
      const padding = (globalMaxY - globalMinY || Math.abs(globalMaxY) || 1) * 0.05;
      yRange = [globalMinY - padding, globalMaxY + padding];
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
  });
  updateUI();
}


function fittingRegion(data: SpectralData, left: number, right: number) {
  const x: number[] = [], y: number[] = [];
  data.wavenumberData.forEach((shift, i) => {
    if (shift >= left && shift <= right) {
      x.push(shift);
      y.push(data.intensityData[i]);
    }
  });
  return { x, y };
}

function runFitting(minX: number, maxX: number) {
  const active = state.activeFileId ? state.files.get(state.activeFileId) : undefined;
  if (!active) return;

  const { x, y } = fittingRegion(active.processed, Math.min(minX, maxX), Math.max(minX, maxX));
  if (x.length < 5) {
    showToast('Select at least five points for peak fitting.');
    updateUI();
    return;
  }
  const type = UI.val('select-fit-type') as FitResult['peaks'][number]['type'];
  const { p1, p2 } = state.ratioSelection;
  const seedPeaks = p1 && p2 && p1.x !== p2.x && [p1, p2].every(p => p.x >= x[0] && p.x <= x[x.length - 1])
    ? [p1, p2] : null;
  const initial = seedPeaks
    ? seedPeaks.flatMap(p => type === 'voigt' ? [p.y, p.x, p.fwhm || 15, 0.5] : [p.y, p.x, p.fwhm || 15])
    : FittingEngine.estimateInitial(x, y, type);

  clearTimeout(pendingFit);
  pendingFit = setTimeout(() => {
    pendingFit = undefined;
    if (workspaceClearing || state.activeFileId !== active.id || state.files.get(active.id) !== active) return;
    const fit = FittingEngine.fit(x, y, initial, type);
    if (fit.convergence_status === 'failed') {
      showToast(fit.errorMsg || 'Peak fitting failed.');
    } else {
      active.fit = fit;
      active.protocolId = undefined;
      active.isReproduced = false;
      active.reproducedSteps = undefined;
      state.fitViewFileId = active.id;
    }
    UI.text('system-status', 'Ready');
    updateUI();
  }, 10);
  UI.text('system-status', 'Fitting…');
}

function renderFitResults(result: FitResult) {
  const container = UI.get('workspace-container');
  const active = state.files.get(state.activeFileId || '');
  if (!container || !active) return;
  container.className = 'fit-workspace';
  container.innerHTML = '<h2 id="fit-heading">Peak fit</h2><p id="fit-summary"></p><div id="fit-plot" class="plot-container" style="height:420px"></div><div id="fit-residual" style="height:200px"></div>';
  UI.text('fit-heading', 'Peak fit · ' + active.name);
  const uncertainty = result.statistical_uncertainty_status === 'ill_conditioned' ? ' · Parameter uncertainties unavailable' : '';
  UI.text('fit-summary', result.peaks.length + ' component(s) · R²: ' + (result.r2?.toFixed(4) ?? 'unavailable') + uncertainty + ' · Review the fit and residuals before using the results.');
  ChartRenderer.renderFit('fit-plot', result.fitX, result.fitY.map((y,i) => y + result.residuals[i]), result.fitX, result.fitY, true, state.showGrid, result.peaks, active.name);
  ChartRenderer.renderResidual('fit-residual', { wavenumberData: result.fitX, intensityData: result.residuals }, undefined, state.showGrid);
}

async function promptProtocolImport(protocolJson: any) {
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
      <div>ID: <span style="font-family: var(--font-mono); font-size: 10px;">${escapeHTML(meta.protocol_id)}</span></div>
      <div>Created: ${new Date(meta.created_at).toLocaleString()}</div>
      <div>By: ${escapeHTML(meta.created_by)} (IR v${escapeHTML(meta.instant_raman_version)})</div>
    </div>
    <div style="margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
      <div style="font-weight: 700; color: var(--text-primary);">Source Data Record</div>
      <div>Filename: ${escapeHTML(source.original_filename)}</div>
      <div>Range: ${source.wavenumber_range.min.toFixed(1)} - ${source.wavenumber_range.max.toFixed(1)} cm⁻¹</div>
      <div>Hash: <span style="font-family: var(--font-mono); font-size: 10px;">${escapeHTML(source.file_hash)}</span></div>
    </div>
    <div style="margin-bottom: 12px;">
      <div style="font-weight: 700; color: var(--text-primary);">Processing Pipeline</div>
      <ul style="padding-left: 18px; margin-top: 4px; line-height: 1.6;">
  `;

  steps.forEach(step => {
    if (step.applied) {
      summaryHtml += `<li><b>${escapeHTML(step.step_name)}:</b> ${escapeHTML(JSON.stringify(step.parameters))}</li>`;
    } else {
      summaryHtml += `<li style="opacity: 0.5;">${escapeHTML(step.step_name)}: (Not Applied)</li>`;
    }
  });

  summaryHtml += `
      </ul>
    </div>
  `;

  summaryContent.innerHTML = summaryHtml;
  const importSummary = document.createElement('p');
  importSummary.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;padding:12px';
  importSummary.textContent = source.import_metadata
    ? `Selected source: ${source.import_metadata.fileName}\nWorksheet: ${source.import_metadata.sheetName ?? ''}\nSeries: ${source.import_metadata.seriesName ?? ''}\nImport settings (zero-based indices): ${JSON.stringify(source.import_metadata.importSettings ?? {})}`
    : 'Import choices were not recorded in this protocol.';
  summaryContent.append(importSummary);

  // Hash Verification (Global Search)
  const applyBtn = UI.get('btn-apply-protocol') as HTMLButtonElement;
  applyBtn.disabled = true;
  const matches = await ProtocolManager.matchingSpectra(protocol.source_data_record, [...state.files.values()]);
  const matchedFile = matches.find(f => f.id === state.activeFileId) ?? matches[0];

  if (matchedFile) {
    hashStatus.classList.remove('hidden');
    hashStatus.style.background = '#ecfdf5';
    hashStatus.style.color = '#059669';
    hashStatus.style.border = '1px solid #10b981';
    hashStatus.textContent = `Matched with loaded file: "${matchedFile.name}". Review the saved settings before applying this protocol.`;
  } else {
    hashStatus.classList.remove('hidden');
    hashStatus.style.background = '#fffbeb';
    hashStatus.style.color = '#d97706';
    hashStatus.style.border = '1px solid #f59e0b';
    hashStatus.textContent = !source.spectrum_hash
      ? 'This older protocol has no selected-spectrum identity. Review its settings here and apply them manually, then export a new protocol. Automatic application is unavailable.'
      : 'No matching spectrum found. Import the original file using the saved worksheet, columns, row range, and units.';
  }

  // Action Listeners
  applyBtn.disabled = !matchedFile;
  const cancelBtn = UI.get('btn-cancel-protocol');
  const shouldApply = await new Promise<boolean>(resolve => {
    const listeners = new AbortController();
    const finish = (apply: boolean) => {
      listeners.abort();
      modal.classList.remove('active');
      resolve(apply);
    };
    applyBtn.addEventListener('click', () => finish(true), { signal: listeners.signal });
    cancelBtn?.addEventListener('click', () => finish(false), { signal: listeners.signal });
  });
  if (shouldApply) await applyProtocolDeterministically(protocol);
}

async function applyProtocolDeterministically(protocol: InstantRamanProtocol) {
  const matches = await ProtocolManager.matchingSpectra(protocol.source_data_record, [...state.files.values()]);
  const file = matches.find(f => f.id === state.activeFileId && state.files.has(f.id)) ?? matches.find(f => state.files.has(f.id));
  if (!file) throw new Error('Load the original spectrum before applying this protocol.');

  const [cosmicStep, baselineStep, normStep] = protocol.processing_steps;
  const baseline = baselineStep.parameters;
  const method = normStep.applied ? normStep.parameters?.method : 'none';
  const params: ProcessedFile['params'] = {
    snip: baseline?.iterations ?? 25,
    sg: baseline?.smoothing?.window ?? 9,
    clipNegative: baseline?.clip_negative_corrected ?? true,
    mode: !baselineStep.applied || baseline?.mode === 'manual' ? 'manual' : 'auto',
    cosmic: cosmicStep.applied,
    norm: method === 'max_intensity' ? 'max' : method === 'total_area' ? 'area' : method === 'reference_peak' ? 'point' : 'none',
    normTarget: normStep.applied ? normStep.parameters?.reference_wavenumber ?? null : null
  };
  const anchors = baselineStep.applied ? baseline?.anchors?.map(anchor => ({ ...anchor })) ?? [] : [];
  const current = state.files.get(file.id)!;
  const applied = processSpectrum({ ...current, anchors }, params);
  selectSpectrum(file.id);
  resetFitView();
  clearReplicates();
  applyProcessingControls(params);
  storeProcessedSpectra([applied]);
  applied.isReproduced = true;
  applied.protocolId = protocol.protocol_metadata.protocol_id;
  applied.reproducedSteps = new Set(['Spike removal', 'Baseline Correction', 'Corrected intensity', 'Smoothing', 'Normalization', 'Peak Detection']);

  const records = protocol.fitting_record ?? [];
  let result: FitResult | undefined;
  if (records.length) {
    const { boundary_left, boundary_right, best_fit_model } = records[0];
    const model = best_fit_model || 'lorentzian';
    const { x, y } = fittingRegion(applied.processed, boundary_left, boundary_right);
    const initial = records.flatMap(r => model === 'voigt'
      ? [r.fitted_amplitude ?? 100, r.fitted_center ?? r.nominal_center, r.fitted_fwhm ?? 20, r.fitted_shape ?? 0.5]
      : [r.fitted_amplitude ?? 100, r.fitted_center ?? r.nominal_center, r.fitted_fwhm ?? 20]);
    result = FittingEngine.fit(x, y, initial, model);
    if (result.convergence_status === 'converged') {
      applied.fit = result;
      state.fitViewFileId = applied.id;
    }
  }

  generateVerificationReport(protocol, result);
  updateUI();
  const fitFailed = result?.convergence_status === 'failed';
  UI.text('system-status', fitFailed ? 'Processing applied · Fit failed' : 'Processing applied');
  showToast(fitFailed ? 'Processing settings applied. The saved fit could not be reproduced.' : 'Protocol processing settings applied.');
}

function generateVerificationReport(protocol: InstantRamanProtocol, reproducedFit?: FitResult) {
  const modal = UI.get('modal-verification');
  const content = UI.get('verification-report-content');
  if (!modal || !content) return;

  const records = protocol.fitting_record ?? [];
  const original = records.flatMap(record => record.fitted_center == null ? [] : [record.fitted_center]);
  modal.classList.add('active');
  (UI.get('btn-close-verification') as HTMLButtonElement).onclick = () => modal.classList.remove('active');
  const replay = reproducedFit?.peaks.flatMap(peak => peak.center.value == null ? [] : [peak.center.value]) ?? [];
  if (!records.length || reproducedFit?.convergence_status !== 'converged' ||
    original.length !== records.length || replay.length !== original.length) {
    content.textContent = !records.length
      ? 'Processing settings applied. This protocol has no saved fit results to compare.'
      : reproducedFit?.convergence_status === 'failed'
        ? 'Processing settings applied. The fit could not be reproduced. ' + reproducedFit.errorMsg
        : 'Processing settings applied. Saved peak centers are unavailable for verification.';
    return;
  }

  original.sort((a, b) => a - b);
  replay.sort((a, b) => a - b);
  const table = document.createElement('table');
  table.createTHead().insertRow().append(...['Original (cm⁻¹)', 'New fit (cm⁻¹)', 'Absolute difference'].map(title => {
    const cell = document.createElement('th');
    cell.textContent = title;
    return cell;
  }));
  const rows = table.createTBody();
  let maxDifference = 0;
  original.forEach((center, i) => {
    const difference = Math.abs(center - replay[i]);
    maxDifference = Math.max(maxDifference, difference);
    const row = rows.insertRow();
    for (const text of [center.toFixed(6), replay[i].toFixed(6), difference.toExponential(2)]) {
      row.insertCell().textContent = text;
    }
  });
  const summary = document.createElement('p');
  summary.textContent = 'Maximum fitted-center deviation: ' + maxDifference.toExponential(4) + ' cm⁻¹';
  content.replaceChildren(table, summary);
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
    { name: 'Spike removal', params: active.params.cosmic ? `Median-based; ${active.spikesRemoved} points replaced` : 'Disabled' },
    { name: 'Baseline Correction', params: active.params.mode === 'manual' ? `Manual (${active.anchors.length} anchors)` : `SNIP (${active.params.snip} iterations)` },
    { name: 'Corrected intensity', params: active.params.clipNegative ? 'Negative values clipped to zero' : 'Negative values retained' },
    { name: 'Smoothing', params: active.params.sg === 1 ? 'Off' : `Moving average (${active.params.sg} points)` },
    { name: 'Normalization', params: active.params.norm === 'none' ? 'None' : active.params.norm.toUpperCase() },
    { name: 'Peak Detection', params: `${active.peaks.length} candidate peaks; threshold 2% of maximum processed intensity` }
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

function syncWorkspaceControls() {
  const active = state.files.get(state.activeFileId || '');
  applyProcessingControls(active?.params ?? {
    mode: 'auto', cosmic: true, snip: 25, sg: 9, clipNegative: true, norm: 'none', normTarget: null
  });
  UI.setVal('slider-stack', String(state.stackOffset));
  UI.text('val-stack', state.stackOffset.toFixed(1));
  UI.setVal('select-axis-font', String(state.axisFontSize));
  UI.setVal('input-range-min', state.viewRange?.[0].toString() ?? '');
  UI.setVal('input-range-max', state.viewRange?.[1].toString() ?? '');
  for (const [id, checked] of [
    ['check-hide-y', state.hideYAxis], ['check-direct-labels', state.showDirectLabels],
    ['check-show-unprocessed', state.showUnprocessed], ['check-show-baseline', state.showBaseline],
    ['check-hide-grid', !state.showGrid], ['check-axis-box', state.showAxisBox],
    ['check-export-transparent', state.exportTransparent]
  ] as const) {
    (UI.get(id) as HTMLInputElement).checked = checked;
  }
  UI.text('snapshot-count', String(state.snapshots.length));
  refreshReplicates();
  updateUI(false);
}

function scheduleWorkspaceSave() {
  if (!workspaceStorage || workspaceSaveQueued || workspaceClearing) return;
  workspaceSaveQueued = true;
  workspaceWrites = workspaceWrites.then(async () => {
    workspaceSaveQueued = false;
    if (workspaceClearing) return;
    const saved = state.files.size || state.snapshots.length ? structuredClone({
      ...state, selectingROI: false, ratioMode: false,
      labelMode: false, freeLabelMode: false, pendingLabel: null
    } satisfies AppState) : null;
    UI.text('workspace-save-status', 'Saving on this browser…');
    await workspaceStorage!.save(saved);
    UI.text('workspace-save-status', saved ? 'Workspace saved on this browser' : '');
  }).catch(error => {
    UI.text('workspace-save-status', error instanceof Error ? error.message : 'Workspace could not be saved on this browser.');
  });
}

async function initWorkspace() {
  const clearButton = UI.get('btn-clear-workspace') as HTMLButtonElement;
  try {
    const storage = new WorkspaceStorage<AppState>();
    const saved = await storage.load();
    if (saved) {
      Object.assign(state, saved);
      syncWorkspaceControls();
      UI.text('workspace-save-status', 'Workspace restored from this browser');
    }
    workspaceStorage = storage;
    clearButton.disabled = false;
    clearButton.addEventListener('click', async () => {
      if (queuedFiles) {
        showToast('Finish the current import before clearing the workspace.');
        return;
      }
      if (!confirm('Clear the spectra, fits, and snapshots stored in this browser?')) return;
      workspaceClearing = true;
      clearButton.disabled = true;
      try {
        await workspaceWrites;
        await storage.save(null);
        resetFitView();
        Object.assign(state, structuredClone(emptyWorkspace));
        syncWorkspaceControls();
        UI.text('workspace-save-status', '');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'The stored workspace could not be cleared.');
      } finally {
        workspaceClearing = false;
        clearButton.disabled = false;
      }
    });
  } catch {
    UI.text('workspace-save-status', 'Browser storage unavailable');
  }
}

window.addEventListener('workstation-opened', () => updateUI(false));
importQueue = importQueue.then(initWorkspace);
