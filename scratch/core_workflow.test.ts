import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FittingEngine } from '../src/engine/fitting.ts';
import { UniversalParser } from '../src/parsers/universalParser.ts';
import { ProtocolManager } from '../src/engine/protocol.ts';
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
const parsed = UniversalParser.parseText('100,10\n200,20\n300,15\n','test.csv',785);
assert.deepEqual(parsed.wavenumberData,[100,200,300]);
assert.deepEqual(parsed.intensityData,[10,20,15]);
const withHeader = UniversalParser.parseText('Laser: 785 nm at 50 mW\n100,10\n200,20\n300,15\n','header.csv',785);
assert.deepEqual(withHeader.wavenumberData,[100,200,300]);
const protocol = JSON.parse(readFileSync('valid.irp','utf8'));
ProtocolManager.validateSchema(protocol);
assert.throws(()=>ProtocolManager.validateSchema({}));
// HTML report scripts are embedded strings: TypeScript cannot check their syntax.
for (const match of REPORT_TEMPLATE.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
  if (!match[0].includes('application/json')) new Function(match[1]);
}
assert.ok(!REPORT_TEMPLATE.includes('uncertaintyData'));
console.log('PASS: three fit models, deterministic repeat fits, CSV parser, legacy protocol validation, report JavaScript syntax.');
