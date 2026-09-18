import { LIMITS } from './limits.ts';

type Check = (v: any, path: string) => void;
const invalid = (p: string): never => { throw new Error(`Invalid protocol field: ${p}.`); };
const optional = (check: Check): Check => (v, p) => { if (v !== undefined) check(v, p); };
const nullable = (check: Check): Check => (v, p) => { if (v !== null) check(v, p); };
const number = (min = -1e100, max = 1e100, integer = false): Check => (v, p) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) invalid(p);
};
const text = (max = 4096, pattern?: RegExp): Check => (v, p) => {
  if (typeof v !== 'string' || v.length > max || (pattern && !pattern.test(v))) invalid(p);
};
const bool: Check = (v, p) => { if (typeof v !== 'boolean') invalid(p); };
const choices = (...values: unknown[]): Check => (v, p) => { if (!values.includes(v)) invalid(p); };
const array = (check: Check, max: number): Check => (v, p) => {
  if (!Array.isArray(v) || v.length > max) invalid(p);
  v.forEach((item: unknown, i: number) => check(item, `${p}[${i}]`));
};
const object = (fields: Record<string, Check>): Check => (v, p) => {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.getPrototypeOf(v) !== Object.prototype) invalid(p);
  for (const key of Object.keys(v)) if (!Object.hasOwn(fields, key)) invalid(`${p}.${key}`);
  for (const [key, check] of Object.entries(fields)) check(v[key], `${p}.${key}`);
};
const coordinate = number(-1e7, 1e7);
const count = number(0, LIMITS.points, true);
const hash = text(64, /^[a-f0-9]{64}$/);
const maybeNumber = optional(nullable(number()));
const settings = object({
  headerRow: number(-1, LIMITS.rows - 1, true), startRow: number(0, LIMITS.rows - 1, true), endRow: number(1, LIMITS.rows, true),
  xColumn: number(0, LIMITS.columns - 1, true), yColumn: number(0, LIMITS.columns - 1, true),
  unit: choices('shift', 'nm'), decimal: choices('.', ','), laserWavelength: nullable(number(0.000001, 1e7)),
  duplicates: choices('keep', 'mean', 'error'), delimiter: choices(',', ';', '\t', '|', null),
});
const metadata = object({
  format: choices('CSV', 'XLSX', 'XLS'), fileName: text(255), pointCount: count,
  laserWavelength: optional(number(0.000001, 1e7)), sheetName: optional(text()), seriesName: optional(text()),
  importSettings: optional(settings), importWarnings: optional(array(text(8192), 100)),
});
const parameters: Check[] = [
  object({ algorithm: choices('MAD_zscore'), threshold: nullable(number(0, 100)),
    spikes_detected: optional(nullable(count)), spikes_removed: optional(nullable(count)), spike_positions: optional(nullable(array(coordinate, LIMITS.points))) }),
  object({ algorithm: choices('SNIP', 'linear_anchor_interpolation'), iterations: nullable(number(1, LIMITS.iterations, true)), mode: choices('manual', 'auto', null),
    anchors: optional(array(object({ x: coordinate, y: number() }), LIMITS.anchors)),
    smoothing: optional(object({ algorithm: choices('moving_average'), window: choices(9) })), clip_negative_corrected: optional(choices(true)) }),
  object({ method: choices('max_intensity', 'total_area', 'reference_peak', 'none'), reference_wavenumber: nullable(coordinate) }),
  object({ method: choices('parabolic_interpolation'), minimum_height_threshold: nullable(number(0, 100)),
    minimum_separation: optional(nullable(number(0, 1e7))), peaks_detected: optional(nullable(count)), peak_positions: optional(nullable(array(coordinate, LIMITS.points))) }),
];
const fitting = object({
  peak_id: number(0, LIMITS.points, true), nominal_center: coordinate, boundary_left: coordinate, boundary_right: coordinate,
  best_fit_model: choices('lorentzian', 'gaussian', 'voigt', null), fitted_center: optional(nullable(coordinate)),
  fitted_center_statistical_error: optional(nullable(number(0))), fitted_fwhm: optional(nullable(number(0.000001, 1e7))),
  fitted_amplitude: maybeNumber, fitted_shape: optional(nullable(number(0, 1))), r_squared: maybeNumber,
  reduced_chi_squared: optional(nullable(number(0))), convergence_status: optional(choices('converged', 'failed', null)),
});
const integration = object({
  peak_id: number(0, LIMITS.points, true), boundary_left: coordinate, boundary_right: coordinate,
  local_baseline_left_intensity: number(), local_baseline_right_intensity: number(),
  integration_method: choices('simpsons', 'trapezoidal_fallback', null), integrated_area: nullable(number()), units: nullable(text(128)),
});
const schema = object({
  protocol_metadata: object({
    instant_raman_version: text(32, /^v?\d+\.\d+\.\d+$/), protocol_version: choices('1.0.0', '1.1.0'),
    protocol_id: text(64, /^(?:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|irp-[a-z0-9]{1,32})$/i),
    created_at: (v, p) => { text(64)(v, p); if (!Number.isFinite(Date.parse(v))) invalid(p); }, created_by: text(255),
  }),
  source_data_record: object({
    original_filename: text(255), file_format_detected: choices('CSV', 'XLSX', 'XLS'),
    wavenumber_range: object({ min: coordinate, max: coordinate }), wavenumber_spacing: number(0, 2e7),
    number_of_data_points: number(3, LIMITS.points, true), file_hash: hash, spectrum_hash: optional(hash), import_metadata: optional(metadata),
  }),
  processing_steps: (v, p) => {
    if (!Array.isArray(v) || v.length !== 4) invalid(p);
    v.forEach((step: any, i: number) => {
      object({ step_number: choices(i), step_name: text(128), applied: bool, parameters: nullable(parameters[i]) })(step, `${p}[${i}]`);
      if (step.applied && step.parameters === null) invalid(`${p}[${i}].parameters`);
    });
  },
  fitting_record: nullable(array(fitting, LIMITS.fitPeaks)), integration_record: nullable(array(integration, 100)), reproducibility_guarantee: text(),
});

export function validateProtocol(value: unknown): void {
  schema(value, 'protocol');
  const v = value as any, source = v.source_data_record;
  if (source.wavenumber_range.min >= source.wavenumber_range.max) invalid('wavenumber_range');
  const baseline = v.processing_steps[1].parameters;
  if (baseline) {
    if (baseline.algorithm === 'SNIP' && (baseline.mode === 'manual' || baseline.iterations === null)) invalid('baseline iterations/mode');
    if (baseline.algorithm === 'linear_anchor_interpolation' && baseline.mode !== 'manual') invalid('baseline mode');
  }
  const norm = v.processing_steps[2];
  if (norm.applied && norm.parameters.method === 'reference_peak' && norm.parameters.reference_wavenumber === null) invalid('reference_wavenumber');
  for (const record of [...(v.fitting_record ?? []), ...(v.integration_record ?? [])]) if (record.boundary_left >= record.boundary_right) invalid('record boundaries');
  if (v.fitting_record?.some((r: any) => r.best_fit_model !== v.fitting_record[0].best_fit_model)) invalid('mixed fitting models');
  const s = source.import_metadata?.importSettings;
  if (s && (s.startRow >= s.endRow || s.headerRow >= s.startRow || s.xColumn === s.yColumn)) invalid('importSettings');
}
