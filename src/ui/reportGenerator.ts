import { REPORT_TEMPLATE } from './reportTemplate.ts';
// @ts-ignore
import plotlyCartesian from 'plotly.js-cartesian-dist-min/plotly-cartesian.min.js?raw';

export interface Snapshot {
  id: string;
  title: string;
  type: 'general' | 'fitting' | 'replicate';
  timestamp: string;
  traces: any[];
  layout: any;
  tableData: any[];
  tableType: 'peaks' | 'fit' | 'replicate';
  settings: {
    snip: number;
    norm: string;
    range: [number, number] | null;
  };
}

export interface ReportData {
  timestamp: string;
  snapshots: Snapshot[];
  sessionSummary: {
    totalFiles: number;
    filenames: string[];
  };
}

export class ReportGenerator {
  static async generate(data: ReportData) {
    // 1. Serialize Data
    const jsonData = JSON.stringify(data);
    
    // 2. Inject Data and Plotly into Template (Safe split/join to avoid '$' issues in replace)
    let finalHtml = REPORT_TEMPLATE
      .split('/* DATA_INJECTION_POINT */').join(jsonData)
      .split('/* PLOTLY_INJECTION_POINT */').join(plotlyCartesian);
    
    // 3. Create Blob and Trigger Download
    const blob = new Blob([finalHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    const filename = `Raman_Report_${new Date().toISOString().split('T')[0]}.html`;
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    
    console.log('[Instant Raman] Report generated successfully:', filename);
  }
}
