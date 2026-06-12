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
  Briefcase,
  Terminal,
  Mail,
  Heart
} from 'lucide-react';
import DiagnosticBrain from './components/DiagnosticBrain';

interface LandingProps {
  onEnterWorkstation: () => void;
}

/* ── Fade-in wrapper ── */
const FadeIn: React.FC<{ children: React.ReactNode; delay?: number; className?: string }> = ({ children, delay = 0, className = '' }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
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
              Instant Raman v2.5
            </motion.div>

            <motion.h1
              className="lp-hero-h1"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              The only browser-based Raman workstation with LM deconvolution.
            </motion.h1>

            <motion.p
              className="lp-hero-sub"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Automated spectral rigor, uncertainty quantification, and publication-ready exports. Zero installation required.
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
            </motion.div>

            <motion.div
              className="lp-trust-signals"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              <div className="lp-trust-item"><ShieldCheck size={16} className="lp-text-accent" /> 100% Client-Side</div>
              <div className="lp-trust-item"><CheckCircle2 size={16} className="lp-text-accent" /> SHA-256 Verified</div>
              <div className="lp-trust-item"><Lock size={16} className="lp-text-accent" /> Zero Backend</div>
            </motion.div>
          </div>

          {/* Bento Dashboard Preview */}
          {isDesktop && (
            <motion.div
              className="lp-hero-dashboard"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <DiagnosticBrain />
              {/* Overlay shadow to make it look like a framed dashboard */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.05)', pointerEvents: 'none', borderRadius: 16 }} />
            </motion.div>
          )}
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
            <span className="lp-section-label">Scientific Rigor</span>
            <h2 className="lp-section-heading">Designed for Publication.</h2>
          </div>

          <div className="bento-grid lp-features-grid">
            {/* Priority 1 */}
            <FadeIn className="bento-card bento-col-8">
              <div className="bento-icon accent"><Activity size={24} /></div>
              <h3 className="bento-title">Split Uncertainty Quantification</h3>
              <p className="bento-desc">
                Instant Raman separates statistical error (via SVD/Bootstrap) from epistemic error (via boundary perturbation). Stop conflating random noise with model bias.
              </p>
            </FadeIn>
            
            <FadeIn delay={0.1} className="bento-card bento-col-4">
              <div className="bento-icon"><Binary size={24} /></div>
              <h3 className="bento-title">Monte Carlo Propagation</h3>
              <p className="bento-desc">
                Rigorous 95% Confidence Intervals for derived quantities like $I_D/I_G$ ratio.
              </p>
            </FadeIn>

            <FadeIn delay={0.2} className="bento-card bento-col-12" style={{ background: '#0f172a', color: '#fff', borderColor: '#1e293b' }}>
              <div className="bento-icon" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }}><Zap size={24} /></div>
              <h3 className="bento-title" style={{ color: '#fff' }}>LM Multi-Peak Deconvolution</h3>
              <p className="bento-desc" style={{ color: '#94a3b8', maxWidth: '800px' }}>
                The only browser-based tool offering true Levenberg-Marquardt non-linear optimization. Automatically resolve complex overlapping peaks using Lorentzian, Gaussian, or Voigt lineshapes—in milliseconds.
              </p>
            </FadeIn>

            {/* Priority 2 */}
            <FadeIn delay={0.1} className="bento-card bento-col-4">
              <div className="bento-icon"><CheckCircle2 size={24} /></div>
              <h3 className="bento-title">Byte-for-Byte Reproducibility</h3>
              <p className="bento-desc">
                Every analysis serializes to a cryptographically hashed .irp protocol. Reload it months later for an exact match.
              </p>
            </FadeIn>

            <FadeIn delay={0.2} className="bento-card bento-col-4">
              <div className="bento-icon"><Upload size={24} /></div>
              <h3 className="bento-title">Universal File Ingestion</h3>
              <p className="bento-desc">
                Drag and drop proprietary formats from major instrument vendors. European decimal handling is fully automatic.
              </p>
            </FadeIn>

            <FadeIn delay={0.3} className="bento-card bento-col-4">
              <div className="bento-icon"><ImageIcon size={24} /></div>
              <h3 className="bento-title">Publication-Ready Exports</h3>
              <p className="bento-desc">
                Export standalone HTML reports, 300-DPI PNG figures, and vector SVG files ready for journal submission.
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
            <span className="lp-section-label">Business Model</span>
            <h2 className="lp-section-heading">Transparent Pricing for Academic Budgets</h2>
            <p style={{ color: '#64748b', marginTop: 16, fontSize: '1.1rem' }}>No subscriptions. No grant approval hurdles. Just software you own.</p>
          </div>

          <div className="lp-pricing-grid">
            {/* Free Tier */}
            <FadeIn className="pricing-card">
              <div className="pricing-tier">Community</div>
              <div className="pricing-price">$0</div>
              <div className="pricing-period">Free forever</div>
              <p className="pricing-desc">A complete, useful workstation for basic spectral analysis and evaluation.</p>
              
              <ul className="pricing-features">
                <li><CheckCircle2 size={16} /> Unlimited file ingestion (All formats)</li>
                <li><CheckCircle2 size={16} /> SNIP baseline correction</li>
                <li><CheckCircle2 size={16} /> Cosmic ray removal</li>
                <li><CheckCircle2 size={16} /> Peak detection (Parabolic refinement)</li>
                <li><CheckCircle2 size={16} /> Standard PNG export</li>
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
                <li className="pro-feature"><CheckCircle2 size={16} /> <strong>LM Multi-Peak Deconvolution</strong></li>
                <li className="pro-feature"><CheckCircle2 size={16} /> <strong>Uncertainty Quantification Suite</strong></li>
                <li className="pro-feature"><CheckCircle2 size={16} /> Monte Carlo Ratio Propagation</li>
                <li className="pro-feature"><CheckCircle2 size={16} /> Reproducibility Protocol (.irp)</li>
                <li className="pro-feature"><CheckCircle2 size={16} /> Replicate Analysis (Mean ± SD)</li>
                <li className="pro-feature"><CheckCircle2 size={16} /> Batch Comparison (Waterfall mode)</li>
                <li className="pro-feature"><CheckCircle2 size={16} /> SVG & High-Res Export</li>
                <li className="pro-feature"><CheckCircle2 size={16} /> Interactive HTML Report Export</li>
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
              <div style={{ marginBottom: 16, fontWeight: 700, fontSize: 18 }}>Pre-Authored Methods Section</div>
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
              <div style={{ marginBottom: 16, fontWeight: 700, fontSize: 18 }}>Cite Instant Raman</div>
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
          SECTION 6: ABOUT
          ════════════════════════════════════════════ */}
      <section className="lp-about-section">
        <div className="lp-container">
          <FadeIn>
            <div className="lp-about-inner">
              <span className="lp-section-label">Built By</span>
              <h3 className="lp-about-name">Shekhar Dulgach</h3>
              <p className="lp-about-role">Materials Researcher & Engineer</p>
              <p className="lp-about-bio">
                MSc (Eng) in Materials Science & Engineering, University of Leeds. 
                Research focus on API crystallization kinetics, Raman characterization, 
                and computational materials informatics.
              </p>
              <div className="lp-about-links">
                <a href="https://www.linkedin.com/in/shekhardulgach/" target="_blank" rel="noopener noreferrer" className="lp-about-link">
                  <Briefcase size={16} /> LinkedIn
                </a>
                <a href="https://github.com/ShekharDul/raman-instant" target="_blank" rel="noopener noreferrer" className="lp-about-link">
                  <Terminal size={16} /> GitHub
                </a>
                <a href="mailto:shekhardulgach19@gmail.com" className="lp-about-link">
                  <Mail size={16} /> Contact
                </a>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          FOOTER
          ════════════════════════════════════════════ */}
      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <div className="lp-footer-left">
            <span className="lp-footer-brand">Instant Raman</span>
            <span className="lp-footer-copy">© {new Date().getFullYear()} Shekhar Dulgach</span>
          </div>
          <div className="lp-footer-right">
            <a href="https://github.com/ShekharDul/raman-instant" target="_blank" rel="noopener noreferrer">
              GitHub <ExternalLink size={12} />
            </a>
            <a href="https://www.linkedin.com/in/shekhardulgach/" target="_blank" rel="noopener noreferrer">
              LinkedIn <ExternalLink size={12} />
            </a>
            <a href="https://rzp.io/rzp/3VZL3oi" target="_blank" rel="noopener noreferrer" className="lp-footer-support">
              <Heart size={12} /> Support Open Science
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
