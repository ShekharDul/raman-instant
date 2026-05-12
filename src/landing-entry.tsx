import React from 'react';
import { createRoot } from 'react-dom/client';
import Landing from './landing';
import './styles/index.css';
import './styles/landing.css';

const container = document.getElementById('landing-root');
if (container) {
  const root = createRoot(container);
  
  const handleEnterWorkstation = () => {
    // Hide landing, show app
    document.body.classList.add('workstation-active');
    // Scroll to top
    window.scrollTo(0, 0);
    // Notify main.ts if needed (currently main.ts just runs, but the UI is hidden by CSS)
    // We can also trigger a custom event if main.ts needs to know
    window.dispatchEvent(new Event('workstation-opened'));
  };

  root.render(
    <React.StrictMode>
      <Landing onEnterWorkstation={handleEnterWorkstation} />
    </React.StrictMode>
  );
}
