import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FittingEngine } from '../src/engine/fitting.ts';
import { UniversalParser } from '../src/parsers/universalParser.ts';
import { ProtocolManager } from '../src/engine/protocol.ts';
import { SpectralProcessor } from '../src/engine/processor.ts';
import { REPORT_TEMPLATE } from '../src/ui/reportTemplate.ts';

const x = Array.from({length:201},(_,i)=>900+i);
for (const model of ['lorentzian','gaussian','voigt'] as const) {
  const y = x.map(v => model === 'voigt' ? FittingEngine.voigt(v,100,1000,20,0.4) : FittingEngine[model](v,100,1000,20));
  const initial = model === 'voigt' ? [90,999,18,0.5] : [90,999,18];
  const fit = FittingEngine.fit(x,y,initial,model);
  assert.equal(fit.convergence_status,'converged');
  assert.ok(Math.abs(fit.peaks[0].center.value! - 1000) < 0.1, model);
  assert.ok(fit.r2! > 0.99, model);
  assert.equal(fit.residuals.length,x.length);
  const replay = FittingEngine.fit(x,y,initial,model);
  assert.deepEqual(replay.fitY,fit.fitY);
}
const parsed = UniversalParser.parseText('100,10\n200,20\n300,15\n','test.csv',785,'shift');
assert.deepEqual(parsed.wavenumberData,[100,200,300]);
assert.deepEqual(parsed.intensityData,[10,20,15]);
const withHeader = UniversalParser.parseText('Laser: 785 nm at 50 mW\n100,10\n200,20\n300,15\n','header.csv',785,'shift');
assert.deepEqual(withHeader.wavenumberData,[100,200,300]);
const protocol = JSON.parse(readFileSync('valid.irp','utf8'));
ProtocolManager.validateSchema(protocol);
// A workbook hash alone cannot distinguish even numerically identical columns or worksheets.
const document = await UniversalParser.inspectFile(new File(['Wavenumber,Intensity A,Intensity B\n500,10,10\n501,20,20\n502,30,30'], 'shared.csv'));
const table = document.tables[0];
const options = UniversalParser.suggest(table);
const spectra = UniversalParser.importTable(document,table,options).spectra;
const sourceHash = 'a'.repeat(64);
const selectedSource = { ...protocol.source_data_record, file_hash: sourceHash, spectrum_hash: await ProtocolManager.spectrumHash(spectra[0]) };
const first = { raw:spectra[0], fileHash:sourceHash };
const second = { raw:spectra[1], fileHash:sourceHash };
const otherSheet = { raw:{...spectra[0],metadata:{...spectra[0].metadata,sheetName:'Other sheet'}},fileHash:sourceHash };
assert.deepEqual(await ProtocolManager.matchingSpectra(selectedSource,[second,otherSheet,first]),[first]);
assert.deepEqual(await ProtocolManager.matchingSpectra(selectedSource,[second,otherSheet]),[]);
assert.deepEqual(await ProtocolManager.matchingSpectra({...selectedSource,spectrum_hash:undefined},[first]),[]);
assert.deepEqual(await ProtocolManager.matchingSpectra(selectedSource,[{...first,fileHash:'b'.repeat(64)}]),[]);
assert.equal(await ProtocolManager.spectrumHash(JSON.parse(JSON.stringify(spectra[0]))),selectedSource.spectrum_hash);
assert.equal(spectra[0].metadata.importSettings?.yColumn,1);
assert.equal(spectra[1].metadata.importSettings?.yColumn,2);
const saved = structuredClone(protocol);
saved.source_data_record = {...selectedSource,import_metadata:spectra[0].metadata};
saved.processing_steps[1].parameters = {algorithm:'linear_anchor_interpolation',mode:'manual',iterations:null,anchors:[{x:500,y:1},{x:502,y:3}],smoothing:{algorithm:'moving_average',window:9},clip_negative_corrected:true};
const roundTrip = ProtocolManager.validateSchema(JSON.parse(JSON.stringify(saved)));
assert.deepEqual(roundTrip.processing_steps[1].parameters?.anchors,[{x:500,y:1},{x:502,y:3}]);
saved.processing_steps[1].parameters.smoothing.window=11;
assert.throws(()=>ProtocolManager.validateSchema(saved),/smoothing/);
const moving = SpectralProcessor.movingAverage({wavenumberData:[0,1,2,3,4],intensityData:[0,0,9,0,0]},3);
assert.deepEqual(moving.intensityData,[0,3,3,3,0]);
assert.throws(()=>ProtocolManager.validateSchema({}));
// HTML report scripts are embedded strings: TypeScript cannot check their syntax.
for (const match of REPORT_TEMPLATE.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
  if (!match[0].includes('application/json')) new Function(match[1]);
}
assert.ok(!REPORT_TEMPLATE.includes('uncertaintyData'));
console.log('PASS: fit models, deterministic fits, CSV parsing, protocol spectrum/worksheet/column identity, legacy fail-closed matching, saved manual anchors, moving-average smoothing, report JavaScript syntax.');
