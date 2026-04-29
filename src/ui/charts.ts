/**
 * Instant Raman v2.0 — Chart Renderer
 * Paper-White theme for professional research figures.
 */
declare const Plotly: any;

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
    mirror: true 
  },
  yaxis: { 
    title: { text: '<b>Intensity (a.u.)</b>', font: { size: 18, color: '#000' } }, 
    gridcolor: '#f0f0f0', 
    linecolor: '#000', 
    linewidth: 2.5, 
    tickfont: { size: 16, family: 'Arial' },
    ticks: 'outside',
    tickwidth: 2.5,
    ticklen: 12,
    zeroline: false,
    mirror: true 
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



import type { SpectralData, Peak } from '../engine/types.ts';

export class ChartRenderer {

  static renderSingle(container: HTMLElement | string, raw: SpectralData, processed: SpectralData, _baseline: SpectralData, peaks: Peak[], color?: string, range?: [number, number], isGrid = false, hideY = false, normLabel?: string, showPeaks = false, ratio?: { p1: Peak | null, p2: Peak | null } | null, fontSize = 16, showBox = true) {
    if (typeof (window as any).Plotly === 'undefined') return;
    const Plotly = (window as any).Plotly;
    
    const traces: any[] = [
      { x: raw.wavenumberData, y: raw.intensityData, mode: 'lines', name: 'Raw', line: { color: COLORS.raw, width: 1 }, hoverinfo: 'skip' },
      { x: processed.wavenumberData, y: processed.intensityData, mode: 'lines', name: 'Processed', line: { color: color || COLORS.main, width: 2.5 }, hoverinfo: 'x+y' }
    ];

    const baseLayout = isGrid ? GRID_LAYOUT : PAPER_LAYOUT;
    const layout = JSON.parse(JSON.stringify(baseLayout));
    layout.annotations = [];
    
    // Apply Axis Styling
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

    if (showPeaks || !isGrid) {
      // If showPeaks is false but we're in main view, show top 10 peaks as default indexing
      const peaksToDisplay = showPeaks ? peaks : peaks.slice(0, 10);
      const peakAnnotations = this.createPeakAnnotations(peaksToDisplay);
      layout.annotations.push(...peakAnnotations.labels);
      traces.push(...peakAnnotations.lines);
      layout.margin.t = Math.max(layout.margin.t, 80 + (peakAnnotations.maxStack * 25));
    }
    if (range) layout.xaxis.range = range;

    if (ratio && ratio.p1 && ratio.p2) {
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

    if (hideY) {
      layout.yaxis.showticklabels = false;
      layout.yaxis.title.text = '';
      layout.yaxis.ticks = '';
    }

    Plotly.react(container, traces, layout, CONFIG);
  }

  static renderOverlay(container: HTMLElement | string, datasets: { name: string; data: SpectralData; color?: string }[], range?: [number, number], isWaterfall = false, hideY = false, normLabel?: string, peaksToShow: Peak[] = [], ratio?: { p1: Peak | null, p2: Peak | null } | null, fontSize = 16, showBox = true, showDirectLabels = false, waterfallOffset = 0) {
    if (typeof (window as any).Plotly === 'undefined') return;
    const Plotly = (window as any).Plotly;

    const traces: any[] = datasets.map((d, i) => ({
      x: d.data.wavenumberData, y: d.data.intensityData, mode: 'lines', name: d.name, 
      line: { color: d.color || COLORS.trace[i % COLORS.trace.length], width: 2.5 },
      hoverinfo: 'x+y+name'
    }));
    const layout = JSON.parse(JSON.stringify(PAPER_LAYOUT));
    if (range) layout.xaxis.range = range;

    // Apply Axis Styling
    layout.font.size = fontSize;
    layout.xaxis.title.font.size = fontSize + 2;
    layout.xaxis.tickfont = { size: fontSize - 2 };
    layout.yaxis.title.font.size = fontSize + 2;
    layout.yaxis.tickfont = { size: fontSize - 2 };
    
    layout.xaxis.mirror = showBox ? 'all' : false;
    layout.yaxis.mirror = showBox ? 'all' : false;

    if (ratio && ratio.p1 && ratio.p2) {
      const intRatio = (ratio.p1.y / ratio.p2.y).toFixed(3);
      layout.annotations = [{
        text: `<b>RATIO I(${ratio.p1.x.toFixed(0)})/I(${ratio.p2.x.toFixed(0)}) = ${intRatio}</b>`,
        xref: 'paper', yref: 'paper',
        x: 0.98, y: 0.95,
        showarrow: false,
        xanchor: 'right', yanchor: 'top',
        font: { size: 12, color: '#0f172a' },
        bgcolor: 'rgba(255,255,255,0.8)',
        bordercolor: '#000',
        borderwidth: 1
      }];
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
      const peakAnnotations = this.createPeakAnnotations(peaksToShow, waterfallOffset);
      layout.annotations = [...(layout.annotations || []), ...peakAnnotations.labels];
      traces.push(...peakAnnotations.lines);
      layout.margin.t = Math.max(layout.margin.t, 80 + (peakAnnotations.maxStack * 25));
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

  static renderReplicate(container: HTMLElement | string, mean: SpectralData, sdY: number[], name: string, color: string, range?: [number, number], peaksToShow: Peak[] = []) {
    if (typeof (window as any).Plotly === 'undefined') return;
    const Plotly = (window as any).Plotly;

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

    const layout = JSON.parse(JSON.stringify(PAPER_LAYOUT));
    if (range) layout.xaxis.range = range;

    if (peaksToShow.length > 0) {
      const peakAnnotations = this.createPeakAnnotations(peaksToShow);
      layout.annotations = [...(layout.annotations || []), ...peakAnnotations.labels];
      traces.push(...peakAnnotations.lines);
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
      const response = await fetch(dataUrl);
      const blob = await response.blob();
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
      console.error('[Instant Raman] Manual download trigger failed:', err);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  static renderResidual(container: HTMLElement | string, data: SpectralData, range?: [number, number]) {
    if (typeof (window as any).Plotly === 'undefined') return;
    const Plotly = (window as any).Plotly;

    const layout = JSON.parse(JSON.stringify(PAPER_LAYOUT));
    layout.margin = { l: 60, r: 24, t: 10, b: 40 };
    layout.showlegend = false;
    layout.yaxis.title.text = 'Δ Intensity';
    if (range) layout.xaxis.range = range;

    Plotly.react(container, [{
      x: data.wavenumberData, y: data.intensityData, mode: 'lines', name: 'Residual', 
      line: { color: COLORS.residual, width: 1 }, 
      fill: 'tozeroy', fillcolor: 'rgba(190,18,60,0.05)'
    }], layout, { ...CONFIG, displayModeBar: false });
  }

  static async exportPublicationFigure(state: any, files: any[], format: 'png' | 'svg' = 'png', normLabel?: string, showPeaks = false, ratio?: { p1: Peak | null, p2: Peak | null } | null, fontSize = 16, showBox = true, showDirectLabels = false) {
    if (typeof (window as any).Plotly === 'undefined') return;
    const Plotly = (window as any).Plotly;
    
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
        x: 1, y: -0.1, showarrow: false,
        font: { size: 9, color: '#94a3b8', family: 'Arial' },
        xanchor: 'right', yanchor: 'top'
      };

      const filename = `Raman_Fig_${Date.now()}.${format}`;
      
      // Calculate Dimensions
      // Standard: 1200x800 (96 DPI)
      // Journal: mm to pixels at 96 DPI
      let exportW = 1200;
      let exportH = 800;
      let exportScale = 2; // Default scale

      if (state.exportSize !== 'full') {
        const mmToPx = 96 / 25.4;
        exportW = Math.round(state.exportWidth * mmToPx);
        exportH = Math.round(exportW * 0.75); // 4:3 aspect ratio for single/double column
        exportScale = 300 / 96; // 3.125 for 300 DPI
      }

      const exportOptions: any = { 
        format, 
        width: exportW, 
        height: exportH, 
        scale: format === 'png' ? exportScale : 1 
      };

      if (format === 'png' && state.exportTransparent) {
        // To make background transparent, we need to temporarily modify layout
        await Plotly.relayout(tempDiv, { 
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)'
        });
      }

      if (!isMatrix && !isVertical && !isStacked) {
        const f = files[0];
        const rawNormalized = { 
          wavenumberData: f.raw.wavenumberData, 
          intensityData: f.raw.intensityData.map((v: number) => v * (f.normFactor || 1)) 
        };
        this.renderSingle(tempDiv, rawNormalized, f.processed, f.baseline, f.peaks, f.color, state.viewRange || undefined, false, state.hideYAxis, normLabel, showPeaks, ratio, fontSize, showBox);
        
        // Apply sizing to layout before final render
        await Plotly.relayout(tempDiv, { width: exportW, height: exportH });

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
          return { name: f.name, data: offsetData, color: f.color };
        });
        this.renderOverlay(tempDiv, datasets, state.viewRange || undefined, true, state.hideYAxis, normLabel, showPeaks ? files[0].peaks : [], ratio, fontSize, showBox, showDirectLabels);
        
        await Plotly.relayout(tempDiv, { width: exportW, height: exportH });

        const layout = (tempDiv as any).layout;
        layout.annotations = [...(layout.annotations || []), citation];
        await Plotly.relayout(tempDiv, { annotations: layout.annotations });
        
        const dataUrl = await Plotly.toImage(tempDiv, exportOptions);
        await this.triggerDownload(dataUrl, filename);
      } else {
        const cols = isMatrix ? 2 : 1;
        const rows = isMatrix ? 2 : files.length;
        const traces: any[] = [];
        const layout: any = JSON.parse(JSON.stringify(PAPER_LAYOUT));
        layout.grid = { rows, columns: cols, pattern: 'independent' };
        layout.showlegend = false;
        
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
          
          if (showPeaks) {
            const peakAnnotations = (this as any).createPeakAnnotations(f.peaks);
            traces.push(...peakAnnotations.lines.map((l: any) => ({ ...l, xaxis: `x${axisIdx}`, yaxis: `y${axisIdx}` })));
            layout.annotations.push(...peakAnnotations.labels.map((a: any) => ({ 
              ...a, 
              xref: axisIdx ? `x${axisIdx}` : 'x', 
              yref: axisIdx ? `y${axisIdx} domain` : 'y domain' 
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

        layout.annotations.push({ ...citation, y: -0.08 }); 

        await Plotly.newPlot(tempDiv, traces, layout, CONFIG);
        
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
  private static createPeakAnnotations(peaks: Peak[], yOffset: number = 0) {
    const lines: any[] = [];
    const labels: any[] = [];
    
    // Sort peaks by wavenumber
    const sortedPeaks = [...peaks].sort((a, b) => a.x - b.x);
    
    // Stacking logic: track the last X for each level to minimize vertical space
    const levelLastX: number[] = [];
    const MIN_X_DIST = 45; // reduced slightly for tighter packing
    let maxStack = 0;

    const maxY = sortedPeaks.length > 0 ? Math.max(...sortedPeaks.map(p => p.y)) : 0;

    sortedPeaks.forEach((p) => {
      let level = 0;
      while (level < levelLastX.length && p.x < levelLastX[level] + MIN_X_DIST) {
        level++;
      }
      levelLastX[level] = p.x;
      if (level > maxStack) maxStack = level;

      // Vertical line (muted dashed)
      lines.push({
        x: [p.x, p.x],
        y: [p.y + yOffset, p.y + yOffset + (maxY * 0.02)],
        mode: 'lines',
        line: { color: '#94a3b8', width: 0.8, dash: 'dot' },
        showlegend: false,
        hoverinfo: 'skip'
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

    return { lines, labels, maxStack };
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
}
