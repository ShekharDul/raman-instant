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

        <main className="research-intro">
          <p className="research-intro-note">A free tool for researchers</p>
          <h1>Raman spectrum analysis,<br />in your browser.</h1>
          <p className="research-intro-description">
            Import CSV or Excel data to correct baselines, fit peaks, and prepare plots for your research.
          </p>
          <div className="research-intro-actions">
            <button type="button" className="research-open-tool" onClick={onEnterWorkstation}>Open tool</button>
            <button type="button" className="research-try-sample" onClick={onTrySample}>Try sample data</button>
          </div>
          <p className="research-sample-note">The sample is a synthetic spectrum for exploring the tool.</p>
        </main>
      </div>
    </div>
  );
};

export default Landing;
