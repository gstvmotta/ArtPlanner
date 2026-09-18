export interface FrameBounds {
  id: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
}

export interface Guide {
  axis: 'v' | 'h';
  pos: number;
  from: number;
  to: number;
}

export interface DistanceLabel {
  xCm: number;
  yCm: number;
  cm: number;
}

export interface AlignmentResult {
  xCm: number;
  yCm: number;
  guides: Guide[];
  labels: DistanceLabel[];
}

const SNAP_THRESHOLD_CM = 3;
const MAX_LABEL_GAP_CM = 250;

function rangesOverlap(aFrom: number, aTo: number, bFrom: number, bTo: number): boolean {
  return aFrom < bTo && bFrom < aTo;
}

export function computeAlignment(
  moving: FrameBounds,
  others: FrameBounds[],
  wallWidthCm: number,
  wallHeightCm: number,
): AlignmentResult {
  const halfW = (moving.right - moving.left) / 2;
  const halfH = (moving.bottom - moving.top) / 2;

  let bestXDiff = SNAP_THRESHOLD_CM;
  let snappedCenterX: number | null = null;
  let bestYDiff = SNAP_THRESHOLD_CM;
  let snappedCenterY: number | null = null;
  const guides: Guide[] = [];

  for (const other of others) {
    const xChecks: [number, number][] = [
      [moving.left, other.left],
      [moving.left, other.right],
      [moving.centerX, other.centerX],
      [moving.right, other.left],
      [moving.right, other.right],
    ];
    for (const [mVal, oVal] of xChecks) {
      const diff = Math.abs(mVal - oVal);
      if (diff < SNAP_THRESHOLD_CM) {
        const candidateCenterX = moving.centerX + (oVal - mVal);
        guides.push({
          axis: 'v',
          pos: oVal,
          from: Math.min(moving.top, other.top) - 20,
          to: Math.max(moving.bottom, other.bottom) + 20,
        });
        if (diff < bestXDiff) {
          bestXDiff = diff;
          snappedCenterX = candidateCenterX;
        }
      }
    }

    const yChecks: [number, number][] = [
      [moving.top, other.top],
      [moving.top, other.bottom],
      [moving.centerY, other.centerY],
      [moving.bottom, other.top],
      [moving.bottom, other.bottom],
    ];
    for (const [mVal, oVal] of yChecks) {
      const diff = Math.abs(mVal - oVal);
      if (diff < SNAP_THRESHOLD_CM) {
        const candidateCenterY = moving.centerY + (oVal - mVal);
        guides.push({
          axis: 'h',
          pos: oVal,
          from: Math.min(moving.left, other.left) - 20,
          to: Math.max(moving.right, other.right) + 20,
        });
        if (diff < bestYDiff) {
          bestYDiff = diff;
          snappedCenterY = candidateCenterY;
        }
      }
    }
  }

  // also align to wall center
  const wallCenterX = wallWidthCm / 2;
  const wallCenterY = wallHeightCm / 2;
  if (Math.abs(moving.centerX - wallCenterX) < SNAP_THRESHOLD_CM) {
    snappedCenterX = wallCenterX;
    guides.push({ axis: 'v', pos: wallCenterX, from: 0, to: wallHeightCm });
  }
  if (Math.abs(moving.centerY - wallCenterY) < SNAP_THRESHOLD_CM) {
    snappedCenterY = wallCenterY;
    guides.push({ axis: 'h', pos: wallCenterY, from: 0, to: wallWidthCm });
  }

  const finalCenterX = snappedCenterX ?? moving.centerX;
  const finalCenterY = snappedCenterY ?? moving.centerY;

  const finalLeft = finalCenterX - halfW;
  const finalRight = finalCenterX + halfW;
  const finalTop = finalCenterY - halfH;
  const finalBottom = finalCenterY + halfH;

  // nearest-neighbour distance labels (gap between facing edges)
  const labels: DistanceLabel[] = [];
  let bestHGap: { gap: number; label: DistanceLabel } | null = null;
  let bestVGap: { gap: number; label: DistanceLabel } | null = null;

  for (const other of others) {
    if (rangesOverlap(finalTop, finalBottom, other.top, other.bottom)) {
      let gap: number | null = null;
      let midX = 0;
      if (other.left >= finalRight) {
        gap = other.left - finalRight;
        midX = (finalRight + other.left) / 2;
      } else if (finalLeft >= other.right) {
        gap = finalLeft - other.right;
        midX = (other.right + finalLeft) / 2;
      }
      if (gap !== null && gap > 0 && gap < MAX_LABEL_GAP_CM) {
        const midY = (Math.max(finalTop, other.top) + Math.min(finalBottom, other.bottom)) / 2;
        if (!bestHGap || gap < bestHGap.gap) {
          bestHGap = { gap, label: { xCm: midX, yCm: midY, cm: gap } };
        }
      }
    }

    if (rangesOverlap(finalLeft, finalRight, other.left, other.right)) {
      let gap: number | null = null;
      let midY = 0;
      if (other.top >= finalBottom) {
        gap = other.top - finalBottom;
        midY = (finalBottom + other.top) / 2;
      } else if (finalTop >= other.bottom) {
        gap = finalTop - other.bottom;
        midY = (other.bottom + finalTop) / 2;
      }
      if (gap !== null && gap > 0 && gap < MAX_LABEL_GAP_CM) {
        const midX = (Math.max(finalLeft, other.left) + Math.min(finalRight, other.right)) / 2;
        if (!bestVGap || gap < bestVGap.gap) {
          bestVGap = { gap, label: { xCm: midX, yCm: midY, cm: gap } };
        }
      }
    }
  }

  if (bestHGap) labels.push(bestHGap.label);
  if (bestVGap) labels.push(bestVGap.label);

  return { xCm: finalCenterX, yCm: finalCenterY, guides, labels };
}
