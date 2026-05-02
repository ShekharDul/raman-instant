import { FittingEngine } from './src/engine/fitting.ts';

function generateSyntheticVoigt(points: number = 200) {
  const x: number[] = [];
  const y: number[] = [];
  const center = 1000;
  const fwhm = 20;
  const amplitude = 100;
  const eta = 0.5;
  
  for (let i = 0; i < points; i++) {
    const xVal = 900 + (200 * i) / (points - 1);
    x.push(xVal);
    let yVal = FittingEngine.voigt(xVal, amplitude * 20, center, fwhm, eta);
    
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    const noise = z0 * 2.0; 
    
    y.push(Math.max(0, yVal + noise));
  }
  
  return { x, y };
}

function runValidation() {
  console.log("=== SYNTHETIC VOIGT VALIDATION (FULL BOUNDARY MATRIX) ===");
  const { x, y } = generateSyntheticVoigt(400);

  // Peak ID: 1, Nominal Center: 1000, FWHM: 20
  // Base boundary: 950 to 1050 (+/- 2.5 * FWHM roughly)
  const result = FittingEngine.evaluateEpistemicUncertainty(
    x, y, 1, 1000, 20, 100, 950, 1050, 10, 5
  );

  console.log(`\n| Model Type | Step (%) | Fitted Center (cm⁻¹) | Stat Error (cm⁻¹) | R²     | Status |`);
  console.log(`|------------|----------|----------------------|-------------------|--------|--------|`);
  
  for (const m of result.all_model_results) {
     const modelType = m.model_type.padEnd(10);
     const step = m.boundary_perturbation_step.toString().padStart(8);
     const center = m.fitted_center ? m.fitted_center.toFixed(4).padStart(20) : "null".padStart(20);
     const err = m.fitted_center_statistical_error ? m.fitted_center_statistical_error.toFixed(4).padStart(17) : "null".padStart(17);
     const r2 = m.r_squared ? m.r_squared.toFixed(4).padStart(6) : "null".padStart(6);
     const status = m.convergence_status === "failed" ? "failed" : (m.statistical_uncertainty_status || "converged");
     
     console.log(`| ${modelType} | ${step} | ${center} | ${err} | ${r2} | ${status.padEnd(6)} |`);
  }

  console.log(`\n[EPISTEMIC UNCERTAINTY AGGREGATION]`);
  console.log(`  Valid Fits Count: ${result.all_model_results.filter((m: any) => m.fitted_center !== null).length}`);
  console.log(`  Epistemic Range: ${(result.epistemic_center_max - result.epistemic_center_min).toFixed(4)} cm⁻¹`);
  console.log(`  Epistemic Std Dev: ${result.epistemic_standard_deviation.toFixed(4)} cm⁻¹`);
  console.log(`  Best Fit Model: ${result.best_fit_model?.toUpperCase()}`);
  console.log(`  Reported Combined Uncertainty: ±${result.combined_uncertainty?.toFixed(4)} cm⁻¹`);
}

runValidation();
