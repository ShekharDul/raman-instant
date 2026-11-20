/**
 * Instant Raman v2.0 — Spectral Processing Engine
 * Pure math. No identification. No interpretation.
 */

import type { Peak, VarianceResult, SpectralData } from './types.ts';

export class SpectralProcessor {

  /**
   * Rejects cosmic ray spikes using a median filter and sigma threshold.
   * Returns a normalized SpectralData structure.
   */
  static rejectCosmicRays(data: SpectralData, window = 7, threshold = 6): { cleaned: SpectralData, replacedCount: number } {
    const y = data.intensityData;
    const resultY = [...y];
    let replacedCount = 0;
    
    // We use a modified Z-score based on Median Absolute Deviation (MAD)
    // for robust spike detection in a sliding window.
    for (let i = window; i < y.length - window; i++) {
      const neighborhood = y.slice(i - window, i + window + 1);
      
      // Calculate Median
      const sorted = [...neighborhood].sort((a, b) => a - b);
      const median = sorted[Math.floor(neighborhood.length / 2)];
      
      // Calculate MAD
      const absoluteDeviations = neighborhood.map(val => Math.abs(val - median));
      const sortedDeviations = [...absoluteDeviations].sort((a, b) => a - b);
      const mad = sortedDeviations[Math.floor(absoluteDeviations.length / 2)];
      
      // Modified Z-score: 0.6745 * (x - median) / MAD
      // Using a threshold of ~6 for aggressive spike detection
      const scale = Math.max(mad, Number.EPSILON * Math.max(1, Math.abs(median), Math.abs(y[i])));
      const score = 0.6745 * (y[i] - median) / scale;
      
      if (score > threshold) {
        // Spike detected! Heal using the median of neighbors
        resultY[i] = median;
        replacedCount++;
      }
    }
    
    return { 
      cleaned: { wavenumberData: data.wavenumberData, intensityData: resultY }, 
      replacedCount 
    };
  }

  /**
   * Simple Non-Iterative Peak (SNIP) algorithm for baseline estimation.
   */
  static baselineSNIP(data: SpectralData, iterations = 25): SpectralData {
    const background = [...data.intensityData];
    const n = background.length;
    for (let i = 1; i <= iterations; i++) {
      for (let j = i; j < n - i; j++) {
        const avg = (background[j - i] + background[j + i]) / 2;
        if (avg < background[j]) background[j] = avg;
      }
    }
    return { wavenumberData: data.wavenumberData, intensityData: background };
  }

  /**
   * Manual baseline interpolation using anchor points.
   */
  static baselineManual(data: SpectralData, anchors: { x: number, y: number }[]): SpectralData {
    const x = data.wavenumberData;
    const y = data.intensityData;
    if (anchors.length === 0) {
      return { wavenumberData: x, intensityData: new Array(y.length).fill(0) };
    }
    const sorted = [...anchors].sort((a, b) => a.x - b.x);
    const bslY = new Array(y.length);
    for (let i = 0; i < x.length; i++) {
      const curX = x[i];
      if (curX <= sorted[0].x) {
        bslY[i] = sorted[0].y;
      } else if (curX >= sorted[sorted.length - 1].x) {
        bslY[i] = sorted[sorted.length - 1].y;
      } else {
        let j = 0;
        while (j < sorted.length - 1 && curX > sorted[j + 1].x) j++;
        const p1 = sorted[j], p2 = sorted[j + 1];
        const dx = p2.x - p1.x;
        const t = Math.abs(dx) < 1e-9 ? 0 : (curX - p1.x) / dx;
        bslY[i] = p1.y + t * (p2.y - p1.y);
      }
    }
    return { wavenumberData: x, intensityData: bslY };
  }

  /**
   * Centered moving-average smoothing; edge values are retained.
   */
  static movingAverage(data: SpectralData, windowSize = 9): SpectralData {
    const y = data.intensityData;
    if (windowSize % 2 === 0) windowSize += 1;
    const resultY = [...y];
    const half = Math.floor(windowSize / 2);
    for (let i = half; i < y.length - half; i++) {
      let sum = 0;
      for (let j = -half; j <= half; j++) sum += y[i + j];
      resultY[i] = sum / windowSize;
    }
    return { wavenumberData: data.wavenumberData, intensityData: resultY };
  }

  /**
   * Calculates signal vs baseline variance percentages.
   */
  static calculateVariance(raw: SpectralData, baseline: SpectralData): VarianceResult {
    const rawY = raw.intensityData;
    const baselineY = baseline.intensityData;
    const calcVar = (arr: number[]) => {
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      return arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
    };
    const signalY = rawY.map((v, i) => v - baselineY[i]);
    const bslVar = calcVar(baselineY);
    const sigVar = calcVar(signalY);
    const total = bslVar + sigVar;
    return {
      sigPct: parseFloat(((sigVar / (total || 1)) * 100).toFixed(1)),
      bslPct: parseFloat(((bslVar / (total || 1)) * 100).toFixed(1))
    };
  }

