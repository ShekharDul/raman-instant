/**
 * Instant Raman v2.0 — Chart Renderer
 * Paper-White theme for professional research figures.
 */
declare const Plotly: any;
import { formatStatisticalError } from '../engine/fitting.ts';

// Swiss Modernist Palette
const COLORS = {
  main: '#0f172a',    // Oxford Blue (Ink)
  baseline: '#94a3b8',// Slate Gray
  residual: '#be123c',// Crimson
  raw: '#e2e8f0',     // Hairline Gray
  grid: '#f1f5f9',    // Ghost White Grid
  paper: '#ffffff',
  trace: [
    '#332288', // Indigo
    '#88CCEE', // Cyan
    '#44AA99', // Teal
    '#117733', // Green
    '#999933', // Olive
    '#DDCC77', // Sand
    '#CC6677', // Rose
    '#882255'  // Wine
  ]
};

const PAPER_LAYOUT: any = {
  paper_bgcolor: COLORS.paper,
  plot_bgcolor: COLORS.paper,
  font: { 
    family: 'Arial, sans-serif', 
    color: '#000000', 
    size: 16 // Massive base font
  },
  margin: { l: 90, r: 160, t: 80, b: 110 }, // Increased top margin for peak labels
  showlegend: true,
  legend: { 
    font: { size: 12 }, 
    bgcolor: 'rgba(255,255,255,0.95)', 
    orientation: 'v' as const, // Vertical for cleaner sidebar look
    x: 1.05, 
    y: 1,
    bordercolor: '#000',
    borderwidth: 1.5
  },
  xaxis: { 
    title: { text: '<b>Raman Shift (cm⁻¹)</b>', font: { size: 18, color: '#000' } }, 
    gridcolor: '#f0f0f0', 
    linecolor: '#000', 
    linewidth: 2.5, 
    tickfont: { size: 16, family: 'Arial' },
    ticks: 'outside',
    tickwidth: 2.5,
    ticklen: 12,
    zeroline: false,
    mirror: true,
    rangemode: 'nonnegative'
  },
  yaxis: { 
    title: { text: '<b>Intensity (a.u.)</b>', font: { size: 18, color: '#000' } }, 
    gridcolor: '#f0f0f0', 
    linecolor: '#000', 
    linewidth: 2.5, 
    tickfont: { size: 16, family: 'Arial' },
    ticks: 'outside',
    ticklen: 12,
    zeroline: false,
    mirror: true,
    rangemode: 'nonnegative'
  },
  hovermode: 'x unified' as const
};

const CONFIG: any = { 
  responsive: true, 
  displaylogo: false, 
  modeBarButtonsToRemove: ['lasso2d', 'autoScale2d'] as any[],
  modeBarButtonsToAdd: ['select2d']
};

const GRID_LAYOUT: any = {
  ...PAPER_LAYOUT,
  showlegend: false,
  autosize: true,
  margin: { l: 70, r: 20, t: 30, b: 70 },
  xaxis: { 
    ...PAPER_LAYOUT.xaxis, 
    title: { text: '<b>Shift (cm⁻¹)</b>', font: { size: 15 } },
    tickfont: { size: 14 },
    ticklen: 8
  },
  yaxis: { 
    ...PAPER_LAYOUT.yaxis, 
    title: { text: '<b>Intensity</b>', font: { size: 15 } },
    tickfont: { size: 14 },
    ticklen: 8
  }
};



import type { SpectralData, Peak, CustomLabel } from '../engine/types.ts';
import { FittingEngine, type PeakFit } from '../engine/fitting.ts';

export class ChartRenderer {

