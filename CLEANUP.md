# Product scope cleanup — 9 September 2026

## Purpose

Focus the codebase on processing spectra, plotting, comparing datasets, and saving analysis settings for research-group workflows. This cleanup does not implement the future AI agent or shared group storage.

## Deleted files (16)

- `src/components/AnalysisSuite.tsx`: advanced scientific-audit workspace, ensemble results, and propagation UI.
- `src/components/DiagnosticBrain.tsx`: 3D diagnostic network.
- `src/components/DiagnosticBrain.css`: diagnostic network styling.
- `src/components/DiagnosticDashboard.tsx`: diagnostic/propagation dashboard.
- `src/components/UncertaintyVisualizer.tsx`: model/window uncertainty visualization.
- `src/components/UncertaintyLandscape.tsx`: interactive uncertainty landscape.
- `src/components/QualityBadge.tsx`: unused scientific-quality badge component.
- `src/engine/diagnostics.ts`: bimodality, clustering, approximate dip-test values, and diagnostic heuristics.
- `src/engine/propagation.ts`: Monte Carlo ratios, general propagation, and threshold probabilities.
- `src/engine/landscapeWorker.ts`: uncertainty landscape worker.
- `src/engine/license.ts`: unused client license validation and cached Pro state.
- `src/engine/validation/validation_suite.ts`: tests for the removed ensemble/diagnostic features.
- `server/license-worker.js`: unused license-validation service source.
- `server/index.js`: unused Express Excel-export server; the active browser Excel export remains.
- `run_validation.ts`: entry point for the removed diagnostic test suite.
- `synthetic_validation.ts`: synthetic boundary-perturbation validation script.

Deleting local service source does not disable an already deployed external service.

## Removed from retained files

- `src/engine/fitting.ts`: model-ensemble result types, boundary-perturbation evaluation, degeneracy classification, and residual-to-material diagnostic logic. Basic LM fitting and covariance-based parameter errors remain.
- `src/main.ts`: React mounts for the advanced suite, ensemble/Monte Carlo/Pro state, advanced interpretation text, and uncertainty snapshot collection. Replaced the suite with ordinary fit and residual plots.
- `src/ui/charts.ts`: uncertainty panels, ensemble histograms, Monte Carlo distributions, bimodality helpers, and perturbed-model overlays.
- `src/ui/reportGenerator.ts` and `reportTemplate.ts`: uncertainty snapshot schema, advanced/legacy audit layouts, ensemble/propagation plots, associated styles, and obsolete uncertainty reference text. Ordinary plots, tables, fit reports, and comparisons remain.
- `src/engine/protocol.ts`: advanced ensemble and epistemic result types. Older protocol files can still contain extra fields, but those fields no longer trigger advanced analysis.
- `src/styles/index.css`: suite and landscape selectors and animation rules.
- `index.html`: unsupported bootstrap feature claim and uncertainty metadata wording. Preserved the user's existing changes.
- `README.md`: advanced diagnostic feature descriptions, bootstrap and exact-reproduction guarantees, and prescribed publication text that did not match the implementation. Replaced with current scope and limitations.

## Removed direct dependencies (9)

`@react-three/drei`, `@react-three/fiber`, `@types/three`, `three`, `framer-motion`, `lucide-react`, `clsx`, `tailwind-merge`, `plotly.js-dist-min`.

Updated the lockfile to prune their unused dependency tree. React remains for the existing landing page. The Cartesian Plotly dependency remains for standalone reports; the workstation still uses its existing CDN Plotly script.

## Preserved

File import and parsing, multi-file processing, cosmic-ray filtering, baseline correction, smoothing, normalization, calibration checks, peak detection/integration, basic fitting, direct peak ratios, replicate averaging, comparison layouts, custom annotations, figure styling, PNG/SVG exports, browser Excel exports, snapshot reports, protocol import/export, and the analysis timeline. Existing spectral samples and legacy protocol fixtures remain.

The user's prior `src/landing.tsx` changes were not edited or reverted.

## Supporting repairs

- Basic-fit protocols now export all fitted components and pseudo-Voigt shape values and rerun the saved basic model instead of calling the removed ensemble engine.
- Protocol application now rejects a mismatched active source file even when no matching source is loaded.
- A protocol without saved fits no longer claims a zero-deviation numerical verification.
- Fit snapshots retain a residual trace for report generation.
- Corrected ordinary two-column CSV detection and excluded numeric metadata headers from spectral rows; regression tests cover these cases.
- Corrected the expansion of SNIP and removed an unsupported verification statement from generated captions.

## Validation

- `npm run build`: passed (TypeScript and production bundling).
- `node scratch/core_workflow.test.ts`: passed; three model fits, deterministic repeat fits, CSV/header parsing, legacy protocol acceptance and invalid-schema rejection, and syntax checks of embedded report scripts.
- `node scratch/parser_validation.ts`: 4/4 passed.
- `node scratch/test_protocol_validation.ts`: missing hash and invalid parameter type rejected as expected.
- Browser smoke test: landing navigation, bundled sample import, processed plot, ROI selection, and the simplified fit/residual view succeeded. The selected sample region produced three fitted components with R² 0.9879; this is a functional smoke test, not scientific validation.

Exports were checked through code and embedded-script syntax tests; a complete interactive export/import round trip was not tested. Vite still reports its large-bundle warning, principally requiring future export-library loading work.

## Remaining scope limits

The app is still a manual workstation. Natural-language commands, shared methods, group accounts, and durable group storage remain future work. Protocols still require the original source file and do not preserve every session/plot setting or manual baseline anchors. Re-fitting is a fresh numerical computation; no byte-for-byte reproduction guarantee is made. Legacy advanced diagnostics are no longer reproduced.
