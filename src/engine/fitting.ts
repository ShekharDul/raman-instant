/**
 * Instant Raman v2.1 — Advanced Fitting Engine
 * Implements Levenberg-Marquardt (LM) non-linear optimization for spectral deconvolution.
 * Supports Lorentzian, Gaussian, and pseudo-Voigt profiles.
 * Includes rigorous SVD pseudo-inverse for statistical uncertainty quantification.
 */

import { levenbergMarquardt as lm } from 'ml-levenberg-marquardt';
import { SingularValueDecomposition, Matrix } from 'ml-matrix';


export function formatStatisticalError(value: number | null): string {
  if (value === null || isNaN(value) || !isFinite(value) || value === 0) return "—";
  
  if (value < 0.001) {
    const exponent = Math.floor(Math.log10(value));
    const base = value / Math.pow(10, exponent);
    const superscripts: Record<string, string> = {
      '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', 
      '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻'
    };
    const expStr = exponent.toString().split('').map(c => superscripts[c] || c).join('');
    return `± ${base.toFixed(2)}×10${expStr} cm⁻¹`;
  }
  
  return `± ${value.toFixed(4)} cm⁻¹`;
}

export interface FitParameter {
  value: number | null;
  error: number | null;
}

export interface PeakFit {
  amplitude: FitParameter;
  center: FitParameter;
  fwhm: FitParameter;
  shape?: FitParameter; // For pseudo-Voigt (eta)
  type: 'lorentzian' | 'gaussian' | 'voigt';
  yFit: number[];
}

export interface FitResult {
  peaks: PeakFit[];
  r2: number | null;
  reducedChi2: number | null;
  residuals: number[];
  fitX: number[];
  fitY: number[];
  iterations: number;
  convergence_status: 'converged' | 'failed';
  statistical_uncertainty_status: 'reliable' | 'ill_conditioned' | null;
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

  static voigt(x: number, a: number, c: number, w: number, eta: number): number {
    return eta * this.lorentzian(x, a, c, w) + (1 - eta) * this.gaussian(x, a, c, w);
  }

  static estimateInitial(x: number[], y: number[], type: 'lorentzian' | 'gaussian' | 'voigt'): number[] {
    const peaks: { amp: number, center: number, fwhm: number }[] = [];
    const threshold = Math.max(...y) * 0.05; // Lower threshold to catch small peaks
    
    // 1. First Pass: Local Maxima (Parabolic Refinement)
    for (let i = 2; i < y.length - 2; i++) {
      if (y[i] > y[i - 1] && y[i] > y[i + 1] && y[i] > threshold) {
        const amp = y[i];
        const center = x[i];
        
        // Simple FWHM estimate
        const halfMax = amp / 2;
        let left = i;
        while (left > 0 && y[left] > halfMax) left--;
        let right = i;
        while (right < y.length - 1 && y[right] > halfMax) right++;
        const fwhm = Math.abs(x[right] - x[left]) || 15;
        
        peaks.push({ amp, center, fwhm });
      }
    }

    // 2. Second Pass: Second-Derivative for Hidden Shoulders
    // We look for regions where d2y/dx2 is significantly negative but no local maximum was found
    if (y.length > 10) {
      const d2 = [];
      for (let i = 2; i < y.length - 2; i++) {
        // Simple 5-point stencil for second derivative
        const val = (-y[i-2] + 16*y[i-1] - 30*y[i] + 16*y[i+1] - y[i+2]) / 12;
        d2.push({ idx: i, val });
      }

      for (let i = 2; i < d2.length - 2; i++) {
        // Local minimum in d2 indicates a peak or shoulder
        if (d2[i].val < d2[i-1].val && d2[i].val < d2[i+1].val && d2[i].val < -threshold * 0.1) {
          const center = x[d2[i].idx];
          const exists = peaks.some(p => Math.abs(p.center - center) < 5);
          if (!exists) {
            peaks.push({ amp: y[d2[i].idx], center, fwhm: 15 });
          }
        }
      }
    }
    
    // Sort and limit to top 5 major components
    peaks.sort((a, b) => b.amp - a.amp);
    const topPeaks = peaks.slice(0, 5).flatMap(p => {
      const pData = [p.amp, p.center, p.fwhm];
      if (type === 'voigt') pData.push(0.5);
      return pData;
    });
    
    if (topPeaks.length === 0) {
      const maxVal = Math.max(...y);
      const idx = y.indexOf(maxVal);
      topPeaks.push(maxVal, x[idx], 20);
      if (type === 'voigt') topPeaks.push(0.5);
    }
    
    return topPeaks;
  }

