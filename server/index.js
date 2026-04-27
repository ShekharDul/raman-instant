import express from 'express';
import cors from 'cors';
import ExcelJS from 'exceljs';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'node:crypto';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const EXCEL_DIR = path.join(process.cwd(), 'temp_excel');

if (!fs.existsSync(EXCEL_DIR)) fs.mkdirSync(EXCEL_DIR);

app.use(cors({
  origin: 'http://localhost:5174',
  exposedHeaders: ['Content-Disposition', 'Content-Type']
}));
app.use(express.json({ limit: '50mb' }));

const excelStore = new Map();

// ── Step 1: Prepare the Excel (POST) ──
app.post('/api/prepare-excel', async (req, res) => {
  try {
    const { files, range, params } = req.body;
    const token = randomUUID();
    const filename = `RamanInstant_Analysis_${token}.xlsx`;
    const filePath = path.join(EXCEL_DIR, filename);

    console.log(`[Backend] Preparing Excel ${token} for ${files.length} spectra...`);

    const workbook = new ExcelJS.Workbook();
    
    // Methodology Sheet
    const summarySheet = workbook.addWorksheet('Analysis Info');
    summarySheet.columns = [{ header: 'Parameter', key: 'p', width: 25 }, { header: 'Value', key: 'v', width: 45 }];
    summarySheet.addRow({ p: 'Workstation', v: 'RamanInstant Professional v2.0' });
    summarySheet.addRow({ p: 'Export Date', v: new Date().toISOString() });
    summarySheet.addRow({ p: 'Baseline (SNIP)', v: params.snip + ' iterations' });
    summarySheet.addRow({ p: 'Smoothing (SG)', v: 'Window size ' + params.sg });
    if (range) {
      summarySheet.addRow({ p: 'Spectral Window Min', v: range[0] + ' cm-1' });
      summarySheet.addRow({ p: 'Spectral Window Max', v: range[1] + ' cm-1' });
    }
    summarySheet.getRow(1).font = { bold: true };

    // Spectral Sheets
    const sheetNames = new Set();
    for (const file of files) {
      let baseName = file.name.substring(0, 28).replace(/[\\\/\?\*\[\]]/g, '_');
      let sheetName = baseName;
      let counter = 1;
      while (sheetNames.has(sheetName)) { sheetName = `${baseName}_${counter++}`; }
      sheetNames.add(sheetName);

      const sheet = workbook.addWorksheet(sheetName);
      sheet.columns = [
        { header: 'Raman Shift (cm-1)', key: 'x', width: 18 },
        { header: 'Raw Intensity', key: 'raw', width: 18 },
        { header: 'Processed Intensity', key: 'proc', width: 20 }
      ];

      for (let i = 0; i < file.x.length; i++) {
        if (range && (file.x[i] < range[0] || file.x[i] > range[1])) continue;
        sheet.addRow({ x: file.x[i], raw: file.rawY[i], proc: file.procY[i] });
      }
      sheet.getRow(1).font = { bold: true };
    }

    // Save File to disk
    await workbook.xlsx.writeFile(filePath);
    
    const stats = fs.statSync(filePath);
    console.log(`[Backend] Excel ready: ${stats.size} bytes. Token: ${token}`);

    excelStore.set(token, { path: filePath, originalName: `RamanInstant_Analytical_Data.xlsx` });

    // Auto-cleanup (10 mins)
    setTimeout(() => {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      excelStore.delete(token);
      console.log(`[Backend] Cleaned up Excel token ${token}`);
    }, 10 * 60 * 1000);

    res.json({ token });

  } catch (error) {
    console.error('[Backend] Excel Preparation Error:', error);
    res.status(500).json({ error: 'Failed to generate Excel file' });
  }
});

// ── Step 2: Download the Excel (GET) ──
app.get('/api/download-excel', (req, res) => {
  const { token } = req.query;
  const entry = excelStore.get(token);

  if (!entry || !fs.existsSync(entry.path)) {
    return res.status(404).send('Excel file expired or not found.');
  }

  res.download(path.resolve(entry.path), entry.originalName);
});

app.listen(PORT, () => {
  console.log(`[RamanInstant Backend] Excel-Service running on http://localhost:${PORT}`);
});
