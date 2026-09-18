import { useState } from 'react';
import { useWallStore } from '../store/useWallStore';
import type { FrameMaterialType, FrameType, GlassType } from '../types';
import { ArtworkEditorModal } from './ArtworkEditorModal';
import type { Quad } from '../utils/perspectiveWarp';

const materialOptions: { value: FrameMaterialType; label: string; defaultColor: string }[] = [
  { value: 'wood', label: 'Madeira', defaultColor: '#6b4a30' },
  { value: 'metal', label: 'Metal', defaultColor: '#8a8f96' },
  { value: 'mdf', label: 'MDF', defaultColor: '#3a3a3a' },
];

const glassOptions: { value: GlassType; label: string }[] = [
  { value: 'clear', label: 'Transparente' },
  { value: 'antiglare', label: 'Antirreflexo' },
  { value: 'matte', label: 'Fosco' },
  { value: 'none', label: 'Sem vidro' },
];

export function FramePropertiesPanel() {
  const frames = useWallStore((s) => s.frames);
  const selectedFrameId = useWallStore((s) => s.selectedFrameId);
  const updateFrame = useWallStore((s) => s.updateFrame);
  const resizeFrame = useWallStore((s) => s.resizeFrame);
  const rotateFrame = useWallStore((s) => s.rotateFrame);
  const [tab, setTab] = useState<'moldura' | 'arte'>('moldura');
  const [artworkModalOpen, setArtworkModalOpen] = useState(false);

  const frame = frames.find((f) => f.id === selectedFrameId);

  if (!frame) return null;

  const isObject = frame.frameType === 'object';

  function setFrameType(type: FrameType) {
    updateFrame(frame!.id, { frameType: type });
  }

  function handleObjectFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      updateFrame(frame!.id, {
        artwork: { imageUrl: dataUrl, warpedTextureUrl: dataUrl },
      });
    };
    reader.readAsDataURL(file);
  }

  return (
    <>
      <div className="panel-tabs">
        <button className={tab === 'moldura' ? 'active' : ''} onClick={() => setTab('moldura')}>
          Moldura
        </button>
        <button className={tab === 'arte' ? 'active' : ''} onClick={() => setTab('arte')}>
          Arte
        </button>
      </div>

      {tab === 'moldura' && (
        <div className="panel-body">
          <div className="segmented">
            <button className={!isObject ? 'active' : ''} onClick={() => setFrameType('framed')}>
              Com moldura
            </button>
            <button className={isObject ? 'active' : ''} onClick={() => setFrameType('object')}>
              Objeto (sem moldura)
            </button>
          </div>

          <label className="field">
            Largura (cm)
            <input
              type="number"
              value={frame.widthCm}
              min={5}
              onChange={(e) => resizeFrame(frame.id, Number(e.target.value), frame.heightCm)}
            />
          </label>

          <label className="field">
            Altura (cm)
            <input
              type="number"
              value={frame.heightCm}
              min={5}
              onChange={(e) => resizeFrame(frame.id, frame.widthCm, Number(e.target.value))}
            />
          </label>

          <button className="btn btn-block" onClick={() => rotateFrame(frame.id)}>
            Rotacionar ({frame.orientation === 'portrait' ? 'Retrato' : 'Paisagem'})
          </button>

          {!isObject && (
            <>
              <label className="field">
                Material da moldura
                <select
                  value={frame.material.type}
                  onChange={(e) => {
                    const opt = materialOptions.find((m) => m.value === e.target.value)!;
                    updateFrame(frame.id, {
                      material: { ...frame.material, type: opt.value, colorHex: opt.defaultColor },
                    });
                  }}
                >
                  {materialOptions.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                Cor da moldura
                <input
                  type="color"
                  value={frame.material.colorHex}
                  onChange={(e) =>
                    updateFrame(frame.id, { material: { ...frame.material, colorHex: e.target.value } })
                  }
                />
              </label>

              <label className="field">
                Espessura do perfil (cm)
                <input
                  type="number"
                  step={0.5}
                  min={0.5}
                  value={frame.material.profileWidthCm}
                  onChange={(e) =>
                    updateFrame(frame.id, {
                      material: { ...frame.material, profileWidthCm: Number(e.target.value) },
                    })
                  }
                />
              </label>

              <label className="field">
                Vidro
                <select
                  value={frame.glass.type}
                  onChange={(e) =>
                    updateFrame(frame.id, { glass: { type: e.target.value as GlassType } })
                  }
                >
                  {glassOptions.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field field-row">
                <input
                  type="checkbox"
                  checked={frame.matting.enabled}
                  onChange={(e) =>
                    updateFrame(frame.id, { matting: { ...frame.matting, enabled: e.target.checked } })
                  }
                />
                Paspatur
              </label>

              {frame.matting.enabled && (
                <>
                  <label className="field">
                    Largura do paspatur (cm)
                    <input
                      type="number"
                      step={0.5}
                      min={0}
                      value={frame.matting.widthCm}
                      onChange={(e) =>
                        updateFrame(frame.id, {
                          matting: { ...frame.matting, widthCm: Number(e.target.value) },
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    Cor do paspatur
                    <input
                      type="color"
                      value={frame.matting.colorHex}
                      onChange={(e) =>
                        updateFrame(frame.id, {
                          matting: { ...frame.matting, colorHex: e.target.value },
                        })
                      }
                    />
                  </label>
                </>
              )}
            </>
          )}

          <div className="fixings-note">
            <strong style={{ color: 'var(--text)' }}>Fixadores (velcro):</strong>{' '}
            {frame.fixings.count} par(es)
          </div>
        </div>
      )}

      {tab === 'arte' && (
        <div className="panel-body">
          {frame.artwork.warpedTextureUrl && (
            <img
              src={frame.artwork.warpedTextureUrl}
              alt=""
              style={{
                width: '100%',
                maxHeight: 160,
                objectFit: 'contain',
                borderRadius: 10,
                background: isObject ? 'repeating-conic-gradient(#2a2a2c 0% 25%, transparent 0% 50%) 0 0/16px 16px' : undefined,
              }}
            />
          )}

          {isObject ? (
            <>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Envie um PNG com fundo transparente (ex: uma máscara, escultura, objeto recortado). A
                sombra na parede segue exatamente o contorno da imagem.
              </p>
              <label className="btn btn-primary btn-block" style={{ cursor: 'pointer' }}>
                {frame.artwork.warpedTextureUrl ? 'Trocar PNG' : 'Enviar PNG'}
                <input type="file" accept="image/png" onChange={handleObjectFileChange} style={{ display: 'none' }} />
              </label>
            </>
          ) : (
            <button className="btn btn-primary btn-block" onClick={() => setArtworkModalOpen(true)}>
              {frame.artwork.warpedTextureUrl ? 'Trocar / reeditar arte' : 'Escanear / enviar arte'}
            </button>
          )}
        </div>
      )}

      {artworkModalOpen && (
        <ArtworkEditorModal
          initialImageUrl={frame.artwork.imageUrl}
          initialCorners={frame.artwork.cornerPoints}
          onCancel={() => setArtworkModalOpen(false)}
          onApply={({
            sourceImageUrl,
            corners,
            warpedUrl,
          }: {
            sourceImageUrl: string;
            corners: Quad;
            warpedUrl: string;
          }) => {
            updateFrame(frame.id, {
              artwork: {
                imageUrl: sourceImageUrl,
                cornerPoints: corners,
                warpedTextureUrl: warpedUrl,
              },
            });
            setArtworkModalOpen(false);
          }}
        />
      )}
    </>
  );
}
