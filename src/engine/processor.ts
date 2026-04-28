/**
 * Instant Raman v2.0 — Spectral Processing Engine
 * Pure math. No identification. No interpretation.
 */

export interface Peak {
  x: number;       // Wavenumber (cm⁻¹)
  y: number;       // Absolute intensity
  relIntensity: number; // Relative intensity (0-100)
  fwhm: number;    // Full width at half maximum (cm⁻¹)
}

export interface VarianceResult {
  sigPct: number;
  bslPct: number;
}

export class SpectralProcessor {

  static rejectCosmicRays(y: number[], window = 5, thresholdSigma = 5): { cleanedY: number[], replacedCount: number } {
    const result = [...y];
    let replacedCount = 0;
    for (let i = window; i < y.length - window; i++) {
      const neighborhood = y.slice(i - window, i + window + 1);
      const sorted = [...neighborhood].sort((a, b) => a - b);
      const median = sorted[window];
      const mean = neighborhood.reduce((a, b) => a + b, 0) / neighborhood.length;
      const std = Math.sqrt(neighborhood.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / neighborhood.length);
      if (Math.abs(y[i] - median) > thresholdSigma * Math.max(std, 0.01)) {
        result[i] = median;
        replacedCount++;
      }
    }
    return { cleanedY: result, replacedCount };
  }

  static baselineSNIP(y: number[], iterations = 25): number[] {
    const background = [...y];
    const n = y.length;
    for (let i = 1; i <= iterations; i++) {
      for (let j = i; j < n - i; j++) {
        const avg = (background[j - i] + background[j + i]) / 2;
        if (avg < background[j]) background[j] = avg;
      }
    }
    return background;
  }

  static baselineManual(x: number[], y: number[], anchors: { x: number, y: number }[]): number[] {
    if (anchors.length === 0) return new Array(y.length).fill(0);
    const sorted = [...anchors].sort((a, b) => a.x - b.x);
    const bsl = new Array(y.length);
    for (let i = 0; i < x.length; i++) {
      const curX = x[i];
      if (curX <= sorted[0].x) {
        bsl[i] = sorted[0].y;
      } else if (curX >= sorted[sorted.length - 1].x) {
        bsl[i] = sorted[sorted.length - 1].y;
      } else {
        let j = 0;
        while (j < sorted.length - 1 && curX > sorted[j + 1].x) j++;
        const p1 = sorted[j], p2 = sorted[j + 1];
        const t = (curX - p1.x) / (p2.x - p1.x);
        bsl[i] = p1.y + t * (p2.y - p1.y);
      }
    }
    return bsl;
  }

  static savitzkyGolay(y: number[], windowSize = 9): number[] {
    if (windowSize % 2 === 0) windowSize += 1;
    const result = [...y];
    const half = Math.floor(windowSize / 2);
    for (let i = half; i < y.length - half; i++) {
      let sum = 0;
      for (let j = -half; j <= half; j++) sum += y[i + j];
      result[i] = sum / windowSize;
    }
    return result;
  }

  static calculateVariance(rawY: number[], baselineY: number[]): VarianceResult {
    const calcVar = (arr: number[]) => {
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      return arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
    };
    const signalY = rawY.map((v, i) => v - baselineY[i]);
    const bslVar = calcVar(baselineY);
    const sigVar = calcVar(signalY);
    const total = bslVar + sigVar;
    return {
      sigPct: parseFloat(((sigVar / total) * 100).toFixed(1)),
      bslPct: parseFloat(((bslVar / total) * 100).toFixed(1))
    };
  }

