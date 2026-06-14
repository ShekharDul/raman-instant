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
  const [selectedPlan, setSelectedPlan] = useState<'individual' | 'team'>('individual');

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
    const checkoutUrl = `${baseLink}?email=${encodeURIComponent(trimmedEmail)}&prefill[email]=${encodeURIComponent(trimmedEmail)}&notes[plan]=${selectedPlan}`;

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
              The Pro license unlocks custom IRP protocols, peak deconvolution uncertainty estimation, and vector exports.
            </p>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <button 
                type="button" 
                className={`lp-toggle-btn ${selectedPlan === 'individual' ? 'active' : ''}`}
                style={{ flex: 1, padding: '10px', fontSize: '0.85rem', fontWeight: 600, border: '1px solid var(--border-color)', borderRadius: '6px', background: selectedPlan === 'individual' ? 'var(--bg-tertiary)' : 'transparent', cursor: 'pointer' }}
                onClick={() => setSelectedPlan('individual')}
              >
                Individual ($79)
              </button>
              <button 
                type="button" 
                className={`lp-toggle-btn ${selectedPlan === 'team' ? 'active' : ''}`}
                style={{ flex: 1, padding: '10px', fontSize: '0.85rem', fontWeight: 600, border: '1px solid var(--border-color)', borderRadius: '6px', background: selectedPlan === 'team' ? 'var(--bg-tertiary)' : 'transparent', cursor: 'pointer' }}
                onClick={() => setSelectedPlan('team')}
              >
                Lab & Team ($249)
              </button>
            </div>

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
              <span className="lp-signup-pricing-label">Selected Plan: {selectedPlan === 'individual' ? 'Individual' : 'Lab & Team'}</span>
              <span className="lp-signup-price-val">{selectedPlan === 'individual' ? '$79' : '$249'}</span>
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
          <h2>Features</h2>
          <p>Tools to process, fit, and export your spectra.</p>
        </div>
        <div className="lp-bento-grid">
          <div className="lp-bento-card">
            <div className="lp-bento-icon">
              <Zap size={20} />
            </div>
            <h3>File Import</h3>
            <p>Direct support for CSV, TSV, JCAMP-DX (.jdx, .dx), Horiba LabSpec (.txt, .xml), Bruker DPT, and Ocean Optics files.</p>
          </div>
          <div className="lp-bento-card">
            <div className="lp-bento-icon">
              <CheckCircle2 size={20} />
            </div>
            <h3>Baseline & Noise Correction</h3>
            <p>Cosmic ray spike rejection, Simple Non-Iterative Peak (SNIP) baseline subtraction, and Savitzky-Golay smoothing.</p>
          </div>
          <div className="lp-bento-card">
            <div className="lp-bento-icon">
              <BarChart3 size={20} />
            </div>
            <h3>Peak Fitting & Deconvolution</h3>
            <p>Fit overlapping peaks with Gaussian, Lorentzian, or Voigt profiles using non-linear least squares optimization (Pro Feature).</p>
          </div>
          <div className="lp-bento-card">
            <div className="lp-bento-icon">
              <Lock size={20} />
            </div>
            <h3>Uncertainty Estimation</h3>
            <p>Calculate fit confidence bounds using Jacobian analysis and boundary perturbations (Pro Feature).</p>
          </div>
        </div>
      </section>
 
      {/* ── TECH SPECS & CODE ── */}
      <section className="lp-tech-section">
        <div className="lp-tech-content">
          <div className="lp-tech-text">
            <h2>Run locally in your browser.</h2>
            <p>
              All processing runs client-side. Your spectral data never leaves your computer.
            </p>
            <div className="lp-tech-specs-grid">
              <div className="lp-tech-spec-item">
                <h4>100% Client-Side</h4>
                <p>Process data locally with zero latency and complete privacy.</p>
              </div>
              <div className="lp-tech-spec-item">
                <h4>Flexible Exports</h4>
                <p>Download peak lists, baseline coordinates, and fitted parameters as Excel (.xlsx), SVG plots, or custom IRP protocols.</p>
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
        <div className="lp-section-header">
          <h2>Pricing</h2>
          <p>Choose the license that fits your research needs. All plans are one-time payments with lifetime updates.</p>
        </div>
        <div className="lp-pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px', maxWidth: '800px', margin: '0 auto' }}>
          
          <div className="lp-pricing-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '32px', borderRadius: '12px', background: 'white', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-main)' }}>Individual Researcher</h3>
            <div className="lp-price" style={{ fontSize: '2.25rem', fontWeight: 800, margin: '16px 0', color: 'var(--text-main)' }}>$79</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '24px', flexGrow: 1, lineHeight: 1.5 }}>
              Ideal for individual PhD students, postdocs, and independent researchers.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', textAlign: 'left', fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li>✓ 1 Active Device Session</li>
              <li>✓ All Pro fitting & deconvolution tools</li>
              <li>✓ Custom IRP protocols & vector exports</li>
              <li>✓ Lifetime updates</li>
            </ul>
            <button className="lp-btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => {
              setSelectedPlan('individual');
              setShowSignUp(true);
            }}>
              Get Individual Key
            </button>
          </div>

          <div className="lp-pricing-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '32px', borderRadius: '12px', background: 'white', border: '1px solid var(--accent-primary)', position: 'relative' }}>
            <span style={{ position: 'absolute', top: '-12px', right: '24px', background: 'var(--accent-primary)', color: 'white', padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>MOST POPULAR</span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-main)' }}>Lab & Team</h3>
            <div className="lp-price" style={{ fontSize: '2.25rem', fontWeight: 800, margin: '16px 0', color: 'var(--text-main)' }}>$249</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '24px', flexGrow: 1, lineHeight: 1.5 }}>
              Best for research groups and shared core facilities.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', textAlign: 'left', fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li>✓ 5 Active Device Sessions</li>
              <li>✓ All Pro fitting & deconvolution tools</li>
              <li>✓ Custom IRP protocols & vector exports</li>
              <li>✓ Priority email support</li>
            </ul>
            <button className="lp-btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => {
              setSelectedPlan('team');
              setShowSignUp(true);
            }}>
              Get Lab & Team Key
            </button>
          </div>

        </div>
      </section>
 
      {/* ── FOOTER ── */}
      <footer className="lp-footer">
        <div className="lp-footer-content">
          <div className="lp-brand">
            <span className="lp-brand-instant">Instant</span><span className="lp-brand-raman">Raman</span>
          </div>
          <p className="lp-footer-tagline">
            A simple browser tool to process, fit, and analyze Raman spectra.
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
                <h3><span>01</span> Data Import</h3>
                <p>
                  Upload standard <code>.txt</code>, <code>.csv</code>, or <code>.tsv</code> files. The app calculates a SHA-256 hash of your raw file to let you verify data integrity.
                </p>
              </div>
 
              <div className="lp-modal-card">
                <h3><span>02</span> Baseline & Noise Correction</h3>
                <p>
                  Remove cosmic ray spikes with a median filter, subtract background fluorescence using SNIP or manual anchors, and smooth high-frequency noise using Savitzky-Golay filtering.
                </p>
              </div>
 
              <div className="lp-modal-card">
                <h3><span>03</span> Calibration Check</h3>
                <p>
                  Verify calibration by checking the standard silicon peak at <strong>520.7 cm⁻¹</strong>. The app fits the region, calculates the offset, and reports any spectrometer drift.
                </p>
              </div>
 
              <div className="lp-modal-card">
                <h3><span>04</span> Peak Fitting</h3>
                <p>
                  Fit overlapping spectral bands using non-linear least squares. Choose Gaussian, Lorentzian, or Pseudo-Voigt shapes to match your sample physics.
                </p>
              </div>
 
              <div className="lp-modal-card" style={{ gridColumn: 'span 2' }}>
                <h3><span>05</span> Uncertainty Quantification</h3>
                <p>
                  Calculate statistical precision (using SVD Jacobian analysis) and fit sensitivity by perturbing boundaries by up to ±10% across Lorentzian, Gaussian, and Voigt profiles.
                </p>
              </div>
            </div>
 
            <div className="lp-modal-outputs">
              <h3>Downloadable Outputs</h3>
              <div className="lp-modal-outputs-grid">
                <div className="lp-modal-output-item">
                  <strong>Export-Ready Plots</strong>
                  <span>Export plots as transparent PNGs or scalable vector SVGs.</span>
                </div>
                <div className="lp-modal-output-item">
                  <strong>Tabular Data</strong>
                  <span>Export peak lists, baseline coordinates, and fitted parameters directly to Excel (<code>.xlsx</code>).</span>
                </div>
                <div className="lp-modal-output-item">
                  <strong>IRP File (Instant Raman Protocol)</strong>
                  <span>Save your baseline anchors and peak parameters to an IRP file to restore your analysis state later.</span>
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

