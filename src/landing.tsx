import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Zap,
  ShieldCheck,
  CheckCircle2,
  Image as ImageIcon,
} from 'lucide-react';

interface LandingProps {
  onEnterWorkstation: () => void;
}

const Landing: React.FC<LandingProps> = ({ onEnterWorkstation }) => {
  const [showSignUp, setShowSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');

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
              <ArrowLeft size={16} /> Back to Homepage
            </button>
            <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>Instant Raman Pro</span>
          </div>
        </header>

        <main className="lp-signup-grid">
          <div className="lp-signup-features">
            <div className="lp-signup-features-header">
              <span className="lp-signup-badge">PRO LICENSE</span>
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
     MAIN LANDING PAGE (Stellar Minimal)
     ════════════════════════════════════ */
  return (
    <div className="lp-wrapper">
      {/* Centered Headline Content */}
      <div className="lp-center-content">
        <h1 className="lp-title">Instant Raman</h1>
        <p className="lp-subtitle">
          Automate Spectra processing and plotting, <span className="lp-laser-highlight">Get more time for analysis</span>.
        </p>
      </div>

      {/* 3-Column Bottom Navigation */}
      <div className="lp-bottom-nav">
        <div className="lp-column" onClick={onEnterWorkstation}>
          <h3 className="lp-column-title">
            <span className="lp-dot" /> How it works
          </h3>
          <p className="lp-column-desc">
            Explore our automated client-side data correction, SNIP baselines, and peak deconvolution algorithms.
          </p>
        </div>

        <div className="lp-column" onClick={onEnterWorkstation}>
          <h3 className="lp-column-title">
            <span className="lp-dot" /> Feature set
          </h3>
          <p className="lp-column-desc">
            Discover Voigt profiles, Monte Carlo uncertainties, and cryptographically-hashed reproducibility protocol (.irp) files.
          </p>
        </div>

        <div className="lp-column" onClick={() => setShowSignUp(true)}>
          <h3 className="lp-column-title">
            <span className="lp-dot" /> Access
          </h3>
          <p className="lp-column-desc">
            Launch the free community research workstation instantly or purchase a Pro license key for advanced publications.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Landing;
