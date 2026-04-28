/**
 * RamanInstant v2.0 — Chart Renderer
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
  margin: { l: 90, r: 160, t: 50, b: 110 }, // Increased bottom margin for watermark
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



export class ChartRenderer {

  static renderSingle(container: HTMLElement | string, x: number[], rawY: number[], processedY: number[], _baselineY: number[], peaks: { x: number; y: number }[], color?: string, range?: [number, number], isGrid = false, hideY = false) {
    if (typeof (window as any).Plotly === 'undefined') return;
    const Plotly = (window as any).Plotly;
    
    const traces: any[] = [
      { x, y: rawY, mode: 'lines', name: 'Raw', line: { color: COLORS.raw, width: 1 }, hoverinfo: 'skip' },
      { x, y: processedY, mode: 'lines', name: 'Processed', line: { color: color || COLORS.main, width: 2.5 }, hoverinfo: 'x+y' }
    ];

    const annotations: any[] = isGrid ? [] : peaks.slice(0, 5).map(p => ({
      x: p.x, y: p.y, text: `${p.x.toFixed(0)}`, showarrow: true, arrowhead: 0, ax: 0, ay: -15,
      font: { size: 9, family: 'JetBrains Mono', color: '#000' },
      bgcolor: '#fff', bordercolor: '#000', borderwidth: 1, borderpad: 2
    }));
    
    const baseLayout = isGrid ? GRID_LAYOUT : PAPER_LAYOUT;
    const layout = JSON.parse(JSON.stringify(baseLayout));
    layout.annotations = annotations;
    if (range) layout.xaxis.range = range;

    if (hideY) {
      layout.yaxis.showticklabels = false;
      layout.yaxis.title.text = '';
      layout.yaxis.ticks = '';
    }

    Plotly.react(container, traces, layout, CONFIG);
  }

  static renderOverlay(container: HTMLElement | string, datasets: { name: string; x: number[]; y: number[]; color?: string }[], range?: [number, number], isWaterfall = false, hideY = false) {
    if (typeof (window as any).Plotly === 'undefined') return;
    const Plotly = (window as any).Plotly;

    const traces: any[] = datasets.map((d, i) => ({
      x: d.x, y: d.y, mode: 'lines', name: d.name, 
      line: { color: d.color || COLORS.trace[i % COLORS.trace.length], width: 2.5 },
      hoverinfo: 'x+y+name'
    }));

    const layout = JSON.parse(JSON.stringify(PAPER_LAYOUT));
    if (range) layout.xaxis.range = range;

    if (isWaterfall) {
      layout.yaxis.title.text = '<b>Offset Intensity (a.u.)</b>';
      if (hideY) {
        layout.yaxis.showticklabels = false;
        layout.yaxis.title.text = '';
        layout.yaxis.ticks = '';
      }
      
      // Add per-trace labels on the right
      layout.annotations = datasets.map((d) => {
        const lastY = d.y[d.y.length - 1];
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
      // Adjust margin for labels
      layout.margin.r = 140;
    }

    Plotly.react(container, traces, layout, CONFIG);
  }

  static renderReplicate(container: HTMLElement | string, x: number[], meanY: number[], sdY: number[], name: string, color: string, range?: [number, number]) {
    if (typeof (window as any).Plotly === 'undefined') return;
    const Plotly = (window as any).Plotly;

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
    Plotly.react(container, traces, layout, CONFIG);
  }

  private static hexToRgb(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
  }

  static renderResidual(container: HTMLElement | string, x: number[], residualY: number[], range?: [number, number]) {
    if (typeof (window as any).Plotly === 'undefined') return;
    const Plotly = (window as any).Plotly;

    const layout = JSON.parse(JSON.stringify(PAPER_LAYOUT));
    layout.margin = { l: 60, r: 24, t: 10, b: 40 };
    layout.showlegend = false;
    layout.yaxis.title.text = 'Δ Intensity';
    if (range) layout.xaxis.range = range;

    Plotly.react(container, [{
      x, y: residualY, mode: 'lines', name: 'Residual', 
      line: { color: COLORS.residual, width: 1 }, 
      fill: 'tozeroy', fillcolor: 'rgba(190,18,60,0.05)'
    }], layout, { ...CONFIG, displayModeBar: false });
  }

  static async exportPublicationFigure(state: any, files: any[], format: 'png' | 'svg' = 'png') {
    if (typeof (window as any).Plotly === 'undefined') return;
    const Plotly = (window as any).Plotly;
    
    const isMatrix = state.layoutMode === 'grid2x2';
    const isVertical = state.layoutMode === 'grid2x1';
    const isStacked = state.layoutMode === 'stacked';
    
    // Create a temporary hidden container
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'fixed';
    tempDiv.style.left = '-9999px';
    document.body.appendChild(tempDiv);

    try {
      const citation = {
        text: 'RAMANINSTANT — OPEN RESEARCH',
        xref: 'paper', yref: 'paper',
        x: 1.1, y: -0.1, showarrow: false,
        font: { size: 9, color: '#94a3b8', family: 'Arial' },
        xanchor: 'right', yanchor: 'top'
      };

      if (!isMatrix && !isVertical && !isStacked) {
        // Simple Single Export
        const f = files[0];
        this.renderSingle(tempDiv, f.raw.x, f.raw.y, f.processedY, f.baselineY, f.peaks, f.color, state.viewRange || undefined, false, state.hideYAxis);
        const layout = (tempDiv as any).layout;
        layout.annotations = [...(layout.annotations || []), citation];
        await Plotly.relayout(tempDiv, { annotations: layout.annotations });
        await Plotly.downloadImage(tempDiv, { format, width: 1200, height: 800, scale: 2, filename: `Raman_Fig_${Date.now()}` });
      } else if (isStacked) {
        // Waterfall Export
        const datasets = files.map((f, i) => {
          const { normalized } = (window as any).SpectralProcessor.normalizeMax(f.processedY);
          return { name: f.name, x: f.raw.x, y: normalized.map((v: number) => v + i * state.stackOffset), color: f.color };
        });
        this.renderOverlay(tempDiv, datasets, state.viewRange || undefined, true, state.hideYAxis);
        const layout = (tempDiv as any).layout;
        layout.annotations = [...(layout.annotations || []), citation];
        await Plotly.relayout(tempDiv, { annotations: layout.annotations });
        await Plotly.downloadImage(tempDiv, { format, width: 1200, height: 800, scale: 2, filename: `Raman_Waterfall_${Date.now()}` });
      } else {
        // Multi-Panel Grid Export
        const cols = isMatrix ? 2 : 1;
        const rows = isMatrix ? 2 : files.length;
        const traces: any[] = [];
        const layout: any = JSON.parse(JSON.stringify(PAPER_LAYOUT));
        layout.grid = { rows, columns: cols, pattern: 'independent' };
        layout.showlegend = false;
        layout.width = 1000 * cols;
        layout.height = 700 * rows;
        layout.margin = { l: 80, r: 40, t: 80, b: 120 };

        files.slice(0, cols * rows).forEach((f, i) => {
          const axisIdx = i === 0 ? '' : (i + 1);
          traces.push({
            x: f.raw.x, y: f.raw.y, mode: 'lines', name: 'Raw', line: { color: COLORS.raw, width: 1 },
            xaxis: `x${axisIdx}`, yaxis: `y${axisIdx}`, hoverinfo: 'skip'
          });
          traces.push({
            x: f.raw.x, y: f.processedY, mode: 'lines', name: 'Processed', line: { color: f.color || COLORS.main, width: 2.5 },
            xaxis: `x${axisIdx}`, yaxis: `y${axisIdx}`, hoverinfo: 'skip'
          });

          const panelLabel = String.fromCharCode(65 + i);
          layout[`xaxis${axisIdx}`] = { ...PAPER_LAYOUT.xaxis, title: { text: `Shift (cm⁻¹)`, font: { size: 14 } }, tickfont: { size: 12 } };
          layout[`yaxis${axisIdx}`] = { ...PAPER_LAYOUT.yaxis, title: { text: `Int`, font: { size: 14 } }, tickfont: { size: 12 } };
          
          if (state.hideYAxis) {
            layout[`yaxis${axisIdx}`].showticklabels = false;
            layout[`yaxis${axisIdx}`].title.text = '';
            layout[`yaxis${axisIdx}`].ticks = '';
          }

          if (!layout.annotations) layout.annotations = [];
          layout.annotations.push({
            text: `<b>(${panelLabel}) ${f.name}</b>`, font: { size: 18 },
            xref: `x${axisIdx} domain`, yref: `y${axisIdx} domain`,
            x: 0, y: 1.1, showarrow: false, xanchor: 'left'
          });
        });

        // Add citation to grid
        layout.annotations.push({ ...citation, x: 1.05, y: -0.05 }); 

        await Plotly.newPlot(tempDiv, traces, layout, CONFIG);
        await Plotly.downloadImage(tempDiv, { format, width: layout.width, height: layout.height, scale: 2, filename: `Raman_Matrix_${Date.now()}` });
      }
    } finally {
      document.body.removeChild(tempDiv);
    }
  }

  static renderSparkline(canvas: HTMLCanvasElement, y: number[]) {
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
