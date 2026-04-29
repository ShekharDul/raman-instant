export const REPORT_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Instant Raman — Analytical Report</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        
        :root {
            --bg: #ffffff;
            --text-main: #0f172a;
            --text-muted: #64748b;
            --border: #e2e8f0;
            --accent: #2dd4bf;
            --font-sans: 'Inter', system-ui, sans-serif;
            --font-mono: 'JetBrains Mono', monospace;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            background: var(--bg); 
            color: var(--text-main); 
            font-family: var(--font-sans); 
            line-height: 1.5;
            padding: 40px;
        }

        .container { max-width: 1200px; margin: 0 auto; }

        header {
            border-bottom: 2px solid var(--text-main);
            padding-bottom: 24px;
            margin-bottom: 32px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
        }

        .brand h1 {
            font-size: 14px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.3em;
            margin-bottom: 4px;
        }

        .brand p {
            font-family: var(--font-mono);
            font-size: 10px;
            color: var(--text-muted);
            text-transform: uppercase;
        }

        .report-meta {
            text-align: right;
            font-family: var(--font-mono);
            font-size: 10px;
            color: var(--text-muted);
        }

        .metadata-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 24px;
            background: #f8fafc;
            border: 1px solid var(--border);
            padding: 24px;
            margin-bottom: 32px;
            border-radius: 2px;
        }

        .meta-item {
            min-width: 0; /* Important for grid overflow */
        }

        .meta-item label {
            display: block;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: var(--text-muted);
            margin-bottom: 4px;
        }

        .meta-item span {
            font-family: var(--font-mono);
            font-size: 12px;
            font-weight: 600;
            color: var(--text-main);
            display: block;
            word-break: break-word;
            overflow-wrap: break-word;
        }

        #plot-container, #fit-plot-container, #replicate-plot-container {
            width: 100%;
            height: 600px;
            border: 1px solid var(--border);
            margin-bottom: 32px;
            background: #fff;
        }

        #fit-plot-container, #replicate-plot-container {
            display: none;
            height: 700px;
        }

        .report-section {
            display: none;
            margin-top: 48px;
        }

        .report-section.active {
            display: block;
        }

        .report-section h2 {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin-bottom: 16px;
            color: var(--text-muted);
            border-bottom: 1px solid var(--border);
            padding-bottom: 8px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin-bottom: 40px;
        }

        th {
            text-align: left;
            padding: 12px;
            border-bottom: 2px solid var(--text-main);
            font-size: 10px;
            text-transform: uppercase;
        }

        td {
            padding: 12px;
            border-bottom: 1px solid var(--border);
            font-family: var(--font-mono);
        }

        footer {
            margin-top: 80px;
            padding-top: 24px;
            border-top: 1px solid var(--border);
            text-align: center;
        }

        .branding-link {
            font-family: var(--font-mono);
            font-size: 9px;
            color: var(--text-muted);
            text-decoration: none;
            letter-spacing: 0.1em;
            transition: color 0.2s;
        }

        .branding-link:hover { color: var(--text-main); }
        .branding-link span { color: var(--accent); font-weight: 700; }

        @media print {
            body { padding: 0; }
            footer { display: none; }
            .metadata-grid { background: none; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="brand">
                <h1>Instant Raman</h1>
                <p>Analytical Spectral Report</p>
            </div>
            <div class="report-meta" id="report-date"></div>
        </header>

        <section class="metadata-grid" id="metadata-panel">
            <!-- Injected by Bootstrapper -->
        </section>

        <div id="plot-container"></div>

        <section class="report-section active" id="peak-section">
            <h2>Detected Spectral Features</h2>
            <table id="peak-table">
                <thead>
                    <tr>
                        <th>Center (cm⁻¹)</th>
                        <th>Intensity (a.u.)</th>
                        <th>FWHM (cm⁻¹)</th>
                        <th>Area (counts·cm⁻¹)</th>
                        <th>Source File</th>
                    </tr>
                </thead>
                <tbody id="peak-table-body">
                    <!-- Injected by Bootstrapper -->
                </tbody>
            </table>
        </section>

        <section class="report-section" id="fitting-section">
            <h2>Non-Linear Peak Deconvolution (LM)</h2>
            <div id="fit-plot-container"></div>
            <table id="fit-table">
                <thead>
                    <tr>
                        <th>Peak #</th>
                        <th>Type</th>
                        <th>Center</th>
                        <th>Amplitude</th>
                        <th>FWHM</th>
                        <th>Shape (η)</th>
                    </tr>
                </thead>
                <tbody id="fit-table-body"></tbody>
            </table>
            <div id="fit-stats" style="font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); margin-bottom: 32px;"></div>
        </section>

        <section class="report-section" id="replicate-section">
            <h2>Replicate Group Analysis</h2>
            <div id="replicate-plot-container"></div>
            <table id="replicate-table">
                <thead>
                    <tr>
                        <th>Center</th>
                        <th>Mean Area</th>
                        <th>SD</th>
                        <th>RSD (%)</th>
                    </tr>
                </thead>
                <tbody id="replicate-table-body"></tbody>
            </table>
        </section>

        <footer>
            <a href="https://raman-instant.github.io/" class="branding-link">
                Generated by <span>INSTANT RAMAN</span> — Automated Spectral Processing
            </a>
        </footer>
    </div>

    <script id="plotly-js">
        /* PLOTLY_INJECTION_POINT */
    </script>

    <script id="raman-data" type="application/json">
        /* DATA_INJECTION_POINT */
    </script>
    <script id="bootstrapper">
        (function() {
            const dataEl = document.getElementById('raman-data');
            if (!dataEl) return;
            const data = JSON.parse(dataEl.textContent);
            
            document.getElementById('report-date').textContent = new Date(data.timestamp).toLocaleString();

            // 1. Metadata Panel
            const metaPanel = document.getElementById('metadata-panel');
            const metaItems = [
                { label: 'Files', value: data.filenames.join(', ') },
                { label: 'Baseline', value: (data.settings.baselineMode || 'SNIP').toUpperCase() },
                { label: 'SNIP Iterations', value: data.settings.snip },
                { label: 'Normalization', value: data.settings.norm.toUpperCase() },
                { label: 'Cosmic Ray Removal', value: data.settings.cosmicRayRemoval ? 'ENABLED' : 'DISABLED' },
                { label: 'Total Peaks', value: data.totalPeaks }
            ];

            metaPanel.innerHTML = metaItems.map(item => \`
                <div class="meta-item">
                    <label>\${item.label}</label>
                    <span>\${item.value}</span>
                </div>
            \`).join('');

            // 2. Main Spectral Plot
            const traces = data.files.map((f) => ({
                x: f.x,
                y: f.y,
                mode: 'lines',
                name: f.name,
                line: { width: 2 }
            }));

            const layout = {
                paper_bgcolor: '#ffffff',
                plot_bgcolor: '#ffffff',
                font: { family: 'Inter, sans-serif', color: '#0f172a' },
                margin: { l: 80, r: 40, t: 40, b: 80 },
                xaxis: { title: 'Raman Shift (cm⁻¹)', linecolor: '#0f172a', linewidth: 2, mirror: true, ticks: 'outside', gridcolor: '#f1f5f9' },
                yaxis: { title: 'Intensity (a.u.)', linecolor: '#0f172a', linewidth: 2, mirror: true, ticks: 'outside', gridcolor: '#f1f5f9' },
                legend: { x: 1.02, y: 1 },
                hovermode: 'x unified'
            };

            Plotly.newPlot('plot-container', traces, layout, { responsive: true, displaylogo: false });

            // 3. Peak Table
            const tableBody = document.getElementById('peak-table-body');
            tableBody.innerHTML = data.peaks.map(p => \`
                <tr>
                    <td>\${p.x.toFixed(2)}</td>
                    <td>\${p.y.toFixed(2)}</td>
                    <td>\${p.fwhm.toFixed(2)}</td>
                    <td>\${p.area.toFixed(2)}</td>
                    <td style="font-size: 10px; color: var(--text-muted); font-weight: 500;">\${p.fileName || 'N/A'}</td>
                </tr>
            \`).join('');

            // 4. Fitting Section (Conditional)
            if (data.fitResult) {
                const fitSec = document.getElementById('fitting-section');
                const fitPlot = document.getElementById('fit-plot-container');
                fitSec.classList.add('active');
                fitPlot.style.display = 'block';

                const fr = data.fitResult;
                const fitTraces = [
                    { x: fr.fitX, y: fr.fitX.map((_, i) => fr.fitY[i] + fr.residuals[i]), mode: 'markers', name: 'Experimental', marker: { color: '#94a3b8', size: 4, opacity: 0.5 } },
                    { x: fr.fitX, y: fr.fitY, mode: 'lines', name: 'Cumulative Fit', line: { color: '#0f172a', width: 3 } },
                    { x: fr.fitX, y: fr.residuals, mode: 'lines', name: 'Residual', line: { color: '#be123c', width: 1 }, yaxis: 'y2' }
                ];

                const fitLayout = {
                    ...layout,
                    height: 700,
                    grid: { rows: 2, columns: 1, pattern: 'independent' },
                    yaxis: { ...layout.yaxis, domain: [0.3, 1] },
                    yaxis2: { ...layout.yaxis, domain: [0, 0.2], title: 'Δ' },
                    xaxis: { ...layout.xaxis, anchor: 'y2' }
                };

                Plotly.newPlot('fit-plot-container', fitTraces, fitLayout, { responsive: true, displaylogo: false });

                document.getElementById('fit-table-body').innerHTML = fr.peaks.map((p, i) => \`
                    <tr>
                        <td>\${i + 1}</td>
                        <td>\${p.type.toUpperCase()}</td>
                        <td>\${p.center.value.toFixed(2)}</td>
                        <td>\${p.amplitude.value.toFixed(2)}</td>
                        <td>\${p.fwhm.value.toFixed(2)}</td>
                        <td>\${p.shape ? p.shape.value.toFixed(2) : '-'}</td>
                    </tr>
                \`).join('');

                document.getElementById('fit-stats').innerHTML = \`
                    R²: \${fr.r2.toFixed(4)} | Reduced χ²: \${fr.reducedChi2.toFixed(4)} | Iterations: \${fr.iterations}
                \`;
            }

            // 5. Replicate Section (Conditional)
            if (data.replicateGroup) {
                const repSec = document.getElementById('replicate-section');
                const repPlot = document.getElementById('replicate-plot-container');
                repSec.classList.add('active');
                repPlot.style.display = 'block';

                const rg = data.replicateGroup;
                const repTraces = [
                    { x: rg.wavenumbers, y: rg.mean, mode: 'lines', name: 'Mean Spectrum', line: { color: '#0f172a', width: 2.5 } },
                    { 
                        x: [...rg.wavenumbers, ...[...rg.wavenumbers].reverse()],
                        y: [...rg.mean.map((m, i) => m + rg.sd[i]), ...[...rg.mean.map((m, i) => m - rg.sd[i])].reverse()],
                        fill: 'toself',
                        fillcolor: 'rgba(15, 23, 42, 0.1)',
                        line: { color: 'transparent' },
                        name: 'SD Confidence Interval'
                    }
                ];

                Plotly.newPlot('replicate-plot-container', repTraces, layout, { responsive: true, displaylogo: false });

                document.getElementById('replicate-table-body').innerHTML = rg.peaks.map(p => \`
                    <tr>
                        <td>\${p.center.toFixed(2)}</td>
                        <td>\${p.meanArea.toFixed(2)}</td>
                        <td>\${p.sdArea.toFixed(2)}</td>
                        <td style="color: \${p.rsdArea > 10 ? '#be123c' : 'inherit'}">\${p.rsdArea.toFixed(2)}%</td>
                    </tr>
                \`).join('');
            }
        })();
    </script>
</body>
</html>`;
