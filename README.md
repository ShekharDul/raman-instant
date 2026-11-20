# Instant Raman

A browser workstation for processing Raman spectra, creating consistent figures, and sharing analysis settings within a research group.

## Current scope

- Import spectral files and process multiple datasets.
- Cosmic-ray filtering, SNIP or manual baseline correction, adjustable smoothing and negative-value clipping, and normalization.
- Peak detection, integration, basic Gaussian/Lorentzian/pseudo-Voigt fitting, and residual plots.
- Overlay, stacked, grid, and replicate comparisons; labels and figure styling.
- PNG/SVG figures, Excel data, and standalone HTML snapshot reports.
- Export/import analysis settings as .irp protocols linked to the source file by SHA-256.
- Restore the latest workspace from this browser, including imported spectra, fits, and snapshots.

## Product direction

The next product layer is a natural-language assistant that creates explicit, reviewable processing and plotting workflows. Saved operations should run independently of the conversation. The current app does not yet implement an AI agent, group accounts, shared method storage, or a complete portable session format.

## Reproduction limits

Keep the original TXT, CSV, or Excel file with its .irp protocol. Protocols store preprocessing settings and a fit associated with that spectrum. Re-fitting uses the saved model, region, and peak estimates and performs a new numerical calculation. Legacy protocols without a selected-spectrum hash can be reviewed manually. Protocols leave out raw data and plot layout.

Replicate averaging requires identical, strictly increasing Raman-shift grids and the same normalization. The browser autosaves the most recent workspace locally. Use **Clear workspace** to remove the saved data from the browser.

## Development

Run npm ci, then npm run dev. Run npm test and npm run build for validation, then npm run test:browser for production-browser security checks. The app uses TypeScript, React for the landing page, Vite, Plotly, SheetJS, and numerical fitting libraries. Processing and exports run in the browser; Plotly is bundled locally. See [SECURITY.md](SECURITY.md) for enforced import limits and security boundaries.

## License and author

MIT. Created by Shekhar Dulgach.
