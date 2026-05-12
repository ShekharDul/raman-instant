/**
 * Instant Raman v2.5 — Universal Spectral Parser
 * Automatically detects and parses multiple spectral file formats.
 * Normalizes all data into a standard internal structure.
 */

import type { NormalizedSpectrum } from '../engine/types.ts';

export class UniversalParser {
  /**
   * Main entry point for parsing any file.
   */
  static async parseFile(file: File, laserWavelength = 785): Promise<NormalizedSpectrum> {
    const buffer = await file.arrayBuffer();
    const headerBytes = new Uint8Array(buffer.slice(0, 4096));
    const headerText = new TextDecoder().decode(headerBytes);
    const fileName = file.name.toLowerCase();

    // 1. Check for Binary Proprietary Formats (Renishaw & WITec)
    if (this.isRenishawWDF(headerBytes, fileName)) {
      throw new Error('Renishaw binary (.wdf) detected. Please export your data as .txt or .csv from Renishaw WiRE software.');
    }
    if (this.isWITecWIP(headerBytes, fileName)) {
      throw new Error('WITec binary (.wip) detected. Please export your data as .txt or .csv from WITec Project software.');
    }

    // 2. Format Detection & Routing
    const fullText = new TextDecoder().decode(buffer);

    if (this.isJCAMP(headerText, fileName)) {
      return this.parseJCAMP(fullText, file.name);
    }
    if (this.isOceanOptics(headerText, fileName)) {
      return this.parseOceanOptics(fullText, file.name, laserWavelength);
    }
    if (this.isHoribaXML(headerText, fileName)) {
      return this.parseHoribaXML(fullText, file.name);
    }
    if (this.isHoribaText(headerText, fileName)) {
      return this.parseHoribaText(fullText, file.name);
    }
    if (this.isBrukerDPT(headerText, fileName)) {
      return this.parseBrukerDPT(fullText, file.name);
    }

    // Default Fallback: Greedy Numeric Hunt
    return this.parseText(fullText, file.name, laserWavelength);
  }

  // --- Detectors (Industry Standard Signatures) ---

  private static isRenishawWDF(bytes: Uint8Array, fileName: string): boolean {
    const magic = String.fromCharCode(...bytes.slice(0, 4));
    return magic === 'WDF1' || fileName.endsWith('.wdf');
  }

  private static isWITecWIP(bytes: Uint8Array, fileName: string): boolean {
    const magic = String.fromCharCode(...bytes.slice(0, 3));
    return magic === 'WIT' || fileName.endsWith('.wip');
  }

  private static isJCAMP(text: string, fileName: string): boolean {
    return text.includes('##TITLE=') || 
           text.includes('##JCAMP-DX=') || 
           text.includes('##DATA TYPE=') ||
           fileName.endsWith('.jdx') || 
           fileName.endsWith('.dx');
  }

  private static isOceanOptics(text: string, _fileName: string): boolean {
    return text.includes('>>>>>Begin Spectral Data<<<<<') || 
           text.includes('Ocean Optics') || 
           text.includes('OOIBase32') ||
           text.includes('SpectraSuite');
  }

  private static isHoribaXML(text: string, fileName: string): boolean {
    return (text.includes('<?xml') && text.includes('LabSpec')) || 
           (fileName.endsWith('.xml') && text.includes('<Dataset>'));
  }

  private static isHoribaText(text: string, _fileName: string): boolean {
    return text.includes('LabSpec') || 
           text.includes('Horiba') || 
           text.includes('Software Name: LabSpec');
  }

  private static isBrukerDPT(text: string, fileName: string): boolean {
    return fileName.endsWith('.dpt') || 
           (text.includes('##') && text.includes('DATA TYPE=') && text.includes('Bruker'));
  }

  // --- Parsers ---

  private static parseJCAMP(content: string, fileName: string): NormalizedSpectrum {
    const x: number[] = [];
    const y: number[] = [];
    const lines = content.split(/\r?\n/);
    let inData = false;

    for (const line of lines) {
      if (line.startsWith('##XYDATA=')) {
        inData = true;
        continue;
      }
      if (line.startsWith('##END=')) {
        inData = false;
        continue;
      }

      if (inData) {
        // JCAMP can have multiple values per line, or compressed formats.
        // Simple implementation for fixed-width or space-separated.
        const values = line.trim().split(/[\s,]+/);
        if (values.length >= 2) {
          const startX = parseFloat(values[0]);
          for (let i = 1; i < values.length; i++) {
            const valY = parseFloat(values[i]);
            if (!isNaN(valY)) {
              x.push(startX + (i - 1)); // This is a simplification for (X++(Y..Y))
              y.push(valY);
            }
          }
        }
      }
    }

    return this.finalize(x, y, 'JCAMP-DX', fileName);
  }

