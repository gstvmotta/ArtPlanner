import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { ProjectData } from '../store/useWallStore';
import type { ArtworkConfig } from '../types';

const ARTWORK_KEYS: (keyof Pick<ArtworkConfig, 'imageUrl' | 'warpedTextureUrl'>)[] = [
  'imageUrl',
  'warpedTextureUrl',
];

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; ext: string } | null {
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.*)$/);
  if (!match) return null;
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, ext };
}

function bytesToDataUrl(bytes: Uint8Array, ext: string): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const b64 = btoa(binary);
  const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
  return `data:${mime};base64,${b64}`;
}

export function downloadProjectZip(data: ProjectData, filename = 'projeto-parede.zip') {
  const files: Record<string, Uint8Array> = {};
  const cloned: ProjectData = JSON.parse(JSON.stringify(data));

  cloned.frames.forEach((frame, idx) => {
    for (const key of ARTWORK_KEYS) {
      const val = frame.artwork[key];
      if (!val || !val.startsWith('data:')) continue;
      const decoded = dataUrlToBytes(val);
      if (!decoded) continue;
      const assetPath = `assets/frame_${idx}_${key}.${decoded.ext}`;
      files[assetPath] = decoded.bytes;
      frame.artwork[key] = `asset:${assetPath}`;
    }
  });

  files['project.json'] = strToU8(JSON.stringify(cloned, null, 2));
  const zipped = zipSync(files, { level: 6 });
  const blob = new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseProjectZip(buffer: ArrayBuffer): ProjectData {
  const unzipped = unzipSync(new Uint8Array(buffer));
  const projectBytes = unzipped['project.json'];
  if (!projectBytes) throw new Error('project.json não encontrado no arquivo.');

  const data = JSON.parse(strFromU8(projectBytes)) as ProjectData;
  if (!data || typeof data !== 'object' || !data.wall || !data.grid || !Array.isArray(data.frames)) {
    throw new Error('Arquivo de projeto inválido.');
  }

  for (const frame of data.frames) {
    for (const key of ARTWORK_KEYS) {
      const val = frame.artwork[key];
      if (!val || !val.startsWith('asset:')) continue;
      const path = val.slice('asset:'.length);
      const bytes = unzipped[path];
      if (bytes) {
        const ext = path.split('.').pop() || 'png';
        frame.artwork[key] = bytesToDataUrl(bytes, ext);
      } else {
        frame.artwork[key] = undefined;
      }
    }
  }

  return data;
}