  static renderSingle(container: HTMLElement | string, raw: SpectralData, processed: SpectralData, _baseline: SpectralData, peaks: Peak[], color?: string, range?: [number, number], isGrid = false, hideY = false, normLabel?: string, ratio?: { p1: Peak | null, p2: Peak | null } | null, fontSize = 16, showBox = true, showUnprocessed = true, showBaseline = false, showGrid = true, customLabels: CustomLabel[] = []) {
    if (typeof (window as any).Plotly === 'undefined') return;
    const Plotly = (window as any).Plotly;
    
    const traces: any[] = [];
    const baseLayout = isGrid ? GRID_LAYOUT : PAPER_LAYOUT;
    const layout = JSON.parse(JSON.stringify(baseLayout));
    layout.shapes = [];
    layout.annotations = [];
    
    if (showUnprocessed) {
      traces.push({ x: raw.wavenumberData, y: raw.intensityData, mode: 'lines', name: 'Raw Input', line: { color: '#94a3b8', width: 1 }, opacity: 0.4, hoverinfo: 'skip' });
    }
    
    // Systematic Fix: Render baseline if requested
    if (showBaseline && _baseline) {
      traces.push({ x: _baseline.wavenumberData, y: _baseline.intensityData, mode: 'lines', name: 'Baseline (Est)', line: { color: '#94a3b8', width: 1.5, dash: 'dot' }, opacity: 0.8, hoverinfo: 'skip' });
    }

    traces.push({ x: processed.wavenumberData, y: processed.intensityData, mode: 'lines', name: 'Processed', line: { color: color || COLORS.main, width: 2.5 }, hoverinfo: 'x+y' });
    
    // Apply Axis Styling
    layout.xaxis.showgrid = showGrid;
    layout.yaxis.showgrid = showGrid;
    layout.font.size = fontSize;
    layout.xaxis.title.font.size = fontSize + 2;
    layout.xaxis.tickfont = { size: fontSize - 2 };
    layout.yaxis.title.font.size = fontSize + 2;
    layout.yaxis.tickfont = { size: fontSize - 2 };
    
    layout.xaxis.mirror = showBox ? 'all' : false;
    layout.yaxis.mirror = showBox ? 'all' : false;
    
    if (normLabel && !isGrid) {
      layout.annotations.push({
        text: `<b>NORM: ${normLabel.toUpperCase()}</b>`,
        xref: 'paper', yref: 'paper',
        x: 0, y: 1.05, showarrow: false,
        font: { size: 10, color: '#64748b', family: 'Arial' },
        xanchor: 'left', yanchor: 'bottom'
      });
    }

    if (peaks.length > 0) {
      const peakAnnotations = this.createPeakAnnotations(peaks);
      layout.annotations.push(...peakAnnotations.labels);
      layout.shapes = [...(layout.shapes || []), ...peakAnnotations.shapes];
      layout.margin.t = Math.max(layout.margin.t, 80 + (peakAnnotations.maxStack * 25));
    }

    if (customLabels.length > 0) {
      layout.annotations.push(...this.createCustomLabelAnnotations(customLabels));
    }
    
    // Data-Driven View Clipping (X and Y)
    const xData = raw.wavenumberData;
    const yData = processed.intensityData;
    
    const stateMaxX = (window as any).state?.maxXData || 4000;
    if (!range && xData.length > 0) {
      const minX = Math.min(xData[0], xData[xData.length - 1]);
      const maxX = Math.max(xData[0], xData[xData.length - 1]);
      layout.xaxis.range = [Math.max(0, minX), Math.min(stateMaxX, maxX)];
    } else if (range) {
      layout.xaxis.range = [Math.max(0, range[0]), Math.min(stateMaxX, range[1])];
    }

    if (yData.length > 0) {
      // Robust Y-Scaling: Use only visible points if zoomed
      let visibleY = yData;
      if (layout.xaxis.range) {
        const [xMin, xMax] = layout.xaxis.range;
        const indices = [];
        for (let i = 0; i < xData.length; i++) {
          if (xData[i] >= xMin && xData[i] <= xMax) indices.push(i);
        }
        if (indices.length > 0) {
          visibleY = indices.map(idx => yData[idx]);
        }
      }
      
      const maxY = visibleY.reduce((a, b) => Math.max(a, b), -Infinity);
      const minY = visibleY.reduce((a, b) => Math.min(a, b), Infinity);
      layout.yaxis.range = [Math.max(0, minY - (maxY * 0.05)), maxY * 1.15];
    }

    // Ratio Markers
    if (ratio) {
      layout.shapes = layout.shapes || [];
      layout.annotations = layout.annotations || [];
      [ratio.p1, ratio.p2].forEach((p, idx) => {
        if (!p) return;
        layout.shapes.push({
          type: 'line', xref: 'x', yref: 'y',
          x0: p.x, x1: p.x, y0: 0, y1: p.y,
          line: { color: '#4f46e5', width: 2, dash: 'dot' }
        });
        layout.annotations.push({
          x: p.x, y: p.y, xref: 'x', yref: 'y',
          text: `<b>P${idx + 1}</b>`, showarrow: true, arrowhead: 2,
          ax: 0, ay: -40, font: { size: 12, color: '#4f46e5' },
          bgcolor: 'rgba(255,255,255,0.9)', bordercolor: '#4f46e5', borderwidth: 1
        });
      });

      if (ratio.p1 && ratio.p2) {
        const intRatio = (ratio.p1.y / ratio.p2.y).toFixed(3);
        const areaRatio = (ratio.p1.area / ratio.p2.area).toFixed(3);
        layout.annotations.push({
          text: `<b>RATIO I(${ratio.p1.x.toFixed(0)})/I(${ratio.p2.x.toFixed(0)}) = ${intRatio}</b><br>Area Ratio = ${areaRatio}`,
          xref: 'paper', yref: 'paper',
          x: 0.98, y: 0.95,
          showarrow: false,
          xanchor: 'right', yanchor: 'top',
          font: { size: 12, color: '#0f172a', family: 'Arial' },
          bgcolor: 'rgba(255,255,255,0.85)',
          bordercolor: '#cbd5e1',
          borderwidth: 1,
          borderpad: 4
        });
      }
    }

    if (hideY) {
      layout.yaxis.showticklabels = false;
      layout.yaxis.title.text = '';
      layout.yaxis.ticks = '';
    }

    Plotly.react(container, traces, layout, CONFIG);
  }

