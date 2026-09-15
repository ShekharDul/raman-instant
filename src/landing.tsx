import React from 'react';

interface LandingProps {
  onEnterWorkstation: () => void;
}

const Landing: React.FC<LandingProps> = () => {
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

      </div>
    </div>
  );
};

export default Landing;
