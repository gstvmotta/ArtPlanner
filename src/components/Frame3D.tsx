import { Suspense, useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import { DoubleSide } from 'three';
import type { Frame } from '../types';
import { ArtworkPlane } from './ArtworkPlane';
import { getGlassShineTexture, getMaterialTexture } from '../utils/proceduralTextures';

const CM_TO_M = 1 / 100;

interface Frame3DProps {
  frame: Frame;
  posXM: number;
  posYM: number;
  selected: boolean;
  dragging: boolean;
  onDragStart: (event: ThreeEvent<PointerEvent>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

const materialRoughness: Record<string, { roughness: number; metalness: number }> = {
  wood: { roughness: 0.65, metalness: 0 },
  metal: { roughness: 0.28, metalness: 0.9 },
  mdf: { roughness: 0.85, metalness: 0 },
};

const glassParams: Record<string, { roughness: number; transmission: number } | null> = {
  clear: { roughness: 0.015, transmission: 0.99 },
  antiglare: { roughness: 0.06, transmission: 0.96 },
  matte: { roughness: 0.4, transmission: 0.75 },
  none: null,
};

function SelectionToolbar({
  outerH,
  depth,
  onDuplicate,
  onRemove,
}: {
  outerH: number;
  depth: number;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  return (
    <Html position={[0, -outerH / 2, depth]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
      <div className="frame-toolbar" style={{ transform: 'translateY(28px)' }}>
        <button
          className="icon-btn"
          title="Duplicar quadro"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
            <path
              d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        </button>
        <button
          className="icon-btn icon-btn-danger"
          title="Remover quadro"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 7h16M9 7V4h6v3M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </Html>
  );
}

function SelectionOutline({ outerW, outerH, depth, dragging }: { outerW: number; outerH: number; depth: number; dragging: boolean }) {
  return (
    <Line
      points={[
        [-outerW / 2, outerH / 2, depth * 1.06],
        [outerW / 2, outerH / 2, depth * 1.06],
        [outerW / 2, -outerH / 2, depth * 1.06],
        [-outerW / 2, -outerH / 2, depth * 1.06],
        [-outerW / 2, outerH / 2, depth * 1.06],
      ]}
      color="#a3e635"
      lineWidth={dragging ? 3 : 2}
    />
  );
}

export function Frame3D({
  frame,
  posXM,
  posYM,
  selected,
  dragging,
  onDragStart,
  onDuplicate,
  onRemove,
}: Frame3DProps) {
  const outerW = frame.widthCm * CM_TO_M;
  const outerH = frame.heightCm * CM_TO_M;

  // ---- "object" mode: a frameless cutout (e.g. an uploaded PNG mask) ----
  if (frame.frameType === 'object') {
    const objDepth = 0.015;
    const artworkUrl = frame.artwork.warpedTextureUrl ?? frame.artwork.imageUrl;

    return (
      <group position={[posXM, posYM, 0]}>
        <mesh
          position={[0, 0, objDepth * 1.2]}
          onPointerDown={onDragStart}
          onPointerOver={() => (document.body.style.cursor = 'grab')}
          onPointerOut={() => (document.body.style.cursor = 'auto')}
        >
          <planeGeometry args={[outerW, outerH]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        {selected && (
          <>
            <SelectionOutline outerW={outerW} outerH={outerH} depth={objDepth} dragging={dragging} />
            {!dragging && (
              <SelectionToolbar outerH={outerH} depth={objDepth} onDuplicate={onDuplicate} onRemove={onRemove} />
            )}
          </>
        )}

        {artworkUrl ? (
          <Suspense fallback={null}>
            <ArtworkPlane
              url={artworkUrl}
              widthM={outerW}
              heightM={outerH}
              z={objDepth}
              castShadow
              cutout
              rotationDeg={frame.artwork.rotationDeg ?? 0}
            />
          </Suspense>
        ) : (
          <mesh position={[0, 0, objDepth]} receiveShadow castShadow>
            <planeGeometry args={[outerW, outerH]} />
            <meshStandardMaterial color="#8a8a8a" roughness={0.8} side={DoubleSide} />
          </mesh>
        )}
      </group>
    );
  }

  // ---- "framed" mode ----
  const profile = Math.max(frame.material.profileWidthCm * CM_TO_M, 0.005);
  const depth = Math.max(frame.material.depthCm * CM_TO_M, 0.01);

  const innerW = Math.max(outerW - profile * 2, 0.01);
  const innerH = Math.max(outerH - profile * 2, 0.01);

  const mattingW = frame.matting.enabled ? frame.matting.widthCm * CM_TO_M : 0;
  const artW = Math.max(innerW - mattingW * 2, 0.01);
  const artH = Math.max(innerH - mattingW * 2, 0.01);

  const matProps = materialRoughness[frame.material.type] ?? materialRoughness.wood;
  const glass = glassParams[frame.glass.type];
  const shineTex = useMemo(() => getGlassShineTexture(), []);
  const frameTex = useMemo(
    () => getMaterialTexture(frame.material.type, frame.material.colorHex),
    [frame.material.type, frame.material.colorHex],
  );

  const barY = outerH / 2 - profile / 2;
  const barX = outerW / 2 - profile / 2;

  return (
    <group position={[posXM, posYM, 0]}>
      {/* invisible drag handle covering the whole frame, always frontmost */}
      <mesh
        position={[0, 0, depth * 1.05]}
        onPointerDown={onDragStart}
        onPointerOver={() => (document.body.style.cursor = 'grab')}
        onPointerOut={() => (document.body.style.cursor = 'auto')}
      >
        <planeGeometry args={[outerW, outerH]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {selected && (
        <>
          <SelectionOutline outerW={outerW} outerH={outerH} depth={depth} dragging={dragging} />
          {!dragging && (
            <SelectionToolbar outerH={outerH} depth={depth} onDuplicate={onDuplicate} onRemove={onRemove} />
          )}
        </>
      )}

      {/* frame border: top, bottom, left, right bars */}
      <mesh position={[0, barY, depth / 2]} castShadow receiveShadow>
        <boxGeometry args={[outerW, profile, depth]} />
        <meshStandardMaterial
          map={frameTex.map}
          roughnessMap={frameTex.roughnessMap}
          {...matProps}
        />
      </mesh>
      <mesh position={[0, -barY, depth / 2]} castShadow receiveShadow>
        <boxGeometry args={[outerW, profile, depth]} />
        <meshStandardMaterial
          map={frameTex.map}
          roughnessMap={frameTex.roughnessMap}
          {...matProps}
        />
      </mesh>
      <mesh position={[-barX, 0, depth / 2]} castShadow receiveShadow>
        <boxGeometry args={[profile, outerH, depth]} />
        <meshStandardMaterial
          map={frameTex.map}
          roughnessMap={frameTex.roughnessMap}
          {...matProps}
        />
      </mesh>
      <mesh position={[barX, 0, depth / 2]} castShadow receiveShadow>
        <boxGeometry args={[profile, outerH, depth]} />
        <meshStandardMaterial
          map={frameTex.map}
          roughnessMap={frameTex.roughnessMap}
          {...matProps}
        />
      </mesh>

      {/* matting backing */}
      {frame.matting.enabled && (
        <mesh position={[0, 0, depth * 0.3]} receiveShadow>
          <planeGeometry args={[innerW, innerH]} />
          <meshStandardMaterial color={frame.matting.colorHex} roughness={0.95} />
        </mesh>
      )}

      {/* artwork */}
      {frame.artwork.warpedTextureUrl ?? frame.artwork.imageUrl ? (
        <Suspense fallback={null}>
          <ArtworkPlane
            url={(frame.artwork.warpedTextureUrl ?? frame.artwork.imageUrl)!}
            widthM={artW}
            heightM={artH}
            z={depth * 0.35}
            rotationDeg={frame.artwork.rotationDeg ?? 0}
          />
        </Suspense>
      ) : (
        <mesh position={[0, 0, depth * 0.35]} receiveShadow>
          <planeGeometry args={[artW, artH]} />
          <meshStandardMaterial color="#d8d3c6" roughness={0.9} />
        </mesh>
      )}

      {/* glass */}
      {glass && (
        <>
          <mesh position={[0, 0, depth * 0.95]}>
            <planeGeometry args={[innerW, innerH]} />
            <meshPhysicalMaterial
              roughness={glass.roughness}
              transmission={glass.transmission}
              thickness={0.01}
              ior={1.52}
              reflectivity={0.12}
              envMapIntensity={0.35}
              clearcoat={0.15}
              clearcoatRoughness={glass.roughness}
              specularIntensity={0.2}
              transparent
            />
          </mesh>
          {/* stylized diagonal shine streak, baked into a texture so it never
              spills past the glass pane's own bounds */}
          <mesh position={[0, 0, depth * 0.97]}>
            <planeGeometry args={[innerW, innerH]} />
            <meshBasicMaterial map={shineTex} color="#ffffff" transparent opacity={0.22} depthWrite={false} />
          </mesh>
        </>
      )}
    </group>
  );
}
