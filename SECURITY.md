# Spectral import security

Imports and analysis run locally in the browser. There is no server upload or
execution endpoint in this application. A file hash identifies data; it does not
authenticate a file's author or establish that a protocol is safe.

## Enforced import limits

- Data file: 10 MiB; protocol: 1 MiB; filename: 255 characters.
- Pending imports: 20 files / 40 MiB, including queued batches.
- CSV/workbook: 50,000 rows, 64 columns, 500,000 total cells; 4,096 characters per cell.
- Workbook: 16 sheets, 256 ZIP entries, 32 MiB actual expanded data.
- Selected data: 25,000 rows per spectrum, 16 spectra per import.
- Session: 40 spectra / 200,000 points. Remove spectra to make room.
- Each parsing/selection/protocol job: a disposable worker with a 15-second deadline.
- Protocol: supported algorithms only, bounded finite numbers, at most 50 SNIP
  iterations, 256 manual anchors, 12 fitted components, and 100 integration records.

These limits are centralized in `src/security/limits.ts`. Exceeding a limit rejects
the operation with an error; the app does not silently truncate oversized files.
Select a smaller data range or export a smaller table when an import is rejected.

## Trust boundaries

- Input extensions are allowlisted. XLS and XLSX signatures/structures are checked;
  renaming HTML/XML/text to an Excel extension does not enable another parser.
- XLSX archives are streamed through bounded decompression, checking actual output
  against the declared and total allowed sizes. A normalized, uncompressed ZIP is
  passed to SheetJS. Conflicting archive entries, encrypted archives, ZIP64,
  unsafe paths, XML DTDs and custom entities are rejected.
- Parsing, CSV delimiter changes, selected-spectrum conversion and protocol JSON
  validation run in workers. Cancellation, errors and timeouts terminate workers.
  Workers cannot manipulate the page DOM. They are not a hard OS memory sandbox;
  input limits and an updated parser remain essential.
- Spreadsheet formulas are never executed or recalculated. Only stored values are
  used. Macros and HTML cell representations are not loaded for use by the app.
- Imported strings are escaped at HTML and Plotly text boundaries. The import
  preview and source-details dialogs use text nodes. Raw labels remain intact in
  the data model, hashes and exports.
- Protocol validation rejects unexpected properties at every supported object
  level, including inactive processing parameters. Old protocols with unsupported
  extra fields or out-of-range values must be regenerated or corrected.
- Reports serialize embedded JSON safely and escape user text. Their CSP permits
  only the exact generated script hashes and blocks network connections. Reports
  embed Plotly and no longer fetch remote fonts.
- Production pages have a CSP blocking inline event handlers, plugins, forms and
  base URL changes. Plotly is bundled locally. Development uses Vite's normal
  development policy; do not expose the development server publicly.
- Analytics events exclude filenames and protocol identifiers. The site still
  uses Google Analytics and external fonts; this is not a claim of anonymous or
  network-free site operation.

## Dependencies and verification

SheetJS 0.20.3 is pinned to the official distribution URL with lockfile integrity.
The old npm-registry release 0.18.5 must not be restored. See the official
[installation documentation](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/).
Use `npm ci` to reproduce the locked dependency tree.

- `npm test`: parser, numerical workflow and malicious-input regression tests.
- `npm run build`: type checks and production output, including CSP and workers.
- `npm run test:browser`: browser checks against that production build. Windows
  uses installed Chrome; on Linux install Chromium with `npx playwright install chromium`.
- `npm audit`: dependency advisories. The deployment workflow runs tests, audit,
  build and browser checks before publishing.

The limits reduce resource abuse; they do not make arbitrarily hostile input
provably safe. Numerical analysis and plotting still run on the main thread and
can be expensive near the session limits. Keep browsers and dependencies updated.