  static renderOverlay(container: HTMLElement | string, datasets: { name: string, data: SpectralData, color: string, raw?: SpectralData, baseline?: SpectralData, labels?: CustomLabel[] }[], range?: [number, number], isWaterfall = false, hideY = false, normLabel?: string, peaksToShow: Peak[] = [], ratio?: { p1: Peak | null, p2: Peak | null } | null, fontSize = 16, showBox = true, showDirectLabels = false, showUnprocessed = true, showBaseline = false, showGrid = true, globalLabels: CustomLabel[] = []) {
    if (typeof (window as any).Plotly === 'undefined') return;
    const Plotly = (window as any).Plotly;
    
    const traces: any[] = [];
    const layout = JSON.parse(JSON.stringify(PAPER_LAYOUT));
    
    // Systematic Fix: Grid visibility
    layout.xaxis.showgrid = showGrid;
    layout.yaxis.showgrid = showGrid;
    
    datasets.forEach((d, i) => {
      const offset = isWaterfall ? (i * ((window as any).state?.stackOffset || 0)) : 0;
      
      if (showUnprocessed && d.raw) {
        traces.push({
          x: d.raw.wavenumberData, 
          y: d.raw.intensityData.map((v) => v + offset),
          mode: 'lines', 
          name: `Raw (${d.name})`,
          line: { color: '#94a3b8', width: 1 },
          opacity: 0.4, 
          hoverinfo: 'skip',
          showlegend: false
        });
      }

      if (showBaseline && d.baseline) {
        traces.push({
          x: d.baseline.wavenumberData, 
          y: d.baseline.intensityData.map((v) => v + offset),
          mode: 'lines', 
          name: `Baseline (${d.name})`,
          line: { color: '#94a3b8', width: 1, dash: 'dot' },
          opacity: 0.5, 
          hoverinfo: 'skip',
          showlegend: false
        });
      }

      traces.push({
        x: d.data.wavenumberData, 
        y: d.data.intensityData.map((v) => v + offset),
        mode: 'lines', name: d.name, 
        line: { color: d.color || COLORS.trace[i % COLORS.trace.length], width: 2.5 },
        hoverinfo: 'x+y+name'
      });
    });

    layout.shapes = [];
    layout.annotations = [];
    if (range) layout.xaxis.range = [Math.max(0, range[0]), range[1]];

    // Apply Axis Styling
    layout.font.size = fontSize;
    layout.xaxis.title.font.size = fontSize + 2;
    layout.xaxis.tickfont = { size: fontSize - 2 };
    layout.yaxis.title.font.size = fontSize + 2;
    layout.yaxis.tickfont = { size: fontSize - 2 };
    
    layout.xaxis.mirror = showBox ? 'all' : false;
    layout.yaxis.mirror = showBox ? 'all' : false;

    // Ratio Markers
    if (ratio) {
      layout.shapes = layout.shapes || [];
      layout.annotations = layout.annotations || [];
      [ratio.p1, ratio.p2].forEach((p, idx) => {
        if (!p) return;
        layout.shapes.push({
          type: 'line', xref: 'x', yref: 'y',
          x0: p.x, x1: p.x, y0: 0, y1: p.y,
          line: { color: '#4f46e5', width: 2, dash: 'dot' }
        });
        layout.annotations.push({
          x: p.x, y: p.y, xref: 'x', yref: 'y',
          text: `<b>P${idx + 1}</b>`, showarrow: true, arrowhead: 2,
          ax: 0, ay: -40, font: { size: 12, color: '#4f46e5' },
          bgcolor: 'rgba(255,255,255,0.9)', bordercolor: '#4f46e5', borderwidth: 1
        });
      });

      if (ratio.p1 && ratio.p2) {
        const intRatio = (ratio.p1.y / ratio.p2.y).toFixed(3);
        layout.annotations.push({
          text: `<b>RATIO I(${ratio.p1.x.toFixed(0)})/I(${ratio.p2.x.toFixed(0)}) = ${intRatio}</b>`,
          xref: 'paper', yref: 'paper',
          x: 0.98, y: 0.95,
          showarrow: false,
          xanchor: 'right', yanchor: 'top',
          font: { size: 12, color: '#0f172a' },
          bgcolor: 'rgba(255,255,255,0.8)',
          bordercolor: '#cbd5e1',
          borderwidth: 1
        });
      }
    }
    if (normLabel) {
      layout.annotations = layout.annotations || [];
      layout.annotations.push({
        text: `<b>NORM: ${normLabel.toUpperCase()}</b>`,
        xref: 'paper', yref: 'paper',
        x: 0, y: 1.05, showarrow: false,
        font: { size: 10, color: '#64748b', family: 'Arial' },
        xanchor: 'left', yanchor: 'bottom'
      });
    }

    if (showDirectLabels && isWaterfall) {
      layout.showlegend = false;
      datasets.forEach((d) => {
        const lastIdx = d.data.wavenumberData.length - 1;
        layout.annotations.push({
          x: d.data.wavenumberData[lastIdx],
          y: d.data.intensityData[lastIdx],
          text: `<b>${d.name}</b>`,
          showarrow: false,
          xanchor: 'left',
          yanchor: 'middle',
          xshift: 8,
          font: { size: fontSize - 4, color: '#000' }
        });
      });
      // Adjust margin to fit labels
      layout.margin.r = 160;
    }

    if (peaksToShow.length > 0) {
      const peakAnnotations = this.createPeakAnnotations(peaksToShow);
      layout.annotations = [...(layout.annotations || []), ...peakAnnotations.labels];
      layout.shapes = [...(layout.shapes || []), ...peakAnnotations.shapes];
      layout.margin.t = Math.max(layout.margin.t, 80 + (peakAnnotations.maxStack * 25));
    }

    // Add per-trace custom labels (handling waterfall offsets)
    datasets.forEach((d, i) => {
      if (d.labels && d.labels.length > 0) {
        const offset = isWaterfall ? (i * ((window as any).state?.stackOffset || 0)) : 0;
        const offsetLabels = d.labels.map(l => ({ ...l, y: l.y + offset }));
        layout.annotations.push(...this.createCustomLabelAnnotations(offsetLabels));
      }
    });

    if (globalLabels.length > 0) {
      layout.annotations.push(...this.createCustomLabelAnnotations(globalLabels));
    }


    // Data-Driven View Clipping (X and Y)
    if (datasets.length > 0) {
      const minsX = datasets.map(d => d.data.wavenumberData[0]);
      const maxsX = datasets.map(d => d.data.wavenumberData[d.data.wavenumberData.length - 1]);
      
      const minX = Math.min(...minsX, ...maxsX);
      const absMaxX = Math.max(...minsX, ...maxsX);

      const stateMaxX = (window as any).state?.maxXData || 4000;
      if (!range) {
        layout.xaxis.range = [Math.max(0, minX), Math.min(stateMaxX, absMaxX)];
      } else {
        layout.xaxis.range = [Math.max(0, range[0]), Math.min(stateMaxX, range[1])];
      }

      // Robust Y-Scaling for Overlay
      const [curXMin, curXMax] = layout.xaxis.range;
      let globalMinY = Infinity;
      let globalMaxY = -Infinity;

      datasets.forEach(d => {
        const x = d.data.wavenumberData;
        const y = isWaterfall ? d.data.intensityData.map((v) => v + (datasets.indexOf(d) * ((window as any).state?.stackOffset || 0))) : d.data.intensityData;
        
        for (let i = 0; i < x.length; i++) {
          if (x[i] >= curXMin && x[i] <= curXMax) {
            if (y[i] < globalMinY) globalMinY = y[i];
            if (y[i] > globalMaxY) globalMaxY = y[i];
          }
        }
      });

      if (globalMaxY === -Infinity) {
        // Fallback if no points visible
        globalMaxY = 1;
        globalMinY = 0;
      }

      layout.yaxis.range = [Math.max(0, globalMinY - (globalMaxY * 0.05)), globalMaxY * 1.15];
    }

    if (isWaterfall) {
      layout.yaxis.title.text = '<b>Offset Intensity (a.u.)</b>';
      if (hideY) {
        layout.yaxis.showticklabels = false;
        layout.yaxis.title.text = '';
        layout.yaxis.ticks = '';
      }
      
      // Add per-trace labels on the right without overwriting peak labels
      layout.annotations = layout.annotations || [];
      const traceLabels = datasets.map((d) => {
        const lastY = d.data.intensityData[d.data.intensityData.length - 1];
        return {
          x: 1, y: lastY, xref: 'paper', yref: 'y',
          text: `<b>${d.name}</b>`,
          showarrow: false,
          xanchor: 'left',
          font: { size: 12, color: d.color || COLORS.main },
          bgcolor: 'rgba(255,255,255,0.7)',
          borderpad: 2
        };
      });
      layout.annotations.push(...traceLabels);
      // Adjust margin for labels
      layout.margin.r = 140;
    }

    Plotly.react(container, traces, layout, CONFIG);
  }

