/**
 * Instant Raman v2.0 — Text/CSV Parser
 * Handles TXT, CSV, ASC, DAT formats with auto-detection.
 */

export interface ParsedSpectrum {
  x: number[];
  y: number[];
  pointCount: number;
  xRange: [number, number];
  detectedFormat: string;
}

export function parseSpectralFile(content: string, laserWavelength = 785): ParsedSpectrum {
  const lines = content.split(/\r?\n/);
  let x: number[] = [];
  let y: number[] = [];
  
  // Greedy Numeric Hunt: Find any two numbers on a line
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

  if (x.length === 0) {
    console.error('[Parser] Failure: No numeric pairs detected in file.');
    throw new Error('Format not recognized. Ensure file contains X Y columns.');
  }
  
  console.log(`[Parser] Success: Extracted ${x.length} points.`);
  
  // Sort and remove duplicates
  const combined = x.map((v, i) => [v, y[i]]).sort((a, b) => a[0] - b[0]);
  x = combined.map(v => v[0]);
  y = combined.map(v => v[1]);

  const minX = x[0];
  const maxX = x[x.length - 1];

  // Auto-convert nm to cm-1 if detected
  if (minX > 100 && minX < 1100 && maxX > 100 && maxX < 1100) {
    x = x.map(nm => parseFloat((((1 / laserWavelength) - (1 / nm)) * 1e7).toFixed(2)));
    const resorted = x.map((v, i) => [v, y[i]]).sort((a, b) => a[0] - b[0]);
    x = resorted.map(v => v[0]);
    y = resorted.map(v => v[1]);
  }

  return { x, y, pointCount: x.length, xRange: [x[0], x[x.length - 1]], detectedFormat: 'Auto-Detected' };
}
