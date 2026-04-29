/**
 * Instant Raman — Report Template
 * Self-contained HTML structure with embedded Plotly Cartesian and Paper-White styling.
 */
// @ts-ignore
import plotlyCartesian from 'plotly.js-cartesian-dist-min/plotly-cartesian.min.js?raw';

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

        /* Metadata Panel */
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
        }

        #plot-container {
            width: 100%;
            height: 600px;
            border: 1px solid var(--border);
            margin-bottom: 32px;
            background: #fff;
        }

        .peak-section h2 {
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

        <section class="peak-section">
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

        <footer>
            <a href="https://raman-instant.github.io/" class="branding-link">
                Generated by <span>INSTANT RAMAN</span> — Automated Spectral Processing
            </a>
        </footer>
    </div>

    <script id="plotly-js">
        \${plotlyCartesian}
    </script>

    <script id="raman-data" type="application/json">
        /* DATA_INJECTION_POINT */
    </script>

    <script id="bootstrapper">
        (function() {
            const dataEl = document.getElementById('raman-data');
            const data = JSON.parse(dataEl.textContent);
            
            // Set Date
            document.getElementById('report-date').textContent = new Date(data.timestamp).toLocaleString();

            // Populate Metadata
            const metaPanel = document.getElementById('metadata-panel');
            const metaItems = [
                { label: 'Files', value: data.filenames.join(', ') },
                { label: 'SNIP Iterations', value: data.settings.snip },
                { label: 'Normalization', value: data.settings.norm.toUpperCase() },
                { label: 'Total Peaks', value: data.totalPeaks }
            ];

            metaPanel.innerHTML = metaItems.map(item => \`
                <div class="meta-item">
                    <label>\${item.label}</label>
                    <span>\${item.value}</span>
                </div>
            \`).join('');

            // Populate Table
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

            // Render Plot
            const traces = data.files.map((f, i) => ({
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
                xaxis: { 
                    title: 'Raman Shift (cm⁻¹)', 
                    linecolor: '#0f172a', 
                    linewidth: 2, 
                    mirror: true,
                    ticks: 'outside',
                    gridcolor: '#f1f5f9'
                },
                yaxis: { 
                    title: 'Intensity (a.u.)', 
                    linecolor: '#0f172a', 
                    linewidth: 2, 
                    mirror: true,
                    ticks: 'outside',
                    gridcolor: '#f1f5f9'
                },
                legend: { x: 1.02, y: 1 },
                hovermode: 'x unified'
            };

            Plotly.newPlot('plot-container', traces, layout, { responsive: true, displaylogo: false });
        })();
    </script>
</body>
</html>
\`;
