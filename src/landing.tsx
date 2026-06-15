import React from 'react';
import peakFitImg from './assets/peak_fit.png';
import rawPlotImg from './assets/raw_plot.svg';
import correctedPlotImg from './assets/corrected_plot.svg';
import './styles/landing.css';
import { Github, Mail, Linkedin, ExternalLink } from 'lucide-react';

interface LandingProps {
  onEnterWorkstation: () => void;
}

const Landing: React.FC<LandingProps> = ({ onEnterWorkstation }) => {
  return (
    <div className="portfolio-wrapper">
      {/* HEADER */}
      <header className="pf-header">
        <div className="pf-brand">
          Instant Raman <span className="pf-version">v1.2.0-beta</span>
        </div>
        <nav className="pf-nav-links">
          <a href="https://github.com/raman-instant/core" className="pf-nav-link">GitHub</a>
          <a href="mailto:author@example.com" className="pf-nav-link">Contact</a>
        </nav>
      </header>

      {/* HERO SECTION */}
      <section className="pf-hero">
        <div className="pf-hero-content">
          <h1 className="pf-hero-title">
            Browser-based Raman spectroscopy processing pipeline featuring non-linear least squares peak deconvolution with exact Jacobian-based confidence bounds.
          </h1>
          <p className="pf-hero-subtitle">
            Engineered entirely in TypeScript for 100% client-side execution. Eliminates manual anchor-point bias and provides rigorous mathematical transparency for peer-reviewed research.
          </p>
        </div>
        
        <figure className="pf-figure">
          <img src={peakFitImg} alt="High-wavenumber deconvolution" className="pf-figure-img" />
          <figcaption className="pf-figure-caption">
            Fig 1. High-wavenumber deconvolution (1000-2000 cm⁻¹) utilizing Levenberg-Marquardt optimization for overlapping Gaussian profiles.
          </figcaption>
        </figure>
      </section>

      {/* METHODOLOGY SECTION */}
      <section className="pf-methodology">
        <h2 className="pf-section-title">Core Methodology & Architecture</h2>
        
        <div className="pf-method-row">
          <div className="pf-method-label">01_Universal_Import</div>
          <div className="pf-method-details">
            <h3>Format Agnostic Data Ingestion</h3>
            <p>
              Analytical instrumentation output is notoriously fragmented. The custom parsing engine dynamically identifies and sanitizes inputs from Horiba LabSpec, Bruker OPUS, and Ocean Optics generic CSV/TXT outputs. This eliminates the preliminary data wrangling phase, standardizing the ingestion vector for the core processing pipeline.
            </p>
          </div>
        </div>

        <div className="pf-method-row">
          <div className="pf-method-label">02_Baseline_Correction</div>
          <div className="pf-method-details">
            <h3>Algorithmic Background Subtraction</h3>
            <p>
              Traditional manual multi-point baseline correction introduces significant researcher bias. Instant Raman implements the Simple Non-Iterative Peak (SNIP) algorithm alongside Savitzky-Golay smoothing. This ensures a reproducible, mathematically objective subtraction of fluorescence backgrounds without clipping critical signal intensity.
            </p>
            <figure className="pf-figure">
              <img src={correctedPlotImg} alt="Automated baseline correction" className="pf-figure-img" />
              <figcaption className="pf-figure-caption">Fig 2. SNIP baseline subtraction applied to raw acquisition data.</figcaption>
            </figure>
          </div>
        </div>

        <div className="pf-method-row">
          <div className="pf-method-label">03_Deconvolution</div>
          <div className="pf-method-details">
            <h3>Non-Linear Least Squares Fitting</h3>
            <p>
              For heavily overlapping spectral regions (such as the 1000-2000 cm⁻¹ fingerprint area), basic peak-picking fails. The engine utilizes a Levenberg-Marquardt algorithm to fit sums of predefined line shapes (Gaussian, Lorentzian, Pseudo-Voigt). Crucially, the system calculates the Jacobian matrix to provide explicit uncertainty bounds (±) for every fitted parameter (center, width, amplitude).
            </p>
          </div>
        </div>
      </section>

      {/* ENGINEERING RIGOR SECTION */}
      <section className="pf-rigor">
        <h2 className="pf-section-title">Engineering Rigor</h2>
        <div className="pf-rigor-grid">
          <div className="pf-rigor-item">
            <h4>100% Client-Side Computation</h4>
            <p>
              Architected entirely in TypeScript and React. Complex matrix operations execute locally within the browser, ensuring zero latency and absolute data privacy. Research data never leaves the local machine.
            </p>
          </div>
          <div className="pf-rigor-item">
            <h4>Reproducibility Protocol (.irp)</h4>
            <p>
              Every processing action generates a deterministic `Instant Raman Protocol` file. These files embed a SHA-256 hash of the operations, allowing peers or reviewers to exactly reconstruct the data pipeline.
            </p>
          </div>
          <div className="pf-rigor-item">
            <h4>Academic Validation</h4>
            <p>
              Designed to meet the rigorous standards of computational reproducibility demanded by modern high-impact scientific journals.
            </p>
          </div>
        </div>
      </section>

      {/* BUILDER SECTION */}
      <section className="pf-builder">
        <h2 className="pf-section-title">About the Builder</h2>
        <div className="pf-builder-content">
          <p>
            This tool was developed out of direct frustration with existing analytical workflows. During research involving pharmaceutical API crystallization, I encountered a critical bottleneck: the lack of accessible, modern, and reproducible software for bulk Powder X-Ray Diffraction (PXRD) and Raman spectroscopy analysis.
          </p>
          <p>
            The commercial options were prohibitively expensive, legacy desktop applications built in the 1990s, requiring tedious manual intervention for every single spectrum. 
          </p>
          <p>
            Instant Raman was built to solve this specific pain point. It bridges the gap between sophisticated analytical chemistry requirements and modern software engineering standards. It demonstrates that scientific software can be fast, private, mathematically rigorous, and exceptionally designed.
          </p>
          <a href="https://linkedin.com/in/author" target="_blank" rel="noopener noreferrer" className="pf-contact-link">
            <Linkedin size={16} /> View Professional Profile
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="pf-footer">
        <div className="pf-citation">
          <strong>Citation:</strong> Author, (2026). Instant Raman: A client-side web application for reproducible Raman spectroscopy data processing. <em>GitHub Repository</em>, https://github.com/raman-instant/core
        </div>
        <div className="pf-footer-links">
          <a href="https://github.com/raman-instant/core"><Github size={16} /></a>
          <a href="mailto:author@example.com"><Mail size={16} /></a>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
