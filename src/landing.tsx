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
          <button className="lp-btn-secondary" onClick={() => {
            document.getElementById('lp-how-it-works')?.scrollIntoView({ behavior: 'smooth' });
          }}>How it Works</button>
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

      <section id="lp-how-it-works" className="lp-how-section">
        <h2>How it Works: The Processing & Fitting Pipeline</h2>
        <p className="lp-how-section-desc">
          Instant Raman operates entirely inside your browser, combining high-precision preprocessing algorithms with non-linear regression engines and rigorous uncertainty quantification.
        </p>

        <div className="lp-how-steps">
          <div className="lp-step-card">
            <h3><span>Step 1</span> Ingestion & Verification</h3>
            <p>
              Upload files in standard <code>.txt</code>, <code>.csv</code>, <code>.tsv</code>, or <code>.irp</code> formats. Wavenumber and intensity columns are automatically parsed. The engine instantly calculates a SHA-256 cryptographic hash of your raw files to serve as a unique fingerprint and guarantee data integrity.
            </p>
          </div>

          <div className="lp-step-card">
            <h3><span>Step 2</span> Preprocessing Pipeline</h3>
            <p>
              To prepare your data for deconvolution, the engine executes a three-part preprocessing pipeline:
            </p>
            <ul className="lp-step-sublist">
              <li><strong>Cosmic Ray Filtering:</strong> A sliding-window Median Absolute Deviation (MAD) modified Z-score algorithm isolates and heals narrow, high-intensity spike artifacts.</li>
              <li><strong>Baseline Correction:</strong> Auto Mode estimates and subtracts fluorescence humps using the recursive SNIP algorithm. Manual Mode allows custom anchor interpolation.</li>
              <li><strong>Savitzky-Golay Smoothing:</strong> Filters out high-frequency noise using a customizable window size (default 9 points) without shifting or blunting peak shapes.</li>
            </ul>
          </div>

          <div className="lp-step-card">
            <h3><span>Step 3</span> Wavenumber Calibration</h3>
            <p>
              Verify system calibration using the Silicon Calibration tool. The engine automatically scans for the standard silicon peak at <strong>520.7 cm⁻¹</strong>, fits the local region, computes the offset/drift, and flags whether your calibration is within acceptable tolerances.
            </p>
          </div>

          <div className="lp-step-card">
            <h3><span>Step 4</span> Multi-Model Peak Deconvolution</h3>
            <p>
              For fitting overlapping bands, Instant Raman utilizes a non-linear Levenberg-Marquardt (LM) optimization engine supporting three profiles: Gaussian (for inhomogeneous broadening), Lorentzian (for homogeneous lifetime broadening), and Pseudo-Voigt (which combines both with a tunable mixing parameter).
            </p>
          </div>

          <div className="lp-step-card" style={{ gridColumn: '1 / -1' }}>
            <h3><span>Step 5</span> Statistical & Epistemic Uncertainty</h3>
            <p>
              To guarantee publication credibility, the workstation quantifies uncertainty from multiple sources:
            </p>
            <ul className="lp-step-sublist">
              <li><strong>Statistical Error (Fit Precision):</strong> Standard errors (e.g., center uncertainty ±0.02 cm⁻¹) are calculated by computing the Singular Value Decomposition (SVD) of the fit's Jacobian matrix.</li>
              <li><strong>Epistemic Error (Model Sensitivity):</strong> Randomly perturbs fit boundary limits by up to ±10% across Lorentzian, Gaussian, and Voigt profiles to build a multi-model ensemble and assess sensitivity.</li>
              <li><strong>Bimodality Diagnostics:</strong> Uses Sarle's coefficient, dip tests, and k-means clustering to warn you if a peak is actually an unresolved doublet or phase mixture.</li>
            </ul>
          </div>
        </div>

        <div className="lp-outputs-summary">
          <h3>Outputs You Get</h3>
          <div className="lp-outputs-grid">
            <div className="lp-output-item">
              <strong>Export-Ready Plots</strong>
              <span>Download transparent 300-DPI PNGs or scalable vector SVGs matching academic journal standards.</span>
            </div>
            <div className="lp-output-item">
              <strong>Tabular Data</strong>
              <span>Export complete peak lists, fitted parameters, baseline coordinates, and residuals directly to Excel (<code>.xlsx</code>).</span>
            </div>
            <div className="lp-output-item">
              <strong>IRP File (Instant Raman Protocol)</strong>
              <span>Save your analysis as a <code>.irp</code> file containing raw data, parameters, and boundaries. Uploading this file reproduces your exact analysis state byte-for-byte.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-value-section">
        <div className="lp-grid">
          <div className="lp-card">
            <div className="lp-card-icon"><Zap size={24} /></div>
            <h3>Automated Baselines</h3>
            <p>Drop your data in and get SNIP baseline correction instantly. No more manually drawing anchors unless you absolutely want to.</p>
          </div>

          <div className="lp-card">
            <div className="lp-card-icon"><BarChart3 size={24} /></div>
            <h3>Advanced Peak Fitting</h3>
            <p>Built-in Levenberg-Marquardt deconvolution. Fit overlapping bands with Gaussian, Lorentzian, and true Voigt profiles effortlessly.</p>
          </div>

          <div className="lp-card">
            <div className="lp-card-icon"><Download size={24} /></div>
            <h3>Publication Ready</h3>
            <p>One-click exports to 300-DPI transparent PNGs, fully scalable vector SVGs, and completely formatted Excel data tables.</p>
          </div>

          <div className="lp-card">
            <div className="lp-card-icon"><Lock size={24} /></div>
            <h3>100% Client-Side Privacy</h3>
            <p>Your unpublished data never leaves your browser. No server uploads, no data harvesting. Absolute security for your research.</p>
          </div>

          <div className="lp-card" style={{ gridColumn: '1 / -1', background: '#f0f9ff', borderColor: '#bae6fd' }}>
            <div className="lp-card-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}><CheckCircle2 size={24} /></div>
            <h3>Standardize Your Lab (Pro)</h3>
            <p>Save your exact correction, calibration, and fitting state as a cryptographically verifiable <b>.irp (Instant Raman Protocol)</b> file. Share it with your entire team or peer reviewers to guarantee perfect reproducibility.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;

