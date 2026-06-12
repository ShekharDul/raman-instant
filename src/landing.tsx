import React, { useEffect, useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Lock,
  Upload,
  Image as ImageIcon,
  Activity,
  Binary,
  Copy,
  ExternalLink,
  ChevronRight,
  GitBranch,
} from 'lucide-react';

interface LandingProps {
  onEnterWorkstation: () => void;
}

/* ── Fade-in wrapper ── */
const FadeIn: React.FC<{ children: React.ReactNode; delay?: number; className?: string; style?: React.CSSProperties }> = ({ children, delay = 0, className = '', style }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
};



/* ── Spectral Deconvolution Visual (SVG) ── */
const SpectralDeconvolutionVisual: React.FC = () => {
  const width = 500;
  const height = 340;
  const padding = 20;

  // Define 5 Lorentzian peaks
  const peaks = [
    { xc: 100, w: 20, h: 100 }, // Peak 1
    { xc: 180, w: 28, h: 200 }, // Peak 2
    { xc: 260, w: 22, h: 290 }, // Peak 3 (tallest)
    { xc: 340, w: 32, h: 140 }, // Peak 4
    { xc: 410, w: 18, h: 80 }   // Peak 5
  ];

  // Calculate Lorentzian value at x
  const lorentzian = (x: number, xc: number, w: number, h: number) => {
    return h * (w * w) / ((x - xc) * (x - xc) + w * w);
  };

  // Generate points for the main envelope (sum of all lorentzians + small baseline)
  const mainPoints: [number, number][] = [];
  const componentPoints: [number, number][][] = peaks.map(() => []);

  for (let x = padding; x <= width - padding; x += 2) {
    let ySum = 0;
    peaks.forEach((p, idx) => {
      const yVal = lorentzian(x, p.xc, p.w, p.h);
      ySum += yVal;
      componentPoints[idx].push([x, height - padding - yVal]);
    });

    const baseline = Math.sin(x / 60) * 8 + 10;
    const totalY = ySum + baseline;
    mainPoints.push([x, height - padding - totalY]);
  }

  // Create SVG path strings
  const createPathD = (pts: [number, number][]) => {
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
  };

  const createAreaD = (pts: [number, number][]) => {
    if (pts.length === 0) return '';
    const startX = pts[0][0];
    const endX = pts[pts.length - 1][0];
    const basePath = `M ${startX} ${height - padding}`;
    const linePath = pts.map(p => `L ${p[0]} ${p[1]}`).join(' ');
    const closePath = `L ${endX} ${height - padding} Z`;
    return `${basePath} ${linePath} ${closePath}`;
  };

  const mainPathD = createPathD(mainPoints);

  return (
    <div className="spectral-visual-container">
      <svg viewBox={`0 0 ${width} ${height}`} className="spectral-svg">
        <defs>
          {/* Gradients and Filters */}
          <linearGradient id="teal-glow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.0" />
          </linearGradient>
          <filter id="glow-light" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-strong" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Component Peaks (Teal curves with gradients) */}
        {componentPoints.map((pts, idx) => (
          <g key={idx}>
            {/* Filled area */}
            <path
              d={createAreaD(pts)}
              fill="url(#teal-glow)"
              opacity="0.25"
            />
            {/* Outline curve */}
            <path
              d={createPathD(pts)}
              fill="none"
              stroke="#14b8a6"
              strokeWidth="1.5"
              opacity="0.8"
              style={{ filter: 'url(#glow-light)' }}
            />
          </g>
        ))}

        {/* Main Envelope Curve (Glowing White Line) */}
        <path
          d={mainPathD}
          fill="none"
          stroke="#ffffff"
          strokeWidth="3.5"
          opacity="0.4"
          style={{ filter: 'url(#glow-strong)' }}
        />
        <path
          d={mainPathD}
          fill="none"
          stroke="#ffffff"
          strokeWidth="2"
        />

        {/* Dynamic Peak Fit Indicators (Vertical dashed line for the tallest peak center) */}
        <line
          x1={260}
          y1={height - padding - 310}
          x2={260}
          y2={height - padding}
          stroke="#14b8a6"
          strokeDasharray="4,4"
          strokeWidth="1"
          opacity="0.4"
        />
        <circle
          cx={260}
          cy={height - padding - 305}
          r="3"
          fill="#14b8a6"
          style={{ filter: 'url(#glow-light)' }}
        />
      </svg>
    </div>
  );
};

