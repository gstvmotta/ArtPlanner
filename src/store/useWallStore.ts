import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Frame, GridConfig, WallConfig } from '../types';
import { calculateFixings } from '../utils/fixings';
import { indexedDbStorage } from '../utils/indexedDbStorage';

function createDefaultFrame(id: string, xCm: number, yCm: number): Frame {
  const widthCm = 30;
  const heightCm = 40;
  return {
    id,
    xCm,
    yCm,
    widthCm,
    heightCm,
    orientation: 'portrait',
    frameType: 'framed',
    material: {
      type: 'wood',
      colorHex: '#6b4a30',
      profileWidthCm: 3,
      depthCm: 2,
    },
    glass: { type: 'clear' },
    matting: {
      enabled: true,
      widthCm: 5,
      colorHex: '#f5f0e6',
    },
    artwork: {},
    fixings: calculateFixings(widthCm, heightCm, xCm, yCm),
  };
}

export interface ProjectData {
  wall: WallConfig;
  grid: GridConfig;
  frames: Frame[];
}

const HISTORY_LIMIT = 60;

interface WallStore extends ProjectData {
  selectedFrameId: string | null;
  undoStack: ProjectData[];
  redoStack: ProjectData[];

  setWall: (wall: Partial<WallConfig>) => void;
  setGrid: (grid: Partial<GridConfig>) => void;
  addFrame: () => void;
  removeFrame: (id: string) => void;
  duplicateFrame: (id: string) => void;
  updateFrame: (id: string, patch: Partial<Frame>) => void;
  moveFrame: (id: string, xCm: number, yCm: number, skipSnap?: boolean) => void;
  resizeFrame: (id: string, widthCm: number, heightCm: number) => void;
  rotateFrame: (id: string) => void;
  selectFrame: (id: string | null) => void;
  loadProject: (data: ProjectData) => void;
  beginHistoryEntry: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

function snapValue(value: number, cellSizeCm: number, enabled: boolean): number {
  if (!enabled || cellSizeCm <= 0) return value;
  return Math.round(value / cellSizeCm) * cellSizeCm;
}

function snapshotOf(state: ProjectData): ProjectData {
  return { wall: state.wall, grid: state.grid, frames: state.frames };
}

export const useWallStore = create<WallStore>()(
  persist(
    (set, get) => ({
      wall: {
        widthCm: 300,
        heightCm: 240,
        colorHex: '#e8e4da',
      },
      grid: {
        cellSizeCm: 5,
        snapEnabled: true,
        showGuides: true,
      },
      frames: [],
      selectedFrameId: null,
      undoStack: [],
      redoStack: [],

      beginHistoryEntry: () => {
        const state = get();
        set({
          undoStack: [...state.undoStack, snapshotOf(state)].slice(-HISTORY_LIMIT),
          redoStack: [],
        });
      },

      setWall: (patch) => {
        const state = get();
        set({
          wall: { ...state.wall, ...patch },
          undoStack: [...state.undoStack, snapshotOf(state)].slice(-HISTORY_LIMIT),
          redoStack: [],
        });
      },

      setGrid: (patch) => set((state) => ({ grid: { ...state.grid, ...patch } })),

      addFrame: () => {
        const state = get();
        const id = crypto.randomUUID();
        const frame = createDefaultFrame(id, state.wall.widthCm / 2, state.wall.heightCm / 2);
        set({
          frames: [...state.frames, frame],
          selectedFrameId: id,
          undoStack: [...state.undoStack, snapshotOf(state)].slice(-HISTORY_LIMIT),
          redoStack: [],
        });
      },

      removeFrame: (id) => {
        const state = get();
        set({
          frames: state.frames.filter((f) => f.id !== id),
          selectedFrameId: state.selectedFrameId === id ? null : state.selectedFrameId,
          undoStack: [...state.undoStack, snapshotOf(state)].slice(-HISTORY_LIMIT),
          redoStack: [],
        });
      },

      duplicateFrame: (id) => {
        const state = get();
        const original = state.frames.find((f) => f.id === id);
        if (!original) return;
        const offset = state.grid.cellSizeCm > 0 ? state.grid.cellSizeCm : 10;
        const newId = crypto.randomUUID();
        const xCm = Math.min(original.xCm + offset, state.wall.widthCm - original.widthCm / 2);
        const yCm = Math.min(original.yCm + offset, state.wall.heightCm - original.heightCm / 2);
        const clone: Frame = {
          ...original,
          id: newId,
          xCm,
          yCm,
          fixings: calculateFixings(original.widthCm, original.heightCm, xCm, yCm),
        };
        set({
          frames: [...state.frames, clone],
          selectedFrameId: newId,
          undoStack: [...state.undoStack, snapshotOf(state)].slice(-HISTORY_LIMIT),
          redoStack: [],
        });
      },

      updateFrame: (id, patch) => {
        const state = get();
        set({
          frames: state.frames.map((f) => (f.id === id ? { ...f, ...patch } : f)),
          undoStack: [...state.undoStack, snapshotOf(state)].slice(-HISTORY_LIMIT),
          redoStack: [],
        });
      },

      moveFrame: (id, xCm, yCm, skipSnap) => {
        const { grid } = get();
        const snappedX = skipSnap ? xCm : snapValue(xCm, grid.cellSizeCm, grid.snapEnabled);
        const snappedY = skipSnap ? yCm : snapValue(yCm, grid.cellSizeCm, grid.snapEnabled);
        set((state) => ({
          frames: state.frames.map((f) =>
            f.id === id
              ? {
                  ...f,
                  xCm: snappedX,
                  yCm: snappedY,
                  fixings: calculateFixings(f.widthCm, f.heightCm, snappedX, snappedY),
                }
              : f,
          ),
        }));
      },

      resizeFrame: (id, widthCm, heightCm) => {
        const state = get();
        set({
          frames: state.frames.map((f) =>
            f.id === id
              ? {
                  ...f,
                  widthCm,
                  heightCm,
                  fixings: calculateFixings(widthCm, heightCm, f.xCm, f.yCm),
                }
              : f,
          ),
          undoStack: [...state.undoStack, snapshotOf(state)].slice(-HISTORY_LIMIT),
          redoStack: [],
        });
      },

      rotateFrame: (id) => {
        const state = get();
        set({
          frames: state.frames.map((f) =>
            f.id === id
              ? {
                  ...f,
                  orientation: f.orientation === 'portrait' ? 'landscape' : 'portrait',
                  widthCm: f.heightCm,
                  heightCm: f.widthCm,
                  fixings: calculateFixings(f.heightCm, f.widthCm, f.xCm, f.yCm),
                  artwork: {
                    ...f.artwork,
                    rotationDeg: (((f.artwork.rotationDeg ?? 0) + 90) % 360) as 0 | 90 | 180 | 270,
                  },
                }
              : f,
          ),
          undoStack: [...state.undoStack, snapshotOf(state)].slice(-HISTORY_LIMIT),
          redoStack: [],
        });
      },

      selectFrame: (id) => set({ selectedFrameId: id }),

      loadProject: (data) => {
        const state = get();
        set({
          wall: data.wall,
          grid: data.grid,
          frames: data.frames,
          selectedFrameId: null,
          undoStack: [...state.undoStack, snapshotOf(state)].slice(-HISTORY_LIMIT),
          redoStack: [],
        });
      },

      undo: () => {
        const state = get();
        if (state.undoStack.length === 0) return;
        const prev = state.undoStack[state.undoStack.length - 1];
        set({
          wall: prev.wall,
          grid: prev.grid,
          frames: prev.frames,
          selectedFrameId: null,
          undoStack: state.undoStack.slice(0, -1),
          redoStack: [...state.redoStack, snapshotOf(state)].slice(-HISTORY_LIMIT),
        });
      },

      redo: () => {
        const state = get();
        if (state.redoStack.length === 0) return;
        const next = state.redoStack[state.redoStack.length - 1];
        set({
          wall: next.wall,
          grid: next.grid,
          frames: next.frames,
          selectedFrameId: null,
          redoStack: state.redoStack.slice(0, -1),
          undoStack: [...state.undoStack, snapshotOf(state)].slice(-HISTORY_LIMIT),
        });
      },

      canUndo: () => get().undoStack.length > 0,
      canRedo: () => get().redoStack.length > 0,
    }),
    {
      name: 'wall-frame-planner-storage',
      storage: createJSONStorage(() => indexedDbStorage),
      partialize: (state) => ({ wall: state.wall, grid: state.grid, frames: state.frames }),
    },
  ),
);
