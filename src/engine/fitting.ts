import lm from 'ml-levenberg-marquardt';
import { Matrix, Inverse } from 'ml-matrix';

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
  /**
   * Lorentzian Profile: A / (1 + ((x - C) / (FWHM/2))^2)
   */
  static lorentzian(x: number, a: number, c: number, w: number): number {
    const gamma = w / 2;
    if (gamma === 0) return 0;
    return a / (1 + Math.pow((x - c) / gamma, 2));
  }

  /**
   * Gaussian Profile: A * exp(-(x - C)^2 / (2 * sigma^2))
   */
  static gaussian(x: number, a: number, c: number, w: number): number {
    const sigma = w / 2.35482;
    if (sigma === 0) return 0;
    return a * Math.exp(-Math.pow(x - c, 2) / (2 * Math.pow(sigma, 2)));
  }

  /**
   * Estimate initial parameters for multiple peaks in a region
   */
  static estimateInitial(x: number[], y: number[], type: 'lorentzian' | 'gaussian'): number[] {
    const peaks: number[] = [];
    // Simple local maxima detection
    for (let i = 2; i < y.length - 2; i++) {
      if (y[i] > y[i - 1] && y[i] > y[i + 1] && y[i] > Math.max(...y) * 0.1) {
        const amp = y[i];
        const center = x[i];
        
        // Estimate FWHM by finding half-max crossing
        const halfMax = amp / 2;
        let left = i;
        while (left > 0 && y[left] > halfMax) left--;
        let right = i;
        while (right < y.length - 1 && y[right] > halfMax) right++;
        
        const fwhm = Math.abs(x[right] - x[left]) || 10;
        peaks.push(amp, center, fwhm);
      }
    }
    
    // If no peaks found, use global max
    if (peaks.length === 0) {
      const maxVal = Math.max(...y);
      const idx = y.indexOf(maxVal);
      peaks.push(maxVal, x[idx], 15);
    }
    
    return peaks;
  }

  /**
   * Simultaneous multi-peak fit
   */
  static fit(x: number[], y: number[], initialParams: number[], type: 'lorentzian' | 'gaussian'): FitResult {
    const numPeaks = initialParams.length / 3;
    
    const fitFunction = (params: number[]) => (t: number) => {
      let sum = 0;
      for (let i = 0; i < numPeaks; i++) {
        const [a, c, w] = [params[i * 3], params[i * 3 + 1], params[i * 3 + 2]];
        sum += type === 'lorentzian' ? this.lorentzian(t, a, c, w) : this.gaussian(t, a, c, w);
      }
      return sum;
    };

    // Construct Bounds
    const minValues: number[] = [];
    const maxValues: number[] = [];
    for (let i = 0; i < numPeaks; i++) {
      const initC = initialParams[i * 3 + 1];
      minValues.push(0, initC - 15, 2); // Amp > 0, Center +/- 15, FWHM > 2
      maxValues.push(Math.max(...y) * 2, initC + 15, 200); // Amp < 2*max, Center +/- 15, FWHM < 200
    }

    const options = {
      damping: 1.5,
      initialValues: initialParams,
      minValues,
      maxValues,
      gradientDifference: 1e-4,
      maxIterations: 100,
      errorTolerance: 1e-6
    };

    try {
      const result = lm({ x, y }, fitFunction, options);
      const finalParams = result.parameterValues;
      
      // Calculate Stats
      const fitY = x.map(fitFunction(finalParams));
      const residuals = y.map((val, i) => val - fitY[i]);
      const ssRes = residuals.reduce((sum, r) => sum + r * r, 0);
      const yMean = y.reduce((a, b) => a + b, 0) / y.length;
      const ssTot = y.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
      const r2 = 1 - (ssRes / ssTot);
      
      const dof = y.length - finalParams.length;
      const reducedChi2 = ssRes / (dof || 1);

      // Covariance & Error Estimation
      let standardErrors: number[] = new Array(finalParams.length).fill(0);
      try {
        const J = this.calculateJacobian(x, finalParams, type);
        const JTJ = J.transpose().mmul(J);
        const cov = new Matrix(Inverse.inverse(JTJ)).mul(reducedChi2);
        standardErrors = finalParams.map((_, i) => Math.sqrt(Math.abs(cov.get(i, i))));
      } catch (e) {
        console.warn('[FittingEngine] Covariance matrix is singular, errors unavailable.');
      }

      const peaks: PeakFit[] = [];
      for (let i = 0; i < numPeaks; i++) {
        peaks.push({
          amplitude: { value: finalParams[i * 3], error: standardErrors[i * 3] },
          center: { value: finalParams[i * 3 + 1], error: standardErrors[i * 3 + 1] },
          fwhm: { value: finalParams[i * 3 + 2], error: standardErrors[i * 3 + 2] },
          type
        });
      }

      return {
        peaks,
        r2,
        reducedChi2,
        residuals,
        fitX: x,
        fitY,
        iterations: result.iterations
      };

    } catch (err: any) {
      return {
        peaks: [],
        r2: 0,
        reducedChi2: 0,
        residuals: [],
        fitX: [],
        fitY: [],
        iterations: 0,
        errorMsg: err.message || 'Optimization failed to converge'
      };
    }
  }

  private static calculateJacobian(x: number[], params: number[], type: 'lorentzian' | 'gaussian'): Matrix {
    const rows = x.length;
    const cols = params.length;
    const J = new Matrix(rows, cols);
    const h = 1e-5;

    // Use numerical differentiation for Jacobian
    for (let j = 0; j < cols; j++) {
      const pPlus = [...params];
      const pMinus = [...params];
      pPlus[j] += h;
      pMinus[j] -= h;

      for (let i = 0; i < rows; i++) {
        const fPlus = this.evaluateMultiPeak(x[i], pPlus, type);
        const fMinus = this.evaluateMultiPeak(x[i], pMinus, type);
        J.set(i, j, (fPlus - fMinus) / (2 * h));
      }
    }
    return J;
  }

  private static evaluateMultiPeak(t: number, params: number[], type: 'lorentzian' | 'gaussian'): number {
    let sum = 0;
    for (let i = 0; i < params.length / 3; i++) {
      const [a, c, w] = [params[i * 3], params[i * 3 + 1], params[i * 3 + 2]];
      sum += type === 'lorentzian' ? this.lorentzian(t, a, c, w) : this.gaussian(t, a, c, w);
    }
    return sum;
  }
}
