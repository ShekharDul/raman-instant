import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Beaker, Binary, Zap, ShieldCheck, Activity, Search } from 'lucide-react';
import './DiagnosticBrain.css';

interface Node {
  id: string;
  label: string;
  sub: string;
  layer: 'input' | 'hidden' | 'output';
  icon?: React.ReactNode;
  insight?: {
    title: string;
    desc: string;
    interpretation: string;
    sensitivity: string;
    specificity: string;
  };
}

const INPUTS: Node[] = [
  { id: 'i1', label: 'Peak Center', sub: 'x-coordinate max', layer: 'input', icon: <Search size={14}/> },
  { id: 'i2', label: 'FWHM', sub: 'Width at half max', layer: 'input', icon: <Activity size={14}/> },
  { id: 'i3', label: 'Epistemic (Δ)', sub: 'Boundary sensitivity', layer: 'input', icon: <Zap size={14}/> },
  { id: 'i4', label: 'Bimodality', sub: 'Multi-modal dist', layer: 'input', icon: <Binary size={14}/> },
  { id: 'i5', label: 'Residuals', sub: 'Non-random patterns', layer: 'input', icon: <Beaker size={14}/> },
];

const HIDDEN: Node[] = [
  { id: 'h1', label: 'Lattice Audit', sub: 'Center-Shift Tracking', layer: 'hidden' },
  { id: 'h2', label: 'Domain Audit', sub: 'Width Stability Analysis', layer: 'hidden' },
  { id: 'h3', label: 'Convergence Audit', sub: 'Boundary Sensitivity', layer: 'hidden' },
  { id: 'h4', label: 'Phase Resolver', sub: 'Bimodal Dist Analysis', layer: 'hidden' },
  { id: 'h5', label: 'Signal Audit', sub: 'Residual Pattern Scan', layer: 'hidden' },
];

const OUTPUTS: Node[] = [
  { 
    id: 'o1', label: 'Lattice Strain', sub: 'Stress & Distortion', layer: 'output',
    insight: {
      title: 'Lattice Strain & Stress',
      desc: 'Tracks phonon energy shifts due to lattice distortion, thermal expansion, or doping.',
      interpretation: 'Physical tracks phonon energy shifts due to distortion.',
      sensitivity: 'High Sensitivity',
      specificity: 'Low Specificity (Temp/Doping)'
    }
  },
  { 
    id: 'o2', label: 'Crystallinity', sub: 'Domain & Disorder', layer: 'output',
    insight: {
      title: 'Crystallinity & Disorder',
      desc: 'Broader peaks indicate shorter phonon lifetimes from defects or amorphization.',
      interpretation: 'Measures structural integrity of the crystal lattice.',
      sensitivity: 'Medium Sensitivity',
      specificity: 'Medium Specificity'
    }
  },
  { 
    id: 'o3', label: 'Structural Ambiguity', sub: 'Model Integrity', layer: 'output',
    insight: {
      title: 'Structural Ambiguity',
      desc: 'Flags instability in peak assignment; correlates with overlapping phases.',
      interpretation: 'Identifies if the current model is physically insufficient.',
      sensitivity: 'High Diagnostic Value',
      specificity: 'Low Specificity'
    }
  },
  { 
    id: 'o4', label: 'Phase Integrity', sub: 'Sub-resolution Phase', layer: 'output',
    insight: {
      title: 'Phase Integrity',
      desc: 'Suggests sub-resolution phases or distinct bonding environments.',
      interpretation: 'Detects hidden polymorphs or chemical heterogeneity.',
      sensitivity: 'Medium Specificity',
      specificity: 'Context Dependent'
    }
  },
  { 
    id: 'o5', label: 'Unmodeled Physics', sub: 'Secondary Phonon Modes', layer: 'output',
    insight: {
      title: 'Unmodeled Physics',
      desc: 'Reveals non-random patterns pointing to secondary phonon modes or fluorescence.',
      interpretation: 'Indicates quantum confinement in nano-materials.',
      sensitivity: 'High Diagnostic Value',
      specificity: 'Low Specificity'
    }
  },
];

const CONNECTIONS = [
  { from: 'i1', to: 'h1' }, { from: 'h1', to: 'o1' },
  { from: 'i2', to: 'h2' }, { from: 'h2', to: 'o2' },
  { from: 'i3', to: 'h3' }, { from: 'h3', to: 'o3' },
  { from: 'i4', to: 'h4' }, { from: 'h4', to: 'o4' },
  { from: 'i5', to: 'h5' }, { from: 'h5', to: 'o5' },
];

