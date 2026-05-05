# Instant Raman — Automated Spectral Rigor & Quantification

<div align="center">
  <h3>🔬 <b>A scientifically defensible workstation for reproducible materials informatics and peak deconvolution.</b></h3>
  <p>
    <a href="https://github.com/ShekharDul/raman-instant/blob/main/LICENSE">
      <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" />
    </a>
    <img src="https://img.shields.io/badge/Vite-v8.0.10-646CFF.svg" alt="Vite Version" />
    <img src="https://img.shields.io/badge/React-v19.2.5-20232A.svg?logo=react" alt="React Version" />
    <img src="https://img.shields.io/badge/TypeScript-v6.0.2-3178C6.svg?logo=typescript" alt="TypeScript Version" />
    <img src="https://img.shields.io/badge/Tailwind--CSS-v4.2.4-06B6D4.svg?logo=tailwindcss" alt="Tailwind CSS Version" />
  </p>
</div>

---

## 🔬 Scientific Context & The "Resolution Gap"

In advanced material science R&D—from solid-state battery (SSB) phase integrity mapping to pharmaceutical polymorph purity—the **Resolution Gap** represents a fundamental analytical bottleneck. Conventional spectral fitting software relies on manual baseline correction and single-peak heuristics, which introduces extreme researcher bias, obscures overlapping vibrational bands, and leads to non-reproducible publication data.

**Instant Raman** solves this by establishing a mathematically rigorous, fully automated, and byte-for-byte reproducible workspace for spectral analysis. By combining parameter-driven baseline correction, multi-model least-squares fitting, and split uncertainty quantification, Instant Raman provides researchers and engineers with journal-ready, audit-ready data in seconds.

---

## ✨ High-Fidelity Core Features

### 1. Adaptive SNIP Baseline Correction & Processing
*   **Objective Subtraction:** Replaces manual "point-and-click" baseline fitting with parameter-driven **Adaptive SNIP (Statistics-sensitive Non-linear Iterative Peak-clipping)** algorithms.
*   **Cosmic Ray Mitigation:** Employs a robust **MAD (Median Absolute Deviation) Z-score** spike filter to isolate and repair instrument artifacts.
*   **Strict Processing Pipeline:** Guarantees standard steps are applied in order: Cosmic Ray Filter $\rightarrow$ SNIP Baseline $\rightarrow$ Area/Max Normalization $\rightarrow$ Peak Detection.

### 2. Multi-Peak Deconvolution Engine
*   **Non-Linear Optimization:** Uses the Levenberg-Marquardt fitting algorithm (`ml-levenberg-marquardt`) to resolve highly overlapping doublets and shoulder bands.
*   **Flexible Line Shapes:** Fit peak clusters using Gaussian, Lorentzian, or Voigt profiles with customizable boundary constraints.
*   **Rigorous Metrics:** Reports $R^2$, reduced $\chi^2$, and parameter correlation matrices to detect ill-conditioned fits.

### 3. "Accuracy-First" Uncertainty Quantification
Isolates spectral noise from model assumptions by splitting uncertainty into two distinct categories:
*   **Statistical Uncertainty:** Determined via bootstrap deconvolution of 500+ noise-perturbed replicates.
*   **Epistemic Uncertainty ($\Delta$):** Quantified by perturbing fitting boundary constraints (e.g. $\pm 5\%, \pm 10\%$ of peak FWHM) to measure how model selections govern output results.
*   **Monte Carlo Propagation:** Propagates parameter errors to derived quantities (like the $I_D / I_G$ ratio for carbon materials) using Monte Carlo sampling, yielding 95% confidence intervals and compliance threshold probabilities.

