import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { UniversalParser as P } from '../src/parsers/universalParser.ts';

let passed = 0;
async function test(name: string, fn: () => unknown | Promise<unknown>) { await fn(); passed++; console.log(`PASS ${name}`); }
const inspect = (text: string) => P.inspectFile(new File([text], 'sample.csv'));
async function load(text: string) {
  const doc = await inspect(text), table = doc.tables[0], options = P.suggest(table);
  return { doc, table, options };
}
async function parse(text: string) { const { doc, table, options } = await load(text); return P.importTable(doc, table, options); }

await test('unit-spaced shifts and zero/negative intensities survive', async () => {
  const { spectra } = await parse('Raman Shift (cm-1),Intensity\n500,0\n501,-2\n502,10');
  assert.deepEqual(spectra[0].wavenumberData, [500,501,502]);
  assert.deepEqual(spectra[0].intensityData, [0,-2,10]);
});
await test('reordered columns, indices, multiple spectra and metadata', async () => {
  const { spectra } = await parse('Instrument report\nLaser,785\nIndex,Intensity A,Raman Shift,Counts B\n0,10,1200,50\n1,20,1201,60\n2,30,1202,70');
  assert.equal(spectra.length, 2);
  assert.deepEqual(spectra[0].wavenumberData,[1200,1201,1202]);
  assert.deepEqual(spectra[1].intensityData,[50,60,70]);
});
await test('quoted CSV, escaped quotes, multiline notes and CRLF', async () => {
  const { spectra } = await parse('"Raman Shift","Intensity","Notes"\r\n"500","10","a,b"\r\n"502","20","two\r\nlines"\r\n"504","30","a ""quote"""');
  assert.deepEqual(spectra[0].intensityData,[10,20,30]);
});
await test('missing cells keep positions and report skipped rows', async () => {
  const result = await parse('Raman Shift,Intensity,Note\n500,10,90\n501,,99\n502,20,80\n503,30,70\nfooter,,');
  assert.deepEqual(result.spectra[0].wavenumberData,[500,502,503]);
  assert.match(result.warnings.join(),/rows 3, 6/);
});
await test('decimal commas with semicolon delimiter', async () => {
  const result = await parse('Wavenumber;Intensity\n500,25;1200,50\n502,25;1201,50\n504,25;1202,50');
  assert.deepEqual(result.spectra[0].wavenumberData,[500.25,502.25,504.25]);
  assert.equal(result.spectra[0].intensityData[0],1200.5);
  assert.equal(P.detectDelimiter('500,25;1200,50\n502,25;1201,50\n504,25;1202,50'),';');
});
await test('tab, pipe, BOM, scientific notation and sep directive', async () => {
  for (const sep of ['\t','|',',']) {
    const result = await parse('\uFEFFsep='+sep+'\r\n'+['Wavenumber'+sep+'Intensity','1200'+sep+'1e2','1202'+sep+'-2E1','1204'+sep+'0'].join('\n'));
    assert.deepEqual(result.spectra[0].intensityData,[100,-20,0]);
  }
});
await test('explicit wavelength conversion and laser validation', async () => {
  const { doc,table,options } = await load('Wavelength (nm),Intensity\n800,1\n810,2\n820,3');
  options.laserWavelength=532;
  const result=P.importTable(doc,table,options);
  assert.ok(Math.abs(result.spectra[0].wavenumberData[0]-(1/532-1/800)*1e7)<1e-9);
  options.laserWavelength=0;
  assert.throws(()=>P.importTable(doc,table,options),/laser wavelength/);
});
await test('unknown units require a choice', async () => {
  const {doc,table,options}=await load('X,Y\n500,10\n502,20\n504,30');
  assert.equal(options.unit,'');
  assert.throws(()=>P.importTable(doc,table,options),/units/);
  options.unit='shift';
  assert.deepEqual(P.importTable(doc,table,options).spectra[0].wavenumberData,[500,502,504]);
});
await test('duplicates are kept, averaged or rejected explicitly', async () => {
  const {doc,table,options}=await load('Wavenumber,Intensity\n504,30\n500,10\n502,20\n500,14');
  assert.equal(P.importTable(doc,table,options).spectra[0].metadata.pointCount,4);
  options.duplicates='mean';
  assert.deepEqual(P.importTable(doc,table,options).spectra[0].intensityData,[12,20,30]);
  options.duplicates='error'; assert.throws(()=>P.importTable(doc,table,options),/duplicate/);
});
await test('strict numeric validation prevents partial numeric imports', () => {
  for(const value of ['500nm','1,000.5','1.000,5','NaN','Infinity','2026-09-15','',null]) assert.equal(P.number(value,'.'),null);
  assert.throws(()=>P.readCSV('"unclosed',','),/unclosed/);
});
await test('Excel XLSX and XLS sheets, numeric text, formulas, dates and errors', async () => {
  for(const bookType of ['xlsx','xls'] as const) {
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Read me']]),'Notes');
    const ws=XLSX.utils.aoa_to_sheet([['Title'],[],['Intensity','Raman Shift'],[10,500],['20',501],[30,502],[40,503],[50,504],[60,505],[70,506]]);
    ws.A7={t:'n',v:40,f:'20*2'};
    ws.A8={t:'e',v:7};
    ws.A9={t:'d',v:new Date('2026-01-01T00:00:00Z'),z:'yyyy-mm-dd'};
    ws.A10={t:'n',f:'SUM(1,2)'};
    ws['!rows']=[]; ws['!rows'][3]={hidden:true};
    XLSX.utils.book_append_sheet(wb,ws,'Spectra');
    const bytes=XLSX.write(wb,{type:'array',bookType});
    const doc=await P.inspectFile(new File([bytes],`sample.${bookType}`));
    assert.equal(doc.tables.length,2);
    const table=doc.tables[1], options=P.suggest(table);
    const result=P.importTable(doc,table,options);
    assert.deepEqual(result.spectra[0].wavenumberData.slice(0,3),[500,501,502]);
    assert.ok(result.warnings.some(w=>w.includes('hidden')));
    assert.ok(result.warnings.some(w=>w.includes('skipped')));
    assert.ok(!result.spectra[0].wavenumberData.includes(504));
    assert.ok(!result.spectra[0].wavenumberData.includes(505));
    if(bookType==='xlsx') assert.ok(!result.spectra[0].wavenumberData.includes(506));
  }
});
await test('separate tables and explicit row bounds', async () => {
  const {doc,table,options}=await load('Wavenumber,Intensity\n500,1\n501,2\n502,3\nWavenumber,Intensity\n600,4\n601,5\n602,6');
  assert.deepEqual(P.importTable(doc,table,options).spectra[0].wavenumberData,[500,501,502]);
  options.startRow=5; options.endRow=8;
  assert.deepEqual(P.importTable(doc,table,options).spectra[0].wavenumberData,[600,601,602]);
});
await test('unsupported formats and empty files fail clearly', async () => {
  for(const ext of ['txt','dx','jdx','dpt','xml','wdf','wip']) await assert.rejects(()=>P.inspectFile(new File(['500,10'],`file.${ext}`)),/CSV or Excel/);
  const {doc,table,options}=await load(''); options.unit='shift';
  assert.throws(()=>P.importTable(doc,table,options),/data row/);
});
console.log(`${passed} parser test groups passed.`);
