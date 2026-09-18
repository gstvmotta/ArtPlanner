export interface Corner {
  x: number;
  y: number;
}

export type Quad = [Corner, Corner, Corner, Corner]; // TL, TR, BR, BL

interface SquareToQuadCoeffs {
  a11: number;
  a12: number;
  a13: number;
  a21: number;
  a22: number;
  a23: number;
  a31: number;
  a32: number;
}

/**
 * Coefficients for the projective map from the unit square (0,0)-(1,0)-(1,1)-(0,1)
 * onto an arbitrary quadrilateral. Standard closed-form solution (Heckbert).
 */
function squareToQuadCoeffs(quad: Quad): SquareToQuadCoeffs {
  const [{ x: x0, y: y0 }, { x: x1, y: y1 }, { x: x2, y: y2 }, { x: x3, y: y3 }] = quad;

  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;

  let a13 = 0;
  let a23 = 0;
  if (dx3 !== 0 || dy3 !== 0) {
    const denom = dx1 * dy2 - dx2 * dy1;
    a13 = (dx3 * dy2 - dx2 * dy3) / denom;
    a23 = (dx1 * dy3 - dx3 * dy1) / denom;
  }

  const a11 = x1 - x0 + a13 * x1;
  const a21 = x3 - x0 + a23 * x3;
  const a31 = x0;
  const a12 = y1 - y0 + a13 * y1;
  const a22 = y3 - y0 + a23 * y3;
  const a32 = y0;

  return { a11, a12, a13, a21, a22, a23, a31, a32 };
}

function mapUnitToQuad(coeffs: SquareToQuadCoeffs, u: number, v: number): Corner {
  const w = coeffs.a13 * u + coeffs.a23 * v + 1;
  const x = (coeffs.a11 * u + coeffs.a21 * v + coeffs.a31) / w;
  const y = (coeffs.a12 * u + coeffs.a22 * v + coeffs.a32) / w;
  return { x, y };
}

function bilinearSample(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): [number, number, number, number] {
  const clampedX = Math.max(0, Math.min(width - 1.001, x));
  const clampedY = Math.max(0, Math.min(height - 1.001, y));
  const x0 = Math.floor(clampedX);
  const y0 = Math.floor(clampedY);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const fx = clampedX - x0;
  const fy = clampedY - y0;

  const idx = (px: number, py: number) => (py * width + px) * 4;

  const out: [number, number, number, number] = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    const v00 = data[idx(x0, y0) + c];
    const v10 = data[idx(x1, y0) + c];
    const v01 = data[idx(x0, y1) + c];
    const v11 = data[idx(x1, y1) + c];
    const top = v00 + (v10 - v00) * fx;
    const bottom = v01 + (v11 - v01) * fx;
    out[c] = top + (bottom - top) * fy;
  }
  return out;
}

function distance(a: Corner, b: Corner): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function estimateOutputSize(quad: Quad, maxDimension = 1400): { width: number; height: number } {
  const [tl, tr, br, bl] = quad;
  const topW = distance(tl, tr);
  const bottomW = distance(bl, br);
  const leftH = distance(tl, bl);
  const rightH = distance(tr, br);

  const width = Math.max(20, Math.round((topW + bottomW) / 2));
  const height = Math.max(20, Math.round((leftH + rightH) / 2));

  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    width: Math.max(20, Math.round(width * scale)),
    height: Math.max(20, Math.round(height * scale)),
  };
}

/**
 * Flattens (rectifies) the region of `image` bounded by `quad` (in the image's
 * natural pixel coordinates, corners ordered TL, TR, BR, BL) into a rectangular
 * output image, returned as a PNG data URL.
 */
export function warpQuadToRect(
  image: HTMLImageElement,
  quad: Quad,
  outputWidth: number,
  outputHeight: number,
): string {
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = image.naturalWidth;
  srcCanvas.height = image.naturalHeight;
  const srcCtx = srcCanvas.getContext('2d')!;
  srcCtx.drawImage(image, 0, 0);
  const srcData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outputWidth;
  outCanvas.height = outputHeight;
  const outCtx = outCanvas.getContext('2d')!;
  const outData = outCtx.createImageData(outputWidth, outputHeight);

  const coeffs = squareToQuadCoeffs(quad);

  for (let oy = 0; oy < outputHeight; oy++) {
    const v = oy / (outputHeight - 1 || 1);
    for (let ox = 0; ox < outputWidth; ox++) {
      const u = ox / (outputWidth - 1 || 1);
      const { x: sx, y: sy } = mapUnitToQuad(coeffs, u, v);
      const [r, g, b, a] = bilinearSample(
        srcData.data,
        srcCanvas.width,
        srcCanvas.height,
        sx,
        sy,
      );
      const outIdx = (oy * outputWidth + ox) * 4;
      outData.data[outIdx] = r;
      outData.data[outIdx + 1] = g;
      outData.data[outIdx + 2] = b;
      outData.data[outIdx + 3] = a;
    }
  }

  outCtx.putImageData(outData, 0, 0);
  return outCanvas.toDataURL('image/png');
}
