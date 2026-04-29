/**
 * Instant Raman v2.5 — Universal Spectral Parser
 * Automatically detects and parses multiple spectral file formats.
 * Normalizes all data into a standard internal structure.
 */

import { NormalizedSpectrum, SpectralData } from '../engine/types.ts';

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

  private static isOceanOptics(text: string, fileName: string): boolean {
    return text.includes('>>>>>Begin Spectral Data<<<<<') || 
           text.includes('Ocean Optics') || 
           text.includes('OOIBase32') ||
           text.includes('SpectraSuite');
  }

  private static isHoribaXML(text: string, fileName: string): boolean {
    return (text.includes('<?xml') && text.includes('LabSpec')) || 
           (fileName.endsWith('.xml') && text.includes('<Dataset>'));
  }

  private static isHoribaText(text: string, fileName: string): boolean {
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

  private static parseText(content: string, fileName: string, laserWavelength: number, formatLabel = 'Auto-Detected'): NormalizedSpectrum {
    const lines = content.split(/\r?\n/);
    let x: number[] = [];
    let y: number[] = [];
    
    const numRegex = /[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?/g;

    for (const line of lines) {
      const matches = line.match(numRegex);
      if (matches && matches.length >= 2) {
        const valX = parseFloat(matches[0]);
        const valY = parseFloat(matches[1]);
        if (!isNaN(valX) && !isNaN(valY)) {
          x.push(valX);
          y.push(valY);
        }
      }
    }

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
