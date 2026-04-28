/**
 * Replicate Analysis Engine
 * Handles averaging and standard deviation for multiple spectra.
 */

export interface ReplicateStats {
  x: number[];
  mean: number[];
  sd: number[];
  peakStats: {
    xMean: number;
    xSD: number;
    yMean: number;
    ySD: number;
    fwhmMean: number;
    fwhmSD: number;
  }[];
}

export class ReplicateEngine {
  /**
   * Computes mean and SD for a set of spectra.
   * Assumes all spectra share the same X-axis for simplicity in v1.
   * In a future version, we can add interpolation.
   */
  static compute(datasets: { x: number[], y: number[], peaks: any[] }[]): ReplicateStats {
    if (datasets.length === 0) throw new Error("No datasets provided for replicate analysis.");

    const x = datasets[0].x;
    const n = datasets.length;
    const m = x.length;

    const mean = new Array(m).fill(0);
    const sd = new Array(m).fill(0);

    // 1. Compute Mean
    for (let j = 0; j < m; j++) {
      let sum = 0;
      for (let i = 0; i < n; i++) {
        sum += datasets[i].y[j];
      }
      mean[j] = sum / n;
    }

    // 2. Compute SD
    for (let j = 0; j < m; j++) {
      let sumSq = 0;
      for (let i = 0; i < n; i++) {
        sumSq += Math.pow(datasets[i].y[j] - mean[j], 2);
      }
      sd[j] = Math.sqrt(sumSq / n);
    }

    // 3. Compute Peak Stats
    // Logic: Match peaks across replicates by proximity (within 5 cm-1)
    const allPeaks = datasets.flatMap(d => d.peaks);
    const groupedPeaks: any[][] = [];
    
    // Sort all peaks by X to simplify grouping
    const sortedPeaks = allPeaks.sort((a, b) => a.x - b.x);
    
    if (sortedPeaks.length > 0) {
      let currentGroup = [sortedPeaks[0]];
      for (let i = 1; i < sortedPeaks.length; i++) {
        if (Math.abs(sortedPeaks[i].x - currentGroup[currentGroup.length - 1].x) < 5) {
          currentGroup.push(sortedPeaks[i]);
        } else {
          if (currentGroup.length >= n / 2) { // Only keep peaks found in at least half the replicates
            groupedPeaks.push(currentGroup);
          }
          currentGroup = [sortedPeaks[i]];
        }
      }
      if (currentGroup.length >= n / 2) groupedPeaks.push(currentGroup);
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

    return { x, mean, sd, peakStats };
  }
}
