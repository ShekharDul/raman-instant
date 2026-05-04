import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Float, Text, MeshDistortMaterial, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { SpectralProcessor } from '../engine/processor';
import { FittingEngine } from '../engine/fitting';

// --- Data Fetching & Processing ---

async function fetchAndProcessSampleData() {
  const baseUrl = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : import.meta.env.BASE_URL + '/';
  const response = await fetch(`${baseUrl}Section3/Sample Data.txt`);
  const text = await response.text();
  
  // Simple parser for the .txt format (#Wave #Intensity)
  const lines = text.split('\n');
  const x: number[] = [];
  const y: number[] = [];
  
  for (const line of lines) {
    if (line.startsWith('#') || !line.trim()) continue;
    const [wave, intensity] = line.trim().split(/\s+/).map(Number);
    if (!isNaN(wave) && !isNaN(intensity)) {
      x.push(wave);
      y.push(intensity);
    }
  }

  // Focus on the interesting region: 500 to 650 cm-1
  const regionX: number[] = [];
  const regionY: number[] = [];
  for (let i = 0; i < x.length; i++) {
    if (x[i] >= 500 && x[i] <= 650) {
      regionX.push(x[i]);
      regionY.push(y[i]);
    }
  }

  const spectralData = {
    wavenumberData: regionX,
    intensityData: regionY,
    filename: 'Sample Data.txt'
  };

  // 1. Baseline Correction (SNIP)
  const baselineData = SpectralProcessor.baselineSNIP(spectralData, 15);
  const correctedY = regionY.map((val, i) => Math.max(0, val - baselineData.intensityData[i]));

  // 2. Identify the main peak (around 555)
  const maxVal = Math.max(...correctedY);
  const maxIdx = correctedY.indexOf(maxVal);
  const peakCenter = regionX[maxIdx];

  // 3. Epistemic Uncertainty (15 iterations)
  // nominalCenter: peakCenter, baseFwhm: ~15, nominalAmplitude: maxVal
  const epistemicResult = FittingEngine.evaluateEpistemicUncertainty(
    regionX, 
    correctedY, 
    1, 
    peakCenter, 
    15, 
    maxVal, 
    peakCenter - 30, 
    peakCenter + 30,
    15, // 15% range
    2   // 2% steps to get around 15 fits
  );

  return {
    x: regionX,
    originalY: correctedY,
    fits: epistemicResult.all_model_results
      .filter(r => r.convergence_status === 'converged')
      .slice(0, 15) // Keep exactly 15
  };
}

// --- 3D Components ---

const SpectralLine = ({ x, y, z, color, opacity, linewidth }: { x: number[], y: number[], z: number, color: string, opacity: number, linewidth: number }) => {
  const points = useMemo(() => {
    const p = [];
    const minX = Math.min(...x);
    const maxX = Math.max(...x);
    const maxY = Math.max(...y, 1);
    
    for (let i = 0; i < x.length; i++) {
      // Normalize for 3D space
      const normX = ((x[i] - minX) / (maxX - minX) - 0.5) * 10;
      const normY = (y[i] / maxY) * 5;
      p.push(new THREE.Vector3(normX, normY, z));
    }
    return p;
  }, [x, y, z]);

  const lineGeometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);

  return (
    <primitive object={new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity }))} />
  );
};

const UncertaintyModel = () => {
  const [data, setData] = useState<{ x: number[], originalY: number[], fits: any[] } | null>(null);

  useEffect(() => {
    fetchAndProcessSampleData().then(setData);
  }, []);

  if (!data) return null;

  return (
    <group rotation={[0, -Math.PI / 4, 0]}>
      {/* The 15 Iteration "Ghosts" */}
      {data.fits.map((fit, i) => {
        // Reconstruct the Y values for this fit across the X range
        const yFit = data.x.map(xv => {
            const a = fit.fitted_amplitude;
            const c = fit.fitted_center;
            const w = fit.fitted_fwhm;
            if (fit.model_type === 'gaussian') return FittingEngine.gaussian(xv, a, c, w);
            if (fit.model_type === 'voigt') return FittingEngine.voigt(xv, a, c, w, 0.5);
            return FittingEngine.lorentzian(xv, a, c, w);
        });

        return (
          <SpectralLine 
            key={i}
            x={data.x} 
            y={yFit} 
            z={(i - 7) * 0.2} 
            color="#0D9488" 
            opacity={0.15} 
            linewidth={1}
          />
        );
      })}

      {/* The "Best Fit" Spine */}
      <SpectralLine 
        x={data.x} 
        y={data.originalY} 
        z={0} 
        color="#0F172A" 
        opacity={1} 
        linewidth={3}
      />

      {/* Grid Floor */}
      <gridHelper args={[20, 20, 0xcccccc, 0xeeeeee]} position={[0, -0.1, 0]} />
      
      {/* Axis Labels */}
      <Text position={[6, -0.5, 0]} fontSize={0.4} color="#64748b">
        Wavenumber (cm⁻¹)
      </Text>
      <Text position={[-6, 2.5, 0]} fontSize={0.4} color="#64748b" rotation={[0, 0, Math.PI / 2]}>
        Intensity
      </Text>
      <Text position={[0, -0.5, 3]} fontSize={0.4} color="#64748b" rotation={[-Math.PI / 2, 0, 0]}>
        Iteration Ensemble
      </Text>
    </group>
  );
};

export const UncertaintyVisualizer = () => {
  return (
    <div className="w-full h-full relative cursor-move">
      <Canvas camera={{ position: [0, 5, 12], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <OrbitControls enableZoom={false} makeDefault />
        <UncertaintyModel />
      </Canvas>
      <div className="absolute bottom-4 right-8 text-right">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">Live Engine Data</div>
          <div className="text-xs font-medium text-slate-600">Sample: Raman Spectrum (500-650 cm⁻¹)</div>
      </div>
    </div>
  );
};
