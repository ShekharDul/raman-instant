import React, { useEffect, useState } from 'react';
import { 
  ArrowDown, 
  ArrowRight, 
  Mail, 
  FileText, 
  CircleCheck, 
  ChevronRight, 
  Binary, 
  Beaker, 
  Code, 
  MessageSquare,
  Award,
  Terminal,
  Briefcase
} from 'lucide-react';

interface LandingProps {
  onEnterWorkstation: () => void;
}

const Landing: React.FC<LandingProps> = ({ onEnterWorkstation }) => {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  return (
    <div className="lp-wrapper">
      
      {/* ── SECTION 1: HERO ── */}
      <section className="lp-hero">
        <div className="lp-max-width">
          <div className="lp-badge">
            <span className="lp-dot"></span>
            Project: Instant Raman v1.4
          </div>
          
          <h1 className="lp-hero-h1">
            Boundary-Dependent <br/>
            <span>Uncertainty Analysis</span>
          </h1>
          
          <p className="lp-hero-p">
            Quantifying epistemic ambiguity in spectroscopic curve-fitting through automated ensemble-based perturbation.
          </p>

          <div className="lp-hero-actions">
            {isDesktop ? (
              <button 
                onClick={onEnterWorkstation}
                className="lp-btn-primary"
              >
                Launch Spectral Workstation
                <ArrowRight size={20} />
              </button>
            ) : (
              <div className="lp-badge lp-mono">
                Workstation requires desktop environment.
              </div>
            )}
            
            <div className="lp-scroll-hint lp-mt-12">
              <span className="lp-mono lp-text-teal" style={{ fontSize: '10px', fontWeight: 700 }}>Research Context</span>
              <div className="lp-mt-12">
                <ArrowDown size={16} className="lp-text-teal" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 2: THE PROBLEM ── */}
      <section id="problem" className="lp-section bg-white">
        <div className="lp-narrow-width">
          <div className="lp-section-mono lp-mb-8" style={{ textAlign: 'center' }}>Problem Definition</div>
          
          <div className="lp-copy">
            <p className="lp-mb-8" style={{ fontSize: '1.25rem', color: 'var(--lp-gray-600)' }}>
              Traditional Raman spectroscopy software treats peak fitting as a single, fixed result, ignoring how 
              minor adjustments to analysis boundaries can lead to significant shifts in your data.
            </p>
            <p className="lp-mb-8" style={{ paddingLeft: '32px', borderLeft: '4px solid var(--lp-teal)', fontWeight: 700, fontSize: '1.25rem' }}>
              This "boundary-dependency" is a form of uncertainty that standard workflows systematically overlook, 
              potentially leading to false assignments of chemical states.
            </p>
            <p style={{ fontSize: '1.125rem', color: 'var(--lp-gray-600)' }}>
              Instant Raman was developed to expose this ambiguity by running multi-fit ensembles across 
              varying boundaries, providing a verified range instead of a single, potentially biased number.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 3: THE APPROACH ── */}
      <section className="lp-section">
        <div className="lp-extra-wide">
          <div className="lp-section-title-wrapper" style={{ textAlign: 'center' }}>
            <span className="lp-section-mono">Ensemble Methodology</span>
            <h2 className="lp-section-h2">Comparing Analysis Outcomes</h2>
          </div>

          <div className="lp-comparison-grid">
            {/* No Fit/Unstable Case */}
            <div className="lp-case-card">
              <img 
                src="assets/CaseA.png" 
                alt="No Fit/Unstable Case" 
                className="lp-case-img"
              />
              <div className="lp-case-content">
                <div className="lp-case-label error">
                  <Terminal size={18} />
                  Case A: Unstable / No Fit Found
                </div>
                <p className="lp-case-p">
                  Ensemble failure or high variance. Boundary perturbations cause the optimizer to 
                  diverge or settle in local minima, signaling that the chosen model is insufficient 
                  for the data complexity.
                </p>
              </div>
            </div>

            {/* Stable Fit Case */}
            <div className="lp-case-card">
              <img 
                src="assets/CaseB.png" 
                alt="Stable Analysis Case" 
                className="lp-case-img"
              />
              <div className="lp-case-content">
                <div className="lp-case-label success">
                  <CircleCheck size={18} />
                  Case B: Stable Fit Analysis
                </div>
                <p className="lp-case-p">
                  Low epistemic uncertainty across the ensemble. The peak position remains robust 
                  regardless of window perturbations, confirming high confidence in the chemical assignment.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 4: CAPABILITIES ── */}
      <section className="lp-section bg-white">
        <div className="lp-max-width">
          <div className="lp-section-title-wrapper">
            <span className="lp-section-mono">Core Capabilities</span>
            <h2 className="lp-section-h2">Rigor as a Feature</h2>
          </div>

          <div className="lp-capability-grid">
            {[
              { icon: <Beaker />, title: "Materials Science", desc: "Raman spectroscopy, polymorph ID, and crystallization study workflows." },
              { icon: <Binary />, title: "Numeric Computation", desc: "Levenberg-Marquardt optimization and SVD covariance analysis." },
              { icon: <Code />, title: "Software Engineering", desc: "Type-safe scientific computing with TypeScript and Plotly.js." },
              { icon: <MessageSquare />, title: "Audit Trails", desc: ".irp JSON protocols with SHA-256 hash verification." }
            ].map((card, i) => (
              <div key={i} className="lp-capability-card">
                <div className="lp-card-icon">
                  {React.cloneElement(card.icon as React.ReactElement<any>, { size: 24 })}
                </div>
                <h4 className="lp-card-h4">{card.title}</h4>
                <p className="lp-card-p">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 5: ABOUT ── */}
      <section className="lp-section bg-white">
        <div className="lp-max-width">
          <div className="lp-about-grid">
            {/* Bio Column */}
            <div>
              <span className="lp-profile-title">Interested in Material Synthesis and Characterization Roles</span>
              <h3 className="lp-dossier-h3">Shekhar Dulgach</h3>
              <p className="lp-section-mono lp-mb-8">Materials Researcher & Engineer</p>
              
              <div className="lp-mt-12">
                <div className="lp-mb-8">
                  <h4 className="lp-research-h4" style={{ marginBottom: '8px' }}>Technical Focus</h4>
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    <li className="lp-about-text" style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'start' }}>
                      <Beaker size={20} className="lp-text-teal" style={{ marginTop: '4px' }} />
                      Designing Active Pharmaceutical Ingredient (API) crystallization experiments.
                    </li>
                    <li className="lp-about-text" style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'start' }}>
                      <Binary size={20} className="lp-text-teal" style={{ marginTop: '4px' }} />
                      Characterization: P-XRD, SC-XRD, and Raman/Angle-resolved Raman spectroscopy.
                    </li>
                    <li className="lp-about-text" style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'start' }}>
                      <Code size={20} className="lp-text-teal" style={{ marginTop: '4px' }} />
                      Computational tools: Mercury CCDC and CrystalDiffract.
                    </li>
                  </ul>
                </div>
              </div>

              <div className="lp-social-links lp-mt-8">
                <a href="https://www.linkedin.com/in/shekhardulgach/" target="_blank" rel="noopener noreferrer" className="lp-social-btn">
                  <Briefcase size={16} />
                  LinkedIn
                </a>
                <a href="https://github.com/ShekharDul/raman-instant" target="_blank" rel="noopener noreferrer" className="lp-social-btn">
                  <Terminal size={16} />
                  GitHub
                </a>
                <a href="mailto:shekhardulgach19@gmail.com" className="lp-social-btn">
                  <Mail size={16} />
                  Contact
                </a>
              </div>
            </div>

            {/* Background Column */}
            <div className="lp-research-box">
              <h4 className="lp-research-h4">Professional Context</h4>
              <p className="lp-research-p lp-mb-6">
                <strong>Project Focus:</strong> Investigating the influence of solvents on crystal morphology 
                via evaporative crystallization (Leeds/AstraZeneca).
              </p>
              <p className="lp-research-p">
                <strong>Current Qualification:</strong> MSc (Eng) in Materials Science & Engineering, University of Leeds.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="lp-footer">
        <p className="lp-footer-p">
          © {new Date().getFullYear()} Instant Raman · Designed for Academic Rigor
        </p>
      </footer>
    </div>
  );
};

export default Landing;
