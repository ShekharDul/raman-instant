/**
 * Instant Raman — Core Data Types
 */

export interface SpectralData {
  wavenumberData: number[];
  intensityData: number[];
}

export interface Peak {
  x: number;       // Wavenumber (cm⁻¹)
  y: number;       // Absolute intensity
  relIntensity: number; // Relative intensity (0-100)
  fwhm: number;    // Full width at half maximum (cm⁻¹)
  area: number;    // Integrated area (counts * cm⁻¹)
}

export interface VarianceResult {
  sigPct: number;
  bslPct: number;
}

export interface NormalizedSpectrum extends SpectralData {
  metadata: {
    format: string;
    fileName: string;
    pointCount: number;
    laserWavelength?: number;
  };
}

export type NormalizationMode = 'none' | 'max' | 'area' | 'point';

export interface CustomLabel {
  id: string;
  x: number;
  y: number;
  text: string;
}
