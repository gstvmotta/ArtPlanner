import { useWallStore } from '../store/useWallStore';

const SVG_MAX_WIDTH = 700;

interface InstallGuideProps {
  onClose: () => void;
}

export function InstallGuide({ onClose }: InstallGuideProps) {
  const wall = useWallStore((s) => s.wall);
  const frames = useWallStore((s) => s.frames);

  const scale = SVG_MAX_WIDTH / wall.widthCm;
  const svgHeight = wall.heightCm * scale;

  return (
    <div className="install-guide">
      <div className="install-guide-toolbar no-print">
        <button className="btn btn-primary" onClick={() => window.print()}>
          Imprimir gabarito
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
