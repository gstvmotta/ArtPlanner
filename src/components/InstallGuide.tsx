import { useEffect, useMemo, useState } from 'react';
import { useWallStore } from '../store/useWallStore';
import type { Frame } from '../types';
import { canvasCaptureRef } from '../utils/canvasCapture';

const SVG_MAX_WIDTH = 700;

interface InstallGuideProps {
  onClose: () => void;
}

interface GapLine {
  axis: 'h' | 'v';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  midX: number;
  midY: number;
  cm: number;
}

function rangesOverlap(aFrom: number, aTo: number, bFrom: number, bTo: number): boolean {
  return aFrom < bTo && bFrom < aTo;
}

function computeGapLines(frames: Frame[]): GapLine[] {
  const bounds = frames.map((f) => ({
    left: f.xCm - f.widthCm / 2,
    right: f.xCm + f.widthCm / 2,
    top: f.yCm - f.heightCm / 2,
    bottom: f.yCm + f.heightCm / 2,
  }));

  const lines: GapLine[] = [];

  for (let i = 0; i < frames.length; i++) {
    // nearest neighbour to the right (horizontal gap)
    let bestRight: { gap: number; other: typeof bounds[number] } | null = null;
    for (let j = 0; j < frames.length; j++) {
      if (i === j) continue;
      const a = bounds[i];
      const b = bounds[j];
      if (b.left < a.right) continue; // only consider frames to the right
      if (!rangesOverlap(a.top, a.bottom, b.top, b.bottom)) continue;
      const gap = b.left - a.right;
      if (gap > 0 && (!bestRight || gap < bestRight.gap)) bestRight = { gap, other: b };
    }
    if (bestRight) {
      const a = bounds[i];
      const midY = (Math.max(a.top, bestRight.other.top) + Math.min(a.bottom, bestRight.other.bottom)) / 2;
      lines.push({
        axis: 'h',
        x1: a.right,
        y1: midY,
        x2: bestRight.other.left,
        y2: midY,
        midX: (a.right + bestRight.other.left) / 2,
        midY,
        cm: bestRight.gap,
      });
    }

    // nearest neighbour below (vertical gap)
    let bestBelow: { gap: number; other: typeof bounds[number] } | null = null;
    for (let j = 0; j < frames.length; j++) {
      if (i === j) continue;
      const a = bounds[i];
      const b = bounds[j];
      if (b.top < a.bottom) continue; // only consider frames below
      if (!rangesOverlap(a.left, a.right, b.left, b.right)) continue;
      const gap = b.top - a.bottom;
      if (gap > 0 && (!bestBelow || gap < bestBelow.gap)) bestBelow = { gap, other: b };
    }
    if (bestBelow) {
      const a = bounds[i];
      const midX = (Math.max(a.left, bestBelow.other.left) + Math.min(a.right, bestBelow.other.right)) / 2;
      lines.push({
        axis: 'v',
        x1: midX,
        y1: a.bottom,
        x2: midX,
        y2: bestBelow.other.top,
        midX,
        midY: (a.bottom + bestBelow.other.top) / 2,
        cm: bestBelow.gap,
      });
    }
  }

  return lines;
}

