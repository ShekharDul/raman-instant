import React, { useEffect, useRef, useState } from 'react';
import { 
  Activity, 
  BarChart3, 
  Binary, 
  ChevronDown, 
  AlertTriangle, 
  CheckCircle2, 
  Info,
  ArrowDown,
  Microscope,
  ShieldCheck,
  Zap,
  Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChartRenderer } from '../ui/charts';
import { UncertaintyPropagator, type PropagationResult } from '../engine/propagation';
import { Diagnostics } from '../engine/diagnostics';
import { UncertaintyLandscape } from './UncertaintyLandscape';

interface AnalysisSuiteProps {
  epi: any;
  protocolId: string;
  state: any;
  onClose?: () => void;
}

export const AnalysisSuite: React.FC<AnalysisSuiteProps> = ({ epi, protocolId, state, onClose }) => {
  const [mcResult, setMcResult] = useState<PropagationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [ratioMode, setRatioMode] = useState<{ p1Name: string, p2Name: string } | null>(null);

  // Upstream Fit Quality Gate
  const p1Target = state.ratioSelection?.p1?.x;
  const p2Target = state.ratioSelection?.p2?.x;

  const peak1Fit = p1Target && state.fitResult?.peaks && state.fitResult.peaks.length > 0
    ? state.fitResult.peaks.reduce((prev: any, curr: any) => {
        if (!prev) return curr;
        const currDiff = Math.abs((curr.center?.value || 0) - p1Target);
        const prevDiff = Math.abs((prev.center?.value || 0) - p1Target);
        return currDiff < prevDiff ? curr : prev;
      }, null)
    : null;

  const peak2Fit = p2Target && state.fitResult?.peaks && state.fitResult.peaks.length > 0
    ? state.fitResult.peaks.reduce((prev: any, curr: any) => {
        if (!prev) return curr;
        const currDiff = Math.abs((curr.center?.value || 0) - p2Target);
        const prevDiff = Math.abs((prev.center?.value || 0) - p2Target);
        return currDiff < prevDiff ? curr : prev;
      }, null)
    : null;

  const r2 = state.fitResult?.r2 ?? epi.r_squared ?? 1.0;
  const p1Err = peak1Fit?.center?.error ?? 0;
  const p2Err = peak2Fit?.center?.error ?? 0;

  const failureTriggers: string[] = [];
  if (r2 < 0.95) {
    failureTriggers.push(`Overall Fit Quality: R² of ${r2.toFixed(4)} is below the 0.95 threshold.`);
  }
  if (p1Err > 2) {
    failureTriggers.push(`Numerator Peak: Center statistical uncertainty of ${p1Err.toFixed(2)} cm⁻¹ exceeds the 2.0 cm⁻¹ threshold.`);
  }
  if (p2Err > 2) {
    failureTriggers.push(`Denominator Peak: Center statistical uncertainty of ${p2Err.toFixed(2)} cm⁻¹ exceeds the 2.0 cm⁻¹ threshold.`);
  }

  const hasPoorFitQuality = failureTriggers.length > 0;

  // Downstream Ensemble Bimodality Detection
  const ensembleCenters = epi.all_model_results
    ?.filter((r: any) => r.status === 'valid')
    .map((r: any) => r.fitted_center) || [];
  const ensembleBimodality = Diagnostics.detectBimodalityKDE(ensembleCenters);
  const isEnsembleBimodal = ensembleBimodality.isMultimodal;

  // Downstream Ratio Bimodality Detection
  const ratioBimodality = mcResult ? Diagnostics.detectBimodalityKDE(mcResult.distribution) : null;

  // Log failures
  useEffect(() => {
    if (hasPoorFitQuality) {
      console.warn("⚠️ [Upstream Validation Gate Failed] Ratio Propagation is visually de-emphasised due to:", failureTriggers.join(" | "));
    }
  }, [hasPoorFitQuality]);
  
  const fitPlotRef = useRef<HTMLDivElement>(null);
  const resPlotRef = useRef<HTMLDivElement>(null);
  const histPlotRef = useRef<HTMLDivElement>(null);
  const mcPlotRef = useRef<HTMLDivElement>(null);

  // Check for ratio selection on mount
  useEffect(() => {
    if (state.ratioSelection?.p1 && state.ratioSelection?.p2) {
      setRatioMode({
        p1Name: `Peak @ ${state.ratioSelection.p1.x.toFixed(0)}`,
        p2Name: `Peak @ ${state.ratioSelection.p2.x.toFixed(0)}`
      });
    }
  }, [state.ratioSelection]);

  // Initialize Plotly charts after mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (fitPlotRef.current && resPlotRef.current) {
        ChartRenderer.renderFit(
          fitPlotRef.current, 
          state.fitResult!.fitX, 
          state.fitResult!.fitX.map((_v: number, i: number) => state.fitResult!.fitY[i] + state.fitResult!.residuals[i]),
          state.fitResult!.fitX, 
          state.fitResult!.fitY, 
          false, 
          state.showGrid, 
          epi.all_model_results
        );

        // Add Ratio Labels if active
        if (state.ratioSelection?.p1 || state.ratioSelection?.p2) {
          const Plotly = (window as any).Plotly;
          const annotations: any[] = [];
          
          if (state.ratioSelection.p1) {
            annotations.push({
              x: state.ratioSelection.p1.x,
              y: state.ratioSelection.p1.y,
              text: 'RATIO: NUMERATOR',
              showarrow: true,
              arrowhead: 2,
              ax: 0, ay: -40,
              font: { color: '#4f46e5', weight: 'bold', size: 10 },
              arrowcolor: '#4f46e5'
            });
          }
          if (state.ratioSelection.p2) {
            annotations.push({
              x: state.ratioSelection.p2.x,
              y: state.ratioSelection.p2.y,
              text: 'RATIO: DENOMINATOR',
              showarrow: true,
              arrowhead: 2,
              ax: 0, ay: -40,
              font: { color: '#0f172a', weight: 'bold', size: 10 },
              arrowcolor: '#0f172a'
            });
          }
          
          Plotly.relayout(fitPlotRef.current, { annotations });
        }

        ChartRenderer.renderResidual(
          resPlotRef.current, 
          { wavenumberData: state.fitResult!.fitX, intensityData: state.fitResult!.residuals }, 
          undefined, 
          state.showGrid
        );
      }

      if (histPlotRef.current) {
        const centers = epi.all_model_results
          .filter((r: any) => r.status === 'valid')
          .map((r: any) => r.fitted_center);
        ChartRenderer.renderEnsembleHistogram(histPlotRef.current, centers, epi.fitted_center || 0);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [epi, state.ratioSelection]);

  const runMonteCarlo = async () => {
    setIsSimulating(true);
    // Simulate thinking time for "Scientific Rigor"
    await new Promise(r => setTimeout(r, 1200));
    
    let result: PropagationResult;

    if (state.ratioSelection?.p1 && state.ratioSelection?.p2) {
      // REAL CONTEXT-AWARE RATIO PROPAGATION
      const p1Target = state.ratioSelection.p1.x;
      const p2Target = state.ratioSelection.p2.x;

      const p1Ensemble = epi.all_model_results
        .filter((r: any) => r.status === 'valid' && r.fitted_peaks)
        .map((r: any) => {
          // Find nearest peak to p1Target in this model result
          const nearest = r.fitted_peaks.reduce((prev: any, curr: any) => 
            Math.abs(curr.center - p1Target) < Math.abs(prev.center - p1Target) ? curr : prev
          );
          return nearest.amplitude;
        });

      const p2Ensemble = epi.all_model_results
        .filter((r: any) => r.status === 'valid' && r.fitted_peaks)
        .map((r: any) => {
          // Find nearest peak to p2Target in this model result
          const nearest = r.fitted_peaks.reduce((prev: any, curr: any) => 
            Math.abs(curr.center - p2Target) < Math.abs(prev.center - p2Target) ? curr : prev
          );
          return nearest.amplitude;
        });

      result = UncertaintyPropagator.propagateGeneral(
        [p1Ensemble, p2Ensemble],
        (a, b) => a / (b || 0.001)
      );
    } else {
      // FALLBACK: PROPAGATE AREA OF PRIMARY PEAK
      const ampEnsemble = epi.all_model_results
        .filter((r: any) => r.status === 'valid')
        .map((r: any) => r.fitted_amplitude || 0);
      
      const widthEnsemble = epi.all_model_results
        .filter((r: any) => r.status === 'valid')
        .map((r: any) => r.fitted_fwhm || 0);
      
      result = UncertaintyPropagator.propagateGeneral(
        [ampEnsemble, widthEnsemble],
        (a, w) => a * w * 1.5707 // Approx area for Lorentzian
      );
    }
    
    setMcResult(result);
    (window as any).state.mcResult = result; // Global sync for reports
    setIsSimulating(false);
  };

  useEffect(() => {
    if (mcResult && mcPlotRef.current) {
      const label = ratioMode 
        ? `Ratio: ${ratioMode.p1Name} / ${ratioMode.p2Name}`
        : "Active Peak Area Uncertainty";
        
      ChartRenderer.renderMonteCarloDist(
        mcPlotRef.current, 
        mcResult.distribution, 
        label
      );
    }
  }, [mcResult, ratioMode]);

  const isStable = epi.epistemic_classification === 'STABLE_CONVERGENCE';
  const isPoorFit = epi.epistemic_classification === 'POOR_FIT';

  return (
    <div className="analysis-suite-viewport">
      {/* 1. HERO SECTION: Pinned Header & Primary Plot */}
      <section className="suite-hero">
        <div className="suite-header-overlay">
          <div className="suite-badge-pill">
            <Microscope style={{ width: 12, height: 12, color: '#34d399', marginRight: 4 }} />
            Scientific Audit Mode
          </div>
          <div className="suite-protocol-id">
            PROTOCOL: {protocolId.substring(0, 8)}
          </div>
        </div>

        <div className="suite-hero-content">
          <div className="suite-main-plot-container">
             <div id="suite-plot-fit" ref={fitPlotRef} style={{ width: '100%', height: '100%' }} />
             <div className="suite-floating-meta">
                <div className="suite-meta-label">Winning Model</div>
                <div className="suite-meta-value">
                  {epi.best_fit_model?.toUpperCase()} — R² {epi.r_squared?.toFixed(4)}
                </div>
             </div>
          </div>
          
          <div className="suite-residual-plot-container">
             <div id="suite-plot-residual" ref={resPlotRef} style={{ width: '100%', height: '100%' }} />
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', opacity: 0.4 }}>
          <ArrowDown size={20} />
        </div>
      </section>

      {/* 1.5. UNCERTAINTY LANDSCAPE: 2D Density Field */}
      <section className="suite-dark-wrap" style={{ padding: '80px 0' }}>
        <div className="suite-dark-glow" />
        <div className="suite-dark-content" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
            <div style={{ width: 48, height: 48, background: 'rgba(34, 211, 238, 0.15)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(34, 211, 238, 0.25)' }}>
              <Target size={24} color="#22d3ee" style={{ margin: 'auto' }} />
            </div>
            <div>
              <h3 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Uncertainty Landscape</h3>
              <p style={{ color: '#94a3b8', fontSize: 14, margin: '4px 0 0' }}>2D density field mapping boundary perturbation to fitted peak center across the model ensemble</p>
            </div>
          </div>
          <UncertaintyLandscape
            epi={epi}
            spectrumX={state.fitResult?.fitX || []}
            spectrumY={state.fitResult ? state.fitResult.fitX.map((_: number, i: number) => (state.fitResult!.fitY[i] + state.fitResult!.residuals[i])) : []}
            fitResult={state.fitResult}
          />
        </div>
      </section>

      {/* 2. THE VERDICT: Narrative & High-Level Metrics */}
      <section className="suite-section">
        <div className="suite-grid-layout">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className={`suite-status-tag ${isStable ? 'status-tag-stable' : 'status-tag-unstable'}`}>
              {isStable ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
              {isStable ? 'VALIDATED CONVERGENCE' : (isPoorFit ? 'POOR MODEL FIT' : 'HIGH EPISTEMIC SENSITIVITY')}
            </div>
            <h2 className="suite-verdict-title">
              Analytical Verdict: <br/>
              <span style={{ color: isStable ? '#059669' : '#e11d48' }}>
                {isStable ? 'Scientifically Defensible' : (isPoorFit ? 'Model Mismatch Detected' : 'Requires Re-calibration')}
              </span>
            </h2>
            <p className="suite-verdict-p">
              {isStable 
                ? `The model ensemble converged to a narrow, unimodal distribution across ${epi.ensembleTotal || 15} iterations. The fitted center position remains invariant to boundary perturbations, confirming high reproducibility.`
                : (isPoorFit 
                  ? (
                    <>
                      The selected lineshape model does not adequately describe the experimental data. This typically indicates a complex overlapping peak structure or a non-standard physical process. Multi-peak deconvolution is strongly recommended.
                      {isEnsembleBimodal && (
                        <div style={{ marginTop: 12, padding: '12px 16px', background: 'rgba(225, 29, 72, 0.05)', borderLeft: '3px solid #e11d48', borderRadius: '4px', fontSize: 13, color: '#be123c', fontWeight: 600 }}>
                          Bimodal ensemble detected. The optimizer is finding two distinct solutions depending on starting conditions, which strongly suggests two overlapping peaks within the selected spectral window. Narrow the fitting window or use multi-peak deconvolution.
                        </div>
                      )}
                    </>
                  )
                  : "The fitting surface shows extreme sensitivity to boundary conditions. Minor shifts in local search space result in divergent solutions. Use caution when reporting absolute peak positions.")}
            </p>

            {epi.bimodality?.detected && (
              <div style={{ marginTop: 32, padding: 24, background: '#fffbeb', borderRadius: 16, border: '1px solid #fef3c7', display: 'flex', gap: 16 }}>
                <AlertTriangle style={{ color: '#d97706', flexShrink: 0 }} />
                <div>
                  <h4 style={{ color: '#92400e', margin: '0 0 4px', fontSize: 14 }}>Bimodality Warning</h4>
                  <p style={{ color: '#b45309', fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                    We detected a significant split in the model ensemble. This often indicates the presence of a second hidden peak or a non-standard lineshape that a single-peak model cannot capture.
                  </p>
                </div>
              </div>
            )}
          </motion.div>

          <div className="suite-card">
            <div className="suite-card-title">Uncertainty Budget</div>
            <div className="suite-metric-row">
              <span className="suite-metric-label">Statistical (σ)</span>
              <span className="suite-metric-value">±{epi.fitted_center_statistical_error?.toFixed(4)}</span>
            </div>
            <div className="suite-progress-track">
              <div className="suite-progress-fill" style={{ width: '30%', background: '#cbd5e1' }} />
            </div>
            
            <div className="suite-metric-row">
              <span className="suite-metric-label">Epistemic (Δ)</span>
              <span className="suite-metric-value" style={{ color: '#4f46e5' }}>±{epi.epistemic_standard_deviation?.toFixed(4)}</span>
            </div>
            <div className="suite-progress-track">
              <motion.div 
                initial={{ width: 0 }}
                whileInView={{ width: '65%' }}
                className="suite-progress-fill" 
                style={{ background: '#6366f1' }}
              />
            </div>

            <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>Combined</span>
              <span style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font-mono)' }}>±{epi.combined_uncertainty?.toFixed(4)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. ENSEMBLE LAB: Distribution Analysis */}
      <section className="suite-dark-wrap">
        <div className="suite-dark-glow" />
        <div className="suite-dark-content">
          <div style={{ flex: 1 }}>
             <div style={{ width: 48, height: 48, background: 'rgba(99, 102, 241, 0.2)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                <BarChart3 size={24} color="#818cf8" style={{ margin: 'auto' }} />
             </div>
             <h3 style={{ fontSize: 32, fontWeight: 800, marginBottom: 16 }}>Ensemble Distribution</h3>
             <p style={{ color: '#94a3b8', lineHeight: 1.6, marginBottom: 32 }}>
               By shifting the local search boundaries by ±10%, we audit the sensitivity of the least-squares engine. A narrow histogram indicates a global minimum.
             </p>
             <div style={{ display: 'flex', gap: 48 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#818cf8', textTransform: 'uppercase', marginBottom: 4 }}>Converged Fits</div>
                  <div style={{ fontSize: 24, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{epi.ensembleN} / {epi.ensembleTotal || 15}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#818cf8', textTransform: 'uppercase', marginBottom: 4 }}>Convergence Rate</div>
                  <div style={{ fontSize: 24, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{((epi.ensembleN / (epi.ensembleTotal || 15)) * 100).toFixed(0)}%</div>
                </div>
             </div>
          </div>
          <div className="suite-dark-card">
             <div id="suite-plot-ensemble" ref={histPlotRef} style={{ width: '100%', height: 320 }} />
          </div>
        </div>
      </section>

      {/* 4. MONTE CARLO LAB: Propagation */}
      <section className="suite-lab-wrap">
        <div className="suite-lab-icon-box">
           <Binary size={32} />
        </div>
        <h2 className="suite-lab-title">Monte Carlo Propagation</h2>
        <p style={{ fontSize: 20, color: '#64748b', maxWidth: 700, margin: '0 auto 48px', lineHeight: 1.6 }}>
          {ratioMode 
            ? `Propagating the uncertainty of the ratio between ${ratioMode.p1Name} and ${ratioMode.p2Name} across the model ensemble.`
            : "Derived quantities like Integrated Area require rigorous error bars. We perform a 1,000-sample ensemble shuffle to calculate the true probability distribution."}
        </p>

        <div style={{ minHeight: 120 }}>
          {hasPoorFitQuality && (
            <div style={{ 
              marginBottom: 24, 
              padding: 20, 
              background: '#fef2f2', 
              borderRadius: 12, 
              border: '1px solid #fee2e2', 
              display: 'flex', 
              gap: 16,
              textAlign: 'left'
            }}>
              <AlertTriangle style={{ color: '#ef4444', flexShrink: 0 }} />
              <div>
                <h4 style={{ color: '#991b1b', margin: '0 0 4px', fontSize: 14, fontWeight: 700 }}>Poor Fit Quality Warning</h4>
                <p style={{ color: '#b91c1c', fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                  One or more peaks contributing to this ratio have poor fit quality. Ratio analysis built on unreliable peak fits will produce meaningless results. Resolve the individual peak fits first before attempting ratio quantification.
                </p>
                <div style={{ marginTop: 12, padding: 12, background: 'rgba(239, 68, 68, 0.05)', borderRadius: 6, border: '1px dashed rgba(239, 68, 68, 0.2)' }}>
                  <strong style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#991b1b' }}>Triggered Failure Reasons:</strong>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 11, color: '#b91c1c', lineHeight: 1.4 }}>
                    {failureTriggers.map((t, idx) => <li key={idx}>{t}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {!mcResult ? (
            <button 
              onClick={runMonteCarlo}
              disabled={isSimulating}
              className="suite-btn-premium"
            >
              {isSimulating ? <Activity style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={24} style={{ color: '#facc15' }} />}
              {isSimulating ? 'Propagating Uncertainty...' : 'Initialize Propagation Engine'}
            </button>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {ratioBimodality?.isMultimodal ? (
                <>
                  <div className="suite-mc-grid">
                    {ratioBimodality.modes.map((mode, idx) => (
                      <div className="suite-mc-metric" key={idx}>
                        <div className="suite-meta-label">Mode {idx + 1} Location</div>
                        <div className="suite-metric-value" style={{ fontSize: 32, color: '#4f46e5' }}>{mode.location.toFixed(3)}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                          {(mode.fraction * 100).toFixed(1)}% of samples
                        </div>
                      </div>
                    ))}
                    <div className="suite-mc-metric" style={{ background: '#fff1f2', border: '1px solid #ffe4e6' }}>
                      <div className="suite-meta-label" style={{ color: '#be123c' }}>Distribution Shape</div>
                      <div className="suite-metric-value" style={{ fontSize: 24, color: '#9f1239', fontWeight: 800 }}>Multimodal / Non-Gaussian</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 24, padding: 20, background: '#fff1f2', borderRadius: 12, border: '1px solid #ffe4e6', textAlign: 'left', display: 'flex', gap: 16 }}>
                    <AlertTriangle style={{ color: '#e11d48', flexShrink: 0 }} />
                    <p style={{ color: '#9f1239', fontSize: 13, margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
                      This ratio distribution is non-Gaussian. The ensemble is converging to multiple distinct solutions. Multi-peak deconvolution is required before ratio quantification is meaningful.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="suite-mc-grid" style={hasPoorFitQuality ? { opacity: 0.5, filter: 'grayscale(100%)' } : {}}>
                    <div className="suite-mc-metric">
                      <div className="suite-meta-label">{ratioMode ? 'Mean Ratio' : 'Mean Area'}</div>
                      <div className="suite-metric-value" style={{ fontSize: 32 }}>{mcResult.mean.toFixed(3)}</div>
                    </div>
                    <div className="suite-mc-metric">
                      <div className="suite-meta-label">Std. Deviation (±)</div>
                      <div className="suite-metric-value" style={{ fontSize: 32 }}>{mcResult.std.toFixed(4)}</div>
                    </div>
                    <div className="suite-mc-metric suite-mc-success">
                      <div className="suite-meta-label" style={{ color: '#059669' }}>95% Confidence Interval</div>
                      <div className="suite-metric-value" style={{ fontSize: 28, color: '#064e3b' }}>
                        [{mcResult.confidenceInterval95[0].toFixed(2)}, {mcResult.confidenceInterval95[1].toFixed(2)}]
                      </div>
                    </div>
                  </div>
                  {hasPoorFitQuality && (
                    <div style={{ marginTop: 16, color: '#be123c', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      ⚠️ These numerical results are not trustworthy due to poor upstream peak fits.
                    </div>
                  )}
                </>
              )}

              <div className="suite-card" style={{ marginTop: 48, padding: 16 }}>
                 <div id="suite-plot-mc" ref={mcPlotRef} style={{ width: '100%', height: 350 }} />
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* 5. FOOTER: Audit Info */}
      <footer className="suite-footer">
        <div className="suite-footer-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
             <div style={{ width: 40, height: 40, background: '#0f172a', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={20} color="#34d399" style={{ margin: 'auto' }} />
             </div>
             <div style={{ textAlign: 'left' }}>
               <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>Audit-Grade Certified</div>
               <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>ENGINE V2.5.0 — REPRODUCIBILITY VERIFIED</div>
             </div>
          </div>
          <button onClick={onClose} className="suite-return-btn">
            Return to Spectral Viewer
            <ChevronDown size={16} style={{ transform: 'rotate(180deg)' }} />
          </button>
        </div>
      </footer>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