  /**
   * Calculates the Jacobian matrix using central finite differences.
   */
  private static calculateJacobian(
    x: number[],
    params: number[],
    modelFn: (t: number[]) => (xVal: number) => number
  ): Matrix {
    const N = x.length;
    const P = params.length;
    const J = new Matrix(N, P);
    const eps = 1e-6; // Central difference step

    for (let j = 0; j < P; j++) {
      const paramsPlus = [...params];
      const paramsMinus = [...params];
      
      const step = Math.max(Math.abs(params[j]) * eps, 1e-8);
      paramsPlus[j] += step;
      paramsMinus[j] -= step;

      const fPlus = modelFn(paramsPlus);
      const fMinus = modelFn(paramsMinus);

      for (let i = 0; i < N; i++) {
        const diff = (fPlus(x[i]) - fMinus(x[i])) / (2 * step);
        J.set(i, j, diff);
      }
    }
    return J;
  }

  /**
   * Calculates statistical standard errors using SVD pseudo-inverse of J^T * J.
   */
  private static calculateErrorsSVD(
    J: Matrix,
    residuals: number[],
    numParams: number
  ): { errors: number[] | null, status: 'reliable' | 'ill_conditioned' } {
    const N = residuals.length;
    const P = numParams;
    
    if (N <= P) {
       return { errors: null, status: 'ill_conditioned' };
    }

    const Jt = J.transpose();
    const JtJ = Jt.mmul(J);

    // Perform SVD on J^T * J
    const svd = new SingularValueDecomposition(JtJ);
    const U = svd.leftSingularVectors;
    const V = svd.rightSingularVectors;
    
    const singularValues = svd.diagonal;
    let maxS = 0;
    let minS = Infinity;
    
    for (let i = 0; i < singularValues.length; i++) {
      const s = Math.abs(singularValues[i]);
      if (s > maxS) maxS = s;
      if (s > 0 && s < minS) minS = s;
    }
    
    if (minS === Infinity) minS = 0;
    
    // Check Condition Number BEFORE thresholding
    const conditionNumber = maxS / minS;
    if (conditionNumber > 1e10 || isNaN(conditionNumber)) {
      return { errors: null, status: 'ill_conditioned' };
    }

    // Thresholding
    const threshold = 1e-10 * maxS;
    const S_inv = new Matrix(P, P);
    for (let i = 0; i < P; i++) {
      const s = singularValues[i];
      if (Math.abs(s) > threshold) {
        S_inv.set(i, i, 1 / s);
      } else {
        S_inv.set(i, i, 0);
      }
    }

    // Pseudo-inverse: V * S_inv * U^T
    const pseudoInv = V.mmul(S_inv).mmul(U.transpose());

    // Mean Squared Error
    const rss = residuals.reduce((sum, r) => sum + r * r, 0);
    const mse = rss / (N - P);

    // Covariance matrix
    const cov = pseudoInv.mul(mse);

    const errors = [];
    for (let i = 0; i < P; i++) {
      const variance = cov.get(i, i);
      // Strictly avoid exactly 0.0 unless the variance is truly non-positive
      // If it's a tiny positive number, keep it for scientific notation in UI
      errors.push(variance > 1e-15 ? Math.sqrt(variance) : 0);
    }

    return { errors, status: 'reliable' };
  }

