import { REPORT_TEMPLATE } from './reportTemplate.ts';
import { scriptJSON } from '../security/text.ts';

/** Build a standalone report with non-recursive substitution and a hash-only
 * script policy. Imported data cannot authorize new scripts or network access. */
export async function buildReportDocument(data: unknown, plotlySource: string): Promise<string> {
  let html = REPORT_TEMPLATE.replace(/\/\* (DATA|PLOTLY)_INJECTION_POINT \*\//g,
    (_, kind) => kind === 'DATA' ? scriptJSON(data) : plotlySource);
  const hashes: string[] = [];
  for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
    if (match[0].includes('type="application/json"')) continue;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(match[1]));
    hashes.push(`'sha256-${btoa(String.fromCharCode(...new Uint8Array(digest)))}'`);
  }
  const policy = `default-src 'none'; script-src ${hashes.join(' ')}; script-src-attr 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
  html = html.replace('<meta charset="UTF-8">', `<meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="${policy}">`);
  return html;
}
