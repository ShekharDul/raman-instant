import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FittingEngine } from '../engine/fitting.ts';
import { Diagnostics } from '../engine/diagnostics.ts';
import type { LandscapeWorkerInput, LandscapeWorkerOutput } from '../engine/landscapeWorker.ts';

interface EnsemblePoint {
  x: number; y: number;
  fwhm: number; amplitude: number; r2: number;
  statError: number | null; modelType: string;
  boundaryLeft: number; boundaryRight: number;
  fittedPeaks: any[];
}

interface Props {
  epi: any;
  spectrumX: number[];
  spectrumY: number[];
  fitResult: any;
}

// Perceptually uniform colormap: background → indigo → violet → cyan → white
const COLORMAP: [number,number,number][] = [
  [10, 10, 15],    // 0.00 background #0a0a0f
  [14, 10, 30],    // 0.05
  [26, 10, 62],    // 0.10 deep indigo
  [42, 12, 88],    // 0.15
  [58, 16, 112],   // 0.20
  [76, 20, 136],   // 0.25
  [94, 28, 156],   // 0.30 violet
  [107, 33, 168],  // 0.35
  [112, 44, 176],  // 0.40
  [100, 60, 184],  // 0.45
  [80, 80, 192],   // 0.50 blue-violet
  [60, 108, 196],  // 0.55
  [40, 140, 200],  // 0.60
  [20, 170, 210],  // 0.65
  [10, 195, 218],  // 0.70 cyan
  [14, 210, 222],  // 0.75
  [34, 220, 226],  // 0.80 bright cyan
  [80, 228, 232],  // 0.85
  [140, 236, 240], // 0.90
  [200, 244, 248], // 0.95
  [224, 242, 254], // 1.00 near-white
];

function sampleColormap(t: number): [number,number,number] {
  const clamped = Math.max(0, Math.min(1, t));
  const idx = clamped * (COLORMAP.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, COLORMAP.length - 1);
  const frac = idx - lo;
  return [
    Math.round(COLORMAP[lo][0] + (COLORMAP[hi][0] - COLORMAP[lo][0]) * frac),
    Math.round(COLORMAP[lo][1] + (COLORMAP[hi][1] - COLORMAP[lo][1]) * frac),
    Math.round(COLORMAP[lo][2] + (COLORMAP[hi][2] - COLORMAP[lo][2]) * frac),
  ];
}

type DiagnosticCategory = 'ROBUST_FIT' | 'NOISE_DOMINATED' | 'BOUNDARY_SENSITIVE' | 'SPLIT_SOLUTION';

interface DiagnosticInfo {
  category: DiagnosticCategory;
  label: string;
  description: string;
  color: string;
}

function classifyShape(points: EnsemblePoint[], ensembleCenters: number[]): DiagnosticInfo {
  const bimodality = Diagnostics.detectBimodalityKDE(ensembleCenters);
  if (bimodality.isMultimodal) {
    return { category: 'SPLIT_SOLUTION', label: 'Split Solution', description: 'Two competing fits exist — multi-peak deconvolution required', color: '#f43f5e' };
  }
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const stdX = Diagnostics.std(xs);
  const stdY = Diagnostics.std(ys);
  const aspect = stdX > 1e-10 ? stdY / stdX : 0;

  if (aspect < 0.67) {
    return { category: 'BOUNDARY_SENSITIVE', label: 'Boundary Sensitive', description: 'A spectral feature at the window edge is pulling the fit', color: '#f59e0b' };
  }
  if (aspect > 2.0) {
    return { category: 'NOISE_DOMINATED', label: 'Statistical Noise Dominated', description: 'Multiple local minima exist independent of boundary position', color: '#8b5cf6' };
  }
  return { category: 'ROBUST_FIT', label: 'Robust Fit', description: 'Boundary perturbation does not shift the solution', color: '#34d399' };
}

const GRID_SIZE = 200;
const CANVAS_W = 720;
const CANVAS_H = 480;