const DiagnosticBrain: React.FC = () => {
  const [activeNode, setActiveNode] = useState<string | null>(null);

  const getConnectedNodes = (nodeId: string) => {
    const connected = new Set<string>([nodeId]);
    
    // Find downstream
    CONNECTIONS.forEach(c => {
      if (c.from === nodeId) {
        connected.add(c.to);
        CONNECTIONS.forEach(c2 => {
          if (c2.from === c.to) connected.add(c2.to);
        });
      }
    });
    
    // Find upstream
    CONNECTIONS.forEach(c => {
      if (c.to === nodeId) {
        connected.add(c.from);
        CONNECTIONS.forEach(c2 => {
          if (c2.to === c.from) connected.add(c2.from);
        });
      }
    });

    return connected;
  };

  const activeSet = activeNode ? getConnectedNodes(activeNode) : new Set();
  const selectedOutput = OUTPUTS.find(o => o.id === activeNode) || 
                         OUTPUTS.find(o => activeSet.has(o.id));

  return (
    <section className="brain-section">
      <div className="brain-glow" />
      
      <div className="brain-container">
        <div className="brain-header">
          <span className="brain-mono">Inference Logic</span>
          <h2 className="brain-title">How model uncertainty analysis might help</h2>
        </div>

        <div className="brain-viewport">
          {/* SVG Connections Layer */}
          <svg className="brain-svg">
            <defs>
              <linearGradient id="synapse-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(45, 212, 191, 0)" />
                <stop offset="50%" stopColor="rgba(45, 212, 191, 0.5)" />
                <stop offset="100%" stopColor="rgba(45, 212, 191, 0)" />
              </linearGradient>
            </defs>
            {CONNECTIONS.map((c, i) => {
              const isActive = activeSet.has(c.from) && activeSet.has(c.to);
              
              // Coordinates logic
              const fromIdx = [...INPUTS, ...HIDDEN, ...OUTPUTS].findIndex(n => n.id === c.from);
              const toIdx = [...INPUTS, ...HIDDEN, ...OUTPUTS].findIndex(n => n.id === c.to);
              
              // This is a simplified positioning for the SVG paths
              // In a real app we would use ref-based coordinates, 
              // but for a landing page we can use normalized flex positions.
              const getX = (layer: string) => layer === 'input' ? 480 : (layer === 'hidden' ? 800 : 1120);
              const getY = (id: string, layer: string) => {
                const arr = layer === 'input' ? INPUTS : (layer === 'hidden' ? HIDDEN : OUTPUTS);
                const idx = arr.findIndex(n => n.id === id);
                const total = arr.length;
                return (idx + 1) * (500 / (total + 1));
              };

              const fromNode = [...INPUTS, ...HIDDEN, ...OUTPUTS].find(n => n.id === c.from)!;
              const toNode = [...INPUTS, ...HIDDEN, ...OUTPUTS].find(n => n.id === c.to)!;

              const x1 = getX(fromNode.layer);
              const y1 = getY(c.from, fromNode.layer);
              const x2 = getX(toNode.layer);
              const y2 = getY(c.to, toNode.layer);

              const cp1x = x1 + (x2 - x1) / 2;
              const cp2x = x1 + (x2 - x1) / 2;

              return (
                <g key={i}>
                  <path 
                    d={`M ${x1} ${y1} C ${cp1x} ${y1}, ${cp2x} ${y2}, ${x2} ${y2}`}
                    className={`synapse-path ${isActive ? 'active' : ''}`}
                  />
                  {isActive && (
                    <motion.path 
                      d={`M ${x1} ${y1} C ${cp1x} ${y1}, ${cp2x} ${y2}, ${x2} ${y2}`}
                      className="synapse-pulse"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: [0, 1, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    />
                  )}
                </g>
              );
            })}
          </svg>

          {/* Node Layers */}
          <div className="brain-layer layer-input">
            {INPUTS.map(node => (
              <div 
                key={node.id} 
                className={`brain-node ${activeSet.has(node.id) ? 'active' : ''}`}
                onMouseEnter={() => setActiveNode(node.id)}
                onMouseLeave={() => setActiveNode(null)}
              >
                <span className="node-label">{node.label}</span>
                <span className="node-sub">{node.sub}</span>
                {node.icon && <div style={{ position: 'absolute', right: 12, top: 12, color: 'rgba(45, 212, 191, 0.4)' }}>{node.icon}</div>}
              </div>
            ))}
          </div>

          <div className="brain-layer layer-hidden">
            {HIDDEN.map(node => (
              <div 
                key={node.id} 
                className={`brain-node ${activeSet.has(node.id) ? 'active' : ''}`}
                onMouseEnter={() => setActiveNode(node.id)}
                onMouseLeave={() => setActiveNode(null)}
              >
                <div style={{ position: 'absolute', left: -10, top: '50%', transform: 'translateY(-50%)', width: 4, height: 4, background: '#2dd4bf', borderRadius: '50%' }} />
                <span className="node-label">{node.label}</span>
                <span className="node-sub">{node.sub}</span>
                <div style={{ position: 'absolute', right: -10, top: '50%', transform: 'translateY(-50%)', width: 4, height: 4, background: '#2dd4bf', borderRadius: '50%' }} />
              </div>
            ))}
          </div>

          <div className="brain-layer layer-output">
            {OUTPUTS.map(node => (
              <div 
                key={node.id} 
                className={`brain-node ${activeSet.has(node.id) ? 'active' : ''}`}
                onMouseEnter={() => setActiveNode(node.id)}
                onMouseLeave={() => setActiveNode(null)}
              >
                <span className="node-label">{node.label}</span>
                <span className="node-sub">{node.sub}</span>
              </div>
            ))}
          </div>

          <AnimatePresence>
            {selectedOutput && selectedOutput.insight && (
              <motion.div 
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.95 }}
                className="insight-card"
              >
                <div>
                  <div className="insight-badge">Scientific Verdict</div>
                  <h3 className="insight-title">{selectedOutput.insight.title}</h3>
                  <p className="insight-desc">{selectedOutput.insight.desc}</p>
                </div>

                <div className="insight-grid">
                  <div className="insight-metric-item">
                    <span className="metric-label">Sensitivity</span>
                    <span className="metric-value">{selectedOutput.insight.sensitivity}</span>
                  </div>
                  <div className="insight-metric-item">
                    <span className="metric-label">Specificity</span>
                    <span className="metric-value">{selectedOutput.insight.specificity}</span>
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                  * Paired with Accuracy-First Residual Auditing
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};

export default DiagnosticBrain;
