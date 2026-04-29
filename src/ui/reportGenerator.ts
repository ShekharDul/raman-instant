import { REPORT_TEMPLATE } from './reportTemplate.ts';
// @ts-ignore
import plotlyCartesian from 'plotly.js-cartesian-dist-min/plotly-cartesian.min.js?raw';

export interface ReportData {
  timestamp: string;
  filenames: string[];
  totalPeaks: number;
  settings: {
    snip: number;
    norm: string;
    baselineMode: string;
    cosmicRayRemoval: boolean;
  };
  peaks: { x: number; y: number; fwhm: number; area: number; fileName?: string }[];
  files: { name: string; x: number[]; y: number[] }[];
  fitResult?: any;
  replicateGroup?: any;
}

export class ReportGenerator {
  static async generate(data: ReportData) {
    // 1. Serialize Data
    const jsonData = JSON.stringify(data);
    
    // 2. Inject Data and Plotly into Template
    let finalHtml = REPORT_TEMPLATE
      .replace('/* DATA_INJECTION_POINT */', jsonData)
      .replace('/* PLOTLY_INJECTION_POINT */', plotlyCartesian);
    
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