  static renderReplicate(container: HTMLElement | string, mean: SpectralData, sdY: number[], name: string, color: string, range?: [number, number], peaksToShow: Peak[] = [], showGrid = true, customLabels: CustomLabel[] = []) {
    if (typeof (window as any).Plotly === 'undefined') return;
    const Plotly = (window as any).Plotly;

    const layout = JSON.parse(JSON.stringify(PAPER_LAYOUT));
    layout.xaxis.showgrid = showGrid;
    layout.yaxis.showgrid = showGrid;

    const x = mean.wavenumberData;
    const meanY = mean.intensityData;
    const upperSD = meanY.map((v, i) => v + sdY[i]);
    const lowerSD = meanY.map((v, i) => v - sdY[i]);

    const traces: any[] = [
      {
        x: x, y: upperSD, mode: 'lines', line: { width: 0 }, 
        showlegend: false, hoverinfo: 'skip'
      },
      {
        x: x, y: lowerSD, mode: 'lines', line: { width: 0 }, 
        fill: 'tonexty', fillcolor: `rgba(${this.hexToRgb(color)}, 0.15)`,
        name: `±1 SD (${name})`, hoverinfo: 'skip'
      },
      {
        x: x, y: meanY, mode: 'lines', name: `Mean (${name})`, 
        line: { color: color, width: 3 },
        hoverinfo: 'x+y+name'
      }
    ];

    layout.shapes = [];
    layout.annotations = [];
    if (range) layout.xaxis.range = [Math.max(0, range[0]), range[1]];

    if (peaksToShow.length > 0) {
      const peakAnnotations = this.createPeakAnnotations(peaksToShow);
      layout.annotations = [...(layout.annotations || []), ...peakAnnotations.labels];
      layout.shapes = [...(layout.shapes || []), ...peakAnnotations.shapes];
    }

    if (customLabels.length > 0) {
      layout.annotations.push(...this.createCustomLabelAnnotations(customLabels));
    }


    // Data-Driven View Clipping (X and Y)
    if (x.length > 0) {
      const minX = Math.min(x[0], x[x.length - 1]);
      const absMaxX = Math.max(x[0], x[x.length - 1]);

      const stateMaxX = (window as any).state?.maxXData || 4000;
      if (!range) {
        layout.xaxis.range = [Math.max(0, minX), Math.min(stateMaxX, absMaxX)];
      } else {
        layout.xaxis.range = [Math.max(0, range[0]), Math.min(stateMaxX, range[1])];
      }

      // Robust Y-Scaling for Replicate
      const [curXMin, curXMax] = layout.xaxis.range;
      let visibleY = [];
      for (let i = 0; i < x.length; i++) {
        if (x[i] >= curXMin && x[i] <= curXMax) {
          visibleY.push(meanY[i]);
        }
      }

      if (visibleY.length > 0) {
        const maxY = visibleY.reduce((a, b) => Math.max(a, b), -Infinity);
        const minY = visibleY.reduce((a, b) => Math.min(a, b), Infinity);
        layout.yaxis.range = [Math.max(0, minY - (maxY * 0.05)), maxY * 1.15];
      }
    }

    Plotly.react(container, traces, layout, CONFIG);
  }


  private static hexToRgb(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
  }

