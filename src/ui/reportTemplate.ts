export const REPORT_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Instant Raman — Analysis Portfolio</title>
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
            margin-bottom: 48px;
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

        .session-summary {
            background: #f8fafc;
            border: 1px solid var(--border);
            padding: 24px;
            margin-bottom: 64px;
            border-radius: 4px;
        }

        .session-summary h2 {
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: var(--text-muted);
            margin-bottom: 16px;
        }

        .snapshot-block {
            margin-bottom: 120px;
            border-top: 1px solid var(--border);
            padding-top: 48px;
        }

        .snapshot-header {
            margin-bottom: 32px;
        }

        .snapshot-title {
            font-size: 24px;
            font-weight: 700;
            color: var(--text-main);
            margin-bottom: 8px;
        }

        .snapshot-meta {
            font-family: var(--font-mono);
            font-size: 10px;
            color: var(--text-muted);
            text-transform: uppercase;
            display: flex;
            gap: 16px;
        }

        .plot-container {
            width: 100%;
            height: 600px;
            border: 1px solid var(--border);
            margin-bottom: 24px;
            background: #fff;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin-bottom: 24px;
        }

        th {
            text-align: left;
            padding: 12px;
            border-bottom: 2px solid var(--text-main);
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        td {
            padding: 12px;
            border-bottom: 1px solid var(--border);
            font-family: var(--font-mono);
        }

        .settings-tag {
            display: inline-block;
            background: #f1f5f9;
            padding: 2px 6px;
            border-radius: 2px;
            font-size: 9px;
            margin-right: 8px;
        }

        footer {
            margin-top: 120px;
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
        }

        .branding-link span { color: var(--accent); font-weight: 700; }

        @media print {
            body { padding: 20px; }
            .snapshot-block { page-break-before: always; border-top: none; padding-top: 0; }
            footer { display: none; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="brand">
                <h1>Instant Raman</h1>
                <p>Analysis Portfolio</p>
            </div>
            <div class="report-meta" id="report-date"></div>
        </header>

        <section class="session-summary">
            <h2>Session Overview</h2>
            <div id="session-details" style="font-size: 12px;"></div>
        </section>

        <main id="snapshots-main">
            <!-- Snapshots will be injected here -->
        </main>

        <footer>
            <a href="https://raman-instant.github.io/" class="branding-link">
                Generated by <span>INSTANT RAMAN</span> — Professional Spectral Workstation
            </a>
        </footer>
    </div>

    <script id="plotly-js">
        /* PLOTLY_INJECTION_POINT */
    </script>

    <script id="raman-data" type="application/json">
        /* DATA_INJECTION_POINT */
    </script>

    <script>
        (function() {
            try {
                const data = JSON.parse(document.getElementById('raman-data').textContent);
                document.getElementById('report-date').textContent = new Date(data.timestamp).toLocaleString();

                // 1. Session Summary
                const summary = data.sessionSummary;
                document.getElementById('session-details').innerHTML = \`
                    <p><strong>Total Files:</strong> \${summary.totalFiles}</p>
                    <p><strong>Source Filenames:</strong> \${summary.filenames.join(', ')}</p>
                \`;

                // 2. Render Snapshots
                const main = document.getElementById('snapshots-main');
                data.snapshots.forEach((snap, idx) => {
                    const block = document.createElement('section');
                    block.className = 'snapshot-block';
                    
                    const plotId = \`plot-\${snap.id}\`;
                    
                    block.innerHTML = \`
                        <div class="snapshot-header">
                            <h2 class="snapshot-title">\${snap.title}</h2>
                            <div class="snapshot-meta">
                                <span>TYPE: \${snap.type.toUpperCase()}</span>
                                <span>TIME: \${new Date(snap.timestamp).toLocaleTimeString()}</span>
                                <span>SNIP: \${snap.settings.snip}</span>
                                <span>NORM: \${snap.settings.norm.toUpperCase()}</span>
                            </div>
                        </div>
                        <div id="\${plotId}" class="plot-container"></div>
                        <div class="snapshot-table-wrap">
                            <table id="table-\${snap.id}">
                                <thead id="thead-\${snap.id}"></thead>
                                <tbody id="tbody-\${snap.id}"></tbody>
                            </table>
                        </div>
                    \`;
                    
                    main.appendChild(block);

                    // 3. Render Plot
                    if (typeof Plotly !== 'undefined') {
                        const layout = {
                            ...snap.layout,
                            paper_bgcolor: '#ffffff',
                            plot_bgcolor: '#ffffff',
                            font: { family: 'Inter, sans-serif', color: '#0f172a' },
                            margin: { l: 80, r: 40, t: 40, b: 80 },
                            xaxis: { ...snap.layout.xaxis, linecolor: '#0f172a', linewidth: 2, mirror: true, ticks: 'outside', gridcolor: '#f1f5f9' },
                            yaxis: { ...snap.layout.yaxis, linecolor: '#0f172a', linewidth: 2, mirror: true, ticks: 'outside', gridcolor: '#f1f5f9' },
                            legend: { x: 1.02, y: 1 },
                            hovermode: 'x unified'
                        };
                        
                        // Handle multi-axis for fitting residuals if present
                        if (snap.type === 'fitting') {
                            layout.grid = { rows: 2, columns: 1, pattern: 'independent' };
                            layout.yaxis.domain = [0.3, 1];
                            layout.yaxis2 = { domain: [0, 0.2], title: 'Δ', linecolor: '#0f172a', linewidth: 2, mirror: true, ticks: 'outside' };
                            layout.xaxis.anchor = 'y2';
                            
                            // Check for residual trace
                            const resTrace = snap.traces.find(t => t.name === 'Residual');
                            if (resTrace) resTrace.yaxis = 'y2';
                        }

                        Plotly.newPlot(plotId, snap.traces, layout, { responsive: true, displaylogo: false });
                    }

                    // 4. Render Table
                    const thead = document.getElementById(\`thead-\${snap.id}\`);
                    const tbody = document.getElementById(\`tbody-\${snap.id}\`);
                    
                    if (snap.tableType === 'peaks') {
                        const tableContainer = document.getElementById(\`table-\${snap.id}\`).parentElement;
                        tableContainer.innerHTML = '';
                        snap.tableData.forEach(group => {
                            const groupTitle = document.createElement('div');
                            groupTitle.style.cssText = 'font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); margin: 32px 0 12px; border-left: 3px solid var(--accent); padding-left: 12px;';
                            groupTitle.textContent = group.fileName;
                            const table = document.createElement('table');
                            table.innerHTML = \\\`
                                <thead><tr><th>Center (cm⁻¹)</th><th>Intensity</th><th>FWHM</th><th>Area</th></tr></thead>
                                <tbody>
                                    \\\${group.peaks.length > 0 ? group.peaks.map(p => \\\`
                                        <tr>
                                            <td>\\\${(p.x || 0).toFixed(2)}</td>
                                            <td>\\\${(p.y || 0).toFixed(2)}</td>
                                            <td>\\\${(p.fwhm || 0).toFixed(2)}</td>
                                            <td>\\\${(p.area || 0).toFixed(2)}</td>
                                        </tr>
                                    \\\`).join('') : '<tr><td colspan="4" style="text-align:center; opacity:0.5;">No peaks selected.</td></tr>'}
                                </tbody>
                            \\\`;
                            tableContainer.appendChild(groupTitle);
                            tableContainer.appendChild(table);
                        });
                    } else if (snap.tableType === 'fit') {
                        thead.innerHTML = '<tr><th>Peak #</th><th>Center</th><th>Amplitude</th><th>FWHM</th><th>Shape</th></tr>';
                        tbody.innerHTML = snap.tableData.map((p, i) => \`
                            <tr>
                                <td>\${i + 1}</td>
                                <td>\${(p.center?.value || 0).toFixed(2)}</td>
                                <td>\${(p.amplitude?.value || 0).toFixed(2)}</td>
                                <td>\${(p.fwhm?.value || 0).toFixed(2)}</td>
                                <td>\${p.shape ? (p.shape.value || 0).toFixed(2) : '-'}</td>
                            </tr>
                        \`).join('');
                    } else if (snap.tableType === 'replicate') {
                        thead.innerHTML = '<tr><th>Center</th><th>Mean Area</th><th>SD</th><th>RSD%</th></tr>';
                        tbody.innerHTML = snap.tableData.map(p => \`
                            <tr>
                                <td>\${(p.center || 0).toFixed(2)}</td>
                                <td>\${(p.meanArea || 0).toFixed(2)}</td>
                                <td>\${(p.sdArea || 0).toFixed(2)}</td>
                                <td>\${(p.rsdArea || 0).toFixed(2)}%</td>
                            </tr>
                        \`).join('');
                    }
                });

            } catch (err) {
                console.error('[Instant Raman] Portfolio Error:', err);
            }
        })();
    </script>
</body>
</html>`;
