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
              <img
                src="hero-curves-only.png"
                alt="Raman spectral deconvolution visualization"
                className="lp-hero-img"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          CAPABILITIES — THREE PILLARS
          ════════════════════════════════════════════ */}
      <section className="lp-features" id="features">
        <div className="lp-container">
          <div className="lp-section-header">
            <span className="lp-section-label">Capabilities</span>
            <h2 className="lp-section-heading">Process. Plot. Analyse.</h2>
          </div>

          <div className="pillars-grid">
            {/* PROCESS */}
            <FadeIn className="pillar">
              <div className="pillar-icon"><Zap size={22} /></div>
              <h3 className="pillar-title">Process</h3>
              <p className="pillar-desc">Automated spectral preprocessing. Drag your files in and let the corrections run.</p>
              <div className="pillar-divider" />
              <ul className="pillar-features">
                <li><CheckCircle2 size={14} /> <span className="lp-font-mono">SNIP</span> baseline correction</li>
                <li><CheckCircle2 size={14} /> Cosmic ray removal</li>
                <li><CheckCircle2 size={14} /> Universal file ingestion (all major formats)</li>
                <li><CheckCircle2 size={14} /> Peak detection with parabolic refinement</li>
              </ul>
            </FadeIn>

            {/* PLOT */}
            <FadeIn delay={0.15} className="pillar">
              <div className="pillar-icon"><ImageIcon size={22} /></div>
              <h3 className="pillar-title">Plot</h3>
              <p className="pillar-desc">Publication-quality figures and exports. From browser to journal in one click.</p>
              <div className="pillar-divider" />
              <ul className="pillar-features">
                <li><CheckCircle2 size={14} /> <span className="lp-font-mono">300-DPI PNG</span> figures</li>
                <li><CheckCircle2 size={14} /> Vector <span className="lp-font-mono">SVG</span> export</li>
                <li><CheckCircle2 size={14} /> Interactive <span className="lp-font-mono">HTML</span> reports</li>
                <li><CheckCircle2 size={14} /> Excel data tables</li>
              </ul>
            </FadeIn>

            {/* ANALYSE */}
            <FadeIn delay={0.3} className="pillar">
              <div className="pillar-icon"><Activity size={22} /></div>
              <h3 className="pillar-title">Analyse</h3>
              <p className="pillar-desc">Advanced fitting and statistical rigor for results you can publish with confidence.</p>
              <div className="pillar-divider" />
              <ul className="pillar-features">
                <li><CheckCircle2 size={14} /> <span className="lp-font-mono">LM</span> Multi-Peak Deconvolution</li>
                <li><CheckCircle2 size={14} /> Split Uncertainty Quantification</li>
                <li><CheckCircle2 size={14} /> <span className="lp-font-mono">Monte Carlo</span> ratio propagation</li>
                <li><CheckCircle2 size={14} /> Reproducibility Protocol (<span className="lp-font-mono">.irp</span>)</li>
              </ul>
            </FadeIn>
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