  private static async triggerDownload(dataUrl: string, filename: string) {
    try {
      // Direct data URL to blob conversion for better reliability with large files
      let blob: Blob;
      if (dataUrl.startsWith('data:')) {
        const parts = dataUrl.split(',');
        const contentType = parts[0].split(':')[1].split(';')[0];
        const byteString = atob(parts[1]);
        const arrayBuffer = new ArrayBuffer(byteString.length);
        const uint8Array = new Uint8Array(arrayBuffer);
        for (let i = 0; i < byteString.length; i++) {
          uint8Array[i] = byteString.charCodeAt(i);
        }
        blob = new Blob([arrayBuffer], { type: contentType });
      } else {
        const response = await fetch(dataUrl);
        blob = await response.blob();
      }
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
    } catch (err) {
      console.error('[Instant Raman] Download trigger failed:', err);
      // Fallback to direct link click
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  static renderFit(container: HTMLElement | string, rawX: number[], rawY: number[], fitX: number[], fitY: number[], showXLabels = false, showGrid = true, perturbationResults: any[] = []) {
    if (typeof (window as any).Plotly === 'undefined') return;
    const Plotly = (window as any).Plotly;

    const layout = JSON.parse(JSON.stringify(PAPER_LAYOUT));
    layout.xaxis.showgrid = showGrid;
    layout.yaxis.showgrid = showGrid;
    layout.showlegend = false; // Hide legend for cleaner academic look as requested

    const traces: any[] = [];

    // 1. Perturbation Traces (Background)
    perturbationResults.forEach((pr) => {
      if (pr.convergence_status === 'converged') {
        const py = fitX.map(xv => {
          const a = pr.fitted_amplitude;
          const c = pr.fitted_center;
          const w = pr.fitted_fwhm;
          if (pr.model_type === 'voigt') return FittingEngine.voigt(xv, a, c, w, 0.5);
          if (pr.model_type === 'gaussian') return FittingEngine.gaussian(xv, a, c, w);
          return FittingEngine.lorentzian(xv, a, c, w);
        });
        traces.push({
          x: fitX, y: py, mode: 'lines',
          line: { 
            color: pr.model_type === 'lorentzian' ? '#332288' : pr.model_type === 'gaussian' ? '#88CCEE' : '#CC6677',
            width: 0.5
          },
          opacity: 0.15,
          hoverinfo: 'skip'
        });
      }
    });

    // 2. Raw Data
    traces.push({
      x: rawX, y: rawY, mode: 'lines',
      name: 'Experimental',
      line: { color: '#94a3b8', width: 1 },
      opacity: 0.5,
      hoverinfo: 'skip'
    });

    // 3. Best Fit Model (Bold)
    traces.push({
      x: fitX, y: fitY, mode: 'lines',
      name: 'Best Fit',
      line: { color: '#0f172a', width: 3 },
      hoverinfo: 'x+y'
    });

    layout.margin = { l: 80, r: 40, t: 10, b: showXLabels ? 50 : 5 };
    layout.xaxis.range = [Math.min(...rawX), Math.max(...rawX)];
    layout.xaxis.showticklabels = showXLabels;
    if (!showXLabels) layout.xaxis.title.text = '';
    
    Plotly.react(container, traces, layout, CONFIG);
  }

  static renderResidual(container: HTMLElement | string, data: SpectralData, range?: [number, number], showGrid = true) {
    if (typeof (window as any).Plotly === 'undefined') return;
    const Plotly = (window as any).Plotly;

    const layout = JSON.parse(JSON.stringify(PAPER_LAYOUT));
    layout.xaxis.showgrid = showGrid;
    layout.yaxis.showgrid = showGrid;
    layout.margin = { l: 80, r: 40, t: 5, b: 60 };
    layout.showlegend = false;
    layout.yaxis.title.text = 'Δ (a.u.)';
    
    // Zero-center calculation
    const absMax = Math.max(...data.intensityData.map(Math.abs));
    layout.yaxis.range = [-absMax * 1.2, absMax * 1.2];
    
    if (range) layout.xaxis.range = range;

    Plotly.react(container, [{
      x: data.wavenumberData, y: data.intensityData, mode: 'lines', name: 'Residual', 
      line: { color: '#be123c', width: 1 }, 
      fill: 'tozeroy', fillcolor: 'rgba(190,18,60,0.05)'
    }], layout, { ...CONFIG, displayModeBar: false });
  }

  static async exportPublicationFigure(state: any, files: any[], format: 'png' | 'svg' = 'png', normLabel?: string, ratio?: { p1: Peak | null, p2: Peak | null } | null, fontSize = 16, showBox = true, showDirectLabels = false, showUnprocessed = true, showBaseline = false, showGrid = true) {
    if (typeof (window as any).Plotly === 'undefined') return;
    const Plotly = (window as any).Plotly;
    
    const isFitting = state.fittingMode && state.fitResult;
    const isMatrix = state.layoutMode === 'grid2x2';
    const isVertical = state.layoutMode === 'grid2x1';
    const isStacked = state.layoutMode === 'stacked';
    
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'fixed';
    tempDiv.style.left = '-9999px';
    document.body.appendChild(tempDiv);

    try {
      const citation = {
        text: 'INSTANT RAMAN — OPEN RESEARCH',
        xref: 'paper', yref: 'paper',
        x: 1, y: 0, 
        yshift: -100, // Fixed offset below X-axis
        showarrow: false,
        font: { size: 9, color: '#94a3b8', family: 'Arial' },
        xanchor: 'right', yanchor: 'top'
      };

      const filename = `Raman_Fig_${Date.now()}.${format}`;
      
      // Calculate Dimensions
      // Standard: 1200x800 (96 DPI)
      // Journal: mm to pixels at 96 DPI
      const exportW = 1200;
      const exportH = 800;
      const exportScale = 2; // Fixed high-quality scale for PNGs

      const exportOptions: any = { 
        format, 
        width: exportW, 
        height: exportH, 
        scale: format === 'png' ? exportScale : 1 
      };

      // Transparency logic moved to after plot initialization inside branches
      const applyTransparency = async () => {
        if (format === 'png' && state.exportTransparent) {
          await Plotly.relayout(tempDiv, { 
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)'
          });
        }
      };

      if (isFitting) {
        const result = state.fitResult;
        const traces: any[] = [];
        
        // 1. Fit Traces (Row 1)
        traces.push({
          x: result.fitX,
          y: result.fitX.map((_: any, i: number) => result.fitY[i] + result.residuals[i]),
          mode: 'markers',
          name: 'Experimental Data',
          marker: { color: '#94a3b8', size: 4, opacity: 0.6 },
          xaxis: 'x', yaxis: 'y'
        });
        
        traces.push({
          x: result.fitX,
          y: result.fitY,
          mode: 'lines',
          name: 'Cumulative Fit',
          line: { color: '#0f172a', width: 2.5 },
          xaxis: 'x', yaxis: 'y'
        });
        
        result.peaks.forEach((p: PeakFit, i: number) => {
          const y = result.fitX.map((xv: number) => {
            const c = p.center.value || 0;
            const a = p.amplitude.value || 0;
            const f = p.fwhm.value || 0;
            if (p.type === 'voigt') return FittingEngine.voigt(xv, a, c, f, p.shape?.value || 0.5);
            if (p.type === 'gaussian') return FittingEngine.gaussian(xv, a, c, f);
            return FittingEngine.lorentzian(xv, a, c, f);
          });
          traces.push({
            x: result.fitX,
            y,
            mode: 'lines',
            name: `Peak ${i + 1} (${(p.center.value || 0).toFixed(1)})`,
            line: { color: COLORS.trace[i % COLORS.trace.length], width: 1.5 },
            fill: 'tozeroy',
            fillcolor: `rgba(${this.hexToRgb(COLORS.trace[i % COLORS.trace.length])}, 0.1)`,
            xaxis: 'x', yaxis: 'y'
          });
        });
        
        // 2. Residual Trace (Row 2)
        traces.push({
          x: result.fitX,
          y: result.residuals,
          mode: 'lines',
          name: 'Residual',
          line: { color: '#be123c', width: 1 },
          fill: 'tozeroy',
          fillcolor: 'rgba(190,18,60,0.05)',
          xaxis: 'x', yaxis: 'y2'
        });
        
        const layout = JSON.parse(JSON.stringify(PAPER_LAYOUT));
        layout.grid = { rows: 2, columns: 1, pattern: 'independent' };
        layout.width = exportW;
        layout.height = exportH;
        layout.margin = { l: 90, r: 160, t: 80, b: 140 };
        
        // Fit View (Top)
        layout.yaxis = { ...PAPER_LAYOUT.yaxis, domain: [0.3, 1], anchor: 'x', title: { text: '<b>Intensity (a.u.)</b>' } };
        
        // Residual View (Bottom)
        layout.yaxis2 = { ...PAPER_LAYOUT.yaxis, domain: [0, 0.2], anchor: 'x', title: { text: '<b>Δ (a.u.)</b>' } };
        
        // Shared X-Axis
        layout.xaxis = { ...PAPER_LAYOUT.xaxis, anchor: 'y2' };
        
        const xRange = [Math.min(...result.fitX), Math.max(...result.fitX)];
        layout.xaxis.range = xRange;
        
        const absMax = Math.max(...result.residuals.map(Math.abs));
        layout.yaxis2.range = [-absMax * 1.2, absMax * 1.2];
        
        layout.annotations = [...(layout.annotations || []), citation];
        
        await Plotly.newPlot(tempDiv, traces, layout, CONFIG);
        await applyTransparency();
        
        const dataUrl = await Plotly.toImage(tempDiv, exportOptions);
        await this.triggerDownload(dataUrl, filename);
      } else if (!isMatrix && !isVertical && !isStacked) {
        const f = files[0];
        const rawNormalized = { 
          wavenumberData: f.raw.wavenumberData, 
          intensityData: f.raw.intensityData.map((v: number) => v * (f.normFactor || 1)) 
        };
        const filteredPeaks = f.peaks.filter((p: any) => f.selectedPeakX.has(p.x));
        this.renderSingle(tempDiv, rawNormalized, f.processed, f.baseline, filteredPeaks, f.color, (state as any).viewRange || undefined, false, (state as any).hideYAxis, normLabel, ratio, fontSize, showBox, showUnprocessed, showBaseline, showGrid, f.labels);
        
        // Apply sizing and transparency after plot creation
        await Plotly.relayout(tempDiv, { 
          width: exportW, 
          height: exportH,
          'margin.b': 140 // Ensure enough space for citation
        });

        await applyTransparency();

        const layout = (tempDiv as any).layout;
        layout.annotations = [...(layout.annotations || []), citation];
        await Plotly.relayout(tempDiv, { annotations: layout.annotations });
        
        const dataUrl = await Plotly.toImage(tempDiv, exportOptions);
        await this.triggerDownload(dataUrl, filename);
      } else if (isStacked) {
        const datasets = files.map((f, i) => {
          let displayData = f.processed;
          if (state.normalizationMode === 'none') {
            displayData = (window as any).SpectralProcessor.normalizeMax(f.processed).normalized;
          }
          const offset = i * state.stackOffset;
          const offsetData = {
            wavenumberData: displayData.wavenumberData,
            intensityData: displayData.intensityData.map((v: number) => v + offset)
          };
          return { name: f.name, data: offsetData, color: f.color, labels: f.labels };
        });
        
        // For stacked view, we show peaks of the active file or first file if not specified
        const activeFile = files.find((f: any) => f.id === state.activeFileId) || files[0];
        const filteredPeaks = activeFile.peaks.filter((p: any) => activeFile.selectedPeakX.has(p.x));
        
        this.renderOverlay(tempDiv, datasets, state.viewRange || undefined, true, state.hideYAxis, normLabel, filteredPeaks, ratio, fontSize, showBox, showDirectLabels, showUnprocessed, showBaseline, showGrid);
        
        await Plotly.relayout(tempDiv, { 
          width: exportW, 
          height: exportH,
          'margin.b': 140 
        });

        await applyTransparency();

        const layout = (tempDiv as any).layout;
        layout.annotations = [...(layout.annotations || []), citation];
        await Plotly.relayout(tempDiv, { annotations: layout.annotations });
        
        const dataUrl = await Plotly.toImage(tempDiv, exportOptions);
        await this.triggerDownload(dataUrl, filename);
      } else {
        const cols = isMatrix ? 2 : 1;
        const rows = isMatrix ? 2 : files.length;
        const traces: any[] = [];
        const layout = JSON.parse(JSON.stringify(PAPER_LAYOUT));
        layout.shapes = [];
        layout.annotations = [];
        layout.grid = { rows, columns: cols, pattern: 'independent' };
        layout.showlegend = false;
        
        // Systematic Fix: Grid visibility for grid exports
        layout.xaxis.showgrid = showGrid;
        layout.yaxis.showgrid = showGrid;
        
        // Adjust for journal sizing if needed
        layout.width = exportW;
        layout.height = exportH;
        
        layout.margin = { l: 80, r: 40, t: 80, b: 120 };

        files.slice(0, cols * rows).forEach((f, i) => {
          const axisIdx = i === 0 ? '' : (i + 1);
          const rawNormalized = { 
            wavenumberData: f.raw.wavenumberData, 
            intensityData: f.raw.intensityData.map((v: number) => v * (f.normFactor || 1)) 
          };
          traces.push({
            x: rawNormalized.wavenumberData, y: rawNormalized.intensityData, mode: 'lines', name: 'Raw', line: { color: COLORS.raw, width: 1 },
            xaxis: `x${axisIdx}`, yaxis: `y${axisIdx}`, hoverinfo: 'skip'
          });
          traces.push({
            x: f.processed.wavenumberData, y: f.processed.intensityData, mode: 'lines', name: 'Processed', line: { color: f.color || COLORS.main, width: 2.5 },
            xaxis: `x${axisIdx}`, yaxis: `y${axisIdx}`, hoverinfo: 'skip'
          });
          
          const filteredPeaks = f.peaks.filter((p: any) => f.selectedPeakX.has(p.x));
          if (filteredPeaks.length > 0) {
            const peakAnnotations = (this as any).createPeakAnnotations(filteredPeaks);
            layout.shapes = layout.shapes || [];
            layout.shapes.push(...peakAnnotations.shapes.map((s: any) => ({
              ...s,
              xref: axisIdx ? `x${axisIdx}` : 'x',
              yref: axisIdx ? `y${axisIdx} domain` : 'y domain'
            })));
            layout.annotations = layout.annotations || [];
            layout.annotations.push(...peakAnnotations.labels.map((a: any) => ({ 
              ...a, 
              xref: axisIdx ? `x${axisIdx}` : 'x', 
              yref: axisIdx ? `y${axisIdx} domain` : 'y domain' 
            })));
          }

          if (f.labels && f.labels.length > 0) {
            const customAnnos = (this as any).createCustomLabelAnnotations(f.labels);
            layout.annotations.push(...customAnnos.map((a: any) => ({
              ...a,
              xref: axisIdx ? `x${axisIdx}` : 'x',
              yref: axisIdx ? `y${axisIdx}` : 'y'
            })));
          }

          const panelLabel = String.fromCharCode(65 + i);
          layout[`xaxis${axisIdx}`] = { ...PAPER_LAYOUT.xaxis, title: { text: `Shift (cm⁻¹)`, font: { size: 14 } }, tickfont: { size: 12 } };
          layout[`yaxis${axisIdx}`] = { ...PAPER_LAYOUT.yaxis, title: { text: `Int`, font: { size: 14 } }, tickfont: { size: 12 } };
          
          if (state.hideYAxis) {
            layout[`yaxis${axisIdx}`].showticklabels = false;
            layout[`yaxis${axisIdx}`].title.text = '';
            layout[`yaxis${axisIdx}`].ticks = '';
          }

          if (!layout.annotations) layout.annotations = [];
          if (normLabel) {
            layout.annotations.push({
              text: `NORM: ${normLabel.toUpperCase()}`,
              xref: `x${axisIdx} domain`, yref: `y${axisIdx} domain`,
              x: 1, y: 1.1, showarrow: false, xanchor: 'right', font: { size: 10, color: '#64748b' }
            });
          }
          layout.annotations.push({
            text: `<b>(${panelLabel}) ${f.name}</b>`, font: { size: 18 },
            xref: `x${axisIdx} domain`, yref: `y${axisIdx} domain`,
            x: 0, y: 1.1, showarrow: false, xanchor: 'left'
          });
        });

        layout.annotations = layout.annotations || [];
        layout.annotations.push(citation); 
        layout.margin.b = 140;

        await Plotly.newPlot(tempDiv, traces, layout, CONFIG);
        await applyTransparency();
        
        const dataUrl = await Plotly.toImage(tempDiv, exportOptions);
        await this.triggerDownload(dataUrl, filename);
      }
    } finally {
      document.body.removeChild(tempDiv);
    }
  }

  /**
   * Generates peak annotation lines and labels with collision detection.
   */
  private static createPeakAnnotations(peaks: Peak[]) {
    const shapes: any[] = [];
    const labels: any[] = [];
    
    // Sort peaks by wavenumber
    const sortedPeaks = [...peaks].sort((a, b) => a.x - b.x);
    
    // Stacking logic: track the last X for each level to minimize vertical space
    const levelLastX: number[] = [];
    const MIN_X_DIST = 45; // reduced slightly for tighter packing
    let maxStack = 0;

    sortedPeaks.forEach((p) => {
      let level = 0;
      while (level < levelLastX.length && p.x < levelLastX[level] + MIN_X_DIST) {
        level++;
      }
      levelLastX[level] = p.x;
      if (level > maxStack) maxStack = level;

      // Vertical line (full height, dotted, muted)
      shapes.push({
        type: 'line',
        xref: 'x',
        yref: 'paper',
        x0: p.x,
        x1: p.x,
        y0: 0,
        y1: 1,
        line: {
          color: 'rgba(71, 85, 105, 0.7)',
          width: 1.2,
          dash: 'dot'
        },
        layer: 'below'
      });

      // Label (small, readable, offset vertically if stacked)
      labels.push({
        x: p.x,
        y: 1.02 + (level * 0.05), // paper relative
        xref: 'x',
        yref: 'paper',
        text: `<b>${p.x.toFixed(1)}</b>`,
        showarrow: false,
        font: { size: 9, color: '#475569', family: 'Arial' },
        xanchor: 'center',
        yanchor: 'bottom'
      });
    });

    return { shapes, labels, maxStack };
  }

  private static createCustomLabelAnnotations(customLabels: CustomLabel[]) {
    return customLabels.map(l => ({
      x: l.x,
      y: l.y,
      text: `<b>${l.text}</b>`,
      showarrow: true,
      arrowhead: 2,
      arrowsize: 1,
      arrowwidth: 1.5,
      arrowcolor: '#3b82f6',
      ax: 20,
      ay: -30,
      font: { size: 12, color: '#3b82f6', family: 'Arial' },
      bgcolor: 'rgba(255,255,255,0.95)',
      bordercolor: '#3b82f6',
      borderwidth: 1.5,
      borderpad: 4,
      captureevents: true,
      name: `customlabel:${l.id}`
    }));
  }

  static renderSparkline(canvas: HTMLCanvasElement, data: SpectralData) {
    const y = data.intensityData;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const w = canvas.width = canvas.offsetWidth * 2; const h = canvas.height = canvas.offsetHeight * 2;
    const maxY = Math.max(...y); const minY = Math.min(...y); const range = maxY - minY || 1;
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i < w; i++) {
      const idx = Math.min(Math.floor((i / w) * y.length), y.length - 1);
      const py = h - ((y[idx] - minY) / range) * h * 0.8 - h * 0.1;
      if (i === 0) ctx.moveTo(i, py); else ctx.lineTo(i, py);
    }
    ctx.stroke();
  }

