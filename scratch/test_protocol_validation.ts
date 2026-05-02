
import { ProtocolManager } from '../src/engine/protocol.ts';

const validProtocol = {
  protocol_metadata: {
    instant_raman_version: "2.1.0",
    protocol_version: "1.0.0",
    protocol_id: "550e8400-e29b-41d4-a716-446655440000",
    created_at: new Date().toISOString(),
    created_by: "Test Bot"
  },
  source_data_record: {
    original_filename: "test.csv",
    file_format_detected: "CSV",
    wavenumber_range: { min: 100, max: 3000 },
    wavenumber_spacing: 1.0,
    number_of_data_points: 2901,
    file_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  },
  processing_steps: [
    { step_number: 0, step_name: "Cosmic Ray", applied: false, parameters: null },
    { step_number: 1, step_name: "Baseline", applied: true, parameters: { algorithm: "SNIP", iterations: 25, mode: "auto" } },
    { step_number: 2, step_name: "Normalization", applied: false, parameters: null },
    { step_number: 3, step_name: "Peak Detection", applied: false, parameters: null }
  ],
  fitting_record: [],
  integration_record: [],
  reproducibility_guarantee: "Strictly deterministic."
};

console.log("--- TEST 1: Missing file_hash ---");
const malformed1 = JSON.parse(JSON.stringify(validProtocol));
delete malformed1.source_data_record.file_hash;
try {
  ProtocolManager.validateSchema(malformed1);
} catch (e) {
  console.log("REJECTED:", e.message);
}

console.log("\n--- TEST 2: Incorrect data type (iterations as string) ---");
const malformed2 = JSON.parse(JSON.stringify(validProtocol));
malformed2.processing_steps[1].parameters.iterations = "sixty four";
try {
  ProtocolManager.validateSchema(malformed2);
} catch (e) {
  console.log("REJECTED:", e.message);
}
