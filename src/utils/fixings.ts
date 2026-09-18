import type { FixingPosition, FixingsConfig, Point } from '../types';

const EDGE_MARGIN_RATIO = 0.15;

function rectPositions(widthCm: number, heightCm: number, count: number): Point[] {
  const marginX = widthCm * EDGE_MARGIN_RATIO;
  const marginY = heightCm * EDGE_MARGIN_RATIO;
  const left = -widthCm / 2 + marginX;
  const right = widthCm / 2 - marginX;
  const top = -heightCm / 2 + marginY;
  const bottom = heightCm / 2 - marginY;
  const centerY = 0;

  switch (count) {
    case 1:
      return [{ x: 0, y: centerY }];
    case 2:
      return [
        { x: left, y: centerY },
        { x: right, y: centerY },
      ];
    case 4:
      return [
        { x: left, y: top },
        { x: right, y: top },
        { x: left, y: bottom },
        { x: right, y: bottom },
      ];
    case 6:
      return [
        { x: left, y: top },
        { x: right, y: top },
        { x: left, y: centerY },
        { x: right, y: centerY },
        { x: left, y: bottom },
        { x: right, y: bottom },
      ];
    default:
      return [{ x: 0, y: centerY }];
  }
}

export function fixingsCountForFrame(widthCm: number, heightCm: number): number {
  const majorSide = Math.max(widthCm, heightCm);
  if (majorSide <= 30) return 1;
  if (majorSide <= 60) return 2;
  if (majorSide <= 100) return 4;
  return 6;
}

export function calculateFixings(
  widthCm: number,
  heightCm: number,
  frameXCm: number,
  frameYCm: number,
): FixingsConfig {
  const count = fixingsCountForFrame(widthCm, heightCm);
  const frameOffsets = rectPositions(widthCm, heightCm, count);

  const positions: FixingPosition[] = frameOffsets.map((offset) => ({
    frameOffset: offset,
    wallOffset: {
      x: frameXCm + offset.x,
      y: frameYCm + offset.y,
    },
  }));

  return { type: 'velcro', count, positions };
}
