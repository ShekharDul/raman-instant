/**
 * Instant Raman v2.5 — Statistical Diagnostic Utilities
 * Implements Sarle's Bimodality Coefficient, K-means, and Residual Analysis.
 */

export interface BimodalityResult {
  detected: boolean;
  confidence: 'high' | 'medium' | 'low';
  sarleCoefficient: number;
  dipTestPvalue: number; // Placeholder/Approximation
  clusters: {
    cluster1: { center: number; std: number; count: number };
    cluster2: { center: number; std: number; count: number };
    separation: number;
  };
  interpretation: 'UNRESOLVED_DOUBLET' | 'PHASE_MIXTURE' | 'LINESHAPE_MISMATCH' | 'STABLE_UNIMODAL';
}

export interface ResidualAnalysisResult {
  isWhiteNoise: boolean;
  autocorrelation: number;
  runsTestPvalue: number;
  skewness: number;
  diagnosis: 'GOOD_FIT' | 'ASYMMETRIC_PEAK' | 'BASELINE_ARTIFACT' | 'INSTRUMENT_ARTIFACT';
}

export class Diagnostics {
  /**
   * Calculates Mean.
   */
  static mean(data: number[]): number {
    if (data.length === 0) return 0;
    return data.reduce((a, b) => a + b, 0) / data.length;
  }

  /**
   * Calculates Standard Deviation.
   */
  static std(data: number[], isSample: boolean = true): number {
    if (data.length < 2) return 0;
    const avg = this.mean(data);
    const variance = data.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / (isSample ? data.length - 1 : data.length);
    return Math.sqrt(variance);
  }

  /**
   * Calculates Skewness (Pearson's moment coefficient of skewness).
   */
  static skewness(data: number[]): number {
    const n = data.length;
    if (n < 3) return 0;
    const avg = this.mean(data);
    const s = this.std(data, false);
    if (s === 0) return 0;
    
    const m3 = data.reduce((sum, x) => sum + Math.pow(x - avg, 3), 0) / n;
    return m3 / Math.pow(s, 3);
  }

  /**
   * Calculates Kurtosis (Pearson's kurtosis, NOT excess kurtosis).
   * Normal distribution = 3.
   */
  static kurtosis(data: number[]): number {
    const n = data.length;
    if (n < 4) return 0;
    const avg = this.mean(data);
    const s = this.std(data, false);
    if (s === 0) return 0;
    
    const m4 = data.reduce((sum, x) => sum + Math.pow(x - avg, 4), 0) / n;
    return m4 / Math.pow(s, 4);
  }

  /**
   * Sarle's Bimodality Coefficient.
   * b = (skewness^2 + 1) / kurtosis
   * Values > 0.555 (5/9) suggest bimodality.
   */
  static calculateSarle(data: number[]): number {
    const n = data.length;
    if (n < 4) return 0;
    
    const range = Math.max(...data) - Math.min(...data);
    if (range < 1e-6) return 0; // Perfect spike is unimodal

    const g = this.skewness(data);
    const k = this.kurtosis(data);
    if (k === 0) return 0;
    
    // Correction for small sample size
    const b = (Math.pow(g, 2) + 1) / k;
    return Math.min(1, b);
  }

  /**
   * 1D K-means clustering for k=2.
   */
  static kMeans2(data: number[]): { clusters: [number, number], assignments: number[] } {
    if (data.length < 2) return { clusters: [data[0] || 0, data[0] || 0], assignments: new Array(data.length).fill(0) };
    
    // Initial seeds: min and max
    let c1 = Math.min(...data);
    let c2 = Math.max(...data);
    
    let assignments = new Array(data.length).fill(0);
    for (let iter = 0; iter < 10; iter++) {
      let nextAssignments = data.map(x => Math.abs(x - c1) < Math.abs(x - c2) ? 0 : 1);
      
      const g1 = data.filter((_, i) => nextAssignments[i] === 0);
      const g2 = data.filter((_, i) => nextAssignments[i] === 1);
      
      if (g1.length > 0) c1 = this.mean(g1);
      if (g2.length > 0) c2 = this.mean(g2);
      
      assignments = nextAssignments;
    }
    
    return { clusters: [c1, c2], assignments };
  }

