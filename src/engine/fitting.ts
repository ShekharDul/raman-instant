/**
 * Instant Raman v2.1 — Advanced Fitting Engine
 * Implements Levenberg-Marquardt (LM) non-linear optimization for spectral deconvolution.
 * Supports Lorentzian, Gaussian, and pseudo-Voigt profiles.
 * Includes rigorous SVD pseudo-inverse for statistical uncertainty quantification.
 */

import { levenbergMarquardt as lm } from 'ml-levenberg-marquardt';
import { SingularValueDecomposition, Matrix } from 'ml-matrix';
import { Diagnostics, type BimodalityResult, type ResidualAnalysisResult } from './diagnostics.ts';

export const DEGENERATE_RANGE_THRESHOLD_CM = 0.01;

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

export interface ModelResult {
  model_type: 'lorentzian' | 'gaussian' | 'voigt';
  boundary_perturbation_step: number;
  boundary_left: number;
  boundary_right: number;
  fitted_center: number | null;
  fitted_fwhm: number | null;
  fitted_amplitude: number | null;
  fitted_peaks?: { amplitude: number, center: number, fwhm: number }[]; // Multi-peak support
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
  fitted_peaks: { amplitude: number, center: number, fwhm: number }[];
  r_squared: number | null;
  reduced_chi_squared: number | null;
  epistemic_center_min: number | null;
  epistemic_center_max: number | null;
  epistemic_standard_deviation: number | null;
  combined_uncertainty: number | null;
  convergence_status: 'converged' | 'failed';
  all_model_results: any[];
  isDegenerateRange: boolean;
  epistemic_classification: 'STABLE_CONVERGENCE' | 'HIGH_SENSITIVITY' | 'POOR_FIT' | 'INVALID_FIT';
  ensembleModelCounts: { lorentzian: number; gaussian: number; voigt: number };
  ensembleN: number;
  ensembleTotal: number;
  bimodality?: BimodalityResult;
  asymmetric?: {
    leftEdgeSensitivity: number;
    rightEdgeSensitivity: number;
    asymmetryRatio: number;
    diagnosis: string;
  };
  residualAnalysis?: ResidualAnalysisResult;
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

  /**
   * Analyzes residuals for systematic patterns.
   */
  static analyzeResiduals(residuals: number[]): ResidualAnalysisResult {
    const autocorr = Diagnostics.autocorrelation(residuals);
    const runsP = Diagnostics.runsTest(residuals);
    const skew = Diagnostics.skewness(residuals);
    
    let diagnosis: 'GOOD_FIT' | 'ASYMMETRIC_PEAK' | 'BASELINE_ARTIFACT' | 'INSTRUMENT_ARTIFACT' = 'GOOD_FIT';
    const isWhiteNoise = Math.abs(autocorr) < 0.3 && runsP > 0.05;
    
    if (Math.abs(skew) > 0.5) {
      diagnosis = 'ASYMMETRIC_PEAK';
    } else if (autocorr > 0.4) {
      diagnosis = 'INSTRUMENT_ARTIFACT';
    } else if (!isWhiteNoise) {
      diagnosis = 'BASELINE_ARTIFACT';
    }

    return {
      isWhiteNoise,
      autocorrelation: autocorr,
      runsTestPvalue: runsP,
      skewness: skew,
      diagnosis
    };
  }

