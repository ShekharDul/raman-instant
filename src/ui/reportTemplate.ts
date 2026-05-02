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
            --text-primary: #0f172a;
            --text-secondary: #475569;
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

        .ratio-summary {
            background: #f0fdfa;
            border: 1px solid #5eead4;
            padding: 24px;
            margin-bottom: 32px;
            border-radius: 4px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
        }

        .ratio-item {
            display: flex;
            flex-direction: column;
        }

        .ratio-label {
            font-size: 10px;
            font-weight: 800;
            color: #0d9488;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin-bottom: 4px;
        }

        .ratio-value {
            font-size: 24px;
            font-weight: 900;
            color: #0f172a;
            font-family: var(--font-mono);
        }

        .unc-report-layout {
            display: grid;
            grid-template-columns: 60% 40%;
            gap: 24px;
            margin-bottom: 32px;
            min-height: 600px;
        }
        .unc-report-left {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        .unc-report-right {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        .unc-report-text {
            background: #f8fafc;
            border: 1px solid var(--border);
            padding: 24px;
            border-radius: 4px;
            font-size: 13px;
            overflow-y: auto;
        }
        .unc-report-plot {
            border: 1px solid var(--border);
            background: #fff;
        }

        @media print {
            body { padding: 20px; }
            .snapshot-block { page-break-before: always; border-top: none; padding-top: 0; }
            .unc-report-layout { grid-template-columns: 1fr; }
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
                if (!data.snapshots || data.snapshots.length === 0) {
                    main.innerHTML = '<div style="padding: 40px; text-align: center; opacity: 0.5;">No analysis snapshots captured. Add analysis blocks to your portfolio to see them here.</div>';
                }
                data.snapshots.forEach((snap) => {
                    const block = document.createElement('section');
                    block.className = 'snapshot-block';
                    
                    const plotId = \`plot-\${snap.id}\`;
                    
                    if (snap.uncertaintyData) {
                        // SPECIAL UNCERTAINTY LAYOUT (60/40)
                        block.innerHTML = \`
                            <div class="snapshot-header">
                                <h2 class="snapshot-title">\${snap.title}</h2>
                                <div class="snapshot-meta">
                                    <span>TYPE: MODEL UNCERTAINTY ANALYSIS</span>
                                    <span>TIME: \${new Date(snap.timestamp).toLocaleTimeString()}</span>
                                    <span>BEST MODEL: \${snap.uncertaintyData.epiResult.best_fit_model?.toUpperCase()}</span>
                                </div>
                            </div>
                            <div class="unc-report-layout">
                                <div class="unc-report-left">
                                    <div id="\${plotId}-fit" class="unc-report-plot" style="height: 450px;"></div>
                                    <div id="\${plotId}-residual" class="unc-report-plot" style="height: 150px;"></div>
                                </div>
                                <div class="unc-report-right">
                                    <div id="\${plotId}-uncertainty" class="unc-report-plot" style="height: 300px;"></div>
                                    <div class="unc-report-text">\${snap.uncertaintyData.interpretationHtml}</div>
                                </div>
                            </div>
                        \`;
                    } else {
                        // STANDARD LAYOUT
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
                    }
                    
                    main.appendChild(block);

                    // 3. Render Plot(s)
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

                        if (snap.uncertaintyData) {
                            // RENDER UNCERTAINTY TRIO
                            const u = snap.uncertaintyData;
                            
                            const fitLayout = { ...layout, ...u.plots.fit.layout, height: 450, margin: { l: 80, r: 40, t: 40, b: 40 } };
                            const resLayout = { ...layout, ...u.plots.residual.layout, height: 150, margin: { l: 80, r: 40, t: 20, b: 40 } };
                            const uncLayout = { ...layout, ...u.plots.uncertainty.layout, height: 300, margin: { l: 40, r: 40, t: 40, b: 60 } };

                            Plotly.newPlot(\`\${plotId}-fit\`, u.plots.fit.traces, fitLayout, { responsive: true, displaylogo: false });
                            Plotly.newPlot(\`\${plotId}-residual\`, u.plots.residual.traces, resLayout, { responsive: true, displaylogo: false });
                            Plotly.newPlot(\`\${plotId}-uncertainty\`, u.plots.uncertainty.traces, uncLayout, { responsive: true, displaylogo: false });
                        } else {
                            // STANDARD RENDERING
                            const layoutMode = snap.settings.layoutMode || 'single';
                            
                            if (layoutMode.startsWith('grid') && snap.gridTraces && snap.gridTraces.length > 1) {
                                // Grid Rendering
                                const container = document.getElementById(plotId);
                                container.style.display = 'grid';
                                container.style.gap = '32px'; 
                                container.style.height = 'auto';
                                container.style.minHeight = '400px';
                                
                                if (layoutMode === 'grid2x1') {
                                    container.style.gridTemplateColumns = '1fr';
                                } else {
                                    container.style.gridTemplateColumns = '1fr 1fr';
                                }

                                snap.gridTraces.forEach((gridItem, gIdx) => {
                                    const subPlotId = \`\${plotId}-grid-\${gIdx}\`;
                                    const wrapper = document.createElement('div');
                                    wrapper.style.display = 'flex';
                                    wrapper.style.flexDirection = 'column';
                                    
                                    const subTitle = document.createElement('div');
                                    subTitle.style.cssText = 'font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-main); margin-bottom: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px;';
                                    subTitle.textContent = \`Plot \${gIdx + 1}: \${gridItem.name}\`;
                                    wrapper.appendChild(subTitle);

                                    const subDiv = document.createElement('div');
                                    subDiv.id = subPlotId;
                                    subDiv.style.minHeight = '400px';
                                    wrapper.appendChild(subDiv);
                                    
                                    container.appendChild(wrapper);
                                    
                                    const subLayout = { ...layout, yaxis: { ...layout.yaxis } };
                                    if (layoutMode.startsWith('grid')) {
                                        delete subLayout.yaxis.range;
                                        subLayout.yaxis.autorange = true;
                                    }
                                    Plotly.newPlot(subPlotId, gridItem.traces, subLayout, { responsive: true, displaylogo: false });
                                });
                            } else {
                                // Single/Stacked/Replicate Rendering
                                if (snap.type === 'fitting') {
                                    layout.grid = { rows: 2, columns: 1, pattern: 'independent' };
                                    layout.yaxis.domain = [0.3, 1];
                                    layout.yaxis2 = { domain: [0, 0.2], title: 'Δ', linecolor: '#0f172a', linewidth: 2, mirror: true, ticks: 'outside' };
                                    layout.xaxis.anchor = 'y2';
                                    const resTrace = snap.traces.find(t => t.name === 'Residual');
                                    if (resTrace) resTrace.yaxis = 'y2';
                                }

                                Plotly.newPlot(plotId, snap.traces, layout, { responsive: true, displaylogo: false });
                            }
                        }
                    }

                    const thead = document.getElementById(\`thead-\${snap.id}\`);
                    const tbody = document.getElementById(\`tbody-\${snap.id}\`);
                    const tableWrap = document.getElementById(\`table-\${snap.id}\`).parentElement;
                    
                    if (snap.ratio) {
                        const ratioSummary = document.createElement('div');
                        ratioSummary.className = 'ratio-summary';
                        ratioSummary.innerHTML = \`
                            <div class="ratio-item">
                                <span class="ratio-label">Intensity Ratio I(\${snap.ratio.p1.x.toFixed(0)})/I(\${snap.ratio.p2.x.toFixed(0)})</span>
                                <span class="ratio-value">\${snap.ratio.intRatio}</span>
                            </div>
                            <div class="ratio-item">
                                <span class="ratio-label">Area Ratio A1/A2</span>
                                <span class="ratio-value">\${snap.ratio.areaRatio}</span>
                            </div>
                        \`;
                        tableWrap.insertBefore(ratioSummary, tableWrap.firstChild);
                    }

                    if (snap.tableType === 'peaks') {
                        tableWrap.innerHTML = '';
                        snap.tableData.forEach(group => {
                            const groupTitle = document.createElement('div');
                            groupTitle.style.cssText = 'font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); margin: 32px 0 12px; border-left: 3px solid var(--accent); padding-left: 12px;';
                            groupTitle.textContent = group.fileName;
                            const table = document.createElement('table');
                            table.innerHTML = \`
                                <thead><tr><th>Center (cm⁻¹)</th><th>Intensity</th><th>FWHM</th><th>Area</th></tr></thead>
                                <tbody>
                                    \${group.peaks.length > 0 ? group.peaks.map(p => \`
                                        <tr>
                                            <td>\${(p.x || 0).toFixed(2)}</td>
                                            <td>\${(p.y || 0).toFixed(2)}</td>
                                            <td>\${(p.fwhm || 0).toFixed(2)}</td>
                                            <td>\${(p.area || 0).toFixed(2)}</td>
                                        </tr>
                                    \`).join('') : '<tr><td colspan="4" style="text-align:center; opacity:0.5;">No peaks selected.</td></tr>'}
                                </tbody>
                            \`;
                            tableWrap.appendChild(groupTitle);
                            tableWrap.appendChild(table);
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
