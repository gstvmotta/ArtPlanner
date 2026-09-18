import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { estimateOutputSize, warpQuadToRect, type Quad } from '../utils/perspectiveWarp';

interface ArtworkEditorModalProps {
  initialImageUrl?: string;
  initialCorners?: Quad;
  onCancel: () => void;
  onApply: (result: { sourceImageUrl: string; corners: Quad; warpedUrl: string }) => void;
}

const HANDLE_LABELS = ['Superior-esquerdo', 'Superior-direito', 'Inferior-direito', 'Inferior-esquerdo'];

function defaultCorners(displayW: number, displayH: number): Quad {
  const marginX = displayW * 0.12;
  const marginY = displayH * 0.12;
  return [
    { x: marginX, y: marginY },
    { x: displayW - marginX, y: marginY },
    { x: displayW - marginX, y: displayH - marginY },
    { x: marginX, y: displayH - marginY },
  ];
}

export function ArtworkEditorModal({
  initialImageUrl,
  initialCorners,
  onCancel,
  onApply,
}: ArtworkEditorModalProps) {
  const [imageUrl, setImageUrl] = useState<string | undefined>(initialImageUrl);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [corners, setCorners] = useState<Quad | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [movingShape, setMovingShape] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const moveAllRef = useRef<{ startClientX: number; startClientY: number; startCorners: Quad } | null>(null);

  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.onload = () => {
      setImageEl(img);
      const maxW = 520;
      const scale = Math.min(1, maxW / img.naturalWidth);
      const dispW = img.naturalWidth * scale;
      const dispH = img.naturalHeight * scale;
      setDisplaySize({ width: dispW, height: dispH });

      if (initialCorners) {
        const sx = dispW / img.naturalWidth;
        const sy = dispH / img.naturalHeight;
        setCorners(
          initialCorners.map((p) => ({ x: p.x * sx, y: p.y * sy })) as Quad,
        );
      } else {
        setCorners(defaultCorners(dispW, dispH));
      }
    };
    img.src = imageUrl;
  }, [imageUrl]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(null);
      setImageUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  function handleHandlePointerDown(e: ReactPointerEvent<HTMLDivElement>, index: number) {
    e.stopPropagation();
    setDragIndex(index);
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore: capture is a nicety, not required for the drag to work
    }
  }

  function handleShapePointerDown(e: ReactPointerEvent<SVGPolygonElement>) {
    if (!corners) return;
    e.stopPropagation();
    moveAllRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startCorners: corners,
    };
    setMovingShape(true);
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      // ignore: capture is a nicety, not required for the drag to work
    }
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (moveAllRef.current) {
      const { startClientX, startClientY, startCorners } = moveAllRef.current;
      let dx = e.clientX - startClientX;
      let dy = e.clientY - startClientY;
      const xs = startCorners.map((c) => c.x);
      const ys = startCorners.map((c) => c.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      dx = Math.max(-minX, Math.min(displaySize.width - maxX, dx));
      dy = Math.max(-minY, Math.min(displaySize.height - maxY, dy));
      const next = startCorners.map((c) => ({ x: c.x + dx, y: c.y + dy })) as Quad;
      setCorners(next);
      return;
    }
    if (dragIndex === null || !corners || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(displaySize.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(displaySize.height, e.clientY - rect.top));
    const next = [...corners] as Quad;
    next[dragIndex] = { x, y };
    setCorners(next);
  }

  function handlePointerUp() {
    setDragIndex(null);
    setMovingShape(false);
    moveAllRef.current = null;
  }

  function handleFlatten() {
    if (!imageEl || !corners) return;
    setProcessing(true);
    setTimeout(() => {
      const sx = imageEl.naturalWidth / displaySize.width;
      const sy = imageEl.naturalHeight / displaySize.height;
      const naturalQuad = corners.map((p) => ({ x: p.x * sx, y: p.y * sy })) as Quad;
      const { width, height } = estimateOutputSize(naturalQuad);
      const dataUrl = warpQuadToRect(imageEl, naturalQuad, width, height);
      setPreview(dataUrl);
      setProcessing(false);
    }, 0);
  }

  function handleConfirm() {
    if (!imageUrl || !corners || !preview) return;
    onApply({ sourceImageUrl: imageUrl, corners, warpedUrl: preview });
  }

  return createPortal(
    <div className="modal-overlay" onPointerDown={onCancel}>
      <div className="modal-panel" onPointerDown={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Escanear arte</h3>

        {!imageUrl && (
          <div style={{ padding: '24px 0' }}>
            <input type="file" accept="image/*" onChange={handleFileChange} />
          </div>
        )}

        {imageUrl && imageEl && corners && !preview && (
          <div style={{ width: Math.max(280, displaySize.width) }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 0 }}>
              Arraste os cantos para ajustar cada vértice, ou clique e arraste o meio da área para
              mover a marcação inteira. Depois clique em "Planificar".
            </p>
            <div
              ref={containerRef}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              style={{
                position: 'relative',
                width: displaySize.width,
                height: displaySize.height,
                touchAction: 'none',
                userSelect: 'none',
              }}
            >
              <img
                src={imageUrl}
                alt=""
                draggable={false}
                style={{ width: displaySize.width, height: displaySize.height, display: 'block' }}
              />
              <svg
                width={displaySize.width}
                height={displaySize.height}
                style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
              >
                <polygon
                  points={corners.map((c) => `${c.x},${c.y}`).join(' ')}
                  fill="rgba(163,230,53,0.18)"
                  stroke="#a3e635"
                  strokeWidth={2}
                  onPointerDown={handleShapePointerDown}
                  style={{ pointerEvents: 'auto', cursor: movingShape ? 'grabbing' : 'move' }}
                />
              </svg>
              {corners.map((c, i) => (
                <div
                  key={i}
                  title={HANDLE_LABELS[i]}
                  onPointerDown={(e) => handleHandlePointerDown(e, i)}
                  style={{
                    position: 'absolute',
                    left: c.x - 16,
                    top: c.y - 16,
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    touchAction: 'none',
                    cursor: 'grab',
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: '#a3e635',
                      border: '2px solid #0a0a0a',
                      boxShadow: '0 0 4px rgba(0,0,0,0.6)',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <button
                className="btn-primary"
                style={{ flex: 1 }}
                onClick={handleFlatten}
                disabled={processing}
              >
                {processing ? 'Processando…' : 'Planificar'}
              </button>
              <button style={{ flex: 1 }} onClick={onCancel}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {preview && (
          <div style={{ width: Math.max(280, Math.min(400, displaySize.width)) }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 0 }}>Resultado planificado:</p>
            <img
              src={preview}
              alt=""
              style={{ maxWidth: '100%', maxHeight: 400, display: 'block', borderRadius: 10 }}
            />
            <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={handleConfirm}>
                Usar esta imagem
              </button>
              <button style={{ flex: 1 }} onClick={() => setPreview(null)}>
                Ajustar cantos
              </button>
              <button style={{ flex: 1 }} onClick={onCancel}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
