/**
 * Instant Raman v2.5 — Uncertainty Propagation Engine
 * Implements Monte Carlo sampling for derived quantities (e.g., I_D/I_G ratio).
 */

import { Diagnostics } from './diagnostics.ts';

export interface PropagationResult {
  mean: number;
  std: number;
  distribution: number[];
  confidenceInterval95: [number, number];
  interpretation: string;
}

export class UncertaintyPropagator {
  /**
   * Propagates uncertainty for a ratio of two intensities (e.g., I_D / I_G).
   */
  static propagateRatio(
    ensembleA: number[], // Intensities from ensemble A
    ensembleB: number[]  // Intensities from ensemble B
  ): PropagationResult {
    const samples: number[] = [];
    const n = 1000;
    
    for (let i = 0; i < n; i++) {
      // Randomly sample from both ensembles
      const valA = ensembleA[Math.floor(Math.random() * ensembleA.length)];
      const valB = ensembleB[Math.floor(Math.random() * ensembleB.length)];
      
      if (valB !== 0) {
        samples.push(valA / valB);
      }
    }
    
    const sorted = [...samples].sort((a, b) => a - b);
    const mean = Diagnostics.mean(samples);
    const std = Diagnostics.std(samples);
    
    const low = sorted[Math.floor(samples.length * 0.025)] || 0;
    const high = sorted[Math.floor(samples.length * 0.975)] || 0;
    
    return {
      mean,
      std,
      distribution: samples,
      confidenceInterval95: [low, high],
      interpretation: `Ratio: ${mean.toFixed(2)} ± ${std.toFixed(2)} (95% CI: [${low.toFixed(2)}, ${high.toFixed(2)}])`
    };
  }

  /**
   * General propagator for any function of N ensemble variables.
   */
  static propagateGeneral(
    ensembles: number[][],
    fn: (...args: number[]) => number
  ): PropagationResult {
    const samples: number[] = [];
    const n = 1000;
    
    for (let i = 0; i < n; i++) {
      const args = ensembles.map(e => e[Math.floor(Math.random() * e.length)]);
      const val = fn(...args);
      if (isFinite(val)) {
        samples.push(val);
      }
    }
    
    const sorted = [...samples].sort((a, b) => a - b);
    const mean = Diagnostics.mean(samples);
    const std = Diagnostics.std(samples);
    
    const low = sorted[Math.floor(samples.length * 0.025)] || 0;
    const high = sorted[Math.floor(samples.length * 0.975)] || 0;
    
    return {
      mean,
      std,
      distribution: samples,
      confidenceInterval95: [low, high],
      interpretation: `Result: ${mean.toFixed(4)} ± ${std.toFixed(4)}`
    };
  }

  /**
   * Calculates the probability that a value exceeds a certain threshold.
   * Useful for regulatory compliance (e.g., probability that impurity > 0.1%).
   */
  static calculateThresholdProbability(samples: number[], threshold: number): number {
    if (samples.length === 0) return 0;
    const count = samples.filter(s => s > threshold).length;
    return count / samples.length;
  }
}