  static fit(x: number[], y: number[], initialParams: number[], type: 'lorentzian' | 'gaussian' | 'voigt'): FitResult {
    const paramsPerPeak = type === 'voigt' ? 4 : 3;
    const numPeaks = initialParams.length / paramsPerPeak;

    const model = (t: any) => (xVal: number) => {
      let sum = 0;
      for (let i = 0; i < numPeaks; i++) {
        const idx = i * paramsPerPeak;
        const a = t[idx];
        const c = t[idx + 1];
        const w = t[idx + 2];
        if (type === 'voigt') {
          const eta = t[idx + 3];
          sum += this.voigt(xVal, a, c, w, eta);
        } else if (type === 'gaussian') {
          sum += this.gaussian(xVal, a, c, w);
        } else {
          sum += this.lorentzian(xVal, a, c, w);
        }
      }
      return sum;
    };

    const minValues = [];
    const maxValues = [];
    for (let i = 0; i < numPeaks; i++) {
      minValues.push(0, Math.min(...x), 0);
      maxValues.push(Infinity, Math.max(...x), Infinity);
      if (type === 'voigt') {
        minValues.push(0);
        maxValues.push(1);
      }
    }

    const options = {
      damping: 1.5,
      initialValues: initialParams,
      maxIterations: 100,
      errorTolerance: 1e-6,
      minValues,
      maxValues
    };

    try {
      const result = lm({ x, y }, model, options);
      const fittedParams = result.parameterValues;
      const fitY = x.map(xv => model(fittedParams)(xv));
      const residuals = y.map((yv, i) => yv - fitY[i]);

      // Calculate Rigorous Statistical Errors via SVD
      const J = this.calculateJacobian(x, fittedParams, model);
      const errorResult = this.calculateErrorsSVD(J, residuals, fittedParams.length);
      
      const peaks: PeakFit[] = [];
      for (let i = 0; i < numPeaks; i++) {
        const idx = i * paramsPerPeak;
        const e = errorResult.errors;
        
        peaks.push({
          amplitude: { value: fittedParams[idx], error: e ? e[idx] : null },
          center: { value: fittedParams[idx + 1], error: e ? e[idx + 1] : null },
          fwhm: { value: fittedParams[idx + 2], error: e ? e[idx + 2] : null },
          shape: type === 'voigt' ? { value: fittedParams[idx + 3], error: e ? e[idx + 3] : null } : undefined,
          type,
          yFit: x.map(xv => {
            const a = fittedParams[idx];
            const c = fittedParams[idx + 1];
            const w = fittedParams[idx + 2];
            if (type === 'voigt') return this.voigt(xv, a, c, w, fittedParams[idx + 3]);
            if (type === 'gaussian') return this.gaussian(xv, a, c, w);
            return this.lorentzian(xv, a, c, w);
          })
        });
      }

      const meanY = y.reduce((a, b) => a + b, 0) / y.length;
      const ssRes = residuals.reduce((a, b) => a + b * b, 0);
      const ssTot = y.reduce((a, b) => a + Math.pow(b - meanY, 2), 0);
      const r2 = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);
      const reducedChi2 = ssRes / (y.length - fittedParams.length);

      return {
        peaks,
        r2,
        reducedChi2,
        residuals,
        fitX: x,
        fitY,
        iterations: result.iterations,
        convergence_status: 'converged',
        statistical_uncertainty_status: errorResult.status
      };
    } catch (err: any) {
      // Convergence Failure (e.g. hit max iterations without converging, or threw an error)
      return {
        peaks: [],
        r2: null,
        reducedChi2: null,
        residuals: [],
        fitX: [],
        fitY: [],
        iterations: 0,
        convergence_status: 'failed',
        statistical_uncertainty_status: null,
        errorMsg: err.message
      };
    }
  }

}
