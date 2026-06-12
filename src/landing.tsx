import React, { useEffect, useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  ArrowRight,
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
  Globe
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

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleCopy = async (text: string, setter: (val: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setter(true);
      setTimeout(() => setter(false), 2000);
    } catch { /* fallback silently */ }
  };

  return (
    <div className="lp-root">
      {/* ════════════════════════════════════════════
          SECTION 1: HERO
          ════════════════════════════════════════════ */}
      <section className="lp-hero">
        <div className="lp-container">
          <div className="lp-hero-content">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="lp-hero-badge"
            >
              <span className="lp-hero-dot" />
              Instant Raman v2.5 · Open Source · Browser-based
            </motion.div>

            <motion.h1
              className="lp-hero-h1"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              The only browser-based Raman analysis tool with Levenberg-Marquardt deconvolution.
            </motion.h1>

            <motion.p
              className="lp-hero-sub"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              An open-source, client-side workstation designed for high-precision spectral processing, Levenberg-Marquardt fitting, and split statistical/epistemic uncertainty quantification.
            </motion.p>

            <motion.div
              className="lp-hero-actions"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              {isDesktop ? (
                <button onClick={onEnterWorkstation} className="lp-btn-primary">
                  Launch Workstation (Free)
                  <ArrowRight size={18} />
                </button>
              ) : (
                <div className="lp-btn-primary" style={{ opacity: 0.7, cursor: 'not-allowed' }}>
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
              <div className="lp-trust-item"><GitBranch size={14} className="lp-text-accent" /> Open source (GitHub)</div>
              <div className="lp-trust-item"><Globe size={14} className="lp-text-accent" /> 46+ researchers · 7 countries</div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SECTION 2: VACUUM (The Standard)
          ════════════════════════════════════════════ */}
      <section className="lp-vacuum">
        <div className="lp-container">
          <FadeIn>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#64748b' }}>The Modern Standard for Raman Analysis</h3>
            <div className="lp-vacuum-logos">
              <span>JCAMP-DX (.jdx)</span>
              <span>Horiba LabSpec</span>
              <span>Renishaw WiRE</span>
              <span>Ocean Optics</span>
              <span>Bruker OPUS</span>
              <span>CSV/TXT</span>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SECTION 3: FEATURES (Bento Grid)
          ════════════════════════════════════════════ */}
      <section className="lp-features" id="features">
        <div className="lp-container">
          <div className="lp-section-header">
            <span className="lp-section-label">Capabilities</span>
            <h2 className="lp-section-heading">Core Features</h2>
          </div>

          <div className="bento-grid lp-features-grid">
            {/* LM Multi-Peak Deconvolution (First and Most Prominent) */}
            <FadeIn className="bento-card bento-col-12" style={{ background: '#0f172a', color: '#fff', borderColor: '#1e293b' }}>
              <div className="bento-icon" style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', borderColor: 'rgba(255,255,255,0.15)' }}><Zap size={20} /></div>
              <h3 className="bento-title" style={{ color: '#fff' }}>LM Multi-Peak Deconvolution</h3>
              <p className="bento-desc" style={{ color: '#94a3b8', maxWidth: '800px' }}>
                The only browser-based tool offering true <span className="lp-font-mono" style={{ color: '#fff' }}>Levenberg-Marquardt</span> non-linear optimization. Automatically resolve complex overlapping peaks using <span className="lp-font-mono" style={{ color: '#fff' }}>Lorentzian</span>, <span className="lp-font-mono" style={{ color: '#fff' }}>Gaussian</span>, or <span className="lp-font-mono" style={{ color: '#fff' }}>Voigt</span> lineshapes in milliseconds.
              </p>
            </FadeIn>

            {/* Split Uncertainty Quantification */}
            <FadeIn delay={0.1} className="bento-card bento-col-8">
              <div className="bento-icon"><Activity size={20} /></div>
              <h3 className="bento-title">Split Uncertainty Quantification</h3>
              <p className="bento-desc">
                Instant Raman separates statistical error (via <span className="lp-font-mono">SVD/Bootstrap</span>) from epistemic error (via boundary perturbation). Stop conflating random noise with model bias.
              </p>
            </FadeIn>
            
            {/* Monte Carlo Propagation */}
            <FadeIn delay={0.2} className="bento-card bento-col-4">
              <div className="bento-icon"><Binary size={20} /></div>
              <h3 className="bento-title">Monte Carlo Propagation</h3>
              <p className="bento-desc">
                Rigorous <span className="lp-font-mono">95%</span> Confidence Intervals for derived quantities like <span className="lp-font-mono">I_D/I_G</span> ratio.
              </p>
            </FadeIn>

            {/* Byte-for-Byte Reproducibility */}
            <FadeIn delay={0.1} className="bento-card bento-col-4">
              <div className="bento-icon"><CheckCircle2 size={20} /></div>
              <h3 className="bento-title">Byte-for-Byte Reproducibility</h3>
              <p className="bento-desc">
                Every analysis serializes to a cryptographically hashed <span className="lp-font-mono">.irp</span> protocol. Reload it months later for an exact match.
              </p>
            </FadeIn>

            {/* Universal File Ingestion */}
            <FadeIn delay={0.2} className="bento-card bento-col-4">
              <div className="bento-icon"><Upload size={20} /></div>
              <h3 className="bento-title">Universal File Ingestion</h3>
              <p className="bento-desc">
                Drag and drop proprietary formats from major instrument vendors. European decimal handling is fully automatic.
              </p>
            </FadeIn>

            {/* Publication-Ready Exports */}
            <FadeIn delay={0.3} className="bento-card bento-col-4">
              <div className="bento-icon"><ImageIcon size={20} /></div>
              <h3 className="bento-title">Publication-Ready Exports</h3>
              <p className="bento-desc">
                Export standalone <span className="lp-font-mono">HTML</span> reports, <span className="lp-font-mono">300-DPI PNG</span> figures, and vector <span className="lp-font-mono">SVG</span> files ready for journal submission.
              </p>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SECTION 4: PRICING
          ════════════════════════════════════════════ */}
      <section className="lp-pricing" id="pricing">
        <div className="lp-container">
          <div className="lp-section-header">
            <span className="lp-section-label">Access</span>
            <h2 className="lp-section-heading">Transparent Pricing for Academic Budgets</h2>
            <p style={{ color: '#64748b', marginTop: 16, fontSize: '1.1rem' }}>No subscriptions. No grant approval hurdles. Just software you own.</p>
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
                <li className="pro-feature"><CheckCircle2 size={16} /> <span className="lp-font-mono">SVG</span> & High-Res Export</li>
                <li className="pro-feature"><CheckCircle2 size={16} /> Interactive <span className="lp-font-mono">HTML</span> Report Export</li>
              </ul>
              
              <a href="#" className="lp-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Get Pro License <ChevronRight size={18} />
              </a>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SECTION 5: CITATION & METHODS
          ════════════════════════════════════════════ */}
      <section className="lp-citation">
        <div className="lp-container">
          <div className="lp-section-header">
            <span className="lp-section-label">Academic Growth</span>
            <h2 className="lp-section-heading">Ready for Peer Review</h2>
          </div>

          <div className="citation-grid">
            <FadeIn>
              <div style={{ marginBottom: 8, fontWeight: 600, fontSize: '0.9rem', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>METHODS SECTION TEMPLATE</div>
              <div style={{ marginBottom: 16, color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.5' }}>
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
              <div style={{ marginBottom: 8, fontWeight: 600, fontSize: '0.9rem', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>BIBTEX CITATION</div>
              <div style={{ marginBottom: 16, color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.5' }}>
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
