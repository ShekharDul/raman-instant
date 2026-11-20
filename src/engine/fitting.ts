/**
 * Instant Raman v2.1 — Advanced Fitting Engine
 * Implements Levenberg-Marquardt (LM) non-linear optimization for spectral deconvolution.
 * Supports Lorentzian, Gaussian, and pseudo-Voigt profiles.
 * Estimates local statistical standard errors using an SVD pseudo-inverse.
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
    const maxS = Math.max(...singularValues);
    const minS = Math.min(...singularValues);
    if (!(minS > 1e-10 * maxS)) {
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

  static fit(x: number[], y: number[], initialParams: number[], type: PeakFit['type']): FitResult {
    const stride = type === 'voigt' ? 4 : 3;
    const peakCount = initialParams.length / stride;
    let iterations = 0;
    const failure = (errorMsg: string): FitResult => ({
      peaks: [], r2: null, reducedChi2: null, residuals: [], fitX: [], fitY: [],
      iterations, convergence_status: 'failed', statistical_uncertainty_status: null, errorMsg
    });
    if (peakCount < 1 || !Number.isInteger(peakCount) || x.length !== y.length || x.length <= initialParams.length) {
      return failure('Select a region with more data points than fitted parameters.');
    }
    if (![x, y, initialParams].every(values => values.every(Number.isFinite))) {
      return failure('Fitting requires finite data and estimates.');
    }
    const xMin = Math.min(...x);
    const xSpan = Math.max(...x) - xMin;
    const yScale = y.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
    if (!(xSpan > 0) || !(Math.max(...y) > 0) || y.every(value => value === y[0])) {
      return failure('The selected region needs a varying signal with a positive peak.');
    }

    const profile = (value: number, parameters: number[], offset: number) => {
      const a = parameters[offset], c = parameters[offset + 1], w = parameters[offset + 2];
      return type === 'voigt'
        ? this.voigt(value, a, c, w, parameters[offset + 3])
        : this[type](value, a, c, w);
    };
    const model = (parameters: number[]) => (value: number) => {
      let total = 0;
      for (let i = 0; i < parameters.length; i += stride) total += profile(value, parameters, i);
      return total;
    };

    // Work in scaled units so solver tolerances apply across instrument gains and ranges.
    const scaledX = x.map(value => (value - xMin) / xSpan);
    const scaledY = y.map(value => value / yScale);
    const minValues: number[] = [];
    const maxValues: number[] = [];
    const initialValues: number[] = [];
    for (let i = 0; i < initialParams.length; i += stride) {
      minValues.push(0, 0, 1e-6 / xSpan);
      maxValues.push(Infinity, 1, 1e7 / xSpan);
      initialValues.push(initialParams[i] / yScale, (initialParams[i + 1] - xMin) / xSpan, initialParams[i + 2] / xSpan);
      if (type === 'voigt') {
        minValues.push(0);
        maxValues.push(1);
        initialValues.push(initialParams[i + 3]);
      }
    }

    try {
      const result = lm({ x: scaledX, y: scaledY }, model, {
        damping: 0.01,
        initialValues: initialValues.map((value, i) => Math.min(maxValues[i], Math.max(minValues[i], value))),
        maxIterations: 100, errorTolerance: 1e-12, gradientDifference: 1e-5, centralDifference: true,
        minValues, maxValues
      });
      iterations = result.iterations;
      const fitted = result.parameterValues;
      const scaledFit = scaledX.map(model(fitted));
      const scaledResiduals = scaledY.map((value, i) => value - scaledFit[i]);
      const ssRes = scaledResiduals.reduce((sum, value) => sum + value ** 2, 0);
      if (!Number.isFinite(ssRes) || !fitted.every(Number.isFinite)) return failure('The solver returned a non-finite result.');
      if (fitted.some((value, i) => i % stride === 2 && value <= minValues[i] * (1 + 1e-6))) {
        return failure('A fitted width collapsed to the numerical lower limit. Select a different region or peak model.');
      }
      const J = this.calculateJacobian(scaledX, fitted, model);

      // Noisy fits retain residuals. Test the gradient along feasible parameter
      // directions instead of treating a solver return or iteration cap as success.
      const residualNorm = Math.sqrt(ssRes);
      if (residualNorm > 1e-6 && fitted.some((value, column) => {
        let gradient = 0;
        let normSquared = 0;
        for (let row = 0; row < scaledResiduals.length; row++) {
          const derivative = J.get(row, column);
          gradient += derivative * scaledResiduals[row];
          normSquared += derivative ** 2;
        }
        if ((value <= minValues[column] && gradient <= 0) || (value >= maxValues[column] && gradient >= 0)) return false;
        return !(normSquared > 0) || !Number.isFinite(gradient) ||
          Math.abs(gradient) > 1e-4 * residualNorm * Math.sqrt(normSquared);
      })) return failure('The solver stopped before converging. Try a different region or peak model.');

      const fitY = scaledFit.map(value => value * yScale);
      const residuals = y.map((value, i) => value - fitY[i]);
      if (!fitY.every(Number.isFinite) || !residuals.every(Number.isFinite)) return failure('The fitted signal exceeds the supported numerical range.');

      const uncertainty = this.calculateErrorsSVD(J, scaledResiduals, fitted.length);
      const e = uncertainty.errors;
      const peaks: PeakFit[] = [];
      for (let i = 0; i < fitted.length; i += stride) {
        peaks.push({
          amplitude: { value: fitted[i] * yScale, error: e ? e[i] * yScale : null },
          center: { value: Math.min(xMin + xSpan, Math.max(xMin, xMin + fitted[i + 1] * xSpan)), error: e ? e[i + 1] * xSpan : null },
          fwhm: { value: Math.max(1e-6, Math.min(1e7, fitted[i + 2] * xSpan)), error: e ? e[i + 2] * xSpan : null },
          shape: type === 'voigt' ? { value: fitted[i + 3], error: e ? e[i + 3] : null } : undefined,
          type,
          yFit: scaledX.map(value => profile(value, fitted, i) * yScale)
        });
      }

      const meanY = scaledY.reduce((sum, value) => sum + value, 0) / y.length;
      const ssTot = scaledY.reduce((sum, value) => sum + (value - meanY) ** 2, 0);
      const r2 = ssTot > 0 ? 1 - ssRes / ssTot : null;
      const residualVariance = (ssRes / (y.length - fitted.length)) * yScale ** 2;
      return {
        peaks, r2: Number.isFinite(r2) ? r2 : null,
        reducedChi2: Number.isFinite(residualVariance) ? residualVariance : null,
        residuals, fitX: x, fitY, iterations, convergence_status: 'converged',
        statistical_uncertainty_status: uncertainty.status
      };
    } catch (error) {
      return failure(error instanceof Error ? error.message : 'Fitting failed.');
    }
  }

}
