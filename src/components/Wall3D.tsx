import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { Environment, Html, Line } from '@react-three/drei';
import type { PerspectiveCamera } from 'three';
import { useWallStore } from '../store/useWallStore';
import { Frame3D } from './Frame3D';
import { getMaterialTexture } from '../utils/proceduralTextures';
import { computeAlignment, type DistanceLabel, type FrameBounds, type Guide } from '../utils/alignment';

const CM_TO_M = 1 / 100;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 3;
const FOV_DEG = 45;

const DRAG_THRESHOLD_M = 0.01;

interface DragState {
  frameId: string;
  offsetXM: number;
  offsetYM: number;
  startX: number;
  startY: number;
  moving: boolean;
}

function computeFitDistance(wallWM: number, wallHM: number, fovDeg: number, aspect: number): number {
  const vFov = (fovDeg * Math.PI) / 180;
  const distForHeight = wallHM / 2 / Math.tan(vFov / 2);
  const distForWidth = wallWM / 2 / (Math.tan(vFov / 2) * aspect);
  return Math.min(distForHeight, distForWidth) * 1.03;
}

function CameraRig({
  wallWM,
  wallHM,
  zoom,
  panX,
  panY,
}: {
  wallWM: number;
  wallHM: number;
  zoom: number;
  panX: number;
  panY: number;
}) {
  const { camera, size } = useThree();

  useEffect(() => {
    const cam = camera as PerspectiveCamera;
    const aspect = size.width / size.height || 1;
    const fitDistance = computeFitDistance(wallWM, wallHM, cam.fov, aspect);
    cam.position.set(panX, panY, fitDistance * zoom);
    cam.near = 0.05;
    cam.far = fitDistance * MAX_ZOOM * 3 + 5;
    cam.updateProjectionMatrix();
  }, [camera, size, wallWM, wallHM, zoom, panX, panY]);

  return null;
}

function GridOverlay({ wallWM, wallHM, cellM }: { wallWM: number; wallHM: number; cellM: number }) {
  const halfW = wallWM / 2;
  const halfH = wallHM / 2;
  const step = cellM > 0 ? cellM : 0.05;
  const linesV: number[][][] = [];
  const linesH: number[][][] = [];
  for (let x = -halfW; x <= halfW + 1e-6; x += step) {
    linesV.push([
      [x, -halfH, 0.003],
      [x, halfH, 0.003],
    ]);
  }
  for (let y = -halfH; y <= halfH + 1e-6; y += step) {
    linesH.push([
      [-halfW, y, 0.003],
      [halfW, y, 0.003],
    ]);
  }
  return (
    <>
      {[...linesV, ...linesH].map((pts, i) => (
        <Line key={i} points={pts as [number, number, number][]} color="#a3e635" lineWidth={1.5} transparent opacity={0.55} />
      ))}
    </>
  );
}

function AlignmentGuides({ guides, wallWidthCm, wallHeightCm }: { guides: Guide[]; wallWidthCm: number; wallHeightCm: number }) {
  const cmToWorldX = (cm: number) => (cm - wallWidthCm / 2) * CM_TO_M;
  const cmToWorldY = (cm: number) => -(cm - wallHeightCm / 2) * CM_TO_M;
  return (
    <>
      {guides.map((g, i) => {
        const points: [number, number, number][] =
          g.axis === 'v'
            ? [
                [cmToWorldX(g.pos), cmToWorldY(g.from), 0.004],
                [cmToWorldX(g.pos), cmToWorldY(g.to), 0.004],
              ]
            : [
                [cmToWorldX(g.from), cmToWorldY(g.pos), 0.004],
                [cmToWorldX(g.to), cmToWorldY(g.pos), 0.004],
              ];
        return <Line key={i} points={points} color="#ff5fb0" lineWidth={1.5} transparent opacity={0.9} />;
      })}
    </>
  );
}