  /**
   * Robust peak detection using local maxima and parabolic refinement.
   */
  static findPeaks(data: SpectralData): Peak[] {
    const x = data.wavenumberData;
    const y = data.intensityData;
    const getSafeMax = (arr: number[]) => {
      let m = -Infinity;
      for (let i = 0; i < arr.length; i++) if (arr[i] > m) m = arr[i];
      return m;
    };

    const maxY = getSafeMax(y);
    const threshold = maxY * 0.02; // Lowered threshold to 2% for better sensitivity
    const candidates: Peak[] = [];
    for (let i = 5; i < y.length - 5; i++) {
      if (y[i] > threshold && y[i] >= y[i - 1] && y[i] > y[i + 1]) {
        const alpha = y[i - 1], beta = y[i], gamma = y[i + 1];
        const denom = alpha - 2 * beta + gamma;
        let exactX = x[i], exactY = beta;
        if (Math.abs(denom) > 1e-12) {
          const p = 0.5 * (alpha - gamma) / denom;
          exactX = x[i] + p * (x[i] - x[i - 1]);
          exactY = beta - 0.25 * (alpha - gamma) * p;
        }
        const halfMax = exactY / 2;
        let leftIdx = i, rightIdx = i;
        while (leftIdx > 0 && y[leftIdx] > halfMax) leftIdx--;
        while (rightIdx < y.length - 1 && y[rightIdx] > halfMax) rightIdx++;
        const fwhm = Math.abs(x[rightIdx] - x[leftIdx]);
        
        // Calculate area within the peak bounds
        let area = 0;
        for (let j = leftIdx + 1; j <= rightIdx; j++) {
          const dx = Math.abs(x[j] - x[j - 1]);
          const avgY = (y[j] + y[j - 1]) / 2;
          area += avgY * dx;
        }

        candidates.push({ 
          x: parseFloat(exactX.toFixed(2)), 
          y: parseFloat(exactY.toFixed(4)), 
          relIntensity: 0, 
          fwhm: parseFloat(fwhm.toFixed(2)),
          area: parseFloat(area.toFixed(4))
        });
      }
    }
    const deduped: Peak[] = [];
    const used = new Set<number>();
    for (let i = 0; i < candidates.length; i++) {
      if (used.has(i)) continue;
      let best = candidates[i];
      for (let j = i + 1; j < candidates.length; j++) {
        if (used.has(j)) continue;
        // Reduced dedup distance to 2.5 cm-1 for higher resolution detection
        if (Math.abs(candidates[j].x - best.x) <= 2.5) {
          if (candidates[j].y > best.y) best = candidates[j];
          used.add(j);
        }
      }
      used.add(i);
      deduped.push(best);
    }
    const globalMax = getSafeMax(deduped.map(p => p.y));
    if (globalMax <= 0) return [];
    // Increased peak limit to 50 for comprehensive analysis
    return deduped.map(p => ({ ...p, relIntensity: parseFloat(((p.y / globalMax) * 100).toFixed(1)) })).sort((a, b) => b.y - a.y).slice(0, 50);
  }

  /**
   * Computes cross-correlation shift between two spectra.
   */
  static computeGlobalShift(sample: SpectralData, reference: SpectralData, maxShiftCm = 20) {
    const x = sample.wavenumberData;
    const sampleY = sample.intensityData;
    const referenceY = reference.intensityData;
    const avgSpacing = Math.abs(x[x.length - 1] - x[0]) / x.length;
    const maxShiftPx = Math.floor(maxShiftCm / avgSpacing);
    let bestShift = 0; let maxCorr = -Infinity;
    for (let shift = -maxShiftPx; shift <= maxShiftPx; shift++) {
      let corr = 0, count = 0;
      for (let i = 0; i < sampleY.length; i++) {
        const refIdx = i + shift;
        if (refIdx >= 0 && refIdx < referenceY.length) { corr += sampleY[i] * referenceY[refIdx]; count++; }
      }
      const norm = count > 0 ? corr / count : 0;
      if (norm > maxCorr) { maxCorr = norm; bestShift = shift; }
    }
    return { shiftPx: bestShift, shiftCm: parseFloat((bestShift * avgSpacing).toFixed(2)), score: maxCorr };
  }

  /**
   * Normalizes intensity based on the maximum value (Vector Normalization / Peak Max).
   */
  static normalizeMax(data: SpectralData): { normalized: SpectralData, factor: number } {
    const y = data.intensityData;
    let maxVal = 0;
    for (let i = 0; i < y.length; i++) { if (y[i] > maxVal) { maxVal = y[i]; } }
    const factor = maxVal > 0 ? 1 / maxVal : 1;
    return { 
      normalized: { wavenumberData: data.wavenumberData, intensityData: y.map(v => v * factor) }, 
      factor
    };
  }