const METHODS_TEXT = `Raman spectra were processed using Instant Raman (v2.5). Baseline correction employed the SNIP algorithm (25 iterations). Peak detection used 3-point parabolic interpolation with sub-pixel accuracy. Multi-peak deconvolution was performed via Levenberg-Marquardt optimization with Lorentzian line profiles. Uncertainty quantification combined 500-sample bootstrap resampling (statistical) with boundary-dependent ensemble perturbation (epistemic). All processing was performed client-side.`;

const BIBTEX_TEXT = `@software{instant_raman,
  author = {Dulgach, Shekhar},
  title = {Instant Raman: Automated Spectral Rigor Workstation},
  url = {https://shekhardulgach.github.io/raman-instant/},
  year = {2026},
  version = {2.5}
}`;

/* ── Workstation UI Mockup (Coded Option 1) ── */
const WorkstationMockup: React.FC = () => {
  return (
    <div className="workstation-mockup">
      {/* Mock Header */}
      <div className="mock-header">
        <div className="mock-header-left">
          <span className="mock-dot red" />
          <span className="mock-dot yellow" />
          <span className="mock-dot green" />
          <span className="mock-filename">sample_Si_calibration.txt</span>
        </div>
        <div className="mock-header-right">
          <span className="mock-pro-badge">PRO ACTIVE</span>
        </div>
      </div>

      <div className="mock-body">
        {/* Mock Sidebar */}
        <div className="mock-sidebar">
          {/* Section: Ingestion */}
          <div className="mock-sidebar-section">
            <div className="mock-section-title">INGESTION</div>
            <div className="mock-dropzone">
              <Upload size={14} className="mock-icon-accent" />
              <span>Drag files here</span>
              <span className="mock-dropzone-sub">.dx · .txt · .csv</span>
            </div>
            <div className="mock-checkbox-row">
              <span className="mock-checkbox-checked">✓</span>
              <span>Auto cosmic ray removal</span>
            </div>
          </div>

          {/* Section: Baseline */}
          <div className="mock-sidebar-section">
            <div className="mock-section-title">BASELINE CORRECTION</div>
            <div className="mock-btn-row">
              <div className="mock-btn active">Auto (SNIP)</div>
              <div className="mock-btn">Manual</div>
            </div>
            <div className="mock-slider-row">
              <div className="mock-slider-label">
                <span>Iterations</span>
                <span className="mock-text-accent">25</span>
              </div>
              <div className="mock-slider-track">
                <div className="mock-slider-fill" style={{ width: '50%' }} />
                <div className="mock-slider-thumb" style={{ left: '50%' }} />
              </div>
            </div>
          </div>

          {/* Section: Fitting */}
          <div className="mock-sidebar-section">
            <div className="mock-section-title">PEAK FITTING (LM)</div>
            <div className="mock-select-row">
              <span>Profile</span>
              <div className="mock-select">
                <span>Lorentzian</span>
                <span className="mock-select-arrow">▼</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mock Main Workspace */}
        <div className="mock-workspace">
          {/* Mock Plot Canvas */}
          <div className="mock-plot-area">
            {/* The SVG Spectral curve deconvolution visual */}
            <SpectralDeconvolutionVisual />

            {/* Pointers floating over the mockup */}
            <div className="visual-pointer pointer-ingestion">
              <div className="pointer-card">
                <div className="pointer-card-title">100% Client-Side Ingestion</div>
                <div className="pointer-card-text">Reads data locally. Zero servers. Universal format support.</div>
              </div>
            </div>

            <div className="visual-pointer pointer-baseline">
              <div className="pointer-dot" />
              <div className="pointer-card">
                <div className="pointer-card-title">SNIP Background Correction</div>
                <div className="pointer-card-text">Adaptive automated baseline subtraction runs locally.</div>
              </div>
            </div>

            <div className="visual-pointer pointer-fitting">
              <div className="pointer-dot" />
              <div className="pointer-card">
                <div className="pointer-card-title">Levenberg-Marquardt Fitting</div>
                <div className="pointer-card-text">Simultaneous multi-peak deconvolution into component bands.</div>
              </div>
            </div>
          </div>

          {/* Mock Peak Data Grid */}
          <div className="mock-data-grid">
            <div className="mock-grid-header">
              <span>Peak</span>
              <span>Centroid (cm⁻¹)</span>
              <span>Height</span>
              <span>FWHM (cm⁻¹)</span>
              <span>Area</span>
            </div>
            <div className="mock-grid-row active">
              <span className="mock-text-accent">P1</span>
              <span>520.7</span>
              <span>290.4</span>
              <span>2.41</span>
              <span>1102.1</span>
            </div>
            <div className="mock-grid-row">
              <span>P2</span>
              <span>340.2</span>
              <span>140.2</span>
              <span>3.12</span>
              <span>687.5</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Landing: React.FC<LandingProps> = ({ onEnterWorkstation }) => {
  const [isDesktop, setIsDesktop] = useState(false);
  const [copiedMethods, setCopiedMethods] = useState(false);
  const [copiedBibtex, setCopiedBibtex] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('signup') === 'true') {
      setShowSignUp(true);
    }
  }, []);

  const handleCopy = async (text: string, setter: (val: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setter(true);
      setTimeout(() => setter(false), 2000);
    } catch { /* fallback silently */ }
  };

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

  if (showSignUp) {
    return (
      <div className="lp-signup-root">
        <header className="lp-signup-nav">
          <div className="lp-container lp-signup-nav-inner">
            <button className="lp-back-btn" onClick={() => {
              setShowSignUp(false);
              const url = new URL(window.location.href);
              url.searchParams.delete('signup');
              window.history.replaceState({}, '', url.toString());
            }}>
              <ArrowLeft size={16} /> Back to Homepage
            </button>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#14b8a6' }}>Instant Raman Pro</span>
          </div>
        </header>

        <main className="lp-container lp-signup-grid">
          <div className="lp-signup-features">
            <div className="lp-signup-features-header">
              <span className="lp-signup-badge">PRO EDITION</span>
              <h2 className="lp-signup-title">Make Spectral Workflows Smarter</h2>
            </div>

            <div className="lp-signup-feature-item">
              <div className="lp-signup-feature-icon">
                <Zap size={20} />
              </div>
              <div className="lp-signup-feature-content">
                <h4>LM Multi-Peak Deconvolution</h4>
                <p>Fit overlapping bands with Voigt, Lorentzian, and Gaussian lineshapes using true client-side Levenberg-Marquardt optimization.</p>
              </div>
            </div>

            <div className="lp-signup-feature-item">
              <div className="lp-signup-feature-icon">
                <ShieldCheck size={20} />
              </div>
              <div className="lp-signup-feature-content">
                <h4>Split Uncertainty Quantification</h4>
                <p>Submit with confidence. Quantify and separate statistical noise (bootstrap) from epistemic model bias for your publication.</p>
              </div>
            </div>

            <div className="lp-signup-feature-item">
              <div className="lp-signup-feature-icon">
                <CheckCircle2 size={20} />
              </div>
              <div className="lp-signup-feature-content">
                <h4>Reproducibility Protocol (.irp)</h4>
                <p>Standardize analyses. Save full correction, fitting, and calibration states as a cryptographically-hashed file to share with peer reviewers or team members.</p>
              </div>
            </div>

            <div className="lp-signup-feature-item">
              <div className="lp-signup-feature-icon">
                <ImageIcon size={20} />
              </div>
              <div className="lp-signup-feature-content">
                <h4>Publication-Ready Vector Export</h4>
                <p>Download transparent 300-DPI PNGs, vector SVGs, complete Excel tables, and interactive standalone HTML research reports.</p>
              </div>
            </div>
          </div>

          <div className="lp-signup-card-container">
            <div className="lp-signup-card">
              <h3 className="lp-signup-card-title">Access License Sign Up</h3>
              <p className="lp-signup-card-desc">Enter your email to proceed to secure checkout. Your unique access license key will be sent to this email address once payment is completed.</p>
              
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
                  Proceed to Checkout <ArrowRight size={18} />
                </button>
              </form>

              <div className="lp-signup-pricing-summary">
                <span className="lp-signup-pricing-label">License Cost (One-time)</span>
                <span className="lp-signup-price-val">$39</span>
              </div>
            </div>

            <p className="lp-signup-privacy-note">
              Instant Raman is built with strict privacy standards. Your email is only used for license generation and delivery, and is never shared.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="lp-root">
      {/* ════════════════════════════════════════════
          HERO
          ════════════════════════════════════════════ */}
      <section className="lp-hero">
        <div className="lp-container">
          <div className="lp-hero-content">
            <div className="lp-hero-text">
              <motion.h1
                className="lp-hero-h1"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                YOUR RAMAN ASSISTANT
              </motion.h1>

              <motion.p
                className="lp-hero-sub"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                Less processing. Less plotting. More analysis.
              </motion.p>

              <motion.div
                className="lp-hero-actions"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                {isDesktop ? (
                  <button onClick={onEnterWorkstation} className="lp-btn-primary">
                    Launch Workstation
                    <ArrowRight size={18} />
                  </button>
                ) : (
                  <div className="lp-btn-primary" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                    <Lock size={16} /> Desktop Required
                  </div>
                )}
                <a href="#pricing" className="lp-btn-secondary">
                  Get Pro License
                </a>
                <a
                  href="https://github.com/ShekharDul/raman-instant"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lp-btn-secondary"
                >
                  View Source <ExternalLink size={14} />
                </a>
              </motion.div>

              <motion.div
                className="lp-trust-signals"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.6 }}
              >
                <div className="lp-trust-item"><ShieldCheck size={14} className="lp-text-accent" /> 100% Client-Side</div>
                <div className="lp-trust-item"><CheckCircle2 size={14} className="lp-text-accent" /> SHA-256 Verified</div>
                <div className="lp-trust-item"><Lock size={14} className="lp-text-accent" /> Zero Backend</div>
                <div className="lp-trust-item"><GitBranch size={14} className="lp-text-accent" /> Open Source</div>
              </motion.div>
            </div>

            <motion.div
              className="lp-hero-visual"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.3 }}
            >
              <WorkstationMockup />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          PRICING
          ════════════════════════════════════════════ */}
      <section className="lp-pricing" id="pricing">
        <div className="lp-container">
          <div className="lp-section-header">
            <span className="lp-section-label">Plans</span>
            <p style={{ color: '#666666', marginTop: 16, fontSize: '1.1rem' }}>One-time purchase provides lifetime access.</p>
          </div>

          <div className="lp-pricing-grid">
            {/* Free Tier */}
            <FadeIn className="pricing-card">
              <div className="pricing-tier">Community</div>
              <div className="pricing-price">$0</div>
              <div className="pricing-period">Free forever</div>
              <p className="pricing-desc">A complete tool, not a trial. Fully-featured spectral analysis without time limits or feature degradation.</p>
              
              <ul className="pricing-features">
                <li><CheckCircle2 size={16} /> Unlimited file ingestion (All formats)</li>
                <li><CheckCircle2 size={16} /> <span className="lp-font-mono">SNIP</span> baseline correction</li>
                <li><CheckCircle2 size={16} /> Cosmic ray removal</li>
                <li><CheckCircle2 size={16} /> Peak detection (Parabolic refinement)</li>
                <li><CheckCircle2 size={16} /> Standard <span className="lp-font-mono">PNG</span> export</li>
                <li><CheckCircle2 size={16} /> 100% Client-side privacy</li>
              </ul>
              
              {isDesktop ? (
                <button onClick={onEnterWorkstation} className="lp-btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                  Launch Free Version
                </button>
              ) : (
                <div className="lp-btn-secondary" style={{ width: '100%', justifyContent: 'center', opacity: 0.5 }}>
                  Desktop Required
                </div>
              )}
            </FadeIn>

            {/* Pro Tier */}
            <FadeIn delay={0.2} className="pricing-card pro">
              <div className="pricing-badge">Recommended for Publication</div>
              <div className="pricing-tier">Pro License</div>
              <div className="pricing-price">$39</div>
              <div className="pricing-period">One-time purchase</div>
              <p className="pricing-desc">The "publish with confidence" upgrade. Advanced rigor and scientific export tools.</p>
              
              <ul className="pricing-features">
                <li className="pro-feature"><CheckCircle2 size={16} /> <strong><span className="lp-font-mono">LM</span> Multi-Peak Deconvolution</strong></li>
                <li className="pro-feature"><CheckCircle2 size={16} /> <strong>Uncertainty Quantification Suite</strong></li>
                <li className="pro-feature"><CheckCircle2 size={16} /> <span className="lp-font-mono">Monte Carlo</span> Ratio Propagation</li>
                <li className="pro-feature"><CheckCircle2 size={16} /> Reproducibility Protocol (<span className="lp-font-mono">.irp</span>)</li>
                <li className="pro-feature"><CheckCircle2 size={16} /> Replicate Analysis (Mean ± SD)</li>
                <li className="pro-feature"><CheckCircle2 size={16} /> Batch Comparison (Waterfall mode)</li>
                <li className="pro-feature"><CheckCircle2 size={16} /> <span className="lp-font-mono">SVG</span> &amp; High-Res Export</li>
                <li className="pro-feature"><CheckCircle2 size={16} /> Interactive <span className="lp-font-mono">HTML</span> Report Export</li>
              </ul>
              
              <button
                onClick={() => setShowSignUp(true)}
                className="lp-btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Get Pro License <ChevronRight size={18} />
              </button>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          CITATION & METHODS
          ════════════════════════════════════════════ */}
      <section className="lp-citation">
        <div className="lp-container">
          <div className="lp-section-header">
            <span className="lp-section-label">Academic Growth</span>
            <h2 className="lp-section-heading">Ready for Peer Review</h2>
          </div>

          <div className="citation-grid">
            <FadeIn>
              <div style={{ marginBottom: 8, fontWeight: 600, fontSize: '0.9rem', color: '#666666', fontFamily: 'var(--font-mono)' }}>METHODS SECTION TEMPLATE</div>
              <div style={{ marginBottom: 16, color: '#888888', fontSize: '0.95rem', lineHeight: '1.5' }}>
                Paste this standard description directly into the experimental methods section of your manuscript:
              </div>
              <div className="code-block">
                <div className="code-header">
                  <span>methods_section.txt</span>
                  <button onClick={() => handleCopy(METHODS_TEXT, setCopiedMethods)} className="lp-copy-btn">
                    {copiedMethods ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                    {copiedMethods ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <pre className="code-content">{METHODS_TEXT}</pre>
              </div>
            </FadeIn>

            <FadeIn delay={0.2}>
              <div style={{ marginBottom: 8, fontWeight: 600, fontSize: '0.9rem', color: '#666666', fontFamily: 'var(--font-mono)' }}>BIBTEX CITATION</div>
              <div style={{ marginBottom: 16, color: '#888888', fontSize: '0.95rem', lineHeight: '1.5' }}>
                Cite Instant Raman in your reference manager software:
              </div>
              <div className="code-block">
                <div className="code-header">
                  <span>citation.bib</span>
                  <button onClick={() => handleCopy(BIBTEX_TEXT, setCopiedBibtex)} className="lp-copy-btn">
                    {copiedBibtex ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                    {copiedBibtex ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <pre className="code-content">{BIBTEX_TEXT}</pre>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          FOOTER
          ════════════════════════════════════════════ */}
      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <div className="lp-footer-left">
            <span className="lp-footer-brand">Instant Raman</span>
            <span className="lp-footer-copy">© {new Date().getFullYear()} Instant Raman</span>
          </div>
          <div className="lp-footer-right">
            <a href="https://github.com/ShekharDul/raman-instant" target="_blank" rel="noopener noreferrer">
              GitHub <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
