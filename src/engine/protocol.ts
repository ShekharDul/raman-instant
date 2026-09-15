import type { NormalizedSpectrum } from './types.ts';

/**
 * Instant Raman Protocol (.irp) Types
 * This defines the JSON schema for saved analysis settings of Raman analyses.
 */

export interface IrpMetadata {
  instant_raman_version: string;
  protocol_version: string; // e.g. "1.0.0"
  protocol_id: string; // UUID v4
  created_at: string; // ISO 8601 timestamp
  created_by: string; // Defaults to "Anonymous"
}

export interface IrpSourceData {
  original_filename: string;
  file_format_detected: string;
  wavenumber_range: {
    min: number;
    max: number;
  };
  wavenumber_spacing: number;
  number_of_data_points: number;
  file_hash: string; // SHA-256
  spectrum_hash?: string;
  import_metadata?: NormalizedSpectrum['metadata'];
}

export interface IrpProcessingStep<T> {
  step_number: number;
  step_name: string;
  applied: boolean;
  parameters: T | null; // null if not applied, though we usually still record parameters if they exist but weren't applied
}

export interface IrpCosmicRayParams {
  algorithm: "MAD_zscore";
  threshold: number | null;
  spikes_detected: number | null;
  spikes_removed: number | null;
  spike_positions: number[] | null;
}

export interface IrpBaselineParams {
  algorithm: "SNIP" | "linear_anchor_interpolation";
  iterations: number | null;
  mode: "manual" | "auto" | null;
  anchors?: { x: number; y: number }[];
  smoothing?: { algorithm: 'moving_average'; window: number };
  clip_negative_corrected?: boolean;
}

export interface IrpNormalizationParams {
  method: "max_intensity" | "total_area" | "reference_peak" | "none";
  reference_wavenumber: number | null;
}

export interface IrpPeakDetectionParams {
  method: "parabolic_interpolation";
  minimum_height_threshold: number | null; // Percentage of max intensity
  minimum_separation: number | null;
  peaks_detected: number | null;
  peak_positions: number[] | null;
}

export interface IrpPeakFittingRecord {
  peak_id: number;
  nominal_center: number;
  boundary_left: number;
  boundary_right: number;
  best_fit_model: "lorentzian" | "gaussian" | "voigt" | null;
  fitted_center: number | null;
  fitted_center_statistical_error: number | null;
  fitted_fwhm: number | null;
  fitted_amplitude: number | null;
  fitted_shape?: number | null;
  r_squared: number | null;
  reduced_chi_squared: number | null;
  convergence_status: "converged" | "failed" | null;
}

export interface IrpIntegrationRecord {
  peak_id: number;
  boundary_left: number;
  boundary_right: number;
  local_baseline_left_intensity: number;
  local_baseline_right_intensity: number;
  integration_method: "simpsons" | "trapezoidal_fallback" | null;
  integrated_area: number | null;
  units: string | null;
}

export interface InstantRamanProtocol {
  protocol_metadata: IrpMetadata;
  source_data_record: IrpSourceData;
  processing_steps: [
    IrpProcessingStep<IrpCosmicRayParams>,
    IrpProcessingStep<IrpBaselineParams>,
    IrpProcessingStep<IrpNormalizationParams>,
    IrpProcessingStep<IrpPeakDetectionParams>
  ];
  fitting_record: IrpPeakFittingRecord[] | null;
  integration_record: IrpIntegrationRecord[] | null;
}

export class ProtocolManager {
  static async spectrumHash(raw: NormalizedSpectrum): Promise<string> {
    // Covers the selected data and import choices, not merely its parent workbook.
    const identity = [raw.wavenumberData, raw.intensityData, raw.metadata.sheetName ?? null,
      raw.metadata.importSettings ?? null];
    return this.computeHash(new TextEncoder().encode(JSON.stringify(identity)).buffer);
  }

