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
import rawDataStr from './assets/Sample_Data.txt?raw';

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

    // Very simple dummy "After" processing: Subtract a rough linear baseline & smooth
    const yAfter: number[] = [];
    if (yRaw.length > 0) {
      const firstY = yRaw[0];
      const lastY = yRaw[yRaw.length - 1];
      const slope = (lastY - firstY) / yRaw.length;

      for (let i = 0; i < yRaw.length; i++) {
        // Linear baseline subtraction
        const baseline = firstY + slope * i;
        yAfter.push(yRaw[i] - baseline);
      }

      // Simple smoothing (moving average window 5)
      for (let i = 2; i < yAfter.length - 2; i++) {
        yAfter[i] = (yAfter[i-2] + yAfter[i-1] + yAfter[i] + yAfter[i+1] + yAfter[i+2]) / 5;
      }
    }

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src="./Instant%20Raman%20Logo.jpeg" alt="Logo" style={{ height: '24px' }} />
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Instant Raman</span>
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
          <img src="./Instant%20Raman%20Logo.jpeg" alt="Instant Raman Logo" />
          <span>Instant Raman</span>
        </div>
        <div className="lp-header-actions">
          <button className="lp-btn-secondary" onClick={() => setShowSignUp(true)}>Pricing</button>
          <button className="lp-btn-primary" onClick={onEnterWorkstation}>Launch Workstation</button>
        </div>
      </header>

      <section className="lp-hero">
        <span className="lp-hero-badge">THE STANDARD FOR RAMAN ANALYSIS</span>
        <h1 className="lp-title">One-Click Raman Processing,<br />Plotting, and Fitting.</h1>
        <p className="lp-subtitle">
          Stop wrestling with clunky software. Automate your SNIP baselines and Levenberg-Marquardt deconvolution directly in your browser. Zero installation required.
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

