import React, { useEffect, useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  ArrowRight,
  Mail,
  Briefcase,
  Terminal,
  Zap,
  Shield,
  FileCheck,
  Brain,
  Upload,
  Image,
  CheckCircle2,
  Lock,
  Server,
  Copy,
  Heart,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import DiagnosticBrain from './components/DiagnosticBrain';

interface LandingProps {
  onEnterWorkstation: () => void;
}

/* ── Fade-in wrapper ── */
const FadeIn: React.FC<{ children: React.ReactNode; delay?: number; className?: string }> = ({ children, delay = 0, className = '' }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/* ── Capability cards data ── */
const CAPABILITIES = [
  {
    icon: <Zap size={24} />,
    title: 'Automated Baseline & Deconvolution',
    desc: 'Adaptive SNIP baseline correction and Levenberg-Marquardt multi-peak fitting. Gaussian, Lorentzian, or Voigt — resolved automatically.'
  },
  {
    icon: <Shield size={24} />,
    title: 'Split Uncertainty Quantification',
    desc: 'Statistical error from bootstrap resampling. Epistemic error from boundary perturbation. Both reported separately, never conflated.'
  },
  {
    icon: <FileCheck size={24} />,
    title: 'Byte-for-Byte Reproducibility',
    desc: 'Every analysis serializes to a cryptographically hashed .irp protocol. Reload it months later and get the exact same result.'
  },
  {
    icon: <Brain size={24} />,
    title: 'Diagnostic Intelligence',
    desc: "Sarle's Bimodality, Wald-Wolfowitz Runs Test, and KDE phase detection — mapped to physical material phenomena in real-time."
  },
  {
    icon: <Upload size={24} />,
    title: 'Universal File Ingestion',
    desc: 'Reads JCAMP-DX, Horiba LabSpec, Ocean Optics, Bruker DPT, and any CSV/TXT. European decimal formats handled automatically.'
  },
  {
    icon: <Image size={24} />,
    title: 'Publication-Ready Exports',
    desc: '300-DPI PNG, vector SVG, interactive HTML reports, and pre-authored journal methods sections. One click.'
  }
];

const METHODS_TEXT = `Raman spectra were processed using Instant Raman (v2.5). Baseline correction employed the SNIP algorithm (25 iterations). Peak detection used 3-point parabolic interpolation with sub-pixel accuracy. Multi-peak deconvolution was performed via Levenberg-Marquardt optimization with Lorentzian line profiles. Uncertainty quantification combined 500-sample bootstrap resampling (statistical) with boundary-dependent ensemble perturbation (epistemic). All processing was performed client-side; no data was transmitted to external servers.`;

const Landing: React.FC<LandingProps> = ({ onEnterWorkstation }) => {
  const [isDesktop, setIsDesktop] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(METHODS_TEXT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback silently */ }
  };

  return (
    <div className="lp-root">

      {/* ════════════════════════════════════════════
          SECTION 1: HERO
          ════════════════════════════════════════════ */}
      <section className="lp-hero">
        {/* Ambient glow effects */}
        <div className="lp-hero-glow lp-hero-glow--primary" />
        <div className="lp-hero-glow lp-hero-glow--secondary" />

        {/* Background: DiagnosticBrain at reduced opacity */}
        {isDesktop && (
          <div className="lp-hero-brain-bg">
            <DiagnosticBrain />
          </div>
        )}

        {/* Content */}
        <div className="lp-hero-content">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="lp-hero-badge"
          >
            <span className="lp-hero-dot" />
            Instant Raman v2.5 · Open Source
          </motion.div>

          <motion.h1
            className="lp-hero-h1"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
          >
            Drop Your Spectrum.{' '}
            <span className="lp-hero-accent">Get Answers in Seconds.</span>
          </motion.h1>

          <motion.p
            className="lp-hero-sub"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35 }}
          >
            Journal-ready deconvolution, uncertainty quantification, and publication exports
            — entirely in your browser. Your data never leaves your machine.
          </motion.p>

          <motion.div
            className="lp-hero-actions"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55 }}
          >
            {isDesktop ? (
              <button onClick={onEnterWorkstation} className="lp-btn-launch">
                Launch Workstation
                <ArrowRight size={20} />
              </button>
            ) : (
              <div className="lp-mobile-notice">
                <Lock size={14} />
                Desktop required for the full workstation experience.
              </div>
            )}
            <a
              href="https://github.com/ShekharDul/raman-instant"
              target="_blank"
              rel="noopener noreferrer"
              className="lp-btn-ghost"
            >
              <Terminal size={16} />
              View on GitHub
            </a>
          </motion.div>

          <motion.div
            className="lp-trust-badges"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.8 }}
          >
            <span className="lp-trust-pill">100% Client-Side</span>
            <span className="lp-trust-pill">Zero Backend</span>
            <span className="lp-trust-pill">MIT License</span>
          </motion.div>

          {/* Scroll hint */}
          <motion.div
            className="lp-scroll-cue"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.6 }}
          >
            <ChevronDown size={20} className="lp-scroll-bounce" />
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SECTION 2: CAPABILITIES
          ════════════════════════════════════════════ */}
      <section className="lp-capabilities">
        <div className="lp-container">
          <FadeIn>
            <span className="lp-section-label">Core Capabilities</span>
            <h2 className="lp-section-heading">
              Everything You Need for Rigorous Spectral Analysis
            </h2>
          </FadeIn>

          <div className="lp-cap-grid">
            {CAPABILITIES.map((cap, i) => (
              <FadeIn key={i} delay={i * 0.08}>
                <div className="lp-cap-card">
                  <div className="lp-cap-icon">{cap.icon}</div>
                  <h3 className="lp-cap-title">{cap.title}</h3>
                  <p className="lp-cap-desc">{cap.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SECTION 3: TRUST — Zero Backend
          ════════════════════════════════════════════ */}
      <section className="lp-trust-section">
        <div className="lp-container">
          <div className="lp-trust-grid">
            <FadeIn>
              <div className="lp-trust-left">
                <span className="lp-section-label">Privacy Architecture</span>
                <h2 className="lp-trust-heading">
                  Your Data.{' '}
                  <span className="lp-hero-accent">Your Machine.</span>{' '}
                  Period.
                </h2>
                <p className="lp-trust-desc">
                  Instant Raman processes everything locally using browser-native TypeScript. 
                  No server round-trips, no cloud uploads, no telemetry on your spectral data. 
                  Ideal for proprietary pharmaceutical and battery research.
                </p>
              </div>
            </FadeIn>
            <FadeIn delay={0.15}>
              <div className="lp-trust-right">
                {[
                  { icon: <Server size={20} />, text: 'All computation runs in your browser — WebAssembly-speed TypeScript engine' },
                  { icon: <Lock size={20} />, text: 'No server, no upload, no cloud storage. Files stay on your filesystem.' },
                  { icon: <CheckCircle2 size={20} />, text: 'SHA-256 hash verification on every .irp protocol for audit compliance' }
                ].map((item, i) => (
                  <div key={i} className="lp-trust-item">
                    <div className="lp-trust-item-icon">{item.icon}</div>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SECTION 4: METHODS COPY
          ════════════════════════════════════════════ */}
      <section className="lp-methods-section">
        <div className="lp-container lp-methods-container">
          <FadeIn>
            <span className="lp-section-label">For Your Manuscript</span>
            <h2 className="lp-section-heading">Pre-Authored Methods Section</h2>
            <p className="lp-methods-intro">
              Copy this directly into your journal submission. Every parameter is verifiable via the .irp protocol.
            </p>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div className="lp-methods-block">
              <div className="lp-methods-header">
                <span>methods_section.txt</span>
                <button onClick={handleCopy} className="lp-copy-btn">
                  {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="lp-methods-pre">{METHODS_TEXT}</pre>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SECTION 5: ABOUT
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
            <span className="lp-footer-copy">© {new Date().getFullYear()} · MIT License</span>
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