  static async matchingSpectra<T extends { raw: NormalizedSpectrum; fileHash?: string }>(source: IrpSourceData, candidates: T[]): Promise<T[]> {
    if (!source.spectrum_hash) return []; // Legacy hashes cannot identify a worksheet/column selection.
    const matches: T[] = [];
    for (const candidate of candidates) {
      if (candidate.fileHash === source.file_hash && await this.spectrumHash(candidate.raw) === source.spectrum_hash) matches.push(candidate);
    }
    return matches;
  }
  /**
   * Strictly validates the given JSON object against the InstantRamanProtocol schema.
   * Rejects the file immediately with a specific error message identifying the failed field.
   */
  static validateSchema(json: any): InstantRamanProtocol {
    if (!json || typeof json !== 'object') throw new Error("Protocol must be a valid JSON object.");

    // Helper for explicit type checking
    const checkType = (path: string, val: any, expectedType: string, isNullable: boolean = false) => {
      if (val === undefined) {
        throw new Error(`Validation Error: Missing mandatory field '${path}'.`);
      }
      if (val === null) {
        if (!isNullable) throw new Error(`Validation Error: Field '${path}' cannot be null.`);
        return;
      }
      if (expectedType === 'array') {
        if (!Array.isArray(val)) throw new Error(`Validation Error: '${path}' is expected to be an array, but received ${typeof val}.`);
      } else if (typeof val !== expectedType) {
        throw new Error(`Validation Error: '${path}' is expected to be a ${expectedType}, but received ${typeof val}.`);
      }
    };

    // protocol_metadata
    checkType('protocol_metadata', json.protocol_metadata, 'object');
    checkType('protocol_metadata.instant_raman_version', json.protocol_metadata.instant_raman_version, 'string');
    checkType('protocol_metadata.protocol_version', json.protocol_metadata.protocol_version, 'string');
    checkType('protocol_metadata.protocol_id', json.protocol_metadata.protocol_id, 'string');
    checkType('protocol_metadata.created_at', json.protocol_metadata.created_at, 'string');
    checkType('protocol_metadata.created_by', json.protocol_metadata.created_by, 'string');

    // source_data_record
    checkType('source_data_record', json.source_data_record, 'object');
    checkType('source_data_record.original_filename', json.source_data_record.original_filename, 'string');
    checkType('source_data_record.file_format_detected', json.source_data_record.file_format_detected, 'string');
    checkType('source_data_record.wavenumber_range', json.source_data_record.wavenumber_range, 'object');
    checkType('source_data_record.wavenumber_range.min', json.source_data_record.wavenumber_range.min, 'number');
    checkType('source_data_record.wavenumber_range.max', json.source_data_record.wavenumber_range.max, 'number');
    checkType('source_data_record.wavenumber_spacing', json.source_data_record.wavenumber_spacing, 'number');
    checkType('source_data_record.number_of_data_points', json.source_data_record.number_of_data_points, 'number');
    checkType('source_data_record.file_hash', json.source_data_record.file_hash, 'string');
    if (json.source_data_record.spectrum_hash !== undefined && !/^[a-f0-9]{64}$/.test(json.source_data_record.spectrum_hash)) {
      throw new Error('Invalid selected-spectrum hash.');
    }

    // processing_steps
    checkType('processing_steps', json.processing_steps, 'array');
    if (json.processing_steps.length !== 4) {
      throw new Error(`Validation Error: 'processing_steps' must contain exactly 4 steps.`);
    }

    // Step 0: Cosmic Ray
    const step0 = json.processing_steps[0];
    checkType('processing_steps[0].step_number', step0.step_number, 'number');
    checkType('processing_steps[0].step_name', step0.step_name, 'string');
    checkType('processing_steps[0].applied', step0.applied, 'boolean');
    if (step0.applied) {
      checkType('processing_steps[0].parameters', step0.parameters, 'object');
      checkType('processing_steps[0].parameters.algorithm', step0.parameters.algorithm, 'string');
      checkType('processing_steps[0].parameters.threshold', step0.parameters.threshold, 'number', true);
    }

    // Step 1: Baseline
    const step1 = json.processing_steps[1];
    checkType('processing_steps[1].step_number', step1.step_number, 'number');
    checkType('processing_steps[1].step_name', step1.step_name, 'string');
    checkType('processing_steps[1].applied', step1.applied, 'boolean');
    if (step1.applied) {
      checkType('processing_steps[1].parameters', step1.parameters, 'object');
      checkType('processing_steps[1].parameters.algorithm', step1.parameters.algorithm, 'string');
      checkType('processing_steps[1].parameters.iterations', step1.parameters.iterations, 'number', true);
      checkType('processing_steps[1].parameters.mode', step1.parameters.mode, 'string', true);
      const p = step1.parameters;
      if (p.anchors !== undefined && (!Array.isArray(p.anchors) || p.anchors.some((a: any) => !a || !Number.isFinite(a.x) || !Number.isFinite(a.y)))) throw new Error('Invalid manual baseline anchors.');
      if (p.smoothing !== undefined && (p.smoothing.algorithm !== 'moving_average' || p.smoothing.window !== 9)) throw new Error('Unsupported smoothing settings.');
      if (p.clip_negative_corrected !== undefined && p.clip_negative_corrected !== true) throw new Error('Unsupported corrected-intensity clipping setting.');
    }

    // Step 2: Normalization
    const step2 = json.processing_steps[2];
    checkType('processing_steps[2].step_number', step2.step_number, 'number');
    checkType('processing_steps[2].step_name', step2.step_name, 'string');
    checkType('processing_steps[2].applied', step2.applied, 'boolean');
    if (step2.applied) {
      checkType('processing_steps[2].parameters', step2.parameters, 'object');
      checkType('processing_steps[2].parameters.method', step2.parameters.method, 'string');
      checkType('processing_steps[2].parameters.reference_wavenumber', step2.parameters.reference_wavenumber, 'number', true);
    }

    // Step 3: Peak Detection
    const step3 = json.processing_steps[3];
    checkType('processing_steps[3].step_number', step3.step_number, 'number');
    checkType('processing_steps[3].step_name', step3.step_name, 'string');
    checkType('processing_steps[3].applied', step3.applied, 'boolean');
    if (step3.applied) {
      checkType('processing_steps[3].parameters', step3.parameters, 'object');
      checkType('processing_steps[3].parameters.method', step3.parameters.method, 'string');
      checkType('processing_steps[3].parameters.minimum_height_threshold', step3.parameters.minimum_height_threshold, 'number', true);
    }

    // fitting_record
    checkType('fitting_record', json.fitting_record, 'array', true);
    if (json.fitting_record) {
      json.fitting_record.forEach((fr: any, i: number) => {
        const path = `fitting_record[${i}]`;
        checkType(`${path}.peak_id`, fr.peak_id, 'number');
        checkType(`${path}.nominal_center`, fr.nominal_center, 'number');
        checkType(`${path}.boundary_left`, fr.boundary_left, 'number');
        checkType(`${path}.boundary_right`, fr.boundary_right, 'number');
        checkType(`${path}.best_fit_model`, fr.best_fit_model, 'string', true);
      });
    }

    // integration_record
    checkType('integration_record', json.integration_record, 'array', true);

    checkType('reproducibility_guarantee', json.reproducibility_guarantee, 'string');

    return json as InstantRamanProtocol;
  }

  /**
   * Computes SHA-256 hash of an ArrayBuffer
   */
  static async computeHash(buffer: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