  static findPeaks(x: number[], y: number[]): Peak[] {
    const getSafeMax = (arr: number[]) => {
      let m = -Infinity;
      for (let i = 0; i < arr.length; i++) if (arr[i] > m) m = arr[i];
      return m;
    };

    const maxY = getSafeMax(y);
    const threshold = maxY * 0.05;
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
        candidates.push({ x: parseFloat(exactX.toFixed(2)), y: parseFloat(exactY.toFixed(4)), relIntensity: 0, fwhm: parseFloat(fwhm.toFixed(2)) });
      }
    }
    const deduped: Peak[] = [];
    const used = new Set<number>();
    for (let i = 0; i < candidates.length; i++) {
      if (used.has(i)) continue;
      let best = candidates[i];
      for (let j = i + 1; j < candidates.length; j++) {
        if (used.has(j)) continue;
        if (Math.abs(candidates[j].x - best.x) <= 5) {
          if (candidates[j].y > best.y) best = candidates[j];
          used.add(j);
        }
      }
      used.add(i);
      deduped.push(best);
    }
    const globalMax = getSafeMax(deduped.map(p => p.y));
    if (globalMax <= 0) return [];
    return deduped.map(p => ({ ...p, relIntensity: parseFloat(((p.y / globalMax) * 100).toFixed(1)) })).sort((a, b) => b.y - a.y).slice(0, 20);
  }

  static computeGlobalShift(x: number[], sampleY: number[], referenceY: number[], maxShiftCm = 20) {
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

  static normalizeMax(y: number[]): { normalized: number[], factor: number, peakIdx: number } {
    let maxVal = 0, peakIdx = 0;
    for (let i = 0; i < y.length; i++) { if (y[i] > maxVal) { maxVal = y[i]; peakIdx = i; } }
    const factor = maxVal > 0 ? 1 / maxVal : 1;
    return { normalized: y.map(v => v * factor), factor, peakIdx };
  }

  static calculateResidual(sampleY: number[], referenceY: number[], shiftPx: number): number[] {
    return sampleY.map((v, i) => {
      const refIdx = i + shiftPx;
      return (refIdx >= 0 && refIdx < referenceY.length) ? v - referenceY[refIdx] : v;
    });
  }
  static siliconCalibrationCheck(x: number[], y: number[]): { measuredPeak: number; expectedPeak: number; offset: number; status: 'OK' | 'DRIFTED' | 'NOT_FOUND' } {
    const SI_EXPECTED = 520.7;
    const windowStart = 510;
    const windowEnd = 535;

    // Find indices within the window
    let startIdx = 0; while (startIdx < x.length && x[startIdx] < windowStart) startIdx++;
    let endIdx = x.length - 1; while (endIdx >= 0 && x[endIdx] > windowEnd) endIdx--;

    if (startIdx >= endIdx) return { measuredPeak: 0, expectedPeak: SI_EXPECTED, offset: 0, status: 'NOT_FOUND' };

    const windowX = x.slice(startIdx, endIdx + 1);
    const windowY = y.slice(startIdx, endIdx + 1);

    // Find local max in this window
    let maxVal = -Infinity, maxIdx = -1;
    for (let i = 0; i < windowY.length; i++) {
      if (windowY[i] > maxVal) { maxVal = windowY[i]; maxIdx = i; }
    }

    if (maxIdx === -1 || maxVal <= 0) return { measuredPeak: 0, expectedPeak: SI_EXPECTED, offset: 0, status: 'NOT_FOUND' };

    // Refine peak with parabolic interpolation if possible
    let refinedX = windowX[maxIdx];
    if (maxIdx > 0 && maxIdx < windowY.length - 1) {
      const alpha = windowY[maxIdx - 1], beta = windowY[maxIdx], gamma = windowY[maxIdx + 1];
      const denom = alpha - 2 * beta + gamma;
      if (Math.abs(denom) > 1e-12) {
        const p = 0.5 * (alpha - gamma) / denom;
        refinedX = windowX[maxIdx] + p * (windowX[maxIdx] - windowX[maxIdx - 1]);
      }
    }

    const offset = refinedX - SI_EXPECTED;
    const absOffset = Math.abs(offset);
    let status: 'OK' | 'DRIFTED' | 'NOT_FOUND' = 'OK';
    if (absOffset > 1.0) status = 'DRIFTED';
    
    return {
      measuredPeak: parseFloat(refinedX.toFixed(2)),
      expectedPeak: SI_EXPECTED,
      offset: parseFloat(offset.toFixed(2)),
      status
    };
  }
}