export const UncertaintyLandscape: React.FC<Props> = ({ epi, spectrumX, spectrumY, fitResult }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [diagnostic, setDiagnostic] = useState<DiagnosticInfo | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: EnsemblePoint } | null>(null);
  const densityCache = useRef<LandscapeWorkerOutput | null>(null);
  const pointsCache = useRef<EnsemblePoint[]>([]);

  // Extract valid ensemble points
  const ensemblePoints: EnsemblePoint[] = React.useMemo(() => {
    if (!epi?.all_model_results) return [];
    return epi.all_model_results
      .filter((r: any) => r.status === 'valid' && r.convergence_status === 'converged')
      .map((r: any) => ({
        x: r.pert_step,
        y: r.fitted_center,
        fwhm: r.fitted_fwhm || 0,
        amplitude: r.fitted_amplitude || 0,
        r2: r.r_squared || 0,
        statError: r.fitted_center_statistical_error,
        modelType: r.model_type,
        boundaryLeft: r.boundary_left,
        boundaryRight: r.boundary_right,
        fittedPeaks: r.fitted_peaks || [{ amplitude: r.fitted_amplitude, center: r.fitted_center, fwhm: r.fitted_fwhm }]
      }));
  }, [epi]);

  // Render density field onto the main canvas
  const renderDensity = useCallback((data: LandscapeWorkerOutput) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { density, gridSize } = data;
    const imgData = ctx.createImageData(CANVAS_W, CANVAS_H);

    for (let py = 0; py < CANVAS_H; py++) {
      for (let px = 0; px < CANVAS_W; px++) {
        // Map pixel to grid indices
        const gx = (px / CANVAS_W) * (gridSize - 1);
        const gy = ((CANVAS_H - 1 - py) / CANVAS_H) * (gridSize - 1); // flip Y
        const gxi = Math.min(Math.floor(gx), gridSize - 2);
        const gyi = Math.min(Math.floor(gy), gridSize - 2);
        const fx = gx - gxi;
        const fy = gy - gyi;

        // Bilinear interpolation
        const d00 = density[gyi * gridSize + gxi];
        const d10 = density[gyi * gridSize + gxi + 1];
        const d01 = density[(gyi + 1) * gridSize + gxi];
        const d11 = density[(gyi + 1) * gridSize + gxi + 1];
        const val = d00 * (1-fx) * (1-fy) + d10 * fx * (1-fy) + d01 * (1-fx) * fy + d11 * fx * fy;

        // Apply power curve for more contrast in low-density regions
        const t = Math.pow(val, 0.6);
        const [r, g, b] = sampleColormap(t);
        const idx = (py * CANVAS_W + px) * 4;
        imgData.data[idx] = r;
        imgData.data[idx+1] = g;
        imgData.data[idx+2] = b;
        imgData.data[idx+3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }, []);

  // Render overlay: spectrum line + best fit marker + hover highlight
  const renderOverlay = useCallback((hoveredPoint: EnsemblePoint | null) => {
    const canvas = overlayRef.current;
    const data = densityCache.current;
    if (!canvas || !data) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    const { xMin, xMax, yMin, yMax } = data;

    const toPixelX = (v: number) => ((v - xMin) / (xMax - xMin)) * CANVAS_W;
    const toPixelY = (v: number) => CANVAS_H - ((v - yMin) / (yMax - yMin)) * CANVAS_H;

    // --- Spectrum overlay (secondary Y axis) ---
    if (spectrumX.length > 0 && spectrumY.length > 0) {
      const maxSpec = Math.max(...spectrumY);
      const minSpec = Math.min(...spectrumY);
      const specRange = maxSpec - minSpec || 1;
      // Map spectrum so peak sits at ~70% of plot height
      const specScale = (CANVAS_H * 0.7) / specRange;

      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;

      // Map spectrum X (wavenumber) to the canvas X range using fitted center as anchor
      const bestCenter = epi.fitted_center || Diagnostics.mean(spectrumX);
      const specMinX = Math.min(...spectrumX);
      const specMaxX = Math.max(...spectrumX);
      const specXRange = specMaxX - specMinX || 1;

      for (let i = 0; i < spectrumX.length; i++) {
        // Map spectrum x position to perturbation space (centered around 0)
        const normSX = ((spectrumX[i] - bestCenter) / (specXRange / 2)) * ((xMax - xMin) / 2);
        const px = toPixelX(normSX);
        const py = CANVAS_H - ((spectrumY[i] - minSpec) / specRange) * CANVAS_H * 0.7 - CANVAS_H * 0.05;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // --- Best fit center horizontal line ---
    if (epi.fitted_center != null) {
      const py = toPixelY(epi.fitted_center);
      ctx.beginPath();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.moveTo(0, py);
      ctx.lineTo(CANVAS_W, py);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label
      ctx.font = '11px "Inter", "SF Mono", monospace';
      ctx.fillStyle = '#facc15';
      ctx.textAlign = 'right';
      ctx.fillText(`${epi.fitted_center.toFixed(2)} cm⁻¹`, CANVAS_W - 8, py - 6);
    }

    // --- Ensemble scatter dots ---
    const points = pointsCache.current;
    for (const p of points) {
      const px = toPixelX(p.x);
      const py = toPixelY(p.y);
      ctx.beginPath();
      ctx.arc(px, py, hoveredPoint === p ? 5 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = hoveredPoint === p ? '#facc15' : 'rgba(255, 255, 255, 0.5)';
      ctx.fill();
    }

    // --- Hovered fit curve highlight ---
    if (hoveredPoint && spectrumX.length > 0) {
      const peaks = hoveredPoint.fittedPeaks;
      ctx.beginPath();
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;

      const bestCenter = epi.fitted_center || Diagnostics.mean(spectrumX);
      const specMinX = Math.min(...spectrumX);
      const specMaxX = Math.max(...spectrumX);
      const specXRange = specMaxX - specMinX || 1;
      const maxSpec = Math.max(...spectrumY);
      const minSpec = Math.min(...spectrumY);
      const specRange = maxSpec - minSpec || 1;

      for (let i = 0; i < spectrumX.length; i++) {
        let yVal = 0;
        for (const pk of peaks) {
          if (hoveredPoint.modelType === 'gaussian') yVal += FittingEngine.gaussian(spectrumX[i], pk.amplitude, pk.center, pk.fwhm);
          else if (hoveredPoint.modelType === 'voigt') yVal += FittingEngine.voigt(spectrumX[i], pk.amplitude, pk.center, pk.fwhm, 0.5);
          else yVal += FittingEngine.lorentzian(spectrumX[i], pk.amplitude, pk.center, pk.fwhm);
        }
        const normSX = ((spectrumX[i] - bestCenter) / (specXRange / 2)) * ((xMax - xMin) / 2);
        const px = toPixelX(normSX);
        const py = CANVAS_H - ((yVal - minSpec) / specRange) * CANVAS_H * 0.7 - CANVAS_H * 0.05;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }, [epi, spectrumX, spectrumY]);

  // Run KDE in Web Worker on mount
  useEffect(() => {
    if (ensemblePoints.length === 0) { setLoading(false); return; }
    pointsCache.current = ensemblePoints;

    const workerCode = `
      self.onmessage = function(e) {
        var d = e.data, pts = d.points, gs = d.gridSize, xPad = d.xPadding, yPad = d.yPadding;
        var n = pts.length;
        if (n === 0) { self.postMessage({ density: new Float64Array(gs*gs), xMin:-10, xMax:10, yMin:0, yMax:1, gridSize:gs }); return; }
        var xs = [], ys = [];
        for (var i=0;i<n;i++) { xs.push(pts[i].x); ys.push(pts[i].y); }
        var mX=0,mY=0; for(var i=0;i<n;i++){mX+=xs[i];mY+=ys[i];} mX/=n;mY/=n;
        var vX=0,vY=0; for(var i=0;i<n;i++){vX+=(xs[i]-mX)*(xs[i]-mX);vY+=(ys[i]-mY)*(ys[i]-mY);}
        var sX=Math.sqrt(vX/(n-1||1)),sY=Math.sqrt(vY/(n-1||1));
        var nf=Math.pow(n,-0.2), hx=1.06*sX*nf, hy=1.06*sY*nf;
        if(hx<1e-10)hx=1.0; if(hy<1e-10)hy=0.1;
        var rxMin=xs[0],rxMax=xs[0],ryMin=ys[0],ryMax=ys[0];
        for(var i=1;i<n;i++){if(xs[i]<rxMin)rxMin=xs[i];if(xs[i]>rxMax)rxMax=xs[i];if(ys[i]<ryMin)ryMin=ys[i];if(ys[i]>ryMax)ryMax=ys[i];}
        var xR=rxMax-rxMin||1; var xMin=rxMin-xR*(xPad/100), xMax=rxMax+xR*(xPad/100);
        var yMin=ryMin-yPad, yMax=ryMax+yPad;
        var density=new Float64Array(gs*gs), xS=(xMax-xMin)/(gs-1), yS=(yMax-yMin)/(gs-1);
        var ihx2=1/(2*hx*hx), ihy2=1/(2*hy*hy), maxD=0;
        for(var iy=0;iy<gs;iy++){var gy=yMin+iy*yS;for(var ix=0;ix<gs;ix++){var gx=xMin+ix*xS;var s=0;
        for(var k=0;k<n;k++){var dx=gx-xs[k],dy=gy-ys[k];s+=Math.exp(-(dx*dx*ihx2+dy*dy*ihy2));}
        density[iy*gs+ix]=s;if(s>maxD)maxD=s;}}
        if(maxD>0){for(var i=0;i<density.length;i++)density[i]/=maxD;}
        self.postMessage({density:density,xMin:xMin,xMax:xMax,yMin:yMin,yMax:yMax,gridSize:gs},[density.buffer]);
      };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));

    worker.onmessage = (ev: MessageEvent<LandscapeWorkerOutput>) => {
      densityCache.current = ev.data;
      renderDensity(ev.data);
      renderOverlay(null);

      // Classify diagnostic shape
      const centers = ensemblePoints.map(p => p.y);
      setDiagnostic(classifyShape(ensemblePoints, centers));
      setLoading(false);
    };

    const input: LandscapeWorkerInput = {
      points: ensemblePoints.map(p => ({ x: p.x, y: p.y })),
      gridSize: GRID_SIZE,
      xPadding: 30,
      yPadding: 0.5
    };
    worker.postMessage(input);

    return () => worker.terminate();
  }, [ensemblePoints, renderDensity, renderOverlay]);

  // Mouse hover handler
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = overlayRef.current;
    const data = densityCache.current;
    const points = pointsCache.current;
    if (!canvas || !data || points.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const px = mx * scaleX;
    const py = my * scaleY;

    const { xMin, xMax, yMin, yMax } = data;
    const dataX = xMin + (px / CANVAS_W) * (xMax - xMin);
    const dataY = yMax - (py / CANVAS_H) * (yMax - yMin);

    // Find nearest point (normalised distance)
    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;
    let best: EnsemblePoint | null = null;
    let bestDist = Infinity;
    for (const p of points) {
      const dx = (p.x - dataX) / xRange;
      const dy = (p.y - dataY) / yRange;
      const d = dx*dx + dy*dy;
      if (d < bestDist) { bestDist = d; best = p; }
    }

    if (best && bestDist < 0.05) {
      setTooltip({ x: mx, y: my, point: best });
      renderOverlay(best);
    } else {
      setTooltip(null);
      renderOverlay(null);
    }
  }, [renderOverlay]);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
    renderOverlay(null);
  }, [renderOverlay]);

  if (ensemblePoints.length < 3) return null;

  const data = densityCache.current;

  return (
    <div className="landscape-container">
      {/* Loading state */}
      {loading && (
        <div className="landscape-loading">
          <div className="landscape-loading-pulse" />
          <span>Computing density field...</span>
        </div>
      )}

      {/* Canvas stack */}
      <div className="landscape-canvas-wrap">
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="landscape-canvas" />
        <canvas
          ref={overlayRef}
          width={CANVAS_W} height={CANVAS_H}
          className="landscape-canvas landscape-overlay"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />

        {/* Axis labels */}
        {data && !loading && (
          <>
            {/* X axis ticks */}
            <div className="landscape-axis-x">
              {[-10, -5, 0, 5, 10].map(v => {
                const pct = ((v - data.xMin) / (data.xMax - data.xMin)) * 100;
                if (pct < 0 || pct > 100) return null;
                return <span key={v} className="landscape-tick" style={{ left: `${pct}%` }}>{v}%</span>;
              })}
            </div>
            <div className="landscape-axis-x-label">Boundary Perturbation (% of window width)</div>

            {/* Y axis ticks */}
            <div className="landscape-axis-y">
              {(() => {
                const ticks: number[] = [];
                const range = data.yMax - data.yMin;
                const step = range > 2 ? 0.5 : range > 1 ? 0.2 : 0.1;
                const first = Math.ceil(data.yMin / step) * step;
                for (let v = first; v <= data.yMax; v += step) ticks.push(v);
                return ticks.map(v => {
                  const pct = ((v - data.yMin) / (data.yMax - data.yMin)) * 100;
                  return <span key={v} className="landscape-tick-y" style={{ bottom: `${pct}%` }}>{v.toFixed(1)}</span>;
                });
              })()}
            </div>
            <div className="landscape-axis-y-label">Fitted Center (cm⁻¹)</div>
          </>
        )}

        {/* Diagnostic badge */}
        {diagnostic && !loading && (
          <div className="landscape-diagnostic-badge" style={{ borderColor: diagnostic.color, color: diagnostic.color }}>
            <span className="landscape-diag-dot" style={{ background: diagnostic.color }} />
            {diagnostic.label}
            <span className="landscape-diag-desc">{diagnostic.description}</span>
          </div>
        )}

        {/* Tooltip */}
        {tooltip && (
          <div
            className="landscape-tooltip"
            style={{
              left: Math.min(tooltip.x + 16, CANVAS_W - 220),
              top: Math.max(tooltip.y - 10, 10)
            }}
          >
            <div className="landscape-tt-row"><span className="landscape-tt-label">Perturbation</span><span>{tooltip.point.x}%</span></div>
            <div className="landscape-tt-row"><span className="landscape-tt-label">Center</span><span>{tooltip.point.y.toFixed(3)} cm⁻¹</span></div>
            <div className="landscape-tt-row"><span className="landscape-tt-label">Width</span><span>{tooltip.point.fwhm.toFixed(2)} cm⁻¹</span></div>
            <div className="landscape-tt-row"><span className="landscape-tt-label">R²</span><span>{tooltip.point.r2.toFixed(4)}</span></div>
            <div className="landscape-tt-row"><span className="landscape-tt-label">Stat. Uncert.</span><span>{tooltip.point.statError != null ? `±${tooltip.point.statError.toFixed(4)}` : '—'}</span></div>
            <div className="landscape-tt-model">{tooltip.point.modelType.toUpperCase()}</div>
          </div>
        )}
      </div>
    </div>
  );
};
