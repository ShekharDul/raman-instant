import { validateProtocol } from '../security/protocolSchema.ts';
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
    validateProtocol(json);

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