  static renderUncertaintyPanel(container: HTMLElement | string, epiResult: any, baseCenter: number) {
    if (typeof (window as any).Plotly === 'undefined') return;
    const Plotly = (window as any).Plotly;

    const allResults = epiResult.all_model_results || [];
    const validResults = allResults.filter((r: any) => 
      r.convergence_status === 'converged' && !r.outlier_excluded
    );

    // Edge Case: No converged fits or invalid result
    const hasConverged = allResults.some((r: any) => r.convergence_status === 'converged');
    if (!hasConverged) {
      Plotly.newPlot(container, [], {
        paper_bgcolor: 'white',
        plot_bgcolor: 'white',
        annotations: [{
          text: "Fitting failed. No valid model converged for this region.",
          showarrow: false,
          font: { size: 14, family: 'Arial', color: '#64748b' }
        }],
        xaxis: { visible: false },
        yaxis: { visible: false }
      }, { displayModeBar: false });
      return;
    }

    const lCol = COLORS.trace[0];
    const gCol = COLORS.trace[1];
    const vCol = COLORS.trace[2]; // Paul Tol 3rd color
    const primaryBlue = COLORS.trace[0];

    const traces: any[] = [];

    // 1. KDE Curve (Background)
    const validCenters = validResults.map((r: any) => r.fitted_center);
    const n = validCenters.length;
    
    if (n >= 4) {
      const mean = validCenters.reduce((a: number, b: number) => a + b, 0) / n;
      const sd = Math.sqrt(validCenters.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / n) || 0.001;
      
      // Fix 2: KDE Sigma Guard
      if (sd >= 0.005) {
        const h = 1.06 * sd * Math.pow(n, -0.2);
      
      const xMin = Math.min(...validCenters);
      const xMax = Math.max(...validCenters);
      const span = xMax - xMin;
      const pad = Math.max(1, span * 0.5);
      
      const kdeX = [];
      const kdeY = [];
      const steps = 200;
      const start = xMin - pad;
      const end = xMax + pad;
      
      for (let i = 0; i <= steps; i++) {
        const xi = start + (i / steps) * (end - start);
        let val = 0;
        for (const c of validCenters) {
          const u = (xi - c) / h;
          val += (1 / (h * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * u * u);
        }
        kdeX.push(xi);
        kdeY.push(val / n);
      }
      
      // Scale KDE height to look natural in the jitter space [-0.4, 0.4]
      const maxKDE = Math.max(...kdeY);
      const scaledKDEY = kdeY.map(v => (v / maxKDE) * 0.8 - 0.4);

        traces.push({
          x: kdeX,
          y: scaledKDEY,
          fill: 'tozeroy',
          type: 'scatter',
          mode: 'lines',
          fillcolor: 'rgba(51, 34, 136, 0.1)', // Paul Tol Indigo (10% opacity)
          line: { color: 'rgba(51, 34, 136, 0.2)', width: 1 },
          hoverinfo: 'skip',
          showlegend: false
        });
      }
    }

    const addedLegends = new Set<string>();

    const modelGroupIndex: Record<string, number> = {
      'lorentzian': 0, 'gaussian': 0, 'voigt': 0
    };
    const BASE_Y: Record<string, number> = {
      'lorentzian': 0.3,
      'gaussian': 0.0,
      'voigt': -0.3
    };
    const SUB_JITTER = [-0.08, -0.04, 0.0, 0.04, 0.08];

    // 2. Scatter Points (with Jitter)
    allResults.forEach((r: any) => {
      if (r.convergence_status !== 'converged') return;
      
      const stepIndex = modelGroupIndex[r.model_type] || 0;
      modelGroupIndex[r.model_type]++;
      
      const jitter = BASE_Y[r.model_type] + SUB_JITTER[stepIndex % SUB_JITTER.length];
      const baseColor = r.model_type === 'lorentzian' ? lCol : (r.model_type === 'gaussian' ? gCol : vCol);
      const isOutlier = r.outlier_excluded;
      
      let showLegend = false;
      const modelName = r.model_type.charAt(0).toUpperCase() + r.model_type.slice(1);
      if (!isOutlier && !addedLegends.has(r.model_type)) {
        showLegend = true;
        addedLegends.add(r.model_type);
      }

      traces.push({
        x: [r.fitted_center],
        y: [jitter],
        mode: 'markers',
        type: 'scatter',
        marker: {
          symbol: isOutlier ? 'x' : 'circle',
          size: isOutlier ? 10 : 8,
          color: baseColor,
          opacity: isOutlier ? 0.3 : 0.7,
          line: { width: isOutlier ? 0 : 0.5, color: '#fff' }
        },
        name: modelName,
        legendgroup: r.model_type,
        showlegend: showLegend,
        hoverlabel: { bgcolor: '#fff', font: { family: 'monospace', size: 11 } },
        hovertemplate: 
          `<b>Model:</b> ${r.model_type.toUpperCase()}<br>` +
          `<b>Center:</b> ${r.fitted_center.toFixed(4)} cm⁻¹<br>` +
          `<b>Precision:</b> ${formatStatisticalError(r.fitted_center_statistical_error)}<br>` +
          `<b>Status:</b> ${isOutlier ? 'Outlier excluded — ' + (r.exclusion_reason || 'Range violation') : 'Valid'}<extra></extra>`
      });
    });

    // 3. Rug Plot
    validResults.forEach((r: any) => {
      const color = r.model_type === 'lorentzian' ? lCol : (r.model_type === 'gaussian' ? gCol : vCol);
      traces.push({
        x: [r.fitted_center, r.fitted_center],
        y: [-0.6 - 0.075, -0.6 + 0.075],
        mode: 'lines',
        type: 'scatter',
        line: { color: color, width: 1 },
        hoverinfo: 'skip',
        showlegend: false
      });
    });

    // Axis and Range Logic
    const epiMin = epiResult.epistemic_center_min;
    const epiMax = epiResult.epistemic_center_max;
    
    let xRange;
    if (epiMin === null || epiMax === null || epiMin === epiMax) {
      xRange = [baseCenter - 2, baseCenter + 2];
    } else {
      const range = epiMax - epiMin;
      if (range < 4) {
        xRange = [baseCenter - 2, baseCenter + 2];
      } else {
        xRange = [epiMin - 0.5, epiMax + 0.5];
      }
    }

    // Fix 3: Adaptive Tick Density
    const computeTickInterval = (min: number, max: number) => {
      const range = Math.abs(max - min);
      if (range > 20) return 5;
      if (range > 10) return 2;
      if (range > 4) return 1;
      if (range > 1) return 0.5;
      if (range > 0.2) return 0.1;
      if (range > 0.05) return 0.02;
      return 0.01;
    };
    const tickInterval = computeTickInterval(xRange[0], xRange[1]);

    const layout: any = {
      paper_bgcolor: 'white',
      plot_bgcolor: 'white',
      xaxis: {
        title: { text: 'Wavenumber (cm⁻¹)', font: { size: 12, family: 'Arial' } },
        range: xRange,
        gridcolor: '#f0f0f0',
        dtick: tickInterval,
        nticks: 8,
        tickangle: -45,
        linecolor: '#000',
        linewidth: 1,
        showgrid: true,
        zeroline: false,
        tickfont: { size: 11 }
      },
      yaxis: {
        range: [-0.75, 0.55],
        visible: false,
        zeroline: true,
        zerolinecolor: '#f8fafc',
        zerolinewidth: 1
      },
      margin: { l: 20, r: 20, t: 40, b: 50 },
      showlegend: true,
      legend: {
        orientation: 'h',
        yanchor: 'bottom',
        y: 1.02,
        xanchor: 'right',
        x: 1,
        font: { size: 11 },
        bgcolor: 'rgba(0,0,0,0)',
        borderwidth: 0
      },
      shapes: [
        // Best fit center (Solid)
        {
          type: 'line', xref: 'x', yref: 'paper',
          x0: baseCenter, x1: baseCenter, y0: 0, y1: 1,
          line: { color: primaryBlue, width: 2 }
        }
      ]
    };

    // Epistemic Boundary Lines (Dashed)
    if (epiMin !== null && epiMax !== null && epiMin !== epiMax) {
      layout.shapes.push(
        {
          type: 'line', xref: 'x', yref: 'paper',
          x0: epiMin, x1: epiMin, y0: 0, y1: 1,
          line: { color: primaryBlue, width: 1, dash: 'dash' },
          opacity: 0.5
        },
        {
          type: 'line', xref: 'x', yref: 'paper',
          x0: epiMax, x1: epiMax, y0: 0, y1: 1,
          line: { color: primaryBlue, width: 1, dash: 'dash' },
          opacity: 0.5
        }
      );
    }

    Plotly.react(container, traces, layout, { displayModeBar: false, responsive: true });
  }
}
