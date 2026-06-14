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
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
};

/* ── Navigation Bar ── */
const NavBar: React.FC<{ onEnterWorkstation: () => void; isDesktop: boolean }> = ({ onEnterWorkstation, isDesktop }) => (
  <nav className="lp-nav">
    <div className="lp-container lp-nav-inner">
      <div className="lp-nav-brand">Instant Raman</div>
      <div className="lp-nav-links">
        <a href="#features" className="lp-nav-link">Features</a>
        <a href="#pricing" className="lp-nav-link">Pricing</a>
        <a
          href="https://github.com/ShekharDul/raman-instant"
          target="_blank"
          rel="noopener noreferrer"
          className="lp-nav-link"
        >
          GitHub <ExternalLink size={12} />
        </a>
        {isDesktop ? (
          <button onClick={onEnterWorkstation} className="lp-nav-cta">
            Launch Workstation
          </button>
        ) : (
          <span className="lp-nav-cta" style={{ opacity: 0.45, cursor: 'not-allowed' }}>
            <Lock size={13} /> Desktop Only
          </span>
        )}
      </div>
    </div>
  </nav>
);

/* ── Spectral Deconvolution Visual (SVG — Light Theme) ── */
const SpectralDeconvolutionVisual: React.FC = () => {
  const width = 520;
  const height = 300;
  const padding = 24;

  const peaks = [
    { xc: 100, w: 20, h: 100 },
    { xc: 180, w: 28, h: 200 },
    { xc: 260, w: 22, h: 260 },
    { xc: 340, w: 32, h: 140 },
    { xc: 420, w: 18, h: 80 },
  ];

  const lorentzian = (x: number, xc: number, w: number, h: number) =>
    h * (w * w) / ((x - xc) * (x - xc) + w * w);

  const mainPoints: [number, number][] = [];
  const componentPoints: [number, number][][] = peaks.map(() => []);

  for (let x = padding; x <= width - padding; x += 2) {
    let ySum = 0;
    peaks.forEach((p, idx) => {
      const yVal = lorentzian(x, p.xc, p.w, p.h);
      ySum += yVal;
      componentPoints[idx].push([x, height - padding - yVal]);
    });
    const baseline = Math.sin(x / 60) * 6 + 8;
    mainPoints.push([x, height - padding - (ySum + baseline)]);
  }

  const createPathD = (pts: [number, number][]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');

  const createAreaD = (pts: [number, number][]) => {
    if (pts.length === 0) return '';
    const startX = pts[0][0];
    const endX = pts[pts.length - 1][0];
    return `M ${startX} ${height - padding} ${pts.map(p => `L ${p[0]} ${p[1]}`).join(' ')} L ${endX} ${height - padding} Z`;
  };

  return (
    <div className="spectral-visual-container">
      <svg viewBox={`0 0 ${width} ${height}`} className="spectral-svg">
        <defs>
          <linearGradient id="sage-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2d8a7e" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#2d8a7e" stopOpacity="0.0" />
          </linearGradient>
          <filter id="soft-glow" x="-15%" y="-15%" width="130%" height="130%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Subtle axis lines */}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding}
          stroke="#e8e4df" strokeWidth="1" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding}
          stroke="#e8e4df" strokeWidth="1" />

        {/* Component peaks */}
        {componentPoints.map((pts, idx) => (
          <g key={idx}>
            <path d={createAreaD(pts)} fill="url(#sage-fill)" opacity="0.5" />
            <path d={createPathD(pts)} fill="none" stroke="#7cb5a8" strokeWidth="1.5" opacity="0.7"
              style={{ filter: 'url(#soft-glow)' }} />
          </g>
        ))}

        {/* Main envelope */}
        <path d={createPathD(mainPoints)} fill="none" stroke="#2d8a7e" strokeWidth="2.5" opacity="0.2"
          style={{ filter: 'url(#soft-glow)' }} />
        <path d={createPathD(mainPoints)} fill="none" stroke="#2d8a7e" strokeWidth="2" />

        {/* Peak indicator */}
        <line x1={260} y1={height - padding - 275} x2={260} y2={height - padding}
          stroke="#7cb5a8" strokeDasharray="4,4" strokeWidth="1" opacity="0.35" />
        <circle cx={260} cy={height - padding - 270} r="3" fill="#2d8a7e" opacity="0.6"
          style={{ filter: 'url(#soft-glow)' }} />
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

  /* ════════════════════════════════════
     SIGN-UP VIEW
     ════════════════════════════════════ */
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
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--lp-accent)' }}>Instant Raman Pro</span>
          </div>
        </header>

        <main className="lp-container lp-signup-grid">
          <div className="lp-signup-features">
            <div className="lp-signup-features-header">
              <span className="lp-signup-badge">PRO EDITION</span>
              <h2 className="lp-signup-title">Make Spectral Workflows Smarter</h2>
            </div>

            <div className="lp-signup-feature-item">
              <div className="lp-signup-feature-icon"><Zap size={20} /></div>
              <div className="lp-signup-feature-content">
                <h4>LM Multi-Peak Deconvolution</h4>
                <p>Fit overlapping bands with Voigt, Lorentzian, and Gaussian lineshapes using true client-side Levenberg-Marquardt optimization.</p>
              </div>
            </div>

            <div className="lp-signup-feature-item">
              <div className="lp-signup-feature-icon"><ShieldCheck size={20} /></div>
              <div className="lp-signup-feature-content">
                <h4>Split Uncertainty Quantification</h4>
                <p>Submit with confidence. Quantify and separate statistical noise (bootstrap) from epistemic model bias for your publication.</p>
              </div>
            </div>

            <div className="lp-signup-feature-item">
              <div className="lp-signup-feature-icon"><CheckCircle2 size={20} /></div>
              <div className="lp-signup-feature-content">
                <h4>Reproducibility Protocol (.irp)</h4>
                <p>Standardize analyses. Save full correction, fitting, and calibration states as a cryptographically-hashed file to share with peer reviewers or team members.</p>
              </div>
            </div>

            <div className="lp-signup-feature-item">
              <div className="lp-signup-feature-icon"><ImageIcon size={20} /></div>
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

  /* ════════════════════════════════════
     MAIN LANDING PAGE
     ════════════════════════════════════ */
  return (
    <div className="lp-root">

      {/* ── NAVIGATION ── */}
      <NavBar onEnterWorkstation={onEnterWorkstation} isDesktop={isDesktop} />

      {/* ── HERO ── */}
      <section className="lp-hero">
        <div className="lp-container">
          <div className="lp-hero-content">
            <div className="lp-hero-text">
              <motion.h1
                className="lp-hero-h1"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.1 }}
              >
                Your Raman Assistant
              </motion.h1>

              <motion.p
                className="lp-hero-sub"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.2 }}
              >
                Less processing. Less plotting. More analysis.
              </motion.p>

              <motion.div
                className="lp-hero-actions"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.3 }}
              >
                {isDesktop ? (
                  <button onClick={onEnterWorkstation} className="lp-btn-primary">
                    Launch Workstation
                    <ArrowRight size={18} />
                  </button>
                ) : (
                  <div className="lp-btn-primary" style={{ opacity: 0.45, cursor: 'not-allowed' }}>
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
                transition={{ duration: 0.7, delay: 0.55 }}
              >
                <div className="lp-trust-item"><ShieldCheck size={14} className="lp-text-accent" /> 100% Client-Side</div>
                <div className="lp-trust-item"><CheckCircle2 size={14} className="lp-text-accent" /> SHA-256 Verified</div>
                <div className="lp-trust-item"><Lock size={14} className="lp-text-accent" /> Zero Backend</div>
                <div className="lp-trust-item"><GitBranch size={14} className="lp-text-accent" /> Open Source</div>
              </motion.div>
            </div>

            <motion.div
              className="lp-hero-visual"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <SpectralDeconvolutionVisual />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── FEATURES — Built for Researchers ── */}
      <section className="lp-features" id="features">
        <div className="lp-container">
          <div className="lp-section-header">
            <span className="lp-section-label">Workflow</span>
            <h2 className="lp-section-heading">Built for Researchers</h2>
            <p className="lp-section-desc">
              From raw instrument data to publication-ready figures, without the workflow headache.
            </p>
          </div>

          <div className="lp-features-grid">
            <FadeIn>
              <div className="lp-feature-card">
                <div className="lp-feature-icon"><Upload size={22} /></div>
                <div className="lp-feature-title">Drop in Your Spectra</div>
                <div className="lp-feature-desc">
                  Reads Renishaw, Horiba, WITec, Bruker, Ocean Optics, JCAMP-DX, CSV, and TXT — no conversion needed. Universal format support means you spend zero time on file prep.
                </div>
              </div>
            </FadeIn>
            <FadeIn delay={0.1}>
              <div className="lp-feature-card">
                <div className="lp-feature-icon"><Activity size={22} /></div>
                <div className="lp-feature-title">Publication-Ready in Seconds</div>
                <div className="lp-feature-desc">
                  Automated SNIP baseline correction, parabolic peak detection, and Levenberg-Marquardt multi-peak deconvolution — all running instantly in your browser.
                </div>
              </div>
            </FadeIn>
            <FadeIn delay={0.2}>
              <div className="lp-feature-card">
                <div className="lp-feature-icon"><ShieldCheck size={22} /></div>
                <div className="lp-feature-title">Your Data Stays Private</div>
                <div className="lp-feature-desc">
                  100% client-side. Zero servers, zero uploads, zero tracking. Your spectral data never leaves your computer — complete privacy by design.
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="lp-pricing" id="pricing">
        <div className="lp-container">
          <div className="lp-section-header">
            <span className="lp-section-label">Plans</span>
            <p className="lp-section-desc" style={{ marginTop: 0 }}>One-time purchase provides lifetime access.</p>
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
            <FadeIn delay={0.15} className="pricing-card pro">
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

      {/* ── CITATION & METHODS ── */}
      <section className="lp-citation">
        <div className="lp-container">
          <div className="lp-section-header">
            <span className="lp-section-label">Academic Growth</span>
            <h2 className="lp-section-heading">Ready for Peer Review</h2>
          </div>

          <div className="citation-grid">
            <FadeIn>
              <div className="citation-block-label">Methods Section Template</div>
              <div className="citation-block-desc">
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

            <FadeIn delay={0.15}>
              <div className="citation-block-label">BibTeX Citation</div>
              <div className="citation-block-desc">
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

      {/* ── FOOTER ── */}
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
