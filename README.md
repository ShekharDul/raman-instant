# Instant Raman

A browser workstation for processing Raman spectra, creating consistent figures, and sharing analysis settings within a research group.

## Current scope

- Import spectral files and process multiple datasets.
- Cosmic-ray filtering, SNIP or manual baseline correction, smoothing, and normalization.
- Peak detection, integration, basic Gaussian/Lorentzian/pseudo-Voigt fitting, and residual plots.
- Overlay, stacked, grid, and replicate comparisons; labels and figure styling.
- PNG/SVG figures, Excel data, and standalone HTML snapshot reports.
- Export/import analysis settings as .irp protocols linked to the source file by SHA-256.

## Product direction

The next product layer is a natural-language assistant that creates explicit, reviewable processing and plotting workflows. Saved operations should run independently of the conversation. The current app does not yet implement an AI agent, group accounts, shared method storage, or a complete portable session format.

## Reproduction limits

Keep the original data file with its .irp protocol. Protocols do not embed raw data or every plot setting. Legacy advanced-analysis fields may be present in older files; the app no longer runs model-ensemble diagnostics or Monte Carlo propagation. Basic fitting uses the saved model, region, and peak estimates. Re-fitting is a new numerical calculation, not a byte-for-byte guarantee. Manual baseline anchors are not stored by the legacy protocol format.

## Development

Run npm install, then npm run dev. Run npm run build for the production build. The app uses TypeScript, React for the landing page, Vite, Plotly, SheetJS, and numerical fitting libraries. Processing and exports run in the browser; plots currently load Plotly from a CDN.

## License and author

MIT. Created by Shekhar Dulgach.