  /**
   * Normalizes intensity based on the total area under the curve (AUC).
   */
  static normalizeArea(data: SpectralData): { normalized: SpectralData, factor: number } {
    const y = data.intensityData;
    const x = data.wavenumberData;
    let area = 0;
    for (let i = 1; i < y.length; i++) {
      const dx = Math.abs(x[i] - x[i - 1]);
      const avgY = (y[i] + y[i - 1]) / 2;
      area += avgY * dx;
    }
    const factor = area > 0 ? 1 / area : 1;
    return {
      normalized: { wavenumberData: x, intensityData: y.map(v => v * factor) },
      factor
    };
  }

  /**
   * Normalizes intensity based on a specific wavenumber target.
   */
  static normalizeToPoint(data: SpectralData, targetX: number): { normalized: SpectralData, factor: number, actualX: number } {
    const x = data.wavenumberData;
    const y = data.intensityData;
    
    // Find closest index
    let minDiff = Infinity;
    let targetIdx = 0;
    for (let i = 0; i < x.length; i++) {
      const diff = Math.abs(x[i] - targetX);
      if (diff < minDiff) {
        minDiff = diff;
        targetIdx = i;
      }
    }
    
    const targetY = y[targetIdx];
    const factor = targetY > 0 ? 1 / targetY : 1;
    return {
      normalized: { wavenumberData: x, intensityData: y.map(v => v * factor) },
      factor,
      actualX: x[targetIdx]
    };
  }

  /**
   * Calculates residual (difference) between two spectra.
   */
  static calculateResidual(sample: SpectralData, reference: SpectralData, shiftPx: number): SpectralData {
    const sampleY = sample.intensityData;
    const referenceY = reference.intensityData;
    const resultY = sampleY.map((v, i) => {
      const refIdx = i + shiftPx;
      return (refIdx >= 0 && refIdx < referenceY.length) ? v - referenceY[refIdx] : v;
    });
    return { wavenumberData: sample.wavenumberData, intensityData: resultY };
  }

  /**
   * Checks for Silicon calibration peak at ~520.7 cm-1.
   */
  static siliconCalibrationCheck(data: SpectralData): { measuredPeak: number; expectedPeak: number; offset: number; status: 'OK' | 'DRIFTED' | 'NOT_FOUND' } {
    const expectedPeak = 520.7;
    const notFound = { measuredPeak: 0, expectedPeak, offset: 0, status: 'NOT_FOUND' as const };
    const points = data.wavenumberData.flatMap((x, i) =>
      x >= 510 && x <= 535 && Number.isFinite(data.intensityData[i]) ? [{ x, y: data.intensityData[i] }] : []);
    if (points.length < 3 || points.some(({ x }, i) => i > 0 && x <= points[i - 1].x)) return notFound;

    const y = points.map(point => point.y);
    const changes = y.slice(1).map((value, i) => Math.abs(value - y[i])).sort((a, b) => a - b);
    const minimumProminence = 3 * (changes[Math.floor((changes.length - 1) / 2)] + changes[Math.floor(changes.length / 2)]) / 2;
    const rightMinima = [...y];
    for (let i = y.length - 2; i >= 0; i--) rightMinima[i] = Math.min(y[i], rightMinima[i + 1]);
    let leftMinimum = y[0];
    let best = -1;
    let bestProminence = minimumProminence;
    for (let i = 1; i < y.length - 1; i++) {
      leftMinimum = Math.min(leftMinimum, y[i - 1]);
      if (!(y[i] >= y[i - 1] && y[i] > y[i + 1])) continue;
      const prominence = y[i] - Math.max(leftMinimum, rightMinima[i + 1]);
      if (prominence > bestProminence) {
        bestProminence = prominence;
        best = i;
      }
    }
    if (best === -1) return notFound;

    // Three-point quadratic vertex for unequal measured shifts.
    const peak = points[best];
    const left = points[best - 1];
    const right = points[best + 1];
    const before = peak.x - left.x;
    const after = right.x - peak.x;
    const rising = (peak.y - left.y) / before;
    const falling = (right.y - peak.y) / after;
    const curvature = (falling - rising) / (before + after);
    const vertex = curvature < 0 ? -(rising + curvature * before) / (2 * curvature) : 0;
    const refined = peak.x + Math.min(after, Math.max(-before, vertex));
    const offset = refined - expectedPeak;
    return {
      measuredPeak: Number(refined.toFixed(2)), expectedPeak, offset: Number(offset.toFixed(2)),
      status: Math.abs(offset) > 1 ? 'DRIFTED' : 'OK'
    };
  }

}
