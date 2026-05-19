/**
 * Instant Raman — 2D Uncertainty Landscape Web Worker
 * Computes a 200×200 Gaussian KDE density field from ensemble fit points.
 * Runs off the main thread to keep UI responsive.
 */

export interface LandscapeWorkerInput {
  points: { x: number; y: number }[];
  gridSize: number;
  xPadding: number;  // percentage of range to pad
  yPadding: number;  // cm⁻¹ to pad on each side
}

export interface LandscapeWorkerOutput {
  density: Float64Array;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  gridSize: number;
}

self.onmessage = function (e: MessageEvent<LandscapeWorkerInput>) {
  const { points, gridSize, xPadding, yPadding } = e.data;
  const n = points.length;

  if (n === 0) {
    const empty = new Float64Array(gridSize * gridSize);
    (self as any).postMessage({
      density: empty,
      xMin: -10, xMax: 10,
      yMin: 0, yMax: 1,
      gridSize
    } as LandscapeWorkerOutput, [empty.buffer]);
    return;
  }

  // Extract coordinates
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);

  // Compute means and standard deviations
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  const stdX = Math.sqrt(xs.reduce((a, b) => a + (b - meanX) ** 2, 0) / (n - 1 || 1));
  const stdY = Math.sqrt(ys.reduce((a, b) => a + (b - meanY) ** 2, 0) / (n - 1 || 1));

  // Silverman's rule of thumb: h = 1.06 * σ * n^(-1/5)
  const nFifth = Math.pow(n, -0.2);
  let hx = 1.06 * stdX * nFifth;
  let hy = 1.06 * stdY * nFifth;

  // Guard against zero bandwidth (all points identical on one axis)
  if (hx < 1e-10) hx = 1.0;
  if (hy < 1e-10) hy = 0.1;

  // Compute grid bounds
  const rawXMin = Math.min(...xs);
  const rawXMax = Math.max(...xs);
  const rawYMin = Math.min(...ys);
  const rawYMax = Math.max(...ys);

  const xRange = rawXMax - rawXMin || 1;
  const xMin = rawXMin - xRange * (xPadding / 100);
  const xMax = rawXMax + xRange * (xPadding / 100);

  const yMin = rawYMin - yPadding;
  const yMax = rawYMax + yPadding;

  // Build the density grid
  const density = new Float64Array(gridSize * gridSize);
  const xStep = (xMax - xMin) / (gridSize - 1);
  const yStep = (yMax - yMin) / (gridSize - 1);

  // Precompute inverse bandwidths for performance
  const invHx2 = 1 / (2 * hx * hx);
  const invHy2 = 1 / (2 * hy * hy);

  let maxDensity = 0;

  for (let iy = 0; iy < gridSize; iy++) {
    const gy = yMin + iy * yStep;
    for (let ix = 0; ix < gridSize; ix++) {
      const gx = xMin + ix * xStep;

      let sum = 0;
      for (let k = 0; k < n; k++) {
        const dx = gx - xs[k];
        const dy = gy - ys[k];
        sum += Math.exp(-(dx * dx * invHx2 + dy * dy * invHy2));
      }

      density[iy * gridSize + ix] = sum;
      if (sum > maxDensity) maxDensity = sum;
    }
  }

  // Normalise to [0, 1]
  if (maxDensity > 0) {
    for (let i = 0; i < density.length; i++) {
      density[i] /= maxDensity;
    }
  }

  // Transfer the buffer for zero-copy performance
  (self as any).postMessage({
    density,
    xMin, xMax,
    yMin, yMax,
    gridSize
  } as LandscapeWorkerOutput, [density.buffer]);
};