### 4. Interactive 3D Inference Engine (The "Diagnostic Brain")
*   Built with **React Three Fiber (Three.js)** and scoped vanilla CSS, the Diagnostic Brain is an interactive, beautiful 3D neural network that maps raw mathematical metrics directly to physical material phenomena:
    
    | Raw Metric | 3D Sub-network Audit | Material Science Verdict |
    | :--- | :--- | :--- |
    | **Peak Center Shift** | Lattice Shift Audit | **Lattice Strain & Distortion** |
    | **FWHM Broadening** | Domain Audit | **Crystallinity & Domain Size** |
    | **Epistemic $\Delta$** | Inadequacy Audit | **Model Fitting Ambiguity** |
    | **Bimodality (Sarle's)** | Phase Resolver | **Sub-resolution Phase Integrity** |
    | **Residual Patterns** | Signal Audit | **Lineshape Mismatch / Artifacts** |

*   **Sarle's Bimodality Coefficient & Wald-Wolfowitz Runs:** Computes higher-order statistics (skewness, kurtosis, Wald-Wolfowitz runs test, lag-1 autocorrelation) to mathematically identify phase mixtures and non-random residual patterns.

---

## 💾 Byte-for-Byte Reproducibility Protocol (`.irp`)

Every session is serializable to a rigid **Instant Raman Protocol (`.irp`)** JSON schema containing the original raw data, preprocessing constants, fitting limits, uncertainty profiles, and a SHA-256 cryptographic file hash. Loading an `.irp` file reconstructs the workstation state precisely, ensuring absolute transparency for peer-reviewers and industrial compliance audits.

```json
{
  "protocol_metadata": {
    "instant_raman_version": "2.5.0",
    "protocol_version": "1.0.0",
    "protocol_id": "8b50e2dd-c994-43ef-b387-052637738f61"
  },
  "source_data_record": {
    "original_filename": "anode_active_material.csv",
    "file_hash": "a4f89b9d3c21a41e9871c5b60de321d4..."
  },
  "processing_steps": [
    { "step_name": "Cosmic Ray MAD Filter", "applied": true, "parameters": { "threshold": 3.5 } },
    { "step_name": "SNIP Baseline Correction", "applied": true, "parameters": { "iterations": 25, "mode": "auto" } }
  ]
}
```

---

## 📊 High-Fidelity UI & Publication Export

*   **60/40 Uncertainty Workspace:** Dual-panel layout pairing raw spectra fit-residuals with bootstrap error histograms and convergence status meters.
*   **Interactive Visualizations:** Uses Plotly.js for zoomable, high-density charts mapping individual deconvolution components, residuals, and confidence boundaries.
*   **Journal Exports:** Direct vector `SVG` and 300-DPI high-resolution `PNG` exports for paper figures.
*   **Standalone Report Portfolios:** Export analysis into self-contained HTML reports featuring active plotting, embedded `.irp` metadata, and copy-pasteable experimental methods.

---

## 📝 Pre-Authored Journal Methods Section

When publishing research utilizing Instant Raman, copy and paste the following pre-authored methods section into your manuscript:

> *"Raman spectra were processed and analyzed using the Instant Raman workstation (v2.5). Cosmic ray artifacts were filtered using a Median Absolute Deviation (MAD) Z-score threshold of 3.5. Background subtraction was performed using the Statistics-sensitive Non-linear Iterative Peak-clipping (SNIP) algorithm with 25 iterations. Component deconvolution was carried out via a non-linear Levenberg-Marquardt least-squares optimizer with Lorentzian lineshape profiles. To guarantee scientific defensibility, total uncertainty was isolated into statistical and epistemic channels. Statistical uncertainty was derived from a 500-sample bootstrap deconvolution, and epistemic uncertainty ($\Delta$) was calculated via a $\pm 10\%$ fitting boundary perturbation range. Inter-peak intensity ratios (e.g., $I_D/I_G$) and confidence intervals were propagated using a 1,000-sample Monte Carlo simulation to guarantee 95% analytical confidence."*

---

## 💻 Technical Stack & Workspace Architecture

Instant Raman is built as a lightning-fast, zero-backend workstation running entirely on the client-side:

*   **Framework:** [React 19](https://react.dev/) + [Vite 8](https://vite.dev/) (Module Type)
*   **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) & Vanilla CSS Modules (scoped for component safety)
*   **Animations:** [Framer Motion](https://www.framer.com/motion/) (smooth panel transitions and micro-interactions)
*   **Graphics & 3D:** [Three.js](https://threejs.org/) + [@react-three/fiber](https://r3f.docs.pmnd.ca/) + [Lucide React](https://lucide.dev/)
*   **Plotting Engine:** [Plotly.js-dist-min](https://plotly.com/javascript/)
*   **Numerical Computation:** [ml-levenberg-marquardt](https://github.com/mljs/levenberg-marquardt) + [ml-matrix](https://github.com/mljs/matrix)
*   **File Parser & Export:** [Universal CSV/TXT/XLSX Parser](https://sheetjs.com/)

### 📂 Key Directories
```bash
raman-instant/
├── src/
│   ├── components/      # Workstation suite, 3D Diagnostic Brain, Uncertainty visualizations
│   ├── engine/          # LM fitting, statistical diagnostics, uncertainty propagation, .irp protocol
│   ├── parsers/         # Universal data files parser (CSV, TXT, Excel, IRP)
│   ├── ui/              # Plotly chart configurations, standalone report templates & generators
│   └── main.ts          # Core application mounting logic
├── index.html           # Main Raman workstation workspace
├── landing.html         # Premium, academic-focused introduction landing page
└── docs.html            # Inline documentation, mathematical derivations, and tutorials
```

---

## 🚀 Getting Started

To run the Instant Raman workstation locally:

### 1. Clone the Repository
```bash
git clone https://github.com/ShekharDul/raman-instant.git
cd raman-instant
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser to explore the workstation.

### 4. Build for Production
```bash
npm run build
```
The optimized bundle will be generated in the `dist/` directory, ready to be deployed as a static site (e.g., GitHub Pages).

---

## 👨‍🔬 Authors & Contributors
*   **Shekhar Dulgach** — Lead Materials Scientist & Developer — [GitHub](https://github.com/ShekharDul) | [LinkedIn](https://www.linkedin.com/in/shekhardulgach/) | [Email](mailto:shekhardulgach19@gmail.com)

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
