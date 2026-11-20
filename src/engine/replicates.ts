/**
 * Replicate Analysis Engine
 * Handles averaging and standard deviation for multiple spectra.
 */

import type { SpectralData, Peak } from './types.ts';

export interface ReplicateStats {
  mean: SpectralData;
  sd: number[];
  peakStats: {
    xMean: number;
    xSD: number;
    yMean: number;
    ySD: number;
    fwhmMean: number;
    fwhmSD: number;
  }[];
  selectedPeakX: Set<number>;
}

export class ReplicateEngine {
  /**
   * Computes mean and SD for a set of spectra.
   * Requires a shared, strictly increasing grid so each row represents the same shift.
   */
  static compute(datasets: { raw: SpectralData, processed: SpectralData, peaks: Peak[] }[]): ReplicateStats {
    if (datasets.length === 0) throw new Error("No datasets provided for replicate analysis.");

    const x = datasets[0].raw.wavenumberData;
    const n = datasets.length;
    const m = x.length;
    if (m < 2 || x.some((value, i) => !Number.isFinite(value) || (i > 0 && value <= x[i - 1]))) {
      throw new Error('Replicates require a strictly increasing Raman-shift grid without duplicate points.');
    }
    for (const { processed } of datasets) {
      if (processed.wavenumberData.length !== m || processed.intensityData.length !== m ||
        x.some((value, i) => processed.wavenumberData[i] !== value || !Number.isFinite(processed.intensityData[i]))) {
        throw new Error('Replicates must have identical Raman-shift grids and finite intensities. Align or resample them before grouping.');
      }
    }

    const meanY = new Array(m).fill(0);
    const sd = new Array(m).fill(0);

    // 1. Compute Mean
    for (let j = 0; j < m; j++) {
      let sum = 0;
      for (let i = 0; i < n; i++) {
        sum += datasets[i].processed.intensityData[j];
      }
      meanY[j] = sum / n;
    }

    // 2. Compute SD
    for (let j = 0; j < m; j++) {
      let sumSq = 0;
      for (let i = 0; i < n; i++) {
        sumSq += Math.pow(datasets[i].processed.intensityData[j] - meanY[j], 2);
      }
      sd[j] = Math.sqrt(sumSq / n);
    }


    // 3. Compute Peak Stats
    const allPeaks = datasets.flatMap((d, spectrum) => d.peaks.map(peak => ({ peak, spectrum })));
    const groupedPeaks: Peak[][] = [];

    allPeaks.sort((a, b) => a.peak.x - b.peak.x);
    for (let i = 0; i < allPeaks.length;) {
      const start = allPeaks[i].peak.x;
      const group = new Map<number, Peak>();
      while (i < allPeaks.length && allPeaks[i].peak.x - start < 5) {
        const { spectrum, peak } = allPeaks[i++];
        const prior = group.get(spectrum);
        if (!prior || peak.y > prior.y) group.set(spectrum, peak);
      }
      if (group.size >= Math.max(2, Math.ceil(n / 2))) groupedPeaks.push([...group.values()]);
    }

    const peakStats = groupedPeaks.map(group => {
      const xVals = group.map(p => p.x);
      const yVals = group.map(p => p.y);
      const fwhmVals = group.map(p => p.fwhm);

      const calcStats = (vals: number[]) => {
        const m = vals.reduce((a, b) => a + b, 0) / vals.length;
        const s = Math.sqrt(vals.reduce((a, b) => a + Math.pow(b - m, 2), 0) / vals.length);
        return { mean: m, sd: s };
      };

      const xStats = calcStats(xVals);
      const yStats = calcStats(yVals);
      const fwhmStats = calcStats(fwhmVals);

      return {
        xMean: parseFloat(xStats.mean.toFixed(2)),
        xSD: parseFloat(xStats.sd.toFixed(2)),
        yMean: parseFloat(yStats.mean.toFixed(4)),
        ySD: parseFloat(yStats.sd.toFixed(4)),
        fwhmMean: parseFloat(fwhmStats.mean.toFixed(2)),
        fwhmSD: parseFloat(fwhmStats.sd.toFixed(2))
      };
    });

    return { mean: { wavenumberData: x, intensityData: meanY }, sd, peakStats, selectedPeakX: new Set() };
  }
}