  /**
   * Performs the full Step 3 & Step 4 rigorous multi-model boundary perturbation matrix calculation.
   * Returns a complete IrpPeakFittingRecord.
   */
  static evaluateEpistemicUncertainty(
    x: number[],
    y: number[],
    peakId: number,
    nominalCenters: number | number[],
    baseFwhms: number | number[],
    nominalAmplitudes: number | number[],
    baseBoundaryLeft: number,
    baseBoundaryRight: number,
    perturbationRangePct: number = 10,
    perturbationStepPct: number = 5,
    extendedAnalysis: boolean = false
  ): EpistemicResult {
    const centers = Array.isArray(nominalCenters) ? nominalCenters : [nominalCenters];
    const fwhms = Array.isArray(baseFwhms) ? baseFwhms : [baseFwhms];
    const amplitudes = Array.isArray(nominalAmplitudes) ? nominalAmplitudes : [nominalAmplitudes];
    const numPeaks = centers.length;
    const baseFwhm = fwhms[0]; // Use first peak as reference for perturbation scale

    const models: ("lorentzian" | "gaussian" | "voigt")[] = ["lorentzian", "gaussian", "voigt"];
    
    interface Perturbation {
      step: number;
      left: number;
      right: number;
      type: 'symmetric' | 'left_only' | 'right_only';
    }

    const perturbations: Perturbation[] = [];
    const steps = [-10, -5, 0, 5, 10]; // Fixed steps for defensibility

    // Mode A: Symmetric
    for (const s of steps) {
      const shift = baseFwhm * (s / 100);
      perturbations.push({ step: s, left: baseBoundaryLeft - shift, right: baseBoundaryRight + shift, type: 'symmetric' });
    }

    // Mode B: Asymmetric (Optional)
    if (extendedAnalysis) {
      for (const s of steps) {
        if (s === 0) continue;
        const shift = baseFwhm * (s / 100);
        // Left edge scan
        perturbations.push({ step: s, left: baseBoundaryLeft - shift, right: baseBoundaryRight, type: 'left_only' });
        // Right edge scan
        perturbations.push({ step: s, left: baseBoundaryLeft, right: baseBoundaryRight + shift, type: 'right_only' });
      }
    }

    const all_model_results: any[] = [];
    const validCenters: number[] = [];
    const leftEdgeCenters: number[] = [];
    const rightEdgeCenters: number[] = [];
    const ensembleModelCounts = { lorentzian: 0, gaussian: 0, voigt: 0 };
    let ensembleN = 0;
    const ensembleTotal = perturbations.length * models.length;
    
    let maxMeanR2 = -Infinity;
    let bestFitModel: "lorentzian" | "gaussian" | "voigt" | null = null;

    const r2Sums: Record<string, number> = { lorentzian: 0, gaussian: 0, voigt: 0 };
    const r2Counts: Record<string, number> = { lorentzian: 0, gaussian: 0, voigt: 0 };

    for (const pert of perturbations) {
      // Extract ROI
      const roiX: number[] = [];
      const roiY: number[] = [];
      for (let i = 0; i < x.length; i++) {
        if (x[i] >= pert.left && x[i] <= pert.right) {
          roiX.push(x[i]);
          roiY.push(y[i]);
        }
      }

      for (const model of models) {
        if (roiX.length < 5) continue;

        const initialParams: number[] = [];
        for (let i = 0; i < numPeaks; i++) {
          initialParams.push(amplitudes[i], centers[i], fwhms[i]);
          if (model === 'voigt') initialParams.push(0.5);
        }
        
        const res = this.fit(roiX, roiY, initialParams, model);

        if (res.convergence_status === "failed") continue;

        // For multi-peak, we track the primary peak (usually first) for the main histogram
        const peak = res.peaks[0];
        const centerVal = peak.center.value as number;
        const centerShift = Math.abs(centerVal - centers[0]);
        const isOutlier = centerShift > (3 * fwhms[0]);

        if (!isOutlier) {
          validCenters.push(centerVal);
          if (pert.type === 'left_only') leftEdgeCenters.push(centerVal);
          if (pert.type === 'right_only') rightEdgeCenters.push(centerVal);
          
          if (res.r2 !== null && !isNaN(res.r2)) {
             r2Sums[model] += res.r2;
             r2Counts[model] += 1;
          }
          
          ensembleModelCounts[model]++;
          ensembleN++;
        }

        all_model_results.push({
          model_type: model,
          pert_type: pert.type,
          pert_step: pert.step,
          boundary_left: pert.left,
          boundary_right: pert.right,
          fitted_center: centerVal,
          fitted_fwhm: peak.fwhm.value,
          fitted_amplitude: peak.amplitude.value,
          fitted_peaks: res.peaks.map(p => ({
            amplitude: p.amplitude.value || 0,
            center: p.center.value || 0,
            fwhm: p.fwhm.value || 0
          })),
          fitted_center_statistical_error: peak.center.error,
          r_squared: res.r2,
          reduced_chi_squared: res.reducedChi2,
          convergence_status: "converged",
          status: isOutlier ? "outlier" : "valid",
          residuals: res.residuals // Store for best fit analysis
        });
      }
    }

    // Determine Best Fit Model
    for (const model of models) {
      if (r2Counts[model] > 0) {
        const meanR2 = r2Sums[model] / r2Counts[model];
        if (meanR2 > maxMeanR2) {
          maxMeanR2 = meanR2;
          bestFitModel = model;
        }
      }
    }

    if (validCenters.length > 0) {
      const epistemic_center_min = Math.min(...validCenters);
      const epistemic_center_max = Math.max(...validCenters);
      
      const meanC = Diagnostics.mean(validCenters);
      
      // Rigorous Epistemic SD: Never allow a hard 0 if the ensemble has variance
      const epistemic_standard_deviation = Math.max(Diagnostics.std(validCenters), 0.0001);

      const baseResult = all_model_results.find(r => r.pert_step === 0 && r.model_type === bestFitModel && r.pert_type === 'symmetric');
      const statErr = baseResult ? baseResult.fitted_center_statistical_error : null;
      
      // Accuracy-First Calibration: Add a "Lack-of-Fit" penalty to the combined uncertainty
      // If R^2 is low or a mismatch is detected, it indicates model inadequacy.
      const r2 = maxMeanR2 || 0;
      const fitBias = (r2 < 0.99) ? (baseFwhm * (1 - r2) * 1.0) : 0; 

      const combined_uncertainty = Math.sqrt(
        Math.pow(statErr || 0, 2) + 
        Math.pow(epistemic_standard_deviation, 2) + 
        Math.pow(fitBias, 2)
      );

      // Track multi-peak data for the best fit
      const fitted_peaks = baseResult?.fitted_peaks || [];

      // Bimodality Detection
      const range = epistemic_center_max - epistemic_center_min;
      const sarle = Diagnostics.calculateSarle(validCenters);
      const dipP = Diagnostics.dipTest(validCenters);
      const km = Diagnostics.kMeans2(validCenters);
      const gap = Math.abs(km.clusters[0] - km.clusters[1]);
      
      const significantGap = gap > (0.15 * baseFwhm); 
      const detected = (sarle > 0.65 && dipP < 0.05) || (sarle > 0.555 && significantGap);
      
      const validResults = all_model_results.filter(r => r.status === 'valid');
      const widthVals = validResults.map(r => r.fitted_fwhm).filter(v => v !== null) as number[];
      const widthVariance = widthVals.length > 0 ? Diagnostics.std(widthVals) : 0;
      
      let interpretation: 'UNRESOLVED_DOUBLET' | 'PHASE_MIXTURE' | 'LINESHAPE_MISMATCH' | 'STABLE_UNIMODAL' = 'STABLE_UNIMODAL';
      
      if (detected) {
        if (widthVariance < (0.2 * baseFwhm)) interpretation = 'UNRESOLVED_DOUBLET';
        else interpretation = 'PHASE_MIXTURE';
      } else if (epistemic_standard_deviation > (3 * (statErr || 0.05))) {
        interpretation = 'LINESHAPE_MISMATCH';
      }

      const bimodality: BimodalityResult = {
        detected,
        confidence: sarle > 0.7 ? 'high' : sarle > 0.6 ? 'medium' : 'low',
        sarleCoefficient: sarle,
        dipTestPvalue: dipP,
        clusters: {
          cluster1: { center: km.clusters[0], std: 0, count: km.assignments.filter(a => a === 0).length },
          cluster2: { center: km.clusters[1], std: 0, count: km.assignments.filter(a => a === 1).length },
          separation: gap
        },
        interpretation
      };

      // Asymmetric Sensitivity
      let asymmetric = undefined;
      if (extendedAnalysis && leftEdgeCenters.length > 0 && rightEdgeCenters.length > 0) {
        const leftSens = Diagnostics.std(leftEdgeCenters);
        const rightSens = Diagnostics.std(rightEdgeCenters);
        const ratio = leftSens / (rightSens || 0.001);
        let diagnosis = "Symmetric uncertainty, well-isolated peak";
        if (ratio > 2) diagnosis = "Neighboring peak or baseline artifact on left side";
        if (ratio < 0.5) diagnosis = "Neighboring peak or baseline artifact on right side";
        
        asymmetric = {
          leftEdgeSensitivity: leftSens,
          rightEdgeSensitivity: rightSens,
          asymmetryRatio: ratio,
          diagnosis
        };
      }

      // Residual Analysis on best fit
      const residualAnalysis = baseResult?.residuals ? this.analyzeResiduals(baseResult.residuals) : undefined;

      const POOR_FIT_R2_THRESHOLD = 0.94; // Increased threshold for scientific rigor
      let classification: 'STABLE_CONVERGENCE' | 'HIGH_SENSITIVITY' | 'POOR_FIT' | 'INVALID_FIT' = 'STABLE_CONVERGENCE';
      
      if (detected || interpretation !== 'STABLE_UNIMODAL') {
        classification = 'POOR_FIT';
      } else if (r2 <= 0) {
        classification = 'INVALID_FIT';
      } else if (r2 < POOR_FIT_R2_THRESHOLD) {
        classification = 'POOR_FIT';
      } else if (statErr && statErr > 0) {
        const spread = epistemic_center_max - epistemic_center_min;
        if (spread > (3 * statErr)) classification = 'HIGH_SENSITIVITY';
      }

      return {
        peak_id: peakId,
        nominal_center: centers[0],
        boundary_left: baseBoundaryLeft,
        boundary_right: baseBoundaryRight,
        boundary_perturbation_range: 10,
        best_fit_model: bestFitModel,
        fitted_center: baseResult ? baseResult.fitted_center : validCenters[0],
        fitted_center_statistical_error: statErr,
        fitted_fwhm: baseResult ? baseResult.fitted_fwhm : null,
        fitted_amplitude: baseResult ? baseResult.fitted_amplitude : null,
        fitted_peaks,
        r_squared: maxMeanR2 === -Infinity ? null : maxMeanR2,
        reduced_chi_squared: baseResult ? baseResult.reduced_chi_squared : null,
        epistemic_center_min,
        epistemic_center_max,
        epistemic_standard_deviation,
        combined_uncertainty,
        convergence_status: 'converged',
        all_model_results,
        epistemic_classification: classification,
        ensembleModelCounts,
        ensembleN,
        ensembleTotal,
        bimodality,
        asymmetric,
        residualAnalysis
      };
    }

    return {
      peak_id: peakId,
      nominal_center: centers[0],
      boundary_left: baseBoundaryLeft,
      boundary_right: baseBoundaryRight,
      boundary_perturbation_range: 10,
      best_fit_model: null,
      fitted_center: null,
      fitted_center_statistical_error: null,
      fitted_fwhm: null,
      fitted_amplitude: null,
      fitted_peaks: [],
      r_squared: null,
      reduced_chi_squared: null,
      epistemic_center_min: null,
      epistemic_center_max: null,
      epistemic_standard_deviation: null,
      combined_uncertainty: null,
      convergence_status: 'failed',
      all_model_results,
      isDegenerateRange: false,
      epistemic_classification: 'INVALID_FIT',
      ensembleModelCounts: { lorentzian: 0, gaussian: 0, voigt: 0 },
      ensembleN: 0,
      ensembleTotal: perturbations.length * models.length
    };
  }
}
