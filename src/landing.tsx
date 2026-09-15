import React from 'react';

interface LandingProps {
  onEnterWorkstation: () => void;
  onTrySample: () => void;
}

const Landing: React.FC<LandingProps> = ({ onEnterWorkstation, onTrySample }) => {
  return (
    <div
      id="landing-canvas"
      style={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: '#f2f2f2',
        boxSizing: 'border-box',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        position: 'relative',
        overflowX: 'hidden',
      }}
    >
      {/* Centered Content Container */}
      <div
        style={{
          maxWidth: '1080px',
          margin: '0 auto',
          padding: '24px 32px',
          boxSizing: 'border-box',
        }}
      >
        {/* Top Navigation */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div
            style={{
              fontSize: '20px',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: '#0f172a',
              userSelect: 'none',
            }}
          >
            Instant Raman
          </div>

          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
            }}
          >
            <a
              href="https://github.com/ShekharDul/raman-instant"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '14px',
                fontWeight: 500,
                color: '#475569',
                textDecoration: 'none',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#0f172a')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#475569')}
            >
              GitHub
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '14px',
                fontWeight: 500,
                color: '#475569',
                textDecoration: 'none',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#0f172a')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#475569')}
            >
              LinkedIn
            </a>
          </nav>
        </header>

        <main>
        <section className="research-intro" aria-labelledby="research-title">
          <p className="research-intro-note">A free tool for researchers</p>
          <h1 id="research-title">Raman spectrum analysis,<br />in your browser.</h1>
          <p className="research-intro-description">
            Import CSV or Excel data to correct baselines, fit peaks, and prepare plots for your research.
          </p>
          <div className="research-intro-actions">
            <button type="button" className="research-open-tool" onClick={onEnterWorkstation}>Open tool</button>
            <button type="button" className="research-try-sample" onClick={onTrySample}>Try sample data</button>
          </div>
          <p className="research-sample-note">The sample is a synthetic spectrum for exploring the tool.</p>
        </section>

        <section className="research-section" aria-labelledby="research-capabilities">
          <h2 id="research-capabilities">What you can do</h2>
          <dl className="research-capabilities">
            <div><dt>Prepare</dt><dd>Inspect imported data, remove spikes, and correct baselines.</dd></div>
            <div><dt>Analyse</dt><dd>Fit peaks, compare spectra, and average repeated measurements.</dd></div>
            <div><dt>Export</dt><dd>Save plots, results, and analysis protocols.</dd></div>
          </dl>
        </section>

        <section className="research-section research-methods" aria-labelledby="research-methods-title">
          <h2 id="research-methods-title">Methods and limitations</h2>
          <p className="research-section-intro">The settings you choose affect the result. Check the processed spectrum against your original data.</p>
          <details>
            <summary>How the spectrum is processed</summary>
            <p>Optional spike removal uses a local median-based test. Baselines are estimated with iterative clipping (SNIP) or interpolated between manually selected anchors. After subtraction, negative corrected intensities are set to zero, then a nine-point moving average smooths the spectrum. Raw imported values are retained.</p>
            <p>You can normalise intensities by their maximum, integrated area, or a selected reference point. Baseline and normalisation choices can change peak heights and areas.</p>
          </details>
          <details>
            <summary>Peak detection and fitting</summary>
            <p>Automatic detection identifies local maxima and refines their positions with a three-point parabolic estimate. For fitting a selected region, the tool uses Levenberg–Marquardt optimisation with Lorentzian, Gaussian, or pseudo-Voigt profiles.</p>
            <p>Overlapping peaks, noise, and the selected fitting range can affect the result. Inspect the fit and residuals, and choose a profile appropriate to your measurement. A good fit alone does not establish a chemical assignment.</p>
          </details>
          <details>
            <summary>Import assumptions</summary>
            <p>CSV and Excel imports include a preview for checking the worksheet, data rows, columns, and X-axis units. Wavelength conversion requires the measurement’s laser wavelength. Invalid rows and duplicate X values are reported before import.</p>
            <p>Excel imports include hidden and filtered rows and use saved formula results without recalculating them. The sample spectrum is synthetic and should not be used as a calibration reference.</p>
          </details>
          <details>
            <summary>Data handling</summary>
            <p>Spectrum parsing and analysis run in your browser. The site uses Google Analytics for usage events; these events can include uploaded file names. External scripts and fonts are also loaded.</p>
          </details>
          <a className="research-text-link research-docs-link" href={`${import.meta.env.BASE_URL}docs.html`}>Read the documentation</a>
        </section>
        </main>

        <footer className="research-footer">
          <p>Built as a free tool for researchers. Source code, issues, and suggestions are welcome on{' '}
            <a className="research-text-link" href="https://linkedin.com" target="_blank" rel="noopener noreferrer">LinkedIn</a>.
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Landing;
