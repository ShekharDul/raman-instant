import { UniversalParser } from './universalParser.ts';
import { ProtocolManager } from '../engine/protocol.ts';
import { checkFile } from '../security/limits.ts';

self.onmessage = async ({ data }) => {
  try {
    let result: unknown;
    if (data.operation === 'inspect') result = await UniversalParser.inspectFile(data.file);
    else if (data.operation === 'csv') result = UniversalParser.readCSV(data.text, data.delimiter);
    else if (data.operation === 'import') result = UniversalParser.importTable(data.document, data.table, data.options);
    else if (data.operation === 'protocol') {
      checkFile(data.file);
      result = ProtocolManager.validateSchema(JSON.parse(await data.file.text()));
    } else throw new Error('Unknown import operation.');
    self.postMessage({ result });
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'Import failed.' }); }
};