export function InstallGuide({ onClose }: InstallGuideProps) {
  const wall = useWallStore((s) => s.wall);
  const frames = useWallStore((s) => s.frames);

  const scale = SVG_MAX_WIDTH / wall.widthCm;
  const svgHeight = wall.heightCm * scale;
  const fontSize = Math.max(4, wall.widthCm * 0.014);
  const tickSize = Math.max(1.5, wall.widthCm * 0.006);

  const gapLines = useMemo(() => computeGapLines(frames), [frames]);

  const [wallSnapshot, setWallSnapshot] = useState<string | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const canvas = canvasCaptureRef.current;
      if (canvas) {
        try {
          setWallSnapshot(canvas.toDataURL('image/png'));
        } catch {
          setWallSnapshot(null);
        }
      }
    });
    return () => cancelAnimationFrame(id);
  }, []);

  function handleDownloadImage() {
    if (!wallSnapshot) return;
    const a = document.createElement('a');
    a.href = wallSnapshot;
    a.download = 'parede.png';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div className="install-guide">
      <div className="install-guide-toolbar no-print">
        <button className="btn btn-primary" onClick={() => window.print()}>
          Imprimir gabarito
        </button>
        <button className="btn" onClick={handleDownloadImage} disabled={!wallSnapshot}>
          Baixar imagem da parede
        </button>
        <button className="btn" onClick={onClose}>
          Fechar
        </button>
      </div>

      <h2>Gabarito de instalação</h2>
      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
        Parede: {wall.widthCm} × {wall.heightCm} cm. Coordenadas medidas a partir do canto
        superior esquerdo da parede. Marque cada ponto com fita métrica e nível antes de fixar o
        velcro.
      </p>

      {wallSnapshot && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 8px' }}>
            Visualização da parede
          </h3>
          <img
            src={wallSnapshot}
            alt="Visualização 3D da parede"
            style={{
              maxWidth: SVG_MAX_WIDTH,
              width: '100%',
              borderRadius: 8,
              border: '1px solid #999',
              display: 'block',
            }}
          />
        </div>
      )}

      <svg
        width={SVG_MAX_WIDTH}
        height={svgHeight}
        viewBox={`0 0 ${wall.widthCm} ${wall.heightCm}`}
        style={{ border: '1px solid #999', background: '#fafafa' }}
      >
        {frames.map((frame) => {
          const left = frame.xCm - frame.widthCm / 2;
          const top = frame.yCm - frame.heightCm / 2;
          return (
            <g key={frame.id}>
              <rect
                x={left}
                y={top}
                width={frame.widthCm}
                height={frame.heightCm}
                fill="none"
                stroke="#999"
                strokeDasharray="2,2"
                strokeWidth={0.5}
              />
              <text
                x={frame.xCm}
                y={frame.yCm}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={fontSize}
                fill="#666"
              >
                {frame.widthCm}×{frame.heightCm}
              </text>
              {frame.fixings.positions.map((pos, i) => (
                <g key={i}>
                  <circle cx={pos.wallOffset.x} cy={pos.wallOffset.y} r={1.5} fill="#c0392b" />
                  <line
                    x1={pos.wallOffset.x - 2.5}
                    y1={pos.wallOffset.y}
                    x2={pos.wallOffset.x + 2.5}
                    y2={pos.wallOffset.y}
                    stroke="#c0392b"
                    strokeWidth={0.4}
                  />
                  <line
                    x1={pos.wallOffset.x}
                    y1={pos.wallOffset.y - 2.5}
                    x2={pos.wallOffset.x}
                    y2={pos.wallOffset.y + 2.5}
                    stroke="#c0392b"
                    strokeWidth={0.4}
                  />
                </g>
              ))}
            </g>
          );
        })}

        {gapLines.map((g, i) => (
          <g key={i}>
            <line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke="#3b82f6" strokeWidth={0.5} />
            {g.axis === 'h' ? (
              <>
                <line x1={g.x1} y1={g.y1 - tickSize} x2={g.x1} y2={g.y1 + tickSize} stroke="#3b82f6" strokeWidth={0.5} />
                <line x1={g.x2} y1={g.y2 - tickSize} x2={g.x2} y2={g.y2 + tickSize} stroke="#3b82f6" strokeWidth={0.5} />
              </>
            ) : (
              <>
                <line x1={g.x1 - tickSize} y1={g.y1} x2={g.x1 + tickSize} y2={g.y1} stroke="#3b82f6" strokeWidth={0.5} />
                <line x1={g.x2 - tickSize} y1={g.y2} x2={g.x2 + tickSize} y2={g.y2} stroke="#3b82f6" strokeWidth={0.5} />
              </>
            )}
            <rect
              x={g.midX - fontSize * 1.4}
              y={g.midY - fontSize * 0.7}
              width={fontSize * 2.8}
              height={fontSize * 1.4}
              fill="#fafafa"
            />
            <text
              x={g.midX}
              y={g.midY}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={fontSize}
              fill="#2563eb"
              fontWeight="bold"
            >
              {Math.round(g.cm)} cm
            </text>
          </g>
        ))}
      </svg>

      <table className="install-guide-table">
        <thead>
          <tr>
            <th>Quadro</th>
            <th>Tamanho</th>
            <th>Fixadores</th>
            <th>Posições na parede (X, Y a partir do canto sup. esquerdo, em cm)</th>
          </tr>
        </thead>
        <tbody>
          {frames.map((frame, idx) => (
            <tr key={frame.id}>
              <td>Quadro {idx + 1}</td>
              <td>
                {frame.widthCm} × {frame.heightCm} cm
              </td>
              <td>{frame.fixings.count}</td>
              <td>
                {frame.fixings.positions
                  .map((p) => `(${p.wallOffset.x.toFixed(1)}, ${p.wallOffset.y.toFixed(1)})`)
                  .join('  •  ')}
              </td>
            </tr>
          ))}
          {frames.length === 0 && (
            <tr>
              <td colSpan={4} style={{ color: 'var(--text-faint)' }}>
                Nenhum quadro adicionado ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