  private static parseOceanOptics(content: string, fileName: string, laserWavelength: number): NormalizedSpectrum {
    const x: number[] = [];
    const y: number[] = [];
    const lines = content.split(/\r?\n/);
    let dataStarted = false;

    for (const line of lines) {
      if (line.includes('>>>>>Begin Spectral Data<<<<<')) {
        dataStarted = true;
        continue;
      }
      if (dataStarted) {
        const parts = line.trim().split(/[\s,]+/);
        if (parts.length >= 2) {
          const valX = parseFloat(parts[0]);
          const valY = parseFloat(parts[1]);
          if (!isNaN(valX) && !isNaN(valY)) {
            x.push(valX);
            y.push(valY);
          }
        }
      }
    }

    return this.finalize(x, y, 'Ocean Optics', fileName, laserWavelength);
  }

  private static parseHoribaXML(content: string, fileName: string): NormalizedSpectrum {
    const x: number[] = [];
    const y: number[] = [];
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(content, "text/xml");
    
    // Extraction for LabSpec XML structure
    const xPoints = xmlDoc.getElementsByTagName('X');
    const yPoints = xmlDoc.getElementsByTagName('Y');

    if (xPoints.length > 0 && yPoints.length > 0) {
      for (let i = 0; i < xPoints.length; i++) {
        x.push(parseFloat(xPoints[i].textContent || '0'));
        y.push(parseFloat(yPoints[i].textContent || '0'));
      }
    } else {
      // Try alternative tags
      const dataPoints = xmlDoc.getElementsByTagName('DataPoint');
      for (let i = 0; i < dataPoints.length; i++) {
        const xVal = dataPoints[i].getAttribute('x') || dataPoints[i].getElementsByTagName('X')[0]?.textContent;
        const yVal = dataPoints[i].getAttribute('y') || dataPoints[i].getElementsByTagName('Y')[0]?.textContent;
        if (xVal && yVal) {
          x.push(parseFloat(xVal));
          y.push(parseFloat(yVal));
        }
      }
    }

    return this.finalize(x, y, 'Horiba LabSpec (XML)', fileName);
  }

  private static parseHoribaText(content: string, fileName: string): NormalizedSpectrum {
    return this.parseText(content, fileName, 785, 'Horiba LabSpec');
  }

  private static parseBrukerDPT(content: string, fileName: string): NormalizedSpectrum {
    return this.parseText(content, fileName, 785, 'Bruker DPT');
  }

  public static normalizeDecimals(text: string): string {
    const lines = text.split('\n');
    
    // Analyze first 100 data lines to detect format
    const sampleLines = lines
      .filter(line => /\d/.test(line))  // Has at least one digit
      .slice(0, 100);
    
    let commaAsDecimalCount = 0;
    let commaAsDelimiterCount = 0;
    
    for (const line of sampleLines) {
      // Pattern: "1000,52" with 1-3 digits after comma = decimal separator
      if (/\d+,\d{1,3}(?:\s|$)/.test(line)) {
        commaAsDecimalCount++;
      }
      // Pattern: "1000, 5200" with space after comma = CSV delimiter
      if (/\d+,\s+\d+/.test(line)) {
        commaAsDelimiterCount++;
      }
    }
    
    // If commas are predominantly used as decimals (2:1 ratio), normalize them
    if (commaAsDecimalCount > commaAsDelimiterCount * 2) {
      // Replace comma with dot ONLY when it's between digits and followed by whitespace or end-of-line
      // This preserves actual CSV delimiters
      return text.replace(/(\d+),(\d{1,3})(?=\s|$)/g, '$1.$2');
    }
    
    return text;  // No normalization needed
  }

