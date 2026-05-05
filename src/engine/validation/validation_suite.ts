/**
 * Instant Raman v2.5 — Validation Suite
 * Automated tests for ensemble uncertainty logic using synthetic spectra.
 */

import { FittingEngine } from '../fitting.ts';
import { UncertaintyPropagator } from '../propagation.ts';

export interface TestCase {
  name: string;
  generate: () => { x: number[]; y: number[]; nominal: any };
  expected: {
    classification?: string;
    bimodalityDetected?: boolean;
    diagnosis?: string;
  };
}

export class ValidationSuite {
  static generateLorentzian(center: number, fwhm: number, amplitude: number, snr: number = 100, slope: number = 0) {
    const x = [];
    for (let i = center - 50; i <= center + 50; i += 0.5) x.push(i);
    const y = x.map(xv => {
      const gamma = fwhm / 2;
      const signal = amplitude / (1 + Math.pow((xv - center) / gamma, 2));
      const baseline = (xv - center) * slope;
      const noise = (Math.random() - 0.5) * (amplitude / snr);
      return signal + baseline + noise;
    });
    return { x, y, nominal: { center, fwhm, amplitude } };
  }

  static generateDoublet(c1: number, c2: number, f1: number, f2: number, a1: number, a2: number, snr: number = 100) {
    const x = [];
    const center = (c1 + c2) / 2;
    for (let i = center - 50; i <= center + 50; i += 0.5) x.push(i);
    const y = x.map(xv => {
      const g1 = f1 / 2;
      const g2 = f2 / 2;
      const s1 = a1 / (1 + Math.pow((xv - c1) / g1, 2));
      const s2 = a2 / (1 + Math.pow((xv - c2) / g2, 2));
      const noise = (Math.random() - 0.5) * ((a1 + a2) / (2 * snr));
      return s1 + s2 + noise;
    });
    return { x, y, nominal: { center, fwhm: (f1 + f2) / 2 + Math.abs(c1 - c2), amplitude: Math.max(a1, a2) } };
  }

  static generateAsymmetric(center: number, fwhm: number, amplitude: number, skew: number) {
    const x = [];
    for (let i = center - 50; i <= center + 50; i += 0.5) x.push(i);
    const y = x.map(xv => {
      const g = xv < center ? fwhm / 2 : (fwhm / 2) * (1 + skew);
      const signal = amplitude / (1 + Math.pow((xv - center) / g, 2));
      return signal;
    });
    return { x, y, nominal: { center, fwhm, amplitude } };
  }

  static async run() {
    const testCases: TestCase[] = [
      {
        name: 'Clean Lorentzian',
        generate: () => this.generateLorentzian(1000, 5, 100, 200),
        expected: { classification: 'STABLE_CONVERGENCE', bimodalityDetected: false }
      },
      {
        name: 'Unresolved Doublet (5 cm⁻¹ shift)',
        generate: () => this.generateDoublet(783, 788, 3, 3, 100, 100, 100),
        expected: { bimodalityDetected: true, diagnosis: 'UNRESOLVED_DOUBLET' }
      },
      {
        name: 'Asymmetric Peak',
        generate: () => this.generateAsymmetric(1200, 10, 100, 1.0),
        expected: { diagnosis: 'ASYMMETRIC_PEAK' }
      },
      {
        name: 'Noisy Peak with Slope (Sensitive)',
        generate: () => this.generateLorentzian(1500, 8, 100, 40, 1.0),
        expected: { classification: 'HIGH_SENSITIVITY' }
      }
    ];

    console.log('--- STARTING VALIDATION SUITE ---');
    const results = [];

    for (const tc of testCases) {
      const { x, y, nominal } = tc.generate();
      const res = FittingEngine.evaluateEpistemicUncertainty(
        x, y, 1, nominal.center, nominal.fwhm, nominal.amplitude, 
        nominal.center - nominal.fwhm * 1.5, nominal.center + nominal.fwhm * 1.5,
        10, 5, true
      );

      const passedClass = !tc.expected.classification || res.epistemic_classification === tc.expected.classification;
      const passedBim = tc.expected.bimodalityDetected === undefined || res.bimodality?.detected === tc.expected.bimodalityDetected;
      const passedDiag = !tc.expected.diagnosis || 
                         res.bimodality?.interpretation === tc.expected.diagnosis || 
                         res.residualAnalysis?.diagnosis === tc.expected.diagnosis;

      const success = passedClass && passedBim && passedDiag;
      
      console.log(`${success ? '✅' : '❌'} [${tc.name}]`);
      console.log(`   Stats: Sarle=${res.bimodality?.sarleCoefficient.toFixed(3)}, DipP=${res.bimodality?.dipTestPvalue.toFixed(3)}, Gap=${res.bimodality?.clusters.separation.toFixed(3)}, StdEp=${res.epistemic_standard_deviation?.toFixed(3)}`);
      if (!success) {
        console.log(`   Expected: ${JSON.stringify(tc.expected)}`);
        console.log(`   Actual:   Class=${res.epistemic_classification}, Bim=${res.bimodality?.detected}, Diag=${res.bimodality?.interpretation || res.residualAnalysis?.diagnosis}`);
      }
      results.push({ name: tc.name, success });
    }

    const totalPassed = results.filter(r => r.success).length;
    console.log(`--- VALIDATION COMPLETE: ${totalPassed}/${testCases.length} PASSED ---`);
    
    console.log('\n--- TESTING UNCERTAINTY PROPAGATION (Monte Carlo) ---');
    await this.testPropagateRatio();
    
    return results;
  }

  static async testPropagateRatio() {
    const ensembleA = [100, 101, 99, 102, 98]; // Intensity of Peak D
    const ensembleB = [200, 198, 202, 199, 201]; // Intensity of Peak G
    
    const result = UncertaintyPropagator.propagateRatio(ensembleA, ensembleB);
    
    console.log(`ID/IG Ratio: ${result.mean.toFixed(3)} ± ${result.std.toFixed(3)}`);
    console.log(`95% CI: [${result.confidenceInterval95[0].toFixed(3)}, ${result.confidenceInterval95[1].toFixed(3)}]`);
    
    if (Math.abs(result.mean - 0.5) < 0.05) {
      console.log('✅ Propagation Test Passed');
    } else {
      console.log('❌ Propagation Test Failed');
    }
  }
}
