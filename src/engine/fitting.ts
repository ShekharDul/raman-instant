/**
 * DRAFT ENGINE - NOT CURRENTLY IN USE
 * Commented out to prevent build failures during documentation updates.
 */

/*
import lm from 'ml-levenberg-marquardt';
import { Matrix, inverse } from 'ml-matrix';

export interface FitParameter {
  value: number;
  error: number;
}

export interface PeakFit {
  amplitude: FitParameter;
  center: FitParameter;
  fwhm: FitParameter;
  type: 'lorentzian' | 'gaussian';
}

export interface FitResult {
  peaks: PeakFit[];
  r2: number;
  reducedChi2: number;
  residuals: number[];
  fitX: number[];
  fitY: number[];
  iterations: number;
  errorMsg?: string;
}

export class FittingEngine {
  static lorentzian(x: number, a: number, c: number, w: number): number {
    const gamma = w / 2;
    if (gamma === 0) return 0;
    return a / (1 + Math.pow((x - c) / gamma, 2));
  }

  static gaussian(x: number, a: number, c: number, w: number): number {
    const sigma = w / 2.35482;
    if (sigma === 0) return 0;
    return a * Math.exp(-Math.pow(x - c, 2) / (2 * Math.pow(sigma, 2)));
  }

  static estimateInitial(x: number[], y: number[], type: 'lorentzian' | 'gaussian'): number[] {
    const peaks: number[] = [];
    for (let i = 2; i < y.length - 2; i++) {
      if (y[i] > y[i - 1] && y[i] > y[i + 1] && y[i] > Math.max(...y) * 0.1) {
        const amp = y[i];
        const center = x[i];
        const halfMax = amp / 2;
        let left = i;
        while (left > 0 && y[left] > halfMax) left--;
        let right = i;
        while (right < y.length - 1 && y[right] > halfMax) right++;
        const fwhm = Math.abs(x[right] - x[left]) || 10;
        peaks.push(amp, center, fwhm);
      }
    }
    if (peaks.length === 0) {
      const maxVal = Math.max(...y);
      const idx = y.indexOf(maxVal);
      peaks.push(maxVal, x[idx], 15);
    }
    return peaks;
  }

  static fit(x: number[], y: number[], initialParams: number[], type: 'lorentzian' | 'gaussian'): any {
    return { errorMsg: 'Engine disabled' };
  }
}
*/