  private static calculateMedian(arr: number[]): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  public static parseText(content: string, fileName: string, laserWavelength: number, formatLabel = 'Auto-Detected'): NormalizedSpectrum {
    content = this.normalizeDecimals(content);
    
    const lines = content.split(/\r?\n/);
    const numRegex = /[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?/g;
    
    const rawData: number[][] = [];
    
    // Parse all numeric lines
    for (const line of lines) {
      const matches = line.match(numRegex);
      if (matches && matches.length >= 2) {
        const nums = matches.map(m => parseFloat(m));
        rawData.push(nums);
      }
    }
    
    if (rawData.length === 0) {
      throw new Error(
        `Failed to parse ${fileName}: No valid numeric data detected.\n\n` +
        `Supported formats:\n` +
        `• CSV/TSV (comma or tab separated)\n` +
        `• Space-delimited text (two or more columns)\n` +
        `• JCAMP-DX (.jdx, .dx)\n` +
        `• Horiba LabSpec (.txt, .xml)\n` +
        `• Ocean Optics (.txt)\n` +
        `• Bruker OPUS (.dpt)\n\n` +
        `File preview (first 500 characters):\n${content.slice(0, 500)}...`
      );
    }
    
    // STEP 0.5: Filter obvious garbage data points
    let filteredData = rawData.filter(row => {
      const x = row[0];
      const y = row[1];
      
      // Typical Raman range: 100-4000 cm⁻¹ or 400-1100 nm (for raw nm data)
      // Allow slightly wider range to be safe
      if (Math.abs(x) < 5) return false; 
      
      // Remove points where Y is exactly zero (often placeholder values)
      if (y === 0) return false;
      
      return true;
    });

    if (filteredData.length < 5) {
        // Fallback if filtering was too aggressive
        filteredData = rawData;
    }

    // STEP 1: Detect if first column is sequential index
    const firstCol = filteredData.map(row => row[0]);
    let isSequentialIndex = false;
    
    if (firstCol.length >= 3) {
      // Check first 10 rows for sequential pattern
      const sample = firstCol.slice(0, 10);
      isSequentialIndex = sample.every((val, idx) => Math.abs(val - (firstCol[0] + idx)) < 0.01);
    }
    
    // STEP 2: Choose which columns to extract
    let xColumnIndex = 0;
    let yColumnIndex = 1;
    
    if (isSequentialIndex) {
      // First column is index (0, 1, 2, 3...), skip it
      xColumnIndex = 1;
      yColumnIndex = 2;
      
      // Verify file has enough columns
      if (filteredData[0].length < 3) {
        throw new Error(
          `Column mismatch in ${fileName}.\n` +
          `First column appears to be row indices (0, 1, 2...), ` +
          `but only ${filteredData[0].length} total columns found.\n` +
          `Expected: [Index, Wavenumber, Intensity].\n` +
          `Check your export settings in the instrument software.`
        );
      }
    }
    
    // STEP 3: Extract X and Y from correct columns
    const extractedY = filteredData.map(row => row[yColumnIndex]);
    
    // Remove extreme outliers (likely metadata numbers)
    const medianY = this.calculateMedian(extractedY);
    const filteredPoints = filteredData
      .map(row => ({ x: row[xColumnIndex], y: row[yColumnIndex] }))
      .filter(point => {
        // Remove intensities >100× median or <0.01× median (extreme outliers)
        // Only apply if median is non-zero
        if (medianY !== 0) {
           if (Math.abs(point.y) > Math.abs(medianY) * 100) return false;
           if (Math.abs(point.y) < Math.abs(medianY) / 100) return false;
        }
        return true;
      });

    const x = filteredPoints.map(p => p.x);
    const y = filteredPoints.map(p => p.y);

    return this.finalize(x, y, formatLabel, fileName, laserWavelength);
  }

  /**
   * Finalizes the data: sorting, deduplication, and wavelength conversion if needed.
   * Ensures output is in the normalized internal data structure.
   */
  private static finalize(x: number[], y: number[], format: string, fileName: string, laserWavelength = 785): NormalizedSpectrum {
    if (x.length === 0) {
      throw new Error(`Failed to extract numeric data from ${format} file.`);
    }

    // Sort and remove duplicates
    const combined = x.map((v, i) => [v, y[i]]).sort((a, b) => a[0] - b[0]);
    let finalX = combined.map(v => v[0]);
    let finalY = combined.map(v => v[1]);

    const minX = finalX[0];
    const maxX = finalX[finalX.length - 1];

    // Auto-convert nm to cm-1 if detected (typical for raw spectrometer output)
    if (minX > 100 && minX < 1100 && maxX > 100 && maxX < 1100) {
      finalX = finalX.map(nm => parseFloat((((1 / laserWavelength) - (1 / nm)) * 1e7).toFixed(2)));
      // Re-sort as nm to cm-1 conversion flips the order
      const resorted = finalX.map((v, i) => [v, finalY[i]]).sort((a, b) => a[0] - b[0]);
      finalX = resorted.map(v => v[0]);
      finalY = resorted.map(v => v[1]);
    }

    return {
      wavenumberData: finalX,
      intensityData: finalY,
      metadata: {
        format,
        fileName,
        pointCount: finalX.length,
        laserWavelength
      }
    };
  }
}
