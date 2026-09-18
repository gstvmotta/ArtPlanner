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

const SNAP_THRESHOLD_CM = 0.5;
const MAX_LABEL_GAP_CM = 250;

interface Candidate {
  value: number;
  diff: number;
  guide: Guide;
}

function considerCandidate(
  best: Candidate | null,
  mVal: number,
  oVal: number,
  movingCenter: number,
  axis: 'v' | 'h',
  from: number,
  to: number,
): Candidate | null {
  const diff = Math.abs(mVal - oVal);
  if (diff >= SNAP_THRESHOLD_CM) return best;
  if (best && diff >= best.diff) return best;
  return {
    value: movingCenter + (oVal - mVal),
    diff,
    guide: { axis, pos: oVal, from, to },
  };
}

function findBestX(
  moving: FrameBounds,
  others: FrameBounds[],
  wallWidthCm: number,
  wallHeightCm: number,
): Candidate | null {
  let best: Candidate | null = null;
  for (const other of others) {
    const from = Math.min(moving.top, other.top) - 20;
    const to = Math.max(moving.bottom, other.bottom) + 20;
    best = considerCandidate(best, moving.left, other.left, moving.centerX, 'v', from, to);
    best = considerCandidate(best, moving.left, other.right, moving.centerX, 'v', from, to);
    best = considerCandidate(best, moving.centerX, other.centerX, moving.centerX, 'v', from, to);
    best = considerCandidate(best, moving.right, other.left, moving.centerX, 'v', from, to);
    best = considerCandidate(best, moving.right, other.right, moving.centerX, 'v', from, to);
  }
  const wallCenterX = wallWidthCm / 2;
  best = considerCandidate(best, moving.centerX, wallCenterX, moving.centerX, 'v', 0, wallHeightCm);
  return best;
}

function findBestY(
  moving: FrameBounds,
  others: FrameBounds[],
  wallWidthCm: number,
  wallHeightCm: number,
): Candidate | null {
  let best: Candidate | null = null;
  for (const other of others) {
    const from = Math.min(moving.left, other.left) - 20;
    const to = Math.max(moving.right, other.right) + 20;
    best = considerCandidate(best, moving.top, other.top, moving.centerY, 'h', from, to);
    best = considerCandidate(best, moving.top, other.bottom, moving.centerY, 'h', from, to);
    best = considerCandidate(best, moving.centerY, other.centerY, moving.centerY, 'h', from, to);
    best = considerCandidate(best, moving.bottom, other.top, moving.centerY, 'h', from, to);
    best = considerCandidate(best, moving.bottom, other.bottom, moving.centerY, 'h', from, to);
  }
  const wallCenterY = wallHeightCm / 2;
  best = considerCandidate(best, moving.centerY, wallCenterY, moving.centerY, 'h', 0, wallWidthCm);
  return best;
}

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

  const bestX = findBestX(moving, others, wallWidthCm, wallHeightCm);
  const bestY = findBestY(moving, others, wallWidthCm, wallHeightCm);

  const finalCenterX = bestX?.value ?? moving.centerX;
  const finalCenterY = bestY?.value ?? moving.centerY;

  const guides: Guide[] = [];
  if (bestX) guides.push(bestX.guide);
  if (bestY) guides.push(bestY.guide);

  const finalLeft = finalCenterX - halfW;
  const finalRight = finalCenterX + halfW;
  const finalTop = finalCenterY - halfH;
  const finalBottom = finalCenterY + halfH;

  // nearest-neighbour distance labels (gap between facing edges), computed
  // against the *final* (post-snap) position so the label always matches
  // where the frame actually is
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