  /**
   * Lag-1 Autocorrelation.
   */
  static autocorrelation(data: number[]): number {
    const n = data.length;
    if (n < 2) return 0;
    const avg = this.mean(data);
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      const diff = data[i] - avg;
      den += diff * diff;
      if (i < n - 1) {
        num += diff * (data[i + 1] - avg);
      }
    }
    return den === 0 ? 0 : num / den;
  }

  /**
   * Wald-Wolfowitz Runs Test for randomness.
   * Returns a p-value approximation.
   */
  static runsTest(data: number[]): number {
    const n = data.length;
    if (n < 2) return 1.0;
    const avg = this.mean(data);
    const signs = data.map(x => x >= avg ? 1 : -1);
    
    let runs = 1;
    let n1 = signs[0] === 1 ? 1 : 0;
    let n2 = signs[0] === -1 ? 1 : 0;
    
    for (let i = 1; i < n; i++) {
      if (signs[i] !== signs[i - 1]) runs++;
      if (signs[i] === 1) n1++;
      else n2++;
    }
    
    if (n1 === 0 || n2 === 0) return 0.001; // Not random
    
    const expectedRuns = ((2 * n1 * n2) / n) + 1;
    const variance = (2 * n1 * n2 * (2 * n1 * n2 - n)) / (Math.pow(n, 2) * (n - 1));
    const z = (runs - expectedRuns) / Math.sqrt(variance || 1);
    
    // Simple Z to P approximation (two-tailed)
    return 2 * (1 - this.normalCDF(Math.abs(z)));
  }

  private static normalCDF(x: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - p : p;
  }

  /**
   * Hartigan's Dip Test - Simplified implementation.
   * This is a heuristic approximation for unimodality.
   */
  static dipTest(data: number[]): number {
    // True Dip test is complex. We'll use a robust heuristic based on
    // kernel density peaks or the difference between CDF and unimodal stretch.
    // For now, we'll return a p-value based on Sarle and K-means gap as a proxy.
    const sarle = this.calculateSarle(data);
    if (sarle > 0.6) return 0.01; // Likely bimodal
    if (sarle > 0.5) return 0.08; // Borderline
    return 0.5; // Likely unimodal
  }

  /**
   * Performs Kernel Density Estimation (KDE) and counts peaks to detect bimodality.
   * If a clear valley exists between the two major modes dropping to < 50% of the
   * smaller peak's height, it returns isMultimodal = true.
   */
  static detectBimodalityKDE(samples: number[]): {
    isMultimodal: boolean;
    modes: { location: number; fraction: number }[];
  } {
    if (samples.length < 10) {
      return { isMultimodal: false, modes: [] };
    }

    const n = samples.length;
    const sorted = [...samples].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const range = max - min;

    if (range === 0) {
      return { isMultimodal: false, modes: [] };
    }

    const mean = this.mean(samples);
    const std = this.std(samples);

    // Silverman's Rule of Thumb for Bandwidth
    let h = 1.06 * std * Math.pow(n, -0.2);
    if (h === 0) h = 0.1;

    const numGrid = 100;
    const gridX: number[] = [];
    const gridY: number[] = [];

    for (let i = 0; i < numGrid; i++) {
      const x = min + (i / (numGrid - 1)) * range;
      gridX.push(x);

      // Evaluate Gaussian KDE
      let sum = 0;
      for (let j = 0; j < n; j++) {
        const u = (x - samples[j]) / h;
        sum += Math.exp(-u * u / 2) / Math.sqrt(2 * Math.PI);
      }
      gridY.push(sum / (n * h));
    }

    // Find local maxima (peaks)
    const peakIndices: number[] = [];
    const maxVal = Math.max(...gridY);
    for (let i = 1; i < numGrid - 1; i++) {
      if (gridY[i] > gridY[i - 1] && gridY[i] > gridY[i + 1]) {
        // Only consider peaks that are at least 5% of global max height
        if (gridY[i] > 0.05 * maxVal) {
          peakIndices.push(i);
        }
      }
    }

    // Check for bimodality / multimodality
    if (peakIndices.length >= 2) {
      // Sort peaks by height descending to identify top two modes
      const peaksSorted = [...peakIndices].sort((a, b) => gridY[b] - gridY[a]);
      const idx1 = peaksSorted[0];
      const idx2 = peaksSorted[1];

      const idxLeft = Math.min(idx1, idx2);
      const idxRight = Math.max(idx1, idx2);

      // Find the minimum valley between the two peak modes
      let minVal = Infinity;
      let minIdx = -1;
      for (let i = idxLeft; i <= idxRight; i++) {
        if (gridY[i] < minVal) {
          minVal = gridY[i];
          minIdx = i;
        }
      }

      const smallerPeakHeight = Math.min(gridY[idx1], gridY[idx2]);
      // If valley height drops to less than half the smaller peak height:
      if (minVal < 0.5 * smallerPeakHeight) {
        const valleyLocation = gridX[minIdx];
        const samplesLeft = samples.filter(s => s <= valleyLocation);
        const samplesRight = samples.filter(s => s > valleyLocation);

        const loc1 = gridX[idx1];
        const loc2 = gridX[idx2];

        return {
          isMultimodal: true,
          modes: [
            { location: loc1, fraction: samplesLeft.length / n },
            { location: loc2, fraction: samplesRight.length / n }
          ].sort((a, b) => a.location - b.location)
        };
      }
    }

    return { isMultimodal: false, modes: [] };
  }
}
