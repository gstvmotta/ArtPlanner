import { CanvasTexture, ClampToEdgeWrapping, RepeatWrapping, SRGBColorSpace } from 'three';

interface TexturePair {
  map: CanvasTexture;
  roughnessMap: CanvasTexture;
}

const cache = new Map<string, TexturePair>();

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  return [r, g, b];
}

function shade([r, g, b]: [number, number, number], amount: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  return `rgb(${clamp(r + amount)}, ${clamp(g + amount)}, ${clamp(b + amount)})`;
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeTexture(canvas: HTMLCanvasElement, srgb: boolean): CanvasTexture {
  const tex = new CanvasTexture(canvas);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  if (srgb) tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function buildWallTexture(colorHex: string): TexturePair {
  const size = 1024;
  const rgb = hexToRgb(colorHex);
  const rand = mulberry32(42);

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cctx = colorCanvas.getContext('2d')!;
  cctx.fillStyle = colorHex;
  cctx.fillRect(0, 0, size, size);
  // subtle roller-paint stipple
  for (let i = 0; i < 26000; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 1 + rand() * 2.6;
    const variance = (rand() - 0.5) * 10;
    cctx.fillStyle = shade(rgb, variance);
    cctx.globalAlpha = 0.28;
    cctx.beginPath();
    cctx.arc(x, y, r, 0, Math.PI * 2);
    cctx.fill();
  }
  cctx.globalAlpha = 1;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext('2d')!;
  rctx.fillStyle = '#b3b3b3';
  rctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 34000; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const v = 150 + rand() * 90;
    rctx.fillStyle = `rgb(${v},${v},${v})`;
    rctx.globalAlpha = 0.25;
    rctx.beginPath();
    rctx.arc(x, y, 0.8 + rand() * 2, 0, Math.PI * 2);
    rctx.fill();
  }
  rctx.globalAlpha = 1;

  const map = makeTexture(colorCanvas, true);
  const roughnessMap = makeTexture(roughCanvas, false);
  map.anisotropy = 8;
  roughnessMap.anisotropy = 8;
  map.repeat.set(2, 2);
  roughnessMap.repeat.set(2, 2);
  return { map, roughnessMap };
}

function buildWoodTexture(colorHex: string): TexturePair {
  const size = 256;
  const rgb = hexToRgb(colorHex);
  const rand = mulberry32(7);

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cctx = colorCanvas.getContext('2d')!;
  cctx.fillStyle = colorHex;
  cctx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 1) {
    const wobble = Math.sin(y * 0.08) * 3 + Math.sin(y * 0.31) * 1.5;
    const variance = Math.sin(y * 0.15 + wobble) * 14 + (rand() - 0.5) * 8;
    cctx.fillStyle = shade(rgb, variance);
    cctx.globalAlpha = 0.5;
    cctx.fillRect(0, y, size, 1);
  }
  // occasional darker grain streaks
  for (let i = 0; i < 26; i++) {
    const y = rand() * size;
    cctx.strokeStyle = shade(rgb, -30 - rand() * 20);
    cctx.globalAlpha = 0.25;
    cctx.lineWidth = 0.5 + rand();
    cctx.beginPath();
    cctx.moveTo(0, y);
    for (let x = 0; x <= size; x += 16) {
      cctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 3);
    }
    cctx.stroke();
  }
  cctx.globalAlpha = 1;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext('2d')!;
  rctx.fillStyle = '#9c9c9c';
  rctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 1) {
    const v = 130 + Math.sin(y * 0.15) * 25 + (rand() - 0.5) * 20;
    rctx.fillStyle = `rgb(${v},${v},${v})`;
    rctx.globalAlpha = 0.4;
    rctx.fillRect(0, y, size, 1);
  }
  rctx.globalAlpha = 1;

  const map = makeTexture(colorCanvas, true);
  const roughnessMap = makeTexture(roughCanvas, false);
  map.repeat.set(1, 3);
  roughnessMap.repeat.set(1, 3);
  return { map, roughnessMap };
}

function buildMetalTexture(colorHex: string): TexturePair {
  const size = 256;
  const rgb = hexToRgb(colorHex);
  const rand = mulberry32(19);

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cctx = colorCanvas.getContext('2d')!;
  cctx.fillStyle = colorHex;
  cctx.fillRect(0, 0, size, size);
  for (let x = 0; x < size; x += 1) {
    const variance = (rand() - 0.5) * 18;
    cctx.fillStyle = shade(rgb, variance);
    cctx.globalAlpha = 0.5;
    cctx.fillRect(x, 0, 1, size);
  }
  cctx.globalAlpha = 1;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext('2d')!;
  rctx.fillStyle = '#555555';
  rctx.fillRect(0, 0, size, size);
  for (let x = 0; x < size; x += 1) {
    const v = 60 + rand() * 110;
    rctx.fillStyle = `rgb(${v},${v},${v})`;
    rctx.globalAlpha = 0.55;
    rctx.fillRect(x, 0, 1, size);
  }
  rctx.globalAlpha = 1;

  const map = makeTexture(colorCanvas, true);
  const roughnessMap = makeTexture(roughCanvas, false);
  map.repeat.set(3, 1);
  roughnessMap.repeat.set(3, 1);
  return { map, roughnessMap };
}

let glassShineTexture: CanvasTexture | null = null;

/**
 * A soft diagonal light streak baked into a square texture, fully contained
 * within its own bounds (unlike a rotated overflowing plane, this never
 * spills outside the mesh it's mapped onto).
 */
export function getGlassShineTexture(): CanvasTexture {
  if (glassShineTexture) return glassShineTexture;

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  ctx.save();
  ctx.translate(size * 0.32, size * 0.5);
  ctx.rotate(0.55);
  const grad = ctx.createLinearGradient(-size * 0.16, 0, size * 0.16, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(-size * 0.16, -size, size * 0.32, size * 2);
  ctx.restore();

  const tex = new CanvasTexture(canvas);
  tex.wrapS = ClampToEdgeWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.needsUpdate = true;
  glassShineTexture = tex;
  return tex;
}

export function getMaterialTexture(type: 'wood' | 'metal' | 'mdf' | 'wall', colorHex: string): TexturePair {
  const key = `${type}:${colorHex}`;
  const cached = cache.get(key);
  if (cached) return cached;

  let pair: TexturePair;
  if (type === 'wood' || type === 'mdf') {
    pair = buildWoodTexture(colorHex);
  } else if (type === 'metal') {
    pair = buildMetalTexture(colorHex);
  } else {
    pair = buildWallTexture(colorHex);
  }
  cache.set(key, pair);
  return pair;
}
