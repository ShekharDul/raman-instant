/**
 * Instant Raman v2.1 — Advanced Fitting Engine
 * Implements Levenberg-Marquardt (LM) non-linear optimization for spectral deconvolution.
 * Supports Lorentzian, Gaussian, and pseudo-Voigt profiles.
 * Includes rigorous SVD pseudo-inverse for statistical uncertainty quantification.
 */

// @ts-ignore
import { levenbergMarquardt as lm } from 'ml-levenberg-marquardt';
import { SingularValueDecomposition, Matrix } from 'ml-matrix';

export const DEGENERATE_RANGE_THRESHOLD_CM = 0.01;

export function formatStatisticalError(value: number | null): string {
  if (value === null) return "ill-conditioned";
  if (value === 0) return "0 cm⁻¹";
  
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

export interface ModelResult {
  model_type: 'lorentzian' | 'gaussian' | 'voigt';
  boundary_perturbation_step: number;
  boundary_left: number;
  boundary_right: number;
  fitted_center: number | null;
  fitted_fwhm: number | null;
  fitted_amplitude: number | null;
  fitted_center_statistical_error: number | null;
  fitted_fwhm_statistical_error: number | null;
  fitted_amplitude_statistical_error: number | null;
  statistical_uncertainty_status: 'reliable' | 'ill_conditioned' | null;
  r_squared: number | null;
  reduced_chi_squared: number | null;
  convergence_status: 'converged' | 'failed';
}

export interface EpistemicResult {
  peak_id: number;
  nominal_center: number;
  boundary_left: number;
  boundary_right: number;
  boundary_perturbation_range: number | null;
  best_fit_model: 'lorentzian' | 'gaussian' | 'voigt' | null;
  fitted_center: number | null;
  fitted_center_statistical_error: number | null;
  fitted_fwhm: number | null;
  fitted_amplitude: number | null;
  r_squared: number | null;
  reduced_chi_squared: number | null;
  epistemic_center_min: number | null;
  epistemic_center_max: number | null;
  epistemic_standard_deviation: number | null;
  combined_uncertainty: number | null;
  convergence_status: 'converged' | 'failed';
  all_model_results: any[];
  isDegenerateRange: boolean;
  epistemic_classification: 'STABLE_CONVERGENCE' | 'HIGH_SENSITIVITY' | 'POOR_FIT';
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
    const peaks: number[] = [];
    const threshold = Math.max(...y) * 0.1;
    
    for (let i = 2; i < y.length - 2; i++) {
      if (y[i] > y[i - 1] && y[i] > y[i + 1] && y[i] > threshold) {
        const amp = y[i];
        const center = x[i];
        
        const halfMax = amp / 2;
        let left = i;
        while (left > 0 && y[left] > halfMax) left--;
        let right = i;
        while (right < y.length - 1 && y[right] > halfMax) right++;
        const fwhm = Math.abs(x[right] - x[left]) || 15;
        
        peaks.push(amp, center, fwhm);
        if (type === 'voigt') peaks.push(0.5);
      }
    }
    
    if (peaks.length === 0) {
      const maxVal = Math.max(...y);
      const idx = y.indexOf(maxVal);
      peaks.push(maxVal, x[idx], 20);
      if (type === 'voigt') peaks.push(0.5);
    }
    
    return peaks;
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

  /**
   * Performs the full Step 3 & Step 4 rigorous multi-model boundary perturbation matrix calculation.
   * Returns a complete IrpPeakFittingRecord.
   */
  static evaluateEpistemicUncertainty(
    x: number[],
    y: number[],
    peakId: number,
    nominalCenter: number,
    baseFwhm: number,
    nominalAmplitude: number,
    baseBoundaryLeft: number,
    baseBoundaryRight: number,
    perturbationRangePct: number = 10, // e.g. 10 means +/- 10%
    perturbationStepPct: number = 5
  ): EpistemicResult {
    const models: ("lorentzian" | "gaussian" | "voigt")[] = ["lorentzian", "gaussian", "voigt"];
    const steps = [];
    for (let s = -perturbationRangePct; s <= perturbationRangePct; s += perturbationStepPct) {
      steps.push(s);
    }

    const all_model_results: any[] = [];
    const validCenters: number[] = [];
    let maxMeanR2 = -Infinity;
    let bestFitModel: "lorentzian" | "gaussian" | "voigt" | null = null;

    const r2Sums: Record<string, number> = { lorentzian: 0, gaussian: 0, voigt: 0 };
    const r2Counts: Record<string, number> = { lorentzian: 0, gaussian: 0, voigt: 0 };

    for (const step of steps) {
      const shift = (baseFwhm * (step / 100));
      const boundLeft = baseBoundaryLeft - shift;
      const boundRight = baseBoundaryRight + shift;

      // Extract ROI
      const roiX: number[] = [];
      const roiY: number[] = [];
      for (let i = 0; i < x.length; i++) {
        if (x[i] >= boundLeft && x[i] <= boundRight) {
          roiX.push(x[i]);
          roiY.push(y[i]);
        }
      }

      for (const model of models) {
        if (roiX.length < 5) {
          // Failure due to too few points
          all_model_results.push({
            model_type: model,
            boundary_perturbation_step: step,
            boundary_left: boundLeft,
            boundary_right: boundRight,
            fitted_center: null,
            fitted_fwhm: null,
            fitted_amplitude: null,
            fitted_center_statistical_error: null,
            fitted_fwhm_statistical_error: null,
            fitted_amplitude_statistical_error: null,
            statistical_uncertainty_status: null,
            r_squared: null,
            reduced_chi_squared: null,
            convergence_status: "failed"
          });
          continue;
        }

        // Warm-start from best fit parameters instead of cold-start estimation
        const initialParams = model === 'voigt' 
          ? [nominalAmplitude, nominalCenter, baseFwhm, 0.5] 
          : [nominalAmplitude, nominalCenter, baseFwhm];
        
        const res = this.fit(roiX, roiY, initialParams, model);

        const shiftVal = shift; // Absolute shift in cm-1

        if (res.convergence_status === "failed") {
          all_model_results.push({
            model_type: model,
            boundary_perturbation_step: step,
            boundary_shift_cm: shiftVal,
            boundary_left: boundLeft,
            boundary_right: boundRight,
            fitted_center: null,
            fitted_fwhm: null,
            fitted_amplitude: null,
            fitted_center_statistical_error: null,
            fitted_fwhm_statistical_error: null,
            fitted_amplitude_statistical_error: null,
            statistical_uncertainty_status: null,
            r_squared: null,
            reduced_chi_squared: null,
            convergence_status: "failed",
            status: "failed",
            outlier_excluded: false
          });
          continue;
        }

        // Converged - Apply Sanity Check (Outlier Detection)
        const peak = res.peaks[0];
        const centerVal = peak.center.value as number;
        const centerShift = Math.abs(centerVal - nominalCenter);
        const isOutlier = centerShift > (3 * baseFwhm);

        console.log({
          peakId: peakId,
          model: model,
          center: centerVal,
          nominalCenter: nominalCenter,
          deviation: centerShift,
          threshold: 3 * baseFwhm,
          isOutlier: isOutlier
        });

        if (!isOutlier) {
          validCenters.push(centerVal);
          
          if (res.r2 !== null && !isNaN(res.r2)) {
             r2Sums[model] += res.r2;
             r2Counts[model] += 1;
          }
        }

        const modelResult = {
          model_type: model,
          boundary_perturbation_step: step,
          boundary_shift_cm: shiftVal,
          boundary_left: boundLeft,
          boundary_right: boundRight,
          fitted_center: centerVal,
          fitted_fwhm: peak.fwhm.value,
          fitted_amplitude: peak.amplitude.value,
          fitted_center_statistical_error: peak.center.error,
          fitted_fwhm_statistical_error: peak.fwhm.error,
          fitted_amplitude_statistical_error: peak.amplitude.error,
          statistical_uncertainty_status: res.statistical_uncertainty_status,
          r_squared: res.r2,
          reduced_chi_squared: res.reducedChi2,
          convergence_status: "converged",
          status: isOutlier ? "outlier" : "valid",
          center: centerVal, // Alias for KDE strictly matching requested filter
          outlier_excluded: isOutlier,
          exclusion_reason: isOutlier ? `Center shift (${centerShift.toFixed(2)} cm-1) exceeds 3x FWHM (${(3 * baseFwhm).toFixed(2)} cm-1)` : null
        };

        all_model_results.push(modelResult);
      }
    }

    // Determine Best Fit Model by highest mean R2
    for (const model of models) {
      if (r2Counts[model] > 0) {
        const meanR2 = r2Sums[model] / r2Counts[model];
        if (meanR2 > maxMeanR2) {
          maxMeanR2 = meanR2;
          bestFitModel = model;
        }
      }
    }

    // Epistemic properties
    let epistemic_center_min: number | null = null;
    let epistemic_center_max: number | null = null;
    let epistemic_standard_deviation: number | null = null;
    let combined_uncertainty: number | null = null;
    let isDegenerateRange = false;

    if (validCenters.length > 0) {
      epistemic_center_min = Math.min(...validCenters);
      epistemic_center_max = Math.max(...validCenters);
      
      if (epistemic_center_max - epistemic_center_min < DEGENERATE_RANGE_THRESHOLD_CM) {
        isDegenerateRange = true;
        epistemic_center_min = null;
        epistemic_center_max = null;
      }

      if (!isDegenerateRange) {
        const meanC = validCenters.reduce((a, b) => a + b, 0) / validCenters.length;
        const variance = validCenters.reduce((a, b) => a + Math.pow(b - meanC, 2), 0) / validCenters.length;
        epistemic_standard_deviation = Math.sqrt(variance);
      } else {
        epistemic_standard_deviation = 0;
      }

      // Combined uncertainty: RSS of statistical error of best fit and epistemic SD
      // Find best fit result at step 0
      const baseResult = all_model_results.find(r => r.boundary_perturbation_step === 0 && r.model_type === bestFitModel);
      const statErr = baseResult ? baseResult.fitted_center_statistical_error : null;
      
      if (statErr !== null) {
        combined_uncertainty = Math.sqrt(Math.pow(statErr, 2) + Math.pow(epistemic_standard_deviation || 0, 2));
      } else {
        combined_uncertainty = epistemic_standard_deviation;
      }

      const POOR_FIT_R2_THRESHOLD = 0.95;
      let classification: 'STABLE_CONVERGENCE' | 'HIGH_SENSITIVITY' | 'POOR_FIT' = 'STABLE_CONVERGENCE';

      if (maxMeanR2 < POOR_FIT_R2_THRESHOLD) {
        classification = 'POOR_FIT';
      } else if (statErr && statErr > 0) {
        const epistemicSpread = Math.max(...validCenters) - Math.min(...validCenters);
        const ratio = epistemicSpread / (2 * statErr);
        if (ratio > 3) {
          classification = 'HIGH_SENSITIVITY';
        } else if (isDegenerateRange) {
          classification = 'STABLE_CONVERGENCE';
        } else {
          classification = 'STABLE_CONVERGENCE';
        }
      } else if (isDegenerateRange) {
        classification = 'STABLE_CONVERGENCE';
      }

      return {
        peak_id: peakId,
        nominal_center: nominalCenter,
        boundary_left: baseBoundaryLeft,
        boundary_right: baseBoundaryRight,
        boundary_perturbation_range: perturbationRangePct,
        best_fit_model: bestFitModel,
        fitted_center: baseResult ? baseResult.fitted_center : validCenters[0],
        fitted_center_statistical_error: statErr,
        fitted_fwhm: baseResult ? baseResult.fitted_fwhm : null,
        fitted_amplitude: baseResult ? baseResult.fitted_amplitude : null,
        r_squared: maxMeanR2 === -Infinity ? null : maxMeanR2,
        reduced_chi_squared: baseResult ? baseResult.reduced_chi_squared : null,
        epistemic_center_min,
        epistemic_center_max,
        epistemic_standard_deviation,
        combined_uncertainty,
        convergence_status: 'converged',
        all_model_results,
        isDegenerateRange,
        epistemic_classification: classification
      };
    }

    return {
      peak_id: peakId,
      nominal_center: nominalCenter,
      boundary_left: baseBoundaryLeft,
      boundary_right: baseBoundaryRight,
      boundary_perturbation_range: perturbationRangePct,
      best_fit_model: null,
      fitted_center: null,
      fitted_center_statistical_error: null,
      fitted_fwhm: null,
      fitted_amplitude: null,
      r_squared: null,
      reduced_chi_squared: null,
      epistemic_center_min: null,
      epistemic_center_max: null,
      epistemic_standard_deviation: null,
      combined_uncertainty: null,
      convergence_status: 'failed',
      all_model_results,
      isDegenerateRange: false,
      epistemic_classification: 'STABLE_CONVERGENCE'
    };
  }
}