function DistanceLabels({ labels, wallWidthCm, wallHeightCm }: { labels: DistanceLabel[]; wallWidthCm: number; wallHeightCm: number }) {
  const cmToWorldX = (cm: number) => (cm - wallWidthCm / 2) * CM_TO_M;
  const cmToWorldY = (cm: number) => -(cm - wallHeightCm / 2) * CM_TO_M;
  return (
    <>
      {labels.map((l, i) => (
        <Html key={i} position={[cmToWorldX(l.xCm), cmToWorldY(l.yCm), 0.01]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className="distance-label">{Math.round(l.cm)} cm</div>
        </Html>
      ))}
    </>
  );
}

function Scene({ zoom, panX, panY }: { zoom: number; panX: number; panY: number }) {
  const wall = useWallStore((s) => s.wall);
  const grid = useWallStore((s) => s.grid);
  const frames = useWallStore((s) => s.frames);
  const moveFrame = useWallStore((s) => s.moveFrame);
  const selectFrame = useWallStore((s) => s.selectFrame);
  const selectedFrameId = useWallStore((s) => s.selectedFrameId);
  const duplicateFrame = useWallStore((s) => s.duplicateFrame);
  const removeFrame = useWallStore((s) => s.removeFrame);
  const beginHistoryEntry = useWallStore((s) => s.beginHistoryEntry);

  const wallWM = wall.widthCm * CM_TO_M;
  const wallHM = wall.heightCm * CM_TO_M;

  const wallTex = useMemo(() => getMaterialTexture('wall', wall.colorHex), [wall.colorHex]);

  const dragRef = useRef<DragState | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [distLabels, setDistLabels] = useState<DistanceLabel[]>([]);

  function worldToCm(xM: number, yM: number) {
    return {
      xCm: xM * 100 + wall.widthCm / 2,
      yCm: wall.heightCm / 2 - yM * 100,
    };
  }

  function handleFrameDragStart(frameId: string, event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    const frame = frames.find((f) => f.id === frameId);
    if (!frame) return;
    selectFrame(frameId);
    const frameWorldX = (frame.xCm - wall.widthCm / 2) * CM_TO_M;
    const frameWorldY = -(frame.yCm - wall.heightCm / 2) * CM_TO_M;
    dragRef.current = {
      frameId,
      offsetXM: frameWorldX - event.point.x,
      offsetYM: frameWorldY - event.point.y,
      startX: event.point.x,
      startY: event.point.y,
      moving: false,
    };
    (event.target as Element).setPointerCapture?.(event.pointerId);
  }

  function handleSurfacePointerMove(event: ThreeEvent<PointerEvent>) {
    const drag = dragRef.current;
    if (!drag) return;
    if (!drag.moving) {
      const dist = Math.hypot(event.point.x - drag.startX, event.point.y - drag.startY);
      if (dist < DRAG_THRESHOLD_M) return;
      drag.moving = true;
      setDraggingId(drag.frameId);
      beginHistoryEntry();
    }
    const worldX = event.point.x + drag.offsetXM;
    const worldY = event.point.y + drag.offsetYM;
    const rawPos = worldToCm(worldX, worldY);
    const movingFrame = frames.find((f) => f.id === drag.frameId);
    if (!movingFrame) return;

    const movingBounds: FrameBounds = {
      id: drag.frameId,
      left: rawPos.xCm - movingFrame.widthCm / 2,
      right: rawPos.xCm + movingFrame.widthCm / 2,
      top: rawPos.yCm - movingFrame.heightCm / 2,
      bottom: rawPos.yCm + movingFrame.heightCm / 2,
      centerX: rawPos.xCm,
      centerY: rawPos.yCm,
    };
    const otherBounds: FrameBounds[] = frames
      .filter((f) => f.id !== drag.frameId)
      .map((f) => ({
        id: f.id,
        left: f.xCm - f.widthCm / 2,
        right: f.xCm + f.widthCm / 2,
        top: f.yCm - f.heightCm / 2,
        bottom: f.yCm + f.heightCm / 2,
        centerX: f.xCm,
        centerY: f.yCm,
      }));

    const result = computeAlignment(movingBounds, otherBounds, wall.widthCm, wall.heightCm);
    const alignedX = result.guides.some((g) => g.axis === 'v');
    const alignedY = result.guides.some((g) => g.axis === 'h');

    const finalXCm = alignedX
      ? result.xCm
      : grid.snapEnabled && grid.cellSizeCm > 0
        ? Math.round(rawPos.xCm / grid.cellSizeCm) * grid.cellSizeCm
        : rawPos.xCm;
    const finalYCm = alignedY
      ? result.yCm
      : grid.snapEnabled && grid.cellSizeCm > 0
        ? Math.round(rawPos.yCm / grid.cellSizeCm) * grid.cellSizeCm
        : rawPos.yCm;

    setGuides(result.guides);
    setDistLabels(result.labels);
    moveFrame(drag.frameId, finalXCm, finalYCm, true);
  }

  function handleSurfacePointerUp() {
    dragRef.current = null;
    setDraggingId(null);
    setGuides([]);
    setDistLabels([]);
  }

  return (
    <>
      <CameraRig wallWM={wallWM} wallHM={wallHM} zoom={zoom} panX={panX} panY={panY} />

      <ambientLight intensity={0.22} />
      <directionalLight
        castShadow
        position={[-wallWM * 0.45, wallHM * 0.55, Math.max(wallWM, wallHM) * 0.55]}
        intensity={3}
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-wallWM}
        shadow-camera-right={wallWM}
        shadow-camera-top={wallHM}
        shadow-camera-bottom={-wallHM}
        shadow-camera-near={0.1}
        shadow-camera-far={wallWM + wallHM + 5}
        shadow-bias={-0.00015}
        shadow-radius={6}
      />

      <Environment preset="apartment" environmentIntensity={0.25} />

      {/* wall */}
      <mesh
        receiveShadow
        position={[0, 0, 0]}
        onPointerDown={() => selectFrame(null)}
      >
        <planeGeometry args={[wallWM, wallHM]} />
        <meshStandardMaterial
          map={wallTex.map}
          roughnessMap={wallTex.roughnessMap}
          roughness={0.55}
          envMapIntensity={0.4}
        />
      </mesh>

      {draggingId && <GridOverlay wallWM={wallWM} wallHM={wallHM} cellM={grid.cellSizeCm * CM_TO_M} />}
      {draggingId && guides.length > 0 && (
        <AlignmentGuides guides={guides} wallWidthCm={wall.widthCm} wallHeightCm={wall.heightCm} />
      )}
      {draggingId && distLabels.length > 0 && (
        <DistanceLabels labels={distLabels} wallWidthCm={wall.widthCm} wallHeightCm={wall.heightCm} />
      )}

      {/* invisible drag surface, larger than the wall so frames can be dragged to the edges */}
      <mesh
        position={[0, 0, 0.001]}
        onPointerMove={handleSurfacePointerMove}
        onPointerUp={handleSurfacePointerUp}
        onPointerLeave={handleSurfacePointerUp}
      >
        <planeGeometry args={[wallWM * 3, wallHM * 3]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {frames.map((frame) => {
        const posXM = (frame.xCm - wall.widthCm / 2) * CM_TO_M;
        const posYM = -(frame.yCm - wall.heightCm / 2) * CM_TO_M;
        return (
          <Frame3D
            key={frame.id}
            frame={frame}
            posXM={posXM}
            posYM={posYM}
            selected={selectedFrameId === frame.id}
            dragging={draggingId === frame.id}
            onDragStart={(e) => handleFrameDragStart(frame.id, e)}
            onDuplicate={() => duplicateFrame(frame.id)}
            onRemove={() => removeFrame(frame.id)}
          />
        );
      })}
    </>
  );
}

interface PanDrag {
  startClientX: number;
  startClientY: number;
  startPanX: number;
  startPanY: number;
}

export function Wall3D() {
  const wall = useWallStore((s) => s.wall);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panDragRef = useRef<PanDrag | null>(null);

  function clampZoom(z: number) {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
  }

  function resetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => clampZoom(z * (1 + e.deltaY * 0.0012)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null) {
      const tag = (target as HTMLElement)?.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space' || isTypingTarget(e.target)) return;
      e.preventDefault();
      setSpaceHeld(true);
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code !== 'Space') return;
      setSpaceHeld(false);
      setIsPanning(false);
      panDragRef.current = null;
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  function handlePanPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    panDragRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    };
    setIsPanning(true);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function handlePanPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = panDragRef.current;
    const el = containerRef.current;
    if (!drag || !el) return;
    const rect = el.getBoundingClientRect();
    const aspect = rect.width / rect.height || 1;
    const dist = computeFitDistance(wall.widthCm * CM_TO_M, wall.heightCm * CM_TO_M, FOV_DEG, aspect) * zoom;
    const vFov = (FOV_DEG * Math.PI) / 180;
    const visibleH = 2 * dist * Math.tan(vFov / 2);
    const visibleW = visibleH * aspect;
    const dxPx = e.clientX - drag.startClientX;
    const dyPx = e.clientY - drag.startClientY;
    const worldDx = (dxPx / rect.width) * visibleW;
    const worldDy = (dyPx / rect.height) * visibleH;
    setPan({ x: drag.startPanX - worldDx, y: drag.startPanY + worldDy });
  }

  function handlePanPointerUp() {
    panDragRef.current = null;
    setIsPanning(false);
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        shadows
        camera={{ position: [0, 0, 5], fov: FOV_DEG }}
        style={{ width: '100%', height: '100%' }}
      >
        <Scene zoom={zoom} panX={pan.x} panY={pan.y} />
      </Canvas>

      <div
        onPointerDown={handlePanPointerDown}
        onPointerMove={handlePanPointerMove}
        onPointerUp={handlePanPointerUp}
        onPointerLeave={handlePanPointerUp}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: spaceHeld ? 'auto' : 'none',
          cursor: spaceHeld ? (isPanning ? 'grabbing' : 'grab') : 'default',
          touchAction: 'none',
        }}
      />

      <div className="zoom-controls no-print">
        <button className="icon-btn" title="Aproximar" onClick={() => setZoom((z) => clampZoom(z * 0.85))}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M21 21l-4.3-4.3M8 11h6M11 8v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <button className="icon-btn" title="Ajustar à tela" onClick={resetView}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 4H5a1 1 0 0 0-1 1v4M15 4h4a1 1 0 0 1 1 1v4M9 20H5a1 1 0 0 1-1-1v-4M15 20h4a1 1 0 0 0 1-1v-4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <button className="icon-btn" title="Afastar" onClick={() => setZoom((z) => clampZoom(z * 1.18))}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M21 21l-4.3-4.3M8 11h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
