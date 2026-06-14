import React, { useEffect, useState, useMemo } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Zap,
  ShieldCheck,
  CheckCircle2,
  Image as ImageIcon,
  BarChart3,
  Lock,
  Download
} from 'lucide-react';
import rawDataStr from './assets/Sample_Data_2.txt?raw';
import { SpectralProcessor } from './engine/processor';

interface LandingProps {
  onEnterWorkstation: () => void;
}

const Landing: React.FC<LandingProps> = ({ onEnterWorkstation }) => {
  const [showSignUp, setShowSignUp] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [viewMode, setViewMode] = useState<'before' | 'after'>('before');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('signup') === 'true') {
      setShowSignUp(true);
    }
  }, []);

  const handleSignUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailError('Email is required.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    const baseLink = "https://rzp.io/rzp/HMU46eo";
    const checkoutUrl = `${baseLink}?email=${encodeURIComponent(trimmedEmail)}&prefill[email]=${encodeURIComponent(trimmedEmail)}`;

    window.open(checkoutUrl, '_blank');
  };

  // --- DATA PROCESSING FOR PLOTLY ---
  const plotData = useMemo(() => {
    const lines = rawDataStr.split('\n');
    const x: number[] = [];
    const yRaw: number[] = [];

    for (const line of lines) {
      if (line.trim().startsWith('#') || !line.trim()) continue;
      const parts = line.split('\t');
      if (parts.length >= 2) {
        x.push(parseFloat(parts[0]));
        yRaw.push(parseFloat(parts[1]));
      }
    }

    // Apply the exact processing engine used in the workstation
    const spectralData = { wavenumberData: x, intensityData: yRaw };
    
    // 1. Calculate the SNIP baseline (25 iterations is the default in the workstation)
    const baselineData = SpectralProcessor.baselineSNIP(spectralData, 25);
    
    // 2. Subtract the baseline
    const baselineCorrectedY = yRaw.map((v, i) => v - baselineData.intensityData[i]);
    
    // 3. Apply Savitzky-Golay smoothing (window size 9 is the default)
    const correctedData = { wavenumberData: x, intensityData: baselineCorrectedY };
    const smoothedData = SpectralProcessor.savitzkyGolay(correctedData, 9);
    
    const yAfter = smoothedData.intensityData;

    return { x, yRaw, yAfter };
  }, []);

  useEffect(() => {
    // Only render plot if we are not in signup mode
    if (showSignUp) return;

    const Plotly = (window as any).Plotly;
    if (!Plotly) return;

    const trace = {
      x: plotData.x,
      y: viewMode === 'before' ? plotData.yRaw : plotData.yAfter,
      mode: 'lines',
      line: {
        color: viewMode === 'before' ? '#94a3b8' : '#0284c7',
        width: 1.5
      },
      name: viewMode === 'before' ? 'Raw Spectrum' : 'Corrected & Fitted'
    };

    const layout = {
      margin: { t: 20, r: 20, b: 40, l: 50 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      xaxis: { title: 'Raman Shift (cm⁻¹)', showgrid: false, zeroline: false },
      yaxis: { title: 'Intensity (a.u.)', showgrid: true, gridcolor: '#f1f5f9', zeroline: false },
      showlegend: false,
      hovermode: 'closest'
    };

    Plotly.newPlot('lp-plotly-div', [trace], layout, { displayModeBar: false, responsive: true });
  }, [viewMode, plotData, showSignUp]);


  /* ════════════════════════════════════
     SIGN-UP FLOW (Access Purchase)
     ════════════════════════════════════ */
  if (showSignUp) {
    return (
      <div className="lp-signup-root">
        <header className="lp-signup-nav">
          <div className="lp-signup-nav-inner">
            <button className="lp-back-btn" onClick={() => {
              setShowSignUp(false);
              const url = new URL(window.location.href);
              url.searchParams.delete('signup');
              window.history.replaceState({}, '', url.toString());
            }}>
              <ArrowLeft size={16} /> Back to Workstation
            </button>
            <div className="lp-brand">
              <span className="lp-brand-instant">Instant</span><span className="lp-brand-raman">Raman</span>
            </div>
          </div>
        </header>

        <main className="lp-signup-container">
          <div className="lp-signup-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <ShieldCheck size={24} color="#0284c7" />
              <h3 className="lp-signup-card-title">Pro License Checkout</h3>
            </div>
            
            <p className="lp-signup-card-desc">
              Standardize your lab's workflow. The Pro license unlocks .irp reproducibility protocols, advanced Monte Carlo error analysis, and vector exports.
            </p>

            <form onSubmit={handleSignUpSubmit}>
              <div className="lp-signup-form-group">
                <label className="lp-signup-label" htmlFor="signup-email">Researcher Email</label>
                <input
                  type="email"
                  id="signup-email"
                  className="lp-signup-input"
                  placeholder="e.g. name@university.edu"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError('');
                  }}
                  required
                />
                {emailError && <div className="lp-signup-error">{emailError}</div>}
              </div>

              <button type="submit" className="lp-signup-submit-btn">
                Proceed to Secure Checkout <ArrowRight size={18} />
              </button>
            </form>

            <div className="lp-signup-pricing-summary">
              <span className="lp-signup-pricing-label">Lifetime License (One-time)</span>
              <span className="lp-signup-price-val">$39</span>
            </div>

            <p className="lp-signup-privacy-note">
              Instant Raman is built with strict privacy standards. Your email is only used for license generation and delivery, and is never shared.
            </p>
          </div>
        </main>
      </div>
    );
  }

  /* ════════════════════════════════════
     MAIN LANDING PAGE (Academic Standard)
     ════════════════════════════════════ */
  return (
    <div className="lp-wrapper">
      <header className="lp-header">
        <div className="lp-brand">
          <span className="lp-brand-instant">Instant</span><span className="lp-brand-raman">Raman</span>
        </div>
        <div className="lp-header-actions">
          <button className="lp-btn-secondary" onClick={() => setShowHowItWorks(true)}>How it Works</button>
          <button className="lp-btn-secondary" onClick={() => setShowSignUp(true)}>Pricing</button>
          <button className="lp-btn-primary" onClick={onEnterWorkstation}>Launch Workstation</button>
        </div>
      </header>

      <section className="lp-hero">
        <h1 className="lp-title">One-Click Raman Processing,<br />Plotting, and Fitting.</h1>
        <p className="lp-subtitle">
          Spend your time on analysis, not on processing. Upload, correct, fit, and export — all in one place.
        </p>
        
        <div className="lp-plot-container">
          <div className="lp-plot-header">
            <div className="lp-plot-title">
              <BarChart3 size={16} /> Live Demo: Processing Pipeline
            </div>
            <div className="lp-plot-controls">
              <button 
                className={`lp-toggle-btn ${viewMode === 'before' ? 'active' : ''}`}
                onClick={() => setViewMode('before')}
              >
                Raw Data
              </button>
              <button 
                className={`lp-toggle-btn ${viewMode === 'after' ? 'active' : ''}`}
                onClick={() => setViewMode('after')}
              >
                Baseline Corrected
              </button>
            </div>
          </div>
          <div id="lp-plotly-div"></div>
        </div>
      </section>

      {/* ── FEATURES GRID ── */}
      <section className="lp-features-section">
        <div className="lp-section-header">
          <h2>Uncompromising Capabilities</h2>
          <p>The quiet tools for high-precision molecular discovery.</p>
        </div>
        <div className="lp-bento-grid">
          <div className="lp-bento-card">
            <div className="lp-bento-icon">
              <Zap size={20} />
            </div>
            <h3>Universal Spectral Parser</h3>
            <p>Direct support for CSV, TSV, JCAMP-DX (.jdx, .dx), Horiba LabSpec (.txt, .xml), Bruker DPT, and Ocean Optics files.</p>
          </div>
          <div className="lp-bento-card">
            <div className="lp-bento-icon">
              <CheckCircle2 size={20} />
            </div>
            <h3>Mathematical Baseline & Smoothing</h3>
            <p>Robust MAD-based Cosmic Ray Spike rejection, Simple Non-Iterative Peak (SNIP) background subtraction, and Savitzky-Golay smoothing.</p>
          </div>
          <div className="lp-bento-card">
            <div className="lp-bento-icon">
              <BarChart3 size={20} />
            </div>
            <h3>Levenberg-Marquardt Deconvolution</h3>
            <p>Multi-peak fitting of Lorentzian, Gaussian, and Voigt profiles using non-linear least squares optimization (Pro Feature).</p>
          </div>
          <div className="lp-bento-card">
            <div className="lp-bento-icon">
              <Lock size={20} />
            </div>
            <h3>Statistical & Epistemic Error Quantification</h3>
            <p>Monte Carlo uncertainty propagation and SVD Jacobian analysis for accurate peak assignments and confidence bounds (Pro Feature).</p>
          </div>
        </div>
      </section>

      {/* ── TECH SPECS & CODE ── */}
      <section className="lp-tech-section">
        <div className="lp-tech-content">
          <div className="lp-tech-text">
            <h2>Engineered for Technical Rigor.</h2>
            <p>
              Our platform executes entirely within your browser environment, ensuring absolute data privacy and immediate responsiveness. No data is uploaded to a remote server.
            </p>
            <div className="lp-tech-specs-grid">
              <div className="lp-tech-spec-item">
                <h4>100% Client-Side Execution</h4>
                <p>Private, local data processing with zero cloud latency and complete confidentiality.</p>
              </div>
              <div className="lp-tech-spec-item">
                <h4>Export Formats</h4>
                <p>Export peak lists, fitted parameters, baseline coordinates, and residuals directly to Excel (.xlsx), SVG plots, or IRP protocol files.</p>
              </div>
            </div>
          </div>
          <div className="lp-tech-code-container">
            <pre className="lp-tech-code">
              <code>{`// Example SNIP Baseline implementation
function calculateSNIP(spectrum, iterations = 25) {
  let baseline = [...spectrum];
  for (let p = 1; p <= iterations; p++) {
    for (let i = p; i < spectrum.length - p; i++) {
      let a = baseline[i];
      let b = (baseline[i - p] + baseline[i + p]) / 2;
      baseline[i] = Math.min(a, b);
    }
  }
  return baseline;
}`}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="lp-pricing-section">
        <div className="lp-pricing-card">
          <h2>Purchase Pro License</h2>
          <p>One-time Permanent License: $39. No subscriptions, no recurring costs.</p>
          <button className="lp-btn-primary" onClick={() => setShowSignUp(true)}>
            Buy Pro License
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="lp-footer">
        <div className="lp-footer-content">
          <div className="lp-brand">
            <span className="lp-brand-instant">Instant</span><span className="lp-brand-raman">Raman</span>
          </div>
          <p className="lp-footer-tagline">
            Leading the transition to real-time molecular diagnostics through browser-based spectral analysis and deconvolution.
          </p>
          <div className="lp-footer-status">
            <span className="lp-status-dot"></span> SYSTEMS OPERATIONAL
          </div>
        </div>
      </footer>

      {showHowItWorks && (
        <div className="lp-modal-overlay" onClick={() => setShowHowItWorks(false)}>
          <div className="lp-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="lp-modal-header">
              <h2>How it Works: The Processing & Fitting Pipeline</h2>
              <button className="lp-modal-close" onClick={() => setShowHowItWorks(false)}>✕</button>
            </div>
            
            <div className="lp-modal-grid">
              <div className="lp-modal-card">
                <h3><span>01</span> Data Import & Integrity</h3>
                <p>
                  Upload standard <code>.txt</code>, <code>.csv</code>, or <code>.tsv</code> files. Wavenumber and intensity values are parsed instantly. A local SHA-256 hash checks and stamps the raw file, providing a permanent fingerprint to verify file integrity.
                </p>
              </div>

              <div className="lp-modal-card">
                <h3><span>02</span> Baseline & Noise Correction</h3>
                <p>
                  Cleans raw data through three automated steps: Cosmic ray spikes are removed using a median filter, background fluorescence is subtracted (via SNIP or manual anchors), and high-frequency noise is smoothed out using a Savitzky-Golay filter.
                </p>
              </div>

              <div className="lp-modal-card">
                <h3><span>03</span> Calibration Check</h3>
                <p>
                  Verify calibration accuracy by checking for the standard silicon peak at <strong>520.7 cm⁻¹</strong>. The workstation fits the region, calculates the offset, and reports whether the spectrometer has drifted.
                </p>
              </div>

              <div className="lp-modal-card">
                <h3><span>04</span> Peak Deconvolution</h3>
                <p>
                  Fit overlapping bands using non-linear least squares optimization. The workstation deconvolutes peaks using Gaussian, Lorentzian, or Pseudo-Voigt shapes depending on your sample's physics.
                </p>
              </div>

              <div className="lp-modal-card" style={{ gridColumn: 'span 2' }}>
                <h3><span>05</span> Statistical & Epistemic Error Quantification</h3>
                <p>
                  Quantifies uncertainties for accurate peak assignments. The tool calculates statistical precision (via SVD Jacobian analysis) alongside structural/model sensitivity (by perturbing boundaries by up to ±10% across Lorentzian, Gaussian, and Voigt profiles) to flag unresolved doublets or phase mixtures.
                </p>
              </div>
            </div>

            <div className="lp-modal-outputs">
              <h3>Downloadable Outputs</h3>
              <div className="lp-modal-outputs-grid">
                <div className="lp-modal-output-item">
                  <strong>Export-Ready Plots</strong>
                  <span>Download transparent 300-DPI PNGs or scalable vector SVGs matching academic journal standards.</span>
                </div>
                <div className="lp-modal-output-item">
                  <strong>Tabular Data</strong>
                  <span>Export complete peak lists, fitted parameters, baseline coordinates, and residuals directly to Excel (<code>.xlsx</code>).</span>
                </div>
                <div className="lp-modal-output-item">
                  <strong>IRP File (Instant Raman Protocol)</strong>
                  <span>Save your analysis settings to reproduce the exact analysis state byte-for-byte.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Landing;

