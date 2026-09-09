import React from 'react';

interface LandingProps {
  onEnterWorkstation: () => void;
}

const Landing: React.FC<LandingProps> = ({ onEnterWorkstation }) => {
  return (
    <div
      id="landing-canvas"
      style={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: '#ffffff',
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

        {/* Hero Section */}
        <main
          style={{
            marginTop: '72px',
            maxWidth: '740px',
          }}
        >
          <h1
            style={{
              fontSize: '48px',
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: '-0.035em',
              color: '#0f172a',
              margin: '0 0 20px 0',
            }}
          >
            Simplify your Raman spectroscopy workflow.
          </h1>

          <h2
            style={{
              fontSize: '19px',
              fontWeight: 400,
              lineHeight: 1.6,
              letterSpacing: '-0.01em',
              color: '#475569',
              margin: 0,
              maxWidth: '660px',
            }}
          >
            Instant Raman enables easy raw data pre-processing, plotting, and collaboration for academic research use cases.
          </h2>

          <div style={{ marginTop: '32px' }}>
            <button
              onClick={onEnterWorkstation}
              style={{
                background: 'transparent',
                border: '1px solid #cbd5e1',
                color: '#0f172a',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: '15px',
                fontWeight: 600,
                padding: '12px 26px',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
                outline: 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.025)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.08)';
                e.currentTarget.style.borderColor = '#94a3b8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
            >
              Get Started
            </button>
          </div>
        </main>

        {/* Processed Raman Spectrum Graphic (starts in the middle of the screen, peaks rise upwards towards the button without touching) */}
        <section
          aria-label="Processed Raman Spectrum Preview"
          style={{
            marginTop: '44px',
            width: '100%',
            maxWidth: '960px',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          <svg
            viewBox="0 0 1000 240"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              overflow: 'visible',
            }}
          >
            <defs>
              {/* Fill gradient: rich blue at baseline (bottom), fading to transparent towards the top */}
              <linearGradient id="ramanFillGrad" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.3" />
                <stop offset="35%" stopColor="#3b82f6" stopOpacity="0.18" />
                <stop offset="75%" stopColor="#60a5fa" stopOpacity="0.06" />
                <stop offset="100%" stopColor="#93c5fd" stopOpacity="0.0" />
              </linearGradient>

              {/* Stroke gradient: deep blue at baseline, fading towards the top */}
              <linearGradient id="ramanStrokeGrad" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.9" />
                <stop offset="45%" stopColor="#2563eb" stopOpacity="0.75" />
                <stop offset="80%" stopColor="#3b82f6" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#93c5fd" stopOpacity="0.15" />
              </linearGradient>
            </defs>

            {/* Subtle baseline */}
            <line
              x1="0"
              y1="225"
              x2="1000"
              y2="225"
              stroke="#e2e8f0"
              strokeWidth="1"
              strokeDasharray="4 6"
            />

            {/* Filled area under curve with upward fading gradient */}
            <path
              d="M 0 225
                 L 120 225
                 C 140 225, 155 175, 175 175
                 C 195 175, 205 225, 230 225
                 L 320 225
                 C 350 225, 375 90, 400 90
                 C 425 90, 445 225, 475 225
                 L 510 225
                 C 535 225, 555 15, 575 15
                 C 595 15, 615 225, 640 225
                 C 655 225, 675 110, 695 110
                 C 715 110, 735 225, 755 225
                 L 790 225
                 C 815 225, 835 140, 855 140
                 C 875 140, 895 225, 920 225
                 L 1000 225
                 L 1000 225
                 L 0 225
                 Z"
              fill="url(#ramanFillGrad)"
            />

            {/* Continuous processed Raman spectrum line */}
            <path
              d="M 0 225
                 L 120 225
                 C 140 225, 155 175, 175 175
                 C 195 175, 205 225, 230 225
                 L 320 225
                 C 350 225, 375 90, 400 90
                 C 425 90, 445 225, 475 225
                 L 510 225
                 C 535 225, 555 15, 575 15
                 C 595 15, 615 225, 640 225
                 C 655 225, 675 110, 695 110
                 C 715 110, 735 225, 755 225
                 L 790 225
                 C 815 225, 835 140, 855 140
                 C 875 140, 895 225, 920 225
                 L 1000 225"
              fill="none"
              stroke="url(#ramanStrokeGrad)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </section>
      </div>
    </div>
  );
};

export default Landing;
